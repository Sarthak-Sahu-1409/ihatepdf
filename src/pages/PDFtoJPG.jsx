import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, X, Loader2, FileText,
  TrendingDown, BarChart2, TrendingUp, Sparkles,
  AlertTriangle, Check, Download, Lock,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import { saveBlobToDisk, SAVE_RESULT_BROWSER } from '../utils/saveBlobToDisk';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import formatFileSize from '../utils/formatFileSize';

const QUALITY_OPTIONS = [
  { id: 0.5,  Icon: TrendingDown, label: 'Low',    desc: '~50 KB/pg' },
  { id: 0.75, Icon: BarChart2,    label: 'Medium',  desc: '~150 KB/pg' },
  { id: 0.9,  Icon: TrendingUp,   label: 'High',    desc: '~300 KB/pg' },
  { id: 1.0,  Icon: Sparkles,     label: 'Max',     desc: '~500 KB/pg' },
];

/** Fixed render scale (PDF.js viewport). 1.5 ≈ 108 DPI effective rasterization for typical pages. */
const OUTPUT_SCALE = 1.5;

/* ════════════════════════════════════════════════════════════
   PDF to JPG PAGE
   ════════════════════════════════════════════════════════════ */
export default function PDFtoJPG() {
  /* ── file ───────────────────────────────────────────────── */
  const [pdfFile, setPdfFile]       = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageCount, setPageCount]   = useState(0);
  const [thumbnail, setThumbnail]   = useState(null);

  /* ── settings ───────────────────────────────────────────── */
  const [quality, setQuality]             = useState(0.9);
  const [pageRangeMode, setPageRangeMode] = useState('all');
  const [fromPage, setFromPage]           = useState(1);
  const [toPage, setToPage]               = useState(1);

  /* ── processing ─────────────────────────────────────────── */
  const [currentPage, setCurrentPage]       = useState(0);
  const [completedThumbs, setCompletedThumbs] = useState([]);
  const [error, setError]                   = useState(null);
  const [processing, setProcessing]         = useState(false);
  const [progress, setProgress]             = useState(0);

  /* ── success ──────────────────────────────────────────── */
  const [isSuccess, setIsSuccess]       = useState(false);
  const [outputImages, setOutputImages] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);

  const fileInputRef = useRef(null);
  const pdfDocRef    = useRef(null);

  /* ── computed ─────────────────────────────────────────────── */
  const getPageCountToConvert = () =>
    pageRangeMode === 'all' ? pageCount : (toPage - fromPage + 1);

  const qualityLabel = QUALITY_OPTIONS.find(q => q.id === quality)?.label ?? '';

  /* ── file load ────────────────────────────────────────────── */
  const handleFileLoad = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }
    setPdfFile(file);
    setError(null);
    setIsSuccess(false);
    setOutputImages([]);
    setCompletedThumbs([]);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const ab = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: ab, verbosity: 0 }).promise;
      pdfDocRef.current = doc;
      const count = doc.numPages;
      setPageCount(count);
      setFromPage(1);
      setToPage(count);

      const pg = await doc.getPage(1);
      const vp = pg.getViewport({ scale: 0.4 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      setThumbnail(c.toDataURL('image/jpeg', 0.7));
    } catch (err) {
      setError(`Could not read PDF: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  };

  /* ── helper: canvas → JPEG blob ─────────────────────────── */
  const canvasToJpegBlob = (canvas, q) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encode failed'))),
        'image/jpeg',
        q
      );
    });

  /* ── convert (runs on main thread) ────────────────────── */
  const handleConvert = async () => {
    if (!pdfFile || !pdfDocRef.current) return;
    setCurrentPage(0);
    setCompletedThumbs([]);
    setError(null);
    setProcessing(true);
    setProgress(0);

    try {
      const doc = pdfDocRef.current;
      const startPage = pageRangeMode === 'all' ? 1 : fromPage;
      const endPage   = pageRangeMode === 'all' ? pageCount : toPage;
      const total     = endPage - startPage + 1;
      const baseName  = pdfFile.name.replace(/\.pdf$/i, '');

      const outputs = [];
      const thumbs  = [];

      for (let i = startPage; i <= endPage; i++) {
        setCurrentPage(i - startPage + 1);

        const page = await doc.getPage(i);
        const vp   = page.getViewport({ scale: OUTPUT_SCALE });

        // Render page to a regular canvas
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

        // Encode to JPEG
        const blob = await canvasToJpegBlob(canvas, quality);
        const dataUrl = URL.createObjectURL(blob);

        // Small thumbnail for the progress overlay
        const thumbScale = 0.25;
        const tw = Math.round(vp.width * thumbScale);
        const th = Math.round(vp.height * thumbScale);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = tw; thumbCanvas.height = th;
        thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, tw, th);
        const thumbBlob = await canvasToJpegBlob(thumbCanvas, 0.6);
        const thumbUrl  = URL.createObjectURL(thumbBlob);

        outputs.push({
          dataUrl,
          thumbUrl,
          blob,
          pageNum: i,
          width: canvas.width,
          height: canvas.height,
          filename: `${baseName}_page_${i}.jpg`,
        });
        thumbs.push(thumbUrl);

        setCompletedThumbs([...thumbs]);
        setProgress(Math.round(((i - startPage + 1) / total) * 100));

        // Yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }

      setOutputImages(outputs);
      setIsSuccess(true);
    } catch (err) {
      setError(`Conversion failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── download ─────────────────────────────────────────────── */
  const handleDownloadSingle = (img) => {
    saveBlobToDisk(img.blob, img.filename);
  };

  const handleDownloadAll = () => {
    outputImages.forEach((img, idx) => {
      setTimeout(() => saveBlobToDisk(img.blob, img.filename), idx * 200);
    });
    return SAVE_RESULT_BROWSER;
  };

  /* ── reset ────────────────────────────────────────────────── */
  const handleRemoveFile = () => {
    setPdfFile(null); setThumbnail(null); setPageCount(0);
    setFromPage(1); setToPage(1);
    setError(null); setIsSuccess(false); setOutputImages([]);
    setCompletedThumbs([]); pdfDocRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    handleRemoveFile();
    setLightboxImage(null);
    // Revoke any blob URLs
    outputImages.forEach((img) => {
      if (img.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(img.dataUrl);
      if (img.thumbUrl?.startsWith('blob:')) URL.revokeObjectURL(img.thumbUrl);
    });
  };

  /** One rhythm for vertical stack, grids, and sibling controls (px). */
  const LAYOUT_GAP = 16;
  /** Air between last settings card and standalone convert button. */
  const WORKSPACE_ABOVE_STICKY = 28;

  /* ── shared card style (gradient depth + readable chrome) ─ */
  const darkCard = {
    borderRadius: 16,
    padding: '22px 22px',
    backgroundColor: '#14151a',
    backgroundImage: [
      'radial-gradient(120% 80% at 0% 0%, rgba(59,130,246,0.12) 0%, transparent 55%)',
      'linear-gradient(165deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.12) 100%)',
    ].join(', '),
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2) inset, inset 0 1px 0 rgba(255,255,255,0.08)',
  };

  const sectionLabelStyle = {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    margin: `0 0 ${LAYOUT_GAP}px`,
  };

  const ghostBtn = {
    padding: '10px 20px', borderRadius: 8,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
    color: '#E4E4E7', transition: 'all 0.2s ease',
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 20px 160px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Header ────────────────────────────────────────── */}
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
            PDF to JPG
          </h1>
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: 14, padding: '20px 24px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: LAYOUT_GAP,
          }}>
            <AlertTriangle size={22} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#F87171', fontSize: '0.9rem', margin: '0 0 2px' }}>Conversion failed</p>
              <p style={{ fontSize: '0.8rem', color: '#FCA5A5', margin: 0 }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{ ...ghostBtn, padding: '6px 14px', fontSize: '0.78rem' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────── */}
        {isSuccess && outputImages.length > 0 && (
          <>
            <HeroDitheringCard accentColor="#3B82F6" minHeight={300} style={{ marginBottom: LAYOUT_GAP }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
                {outputImages.length} {outputImages.length === 1 ? 'image' : 'images'} ready!
              </h3>
              <p style={{ color: '#A1A1AA', fontSize: '0.88rem', fontWeight: 500, marginBottom: 6, textAlign: 'center' }}>
                {pdfFile?.name}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                {[
                  { icon: <Lock size={12} />, label: 'Converted locally' },
                  { icon: null, label: `${qualityLabel} quality` },
                ].map((pill, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                    fontSize: '0.72rem', fontWeight: 600, color: '#93C5FD',
                  }}>
                    {pill.icon}{pill.label}
                  </span>
                ))}
              </div>

              <DownloadButton
                onDownload={handleDownloadAll}
                label={`Download All (${outputImages.length})`}
                disabled={outputImages.length === 0}
              />

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  onClick={handleReset}
                  style={ghostBtn}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
                >
                  Convert Another PDF
                </button>
                <Link
                  to="/"
                  style={{ ...ghostBtn, textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
                >
                  Back to Tools
                </Link>
              </div>
            </HeroDitheringCard>

            {/* Image gallery */}
            <p style={{ color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: `${LAYOUT_GAP}px 0 ${LAYOUT_GAP}px` }}>
              Output Images
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: LAYOUT_GAP, marginBottom: LAYOUT_GAP }}>
              {outputImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setLightboxImage(img)}
                  style={{
                    ...darkCard, padding: 0, cursor: 'pointer', overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 28px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.2) inset, inset 0 1px 0 rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2) inset, inset 0 1px 0 rgba(255,255,255,0.08)'; }}
                >
                  <div style={{ height: 150, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
                    <img src={img.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" alt={`Page ${img.pageNum}`} />
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: '#F4F4F5', fontSize: '0.8rem', margin: '0 0 4px' }}>Page {img.pageNum}</p>
                      <p style={{ fontSize: '0.7rem', color: '#A1A1AA', margin: 0 }}>{img.width}×{img.height}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadSingle(img); }}
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#60A5FA', transition: 'all 0.18s ease', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.25)'; e.currentTarget.style.color = '#93C5FD'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.color = '#60A5FA'; }}
                    >
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Upload zone ────────────────────────────────────── */}
        {!pdfFile && !isSuccess && (
          <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: LAYOUT_GAP }}>
            <UploadCard
              status="idle"
              title={isDragOver ? 'Drop your PDF here!' : 'Drop your PDF to convert to images'}
              description="or click to browse · Single PDF file"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
            />
            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) handleFileLoad(e.target.files[0]); e.target.value = ''; }} />
          </div>
        )}

        {/* ── Settings workspace ────────────────────────────── */}
        {pdfFile && !isSuccess && (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: LAYOUT_GAP }}>

              {/* File card */}
              <div style={{ ...darkCard, display: 'flex', alignItems: 'center', gap: LAYOUT_GAP }}>
                <div style={{ width: 48, height: 60, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {thumbnail
                    ? <img src={thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={22} color="#94A3B8" /></div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '0.9rem', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfFile.name}</p>
                  <p style={{ fontSize: '0.8rem', color: '#CBD5E1', margin: 0 }}>{formatFileSize(pdfFile.size)} · {pageCount} pages</p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', transition: 'all 0.2s ease', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Quality selector */}
              <div style={darkCard}>
                <p style={sectionLabelStyle}>Image Quality</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: LAYOUT_GAP, columnGap: LAYOUT_GAP }}>
                  {QUALITY_OPTIONS.map(({ id, Icon, label, desc }) => {
                    const sel = quality === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setQuality(id)}
                        style={{
                          borderRadius: 14,
                          padding: '16px 14px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          position: 'relative',
                          backgroundImage: sel
                            ? 'linear-gradient(160deg, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0.06) 100%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
                          backgroundColor: sel ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.15)',
                          border: `1px solid ${sel ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: sel ? '0 8px 24px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                          transform: sel ? 'translateY(-2px)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {sel && (
                          <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.5)' }}>
                            <Check size={10} strokeWidth={3} color="white" />
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                          <Icon size={20} color={sel ? '#93C5FD' : '#94A3B8'} strokeWidth={1.8} />
                        </div>
                        <p style={{ fontWeight: 700, color: sel ? '#E0F2FE' : '#E4E4E7', fontSize: '0.84rem', margin: '0 0 6px' }}>{label}</p>
                        <p style={{ fontSize: '0.72rem', color: sel ? '#93C5FD' : '#A1A1AA', margin: 0, fontWeight: 500 }}>{desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page range */}
              <div style={darkCard}>
                <p style={sectionLabelStyle}>Pages to Convert</p>
                <div style={{ display: 'flex', gap: LAYOUT_GAP, marginBottom: pageRangeMode === 'custom' ? LAYOUT_GAP : 0 }}>
                  {[
                    { id: 'all', label: `All ${pageCount} pages` },
                    { id: 'custom', label: 'Custom range' },
                  ].map(({ id, label }) => {
                    const sel = pageRangeMode === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setPageRangeMode(id)}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          padding: '12px 16px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          color: sel ? '#E0F2FE' : '#D4D4D8',
                          backgroundImage: sel
                            ? 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.08) 100%)'
                            : 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                          border: `1px solid ${sel ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: sel ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
                {pageRangeMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: LAYOUT_GAP, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1' }}>From</label>
                    <input
                      type="number" min={1} max={pageCount} value={fromPage}
                      onChange={e => setFromPage(Math.min(Math.max(1, parseInt(e.target.value) || 1), toPage))}
                      style={{ width: 64, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', fontWeight: 700, textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', color: '#FAFAFA', outline: 'none', fontSize: '0.9rem' }}
                    />
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1' }}>To</label>
                    <input
                      type="number" min={fromPage} max={pageCount} value={toPage}
                      onChange={e => setToPage(Math.min(Math.max(fromPage, parseInt(e.target.value) || fromPage), pageCount))}
                      style={{ width: 64, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', fontWeight: 700, textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', color: '#FAFAFA', outline: 'none', fontSize: '0.9rem' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 600 }}>= {toPage - fromPage + 1} images</span>
                  </div>
                )}
              </div>
          </div>

          {/* Convert CTA — standalone pill (same pattern as Compress PDF), not inside a chrome bar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: WORKSPACE_ABOVE_STICKY, marginBottom: 8 }}>
            <MotionButton
              type="button"
              onClick={handleConvert}
              disabled={!pdfFile || processing}
              loading={processing}
              label={processing ? `Converting… ${progress}%` : 'Convert to JPG'}
              style={{ width: 'max-content', maxWidth: '100%', minWidth: 200 }}
            />
          </div>
          </>
        )}
      </div>

      {/* ── Processing overlay (always mounted — avoids compositor flicker) ── */}
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
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'bounce 1s infinite',
            }}>
              <Loader2 size={28} strokeWidth={1.8} color="#60A5FA" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: 6 }}>Converting to JPG</h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.85rem', marginBottom: 24 }}>
              Rendering page {currentPage} of {getPageCountToConvert()}
            </p>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #1D4ED8, #60A5FA)', borderRadius: 999, transition: 'width 0.4s ease' }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#60A5FA', fontWeight: 600, marginTop: 10, marginBottom: completedThumbs.length ? 16 : 0 }}>{progress}%</p>
            {completedThumbs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', maxHeight: 72, overflow: 'hidden' }}>
                {completedThumbs.slice(-6).map((thumb, i) => (
                  <div key={i} style={{ width: 40, height: 50, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <img src={thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lightbox ──────────────────────────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              borderRadius: 16, overflow: 'hidden', maxWidth: '90vw', maxHeight: '85vh',
              boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
              position: 'relative', cursor: 'default',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <img
              src={lightboxImage.dataUrl}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              alt={`Page ${lightboxImage.pageNum}`}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '12px 16px',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.8), transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#A1A1AA', fontWeight: 600, fontSize: '0.82rem' }}>
                Page {lightboxImage.pageNum} — {lightboxImage.width}×{lightboxImage.height}px
              </span>
              <button
                onClick={() => handleDownloadSingle(lightboxImage)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: '#3B82F6', color: 'white',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Download size={14} /> Download
              </button>
            </div>
            <button
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.5)', color: 'white',
                fontSize: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
