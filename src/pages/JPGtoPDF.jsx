import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Trash2, GripVertical, Download, Loader2, X, FileText } from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPT_EXT   = /\.(jpe?g|png|webp|heic|heif)$/i;

/* pink clay shadows */
const S = {
  card: '0 8px 0px rgba(190,24,93,0.38), 0 24px 60px rgba(219,39,119,0.32), inset 0 -10px 24px rgba(219,39,119,0.22), inset 0 10px 24px rgba(255,255,255,0.92)',
  sm:   '0 4px 0px rgba(190,24,93,0.28), 0 10px 26px rgba(219,39,119,0.22), inset 0 -4px 10px rgba(219,39,119,0.18), inset 0 4px 10px rgba(255,255,255,0.9)',
  btn:  '0 6px 0px rgba(190,24,93,0.48), 0 16px 40px rgba(219,39,119,0.4), inset 0 -6px 14px rgba(190,24,93,0.32), inset 0 6px 14px rgba(251,207,232,0.5)',
  back: '0 4px 0px rgba(55,48,163,0.2), 0 10px 28px rgba(60,100,220,0.18), inset 0 -3px 8px rgba(100,130,220,0.15), inset 0 3px 8px rgba(255,255,255,0.98)',
  err:  '0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.2), inset 0 -5px 12px rgba(220,38,38,0.18), inset 0 5px 12px rgba(255,255,255,0.85)',
  drop: '0 7px 0px rgba(190,24,93,0.4), 0 20px 55px rgba(219,39,119,0.32), inset 0 -10px 22px rgba(219,39,119,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
};

const PAGE_SIZES = {
  match:  { label: 'Match image',  sub: 'Page = image dimensions' },
  a4:     { label: 'A4',           sub: '210 × 297 mm (portrait)' },
  letter: { label: 'Letter',       sub: '8.5 × 11 in (portrait)' },
  square: { label: 'Square',       sub: '595 × 595 pt' },
};
const FIT_MODES = {
  fill:     { label: 'Fill page',      emoji: '⬛', sub: 'Crops to cover page' },
  fit:      { label: 'Fit page',       emoji: '🔲', sub: 'Full image, white bars' },
  original: { label: 'Original size',  emoji: '🎯', sub: 'Centered, 1:1 pixels' },
};
const MARGINS = {
  none:   { label: 'None',   px: 0  },
  small:  { label: 'Small',  px: 8  },
  medium: { label: 'Medium', px: 24 },
  large:  { label: 'Large',  px: 48 },
};

/* ════════════════════════════════════════════════════════════
   JPG TO PDF PAGE
   ════════════════════════════════════════════════════════════ */
