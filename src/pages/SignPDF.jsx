import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Loader2, Plus, ArrowLeft, AlertTriangle, Check, PenLine, Type, Upload, FileText, Pin, Trash2,
} from 'lucide-react';
import SignaturePad from '../components/features/SignaturePad';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import { saveBlobToDisk } from '../utils/saveBlobToDisk';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import formatFileSize from '../utils/formatFileSize';

import '@fontsource/dancing-script/700.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/satisfy/400.css';
import '@fontsource/pinyon-script/400.css';

const FONTS = {
  dancing: { name: 'Elegant', family: "'Dancing Script',cursive" },
  pacifico: { name: 'Casual',  family: "'Pacifico',cursive" },
  satisfy:  { name: 'Flowing', family: "'Satisfy',cursive" },
  pinyon:   { name: 'Formal',  family: "'Pinyon Script',cursive" },
};
const INK_COLORS = [
  { hex: '#0A0A0A', label: 'Black' },
  { hex: '#16A34A', label: 'Green' },
  { hex: '#DC2626', label: 'Red' },
  { hex: '#2563EB', label: 'Blue' },
];

const ACCENT = '#F59E0B';
const ACCENT_SOFT = 'rgba(245, 158, 11, 0.15)';
const LAYOUT_GAP = 16;
const WORKSPACE_ABOVE_ACTION = 28;

