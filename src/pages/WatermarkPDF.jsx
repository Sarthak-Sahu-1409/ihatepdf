// Input: PDF file + watermark settings; Output: watermarked PDF blob for download
// Watermark PDF page — text & image watermarks, centered layout, fixed diagonal text angle
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Loader2, ArrowLeft, AlertTriangle, Check, Type, Image as ImageIcon, FileText, Eye, Droplets,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import { saveBlobToDisk } from '../utils/saveBlobToDisk';
import { useWorker } from '../hooks/useWorker';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import formatFileSize from '../utils/formatFileSize';

/** Fixed diagonal angle for text watermarks (matches typical “CONFIDENTIAL” stamp). */
const WM_TEXT_ROTATION = -45;
/** Watermark is always centered on the page (rotation/position controls removed). */
const WM_LAYOUT_POSITION = 'center';

const ACCENT = '#22D3EE';
const ACCENT_SOFT = 'rgba(34, 211, 238, 0.14)';
/** ~20% tighter layout than the default tool shell */
const LAYOUT_GAP = 13;
const WORKSPACE_ABOVE_ACTION = 22;
const PAGE_MAX_WIDTH = 768;

/* Returns {x,y} for text watermark on canvas (text anchor = center) */
function getPreviewPosition(cW, cH, pos) {
  const m = 30;
  switch (pos) {
    case 'top':          return { x: cW / 2,    y: m };
    case 'bottom':       return { x: cW / 2,    y: cH - m };
    case 'top-left':     return { x: cW * 0.15, y: m };
    case 'top-right':    return { x: cW * 0.85, y: m };
    case 'bottom-left':  return { x: cW * 0.15, y: cH - m };
    case 'bottom-right': return { x: cW * 0.85, y: cH - m };
    case 'left':         return { x: cW * 0.15, y: cH / 2 };
    case 'right':        return { x: cW * 0.85, y: cH / 2 };
    default:             return { x: cW / 2,    y: cH / 2 };
  }
}

/* Returns {x,y} top-left corner for image watermark on canvas */
function getPreviewPositionXY(cW, cH, drawW, drawH, pos) {
  const m = 20;
  switch (pos) {
    case 'top':          return { x: (cW - drawW) / 2, y: m };
    case 'bottom':       return { x: (cW - drawW) / 2, y: cH - drawH - m };
    case 'top-left':     return { x: m,                y: m };
    case 'top-right':    return { x: cW - drawW - m,   y: m };
    case 'bottom-left':  return { x: m,                y: cH - drawH - m };
    case 'bottom-right': return { x: cW - drawW - m,   y: cH - drawH - m };
    case 'left':         return { x: m,                y: (cH - drawH) / 2 };
    case 'right':        return { x: cW - drawW - m,   y: (cH - drawH) / 2 };
    default:             return { x: (cW - drawW) / 2, y: (cH - drawH) / 2 };
  }
}

/* Returns the desired visual center (cx, cy) for a given position in PDF space.
   PDF origin is bottom-left, so "top" maps to a large y, "bottom" to a small y. */
function getPdfCenter(pageW, pageH, pos) {
  const m = 50;
  switch (pos) {
    case 'top':          return { cx: pageW / 2,      cy: pageH - m };
    case 'bottom':       return { cx: pageW / 2,      cy: m };
    case 'top-left':     return { cx: pageW * 0.15,   cy: pageH - m };
    case 'top-right':    return { cx: pageW * 0.85,   cy: pageH - m };
    case 'bottom-left':  return { cx: pageW * 0.15,   cy: m };
    case 'bottom-right': return { cx: pageW * 0.85,   cy: m };
    case 'left':         return { cx: m,              cy: pageH / 2 };
    case 'right':        return { cx: pageW - m,      cy: pageH / 2 };
    default:             return { cx: pageW / 2,      cy: pageH / 2 };
  }
}

/* Given the desired visual center (cx,cy), the bounding box (drawW x drawH),
   and a rotation in degrees, returns the bottom-left draw origin (x,y) that
   pdf-lib needs so the element appears visually centered at (cx,cy) after rotation. */
