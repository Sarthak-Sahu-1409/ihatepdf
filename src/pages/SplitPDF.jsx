import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Download, ArrowLeft, Plus, Trash2, Scissors, X, Loader2 } from 'lucide-react';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ─── helpers ─────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* purple clay shadow tokens */
const S = {
  card: '0 8px 0px rgba(109,40,217,0.38), 0 24px 60px rgba(124,58,237,0.32), inset 0 -10px 24px rgba(124,58,237,0.22), inset 0 10px 24px rgba(255,255,255,0.92)',
  btn:  '0 6px 0px rgba(109,40,217,0.42), 0 16px 40px rgba(124,58,237,0.35), inset 0 -6px 14px rgba(109,40,217,0.28), inset 0 6px 14px rgba(221,214,254,0.5)',
  sm:   '0 4px 0px rgba(109,40,217,0.28), 0 10px 26px rgba(124,58,237,0.22), inset 0 -4px 10px rgba(124,58,237,0.18), inset 0 4px 10px rgba(255,255,255,0.9)',
  back: '0 5px 0px rgba(109,40,217,0.25), 0 14px 36px rgba(124,58,237,0.2), inset 0 -4px 10px rgba(109,40,217,0.15), inset 0 4px 10px rgba(255,255,255,0.97)',
  err:  '0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.2), inset 0 -5px 12px rgba(220,38,38,0.18), inset 0 5px 12px rgba(255,255,255,0.85)',
  out:  '0 7px 0px rgba(109,40,217,0.35), 0 20px 50px rgba(124,58,237,0.3), inset 0 -8px 18px rgba(124,58,237,0.22), inset 0 8px 18px rgba(255,255,255,0.92)',
};

/* ═══════════════════════════════════════════════════════
   SPLIT PDF PAGE
   ═══════════════════════════════════════════════════════ */
