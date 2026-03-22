import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Scissors, X, Loader2,
  Eye, AlignJustify, Copy, FileText, AlertTriangle,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import {
  saveBlobToDisk,
  saveBlobViaAnchor,
  SAVE_RESULT_BROWSER,
} from '../utils/saveBlobToDisk';
import { useWorker } from '../hooks/useWorker';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ─── helpers ─────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ═══════════════════════════════════════════════════════
   SPLIT PDF PAGE
   ═══════════════════════════════════════════════════════ */
export default function SplitPDF() {
  /* ─── file state ─────────────────────────────────────── */
  const [pdfFile, setPdfFile]         = useState(null);
  const [arrayBuffer, setArrayBuffer] = useState(null);
  const [pageCount, setPageCount]     = useState(0);
  const [thumbnails, setThumbnails]   = useState([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [isDragOver, setIsDragOver]   = useState(false);

  /* ─── split mode ─────────────────────────────────────── */
  const [splitMode, setSplitMode] = useState('visual');

  /* ─── visual mode ─────────────────────────────────────── */
  const [selectedPages, setSelectedPages] = useState(new Set());

  /* ─── range mode ──────────────────────────────────────── */
  const [ranges, setRanges] = useState([{ from: 1, to: 1 }]);

  /* ─── processing ───────────────────────────────── */
  const [error, setError]           = useState(null);

  /* ─── results ────────────────────────────────── */
  const [outputs, setOutputs]   = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef(null);

  // Web Worker for off-main-thread splitting
  const { run: runWorker, progress, running: processing } = useWorker('pdf');

  /* ─── load PDF ────────────────────────────────────────── */
  const loadPdf = useCallback(async (file) => {
    if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
      setError('Please select a valid PDF file.');
      return;
    }
    setError(null);
    setThumbnails([]);
    setSelectedPages(new Set());
    setOutputs([]);
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
      setSelectedPages(new Set(Array.from({ length: n }, (_, i) => i + 1)));
      setRanges([{ from: 1, to: n }]);

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

  /* ─── visual mode helpers ─────────────────────────────── */
  const togglePage = (n) => setSelectedPages(prev => {
    const s = new Set(prev);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });
  const selectAll  = () => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)));
  const selectNone = () => setSelectedPages(new Set());

  /* ─── range mode helpers ──────────────────────────────── */
  const addRange    = () => setRanges(r => [...r, { from: 1, to: pageCount }]);
  const removeRange = (i) => setRanges(r => r.filter((_, idx) => idx !== i));
  const updateRange = (i, field, val) => {
    const v = Math.max(1, Math.min(pageCount, parseInt(val) || 1));
    setRanges(r => r.map((rng, idx) => idx === i ? { ...rng, [field]: v } : rng));
  };

  /* ─── build range list ────────────────────────────────── */
  const buildRanges = () => {
    if (splitMode === 'all') return Array.from({ length: pageCount }, (_, i) => ({ from: i + 1, to: i + 1 }));
    if (splitMode === 'visual') {
      if (selectedPages.size === 0) return [];
      return Array.from(selectedPages).sort((a, b) => a - b).map(p => ({ from: p, to: p }));
    }
    return ranges.filter(r => r.from >= 1 && r.to >= r.from && r.to <= pageCount);
  };

  /* ─── split (runs in Web Worker) ───────────────────── */
  const handleSplit = async () => {
    const rngList = buildRanges();
    if (!rngList.length) { setError('No valid ranges — please select pages or configure ranges.'); return; }
    if (!arrayBuffer) return;

    setError(null);

    try {
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      let buf = arrayBuffer;
      if (isLargeFile(pdfFile)) buf = await processLargeFile(pdfFile);

      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const bufferCopy = buf.slice(0);

      const result = await runWorker(
        'split',
        { buffer: bufferCopy, ranges: rngList },
        [bufferCopy]
      );

      // Convert ArrayBuffer results to Blobs
      const results = result.data.map((item) => ({
        name: `${baseName}_pages_${item.from}-${item.to}.pdf`,
        blob: new Blob([item.bytes], { type: 'application/pdf' }),
        size: item.size,
        from: item.from,
        to: item.to,
      }));

      setOutputs(results);
      setIsSuccess(true);
    } catch (err) {
      setError(`Split failed: ${err.message}`);
    }
  };

  /* ─── download ────────────────────────────────────────── */
  const downloadOne = (item) => {
    if (!item?.blob) return false;
    saveBlobViaAnchor(item.blob, item.name);
    return SAVE_RESULT_BROWSER;
  };
  const downloadAll = () => {
    if (outputs.length === 0) return false;
    outputs.forEach(o => { if (o.blob) saveBlobViaAnchor(o.blob, o.name); });
    return SAVE_RESULT_BROWSER;
  };

  /* ─── reset ─────────────────────────────────────── */
  const handleReset = () => {
    setPdfFile(null); setArrayBuffer(null); setPageCount(0);
    setThumbnails([]); setSelectedPages(new Set());
    setRanges([{ from: 1, to: 1 }]); setOutputs([]);
    setIsSuccess(false); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── computed ────────────────────────────────────────── */
  const rangesValid = buildRanges().length > 0;

  const splitLabel = processing
    ? `Splitting… ${progress}%`
    : splitMode === 'all'
      ? `Split into ${pageCount} Files`
      : splitMode === 'visual'
        ? `Extract ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
        : `Split into ${ranges.length} File${ranges.length !== 1 ? 's' : ''}`;

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
            Split PDF
          </h1>
          <p style={{ color: '#A1A1AA', fontSize: '0.9rem', margin: 0 }}>
            Extract pages visually, by range, or split every page into its own file
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
          <HeroDitheringCard accentColor="#6366f1" minHeight={420} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
              Split Complete!
            </h2>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', fontWeight: 500, marginBottom: 28, textAlign: 'center' }}>
              {outputs.length} file{outputs.length !== 1 ? 's' : ''} ready to download
            </p>

            {outputs.length > 1 && (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <DownloadButton
                  onDownload={downloadAll}
                  label={`Download All ${outputs.length} Files`}
                  disabled={outputs.length === 0}
                />
              </div>
            )}

            {/* Individual file cards — auto-fit collapses empty tracks so one file stays centered/full-width */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                marginBottom: 20,
                width: '100%',
                maxWidth: '100%',
                justifyItems: 'stretch',
              }}
            >
              {outputs.map((item, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 14,
                    padding: '16px 14px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={16} color="#818CF8" />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          color: 'white',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          textAlign: 'center',
                        }}
                      >
                        {item.name}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#A1A1AA', margin: '4px 0 0', fontWeight: 500, textAlign: 'center' }}>
                        {item.from === item.to ? `Page ${item.from}` : `Pages ${item.from}–${item.to}`} · {formatSize(item.size)}
                      </p>
                    </div>
                  </div>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <DownloadButton onDownload={() => downloadOne(item)} label="Download" disabled={!item.blob} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
              <button
                onClick={handleReset}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', color: '#E4E4E7', transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Split Another PDF
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
              title={isDragOver ? 'Drop your PDF here!' : 'Drop your PDF to split'}
              description="or click to browse · Single PDF file"
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

            {/* ── Mode selector ───────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { id: 'visual', icon: <Eye size={16} />,          label: 'Visual Pick',  sub: 'Click pages to select' },
                { id: 'range',  icon: <AlignJustify size={16} />, label: 'Page Ranges',  sub: 'Type from–to ranges' },
                { id: 'all',    icon: <Copy size={16} />,         label: 'Every Page',   sub: 'One file per page' },
              ].map(m => {
                const active = splitMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSplitMode(m.id)}
                    style={{
                      flex: 1, minWidth: 130, padding: '14px 16px', borderRadius: 14,
                      border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                      background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ color: active ? '#818CF8' : '#71717A', marginBottom: 6 }}>{m.icon}</div>
                    <p style={{ fontWeight: 700, color: active ? '#C7D2FE' : '#E4E4E7', fontSize: '0.88rem', margin: '0 0 2px' }}>{m.label}</p>
                    <p style={{ color: active ? '#818CF8' : '#71717A', fontSize: '0.72rem', margin: 0, fontWeight: 500 }}>{m.sub}</p>
                  </button>
                );
              })}
            </div>

            {/* ── VISUAL MODE: Thumbnail grid ──────────────────── */}
            {splitMode === 'visual' && (
              <div style={{
                borderRadius: 14, padding: '20px',
                backgroundColor: '#1C1D21',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                marginBottom: 22,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem', margin: '0 0 2px' }}>
                      Select pages to extract
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: 0 }}>
                      {selectedPages.size} of {pageCount} selected · each becomes its own PDF
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={selectAll} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: '#E4E4E7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Select All</button>
                    <button onClick={selectNone} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: '#E4E4E7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>
                </div>

                {thumbsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 0', color: '#818CF8' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#A1A1AA' }}>Loading page previews…</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                    {Array.from({ length: pageCount }, (_, i) => {
                      const pageNum = i + 1;
                      const selected = selectedPages.has(pageNum);
                      const thumb = thumbnails[i];
                      return (
                        <button
                          key={pageNum}
                          onClick={() => togglePage(pageNum)}
                          style={{
                            borderRadius: 14, border: 'none', background: 'transparent',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            transform: selected ? 'scale(1.05)' : 'scale(1)',
                            transition: 'transform 0.18s ease',
                          }}
                        >
                          <div style={{
                            width: '100%', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden',
                            outline: selected ? '2px solid #6366f1' : '2px solid transparent',
                            outlineOffset: 2,
                            boxShadow: selected ? '0 4px 14px rgba(99,102,241,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.18s ease',
                            position: 'relative',
                          }}>
                            {thumb ? (
                              <img src={thumb} alt={`Page ${pageNum}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={20} color="#818CF8" />
                              </div>
                            )}
                            {selected && (
                              <div style={{
                                position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                                borderRadius: '50%', background: '#6366f1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: 'white', fontWeight: 900,
                              }}>✓</div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.68rem', fontWeight: selected ? 700 : 500, color: selected ? '#818CF8' : '#71717A' }}>
                            p.{pageNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── RANGE MODE ──────────────────────────────────── */}
            {splitMode === 'range' && (
              <div style={{
                borderRadius: 14, padding: '20px',
                backgroundColor: '#1C1D21',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                marginBottom: 22,
              }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem', margin: '0 0 2px' }}>Configure page ranges</h3>
                  <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: 0 }}>Each range creates a separate PDF file</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {ranges.map((r, i) => (
                    <div key={i} style={{
                      borderRadius: 12, padding: '14px 16px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</label>
                          <input
                            type="number" min={1} max={pageCount} value={r.from}
                            onChange={e => updateRange(i, 'from', e.target.value)}
                            style={{
                              padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)',
                              fontWeight: 700, color: 'white', fontSize: '1rem', width: '100%',
                              background: 'rgba(99,102,241,0.08)', outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '1rem', color: '#6366f1', paddingTop: 18 }}>→</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</label>
                          <input
                            type="number" min={1} max={pageCount} value={r.to}
                            onChange={e => updateRange(i, 'to', e.target.value)}
                            style={{
                              padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)',
                              fontWeight: 700, color: 'white', fontSize: '1rem', width: '100%',
                              background: 'rgba(99,102,241,0.08)', outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                        <p style={{ fontSize: '0.68rem', color: '#818CF8', margin: 0, fontWeight: 600 }}>Output name:</p>
                        <p style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, margin: 0, wordBreak: 'break-all' }}>…_pages_{r.from}-{r.to}.pdf</p>
                      </div>
                      {ranges.length > 1 && (
                        <button onClick={() => removeRange(i)} style={{
                          width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#EF4444', flexShrink: 0, transition: 'all 0.2s ease',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        ><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addRange}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 20px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)',
                    color: '#E4E4E7', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                >
                  <Plus size={15} /> Add Another Range
                </button>
              </div>
            )}

            {/* ── EVERY PAGE MODE ──────────────────────────────── */}
            {splitMode === 'all' && (
              <div style={{
                borderRadius: 14, padding: '28px 24px',
                backgroundColor: '#1C1D21',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                marginBottom: 22, textAlign: 'center',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Copy size={22} color="#818CF8" />
                </div>
                <h3 style={{ fontWeight: 800, color: 'white', fontSize: '1.2rem', margin: '0 0 8px' }}>
                  Split every page individually
                </h3>
                <p style={{ color: '#A1A1AA', fontSize: '0.88rem', margin: '0 0 12px', fontWeight: 500 }}>
                  This will produce <strong style={{ color: '#C7D2FE' }}>{pageCount} separate PDF files</strong>, one for each page.
                </p>
                <div style={{ display: 'inline-flex', gap: 8, padding: '8px 18px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => (
                    <span key={i} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818CF8', padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)' }}>
                      p.{i + 1}.pdf
                    </span>
                  ))}
                  {pageCount > 5 && <span style={{ fontSize: '0.72rem', color: '#71717A', alignSelf: 'center' }}>+{pageCount - 5} more</span>}
                </div>
              </div>
            )}

            {/* ── Processing state (always in DOM) ─────────────── */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <Loader2 size={22} color="#818CF8" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 700, color: 'white', margin: '0 0 2px' }}>Splitting your PDF…</p>
                  <p style={{ color: '#A1A1AA', fontSize: '0.8rem', margin: 0 }}>Processing {buildRanges().length} output file{buildRanges().length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: 'linear-gradient(90deg, #4338CA, #818CF8)',
                  width: `${progress}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{ textAlign: 'right', fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, marginTop: 4 }}>{progress}%</p>
            </div>

            {/* ── Action button ────────────────────────────────── */}
            {!processing && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <MotionButton
                  onClick={handleSplit}
                  disabled={!rangesValid}
                  label={splitLabel}
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