export default function SignPDF() {
  const [pdfFile, setPdfFile]       = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageCount, setPageCount]   = useState(0);
  const [pdfThumb, setPdfThumb]     = useState(null);
  const pdfDocRef = useRef(null);
  const fileInputRef = useRef(null);

  const [sigMode, setSigMode]       = useState('draw');
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const [drawnSig, setDrawnSig]     = useState(null);
  const [penColor, setPenColor]     = useState(INK_COLORS[0].hex);
  const [sigPadResetKey, setSigPadResetKey] = useState(0);
  const [typedName, setTypedName]   = useState('');
  const [selFont, setSelFont]       = useState('dancing');
  const [uploadPreview, setUploadPreview] = useState(null);
  const sigUploadRef = useRef(null);

  const [sigPage, setSigPage]       = useState(1);
  const [sigPos, setSigPos]         = useState({ x: 30, y: 60 });
  const [sigSize, setSigSize]       = useState(25);
  const [sigOpacity, setSigOpacity] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOff, setDragOff]       = useState({ x: 0, y: 0 });

  const [placed, setPlaced] = useState([]);

  const pageCanvasRef  = useRef(null);
  const previewContRef = useRef(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState(null);
  const [isSuccess, setIsSuccess]   = useState(false);
  const [signedBlob, setSignedBlob] = useState(null);

  const [activePlaced, setActivePlaced] = useState(null);
  const [placedDragOff, setPlacedDragOff] = useState({ x: 0, y: 0 });

  const darkCard = {
    borderRadius: 16,
    padding: '22px 22px',
    backgroundColor: '#14151a',
    backgroundImage: [
      `radial-gradient(120% 80% at 0% 0%, ${ACCENT_SOFT.replace('0.15', '0.12')} 0%, transparent 55%)`,
      'linear-gradient(165deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.12) 100%)',
    ].join(', '),
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2) inset, inset 0 1px 0 rgba(255,255,255,0.08)',
  };

  const ghostBtn = {
    padding: '10px 20px', borderRadius: 8,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
    color: '#E4E4E7', transition: 'all 0.2s ease',
  };

  const primaryPanelBtn = (disabled) => ({
    width: '100%', padding: '12px 14px', borderRadius: 12,
    fontWeight: 700, fontSize: '0.88rem', cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(160deg, rgba(245,158,11,0.35), rgba(180,83,9,0.5))',
    color: disabled ? '#71717A' : '#FFFBEB',
    border: disabled ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(245,158,11,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });

  const handleFileLoad = async (file) => {
    if (!file?.name.toLowerCase().endsWith('.pdf')) { setError('Please select a valid PDF file.'); return; }
    setPdfFile(file); setError(null); setIsSuccess(false); setSigDataUrl(null); setPlaced([]);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const ab = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: ab, verbosity: 0 }).promise;
      pdfDocRef.current = doc;
      setPageCount(doc.numPages); setSigPage(1);
      const pg = await doc.getPage(1);
      const vp = pg.getViewport({ scale: 0.4 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      setPdfThumb(c.toDataURL('image/jpeg', 0.7));
      await renderPage(1, doc);
    } catch (e) { setError(`Could not read PDF: ${e.message}`); }
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileLoad(f); };

  const renderPage = async (n, doc) => {
    const d = doc || pdfDocRef.current;
    if (!d || !pageCanvasRef.current || !previewContRef.current) return;
    const page = await d.getPage(n);
    const cw = previewContRef.current.clientWidth || 380;
    const vp1 = page.getViewport({ scale: 1 });
    const sc = cw / vp1.width;
    const vp = page.getViewport({ scale: sc });
    const cv = pageCanvasRef.current;
    cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  };

  useEffect(() => { if (pdfDocRef.current) renderPage(sigPage); }, [sigPage]);

  const onSigMouseDown = (e) => {
    e.preventDefault(); setIsDragging(true);
    const r = e.currentTarget.getBoundingClientRect();
    setDragOff({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onPreviewMouseMoveAll = useCallback((e) => {
    if (isDragging && previewContRef.current) {
      const r = previewContRef.current.getBoundingClientRect();
      setSigPos({
        x: Math.max(0, Math.min(100 - sigSize, ((e.clientX - r.left - dragOff.x) / r.width) * 100)),
        y: Math.max(0, Math.min(92, ((e.clientY - r.top - dragOff.y) / r.height) * 100)),
      });
    }
    if (activePlaced && previewContRef.current) {
      const r = previewContRef.current.getBoundingClientRect();
      const pl = placed.find(p => p.id === activePlaced);
      if (!pl) return;
      const nx = Math.max(0, Math.min(100 - pl.size, ((e.clientX - r.left - placedDragOff.x) / r.width) * 100));
      const ny = Math.max(0, Math.min(92, ((e.clientY - r.top - placedDragOff.y) / r.height) * 100));
      setPlaced(prev => prev.map(p => p.id === activePlaced ? { ...p, pos: { x: nx, y: ny } } : p));
    }
  }, [isDragging, dragOff, sigSize, activePlaced, placedDragOff, placed]);

  const onPreviewUpAll = () => { setIsDragging(false); setActivePlaced(null); };

  const onPlacedMouseDown = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    setActivePlaced(id);
    const r = e.currentTarget.getBoundingClientRect();
    setPlacedDragOff({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const genTyped = () => {
    if (!typedName.trim()) return;
    const cv = document.createElement('canvas'); cv.width = 500; cv.height = 160;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 500, 160);
    ctx.font = `80px ${FONTS[selFont].family}`; ctx.fillStyle = penColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 250, 90);
    setSigDataUrl(cv.toDataURL('image/png'));
  };

  const useUploaded = async () => {
    if (!uploadPreview) return;
    const img = new Image(); img.src = uploadPreview;
    await new Promise(r => img.onload = r);
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    setSigDataUrl(cv.toDataURL('image/png'));
  };

  const useDrawn = () => {
    if (drawnSig) setSigDataUrl(drawnSig);
    else setError('Please draw your signature first.');
  };

  const handleAddToDocument = () => {
    if (!sigDataUrl) return;
    setPlaced(prev => [...prev, {
      id: crypto.randomUUID(),
      sigDataUrl,
      page: sigPage,
      pos: { ...sigPos },
      size: sigSize,
      opacity: sigOpacity,
    }]);
    setSigDataUrl(null);
    setDrawnSig(null);
    setSigPadResetKey((k) => k + 1);
    setSigPos({ x: 30, y: 60 });
    setSigSize(25);
    setSigOpacity(1.0);
  };

  // Input: none. Output: void (state only).
  // Clears the drawing buffer and remounts SignaturePad so the user can draw again.
  const clearDrawCanvas = () => {
    setDrawnSig(null);
    setSigPadResetKey((k) => k + 1);
  };

  // Input: none. Output: void (state only).
  // Drops the floating preview on the PDF and resets the pad so a new signature can be created.
  const clearStagedSignature = () => {
    setSigDataUrl(null);
    setDrawnSig(null);
    setSigPadResetKey((k) => k + 1);
  };

  const getPdfCoords = async (item) => {
    const page = await pdfDocRef.current.getPage(item.page);
    const { width: pW, height: pH } = page.getViewport({ scale: 1 });
    const img = new Image(); img.src = item.sigDataUrl;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.3;
    const wPt = (item.size / 100) * pW;
    const hPt = wPt * aspect;
    const xPt = (item.pos.x / 100) * pW;
    const yTop = (item.pos.y / 100) * pH;
    return { page: item.page, x: xPt, y: pH - yTop - hPt, width: wPt, height: hPt, opacity: item.opacity };
  };

  const handleApplyAll = async () => {
    if (!pdfFile || placed.length === 0) return;
    setProcessing(true); setProgress(0); setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      const ab = isLargeFile(pdfFile) ? await processLargeFile(pdfFile) : await pdfFile.arrayBuffer();
      setProgress(20);
      const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      setProgress(35);

      for (let i = 0; i < placed.length; i++) {
        const item = placed[i];
        const base64 = item.sigDataUrl.replace(/^data:image\/png;base64,/, '');
        const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const coords = await getPdfCoords(item);
        pages[coords.page - 1].drawImage(sigImage, {
          x: coords.x, y: coords.y, width: coords.width, height: coords.height, opacity: coords.opacity,
        });
        setProgress(35 + Math.round(((i + 1) / placed.length) * 55));
        await new Promise((r) => setTimeout(r, 0));
      }

      const bytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setSignedBlob(blob);
      setProgress(100); setIsSuccess(true);
    } catch (e) { setError(`Signing failed: ${e.message}`); }
    finally { setProcessing(false); }
  };

  const handleDownload = async () => {
    if (!signedBlob) return false;
    const base = (pdfFile?.name || 'document').replace(/\.pdf$/i, '');
    return saveBlobToDisk(signedBlob, `${base}-signed.pdf`);
  };

  const handleReset = () => {
    setPdfFile(null); setPdfThumb(null); setPageCount(0); setSigDataUrl(null);
    setDrawnSig(null); setUploadPreview(null); setIsSuccess(false); setError(null);
    setSignedBlob(null); pdfDocRef.current = null; setProgress(0);
    setPlaced([]); setSigPos({ x: 30, y: 60 }); setSigSize(25); setSigOpacity(1.0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const ModeCard = ({ id, Icon, label }) => {
    const sel = sigMode === id;
    return (
      <button
        type="button"
        onClick={() => setSigMode(id)}
        style={{
          borderRadius: 14, padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
          background: sel ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${sel ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.08)'}`,
          transform: sel ? 'translateY(-2px)' : 'none',
          transition: 'all 0.2s ease', position: 'relative', width: '100%',
        }}
      >
        {sel && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={10} strokeWidth={3} color="#1c1917" />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <Icon size={22} color={sel ? '#FCD34D' : '#94A3B8'} strokeWidth={1.7} />
        </div>
        <p style={{ fontWeight: 700, color: sel ? '#FDE68A' : '#A1A1AA', fontSize: '0.78rem', margin: 0 }}>{label}</p>
      </button>
    );
  };

  const placedOnPage = placed.filter(p => p.page === sigPage);

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", padding: '32px 20px 120px', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

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
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Sign PDF
          </h1>
        </div>

        {error && (
          <div style={{
            borderRadius: 14, padding: '20px 24px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: LAYOUT_GAP,
          }}>
            <AlertTriangle size={22} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ flex: 1, fontWeight: 600, color: '#FCA5A5', fontSize: '0.88rem', margin: 0 }}>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ ...ghostBtn, padding: '6px 14px', fontSize: '0.78rem' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
            >
              Dismiss
            </button>
          </div>
        )}

        {isSuccess && (
          <HeroDitheringCard accentColor={ACCENT} minHeight={280} style={{ marginBottom: LAYOUT_GAP }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 24, letterSpacing: '-0.02em', textAlign: 'center' }}>
              PDF signed
            </h3>
            <DownloadButton onDownload={handleDownload} label="Download signed PDF" disabled={!signedBlob} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" onClick={handleReset} style={ghostBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Sign another PDF
              </button>
              <Link to="/" style={{ ...ghostBtn, textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Back to Tools
              </Link>
            </div>
          </HeroDitheringCard>
        )}

        {!pdfFile && !isSuccess && (
          <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: LAYOUT_GAP }}>
            <UploadCard
              status="idle"
              title={isDragOver ? 'Drop your PDF here' : 'Drop a PDF to sign'}
              description="or click to browse · Single PDF file"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
            />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) handleFileLoad(e.target.files[0]); e.target.value = ''; }} />

        {pdfFile && !isSuccess && (
          <>
            <div className="tool-workspace-grid" style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: LAYOUT_GAP, alignItems: 'start' }}>

              <div>
                <div style={{ ...darkCard, display: 'flex', alignItems: 'center', gap: LAYOUT_GAP, marginBottom: LAYOUT_GAP }}>
                  <div style={{ width: 42, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {pdfThumb ? <img src={pdfThumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={22} color="#71717A" /></div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '0.88rem', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfFile.name}</p>
                    <p style={{ color: '#94A3B8', fontSize: '0.78rem', margin: 0 }}>{formatFileSize(pdfFile.size)} · {pageCount} pages</p>
                  </div>
                  <button type="button" onClick={handleReset} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171', flexShrink: 0 }}>
                    <X size={15} />
                  </button>
                </div>

                {pageCount > 1 && (
                  <div style={{ ...darkCard, padding: '16px 20px', marginBottom: LAYOUT_GAP, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>Page</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      {Array.from({ length: Math.min(pageCount, 10) }, (_, i) => i + 1).map(n => {
                        const hasSig = placed.some(p => p.page === n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSigPage(n)}
                            style={{
                              width: 32, height: 32, borderRadius: 9, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', position: 'relative',
                              background: sigPage === n ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)',
                              color: sigPage === n ? '#FDE68A' : '#A1A1AA',
                              border: `1px solid ${sigPage === n ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            }}
                          >
                            {n}
                            {hasSig && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: ACCENT }} />}
                          </button>
                        );
                      })}
                      {pageCount > 10 && <span style={{ fontSize: '0.72rem', color: '#71717A', fontWeight: 600 }}>+{pageCount - 10} more</span>}
                    </div>
                  </div>
                )}

                <div style={{ ...darkCard, marginBottom: LAYOUT_GAP }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
                    Page {sigPage}
                    {(sigDataUrl || placedOnPage.length > 0) && (
                      <span style={{ color: '#71717A', fontWeight: 500, textTransform: 'none', fontSize: '0.72rem' }}> · drag to position</span>
                    )}
                  </p>
                  <div
                    ref={previewContRef}
                    style={{
                      position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: (sigDataUrl || placedOnPage.length > 0) ? 'crosshair' : 'default', userSelect: 'none',
                    }}
                    onMouseMove={onPreviewMouseMoveAll}
                    onMouseUp={onPreviewUpAll}
                    onMouseLeave={onPreviewUpAll}
                  >
                    <canvas ref={pageCanvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />

                    {placedOnPage.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={e => onPlacedMouseDown(e, p.id)}
                        style={{
                          position: 'absolute', left: `${p.pos.x}%`, top: `${p.pos.y}%`, width: `${p.size}%`, cursor: 'grab', userSelect: 'none',
                          filter: `opacity(${p.opacity})`,
                          outline: activePlaced === p.id ? `2px solid ${ACCENT}` : '2px dashed rgba(245,158,11,0.35)', borderRadius: 4,
                        }}
                      >
                        <img src={p.sigDataUrl} draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} alt="" />
                        <button
                          type="button"
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => setPlaced(prev => prev.filter(x => x.id !== p.id))}
                          style={{
                            position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', border: 'none',
                            background: '#DC2626', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {sigDataUrl && (
                      <div
                        onMouseDown={onSigMouseDown}
                        style={{
                          position: 'absolute', left: `${sigPos.x}%`, top: `${sigPos.y}%`, width: `${sigSize}%`, cursor: 'grab', userSelect: 'none',
                          filter: `opacity(${sigOpacity})`,
                          outline: isDragging ? `2px solid ${ACCENT}` : '2px dashed rgba(245,158,11,0.5)', borderRadius: 4,
                        }}
                      >
                        <img src={sigDataUrl} draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} alt="Signature" />
                        {!isDragging && (
                          <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            Drag to position
                          </div>
                        )}
                      </div>
                    )}

                    {!sigDataUrl && placedOnPage.length === 0 && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                        <div style={{ padding: '12px 18px', borderRadius: 12, background: 'rgba(20,21,26,0.92)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PenLine size={18} color="#FCD34D" />
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#E4E4E7', margin: 0 }}>Create a signature on the right</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {sigDataUrl && (
                  <div style={{ ...darkCard, marginBottom: LAYOUT_GAP }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[
                        { label: 'Size', min: 5, max: 60, val: sigSize, set: setSigSize, suffix: '%', lo: 'Small', hi: 'Large' },
                        { label: 'Opacity', min: 20, max: 100, val: Math.round(sigOpacity * 100), set: v => setSigOpacity(v / 100), suffix: '%', lo: 'Light', hi: 'Solid' },
                      ].map(sl => (
                        <div key={sl.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>{sl.label}</label>
                            <span style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600 }}>{sl.val}{sl.suffix}</span>
                          </div>
                          <input type="range" min={sl.min} max={sl.max} value={sl.val} onChange={e => sl.set(Number(e.target.value))} style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#71717A', marginTop: 2 }}><span>{sl.lo}</span><span>{sl.hi}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {placed.length > 0 && (
                  <div style={darkCard}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Pin size={14} /> Placed signatures ({placed.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {placed.map((p, idx) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.68rem', color: '#71717A', flexShrink: 0, minWidth: 22 }}>{idx + 1}</span>
                          <img src={p.sigDataUrl} style={{ height: 28, maxWidth: 80, objectFit: 'contain', flexShrink: 0 }} alt="" />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#E4E4E7', margin: 0 }}>Page {p.page}</p>
                            <p style={{ fontSize: '0.62rem', color: '#71717A', margin: 0 }}>Size {p.size}% · {Math.round(p.opacity * 100)}% opacity</p>
                          </div>
                          <button type="button" onClick={() => setSigPage(p.page)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.1)', color: '#FCD34D', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>View</button>
                          <button type="button" onClick={() => setPlaced(prev => prev.filter(x => x.id !== p.id))} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#F87171', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Create signature</p>
                <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: LAYOUT_GAP }}>
                  <ModeCard id="draw" Icon={PenLine} label="Draw" />
                  <ModeCard id="type" Icon={Type} label="Type" />
                  <ModeCard id="upload" Icon={Upload} label="Upload" />
                </div>

                {sigMode === 'draw' && (
                  <div style={{ ...darkCard, marginBottom: LAYOUT_GAP }}>
                    <p style={{ fontWeight: 600, color: '#E4E4E7', fontSize: '0.82rem', margin: '0 0 12px' }}>Draw your signature</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94A3B8' }}>Ink</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                        {INK_COLORS.map(({ hex, label }) => (
                          <button
                            key={hex}
                            type="button"
                            aria-label={label}
                            title={label}
                            onClick={() => setPenColor(hex)}
                            style={{
                              width: 26, height: 26, borderRadius: '50%', background: hex, cursor: 'pointer',
                              border: hex === '#0A0A0A' ? '1px solid rgba(255,255,255,0.25)' : 'none',
                              boxShadow: penColor === hex ? `0 0 0 2px #fff, 0 0 0 4px ${hex}` : '0 2px 6px rgba(0,0,0,0.35)',
                              transform: penColor === hex ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.15s ease',
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={clearDrawCanvas}
                        title="Clear canvas"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                          border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#FCA5A5',
                          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} /> Clear canvas
                      </button>
                    </div>
                    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <SignaturePad
                        key={sigPadResetKey}
                        penColor={penColor}
                        showClearButton={false}
                        onSignatureComplete={setDrawnSig}
                      />
                    </div>
                    <button type="button" onClick={useDrawn} style={{ ...primaryPanelBtn(false), marginTop: 14 }}>
                      <Check size={18} /> Use this signature
                    </button>
                  </div>
                )}

                {sigMode === 'type' && (
                  <div style={{ ...darkCard, marginBottom: LAYOUT_GAP }}>
                    <p style={{ fontWeight: 600, color: '#E4E4E7', fontSize: '0.82rem', margin: '0 0 12px' }}>Type your name</p>
                    <input
                      type="text"
                      value={typedName}
                      onChange={e => setTypedName(e.target.value)}
                      placeholder="Your full name"
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
                        fontSize: '1rem', color: '#FAFAFA', background: 'rgba(255,255,255,0.05)', outline: 'none', marginBottom: 12, fontWeight: 600, boxSizing: 'border-box',
                      }}
                    />
                    <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' }}>Style</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {Object.entries(FONTS).map(([id, f]) => {
                        const sel = selFont === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelFont(id)}
                            style={{
                              borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', width: '100%', border: `1px solid ${sel ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.08)'}`,
                              background: sel ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', transition: 'all 0.18s ease',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#A1A1AA' }}>{f.name}</span>
                            <span style={{ fontFamily: f.family, fontSize: '1.05rem', color: '#F4F4F5', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typedName || 'Preview'}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94A3B8' }}>Color</span>
                      {INK_COLORS.map(({ hex, label }) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={label}
                          title={label}
                          onClick={() => setPenColor(hex)}
                          style={{
                            width: 26, height: 26, borderRadius: '50%', background: hex, cursor: 'pointer',
                            border: hex === '#0A0A0A' ? '1px solid rgba(255,255,255,0.25)' : 'none',
                            boxShadow: penColor === hex ? `0 0 0 2px #fff, 0 0 0 4px ${hex}` : '0 2px 6px rgba(0,0,0,0.35)',
                            transform: penColor === hex ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.15s ease',
                          }}
                        />
                      ))}
                    </div>
                    <button type="button" onClick={genTyped} disabled={!typedName.trim()} style={primaryPanelBtn(!typedName.trim())}>
                      <Check size={18} /> Use this signature
                    </button>
                  </div>
                )}

                {sigMode === 'upload' && (
                  <div style={{ ...darkCard, marginBottom: LAYOUT_GAP }}>
                    <p style={{ fontWeight: 600, color: '#E4E4E7', fontSize: '0.82rem', margin: '0 0 4px' }}>Upload signature image</p>
                    <p style={{ fontSize: '0.75rem', color: '#71717A', margin: '0 0 12px' }}>PNG with transparency works best</p>
                    <button
                      type="button"
                      onClick={() => sigUploadRef.current?.click()}
                      style={{
                        width: '100%', borderRadius: 12, padding: 20, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      {uploadPreview ? (
                        <>
                          <img src={uploadPreview} style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }} alt="" />
                          <p style={{ fontSize: '0.72rem', color: '#A1A1AA', margin: 0, fontWeight: 600 }}>Click to change</p>
                        </>
                      ) : (
                        <>
                          <Upload size={32} color="#71717A" style={{ margin: '0 auto 8px', display: 'block' }} />
                          <p style={{ color: '#A1A1AA', fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>PNG, JPG, or WebP</p>
                        </>
                      )}
                    </button>
                    <input ref={sigUploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files[0]; if (f) setUploadPreview(URL.createObjectURL(f)); }} />
                    {uploadPreview && (
                      <button type="button" onClick={useUploaded} style={{ ...primaryPanelBtn(false), marginTop: 14 }}>
                        <Check size={18} /> Use this signature
                      </button>
                    )}
                  </div>
                )}

                {sigDataUrl && (
                  <div style={{ ...darkCard, backgroundImage: 'linear-gradient(165deg, rgba(245,158,11,0.08) 0%, rgba(255,255,255,0.02) 100%)', marginBottom: LAYOUT_GAP }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <img src={sigDataUrl} style={{ height: 36, maxWidth: 100, objectFit: 'contain', flexShrink: 0 }} alt="" />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: '#FDE68A', fontSize: '0.78rem', margin: '0 0 2px' }}>Ready to place</p>
                        <p style={{ fontSize: '0.68rem', color: '#A1A1AA', margin: 0 }}>Position on preview, then add</p>
                      </div>
                      <button type="button" title="Remove staged signature" onClick={clearStagedSignature} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171', flexShrink: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                    <p style={{ fontSize: '0.68rem', fontWeight: 600, color: '#71717A', margin: '0 0 8px' }}>Target page</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {Array.from({ length: Math.min(pageCount, 10) }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setSigPage(n); renderPage(n); }}
                          style={{
                            width: 30, height: 30, borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                            background: sigPage === n ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)',
                            color: sigPage === n ? '#FDE68A' : '#A1A1AA',
                            border: `1px solid ${sigPage === n ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={handleAddToDocument} style={primaryPanelBtn(false)}>
                      <Plus size={18} /> Add to document
                    </button>
                  </div>
                )}
              </div>
            </div>

            {placed.length > 0 && (
              <div style={{ marginTop: WORKSPACE_ABOVE_ACTION, textAlign: 'center' }}>
                {sigDataUrl && (
                  <p style={{ fontSize: '0.78rem', color: '#A1A1AA', margin: '0 0 12px' }}>
                    Finish placing the current signature or clear it before signing.
                  </p>
                )}
                <MotionButton
                  type="button"
                  onClick={handleApplyAll}
                  disabled={processing || !pdfFile || placed.length === 0}
                  loading={processing}
                  label={processing ? `Signing… ${progress}%` : 'Sign PDF'}
                  style={{ width: 'max-content', maxWidth: '100%', minWidth: 200 }}
                />
              </div>
            )}
          </>
        )}
      </div>

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
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'signBounce 1s infinite',
            }}>
              <Loader2 size={28} strokeWidth={1.8} color="#FBBF24" style={{ animation: 'signSpin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: 8 }}>Signing PDF</h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.85rem', marginBottom: 24 }}>Working in your browser…</p>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #B45309, #FBBF24)', borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#FBBF24', fontWeight: 600, marginTop: 10 }}>{progress}%</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes signBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes signSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