export default function JPGtoPDF() {
  const [images, setImages]         = useState([]); // [{id, file, objectUrl, name, size}]
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex]   = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  /* settings */
  const [pageSize, setPageSize]     = useState('match');
  const [fitMode, setFitMode]       = useState('fit');
  const [margin, setMargin]         = useState('none');
  const [quality, setQuality]       = useState('high');
  const [outputName, setOutputName] = useState('images');

  /* processing */
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [currentImg, setCurrentImg] = useState(0);
  const [error, setError]           = useState(null);

  /* success */
  const [isSuccess, setIsSuccess]   = useState(false);
  const [resultBlob, setResultBlob] = useState(null);
  const [resultSize, setResultSize] = useState(0);

  const fileInputRef = useRef(null);

  /* ── add images ─────────────────────────────────────────── */
  const addImages = useCallback((fileList) => {
    const valid = Array.from(fileList).filter(
      f => ACCEPT_TYPES.includes(f.type) || ACCEPT_EXT.test(f.name)
    );
    if (!valid.length) { setError('Please select JPG, PNG, WebP, or HEIC images.'); return; }
    const newImgs = valid.map(file => ({
      id: crypto.randomUUID(),
      file,
      objectUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    setImages(prev => [...prev, ...newImgs]);
    setIsSuccess(false);
    setResultBlob(null);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    addImages(e.dataTransfer.files);
  };

  /* ── remove image ───────────────────────────────────────── */
  const removeImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.objectUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  /* ── drag-to-reorder ────────────────────────────────────── */
  const handleDragStart = (idx) => setDragIndex(idx);
  const handleDragOver  = (e, idx) => { e.preventDefault(); if (idx !== dragIndex) setDropTarget(idx); };
  const handleCardDrop  = (idx) => {
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDropTarget(null); return; }
    setImages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIndex(null); setDropTarget(null);
  };

  /* ── WebP/HEIC → JPEG canvas conversion ────────────────── */
  const toJpegBytes = async (file) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality === 'high' ? 0.95 : 0.82));
    const bytes = await blob.arrayBuffer();
    URL.revokeObjectURL(url);
    canvas.width = 0; canvas.height = 0;
    return { bytes, width: img.naturalWidth, height: img.naturalHeight };
  };

  /* ── build PDF ───────────────────────────────────────────── */
  const handleConvert = async () => {
    if (!images.length) return;
    setProcessing(true);
    setProgress(0);
    setCurrentImg(0);
    setError(null);

    try {
      const { PDFDocument, PageSizes: PS, rgb } = await import('pdf-lib');
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      const pdfDoc = await PDFDocument.create();
      const marginPx = MARGINS[margin].px;
      const jpegQ = quality === 'high' ? 0.95 : 0.82;

      for (let i = 0; i < images.length; i++) {
        setCurrentImg(i + 1);
        const { file } = images[i];
        const isJpeg = file.type === 'image/jpeg' || /\.(jpe?g)$/i.test(file.name);
        const isPng  = file.type === 'image/png'  || file.name.toLowerCase().endsWith('.png');
        const needsConvert = !isJpeg && !isPng; // WebP, HEIC

        let embeddedImage, imgW, imgH;

        if (needsConvert) {
          const { bytes, width, height } = await toJpegBytes(file);
          embeddedImage = await pdfDoc.embedJpg(bytes);
          imgW = width; imgH = height;
        } else {
          const buf = isLargeFile(file) ? await processLargeFile(file) : await file.arrayBuffer();
          embeddedImage = isJpeg ? await pdfDoc.embedJpg(buf) : await pdfDoc.embedPng(buf);
          imgW = embeddedImage.width;
          imgH = embeddedImage.height;
        }

        /* page dimensions */
        let pageW, pageH;
        if (pageSize === 'match')  { pageW = imgW; pageH = imgH; }
        else if (pageSize === 'a4')     { [pageW, pageH] = PS.A4; }
        else if (pageSize === 'letter') { [pageW, pageH] = PS.Letter; }
        else                            { pageW = pageH = 595; }

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });

        /* draw area accounting for margins */
        const areaW = pageW - marginPx * 2;
        const areaH = pageH - marginPx * 2;

        let drawW, drawH, drawX, drawY;

        if (fitMode === 'original') {
          drawW = Math.min(imgW, areaW);
          drawH = Math.min(imgH, areaH);
          drawX = marginPx + (areaW - drawW) / 2;
          drawY = marginPx + (areaH - drawH) / 2;
        } else if (fitMode === 'fit') {
          const ratio = Math.min(areaW / imgW, areaH / imgH);
          drawW = imgW * ratio;
          drawH = imgH * ratio;
          drawX = marginPx + (areaW - drawW) / 2;
          drawY = marginPx + (areaH - drawH) / 2;
        } else {
          // fill — cover, centered crop (pdf-lib clips to page automatically)
          const ratio = Math.max(areaW / imgW, areaH / imgH);
          drawW = imgW * ratio;
          drawH = imgH * ratio;
          drawX = marginPx + (areaW - drawW) / 2;
          drawY = marginPx + (areaH - drawH) / 2;
        }

        page.drawImage(embeddedImage, { x: drawX, y: drawY, width: drawW, height: drawH });
        setProgress(Math.round(((i + 1) / images.length) * 92));
      }

      const bytes = await pdfDoc.save();
      setProgress(100);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setResultBlob(blob);
      setResultSize(bytes.byteLength);
      setIsSuccess(true);
    } catch (err) {
      setError(`Conversion failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── download ─────────────────────────────────────────────── */
  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outputName.trim() || 'images'}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── reset ──────────────────────────────────────────────────  */
  const handleReset = () => {
    images.forEach(i => URL.revokeObjectURL(i.objectUrl));
    setImages([]); setIsSuccess(false); setResultBlob(null);
    setResultSize(0); setProgress(0); setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── option pill helper ────────────────────────────────── */
  const optBtn = (value, selected, onClick, label, sub) => (
    <div
      key={value}
      onClick={() => onClick(value)}
      style={{
        flex: 1, minWidth: 80, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
        background: selected === value ? '#F9A8D4' : 'rgba(255,255,255,0.6)',
        boxShadow: selected === value ? S.sm : '0 2px 0px rgba(190,24,93,0.12), inset 0 2px 6px rgba(255,255,255,0.7)',
        transform: selected === value ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        position: 'relative',
      }}
    >
      {selected === value && (
        <div style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#BE185D', color: 'white', fontSize: '0.55rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(190,24,93,0.5)' }}>✓</div>
      )}
      <p style={{ fontWeight: 800, color: '#831843', fontSize: '0.78rem', margin: '0 0 1px' }}>{label}</p>
      {sub && <p style={{ fontSize: '0.62rem', color: '#BE185D', margin: 0 }}>{sub}</p>}
    </div>
  );

  const settingRow = (title, children) => (
    <div style={{ borderRadius: 20, padding: 16, background: '#FBCFE8', boxShadow: S.sm }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#831843', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>{title}</p>
      {children}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 24px 80px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ─── HEADER ────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 14, marginBottom: 24,
            background: 'rgba(255,255,255,0.88)', color: '#3730A3',
            fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
            boxShadow: S.back, transition: 'transform 0.2s ease',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >← Back</Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: '#FBCFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: S.sm }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>JPG → PDF</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: 0 }}>Combine images into a beautiful PDF — with full layout control</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['🔒 Files never uploaded', '↕️ Drag to reorder', '📐 Full layout control'].map((b, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600 }}>{b}</div>
            ))}
          </div>
        </div>

        {/* ─── ERROR ─────────────────────────────────────────── */}
        {error && (
          <div style={{ borderRadius: 20, padding: '14px 18px', marginBottom: 16, background: '#FEE2E2', boxShadow: S.err, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
            <p style={{ flex: 1, fontWeight: 600, color: '#991B1B', fontSize: '0.88rem', margin: 0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 10, padding: '4px 12px', color: '#991B1B', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ─── SUCCESS STATE ─────────────────────────────────── */}
        {isSuccess && (
          <div style={{ borderRadius: 32, padding: '28px 24px', marginBottom: 24, background: 'linear-gradient(145deg, #FDF2F8, #FBCFE8)', boxShadow: S.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F9A8D4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0, boxShadow: S.sm }}>✅</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 900, color: '#831843', fontSize: '1.2rem', margin: '0 0 4px' }}>PDF created!</h3>
                <p style={{ color: '#BE185D', fontSize: '0.82rem', margin: 0 }}>{images.length} image{images.length !== 1 ? 's' : ''} → {images.length} page{images.length !== 1 ? 's' : ''} • {formatSize(resultSize)}</p>
              </div>
            </div>

            {/* Filename input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#831843', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>Output filename</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={outputName}
                  onChange={e => setOutputName(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 14, border: '2px solid #F9A8D4', fontWeight: 700, color: '#831843', fontSize: '0.9rem', background: 'rgba(255,255,255,0.85)', outline: 'none', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.88rem', color: '#BE185D', fontWeight: 600, flexShrink: 0 }}>.pdf</span>
              </div>
            </div>

            <button
              onClick={handleDownload}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 18, border: 'none',
                background: 'linear-gradient(135deg, #F472B6, #BE185D)',
                color: 'white', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 10, boxShadow: S.btn,
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Download size={20} /> Download {outputName.trim() || 'images'}.pdf
            </button>

            <button onClick={handleReset} style={{
              width: '100%', padding: 12, borderRadius: 16, border: 'none',
              background: 'rgba(255,255,255,0.65)', color: '#BE185D', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              boxShadow: '0 3px 0px rgba(190,24,93,0.12), inset 0 -2px 6px rgba(190,24,93,0.08), inset 0 2px 6px rgba(255,255,255,0.9)',
              transition: 'transform 0.2s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >🖼️ Convert More Images</button>
          </div>
        )}

        {/* ─── MAIN LAYOUT (two-column when images loaded) ──── */}
        <div style={{ display: isSuccess ? 'none' : 'block' }}>

          {/* ─── UPLOAD ZONE ───────────────────────────────────── */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{
              borderRadius: 28, padding: '24px 28px', marginBottom: 20,
              background: isDragOver ? '#F9A8D4' : '#FBCFE8',
              boxShadow: isDragOver
                ? '0 8px 0px rgba(190,24,93,0.55), 0 28px 70px rgba(219,39,119,0.5), inset 0 -12px 26px rgba(219,39,119,0.38), inset 0 12px 26px rgba(255,255,255,0.95)'
                : S.drop,
              border: isDragOver ? '2px dashed #BE185D' : '2px dashed rgba(244,114,182,0.7)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
              transform: isDragOver ? 'scale(1.015)' : 'scale(1)',
              display: 'flex', alignItems: 'center', gap: 18, minHeight: 120,
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0px rgba(190,24,93,0.22), 0 10px 26px rgba(219,39,119,0.2), inset 0 -4px 10px rgba(219,39,119,0.18), inset 0 4px 10px rgba(255,255,255,0.98)' }}>
              <Upload size={22} color="#BE185D" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: '1.05rem', color: '#831843', margin: '0 0 3px' }}>
                {isDragOver ? '📂 Drop images here!' : images.length ? 'Drop more images to add' : 'Drop images to convert to PDF'}
              </p>
              <p style={{ color: '#BE185D', fontSize: '0.82rem', margin: 0, fontWeight: 500 }}>or click to browse • JPG, PNG, WebP, HEIC • Multiple supported</p>
            </div>
            <div style={{ padding: '7px 14px', borderRadius: 12, flexShrink: 0, background: 'rgba(255,255,255,0.65)', color: '#BE185D', fontWeight: 700, fontSize: '0.78rem', boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={13} /> Select Files
            </div>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" multiple hidden onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
          </div>

          {/* ─── IMAGE GRID + SETTINGS (side by side) ─────────── */}
          {images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

              {/* LEFT: Image reorder grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontWeight: 800, color: 'white', fontSize: '1rem', margin: '0 0 2px', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
                      {images.length} image{images.length !== 1 ? 's' : ''} — {images.length} page{images.length !== 1 ? 's' : ''}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>Drag cards to reorder pages</p>
                  </div>
                  <button onClick={() => { images.forEach(i => URL.revokeObjectURL(i.objectUrl)); setImages([]); }} style={{
                    padding: '6px 14px', borderRadius: 12, border: 'none',
                    background: 'rgba(255,255,255,0.85)', color: '#BE185D', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: S.sm,
                  }}>Clear All</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={() => handleCardDrop(idx)}
                      onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
                      style={{
                        borderRadius: 20, background: '#FBCFE8',
                        boxShadow: dropTarget === idx && dragIndex !== idx
                          ? '0 0 0 3px #BE185D, ' + S.sm
                          : S.sm,
                        opacity: dragIndex === idx ? 0.4 : 1,
                        transform: dragIndex === idx ? 'scale(0.96)' : 'scale(1)',
                        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease',
                        cursor: 'grab', overflow: 'hidden',
                      }}
                    >
                      {/* Image preview */}
                      <div style={{ height: 110, background: '#FDF2F8', overflow: 'hidden', position: 'relative' }}>
                        <img src={img.objectUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {/* page number badge */}
                        <div style={{ position: 'absolute', top: 6, left: 6, background: '#BE185D', color: 'white', fontWeight: 900, fontSize: '0.65rem', padding: '2px 7px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>p.{idx + 1}</div>
                        {/* remove button */}
                        <button onClick={e => { e.stopPropagation(); removeImage(img.id); }} style={{
                          position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none',
                          background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '0.7rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><X size={11} /></button>
                      </div>

                      {/* Card info */}
                      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GripVertical size={14} color="#F9A8D4" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.68rem', color: '#831843', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</p>
                          <p style={{ fontSize: '0.62rem', color: '#BE185D', margin: 0 }}>{formatSize(img.size)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: Settings panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Page size */}
                {settingRow('Page Size',
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries(PAGE_SIZES).map(([k, v]) => optBtn(k, pageSize, setPageSize, v.label, v.sub))}
                  </div>
                )}

                {/* Fit mode */}
                {settingRow('Image Fit',
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(FIT_MODES).map(([k, v]) => (
                      <div key={k} onClick={() => setFitMode(k)} style={{
                        padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                        background: fitMode === k ? '#F9A8D4' : 'rgba(255,255,255,0.55)',
                        boxShadow: fitMode === k ? S.sm : '0 2px 0px rgba(190,24,93,0.1), inset 0 2px 6px rgba(255,255,255,0.7)',
                        transform: fitMode === k ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{v.emoji}</span>
                        <div>
                          <p style={{ fontWeight: 800, color: '#831843', fontSize: '0.8rem', margin: 0 }}>{v.label}</p>
                          <p style={{ fontSize: '0.65rem', color: '#BE185D', margin: 0 }}>{v.sub}</p>
                        </div>
                        {fitMode === k && <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: '#BE185D', color: 'white', fontSize: '0.55rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Margin */}
                {settingRow('Margins',
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries(MARGINS).map(([k, v]) => optBtn(k, margin, setMargin, v.label, v.px === 0 ? 'No padding' : `${v.px}px`))}
                  </div>
                )}

                {/* Quality */}
                {settingRow('PDF Quality',
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { id: 'standard', label: 'Standard', sub: 'Smaller file' },
                      { id: 'high',     label: 'High',     sub: 'Best quality' },
                    ].map(q => optBtn(q.id, quality, setQuality, q.label, q.sub))}
                  </div>
                )}

                {/* Output filename */}
                <div style={{ borderRadius: 20, padding: 16, background: '#FBCFE8', boxShadow: S.sm }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#831843', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Output filename</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      value={outputName}
                      onChange={e => setOutputName(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 12, border: '2px solid #F9A8D4', fontWeight: 700, color: '#831843', fontSize: '0.85rem', background: 'rgba(255,255,255,0.85)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '0.82rem', color: '#BE185D', fontWeight: 600, flexShrink: 0 }}>.pdf</span>
                  </div>
                </div>

                {/* Summary + Convert button */}
                <div style={{ borderRadius: 20, padding: 16, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 700, margin: '0 0 4px' }}>
                    📄 {images.length} page{images.length !== 1 ? 's' : ''} → {outputName.trim() || 'images'}.pdf
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', margin: '0 0 14px' }}>
                    {PAGE_SIZES[pageSize].label} • {FIT_MODES[fitMode].label} • {MARGINS[margin].label} margin
                  </p>

                  {processing ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Loader2 size={16} color="white" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        <span style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600 }}>
                          Adding image {currentImg} of {images.length}…
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #F472B6, #BE185D)', width: `${progress}%`, transition: 'width 0.3s ease', boxShadow: '0 0 8px rgba(244,114,182,0.6)' }} />
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.72rem', textAlign: 'right', marginTop: 4 }}>{progress}%</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleConvert}
                      style={{
                        width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none',
                        background: 'linear-gradient(135deg, #F472B6, #BE185D)',
                        color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: S.btn,
                        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <FileText size={18} /> Create PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── EMPTY STATE WHEN NO IMAGES ─────────────────────── */}
        {!images.length && !isSuccess && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.45)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🖼️</div>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Drop some images above to get started</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
