import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, X, Loader2, FileText, AlertTriangle,
  RotateCcw, RotateCw, CheckSquare, Square, RefreshCw,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import {
  saveBlobViaAnchor,
  SAVE_RESULT_BROWSER,
} from '../utils/saveBlobToDisk';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ─── helpers ─────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Normalize rotation to 0 / 90 / 180 / 270 */
function norm(deg) {
  return ((deg % 360) + 360) % 360;
}

/* ═══════════════════════════════════════════════════════
   ROTATE PDF PAGE
   ═══════════════════════════════════════════════════════ */
export default function RotatePDF() {
  /* ─── file state ─────────────────────────────────────── */
  const [pdfFile, setPdfFile]         = useState(null);
  const [arrayBuffer, setArrayBuffer] = useState(null);
  const [pageCount, setPageCount]     = useState(0);
  const [thumbnails, setThumbnails]   = useState([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [isDragOver, setIsDragOver]   = useState(false);

  /* ─── rotation state ─────────────────────────────────── */
  const [rotations, setRotations]     = useState([]);   // per-page: 0, 90, 180, 270
  const [selectedPages, setSelectedPages] = useState(new Set());

  /* ─── processing ─────────────────────────────────────── */
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState(null);

  /* ─── results ────────────────────────────────────────── */
  const [resultBlob, setResultBlob] = useState(null);
  const [resultName, setResultName] = useState('');
  const [isSuccess, setIsSuccess]   = useState(false);

  const fileInputRef = useRef(null);

  /* ─── load PDF ────────────────────────────────────────── */
  const loadPdf = useCallback(async (file) => {
    if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
      setError('Please select a valid PDF file.');
      return;
    }
    setError(null);
    setThumbnails([]);
    setSelectedPages(new Set());
    setRotations([]);
    setResultBlob(null);
    setIsSuccess(false);
    setThumbsLoading(true);

    const buf = await file.arrayBuffer();
    setArrayBuffer(buf);
    setPdfFile(file);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

      let pdfDoc;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: buf.slice(0), verbosity: 0 }).promise;
      } catch (e) {
        if (e.name === 'PasswordException' || e.message?.includes('password')) {
          try {
            pdfDoc = await pdfjsLib.getDocument({ data: buf.slice(0), password: '', verbosity: 0 }).promise;
          } catch {
            setError('This PDF is password-protected and cannot be opened.');
            setThumbsLoading(false);
            return;
          }
        } else throw e;
      }

      const n = pdfDoc.numPages;
      setPageCount(n);
      setRotations(new Array(n).fill(0));

      const limit = Math.min(n, 40);
      const thumbArr = new Array(n).fill(null);
      for (let i = 1; i <= limit; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 0.28 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          thumbArr[i - 1] = canvas.toDataURL('image/jpeg', 0.6);
          canvas.width = 0; canvas.height = 0;
        } catch { /* page render failed */ }
      }
      setThumbnails(thumbArr);
    } catch (err) {
      setError(`Could not read PDF: ${err.message}`);
    } finally {
      setThumbsLoading(false);
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadPdf(file);
  };

  /* ─── rotation helpers ───────────────────────────────── */
  const rotatePage = (idx, dir) => {
    setRotations(prev => {
      const copy = [...prev];
      copy[idx] = norm(copy[idx] + dir);
      return copy;
    });
  };

  const rotateSelected = (dir) => {
    setRotations(prev => prev.map((r, i) => selectedPages.has(i + 1) ? norm(r + dir) : r));
  };

  const rotateAll = (dir) => {
    setRotations(prev => prev.map(r => norm(r + dir)));
  };

  const resetAll = () => {
    setRotations(prev => prev.map(() => 0));
  };

  /* ─── selection helpers ──────────────────────────────── */
  const togglePage = (n) => setSelectedPages(prev => {
    const s = new Set(prev);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });
  const selectAll  = () => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)));
  const selectNone = () => setSelectedPages(new Set());

  /* ─── apply rotations (pdf-lib on main thread) ─────── */
  const handleApply = async () => {
    if (!arrayBuffer) return;
    setProcessing(true);
    setError(null);

    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
      const pages = doc.getPages();

      for (let i = 0; i < pages.length; i++) {
        if (rotations[i] !== 0) {
          const currentRotation = pages[i].getRotation().angle;
          pages[i].setRotation(degrees(currentRotation + rotations[i]));
        }
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      setResultBlob(blob);
      setResultName(`${baseName}_rotated.pdf`);
      setIsSuccess(true);
    } catch (err) {
      setError(`Rotation failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ─── download ───────────────────────────────────────── */
  const handleDownload = () => {
    if (!resultBlob) return false;
    saveBlobViaAnchor(resultBlob, resultName);
    return SAVE_RESULT_BROWSER;
  };

  /* ─── reset ──────────────────────────────────────────── */
  const handleReset = () => {
    setPdfFile(null); setArrayBuffer(null); setPageCount(0);
    setThumbnails([]); setSelectedPages(new Set());
    setRotations([]); setResultBlob(null);
    setIsSuccess(false); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── computed ───────────────────────────────────────── */
  const hasChanges = rotations.some(r => r !== 0);
  const changedCount = rotations.filter(r => r !== 0).length;

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 16px 120px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── Header ──────────────────────────────────────── */}
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
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
          >
            <ArrowLeft size={18} /> Back to Home
          </Link>

          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: 'white', marginBottom: 10, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Rotate PDF
          </h1>
          <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>
            Fix page orientation — rotate individual pages or all at once
          </p>
        </div>

        {/* ── Error banner ────────────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: 14, padding: '20px 24px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
          }}>
            <AlertTriangle size={20} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#F87171', fontSize: '0.9rem', margin: '0 0 2px' }}>Something went wrong</p>
              <p style={{ fontSize: '0.8rem', color: '#FCA5A5', margin: 0 }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', cursor: 'pointer', color: '#E4E4E7', fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            SUCCESS STATE
            ════════════════════════════════════════════════════ */}
        {isSuccess && (
          <HeroDitheringCard accentColor="#6366f1" minHeight={320} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
              Rotation Applied
            </h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', fontWeight: 500, marginBottom: 28, textAlign: 'center' }}>
              {changedCount} page{changedCount !== 1 ? 's' : ''} rotated
            </p>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <DownloadButton
                onDownload={handleDownload}
                label="Download Rotated PDF"
                disabled={!resultBlob}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={handleReset}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: '#E4E4E7', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Rotate Another PDF
              </button>
              <Link
                to="/"
                style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', color: '#E4E4E7', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Back to Tools
              </Link>
            </div>
          </HeroDitheringCard>
        )}

        {/* ════════════════════════════════════════════════════
            UPLOAD ZONE
            ════════════════════════════════════════════════════ */}
        {!pdfFile && !isSuccess && (
          <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: 20 }}>
            <UploadCard
              status="idle"
              title={isDragOver ? 'Drop your PDF here!' : 'Drop your PDF to rotate'}
              description="or click to browse"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
            />
            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) loadPdf(e.target.files[0]); e.target.value = ''; }} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            MAIN TOOL PANEL
            ════════════════════════════════════════════════════ */}
        {pdfFile && !isSuccess && (
          <>
            {/* ── File info bar ───────────────────────────────── */}
            <div style={{
              borderRadius: 14, padding: '16px 20px', marginBottom: 24,
              backgroundColor: '#1C1D21',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {thumbnails[0] ? (
                <img src={thumbnails[0]} alt="p1" style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 52, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#818CF8" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pdfFile.name}</p>
                <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: 0 }}>{formatSize(pdfFile.size)} · {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={handleReset}
                style={{
                  width: 32, height: 32, borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#EF4444', transition: 'all 0.2s ease',
                }}
                title="Remove file"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Bulk controls bar ───────────────────────────── */}
            <div style={{
              borderRadius: 14, padding: '16px 20px', marginBottom: 22,
              backgroundColor: '#1C1D21',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem', margin: '0 0 2px' }}>
                    Rotation Controls
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: 0 }}>
                    {selectedPages.size} of {pageCount} selected · {changedCount} page{changedCount !== 1 ? 's' : ''} modified
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAll} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: '#E4E4E7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CheckSquare size={13} /> Select All
                  </button>
                  <button onClick={selectNone} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: '#E4E4E7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Square size={13} /> Clear
                  </button>
                </div>
              </div>

              {/* Bulk action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => rotateAll(-90)} style={bulkBtnStyle}>
                  <RotateCcw size={14} /> Rotate All Left
                </button>
                <button onClick={() => rotateAll(90)} style={bulkBtnStyle}>
                  <RotateCw size={14} /> Rotate All Right
                </button>
                <button
                  onClick={() => rotateSelected(-90)}
                  disabled={selectedPages.size === 0}
                  style={{ ...bulkBtnStyle, opacity: selectedPages.size === 0 ? 0.4 : 1, cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <RotateCcw size={14} /> Selected Left
                </button>
                <button
                  onClick={() => rotateSelected(90)}
                  disabled={selectedPages.size === 0}
                  style={{ ...bulkBtnStyle, opacity: selectedPages.size === 0 ? 0.4 : 1, cursor: selectedPages.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <RotateCw size={14} /> Selected Right
                </button>
                <button
                  onClick={resetAll}
                  disabled={!hasChanges}
                  style={{ ...bulkBtnStyle, borderColor: hasChanges ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)', color: hasChanges ? '#FCA5A5' : '#71717A', opacity: hasChanges ? 1 : 0.4, cursor: hasChanges ? 'pointer' : 'not-allowed' }}
                >
                  <RefreshCw size={14} /> Reset All
                </button>
              </div>
            </div>

            {/* ── Thumbnail grid ──────────────────────────────── */}
            <div style={{
              borderRadius: 14, padding: '20px',
              backgroundColor: '#1C1D21',
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              marginBottom: 22,
            }}>
              {thumbsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 0', color: '#818CF8' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#A1A1AA' }}>Loading page previews…</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 14 }}>
                  {Array.from({ length: pageCount }, (_, i) => {
                    const pageNum = i + 1;
                    const selected = selectedPages.has(pageNum);
                    const thumb = thumbnails[i];
                    const rot = rotations[i] || 0;
                    return (
                      <div
                        key={pageNum}
                        style={{
                          borderRadius: 14,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          padding: 0,
                        }}
                      >
                        {/* Thumbnail — click to select */}
                        <button
                          onClick={() => togglePage(pageNum)}
                          style={{
                            width: '100%', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden',
                            outline: selected ? '2px solid #6366f1' : '2px solid transparent',
                            outlineOffset: 2,
                            boxShadow: selected ? '0 4px 14px rgba(99,102,241,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.18s ease',
                            position: 'relative',
                            border: 'none', background: 'rgba(255,255,255,0.03)',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={`Page ${pageNum}`}
                              style={{
                                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                                transform: `rotate(${rot}deg)`,
                                transition: 'transform 0.3s ease',
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '100%', height: '100%',
                              background: 'rgba(99,102,241,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transform: `rotate(${rot}deg)`,
                              transition: 'transform 0.3s ease',
                            }}>
                              <FileText size={20} color="#818CF8" />
                            </div>
                          )}

                          {/* Selection check */}
                          {selected && (
                            <div style={{
                              position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                              borderRadius: '50%', background: '#6366f1',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6rem', color: 'white', fontWeight: 900,
                            }}>✓</div>
                          )}

                          {/* Rotation badge */}
                          {rot !== 0 && (
                            <div style={{
                              position: 'absolute', top: 4, left: 4,
                              padding: '2px 6px', borderRadius: 6,
                              background: 'rgba(99,102,241,0.85)',
                              fontSize: '0.6rem', fontWeight: 700, color: 'white',
                              backdropFilter: 'blur(4px)',
                            }}>{rot}°</div>
                          )}
                        </button>

                        {/* Per-page controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => rotatePage(i, -90)}
                            style={pageBtnStyle}
                            title="Rotate left"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <span style={{ fontSize: '0.68rem', fontWeight: selected ? 700 : 500, color: selected ? '#818CF8' : '#71717A', minWidth: 24, textAlign: 'center' }}>
                            {pageNum}
                          </span>
                          <button
                            onClick={() => rotatePage(i, 90)}
                            style={pageBtnStyle}
                            title="Rotate right"
                          >
                            <RotateCw size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Processing overlay ────────────────────────── */}
            <div style={{
              borderRadius: 14, padding: '24px',
              backgroundColor: '#1C1D21', border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              marginBottom: 22,
              opacity: processing ? 1 : 0,
              pointerEvents: processing ? 'auto' : 'none',
              maxHeight: processing ? 120 : 0,
              overflow: 'hidden',
              transition: 'opacity 0.2s ease, max-height 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Loader2 size={22} color="#818CF8" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 700, color: 'white', margin: '0 0 2px' }}>Applying rotations…</p>
                  <p style={{ color: '#A1A1AA', fontSize: '0.8rem', margin: 0 }}>Rotating {changedCount} page{changedCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* ── Action button ────────────────────────────────── */}
            {!processing && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <MotionButton
                  onClick={handleApply}
                  disabled={!hasChanges}
                  loading={processing}
                  label={`Apply & Download (${changedCount} page${changedCount !== 1 ? 's' : ''})`}
                  classes="shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
                />
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ─── shared inline styles ────────────────────────────── */
const bulkBtnStyle = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.06)',
  color: '#E4E4E7',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.2s ease',
};

const pageBtnStyle = {
  width: 24, height: 24, borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#A1A1AA',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
  transition: 'all 0.15s ease',
};
