// Input: PDF file + watermark settings; Output: watermarked PDF blob for download
// Watermark PDF page — supports text & image watermarks with live canvas preview
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, Download, Loader2 } from 'lucide-react';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ── Shared style constants ────────────────────────────────── */
const sectionLabel = {
  fontSize: '0.72rem', fontWeight: 700, color: '#155E75',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px',
};

const statPill = {
  padding: '5px 12px', borderRadius: '10px',
  background: 'rgba(255,255,255,0.75)',
  fontSize: '0.8rem', fontWeight: 600, color: '#083344',
  boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)',
  display: 'flex', alignItems: 'center', gap: '4px',
};

const CLAY_CARD = '0 6px 0px rgba(14,116,144,0.35), 0 18px 45px rgba(6,182,212,0.28), inset 0 -8px 20px rgba(6,182,212,0.22), inset 0 8px 20px rgba(255,255,255,0.9)';

const cardStyle = {
  borderRadius: '22px', padding: '16px',
  background: '#CFFAFE',
  boxShadow: CLAY_CARD,
};

/* ── Helpers ────────────────────────────────────────────────── */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}


const POS_GRID = [
  { id: 'top-left',     label: '↖' },
  { id: 'top',          label: '↑' },
  { id: 'top-right',    label: '↗' },
  { id: 'left',         label: '←' },
  { id: 'center',       label: '⊕' },
  { id: 'right',        label: '→' },
  { id: 'bottom-left',  label: '↙' },
  { id: 'bottom',       label: '↓' },
  { id: 'bottom-right', label: '↘' },
];

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

/* Returns {x,y} for pdf-lib drawText/drawImage (bottom-left origin in PDF coords) */
function getPdfPosition(pageW, pageH, pos, drawW, drawH) {
  const m = 40;
  switch (pos) {
    case 'top':          return { x: (pageW - drawW) / 2, y: pageH - drawH - m };
    case 'bottom':       return { x: (pageW - drawW) / 2, y: m };
    case 'top-left':     return { x: m,                   y: pageH - drawH - m };
    case 'top-right':    return { x: pageW - drawW - m,   y: pageH - drawH - m };
    case 'bottom-left':  return { x: m,                   y: m };
    case 'bottom-right': return { x: pageW - drawW - m,   y: m };
    case 'left':         return { x: m,                   y: (pageH - drawH) / 2 };
    case 'right':        return { x: pageW - drawW - m,   y: (pageH - drawH) / 2 };
    default:             return { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2 };
  }
}