function rotationAdjustedOrigin(cx, cy, drawW, drawH, rotDeg) {
  const r = (rotDeg * Math.PI) / 180;
  return {
    x: cx - (drawW / 2) * Math.cos(r) + (drawH / 2) * Math.sin(r),
    y: cy - (drawH / 2) * Math.cos(r) - (drawW / 2) * Math.sin(r),
  };
}

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
export default function WatermarkPDF() {
  /* ── File state ─────────────────────────────────────────── */
  const [pdfFile, setPdfFile]           = useState(null);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [pdfThumbnail, setPdfThumbnail] = useState(null);
  const [pageCount, setPageCount]       = useState(0);
  const [pageRendered, setPageRendered] = useState(false);

  /* ── Watermark type ─────────────────────────────────────── */
  const [wmType, setWmType]             = useState('text');

  /* ── Text watermark settings ────────────────────────────── */
  const [wmText, setWmText]             = useState('CONFIDENTIAL');
  const [fontSize, setFontSize]         = useState(60);
  const [wmColor, setWmColor]           = useState('#1a1a1a');
  const [opacity, setOpacity]           = useState(0.25);

  /* ── Image watermark settings ───────────────────────────── */
  const [wmImageFile, setWmImageFile]         = useState(null);
  const [wmImagePreview, setWmImagePreview]   = useState(null);
  const [imgScalePercent, setImgScalePercent] = useState(30);

  /* ── Page scope ─────────────────────────────────────────── */
  const [pageScope, setPageScope]   = useState('all');
  const [customFrom, setCustomFrom] = useState(1);
  const [customTo, setCustomTo]     = useState(1);

  /* ── Preview ────────────────────────────────────────────── */
  const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);
  const previewDebounceRef  = useRef(null);
  const previewScaleRef     = useRef(1.2);
  const pdfJsDocRef         = useRef(null);
  const renderedPageDataRef = useRef(null);

  /* ── Processing ─────────────────────────────────────── */
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError]             = useState(null);

  // Web Worker for off-main-thread watermarking
  const { run: runWorker, progress, running: processing } = useWorker('pdf');

  /* ── Success ────────────────────────────────────────────── */
  const [isSuccess, setIsSuccess]   = useState(false);
  const [outputBlob, setOutputBlob] = useState(null);

  /* ── Refs ───────────────────────────────────────────────── */
  const fileInputRef     = useRef(null);
  const previewCanvasRef = useRef(null);
  const imgWmRef         = useRef(null);
  const leftWorkspaceColRef = useRef(null);

  /** Pixel height of the settings column; right column matches this so both rows align. */
  const [workspaceColHeight, setWorkspaceColHeight] = useState(null);

  /* ── Page index helper ──────────────────────────────────── */
  // Input: total page count; Output: array of 0-based page indices per scope setting
  const getTargetPageIndices = (total) => {
    switch (pageScope) {
      case 'all':    return Array.from({ length: total }, (_, i) => i);
      case 'first':  return [0];
      case 'last':   return [total - 1];
      case 'odd':    return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 === 0);
      case 'even':   return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 !== 0);
      case 'custom': return Array.from(
        { length: customTo - customFrom + 1 },
        (_, i) => customFrom - 1 + i
      ).filter(i => i >= 0 && i < total);
      default:       return Array.from({ length: total }, (_, i) => i);
    }
  };

  const getTargetPageCount = () => getTargetPageIndices(pageCount).length;

  const isReadyToApply = () => {
    if (!pdfFile) return false;
    if (wmType === 'text') return wmText.trim().length > 0;
    if (wmType === 'image') return !!wmImageFile;
    return false;
  };

  /* ── Preset stamps ──────────────────────────────────────── */
  // Input: { label, color }; Output: updates text watermark fields (fixed center / −45°).
  const applyPreset = ({ label, color }) => {
    setWmText(label);
    setWmColor(color);
    setOpacity(0.25);
    setFontSize(60);
  };

  /* ── Canvas watermark overlay ───────────────────────────── */
  // Input: current state refs + canvas; Output: redraws watermark on stored imageData
  const drawWatermarkOnPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !renderedPageDataRef.current) return;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(renderedPageDataRef.current, 0, 0);

    if (wmType === 'text' && wmText.trim()) {
      ctx.save();
      ctx.globalAlpha = opacity;
      const scaledSize = fontSize * previewScaleRef.current;
      ctx.font = `bold ${scaledSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = wmColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const { x, y } = getPreviewPosition(canvas.width, canvas.height, WM_LAYOUT_POSITION);
      ctx.translate(x, y);
      ctx.rotate((WM_TEXT_ROTATION * Math.PI) / 180);
      ctx.fillText(wmText, 0, 0);
      ctx.restore();
    } else if (wmType === 'image' && wmImagePreview) {
      const img = new Image();
      img.onload = () => {
        // Restore base before drawing image (async load)
        if (!renderedPageDataRef.current) return;
        ctx.putImageData(renderedPageDataRef.current, 0, 0);
        ctx.save();
        ctx.globalAlpha = opacity;
        const drawW = (canvas.width * imgScalePercent) / 100;
        const drawH = (img.height / img.width) * drawW;
        const { x, y } = getPreviewPositionXY(canvas.width, canvas.height, drawW, drawH, WM_LAYOUT_POSITION);
        ctx.drawImage(img, x, y, drawW, drawH);
        ctx.restore();
      };
      img.src = wmImagePreview;
    }
  };

  /* ── Render PDF page 1 to canvas, cache base imageData ─── */
  // Input: pdfjs doc; Output: stores base imageData, triggers initial watermark draw
  const renderBasePageToPreview = async (doc) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !doc) return;
    const page     = await doc.getPage(1);
    const viewport = page.getViewport({ scale: previewScaleRef.current });
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    renderedPageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setPageRendered(true);
  };

  /* ── Debounced preview re-draw on settings change ───────── */
  useEffect(() => {
    if (!pageRendered) return;
    clearTimeout(previewDebounceRef.current);
    setIsUpdatingPreview(true);
    previewDebounceRef.current = setTimeout(() => {
      drawWatermarkOnPreview();
      setIsUpdatingPreview(false);
    }, 280);
    return () => clearTimeout(previewDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wmText, fontSize, wmColor, opacity, wmType,
      wmImagePreview, imgScalePercent, pageRendered]);

  /* After pageRendered flips true, draw the initial watermark */
  useEffect(() => {
    if (pageRendered) drawWatermarkOnPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRendered]);

  // Input: none. Output: keeps preview column height equal to the settings column.
  useLayoutEffect(() => {
    const el = leftWorkspaceColRef.current;
    if (!el || !pdfFile) {
      setWorkspaceColHeight(null);
      return undefined;
    }
    const measure = () => setWorkspaceColHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfFile, wmType, pageScope, pageCount, wmImagePreview]);

  /* ── File load ──────────────────────────────────────────── */
  // Input: File object; Output: loads PDF with pdfjs, sets pageCount + thumbnail
  const handleFileLoad = async (file) => {
    if (!file?.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }
    setPdfFile(file);
    setError(null);
    setIsSuccess(false);
    setOutputBlob(null);
    setPageRendered(false);
    renderedPageDataRef.current = null;

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const ab  = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: ab, verbosity: 0 }).promise;
      pdfJsDocRef.current = doc;
      setPageCount(doc.numPages);
      setCustomTo(doc.numPages);

      /* Thumbnail */
      const pg     = await doc.getPage(1);
      const vpThumb = pg.getViewport({ scale: 0.4 });
      const cThumb  = document.createElement('canvas');
      cThumb.width  = vpThumb.width;
      cThumb.height = vpThumb.height;
      await pg.render({ canvasContext: cThumb.getContext('2d'), viewport: vpThumb }).promise;
      setPdfThumbnail(cThumb.toDataURL('image/jpeg', 0.7));

      /* Render page 1 to preview canvas */
      await renderBasePageToPreview(doc);
    } catch (err) {
      setError(`Could not read PDF: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    setPdfThumbnail(null);
    setPageCount(0);
    pdfJsDocRef.current         = null;
    renderedPageDataRef.current = null;
    setPageRendered(false);
    setIsSuccess(false);
    setOutputBlob(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Image watermark upload ─────────────────────────────── */
  const handleWmImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setWmImageFile(file);
    const url = URL.createObjectURL(file);
    setWmImagePreview(url);
  };

  /* ── Apply watermark (runs in Web Worker) ──────────── */
  const handleApplyWatermark = async () => {
    if (!pdfFile || !isReadyToApply()) return;
    setCurrentPage(0);
    setError(null);

    try {
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      const arrayBuffer = isLargeFile(pdfFile)
        ? await processLargeFile(pdfFile)
        : await pdfFile.arrayBuffer();

      const bufferCopy = arrayBuffer.slice(0);
      const targetPageIndices = getTargetPageIndices(pageCount);

      // Build payload for the worker
      const payload = {
        buffer: bufferCopy,
        wmType,
        wmText,
        fontSize,
        wmColor,
        opacity,
        imgScalePercent,
        textRotation: WM_TEXT_ROTATION,
        layoutPosition: WM_LAYOUT_POSITION,
        targetPageIndices,
      };

      const transferables = [bufferCopy];

      // If image watermark, read image bytes and send along
      if (wmType === 'image' && wmImageFile) {
        const imgBuf = await wmImageFile.arrayBuffer();
        payload.imageBytes = new Uint8Array(imgBuf);
        payload.imageMimeType = wmImageFile.type || '';
        transferables.push(imgBuf);
      }

      const result = await runWorker('watermark', payload, transferables);

      const blob = new Blob([result.data], { type: 'application/pdf' });
      setOutputBlob(blob);
      setIsSuccess(true);
    } catch (err) {
      setError(`Watermark failed: ${err.message}`);
    }
  };

  /* ── Download ───────────────────────────────────────────── */
  const handleDownload = async () => {
    if (!outputBlob) return false;
    const base = (pdfFile?.name || 'document').replace(/\.pdf$/i, '');
    return saveBlobToDisk(outputBlob, `${base}-watermarked.pdf`);
  };

  /* ── Reset ──────────────────────────────────────────────── */
  const handleWatermarkAnother = () => {
    handleRemoveFile();
    setOutputBlob(null);
    setIsSuccess(false);
    setWmText('CONFIDENTIAL');
    setFontSize(60);
    setWmColor('#1a1a1a');
    setOpacity(0.25);
    setWmType('text');
    setPageScope('all');
    setCustomFrom(1);
    setCustomTo(1);
    if (wmImagePreview) URL.revokeObjectURL(wmImagePreview);
    setWmImageFile(null);
    setWmImagePreview(null);
  };

  const sectionLabel = {
    fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px',
  };

  const darkCard = {
    borderRadius: 14,
    padding: '18px 18px',
    backgroundColor: '#14151a',
    backgroundImage: [
      `radial-gradient(120% 80% at 0% 0%, ${ACCENT_SOFT.replace('0.14', '0.12')} 0%, transparent 55%)`,
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

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '26px 13px 96px' }}>
      <div style={{ maxWidth: PAGE_MAX_WIDTH, margin: '0 auto' }}>

        <div style={{ marginBottom: 22 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 16,
              background: 'rgba(255,255,255,0.06)', fontWeight: 600,
              color: '#E4E4E7', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s ease', marginBottom: 20,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
          >
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Watermark PDF
          </h1>
        </div>

        {error && (
          <div style={{
            borderRadius: 12, padding: '16px 20px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
          }}>
            <AlertTriangle size={18} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#F87171', fontSize: '0.9rem', margin: '0 0 2px' }}>Watermark failed</p>
              <p style={{ fontSize: '0.8rem', color: '#FCA5A5', margin: 0 }}>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', cursor: 'pointer', color: '#E4E4E7', fontWeight: 600, transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
            >
              Dismiss
            </button>
          </div>
        )}

        {isSuccess && outputBlob && (
          <HeroDitheringCard accentColor={ACCENT} minHeight={304} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
              Watermark applied
            </h3>
            <DownloadButton onDownload={handleDownload} label="Download watermarked PDF" disabled={!outputBlob} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <button
                type="button"
                onClick={handleWatermarkAnother}
                style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                <Droplets size={16} /> Watermark another PDF
              </button>
              <Link
                to="/"
                style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                <ArrowLeft size={16} /> Back to Tools
              </Link>
            </div>
          </HeroDitheringCard>
        )}

        {/* ─── SECTION 2: UPLOAD ZONE ─────────────────────── */}
        {!isSuccess && (
          <>
            {!pdfFile && (
              <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: 20 }}>
                <UploadCard
                  status="idle"
                  title={isDragOver ? 'Drop your PDF here' : 'Drop your PDF to watermark'}
                  description="or click to browse · single PDF"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  hidden
                  onChange={(e) => { 
                    const f = e.target.files[0]; 
                    if (f) handleFileLoad(f); 
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {/* ─── SECTION 3: FILE INFO CARD ─────────────── */}
            {pdfFile && (
              <div style={{ ...darkCard, padding: '13px 16px', marginBottom: LAYOUT_GAP, display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{
                  width: 34, height: 42, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {pdfThumbnail ? (
                    <img src={pdfThumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={18} color="#71717A" />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '0.8rem', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pdfFile.name}
                  </p>
                  <p style={{ color: '#94A3B8', fontSize: '0.72rem', margin: 0 }}>
                    {formatFileSize(pdfFile.size)} · {pageCount} page{pageCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)',
                    background: 'transparent', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F87171',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ─── SECTION 4: SETTINGS + LIVE PREVIEW ─────── */}
            {pdfFile && (
              <div className="tool-workspace-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: LAYOUT_GAP, marginBottom: 0, alignItems: 'start' }}>

                <div ref={leftWorkspaceColRef} style={{ display: 'flex', flexDirection: 'column', gap: LAYOUT_GAP, minWidth: 0 }}>

                  <div style={darkCard}>
                    <p style={sectionLabel}>Watermark type</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { id: 'text', Icon: Type, label: 'Text' },
                        { id: 'image', Icon: ImageIcon, label: 'Image' },
                      ].map(({ id, Icon, label }) => {
                        const isSel = wmType === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setWmType(id)}
                            style={{
                              borderRadius: 12, padding: '10px 6px', textAlign: 'center', cursor: 'pointer', width: '100%',
                              background: isSel ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isSel ? 'rgba(34,211,238,0.45)' : 'rgba(255,255,255,0.08)'}`,
                              transition: 'all 0.2s ease', position: 'relative',
                            }}
                          >
                            {isSel && (
                              <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={10} strokeWidth={3} color="#0c1222" />
                              </div>
                            )}
                            <Icon size={18} color={isSel ? '#67E8F9' : '#94A3B8'} strokeWidth={1.7} style={{ display: 'block', margin: '0 auto 4px' }} />
                            <p style={{ fontWeight: 700, color: isSel ? '#CFFAFE' : '#A1A1AA', fontSize: '0.72rem', margin: 0 }}>{label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── TEXT WATERMARK PANELS ── */}
                  {wmType === 'text' && (
                    <>
                      {/* PRESET STAMPS */}
                      <div style={darkCard}>
                        <p style={sectionLabel}>Quick stamps</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[
                            { label: 'DRAFT',        color: '#1a3a8f' },
                            { label: 'CONFIDENTIAL', color: '#7a0f0f' },
                            { label: 'APPROVED',     color: '#15803D' },
                            { label: 'SAMPLE',       color: '#92400E' },
                          ].map((stamp) => {
                            const active = wmText === stamp.label;
                            return (
                              <button
                                key={stamp.label}
                                type="button"
                                onClick={() => applyPreset(stamp)}
                                style={{
                                  padding: '6px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${active ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                  background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                                  fontSize: '0.7rem', fontWeight: 800, color: active ? '#E0F2FE' : stamp.color,
                                  letterSpacing: '0.04em', transition: 'all 0.15s ease',
                                }}
                              >
                                {stamp.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* TEXT CONTENT + FONT SIZE */}
                      <div style={darkCard}>
                        <p style={sectionLabel}>Watermark text</p>
                        <input
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          placeholder="DRAFT, CONFIDENTIAL…"
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)', fontWeight: 700, fontSize: '0.82rem',
                            color: '#FAFAFA', background: 'rgba(255,255,255,0.05)',
                            outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>Size</span>
                          <input type="range" min={20} max={120} value={fontSize}
                                 onChange={(e) => setFontSize(Number(e.target.value))}
                                 style={{ flex: 1, accentColor: ACCENT }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A1A1AA', minWidth: 36, textAlign: 'right' }}>
                            {fontSize}pt
                          </span>
                        </div>
                      </div>

                      {/* COLOR + OPACITY */}
                      <div style={darkCard}>
                        <p style={sectionLabel}>Color &amp; opacity</p>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          {['#1a1a1a', '#1a3a8f', '#7a0f0f', '#15803D', '#92400E', '#6D28D9'].map((col) => (
                            <button
                              key={col}
                              type="button"
                              aria-label={`Color ${col}`}
                              onClick={() => setWmColor(col)}
                              style={{
                                width: 26, height: 26, borderRadius: '50%', background: col, cursor: 'pointer', border: 'none',
                                boxShadow: wmColor === col ? `0 0 0 2px #fff, 0 0 0 4px ${col}` : '0 2px 6px rgba(0,0,0,0.4)',
                                transform: wmColor === col ? 'scale(1.08)' : 'scale(1)', transition: 'all 0.15s ease',
                              }}
                            />
                          ))}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="color" value={wmColor} onChange={(e) => setWmColor(e.target.value)}
                                   style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', padding: 0, cursor: 'pointer', background: 'transparent' }} />
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>Custom</span>
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>Opacity</span>
                          <input type="range" min={5} max={100} value={Math.round(opacity * 100)}
                                 onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                                 style={{ flex: 1, accentColor: ACCENT }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A1A1AA', minWidth: 38, textAlign: 'right' }}>
                            {Math.round(opacity * 100)}%
                          </span>
                        </div>
                      </div>

                    </>
                  )}

                  {/* ── IMAGE WATERMARK SETTINGS ── */}
                  {wmType === 'image' && (
                    <div style={darkCard}>
                      <p style={sectionLabel}>Watermark image</p>

                      <button
                        type="button"
                        onClick={() => imgWmRef.current?.click()}
                        style={{
                          width: '100%', borderRadius: 10, padding: 16, textAlign: 'center',
                          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)',
                          cursor: 'pointer', marginBottom: 12,
                        }}
                      >
                        {wmImagePreview ? (
                          <img src={wmImagePreview} alt="" style={{ maxHeight: 48, maxWidth: '100%', objectFit: 'contain' }} />
                        ) : (
                          <>
                            <ImageIcon size={26} color="#71717A" style={{ display: 'block', margin: '0 auto 6px' }} />
                            <p style={{ fontWeight: 600, color: '#E4E4E7', fontSize: '0.76rem', margin: '0 0 3px' }}>Upload image</p>
                            <p style={{ color: '#71717A', fontSize: '0.68rem', margin: 0 }}>PNG, JPG, WebP</p>
                          </>
                        )}
                      </button>
                      <input ref={imgWmRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleWmImageUpload} />

                      {wmImagePreview && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', flexShrink: 0, minWidth: 44 }}>Scale</span>
                            <input type="range" min={5} max={80} value={imgScalePercent}
                                   onChange={(e) => setImgScalePercent(Number(e.target.value))}
                                   style={{ flex: 1, accentColor: ACCENT }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A1A1AA', minWidth: 38, textAlign: 'right' }}>
                              {imgScalePercent}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', flexShrink: 0, minWidth: 44 }}>Opacity</span>
                            <input type="range" min={5} max={100} value={Math.round(opacity * 100)}
                                   onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                                   style={{ flex: 1, accentColor: ACCENT }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A1A1AA', minWidth: 38, textAlign: 'right' }}>
                              {Math.round(opacity * 100)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: LAYOUT_GAP,
                    minWidth: 0,
                    ...(workspaceColHeight != null
                      ? {
                          minHeight: workspaceColHeight,
                          maxHeight: workspaceColHeight,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                          WebkitOverflowScrolling: 'touch',
                        }
                      : {}),
                  }}
                >
                  <div style={darkCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontWeight: 700, color: '#E4E4E7', fontSize: '0.76rem', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={14} color={ACCENT} /> Preview · page 1
                      </p>
                      {isUpdatingPreview && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          …
                        </div>
                      )}
                    </div>

                    <div style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      position: 'relative',
                      minHeight: pageRendered ? 0 : 144,
                    }}>
                      <canvas ref={previewCanvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
                      {!pageRendered && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.25)',
                        }}>
                          <Loader2 size={22} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
                          <p style={{ fontSize: '0.72rem', fontWeight: 600, margin: 0, color: '#E4E4E7' }}>Loading…</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={darkCard}>
                    <p style={sectionLabel}>Pages</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: pageScope === 'custom' ? 10 : 0 }}>
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'odd', label: 'Odd' },
                        { id: 'even', label: 'Even' },
                        { id: 'first', label: 'First' },
                        { id: 'last', label: 'Last' },
                        { id: 'custom', label: 'Range' },
                      ].map(({ id, label }) => {
                        const isSel = pageScope === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPageScope(id)}
                            style={{
                              borderRadius: 10, padding: '10px 8px', cursor: 'pointer', position: 'relative',
                              background: isSel ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isSel ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
                              transition: 'all 0.18s ease',
                            }}
                          >
                            {isSel && (
                              <span style={{ position: 'absolute', top: 4, right: 4, lineHeight: 0 }}>
                                <Check size={12} color={ACCENT} strokeWidth={3} />
                              </span>
                            )}
                            <span style={{ fontWeight: 700, color: isSel ? '#CFFAFE' : '#A1A1AA', fontSize: '0.72rem' }}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {pageScope === 'custom' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>From</label>
                        <input
                          type="number"
                          min={1}
                          max={pageCount}
                          value={customFrom}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, customTo));
                            setCustomFrom(v);
                          }}
                          style={{
                            width: 52, padding: '8px 10px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)', fontWeight: 700, textAlign: 'center', fontSize: '0.82rem',
                            background: 'rgba(255,255,255,0.05)', color: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>To</label>
                        <input
                          type="number"
                          min={customFrom}
                          max={pageCount}
                          value={customTo}
                          onChange={(e) => {
                            const v = Math.max(customFrom, Math.min(parseInt(e.target.value, 10) || customFrom, pageCount));
                            setCustomTo(v);
                          }}
                          style={{
                            width: 52, padding: '8px 10px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)', fontWeight: 700, textAlign: 'center', fontSize: '0.82rem',
                            background: 'rgba(255,255,255,0.05)', color: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pdfFile && (
              <div style={{ marginTop: WORKSPACE_ABOVE_ACTION, textAlign: 'center' }}>
                <MotionButton
                  type="button"
                  onClick={handleApplyWatermark}
                  disabled={processing || !isReadyToApply()}
                  loading={processing}
                  label={processing ? `Applying… ${progress}%` : 'Apply watermark'}
                  style={{ width: 'max-content', maxWidth: '100%', minWidth: 160 }}
                />
              </div>
            )}
          </>
        )}

        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: processing ? 'blur(8px)' : 'none',
          opacity: processing ? 1 : 0,
          pointerEvents: processing ? 'auto' : 'none',
          transition: 'opacity 0.18s ease',
          padding: 20,
        }}>
          <div style={{
            borderRadius: 16, padding: '32px 26px', textAlign: 'center',
            width: '100%', maxWidth: 288, margin: '0 13px',
            background: '#14151a',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 12px',
              background: 'rgba(34,211,238,0.12)', border: `1px solid ${ACCENT}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Droplets size={22} color={ACCENT} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white', marginBottom: 6 }}>Applying watermark</h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.78rem', marginBottom: 16 }}>
              Page {Math.max(1, currentPage)} of {getTargetPageCount() || 1}
            </p>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: `${progress}%`, borderRadius: 999,
                background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`,
                transition: 'width 0.35s ease',
              }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: ACCENT, fontWeight: 600, margin: 0 }}>{progress}%</p>
          </div>
        </div>

      </div>
    </div>
  );
}