export default function SplitPDF() {
  /* ─── file state ─────────────────────────────────────── */
  const [pdfFile, setPdfFile]       = useState(null);
  const [arrayBuffer, setArrayBuffer] = useState(null);
  const [pageCount, setPageCount]   = useState(0);
  const [thumbnails, setThumbnails] = useState([]); // array[pageIndex] = dataUrl
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  /* ─── split mode ─────────────────────────────────────── */
  // 'visual' | 'range' | 'all'
  const [splitMode, setSplitMode]   = useState('visual');

  /* ─── visual mode: selected pages ─────────────────────── */
  const [selectedPages, setSelectedPages] = useState(new Set());

  /* ─── range mode: list of {from,to} ───────────────────── */
  const [ranges, setRanges]         = useState([{ from: 1, to: 1 }]);

  /* ─── processing ─────────────────────────────────────── */
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState(null);

  /* ─── results ────────────────────────────────────────── */
  const [outputs, setOutputs]       = useState([]); // [{name, blob, size}]
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

      // Render thumbnails (max 40)
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
  const selectAll = () => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)));
  const selectNone = () => setSelectedPages(new Set());

  /* ─── range mode helpers ──────────────────────────────── */
  const addRange = () => setRanges(r => [...r, { from: 1, to: pageCount }]);
  const removeRange = (i) => setRanges(r => r.filter((_, idx) => idx !== i));
  const updateRange = (i, field, val) => {
    const v = Math.max(1, Math.min(pageCount, parseInt(val) || 1));
    setRanges(r => r.map((rng, idx) => idx === i ? { ...rng, [field]: v } : rng));
  };

  /* ─── build range list for splitting ─────────────────── */
  const buildRanges = () => {
    if (splitMode === 'all') {
      return Array.from({ length: pageCount }, (_, i) => ({ from: i + 1, to: i + 1 }));
    }
    if (splitMode === 'visual') {
      // Consecutive selected pages become one output
      if (selectedPages.size === 0) return [];
      const sorted = Array.from(selectedPages).sort((a, b) => a - b);
      // Each selected page as its OWN file (visual = pick individual pages to extract)
      return sorted.map(p => ({ from: p, to: p }));
    }
    // range mode
    return ranges.filter(r => r.from >= 1 && r.to >= r.from && r.to <= pageCount);
  };

  /* ─── split ───────────────────────────────────────────── */
  const handleSplit = async () => {
    const rngList = buildRanges();
    if (!rngList.length) {
      setError('No valid ranges — please select pages or configure ranges.');
      return;
    }
    if (!arrayBuffer) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const { PDFDocument } = await import('pdf-lib');

      let buf = arrayBuffer;
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      if (isLargeFile(pdfFile)) {
        buf = await processLargeFile(pdfFile);
      }

      const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const results = [];

      for (let i = 0; i < rngList.length; i++) {
        const { from, to } = rngList[i];
        const newDoc = await PDFDocument.create();
        const indices = Array.from({ length: to - from + 1 }, (_, k) => from - 1 + k);
        const pages = await newDoc.copyPages(srcDoc, indices);
        pages.forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        results.push({
          name: `${baseName}_pages_${from}-${to}.pdf`,
          blob,
          size: bytes.byteLength,
          from,
          to,
        });
        setProgress(Math.round(((i + 1) / rngList.length) * 95));
      }

      setProgress(100);
      setOutputs(results);
      setIsSuccess(true);
    } catch (err) {
      setError(`Split failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ─── download ────────────────────────────────────────── */
  const downloadOne = (item) => {
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = url; a.download = item.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadAll = () => outputs.forEach(o => downloadOne(o));

  /* ─── reset ───────────────────────────────────────────── */
  const handleReset = () => {
    setPdfFile(null); setArrayBuffer(null); setPageCount(0);
    setThumbnails([]); setSelectedPages(new Set());
    setRanges([{ from: 1, to: 1 }]); setOutputs([]);
    setIsSuccess(false); setProgress(0); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── computed ────────────────────────────────────────── */
  const rangesValid = buildRanges().length > 0;

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
              padding: '10px 22px', borderRadius: 18,
              background: 'rgba(255,255,255,0.92)', fontWeight: 700,
              color: '#5B21B6', textDecoration: 'none', marginBottom: 24,
              boxShadow: S.back, transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <ArrowLeft size={17} /> Back to Home
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: '#DDD6FE', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
              boxShadow: S.sm,
            }}>✂️</div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, color: 'white', margin: 0, textShadow: '0 4px 20px rgba(0,0,0,0.18)', letterSpacing: '-0.02em' }}>
                Split PDF
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.88rem', margin: 0 }}>
                Extract pages visually, by range, or split every page into its own file
              </p>
            </div>
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: 18, padding: '14px 18px', marginBottom: 20,
            background: '#FEE2E2', boxShadow: S.err,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <p style={{ flex: 1, fontWeight: 600, color: '#991B1B', fontSize: '0.88rem', margin: 0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 10, padding: '4px 12px', color: '#991B1B', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            SUCCESS STATE
            ════════════════════════════════════════════════════ */}
        {isSuccess && (
          <div style={{ borderRadius: 32, padding: '32px 28px', background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)', boxShadow: S.card, marginBottom: 24 }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22, margin: '0 auto 12px',
                background: '#DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                boxShadow: S.sm,
              }}>✅</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3B0764', margin: '0 0 4px' }}>
                Split Complete!
              </h2>
              <p style={{ color: '#6D28D9', fontSize: '0.9rem', margin: 0 }}>
                {outputs.length} file{outputs.length !== 1 ? 's' : ''} ready to download
              </p>
            </div>

            {/* Download all button */}
            {outputs.length > 1 && (
              <button
                onClick={downloadAll}
                style={{
                  width: '100%', padding: '14px 20px', borderRadius: 18, border: 'none',
                  background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 20, boxShadow: S.btn,
                  transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Download size={20} /> Download All {outputs.length} Files
              </button>
            )}

            {/* Individual output cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              {outputs.map((item, i) => (
                <div key={i} style={{
                  borderRadius: 20, padding: '16px 14px', background: 'rgba(255,255,255,0.82)',
                  boxShadow: '0 5px 0px rgba(109,40,217,0.22), 0 12px 30px rgba(124,58,237,0.18), inset 0 -5px 12px rgba(124,58,237,0.1), inset 0 5px 12px rgba(255,255,255,0.95)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: '#EDE9FE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      boxShadow: '0 3px 0px rgba(109,40,217,0.2), inset 0 2px 6px rgba(255,255,255,0.9)',
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>📄</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#3B0764', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                      <p style={{ fontSize: '0.7rem', color: '#7C3AED', margin: 0, fontWeight: 500 }}>
                        {item.from === item.to ? `Page ${item.from}` : `Pages ${item.from}–${item.to}`} • {formatSize(item.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadOne(item)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 12, border: 'none',
                      background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                      color: 'white', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 0px rgba(109,40,217,0.35), 0 10px 24px rgba(124,58,237,0.28)',
                      transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <Download size={13} /> Download
                  </button>
                </div>
              ))}
            </div>

            {/* Split Another button */}
            <button
              onClick={handleReset}
              style={{
                width: '100%', padding: 12, borderRadius: 16, border: 'none',
                background: 'rgba(255,255,255,0.7)', color: '#6D28D9',
                fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
                boxShadow: '0 4px 0px rgba(109,40,217,0.15), 0 10px 24px rgba(124,58,237,0.12), inset 0 -3px 8px rgba(109,40,217,0.1), inset 0 3px 8px rgba(255,255,255,0.95)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              ✂️ Split Another PDF
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            UPLOAD ZONE (no file loaded)
            ════════════════════════════════════════════════════ */}
        {!pdfFile && !isSuccess && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{
              borderRadius: 32,
              minHeight: 260,
              background: isDragOver
                ? 'linear-gradient(160deg, #C4B5FD 0%, #A78BFA 100%)'
                : 'linear-gradient(160deg, #EDE9FE 0%, #DDD6FE 100%)',
              boxShadow: isDragOver ? S.card : S.out,
              border: isDragOver ? '3px dashed #7C3AED' : '3px dashed transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 14, padding: '48px 24px', cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              transform: isDragOver ? 'scale(1.02) translateY(-4px)' : 'scale(1)',
              marginBottom: 24,
            }}
          >
            <div style={{
              width: 88, height: 88, borderRadius: 24, background: 'rgba(255,255,255,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: S.sm, marginBottom: 4,
            }}>
              <Upload size={38} color="#7C3AED" strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3B0764', letterSpacing: '-0.01em' }}>
              Drop your PDF here
            </h3>
            <p style={{ color: '#6D28D9', fontSize: '0.9rem', fontWeight: 500 }}>
              or click anywhere in this box to browse
            </p>
            <div style={{
              padding: '6px 18px', borderRadius: 999,
              background: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600, color: '#7C3AED',
              boxShadow: 'inset 0 -2px 6px rgba(124,58,237,0.1), inset 0 2px 6px rgba(255,255,255,0.8)',
            }}>
              Single PDF file only
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) loadPdf(e.target.files[0]); e.target.value = ''; }} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            MAIN TOOL PANEL (file loaded, not success)
            ════════════════════════════════════════════════════ */}
        {pdfFile && !isSuccess && (
          <>
            {/* ── File info bar ───────────────────────────────── */}
            <div style={{
              borderRadius: 24, padding: '16px 20px', marginBottom: 24,
              background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', boxShadow: S.sm,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {/* thumbnail preview */}
              {thumbnails[0] ? (
                <img src={thumbnails[0]} alt="p1" style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0, boxShadow: '0 3px 0px rgba(0,0,0,0.1)' }} />
              ) : (
                <div style={{ width: 40, height: 52, borderRadius: 8, background: '#C4B5FD', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>📄</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: '#3B0764', fontSize: '0.95rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pdfFile.name}</p>
                <p style={{ fontSize: '0.78rem', color: '#7C3AED', margin: 0 }}>{formatSize(pdfFile.size)} • {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={handleReset}
                style={{
                  width: 34, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.85)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7C3AED',
                  boxShadow: '0 3px 0px rgba(109,40,217,0.16), inset 0 -2px 6px rgba(109,40,217,0.1), inset 0 2px 6px rgba(255,255,255,0.95)',
                  transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                title="Remove file"
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Mode selector ───────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { id: 'visual', emoji: '👁️', label: 'Visual Pick', sub: 'Click pages to select' },
                { id: 'range',  emoji: '🔢', label: 'Page Ranges', sub: 'Type from–to ranges' },
                { id: 'all',    emoji: '📑', label: 'Every Page', sub: 'One file per page' },
              ].map(m => {
                const active = splitMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSplitMode(m.id)}
                    style={{
                      flex: 1, minWidth: 130, padding: '14px 16px', borderRadius: 20, border: 'none',
                      background: active ? 'linear-gradient(135deg, #DDD6FE, #C4B5FD)' : 'rgba(255,255,255,0.82)',
                      cursor: 'pointer', textAlign: 'left',
                      boxShadow: active ? S.sm : '0 3px 0px rgba(109,40,217,0.12), 0 8px 20px rgba(124,58,237,0.1), inset 0 -2px 6px rgba(109,40,217,0.08), inset 0 2px 6px rgba(255,255,255,0.95)',
                      outline: active ? '2px solid #8B5CF6' : '2px solid transparent',
                      transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                      transform: active ? 'translateY(-2px)' : 'translateY(0)',
                    }}
                  >
                    <p style={{ fontSize: '1.1rem', margin: '0 0 2px' }}>{m.emoji}</p>
                    <p style={{ fontWeight: 800, color: '#3B0764', fontSize: '0.88rem', margin: '0 0 1px' }}>{m.label}</p>
                    <p style={{ color: '#7C3AED', fontSize: '0.72rem', margin: 0, fontWeight: 500 }}>{m.sub}</p>
                  </button>
                );
              })}
            </div>

            {/* ── VISUAL MODE: Thumbnail grid ──────────────────── */}
            {splitMode === 'visual' && (
              <div style={{ borderRadius: 28, padding: '20px 20px 24px', background: 'linear-gradient(145deg, #F5F3FF, #EDE9FE)', boxShadow: S.out, marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontWeight: 800, color: '#3B0764', fontSize: '1rem', margin: '0 0 2px' }}>
                      Select pages to extract
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#7C3AED', margin: 0 }}>
                      {selectedPages.size} of {pageCount} selected • each becomes its own PDF
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={selectAll} style={{ padding: '6px 14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.85)', color: '#6D28D9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: S.back }}>Select All</button>
                    <button onClick={selectNone} style={{ padding: '6px 14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.85)', color: '#6D28D9', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: S.back }}>Clear</button>
                  </div>
                </div>

                {thumbsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 0', color: '#7C3AED' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Loading page previews…</span>
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
                            transform: selected ? 'scale(1.06)' : 'scale(1)',
                            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                          }}
                        >
                          <div style={{
                            width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden',
                            outline: selected ? '3px solid #7C3AED' : '3px solid transparent',
                            outlineOffset: 2,
                            boxShadow: selected
                              ? '0 6px 0px rgba(109,40,217,0.35), 0 14px 32px rgba(124,58,237,0.32)'
                              : '0 3px 0px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)',
                            transition: 'all 0.18s ease',
                            position: 'relative',
                          }}>
                            {thumb ? (
                              <img src={thumb} alt={`Page ${pageNum}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: '#E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📄</div>
                            )}
                            {/* Checkmark overlay */}
                            {selected && (
                              <div style={{
                                position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                                borderRadius: 999, background: '#7C3AED',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', color: 'white', fontWeight: 900,
                              }}>✓</div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.68rem', fontWeight: selected ? 700 : 500, color: selected ? '#5B21B6' : '#7C3AED' }}>
                            {pageNum > 40 ? `p.${pageNum}` : `p.${pageNum}`}
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
              <div style={{ borderRadius: 28, padding: '20px 20px 24px', background: 'linear-gradient(145deg, #F5F3FF, #EDE9FE)', boxShadow: S.out, marginBottom: 22 }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontWeight: 800, color: '#3B0764', fontSize: '1rem', margin: '0 0 2px' }}>Configure page ranges</h3>
                  <p style={{ fontSize: '0.78rem', color: '#7C3AED', margin: 0 }}>Each range creates a separate PDF file</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {ranges.map((r, i) => (
                    <div key={i} style={{
                      borderRadius: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.85)',
                      boxShadow: '0 4px 0px rgba(109,40,217,0.15), 0 10px 26px rgba(124,58,237,0.12), inset 0 -3px 8px rgba(109,40,217,0.08), inset 0 3px 8px rgba(255,255,255,0.95)',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From (page)</label>
                          <input
                            type="number" min={1} max={pageCount} value={r.from}
                            onChange={e => updateRange(i, 'from', e.target.value)}
                            style={{
                              padding: '8px 12px', borderRadius: 12, border: '2px solid #C4B5FD',
                              fontWeight: 700, color: '#3B0764', fontSize: '1rem', width: '100%',
                              background: 'white', outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '1.2rem', color: '#8B5CF6', paddingTop: 20 }}>→</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To (page)</label>
                          <input
                            type="number" min={1} max={pageCount} value={r.to}
                            onChange={e => updateRange(i, 'to', e.target.value)}
                            style={{
                              padding: '8px 12px', borderRadius: 12, border: '2px solid #C4B5FD',
                              fontWeight: 700, color: '#3B0764', fontSize: '1rem', width: '100%',
                              background: 'white', outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                        <p style={{ fontSize: '0.68rem', color: '#7C3AED', margin: 0, fontWeight: 600 }}>Preview name:</p>
                        <p style={{ fontSize: '0.72rem', color: '#3B0764', fontWeight: 700, margin: 0, wordBreak: 'break-all' }}>
                          …_pages_{r.from}-{r.to}.pdf
                        </p>
                      </div>
                      {ranges.length > 1 && (
                        <button onClick={() => removeRange(i)} style={{
                          width: 32, height: 32, borderRadius: 10, border: 'none', background: '#FEE2E2',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          color: '#EF4444', flexShrink: 0,
                          boxShadow: '0 3px 0px rgba(185,28,28,0.15)',
                          transition: 'transform 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        ><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addRange}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 20px', borderRadius: 14, border: 'none',
                    background: 'rgba(255,255,255,0.9)', color: '#6D28D9', fontWeight: 700,
                    fontSize: '0.82rem', cursor: 'pointer', boxShadow: S.back,
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Plus size={15} /> Add Another Range
                </button>
              </div>
            )}

            {/* ── EXTRACT-ALL MODE ─────────────────────────────── */}
            {splitMode === 'all' && (
              <div style={{
                borderRadius: 28, padding: '28px 24px', background: 'linear-gradient(145deg, #F5F3FF, #EDE9FE)',
                boxShadow: S.out, marginBottom: 22, textAlign: 'center',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 22, margin: '0 auto 16px',
                  background: '#DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                  boxShadow: S.sm,
                }}>📑</div>
                <h3 style={{ fontWeight: 900, color: '#3B0764', fontSize: '1.2rem', margin: '0 0 8px' }}>
                  Split every page individually
                </h3>
                <p style={{ color: '#7C3AED', fontSize: '0.88rem', margin: '0 0 12px', fontWeight: 500 }}>
                  This will produce <strong>{pageCount} separate PDF files</strong>, one for each page.
                </p>
                <div style={{ display: 'inline-flex', gap: 8, padding: '8px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.7)', boxShadow: 'inset 0 2px 6px rgba(109,40,217,0.08)' }}>
                  {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => (
                    <span key={i} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5B21B6', padding: '3px 8px', borderRadius: 8, background: '#EDE9FE' }}>
                      p.{i + 1}.pdf
                    </span>
                  ))}
                  {pageCount > 5 && <span style={{ fontSize: '0.72rem', color: '#7C3AED', alignSelf: 'center' }}>…+{pageCount - 5} more</span>}
                </div>
              </div>
            )}

            {/* ── Processing / Split button ─────────────────────── */}
            {processing ? (
              <div style={{
                borderRadius: 24, padding: '24px 24px', background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
                boxShadow: S.card, marginBottom: 22,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <Loader2 size={28} color="#7C3AED" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 800, color: '#3B0764', margin: '0 0 2px' }}>Splitting your PDF…</p>
                    <p style={{ color: '#7C3AED', fontSize: '0.8rem', margin: 0 }}>Processing {buildRanges().length} output file{buildRanges().length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.6)', overflow: 'hidden', boxShadow: 'inset 0 2px 6px rgba(109,40,217,0.12)' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: 'linear-gradient(90deg, #8B5CF6, #6D28D9)',
                    width: `${progress}%`,
                    transition: 'width 0.4s cubic-bezier(0.34,1.2,0.64,1)',
                    boxShadow: '0 0 10px rgba(124,58,237,0.5)',
                  }} />
                </div>
                <p style={{ textAlign: 'right', fontSize: '0.75rem', color: '#7C3AED', fontWeight: 700, marginTop: 6 }}>{progress}%</p>
              </div>
            ) : (
              !isSuccess && (
                <button
                  onClick={handleSplit}
                  disabled={!rangesValid}
                  style={{
                    width: '100%', padding: '16px 20px', borderRadius: 20, border: 'none',
                    background: rangesValid ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : '#C4B5FD',
                    color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: rangesValid ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: rangesValid ? S.btn : 'none',
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onMouseEnter={e => rangesValid && (e.currentTarget.style.transform = 'translateY(-4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <Scissors size={22} />
                  {splitMode === 'all'
                    ? `Split into ${pageCount} Files`
                    : splitMode === 'visual'
                    ? `Extract ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
                    : `Split into ${ranges.length} File${ranges.length !== 1 ? 's' : ''}`}
                </button>
              )
            )}
          </>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }`}</style>
    </div>
  );
}