/* ── Position grid sub-component ───────────────────────────── */
// Input: wmPosition (string), setWmPosition (fn); Output: 3x3 grid UI
function PositionGrid({ wmPosition, setWmPosition }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
      {POS_GRID.map((pos) => {
        const isSel = wmPosition === pos.id;
        return (
          <div
            key={pos.id}
            onClick={() => setWmPosition(pos.id)}
            style={{
              padding: '8px', borderRadius: '10px', cursor: 'pointer',
              textAlign: 'center', fontSize: '1.1rem',
              background: isSel ? '#A5F3FC' : 'rgba(255,255,255,0.55)',
              boxShadow: isSel
                ? '0 3px 0px rgba(14,116,144,0.4), 0 8px 18px rgba(6,182,212,0.28)'
                : 'inset 0 2px 4px rgba(255,255,255,0.7)',
              transform: isSel ? 'translateY(-2px) scale(1.05)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {pos.label}
          </div>
        );
      })}
    </div>
  );
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
  const [rotation, setRotation]         = useState(-45);
  const [wmPosition, setWmPosition]     = useState('center');

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
  const previewScaleRef     = useRef(1.5);
  const pdfJsDocRef         = useRef(null);
  const renderedPageDataRef = useRef(null);

  /* ── Processing ─────────────────────────────────────────── */
  const [processing, setProcessing]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError]             = useState(null);

  /* ── Success ────────────────────────────────────────────── */
  const [isSuccess, setIsSuccess]   = useState(false);
  const [outputBlob, setOutputBlob] = useState(null);

  /* ── Refs ───────────────────────────────────────────────── */
  const fileInputRef     = useRef(null);
  const previewCanvasRef = useRef(null);
  const imgWmRef         = useRef(null);

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
  // Input: stamp preset object {label, color, rotation}; Output: sets text state
  const applyPreset = ({ label, color, rotation: rot }) => {
    setWmText(label);
    setWmColor(color);
    setRotation(rot);
    setOpacity(0.25);
    setFontSize(60);
    setWmPosition('center');
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
      const { x, y } = getPreviewPosition(canvas.width, canvas.height, wmPosition);
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
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
        const { x, y } = getPreviewPositionXY(canvas.width, canvas.height, drawW, drawH, wmPosition);
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
  }, [wmText, fontSize, wmColor, opacity, rotation, wmPosition, wmType,
      wmImagePreview, imgScalePercent, pageRendered]);

  /* After pageRendered flips true, draw the initial watermark */
  useEffect(() => {
    if (pageRendered) drawWatermarkOnPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRendered]);

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

  /* ── Apply watermark via pdf-lib ────────────────────────── */
  // Input: current pdfFile + all wm settings; Output: sets outputBlob on success
  const handleApplyWatermark = async () => {
    if (!pdfFile || !isReadyToApply()) return;
    setProcessing(true);
    setProgress(0);
    setCurrentPage(0);
    setError(null);

    try {
      const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');

      const arrayBuffer = isLargeFile(pdfFile)
        ? await processLargeFile(pdfFile)
        : await pdfFile.arrayBuffer();

      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages  = pdfDoc.getPages();
      const targetIndices = getTargetPageIndices(pages.length);

      let font        = null;
      let embeddedImg = null;

      if (wmType === 'text') {
        font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      } else if (wmType === 'image' && wmImageFile) {
        const imgBytes = await wmImageFile.arrayBuffer();
        const isJpeg   = wmImageFile.type === 'image/jpeg' ||
                         !!wmImageFile.name.toLowerCase().match(/\.(jpg|jpeg)$/);
        embeddedImg    = isJpeg
          ? await pdfDoc.embedJpg(imgBytes)
          : await pdfDoc.embedPng(imgBytes);
      }

      const hexToRgb = (hex) => ({
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255,
      });

      for (let i = 0; i < targetIndices.length; i++) {
        const pageIdx = targetIndices[i];
        setCurrentPage(i + 1);
        const page = pages[pageIdx];
        const { width: pageW, height: pageH } = page.getSize();
        const pageRotation = page.getRotation().angle;
        // When drawing on a rotated page in pdf-lib, the origin (0,0) and the axes rotate.
        // We calculate the unrotated bounding box to figure out where we *want* it to be:
        const isLandscapeRotated = pageRotation === 90 || pageRotation === 270;
        const unrotatedW = isLandscapeRotated ? pageH : pageW;
        const unrotatedH = isLandscapeRotated ? pageW : pageH;

        if (wmType === 'text' && font) {
          const textW = font.widthOfTextAtSize(wmText, fontSize);
          const textH = font.heightAtSize(fontSize);
          
          let { x, y } = getPdfPosition(unrotatedW, unrotatedH, wmPosition, textW, textH);
          const { r, g, b } = hexToRgb(wmColor);

          // Find the center of our bounding box in unrotated coords
          const cx = x + textW / 2;
          const cy = y + textH / 2;

          page.pushOperators(
            await import('pdf-lib').then(m => m.concatTransformationMatrix(1, 0, 0, 1, cx, cy)),
            await import('pdf-lib').then(m => {
              const rad = degrees(rotation - pageRotation).angle;
              return m.concatTransformationMatrix(
                Math.cos(rad), Math.sin(rad),
                -Math.sin(rad), Math.cos(rad),
                0, 0
              );
            })
          );

          page.drawText(wmText, {
            x: -textW / 2,
            y: -textH / 2,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
          });

          page.pushOperators(await import('pdf-lib').then(m => m.popGraphicsState()));

        } else if (wmType === 'image' && embeddedImg) {
          const scale = (unrotatedW * imgScalePercent / 100) / embeddedImg.width;
          const drawW = embeddedImg.width  * scale;
          const drawH = embeddedImg.height * scale;
          
          let { x, y } = getPdfPosition(unrotatedW, unrotatedH, wmPosition, drawW, drawH);
          
          const cx = x + drawW / 2;
          const cy = y + drawH / 2;

          page.pushOperators(
            await import('pdf-lib').then(m => m.concatTransformationMatrix(1, 0, 0, 1, cx, cy)),
            await import('pdf-lib').then(m => {
              const rad = degrees(-pageRotation).angle;
              return m.concatTransformationMatrix(
                Math.cos(rad), Math.sin(rad),
                -Math.sin(rad), Math.cos(rad),
                0, 0
              );
            })
          );

          page.drawImage(embeddedImg, {
            x: -drawW / 2,
            y: -drawH / 2,
            width: drawW, height: drawH,
            opacity,
          });

          page.pushOperators(await import('pdf-lib').then(m => m.popGraphicsState()));
        }

        setProgress(Math.round(((i + 1) / targetIndices.length) * 100));
      }

      const outBytes = await pdfDoc.save({ useObjectStreams: true });
      const blob     = new Blob([outBytes], { type: 'application/pdf' });
      setOutputBlob(blob);
      setIsSuccess(true);
    } catch (err) {
      setError(`Watermark failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── Download ───────────────────────────────────────────── */
  const handleDownload = () => {
    if (!outputBlob) return;
    const url  = URL.createObjectURL(outputBlob);
    const a    = document.createElement('a');
    const base = pdfFile.name.replace(/\.pdf$/i, '');
    a.href     = url;
    a.download = `${base}-watermarked.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── Reset ──────────────────────────────────────────────── */
  const handleWatermarkAnother = () => {
    handleRemoveFile();
    setOutputBlob(null);
    setIsSuccess(false);
    setProgress(0);
    setWmText('CONFIDENTIAL');
    setFontSize(60);
    setWmColor('#1a1a1a');
    setOpacity(0.25);
    setRotation(-45);
    setWmPosition('center');
    setWmType('text');
    setPageScope('all');
    setCustomFrom(1);
    setCustomTo(1);
    if (wmImagePreview) URL.revokeObjectURL(wmImagePreview);
    setWmImageFile(null);
    setWmImagePreview(null);
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '32px 24px 160px',
      overflowX: 'hidden',
    }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* ─── SECTION 1: PAGE HEADER ─────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '14px', marginBottom: '24px',
            background: 'rgba(255,255,255,0.88)', color: '#3730A3',
            fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
            boxShadow: '0 4px 0px rgba(55,48,163,0.2), 0 10px 28px rgba(60,100,220,0.18), inset 0 -3px 8px rgba(100,130,220,0.15), inset 0 3px 8px rgba(255,255,255,0.98)',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >← Back</Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px', flexShrink: 0,
              background: '#CFFAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 5px 0px rgba(14,116,144,0.42), 0 14px 36px rgba(6,182,212,0.34), inset 0 -6px 14px rgba(6,182,212,0.28), inset 0 6px 14px rgba(255,255,255,0.95)',
            }}>
              <span style={{ fontSize: '1.5rem' }}>💧</span>
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0,
                           textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
                Watermark PDF
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: 0 }}>
                Stamp text or logo on every page — 100% private, runs in your browser
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { icon: '🔒', text: 'Files never uploaded' },
              { icon: '👁️', text: 'Live preview'         },
              { icon: '🎨', text: 'Full design control'  },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '5px 14px', borderRadius: '999px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600,
              }}>{b.icon} {b.text}</div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 8: ERROR ───────────────────────────── */}
        {error && (
          <div style={{
            borderRadius: '20px', padding: '16px 20px', marginBottom: '16px',
            background: '#FEE2E2',
            boxShadow: '0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.22), inset 0 -6px 14px rgba(220,38,38,0.18), inset 0 6px 14px rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
          }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#991B1B', fontSize: '0.9rem', margin: '0 0 3px' }}>
                Watermark failed
              </p>
              <p style={{ color: '#B91C1C', fontSize: '0.8rem', margin: 0 }}>{error}</p>
            </div>
            <button onClick={() => setError(null)} style={{
              padding: '5px 12px', borderRadius: '10px', border: 'none',
              background: 'rgba(255,255,255,0.7)', color: '#991B1B',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>Dismiss</button>
          </div>
        )}

        {/* ─── SECTION 7: SUCCESS STATE ───────────────────── */}
        {isSuccess && outputBlob && (
          <div style={{
            borderRadius: '32px', padding: '36px 32px',
            background: 'linear-gradient(145deg, #ECFEFF, #CFFAFE)',
            boxShadow: '0 12px 0px rgba(14,116,144,0.4), 0 36px 90px rgba(6,182,212,0.42), inset 0 -14px 32px rgba(6,182,212,0.26), inset 0 14px 32px rgba(255,255,255,0.95)',
            marginBottom: '16px',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '20px', margin: '0 auto 14px',
                background: '#CFFAFE', fontSize: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 7px 0px rgba(14,116,144,0.4), 0 18px 44px rgba(6,182,212,0.3), inset 0 -7px 16px rgba(6,182,212,0.25), inset 0 7px 16px rgba(255,255,255,0.95)',
              }}>✅</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#083344', margin: '0 0 4px' }}>
                Watermark Applied!
              </h3>
              <p style={{ color: '#0E7490', fontSize: '0.82rem', margin: 0 }}>
                🔒 Processed entirely in your browser — never uploaded anywhere
              </p>
            </div>

            {/* Before / After comparison */}
            <div style={{
              borderRadius: '20px', padding: '20px', marginBottom: '20px',
              background: 'rgba(255,255,255,0.6)',
              boxShadow: 'inset 0 3px 10px rgba(255,255,255,0.7), inset 0 -3px 10px rgba(14,116,144,0.08)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                            gap: '12px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF',
                               textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                    Original
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0E7490', margin: '0 0 2px' }}>
                    {formatFileSize(pdfFile.size)}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#6B7280', margin: 0 }}>{pageCount} pages</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    padding: '6px 10px', borderRadius: '12px', background: '#A5F3FC',
                    boxShadow: '0 3px 0px rgba(14,116,144,0.3), 0 8px 20px rgba(6,182,212,0.22)',
                    marginBottom: '4px',
                  }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 900, color: '#083344', margin: 0 }}>💧</p>
                  </div>
                  <span style={{ fontSize: '1.1rem' }}>→</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9CA3AF',
                               textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                    Watermarked
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0E7490', margin: '0 0 2px' }}>
                    {formatFileSize(outputBlob.size)}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#6B7280', margin: 0 }}>
                    {getTargetPageCount()} pages stamped
                  </p>
                </div>
              </div>
            </div>

            {/* Watermark summary chips */}
            <div style={{
              borderRadius: '14px', padding: '10px 16px', marginBottom: '20px',
              background: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '1rem' }}>💧</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  wmType === 'text' ? `"${wmText}"` : 'Image watermark',
                  `${Math.round(opacity * 100)}% opacity`,
                  `${getTargetPageCount()} of ${pageCount} pages`,
                ].map((chip, i) => (
                  <span key={i} style={{
                    padding: '3px 10px', borderRadius: '8px',
                    background: '#A5F3FC', fontSize: '0.75rem',
                    fontWeight: 700, color: '#083344',
                  }}>{chip}</span>
                ))}
              </div>
            </div>

            {/* Download button */}
            <button onClick={handleDownload} style={{
              width: '100%', padding: '16px', borderRadius: '18px', border: 'none',
              background: 'linear-gradient(160deg, #22D3EE, #0E7490)',
              color: 'white', fontWeight: 800, fontSize: '1.05rem',
              cursor: 'pointer', marginBottom: '10px',
              boxShadow: '0 6px 0px rgba(14,116,144,0.5), 0 16px 40px rgba(6,182,212,0.4), inset 0 -6px 14px rgba(14,116,144,0.3), inset 0 6px 14px rgba(207,250,254,0.4)',
              transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
            >
              <Download size={20} /> Download Watermarked PDF
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleWatermarkAnother} style={{
                flex: 1, padding: '11px', borderRadius: '14px', border: 'none',
                background: 'rgba(255,255,255,0.7)', color: '#0E7490',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                boxShadow: '0 4px 0px rgba(14,116,144,0.18), 0 10px 24px rgba(6,182,212,0.14), inset 0 -4px 10px rgba(6,182,212,0.1), inset 0 4px 10px rgba(255,255,255,0.95)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                💧 Watermark Another
              </button>
              <Link to="/" style={{
                flex: 1, padding: '11px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.7)', color: '#3730A3',
                fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
                textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 0px rgba(55,48,163,0.18), 0 10px 24px rgba(60,100,220,0.14), inset 0 -4px 10px rgba(100,130,220,0.1), inset 0 4px 10px rgba(255,255,255,0.95)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                ← Back to Tools
              </Link>
            </div>
          </div>
        )}

        {/* ─── SECTION 2: UPLOAD ZONE ─────────────────────── */}
        {!isSuccess && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files[0]; if (f) handleFileLoad(f); }}
            />

            <div
              onClick={() => !pdfFile && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                borderRadius: '28px', padding: '24px 28px', minHeight: '140px',
                background: isDragOver ? '#A5F3FC' : '#CFFAFE',
                boxShadow: isDragOver
                  ? '0 8px 0px rgba(14,116,144,0.55), 0 28px 70px rgba(6,182,212,0.5), inset 0 -12px 26px rgba(6,182,212,0.38), inset 0 12px 26px rgba(255,255,255,0.95)'
                  : '0 7px 0px rgba(14,116,144,0.4), 0 20px 55px rgba(6,182,212,0.32), inset 0 -10px 22px rgba(6,182,212,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
                border: isDragOver ? '2px dashed #0E7490' : '2px dashed rgba(34,211,238,0.7)',
                cursor: pdfFile ? 'default' : 'pointer',
                transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
                transform: isDragOver ? 'scale(1.015)' : 'scale(1)',
                display: 'flex', alignItems: 'center', gap: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                background: 'rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 0px rgba(14,116,144,0.22), 0 10px 26px rgba(6,182,212,0.2), inset 0 -4px 10px rgba(6,182,212,0.18), inset 0 4px 10px rgba(255,255,255,0.98)',
              }}>
                <Upload size={22} color="#0E7490" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: '1.05rem', color: '#083344', margin: '0 0 3px' }}>
                  {isDragOver ? '📂 Drop your PDF here!' : 'Drop your PDF to watermark'}
                </p>
                <p style={{ color: '#0E7490', fontSize: '0.82rem', margin: 0, fontWeight: 500 }}>
                  or click to browse • Single PDF file
                </p>
              </div>
              {!pdfFile && (
                <div style={{
                  padding: '7px 14px', borderRadius: '12px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.65)', color: '#0E7490',
                  fontWeight: 700, fontSize: '0.78rem',
                  boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <Upload size={13} /> Select File
                </div>
              )}
            </div>

            {/* ─── SECTION 3: FILE INFO CARD ─────────────── */}
            {pdfFile && (
              <div style={{
                borderRadius: '20px', padding: '14px 18px', marginBottom: '20px',
                background: '#CFFAFE',
                boxShadow: '0 6px 0px rgba(14,116,144,0.35), 0 18px 45px rgba(6,182,212,0.28), inset 0 -8px 20px rgba(6,182,212,0.22), inset 0 8px 20px rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '44px', height: '56px', borderRadius: '8px', flexShrink: 0,
                  overflow: 'hidden', background: '#E0F2FE',
                  boxShadow: '0 3px 0px rgba(14,116,144,0.28), 0 8px 18px rgba(6,182,212,0.2)',
                }}>
                  {pdfThumbnail
                    ? <img src={pdfThumbnail} alt="PDF thumbnail"
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem' }}>📄</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: '#083344', fontSize: '0.9rem',
                               margin: '0 0 3px', overflow: 'hidden',
                               textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pdfFile.name}
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#0E7490', fontWeight: 600 }}>
                      📦 {formatFileSize(pdfFile.size)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#0E7490', fontWeight: 600 }}>
                      📄 {pageCount} page{pageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button onClick={handleRemoveFile} style={{
                  width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                  background: '#FEE2E2', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 0px rgba(185,28,28,0.25), 0 8px 18px rgba(220,38,38,0.15)',
                }}>
                  <X size={14} color="#DC2626" />
                </button>
              </div>
            )}

            {/* ─── SECTION 4: SETTINGS + LIVE PREVIEW ─────── */}
            {pdfFile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px',
                alignItems: 'start',
              }}>

                {/* ══ LEFT COLUMN — SETTINGS ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* WATERMARK TYPE TOGGLE */}
                  <div style={cardStyle}>
                    <p style={sectionLabel}>Watermark Type</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { id: 'text',  emoji: '✍️', label: 'Text'  },
                        { id: 'image', emoji: '🖼️', label: 'Image' },
                      ].map((t) => {
                        const isSel = wmType === t.id;
                        return (
                          <div key={t.id} onClick={() => setWmType(t.id)} style={{
                            flex: 1, textAlign: 'center', padding: '10px',
                            borderRadius: '14px', cursor: 'pointer',
                            background: isSel ? '#A5F3FC' : 'rgba(255,255,255,0.5)',
                            boxShadow: isSel
                              ? '0 5px 0px rgba(14,116,144,0.45), 0 14px 32px rgba(6,182,212,0.35), inset 0 -6px 14px rgba(6,182,212,0.28), inset 0 6px 14px rgba(255,255,255,0.92)'
                              : '0 2px 0px rgba(14,116,144,0.15), inset 0 2px 6px rgba(255,255,255,0.65)',
                            transform: isSel ? 'translateY(-3px) scale(1.02)' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                          }}>
                            <div style={{ fontSize: '1.3rem', marginBottom: '3px' }}>{t.emoji}</div>
                            <p style={{ fontWeight: 700, color: '#083344', fontSize: '0.82rem', margin: 0 }}>
                              {t.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── TEXT WATERMARK PANELS ── */}
                  {wmType === 'text' && (
                    <>
                      {/* PRESET STAMPS */}
                      <div style={cardStyle}>
                        <p style={sectionLabel}>Quick Stamps</p>
                        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'DRAFT',        color: '#1a3a8f', rotation: -45 },
                            { label: 'CONFIDENTIAL', color: '#7a0f0f', rotation: -45 },
                            { label: 'APPROVED',     color: '#15803D', rotation: -45 },
                            { label: 'COPY',         color: '#1a1a1a', rotation: -45 },
                            { label: 'VOID',         color: '#7a0f0f', rotation: -45 },
                            { label: 'SAMPLE',       color: '#92400E', rotation: -45 },
                          ].map((stamp) => (
                            <div
                              key={stamp.label}
                              onClick={() => applyPreset(stamp)}
                              style={{
                                padding: '5px 12px', borderRadius: '10px', cursor: 'pointer',
                                background: wmText === stamp.label ? '#A5F3FC' : 'rgba(255,255,255,0.55)',
                                fontSize: '0.72rem', fontWeight: 800,
                                color: stamp.color,
                                border: `1.5px solid ${stamp.color}30`,
                                boxShadow: wmText === stamp.label
                                  ? '0 3px 0px rgba(14,116,144,0.3), 0 8px 18px rgba(6,182,212,0.22)'
                                  : 'inset 0 2px 4px rgba(255,255,255,0.7)',
                                transform: wmText === stamp.label ? 'translateY(-2px)' : 'none',
                                transition: 'all 0.15s ease',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {stamp.label}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TEXT CONTENT + FONT SIZE */}
                      <div style={cardStyle}>
                        <p style={sectionLabel}>Watermark Text</p>
                        <input
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          placeholder="e.g. DRAFT, CONFIDENTIAL..."
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: '12px',
                            border: 'none', fontWeight: 700, fontSize: '0.9rem',
                            color: '#083344', background: 'rgba(255,255,255,0.85)',
                            boxShadow: 'inset 0 2px 8px rgba(14,116,144,0.1)',
                            outline: 'none', marginBottom: '12px', boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75',
                                         flexShrink: 0 }}>Size:</span>
                          <input type="range" min={20} max={120} value={fontSize}
                                 onChange={(e) => setFontSize(Number(e.target.value))}
                                 style={{ flex: 1, accentColor: '#22D3EE' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155E75',
                                         minWidth: '32px', textAlign: 'right' }}>
                            {fontSize}pt
                          </span>
                        </div>
                      </div>

                      {/* COLOR + OPACITY */}
                      <div style={cardStyle}>
                        <p style={sectionLabel}>Color &amp; Opacity</p>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px',
                                      flexWrap: 'wrap', alignItems: 'center' }}>
                          {['#1a1a1a', '#1a3a8f', '#7a0f0f', '#15803D', '#92400E', '#6D28D9'].map((col) => (
                            <div key={col} onClick={() => setWmColor(col)} style={{
                              width: '26px', height: '26px', borderRadius: '50%',
                              background: col, cursor: 'pointer',
                              boxShadow: wmColor === col
                                ? `0 0 0 3px #CFFAFE, 0 0 0 5px ${col}`
                                : '0 2px 6px rgba(0,0,0,0.25)',
                              transform: wmColor === col ? 'scale(1.2)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                            }} />
                          ))}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px',
                                          cursor: 'pointer' }}>
                            <input type="color" value={wmColor}
                                   onChange={(e) => setWmColor(e.target.value)}
                                   style={{ width: '26px', height: '26px', borderRadius: '50%',
                                            border: 'none', padding: 0, cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.68rem', color: '#155E75', fontWeight: 600 }}>
                              Custom
                            </span>
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75',
                                         flexShrink: 0 }}>Opacity:</span>
                          <input type="range" min={5} max={100} value={Math.round(opacity * 100)}
                                 onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                                 style={{ flex: 1, accentColor: '#22D3EE' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155E75',
                                         minWidth: '38px', textAlign: 'right' }}>
                            {Math.round(opacity * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* ROTATION + POSITION */}
                      <div style={cardStyle}>
                        <p style={sectionLabel}>Rotation &amp; Position</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
                                      marginBottom: '12px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75',
                                         flexShrink: 0 }}>Rotate:</span>
                          <input type="range" min={-90} max={90} value={rotation}
                                 onChange={(e) => setRotation(Number(e.target.value))}
                                 style={{ flex: 1, accentColor: '#22D3EE' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155E75',
                                         minWidth: '38px', textAlign: 'right' }}>
                            {rotation}°
                          </span>
                        </div>
                        <PositionGrid wmPosition={wmPosition} setWmPosition={setWmPosition} />
                      </div>

                    </>
                  )}

                  {/* ── IMAGE WATERMARK SETTINGS ── */}
                  {wmType === 'image' && (
                    <div style={cardStyle}>
                      <p style={sectionLabel}>Watermark Image</p>

                      <div
                        onClick={() => imgWmRef.current?.click()}
                        style={{
                          borderRadius: '16px', padding: '20px', textAlign: 'center',
                          background: 'rgba(255,255,255,0.6)',
                          border: '2px dashed rgba(34,211,238,0.6)',
                          cursor: 'pointer', marginBottom: '12px',
                        }}
                      >
                        {wmImagePreview
                          ? <img src={wmImagePreview} alt="Watermark preview"
                                 style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                          : (
                            <>
                              <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🖼️</div>
                              <p style={{ fontWeight: 700, color: '#155E75', fontSize: '0.82rem',
                                           margin: '0 0 2px' }}>
                                Click to upload logo/image
                              </p>
                              <p style={{ color: '#0E7490', fontSize: '0.72rem', margin: 0 }}>
                                PNG (transparent bg recommended), JPG
                              </p>
                            </>
                          )
                        }
                      </div>
                      <input ref={imgWmRef} type="file"
                             accept="image/png,image/jpeg,image/webp"
                             style={{ display: 'none' }}
                             onChange={handleWmImageUpload} />

                      {wmImagePreview && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75',
                                           flexShrink: 0, minWidth: '50px' }}>Scale:</span>
                            <input type="range" min={5} max={80} value={imgScalePercent}
                                   onChange={(e) => setImgScalePercent(Number(e.target.value))}
                                   style={{ flex: 1, accentColor: '#22D3EE' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155E75',
                                           minWidth: '38px', textAlign: 'right' }}>
                              {imgScalePercent}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75',
                                           flexShrink: 0, minWidth: '50px' }}>Opacity:</span>
                            <input type="range" min={5} max={100} value={Math.round(opacity * 100)}
                                   onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                                   style={{ flex: 1, accentColor: '#22D3EE' }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#155E75',
                                           minWidth: '38px', textAlign: 'right' }}>
                              {Math.round(opacity * 100)}%
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#155E75', margin: 0 }}>
                            Position:
                          </p>
                          <PositionGrid wmPosition={wmPosition} setWmPosition={setWmPosition} />
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* ══ RIGHT COLUMN — LIVE PREVIEW ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    borderRadius: '24px', padding: '16px',
                    background: '#CFFAFE',
                    boxShadow: '0 7px 0px rgba(14,116,144,0.4), 0 20px 55px rgba(6,182,212,0.32), inset 0 -10px 22px rgba(6,182,212,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between', marginBottom: '12px' }}>
                      <p style={{ fontWeight: 700, color: '#083344', fontSize: '0.82rem', margin: 0 }}>
                        👁️ Live Preview — Page 1
                      </p>
                      {isUpdatingPreview && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px',
                                      fontSize: '0.72rem', color: '#0E7490', fontWeight: 600 }}>
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          Updating...
                        </div>
                      )}
                    </div>

                    <div style={{
                      borderRadius: '12px', overflow: 'hidden',
                      background: 'white',
                      boxShadow: '0 4px 0px rgba(14,116,144,0.2), 0 12px 28px rgba(6,182,212,0.16)',
                      position: 'relative', minHeight: pageRendered ? 0 : '180px',
                    }}>
                      <canvas
                        ref={previewCanvasRef}
                        style={{ width: '100%', display: 'block' }}
                      />
                      {!pageRendered && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#0E7490', flexDirection: 'column', gap: '8px',
                        }}>
                          <div style={{ fontSize: '2rem' }}>👁️</div>
                          <p style={{ fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>
                            Loading preview...
                          </p>
                        </div>
                      )}
                    </div>

                    <p style={{ color: '#155E75', fontSize: '0.7rem', margin: '8px 0 0',
                                textAlign: 'center', fontWeight: 500 }}>
                      Preview updates live as you adjust settings
                    </p>
                  </div>

                  {/* ── PAGE SCOPE ── */}
                  <div style={cardStyle}>
                    <p style={sectionLabel}>Apply To Pages</p>

                    {/* 2×3 chip grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: pageScope === 'custom' ? '10px' : 0 }}>
                      {[
                        { id: 'all',    label: 'All',   emoji: '📄' },
                        { id: 'odd',    label: 'Odd',   emoji: '🔢' },
                        { id: 'even',   label: 'Even',  emoji: '🔣' },
                        { id: 'first',  label: 'First', emoji: '1️⃣' },
                        { id: 'last',   label: 'Last',  emoji: '🔚' },
                        { id: 'custom', label: 'Range', emoji: '✂️' },
                      ].map((scope) => {
                        const isSel = pageScope === scope.id;
                        return (
                          <div key={scope.id} onClick={() => setPageScope(scope.id)} style={{
                            borderRadius: '12px', padding: '8px 6px', cursor: 'pointer',
                            background: isSel ? '#A5F3FC' : 'rgba(255,255,255,0.5)',
                            boxShadow: isSel
                              ? '0 4px 0px rgba(14,116,144,0.38), 0 10px 24px rgba(6,182,212,0.28), inset 0 -5px 12px rgba(6,182,212,0.2), inset 0 5px 12px rgba(255,255,255,0.9)'
                              : '0 2px 0px rgba(14,116,144,0.1), inset 0 2px 5px rgba(255,255,255,0.6)',
                            transform: isSel ? 'translateY(-2px)' : 'none',
                            transition: 'all 0.18s cubic-bezier(0.34,1.2,0.64,1)',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: '3px',
                            position: 'relative',
                          }}>
                            <span style={{ fontSize: '0.9rem' }}>{scope.emoji}</span>
                            <p style={{ fontWeight: 700, color: '#083344', fontSize: '0.68rem', margin: 0 }}>
                              {scope.label}
                            </p>
                            {isSel && (
                              <div style={{
                                position: 'absolute', top: '-4px', right: '-4px',
                                width: '13px', height: '13px', borderRadius: '50%',
                                background: '#0E7490', color: 'white',
                                fontSize: '0.45rem', fontWeight: 900,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>✓</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom range inputs */}
                    {pageScope === 'custom' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#155E75' }}>From</label>
                        <input
                          type="number" min={1} max={pageCount} value={customFrom}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(parseInt(e.target.value) || 1, customTo));
                            setCustomFrom(v);
                          }}
                          style={{
                            width: '50px', padding: '6px 8px', borderRadius: '10px',
                            border: 'none', fontWeight: 700, textAlign: 'center', fontSize: '0.82rem',
                            background: 'rgba(255,255,255,0.85)', color: '#083344',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.07)', outline: 'none',
                          }}
                        />
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#155E75' }}>To</label>
                        <input
                          type="number" min={customFrom} max={pageCount} value={customTo}
                          onChange={(e) => {
                            const v = Math.max(customFrom, Math.min(parseInt(e.target.value) || customFrom, pageCount));
                            setCustomTo(v);
                          }}
                          style={{
                            width: '50px', padding: '6px 8px', borderRadius: '10px',
                            border: 'none', fontWeight: 700, textAlign: 'center', fontSize: '0.82rem',
                            background: 'rgba(255,255,255,0.85)', color: '#083344',
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.07)', outline: 'none',
                          }}
                        />
                        <span style={{ fontSize: '0.7rem', color: '#0E7490', fontWeight: 600 }}>
                          = {customTo - customFrom + 1}p
                        </span>
                      </div>
                    )}

                    {/* Summary line */}
                    <p style={{ fontSize: '0.68rem', color: '#0E7490', fontWeight: 600,
                                margin: '8px 0 0', textAlign: 'center' }}>
                      Stamping <strong>{getTargetPageCount()}</strong> of {pageCount} page{pageCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── SECTION 5: APPLY ACTION BAR ─────────────── */}
            {pdfFile && (
              <div style={{
                position: 'sticky', bottom: '20px', zIndex: 40,
                borderRadius: '24px', padding: '16px 20px',
                background: 'linear-gradient(135deg, #ECFEFF, #CFFAFE)',
                boxShadow: '0 8px 0px rgba(14,116,144,0.3), 0 24px 65px rgba(6,182,212,0.32), inset 0 -10px 24px rgba(6,182,212,0.2), inset 0 10px 24px rgba(255,255,255,0.95)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                marginTop: '32px', marginBottom: '40px', overflow: 'visible', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={statPill}>
                    {wmType === 'text' ? `"${wmText || '…'}"` : '🖼️ Image'}
                  </div>
                  <div style={statPill}>{Math.round(opacity * 100)}% opacity</div>
                  <div style={statPill}>📄 {getTargetPageCount()} page{getTargetPageCount() !== 1 ? 's' : ''}</div>
                </div>

                <button
                  onClick={handleApplyWatermark}
                  disabled={processing || !isReadyToApply()}
                  style={{
                    padding: '12px 28px', borderRadius: '16px', border: 'none',
                    background: (!isReadyToApply() || processing)
                      ? 'linear-gradient(160deg, #94A3B8, #64748B)'
                      : 'linear-gradient(160deg, #22D3EE, #0E7490)',
                    color: 'white', fontWeight: 800, fontSize: '0.95rem',
                    cursor: (!isReadyToApply() || processing) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: (!isReadyToApply() || processing) ? 'none'
                      : '0 5px 0px rgba(14,116,144,0.55), 0 14px 36px rgba(6,182,212,0.45), inset 0 -5px 12px rgba(14,116,144,0.35), inset 0 5px 12px rgba(207,250,254,0.4)',
                    transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                  onMouseEnter={e => { if (isReadyToApply() && !processing) e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
                >
                  {processing
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Applying... {progress}%</>
                    : <>💧 Apply Watermark</>
                  }
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── SECTION 6: PROCESSING OVERLAY ──────────────── */}
        {processing && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(8,51,68,0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div style={{
              borderRadius: '36px', padding: '40px 36px', textAlign: 'center',
              maxWidth: '340px', width: '100%',
              background: 'linear-gradient(145deg, #ECFEFF, #CFFAFE)',
              boxShadow: '0 12px 0px rgba(14,116,144,0.45), 0 36px 90px rgba(6,182,212,0.5), inset 0 -14px 32px rgba(6,182,212,0.28), inset 0 14px 32px rgba(255,255,255,0.95)',
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '22px', margin: '0 auto 20px',
                background: '#CFFAFE', fontSize: '2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 0px rgba(14,116,144,0.38), 0 16px 40px rgba(6,182,212,0.32), inset 0 -6px 14px rgba(6,182,212,0.25), inset 0 6px 14px rgba(255,255,255,0.95)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>💧</div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#083344', margin: '0 0 6px' }}>
                Applying Watermark
              </h3>
              <p style={{ color: '#0E7490', fontSize: '0.85rem', margin: '0 0 6px', lineHeight: 1.5 }}>
                Stamping page {currentPage} of {getTargetPageCount()}
              </p>
              <p style={{ color: '#155E75', fontSize: '0.75rem', margin: '0 0 20px' }}>
                Processing locally — your files never leave this device
              </p>

              <div style={{
                width: '100%', height: '10px', borderRadius: '999px',
                background: 'rgba(14,116,144,0.15)',
                boxShadow: 'inset 0 2px 6px rgba(14,116,144,0.2)',
                overflow: 'hidden', marginBottom: '8px',
              }}>
                <div style={{
                  height: '100%', borderRadius: '999px',
                  background: 'linear-gradient(90deg, #22D3EE, #0E7490)',
                  width: `${progress}%`,
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 10px rgba(34,211,238,0.6)',
                }} />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#0E7490', fontWeight: 700, margin: 0 }}>
                {progress}%
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Global keyframe styles */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
