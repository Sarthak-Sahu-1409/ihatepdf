import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, X, FileText, Zap, SlidersHorizontal, Feather,
  AlertTriangle, Check, Info, Loader2,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import { saveBlobToDisk } from '../utils/saveBlobToDisk';
import { useWorker } from '../hooks/useWorker';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import formatFileSize from '../utils/formatFileSize';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';

const COMPRESSION_LEVELS = [
  {
    id: 'screen',
    Icon: Zap,
    label: 'Maximum',
    sublabel: 'Email & web',
    reduction: 'Up to 70% smaller',
  },
  {
    id: 'ebook',
    Icon: SlidersHorizontal,
    label: 'Balanced',
    sublabel: 'Sharing & reading',
    reduction: 'Up to 50% smaller',
  },
  {
    id: 'printer',
    Icon: Feather,
    label: 'Light',
    sublabel: 'Print & archive',
    reduction: 'Up to 20% smaller',
  },
];

const LEVEL_LABELS = { screen: 'Maximum', ebook: 'Balanced', printer: 'Light' };

/* ════════════════════════════════════════════════════════════════
   COMPRESS PDF PAGE
   ════════════════════════════════════════════════════════════════ */
export default function CompressPDF() {
  const [pdfFile, setPdfFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState('ebook');
  const [thumbnail, setThumbnail] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const fileInputRef = useRef(null);

  // Web Worker for off-main-thread compression
  const { run: runWorker, progress, running: processing } = useWorker('pdf');

  const savedPercent =
    originalSize > 0
      ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
      : 0;

  /* ── file loading ─────────────────────────────────────────── */
  const handleFileLoad = async (file) => {
    if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
      setError('Please select a valid PDF file.');
      return;
    }
    setPdfFile(file);
    setOriginalSize(file.size);
    setError(null);
    setIsSuccess(false);
    setCompressedBlob(null);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const ab = await file.arrayBuffer();

      let doc;
      try {
        doc = await pdfjsLib.getDocument({ data: ab.slice(0), verbosity: 0 }).promise;
      } catch (err) {
        if (err.name === 'PasswordException' || err.message?.includes('password')) {
          try {
            doc = await pdfjsLib.getDocument({ data: ab.slice(0), password: '', verbosity: 0 }).promise;
          } catch { setPageCount(0); setThumbnail(null); return; }
        } else { setPageCount(0); setThumbnail(null); return; }
      }

      setPageCount(doc.numPages);
      try {
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
      } catch { setThumbnail(null); }
    } catch { /* silent */ }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  };

  const handleRemoveFile = () => {
    setPdfFile(null); setThumbnail(null); setPageCount(0);
    setOriginalSize(0); setError(null); setIsSuccess(false);
    setCompressedBlob(null); setCompressedSize(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── compression logic (runs in Web Worker) ──────────────── */
  const handleCompress = async () => {
    if (!pdfFile) return;
    setError(null);

    try {
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      const arrayBuffer = isLargeFile(pdfFile) ? await processLargeFile(pdfFile) : await pdfFile.arrayBuffer();

      // Send the buffer to the worker (copy it so we keep the original)
      const bufferCopy = arrayBuffer.slice(0);
      const result = await runWorker(
        'compress',
        { buffer: bufferCopy, level: compressionLevel },
        [bufferCopy]
      );

      const blob = new Blob([result.data], { type: 'application/pdf' });
      setCompressedBlob(blob);
      setCompressedSize(result.compressedSize || blob.size);
      setIsSuccess(true);
    } catch (err) {
      setError(`Compression failed: ${err.message}. The PDF may be encrypted or corrupted.`);
    }
  };

  const handleDownload = async () => {
    if (!compressedBlob) return false;
    const baseName = (pdfFile?.name || 'document').replace(/\.pdf$/i, '');
    return saveBlobToDisk(compressedBlob, `${baseName}-compressed.pdf`);
  };

  const handleReset = () => {
    handleRemoveFile();
    setCompressedBlob(null); setCompressedSize(0);
    setIsSuccess(false); setProgress(0);
  };

  const PROCESSING_STEPS = [
    { label: 'Loading PDF',           threshold: 20 },
    { label: 'Stripping metadata',    threshold: 50 },
    { label: 'Optimizing structure',  threshold: 80 },
    { label: 'Finalizing output',     threshold: 100 },
  ];

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 16px 120px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 20,
              background: 'rgba(255,255,255,0.06)', fontWeight: 600,
              color: '#E4E4E7', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s ease', marginBottom: 24,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
          >
            <ArrowLeft size={18} /> Back to Home
          </Link>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: 'white', marginBottom: 10, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Compress PDF
          </h1>
        </div>

        {/* ── Error ──────────────────────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: 14, padding: '20px 24px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
          }}>
            <AlertTriangle size={22} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#F87171', fontSize: '0.9rem', margin: '0 0 2px' }}>Compression failed</p>
              <p style={{ fontSize: '0.8rem', color: '#FCA5A5', margin: 0 }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', cursor: 'pointer', color: '#E4E4E7', fontWeight: 600, transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Success ────────────────────────────────────────── */}
        {isSuccess && (
          <HeroDitheringCard accentColor="#6366f1" minHeight={420} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
              Compression Complete!
            </h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', fontWeight: 500, marginBottom: 24, textAlign: 'center' }}>
              {pdfFile?.name}
            </p>

            {/* Before / After */}
            <div style={{
              borderRadius: 14, padding: '18px 20px', marginBottom: 20, width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Before</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F87171', margin: '0 0 2px' }}>{formatFileSize(originalSize)}</p>
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: 0 }}>Original</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    padding: '6px 10px', borderRadius: 10, marginBottom: 4,
                    background: savedPercent > 0 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${savedPercent > 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: savedPercent > 0 ? '#818CF8' : '#9CA3AF', margin: 0 }}>
                      {savedPercent > 0 ? `-${savedPercent}%` : '~0%'}
                    </p>
                  </div>
                  <span style={{ color: '#6B7280', fontSize: '1rem' }}>→</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>After</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34D399', margin: '0 0 2px' }}>{formatFileSize(compressedSize)}</p>
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: 0 }}>Compressed</p>
                </div>
              </div>

              {savedPercent > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${100 - savedPercent}%`, borderRadius: 999,
                      background: 'linear-gradient(90deg, #6366f1, #818CF8)',
                      transition: 'width 1s cubic-bezier(0.34,1.2,0.64,1)',
                    }} />
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, marginTop: 6 }}>
                    You saved {formatFileSize(originalSize - compressedSize)}
                  </p>
                </div>
              )}
            </div>

            {savedPercent <= 5 && (
              <div style={{
                borderRadius: 12, padding: '10px 14px', marginBottom: 16, width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <Info size={16} color="#818CF8" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: 0, fontWeight: 500 }}>
                  {savedPercent <= 0
                    ? 'This PDF is already as compact as possible — your original file is returned unchanged.'
                    : 'This PDF was already well-optimized. Minimal additional compression was possible.'}
                </p>
              </div>
            )}

            <DownloadButton onDownload={handleDownload} label="Download Compressed PDF" disabled={!compressedBlob} />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <button
                onClick={handleReset}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: '#E4E4E7', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Compress Another PDF
              </button>
              <Link
                to="/"
                style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', color: '#E4E4E7', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Back to Tools
              </Link>
            </div>
          </HeroDitheringCard>
        )}

        {/* ── Upload zone ────────────────────────────────────── */}
        {!pdfFile && !isSuccess && (
          <div onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: 20 }}>
            <UploadCard
              status="idle"
              title={isDragOver ? 'Drop your PDF here!' : 'Drop your PDF to compress'}
              description="or click to browse · Single PDF file"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
            />
            <input
              ref={fileInputRef} type="file" accept=".pdf" hidden
              onChange={(e) => { if (e.target.files[0]) handleFileLoad(e.target.files[0]); e.target.value = ''; }}
            />
          </div>
        )}

        {/* ── File loaded ─────────────────────────────────────── */}
        {pdfFile && !isSuccess && (
          <>
            {/* File card */}
            <div style={{
              borderRadius: 14, padding: '18px 22px', marginBottom: 20,
              backgroundColor: '#1C1D21',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {/* thumbnail */}
              <div style={{ width: 48, height: 60, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {thumbnail ? (
                  <img src={thumbnail} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={22} color="#52525B" />
                  </div>
                )}
              </div>

              {/* file info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: 'white', fontSize: '0.92rem', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pdfFile.name}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#A1A1AA', fontWeight: 500 }}>{formatFileSize(pdfFile.size)}</span>
                  {pageCount > 0 && <span style={{ fontSize: '0.78rem', color: '#A1A1AA', fontWeight: 500 }}>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>}
                </div>
              </div>

              {/* remove */}
              <button
                onClick={handleRemoveFile}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#F87171'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#EF4444'; }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Compression level selector */}
            <p style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              Choose Compression Level
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {COMPRESSION_LEVELS.map(({ id, Icon, label, sublabel, reduction }) => {
                const sel = compressionLevel === id;
                return (
                  <div
                    key={id}
                    onClick={() => setCompressionLevel(id)}
                    style={{
                      borderRadius: 14, padding: '16px 12px', cursor: 'pointer', textAlign: 'center',
                      position: 'relative',
                      backgroundColor: sel ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: sel ? '0 0 0 1px rgba(99,102,241,0.2) inset' : 'none',
                      transform: sel ? 'translateY(-2px)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {sel && (
                      <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={10} strokeWidth={3} color="white" />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <Icon size={20} color={sel ? '#818CF8' : '#52525B'} strokeWidth={1.8} />
                    </div>
                    <p style={{ fontWeight: 700, color: sel ? '#C7D2FE' : '#A1A1AA', fontSize: '0.85rem', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: '0.7rem', color: sel ? '#818CF8' : '#52525B', margin: '0 0 8px', fontWeight: 500 }}>{sublabel}</p>
                    <div style={{ padding: '3px 6px', borderRadius: 6, background: sel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`, fontSize: '0.62rem', fontWeight: 700, color: sel ? '#818CF8' : '#52525B' }}>
                      {reduction}
                    </div>
                  </div>
                );
              })}
            </div>

       

            {/* Compress button — MotionButton (content-sized, not full-bleed) */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <MotionButton
                type="button"
                onClick={handleCompress}
                disabled={!pdfFile || processing}
                loading={processing}
                label={
                  processing
                    ? `Compressing… ${progress}%`
                    : `Compress — ${LEVEL_LABELS[compressionLevel]}`
                }
                style={{ width: 'max-content', maxWidth: '100%', minWidth: 200 }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Processing overlay (always in DOM — avoids compositor flicker) ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: processing ? 'blur(8px)' : 'none',
        opacity: processing ? 1 : 0,
        pointerEvents: processing ? 'auto' : 'none',
        transition: 'opacity 0.18s ease',
        willChange: 'opacity',
      }}>
        <div style={{
          borderRadius: 20, padding: '40px 32px', textAlign: 'center',
          width: '100%', maxWidth: 360, margin: '0 16px',
          background: '#1C1D21', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'bounce 1s infinite',
            }}>
              <Loader2 size={28} strokeWidth={1.8} color="#818cf8" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: 6 }}>Compressing PDF</h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.85rem', marginBottom: 24 }}>Running locally in your browser...</p>

            {/* Progress bar */}
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #4338CA, #818CF8)', borderRadius: 999, transition: 'width 0.4s ease' }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#818CF8', fontWeight: 600, marginTop: 10 }}>{progress}%</p>

            {/* Step list */}
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              {PROCESSING_STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, opacity: progress >= i * 25 ? 1 : 0.35, transition: 'opacity 0.3s ease' }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: progress >= step.threshold ? '#6366f1' : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${progress >= step.threshold ? '#818CF8' : 'rgba(255,255,255,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease',
                  }}>
                    {progress >= step.threshold && <Check size={8} strokeWidth={3} color="white" />}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: progress >= step.threshold ? '#C7D2FE' : '#6B7280', fontWeight: 500, transition: 'color 0.3s ease' }}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
