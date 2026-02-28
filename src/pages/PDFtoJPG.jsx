import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, Download, Loader2 } from 'lucide-react';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ─── helpers ──────────────────────────────────────────────── */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}



const qualityLabels = { 0.5: 'Low', 0.75: 'Medium', 0.9: 'High', 1.0: 'Max' };
const scaleLabels   = {
  1.0: 'Screen (72dpi)', 1.5: 'Standard (108dpi)',
  2.0: 'High-Res (144dpi)', 3.0: 'Print (216dpi)',
};

const statPill = {
  padding: '5px 12px', borderRadius: '10px',
  background: 'rgba(255,255,255,0.75)',
  fontSize: '0.8rem', fontWeight: 600, color: '#431407',
  boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)',
  display: 'inline-flex', alignItems: 'center', gap: '4px',
};

/* ════════════════════════════════════════════════════════════
   PDF to JPG PAGE
   ════════════════════════════════════════════════════════════ */
export default function PDFtoJPG() {
  /* ── file ─────────────────────────────────────────────────── */
  const [pdfFile, setPdfFile]       = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageCount, setPageCount]   = useState(0);
  const [thumbnail, setThumbnail]   = useState(null);

  /* ── settings ─────────────────────────────────────────────── */
  const [quality, setQuality]           = useState(0.9);
  const [scale, setScale]               = useState(1.5);
  const [pageRangeMode, setPageRangeMode] = useState('all');
  const [fromPage, setFromPage]         = useState(1);
  const [toPage, setToPage]             = useState(1);

  /* ── live preview ─────────────────────────────────────────── */
  const [previewDataUrl, setPreviewDataUrl]   = useState(null);
  const [previewDimensions, setPreviewDimensions] = useState({ w: 0, h: 0 });
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewDebounceRef = useRef(null);

  /* ── processing ───────────────────────────────────────────── */
  const [processing, setProcessing]       = useState(false);
  const [progress, setProgress]           = useState(0);
  const [currentPage, setCurrentPage]     = useState(0);
  const [completedThumbs, setCompletedThumbs] = useState([]);
  const [error, setError]                 = useState(null);

  /* ── success ──────────────────────────────────────────────── */
  const [isSuccess, setIsSuccess]         = useState(false);
  const [outputImages, setOutputImages]   = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);

  const fileInputRef = useRef(null);
  const pdfDocRef    = useRef(null);

  /* ── computed ─────────────────────────────────────────────── */
  const getPageCountToConvert = () =>
    pageRangeMode === 'all' ? pageCount : (toPage - fromPage + 1);

  const estimatedOutputSize = () => {
    if (!pageCount) return '0 MB';
    const kbPerPage = Math.round(scale * scale * quality * 200);
    const total = kbPerPage * getPageCountToConvert();
    return total < 1024 ? `${total} KB` : `${(total / 1024).toFixed(1)} MB`;
  };

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
    setPreviewDataUrl(null);

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

      // small thumbnail for file card
      const pg = await doc.getPage(1);
      const vp = pg.getViewport({ scale: 0.4 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      setThumbnail(c.toDataURL('image/jpeg', 0.7));

      generatePreview(doc, 0.9, 1.5);
    } catch (err) {
      setError(`Could not read PDF: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  };

  /* ── live preview ─────────────────────────────────────────── */
  const generatePreview = async (doc, q, s) => {
    if (!doc) return;
    setIsGeneratingPreview(true);
    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: s });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      setPreviewDataUrl(canvas.toDataURL('image/jpeg', q));
      setPreviewDimensions({ w: Math.round(viewport.width), h: Math.round(viewport.height) });
    } catch { /* silent */ }
    finally { setIsGeneratingPreview(false); }
  };

  useEffect(() => {
    if (!pdfDocRef.current) return;
    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      generatePreview(pdfDocRef.current, quality, scale);
    }, 350);
    return () => clearTimeout(previewDebounceRef.current);
  }, [quality, scale]);

  /* ── convert ──────────────────────────────────────────────── */
  const handleConvert = async () => {
    if (!pdfFile) return;
    setProcessing(true);
    setProgress(0);
    setCurrentPage(0);
    setCompletedThumbs([]);
    setError(null);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      const arrayBuffer = isLargeFile(pdfFile)
        ? await processLargeFile(pdfFile)
        : await pdfFile.arrayBuffer();

      const doc = await pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;
      const startPage = pageRangeMode === 'all' ? 1 : fromPage;
      const endPage   = pageRangeMode === 'all' ? pageCount : toPage;
      const total = endPage - startPage + 1;
      const baseName = pdfFile.name.replace(/\.pdf$/i, '');
      const outputs = [];

      for (let i = startPage; i <= endPage; i++) {
        setCurrentPage(i - startPage + 1);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const blob = await new Promise(resolve =>
          canvas.toBlob(resolve, 'image/jpeg', quality)
        );

        outputs.push({
          dataUrl, blob,
          pageNum: i,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          filename: `${baseName}_page_${i}.jpg`,
        });

        setCompletedThumbs(prev => [...prev, dataUrl]);
        setProgress(Math.round(((i - startPage + 1) / total) * 100));
        canvas.width = 0; canvas.height = 0;
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
    const url = URL.createObjectURL(img.blob);
    const a = document.createElement('a');
    a.href = url; a.download = img.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadAll = () => {
    outputImages.forEach((img, idx) => {
      setTimeout(() => handleDownloadSingle(img), idx * 200);
    });
  };

  /* ── reset ────────────────────────────────────────────────── */
  const handleRemoveFile = () => {
    setPdfFile(null); setThumbnail(null); setPageCount(0);
    setPreviewDataUrl(null); setFromPage(1); setToPage(1);
    setError(null); setIsSuccess(false); setOutputImages([]);
    setCompletedThumbs([]); pdfDocRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => { handleRemoveFile(); setProgress(0); setLightboxImage(null); };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 24px 140px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ─── SECTION 1: HEADER ────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 14, marginBottom: 24,
            background: 'rgba(255,255,255,0.88)', color: '#3730A3',
            fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
            boxShadow: '0 4px 0px rgba(55,48,163,0.2), 0 10px 28px rgba(60,100,220,0.18), inset 0 -3px 8px rgba(100,130,220,0.15), inset 0 3px 8px rgba(255,255,255,0.98)',
            transition: 'transform 0.2s ease',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >← Back</Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 5px 0px rgba(194,65,12,0.42), 0 14px 36px rgba(234,88,12,0.34), inset 0 -6px 14px rgba(234,88,12,0.28), inset 0 6px 14px rgba(255,255,255,0.95)',
            }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
                PDF → JPG
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: 0 }}>
                Convert every page to a high-res image — runs 100% in your browser
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { icon: '🔒', text: 'Files never uploaded' },
              { icon: '👁️', text: 'Preview before convert' },
              { icon: '📥', text: 'Download individually or all' },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600,
              }}>{b.icon} {b.text}</div>
            ))}
          </div>
        </div>

        {/* ─── ERROR ────────────────────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: 20, padding: '16px 20px', marginBottom: 16,
            background: '#FEE2E2',
            boxShadow: '0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.22), inset 0 -6px 14px rgba(220,38,38,0.18), inset 0 6px 14px rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#991B1B', fontSize: '0.9rem', margin: '0 0 3px' }}>Conversion failed</p>
              <p style={{ color: '#B91C1C', fontSize: '0.8rem', margin: 0 }}>{error}</p>
            </div>
            <button onClick={() => setError(null)} style={{
              padding: '5px 12px', borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.7)', color: '#991B1B',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>Dismiss</button>
          </div>
        )}

        {/* ─── SECTION 2: UPLOAD ZONE ───────────────────────── */}
        {!pdfFile && !isSuccess && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{
              borderRadius: 28, padding: '24px 28px', minHeight: 140,
              background: isDragOver ? '#FDBA74' : '#FED7AA',
              boxShadow: isDragOver
                ? '0 8px 0px rgba(194,65,12,0.55), 0 28px 70px rgba(234,88,12,0.5), inset 0 -12px 26px rgba(234,88,12,0.38), inset 0 12px 26px rgba(255,255,255,0.95)'
                : '0 7px 0px rgba(194,65,12,0.4), 0 20px 55px rgba(234,88,12,0.32), inset 0 -10px 22px rgba(234,88,12,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
              border: isDragOver ? '2px dashed #EA580C' : '2px dashed rgba(251,146,60,0.7)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
              transform: isDragOver ? 'scale(1.015)' : 'scale(1)',
              display: 'flex', alignItems: 'center', gap: 18,
              marginBottom: 20,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 0px rgba(194,65,12,0.22), 0 10px 26px rgba(234,88,12,0.2), inset 0 -4px 10px rgba(234,88,12,0.18), inset 0 4px 10px rgba(255,255,255,0.98)',
            }}>
              <Upload size={22} color="#C2410C" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: '1.05rem', color: '#431407', margin: '0 0 3px' }}>
                {isDragOver ? '📂 Drop your PDF here!' : 'Drop your PDF to convert to images'}
              </p>
              <p style={{ color: '#EA580C', fontSize: '0.82rem', margin: 0, fontWeight: 500 }}>
                or click to browse • Single PDF • Each page → 1 JPG
              </p>
            </div>
            <div style={{
              padding: '7px 14px', borderRadius: 12, flexShrink: 0,
              background: 'rgba(255,255,255,0.65)', color: '#C2410C',
              fontWeight: 700, fontSize: '0.78rem',
              boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Upload size={13} /> Select File
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) handleFileLoad(e.target.files[0]); e.target.value = ''; }} />
          </div>
        )}

        {/* ─── SECTION 3: SETTINGS + LIVE PREVIEW ──────────── */}
        {pdfFile && !isSuccess && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

            {/* LEFT: Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* File info card */}
              <div style={{
                borderRadius: 20, padding: '14px 18px', background: '#FED7AA',
                boxShadow: '0 6px 0px rgba(194,65,12,0.38), 0 18px 48px rgba(234,88,12,0.3), inset 0 -8px 20px rgba(234,88,12,0.24), inset 0 8px 20px rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 40, height: 50, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: '#FEF3C7', boxShadow: '0 3px 0px rgba(194,65,12,0.28)' }}>
                  {thumbnail
                    ? <img src={thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📄</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: '#431407', fontSize: '0.85rem', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfFile.name}</p>
                  <p style={{ color: '#EA580C', fontSize: '0.75rem', margin: 0, fontWeight: 600 }}>{formatFileSize(pdfFile.size)} • {pageCount} pages</p>
                </div>
                <button onClick={handleRemoveFile} style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none',
                  background: '#FEE2E2', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 0px rgba(185,28,28,0.25)',
                }}>
                  <X size={13} color="#DC2626" />
                </button>
              </div>

              {/* Quality selector */}
              <div style={{
                borderRadius: 20, padding: 16, background: '#FED7AA',
                boxShadow: '0 6px 0px rgba(194,65,12,0.35), 0 18px 45px rgba(234,88,12,0.28), inset 0 -8px 20px rgba(234,88,12,0.22), inset 0 8px 20px rgba(255,255,255,0.9)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Image Quality</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: 0.5,  label: 'Low',    emoji: '📉', fileSize: '~50KB/pg' },
                    { id: 0.75, label: 'Medium',  emoji: '📊', fileSize: '~150KB/pg' },
                    { id: 0.9,  label: 'High',   emoji: '📈', fileSize: '~300KB/pg' },
                    { id: 1.0,  label: 'Max',    emoji: '💎', fileSize: '~500KB/pg' },
                  ].map((q) => {
                    const isSel = quality === q.id;
                    return (
                      <div key={q.id} onClick={() => setQuality(q.id)} style={{
                        borderRadius: 14, padding: '10px 12px', cursor: 'pointer', textAlign: 'center',
                        background: isSel ? '#FDBA74' : 'rgba(255,255,255,0.55)',
                        boxShadow: isSel
                          ? '0 5px 0px rgba(194,65,12,0.45), 0 14px 32px rgba(234,88,12,0.35), inset 0 -6px 14px rgba(234,88,12,0.28), inset 0 6px 14px rgba(255,255,255,0.92)'
                          : '0 2px 0px rgba(194,65,12,0.15), inset 0 2px 6px rgba(255,255,255,0.7)',
                        transform: isSel ? 'translateY(-3px) scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                        position: 'relative',
                      }}>
                        {isSel && (
                          <div style={{
                            position: 'absolute', top: -5, right: -5,
                            width: 16, height: 16, borderRadius: '50%',
                            background: '#EA580C', color: 'white', fontSize: '0.55rem',
                            fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(194,65,12,0.5)',
                          }}>✓</div>
                        )}
                        <div style={{ fontSize: '1rem', marginBottom: 2 }}>{q.emoji}</div>
                        <p style={{ fontWeight: 800, color: '#431407', fontSize: '0.78rem', margin: '0 0 1px' }}>{q.label}</p>
                        <p style={{ fontSize: '0.62rem', color: '#92400E', margin: 0 }}>{q.fileSize}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scale/DPI selector */}
              <div style={{
                borderRadius: 20, padding: 16, background: '#FED7AA',
                boxShadow: '0 6px 0px rgba(194,65,12,0.35), 0 18px 45px rgba(234,88,12,0.28), inset 0 -8px 20px rgba(234,88,12,0.22), inset 0 8px 20px rgba(255,255,255,0.9)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Output Resolution</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 1.0, label: 'Screen',   dpi: '72 DPI',  emoji: '🖥️', use: 'Web & screen viewing' },
                    { id: 1.5, label: 'Standard', dpi: '108 DPI', emoji: '📱', use: 'Email & sharing' },
                    { id: 2.0, label: 'High-Res', dpi: '144 DPI', emoji: '🔍', use: 'General use ★' },
                    { id: 3.0, label: 'Print',    dpi: '216 DPI', emoji: '🖨️', use: 'Printing & archiving' },
                  ].map((s) => {
                    const isSel = scale === s.id;
                    return (
                      <div key={s.id} onClick={() => setScale(s.id)} style={{
                        borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                        background: isSel ? '#FDBA74' : 'rgba(255,255,255,0.5)',
                        boxShadow: isSel
                          ? '0 4px 0px rgba(194,65,12,0.42), 0 12px 28px rgba(234,88,12,0.32), inset 0 -5px 12px rgba(234,88,12,0.25), inset 0 5px 12px rgba(255,255,255,0.9)'
                          : '0 2px 0px rgba(194,65,12,0.12), inset 0 2px 6px rgba(255,255,255,0.65)',
                        transform: isSel ? 'translateY(-2px)' : 'translateY(0)',
                        transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{s.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontWeight: 800, color: '#431407', fontSize: '0.82rem', margin: 0 }}>{s.label}</p>
                            <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 700, color: '#92400E', background: 'rgba(255,255,255,0.55)' }}>{s.dpi}</span>
                          </div>
                          <p style={{ fontSize: '0.68rem', color: '#B45309', margin: 0 }}>{s.use}</p>
                        </div>
                        {isSel && (
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: '#EA580C', color: 'white', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 900,
                            boxShadow: '0 2px 6px rgba(194,65,12,0.5)',
                          }}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page range selector */}
              <div style={{
                borderRadius: 20, padding: 16, background: '#FED7AA',
                boxShadow: '0 6px 0px rgba(194,65,12,0.35), 0 18px 45px rgba(234,88,12,0.28), inset 0 -8px 20px rgba(234,88,12,0.22), inset 0 8px 20px rgba(255,255,255,0.9)',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Pages to Convert</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { id: 'all', label: `All ${pageCount} pages` },
                    { id: 'custom', label: 'Custom range' },
                  ].map((opt) => {
                    const isSel = pageRangeMode === opt.id;
                    return (
                      <div key={opt.id} onClick={() => setPageRangeMode(opt.id)} style={{
                        flex: 1, textAlign: 'center', padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                        background: isSel ? '#FDBA74' : 'rgba(255,255,255,0.5)',
                        fontWeight: 700, fontSize: '0.8rem', color: isSel ? '#431407' : '#92400E',
                        boxShadow: isSel
                          ? '0 4px 0px rgba(194,65,12,0.38), 0 10px 24px rgba(234,88,12,0.28), inset 0 -4px 10px rgba(234,88,12,0.22), inset 0 4px 10px rgba(255,255,255,0.9)'
                          : 'inset 0 2px 6px rgba(255,255,255,0.6)',
                        transform: isSel ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease',
                      }}>{opt.label}</div>
                    );
                  })}
                </div>
                {pageRangeMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407' }}>From</label>
                    <input
                      type="number" min={1} max={pageCount} value={fromPage}
                      onChange={e => setFromPage(Math.min(Math.max(1, parseInt(e.target.value) || 1), toPage))}
                      style={{ width: 60, padding: '7px 10px', borderRadius: 10, border: 'none', fontWeight: 700, textAlign: 'center', background: 'rgba(255,255,255,0.85)', color: '#431407', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.07)', outline: 'none', fontSize: '0.9rem' }}
                    />
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#431407' }}>To</label>
                    <input
                      type="number" min={fromPage} max={pageCount} value={toPage}
                      onChange={e => setToPage(Math.min(Math.max(fromPage, parseInt(e.target.value) || fromPage), pageCount))}
                      style={{ width: 60, padding: '7px 10px', borderRadius: 10, border: 'none', fontWeight: 700, textAlign: 'center', background: 'rgba(255,255,255,0.85)', color: '#431407', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.07)', outline: 'none', fontSize: '0.9rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>= {toPage - fromPage + 1} images</span>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT: Live Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                borderRadius: 24, padding: 16, background: '#FED7AA',
                boxShadow: '0 7px 0px rgba(194,65,12,0.4), 0 20px 55px rgba(234,88,12,0.32), inset 0 -10px 22px rgba(234,88,12,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontWeight: 700, color: '#431407', fontSize: '0.82rem', margin: 0 }}>👁️ Live Preview — Page 1</p>
                  {isGeneratingPreview && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#EA580C', fontWeight: 600 }}>
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      Updating...
                    </div>
                  )}
                </div>

                <div style={{
                  borderRadius: 14, overflow: 'hidden',
                  background: '#FEF3C7', minHeight: 200,
                  boxShadow: '0 4px 0px rgba(194,65,12,0.22), 0 12px 28px rgba(234,88,12,0.18), inset 0 -4px 10px rgba(234,88,12,0.12), inset 0 4px 10px rgba(255,255,255,0.8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {previewDataUrl ? (
                    <img src={previewDataUrl} style={{ width: '100%', maxHeight: 600, height: 'auto', objectFit: 'contain', display: 'block' }} alt="Preview" />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#EA580C' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600 }}>Preview loading...</p>
                    </div>
                  )}
                </div>

                {previewDataUrl && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {[
                      `${previewDimensions.w} × ${previewDimensions.h}px`,
                      `${qualityLabels[quality]} quality`,
                      scaleLabels[scale],
                    ].map((info, i) => (
                      <div key={i} style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', fontWeight: 700, color: '#431407' }}>{info}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── SECTION 4: STICKY ACTION BAR ────────────────── */}
        {pdfFile && !isSuccess && (
          <div style={{
            position: 'sticky', bottom: 20, zIndex: 40,
            borderRadius: 24, padding: '16px 20px',
            background: 'linear-gradient(135deg, #FEF3C7, #FED7AA)',
            boxShadow: '0 8px 0px rgba(194,65,12,0.3), 0 24px 65px rgba(234,88,12,0.32), inset 0 -10px 24px rgba(234,88,12,0.2), inset 0 10px 24px rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', gap: 12,
            marginTop: 32, marginBottom: 40, overflow: 'visible',
            flexWrap: 'wrap', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={statPill}>🖼️ {getPageCountToConvert()} images</div>
              <div style={statPill}>📦 ~{estimatedOutputSize()}</div>
              <div style={statPill}>{scaleLabels[scale]}</div>
            </div>
            <button
              onClick={handleConvert}
              disabled={processing || !pdfFile}
              style={{
                padding: '12px 28px', borderRadius: 16, border: 'none',
                background: processing ? 'linear-gradient(160deg, #94A3B8, #64748B)' : 'linear-gradient(160deg, #FB923C, #EA580C)',
                color: 'white', fontWeight: 800, fontSize: '0.95rem',
                cursor: processing ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: processing ? 'none' : '0 5px 0px rgba(194,65,12,0.55), 0 14px 36px rgba(234,88,12,0.45), inset 0 -5px 12px rgba(194,65,12,0.35), inset 0 5px 12px rgba(254,215,170,0.4)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { if (!processing) e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
            >
              {processing
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Converting... {progress}%</>
                : <>🖼️ Convert to JPG</>}
            </button>
          </div>
        )}

        {/* ─── SECTION 6: SUCCESS GALLERY ──────────────────── */}
        {isSuccess && outputImages.length > 0 && (
          <div>
            {/* Success header */}
            <div style={{
              borderRadius: 28, padding: '20px 24px', marginBottom: 16,
              background: 'linear-gradient(145deg, #FEF3C7, #FED7AA)',
              boxShadow: '0 8px 0px rgba(194,65,12,0.4), 0 24px 65px rgba(234,88,12,0.38), inset 0 -12px 26px rgba(234,88,12,0.24), inset 0 12px 26px rgba(255,255,255,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: '#FED7AA', fontSize: '1.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 5px 0px rgba(194,65,12,0.4), 0 14px 32px rgba(234,88,12,0.3), inset 0 -5px 12px rgba(234,88,12,0.25), inset 0 5px 12px rgba(255,255,255,0.95)',
                }}>✅</div>
                <div>
                  <h3 style={{ fontWeight: 900, color: '#431407', fontSize: '1.1rem', margin: '0 0 3px' }}>{outputImages.length} images ready!</h3>
                  <p style={{ color: '#92400E', fontSize: '0.78rem', margin: 0 }}>🔒 Converted locally • {scaleLabels[scale]} • {qualityLabels[quality]} quality</p>
                </div>
              </div>
              <button onClick={handleDownloadAll} style={{
                padding: '10px 22px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(160deg, #FB923C, #EA580C)',
                color: 'white', fontWeight: 800, fontSize: '0.88rem',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 5px 0px rgba(194,65,12,0.5), 0 14px 32px rgba(234,88,12,0.38), inset 0 -5px 12px rgba(194,65,12,0.3), inset 0 5px 12px rgba(254,215,170,0.4)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
              >
                <Download size={16} /> Download All ({outputImages.length})
              </button>
            </div>

            {/* Gallery grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {outputImages.map((img, idx) => (
                <div key={idx} style={{
                  borderRadius: 18, overflow: 'visible', background: '#FED7AA',
                  boxShadow: '0 6px 0px rgba(194,65,12,0.35), 0 18px 45px rgba(234,88,12,0.28), inset 0 -8px 18px rgba(234,88,12,0.22), inset 0 8px 18px rgba(255,255,255,0.9)',
                  transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
                  onClick={() => setLightboxImage(img)}
                >
                  <div style={{ borderRadius: '18px 18px 0 0', overflow: 'hidden', height: 140, background: '#FEF3C7' }}>
                    <img src={img.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" alt={`Page ${img.pageNum}`} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontWeight: 700, color: '#431407', fontSize: '0.75rem', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Page {img.pageNum}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.65rem', color: '#92400E', fontWeight: 600 }}>{img.width}×{img.height}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDownloadSingle(img); }}
                        style={{
                          padding: '4px 10px', borderRadius: 8, border: 'none',
                          background: '#EA580C', color: 'white',
                          fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 2px 0px rgba(194,65,12,0.5), 0 6px 14px rgba(234,88,12,0.3)',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <Download size={10} /> Save
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Convert Another */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleReset} style={{
                flex: 1, padding: 12, borderRadius: 16, border: '2px dashed rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.2)', color: 'white',
                fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                🖼️ Convert Another PDF
              </button>
              <Link to="/" style={{
                flex: 1, padding: 12, borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.85)', color: '#9A3412', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0px rgba(154,52,18,0.2), 0 10px 24px rgba(194,65,12,0.15), inset 0 -3px 8px rgba(194,65,12,0.1), inset 0 3px 8px rgba(255,255,255,0.95)', transition: 'transform 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                ← Back to Tools
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 5: PROCESSING OVERLAY ───────────────────── */}
      {processing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(67,20,7,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            borderRadius: 36, padding: '40px 36px', textAlign: 'center',
            maxWidth: 360, width: '100%',
            background: 'linear-gradient(145deg, #FEF3C7, #FED7AA)',
            boxShadow: '0 12px 0px rgba(194,65,12,0.45), 0 36px 90px rgba(234,88,12,0.5), inset 0 -14px 32px rgba(234,88,12,0.28), inset 0 14px 32px rgba(255,255,255,0.95)',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22, margin: '0 auto 20px',
              background: '#FED7AA', fontSize: '2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 0px rgba(194,65,12,0.38), 0 16px 40px rgba(234,88,12,0.32), inset 0 -6px 14px rgba(234,88,12,0.25), inset 0 6px 14px rgba(255,255,255,0.95)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>🖼️</div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#431407', margin: '0 0 6px' }}>Converting to JPG</h3>
            <p style={{ color: '#92400E', fontSize: '0.85rem', margin: '0 0 6px', lineHeight: 1.5 }}>
              Rendering page {currentPage} of {getPageCountToConvert()}
            </p>
            <p style={{ color: '#B45309', fontSize: '0.78rem', margin: '0 0 20px' }}>Running locally — your files never leave this device</p>

            <div style={{
              width: '100%', height: 10, borderRadius: 999,
              background: 'rgba(194,65,12,0.15)', boxShadow: 'inset 0 2px 6px rgba(194,65,12,0.2)',
              overflow: 'hidden', marginBottom: 8,
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg, #FB923C, #EA580C)',
                width: `${progress}%`, transition: 'width 0.4s ease',
                boxShadow: '0 0 10px rgba(251,146,60,0.6)',
              }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#EA580C', fontWeight: 700, margin: '0 0 16px' }}>{progress}%</p>

            {completedThumbs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', maxHeight: 72, overflow: 'hidden' }}>
                {completedThumbs.slice(-6).map((thumb, i) => (
                  <div key={i} style={{ width: 42, height: 52, borderRadius: 7, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', flexShrink: 0 }}>
                    <img src={thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── LIGHTBOX ───────────────────────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              borderRadius: 24, overflow: 'hidden', maxWidth: '90vw', maxHeight: '85vh',
              boxShadow: '0 12px 0px rgba(194,65,12,0.5), 0 40px 100px rgba(234,88,12,0.6)',
              position: 'relative', cursor: 'default',
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
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                Page {lightboxImage.pageNum} — {lightboxImage.width}×{lightboxImage.height}px
              </span>
              <button
                onClick={() => handleDownloadSingle(lightboxImage)}
                style={{
                  padding: '6px 16px', borderRadius: 10, border: 'none',
                  background: '#EA580C', color: 'white',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: '0 3px 0px rgba(194,65,12,0.5)',
                }}
              >
                <Download size={14} /> Download
              </button>
            </div>
            <button
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'rgba(0,0,0,0.5)', color: 'white',
                fontSize: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}
