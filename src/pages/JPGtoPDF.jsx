import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  GripVertical, Loader2, X, ArrowLeft, AlertTriangle, Plus,
} from 'lucide-react';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import { saveBlobToDisk } from '../utils/saveBlobToDisk';
import { useWorker } from '../hooks/useWorker';
import MotionButton from '../components/ui/motion-button';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import formatFileSize from '../utils/formatFileSize';

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPT_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

/** JPEG embed quality for WebP/HEIC raster path and pdf-lib embedding (always best). */
const JPEG_QUALITY = 0.95;

const LAYOUT_GAP = 16;

/* ════════════════════════════════════════════════════════════
   JPG TO PDF PAGE
   ════════════════════════════════════════════════════════════ */
export default function JPGtoPDF() {
  const [images, setImages] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const [outputName, setOutputName] = useState('images');

  const [currentImg, setCurrentImg] = useState(0);
  const [error, setError] = useState(null);

  const [isSuccess, setIsSuccess] = useState(false);
  const [resultBlob, setResultBlob] = useState(null);

  const fileInputRef = useRef(null);

  // Web Worker for off-main-thread conversion
  const { run: runWorker, progress, running: processing } = useWorker('image');

  const darkCard = {
    borderRadius: 16,
    padding: '22px 22px',
    backgroundColor: '#14151a',
    backgroundImage: [
      'radial-gradient(120% 80% at 0% 0%, rgba(236,72,153,0.1) 0%, transparent 55%)',
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

  const removeImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.objectUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleDragStart = (idx) => setDragIndex(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); if (idx !== dragIndex) setDropTarget(idx); };
  const handleCardDrop = (idx) => {
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); setDropTarget(null); return; }
    setImages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIndex(null); setDropTarget(null);
  };

  /* ── convert (runs in Web Worker) ────────────────────── */
  const handleConvert = async () => {
    if (!images.length) return;
    setCurrentImg(0);
    setError(null);

    try {
      // Read all image files into ArrayBuffers for the worker
      const imageData = await Promise.all(
        images.map(async (img) => {
          const buffer = await img.file.arrayBuffer();
          return {
            buffer,
            fileName: img.file.name,
            mimeType: img.file.type,
          };
        })
      );

      // Collect transferables (the buffers)
      const transferables = imageData.map((d) => d.buffer);

      const result = await runWorker('jpgToPdf', { images: imageData }, transferables);

      const blob = new Blob([result.data], { type: 'application/pdf' });
      setResultBlob(blob);
      setIsSuccess(true);
    } catch (err) {
      setError(`Conversion failed: ${err.message}`);
    }
  };

  const handleDownload = async () => {
    if (!resultBlob) return false;
    const base = (outputName.trim() || 'images').replace(/\.pdf$/i, '');
    return saveBlobToDisk(resultBlob, `${base}.pdf`);
  };

  const handleReset = () => {
    images.forEach(i => URL.revokeObjectURL(i.objectUrl));
    setImages([]); setIsSuccess(false); setResultBlob(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const WORKSPACE_ABOVE_STICKY = 28;

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', padding: '32px 20px 120px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

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
            JPG to PDF
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
          <HeroDitheringCard accentColor="#EC4899" minHeight={280} style={{ marginBottom: LAYOUT_GAP }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: 24, letterSpacing: '-0.02em', textAlign: 'center' }}>
              PDF ready
            </h3>

            <DownloadButton onDownload={handleDownload} label="Download PDF" disabled={!resultBlob} />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <button
                type="button"
                onClick={handleReset}
                style={ghostBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
              >
                Convert more images
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
        )}

        <div style={{ display: isSuccess ? 'none' : 'block' }}>
          {images.length === 0 && !isSuccess && (
            <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: LAYOUT_GAP }}>
              <UploadCard
                status="idle"
                title={isDragOver ? 'Drop your images here' : 'Drop images to build a PDF'}
                description="or click to browse · JPG, PNG, WebP, HEIC"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
              />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
            hidden
            onChange={e => { addImages(e.target.files); e.target.value = ''; }}
          />

          {images.length > 0 && !isSuccess && (
            <>
              <div className="tool-workspace-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: LAYOUT_GAP, alignItems: 'start' }}>

                <div
                  style={darkCard}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); addImages(e.dataTransfer.files); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: LAYOUT_GAP, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h2 style={{ fontWeight: 800, color: '#FAFAFA', fontSize: '1rem', margin: '0 0 4px' }}>
                        {images.length} image{images.length !== 1 ? 's' : ''} · {images.length} page{images.length !== 1 ? 's' : ''}
                      </h2>
                      <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0 }}>
                        Drag cards to reorder · Drop files here or use Add pages
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(236,72,153,0.35)',
                          background: 'rgba(236,72,153,0.12)', color: '#F9A8D4', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        <Plus size={16} strokeWidth={2.2} /> Add pages
                      </button>
                      <button
                        type="button"
                        onClick={() => { images.forEach(i => URL.revokeObjectURL(i.objectUrl)); setImages([]); }}
                        style={{
                          padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)',
                          background: 'transparent', color: '#F87171', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: LAYOUT_GAP }}>
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={() => handleCardDrop(idx)}
                        onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
                        style={{
                          borderRadius: 14,
                          background: 'rgba(0,0,0,0.25)',
                          border: dropTarget === idx && dragIndex !== idx ? '2px solid #EC4899' : '1px solid rgba(255,255,255,0.08)',
                          opacity: dragIndex === idx ? 0.45 : 1,
                          transform: dragIndex === idx ? 'scale(0.97)' : 'scale(1)',
                          transition: 'transform 0.2s ease, opacity 0.18s ease, border-color 0.2s ease',
                          cursor: 'grab', overflow: 'hidden',
                        }}
                      >
                        <div style={{ height: 110, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', position: 'relative' }}>
                          <img src={img.objectUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{
                            position: 'absolute', top: 6, left: 6,
                            background: '#EC4899', color: 'white', fontWeight: 800, fontSize: '0.65rem',
                            padding: '2px 8px', borderRadius: 8,
                          }}>
                            {idx + 1}
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                            style={{
                              position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 8, border: 'none',
                              background: 'rgba(0,0,0,0.55)', color: 'white', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div style={{ padding: '10px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GripVertical size={14} color="#71717A" style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.68rem', color: '#E4E4E7', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.name}</p>
                            <p style={{ fontSize: '0.62rem', color: '#71717A', margin: 0 }}>{formatFileSize(img.size)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ ...darkCard, padding: '20px' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                    Output filename
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      value={outputName}
                      onChange={e => setOutputName(e.target.value)}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.12)',
                        fontWeight: 600, color: '#FAFAFA', fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.05)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 600, flexShrink: 0 }}>.pdf</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: '12px 0 0', lineHeight: 1.45 }}>
                    Each page uses the same pixel size as its image at full quality.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: WORKSPACE_ABOVE_STICKY, marginBottom: 8 }}>
                <MotionButton
                  type="button"
                  onClick={handleConvert}
                  disabled={!images.length || processing}
                  loading={processing}
                  label={processing ? `Creating… ${progress}%` : 'Create PDF'}
                  style={{ width: 'max-content', maxWidth: '100%', minWidth: 200 }}
                />
              </div>
            </>
          )}
        </div>
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
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(236,72,153,0.14) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', animation: 'bounce 1s infinite',
            }}>
              <Loader2 size={28} strokeWidth={1.8} color="#F472B6" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: 6 }}>Creating PDF</h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.85rem', marginBottom: 24 }}>
              Image {currentImg} of {images.length}
            </p>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #DB2777, #F472B6)', borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#F472B6', fontWeight: 600, marginTop: 10 }}>{progress}%</p>
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
