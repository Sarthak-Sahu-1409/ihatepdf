import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, Download, Loader2, ArrowLeft } from 'lucide-react';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const COMPRESSION_LEVELS = [
  {
    id: 'screen',
    emoji: '📧',
    label: 'Maximum',
    sublabel: 'Email & web',
    reduction: 'Up to 70% smaller',
    bg: '#FDE68A',
    selectedBg: '#FCD34D',
    shadow: 'rgba(161,98,7,0.4)',
    selectedShadow: 'rgba(161,98,7,0.6)',
    accent: '#92400E',
  },
  {
    id: 'ebook',
    emoji: '⚖️',
    label: 'Balanced',
    sublabel: 'Sharing & reading',
    reduction: 'Up to 50% smaller',
    bg: '#BBF7D0',
    selectedBg: '#86EFAC',
    shadow: 'rgba(21,128,61,0.4)',
    selectedShadow: 'rgba(21,128,61,0.6)',
    accent: '#14532D',
  },
  {
    id: 'printer',
    emoji: '🖨️',
    label: 'Light',
    sublabel: 'Print & archive',
    reduction: 'Up to 20% smaller',
    bg: '#BFDBFE',
    selectedBg: '#93C5FD',
    shadow: 'rgba(29,78,216,0.4)',
    selectedShadow: 'rgba(29,78,216,0.6)',
    accent: '#1E3A8A',
  },
];

/* ════════════════════════════════════════════════════════════════
   COMPRESS PDF PAGE
   ════════════════════════════════════════════════════════════════ */
export default function CompressPDF() {
  /* ── state ──────────────────────────────────────────────── */
  const [pdfFile, setPdfFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState('ebook');
  const [thumbnail, setThumbnail] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const fileInputRef = useRef(null);

  /* ── computed ───────────────────────────────────────────── */
  const savedPercent =
    originalSize > 0
      ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
      : 0;

  /* ── file loading ───────────────────────────────────────── */
  const handleFileLoad = async (file) => {
    if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
      setError('Please select a valid PDF file.');
      return;
    }

    setPdfFile(file);
    setOriginalSize(file.size);
    setError(null);
    setIsSuccess(false);
    setCompressedBlob(null);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const ab = await file.arrayBuffer();

      let doc;
      try {
        doc = await pdfjsLib.getDocument({ data: ab.slice(0), verbosity: 0 }).promise;
      } catch (err) {
        if (err.name === 'PasswordException' || err.message?.includes('password')) {
          try {
            doc = await pdfjsLib.getDocument({ data: ab.slice(0), password: '', verbosity: 0 }).promise;
          } catch {
            setPageCount(0);
            setThumbnail(null);
            return;
          }
        } else {
          setPageCount(0);
          setThumbnail(null);
          return;
        }
      }

      setPageCount(doc.numPages);

      try {
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        setThumbnail(null);
      }
    } catch {
      /* thumbnail/page count failed silently */
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
    setThumbnail(null);
    setPageCount(0);
    setOriginalSize(0);
    setError(null);
    setIsSuccess(false);
    setCompressedBlob(null);
    setCompressedSize(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── compression settings per level ──────────────────────── */
  const LEVEL_CONFIG = {
    screen:  { scale: 0.75, jpegQuality: 0.30, tryRasterize: true },
    ebook:   { scale: 1.0,  jpegQuality: 0.50, tryRasterize: true },
    printer: { scale: 1.5,  jpegQuality: 0.80, tryRasterize: true },
  };

  /* ── helper: metadata-only compression ──────────────────── */
  const compressMetadataOnly = async (PDFDocument, buffer, stripAll) => {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    if (stripAll) pdfDoc.setTitle('');
    const bytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    return new Blob([bytes], { type: 'application/pdf' });
  };

  /* ── helper: rasterize pages to JPEG ────────────────────── */
  const compressRasterize = async (PDFDocument, buffer, config, onProgress) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

    const srcDoc = await pdfjsLib.getDocument({
      data: buffer.slice(0),
      verbosity: 0,
    }).promise;

    const newPdf = await PDFDocument.create();
    const totalPages = srcDoc.numPages;

    for (let i = 1; i <= totalPages; i++) {
      const page = await srcDoc.getPage(i);
      const viewport = page.getViewport({ scale: config.scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      // Fill with white background to prevent transparent-to-black issue
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Use async toBlob to avoid huge synchronous memory spikes (base64 string)
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', config.jpegQuality)
      );
      
      const arrayBuffer = await blob.arrayBuffer();
      const jpegBytes = new Uint8Array(arrayBuffer);

      const jpegImage = await newPdf.embedJpg(jpegBytes);
      const origViewport = page.getViewport({ scale: 1.0 });
      const pdfPage = newPdf.addPage([origViewport.width, origViewport.height]);
      pdfPage.drawImage(jpegImage, {
        x: 0, y: 0,
        width: origViewport.width,
        height: origViewport.height,
      });

      canvas.width = 0;
      canvas.height = 0;

      if (onProgress) onProgress(i, totalPages);
      
      // Yield to main thread so the progress bar UI has time to redraw
      await new Promise((r) => setTimeout(r, 0));
    }

    newPdf.setAuthor('');
    newPdf.setSubject('');
    newPdf.setKeywords([]);
    newPdf.setCreator('');
    newPdf.setProducer('');
    newPdf.setTitle('');

    const bytes = await newPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 30,
    });
    return new Blob([bytes], { type: 'application/pdf' });
  };

  /* ── compress — try multiple approaches, pick smallest ──── */
  const handleCompress = async () => {
    if (!pdfFile) return;
    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const { PDFDocument } = await import('pdf-lib');
      setProgress(10);

      let arrayBuffer;
      const { isLargeFile, processLargeFile } = await import('../utils/streamProcessor');
      if (isLargeFile(pdfFile)) {
        arrayBuffer = await processLargeFile(pdfFile);
      } else {
        arrayBuffer = await pdfFile.arrayBuffer();
      }
      setProgress(15);

      const config = LEVEL_CONFIG[compressionLevel];
      const originalBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const candidates = [originalBlob];

      // APPROACH 1: Metadata strip + object-stream re-save
      setProgress(20);
      try {
        const metadataBlob = await compressMetadataOnly(
          PDFDocument,
          arrayBuffer,
          compressionLevel === 'screen'
        );
        candidates.push(metadataBlob);
      } catch { /* metadata strip failed, continue */ }
      setProgress(30);

      // APPROACH 2: Rasterize pages to JPEG (all levels now try this)
      if (config.tryRasterize) {
        try {
          const rasterBlob = await compressRasterize(
            PDFDocument,
            arrayBuffer,
            config,
            (current, total) => {
              setProgress(30 + Math.round((current / total) * 60));
            }
          );
          candidates.push(rasterBlob);
        } catch { /* rasterize failed, continue with other candidates */ }
      }

      setProgress(95);

      // Pick the SMALLEST candidate — never return a file bigger than the original
      candidates.sort((a, b) => a.size - b.size);
      const bestBlob = candidates[0];

      setCompressedBlob(bestBlob);
      setCompressedSize(bestBlob.size);
      setProgress(100);
      setIsSuccess(true);
    } catch (err) {
      setError(`Compression failed: ${err.message}. The PDF may be encrypted or corrupted.`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── download ───────────────────────────────────────────── */
  const handleDownload = () => {
    if (!compressedBlob) return;
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');
    a.download = `${baseName}-compressed.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── reset ──────────────────────────────────────────────── */
  const handleReset = () => {
    handleRemoveFile();
    setCompressedBlob(null);
    setCompressedSize(0);
    setIsSuccess(false);
    setProgress(0);
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: 'hidden',
        padding: '32px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* ═══════════════════════════════════════════════════════
            SECTION 1 — PAGE HEADER
            ═══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 28 }}>
          {/* Back button */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 14,
              marginBottom: 24,
              background: 'rgba(255,255,255,0.88)',
              color: '#3730A3',
              fontWeight: 600,
              fontSize: '0.85rem',
              textDecoration: 'none',
              boxShadow:
                '0 4px 0px rgba(55,48,163,0.2), 0 10px 28px rgba(60,100,220,0.18), inset 0 -3px 8px rgba(100,130,220,0.15), inset 0 3px 8px rgba(255,255,255,0.98)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <ArrowLeft size={15} /> Back
          </Link>

          {/* Title row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                flexShrink: 0,
                background: '#BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 5px 0px rgba(21,128,61,0.4), 0 14px 36px rgba(22,163,74,0.32), inset 0 -6px 14px rgba(22,163,74,0.28), inset 0 6px 14px rgba(255,255,255,0.95)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🗜️</span>
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  color: 'white',
                  margin: 0,
                  textShadow: '0 2px 12px rgba(0,0,0,0.2)',
                }}
              >
                Compress PDF
              </h1>
              <p
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.875rem',
                  margin: 0,
                }}
              >
                Reduce file size instantly
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SECTION 6 — ERROR STATE
            ═══════════════════════════════════════════════════════ */}
        {error && (
          <div
            style={{
              borderRadius: 20,
              padding: '16px 20px',
              marginBottom: 16,
              background: '#FEE2E2',
              boxShadow:
                '0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.22), inset 0 -6px 14px rgba(220,38,38,0.18), inset 0 6px 14px rgba(255,255,255,0.85)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#991B1B', fontSize: '0.9rem', margin: '0 0 3px' }}>
                Compression failed
              </p>
              <p style={{ color: '#B91C1C', fontSize: '0.8rem', margin: 0 }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                padding: '5px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(255,255,255,0.7)',
                color: '#991B1B',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECTION 5 — SUCCESS STATE
            ═══════════════════════════════════════════════════════ */}
        {isSuccess && (
          <div
            style={{
              borderRadius: 32,
              padding: '32px 28px',
              background: 'linear-gradient(145deg, #D1FAE5, #A7F3D0)',
              boxShadow:
                '0 12px 0px rgba(21,128,61,0.38), 0 36px 90px rgba(22,163,74,0.42), inset 0 -14px 32px rgba(22,163,74,0.26), inset 0 14px 32px rgba(255,255,255,0.95)',
              marginBottom: 16,
              overflow: 'visible',
            }}
          >
            {/* Success icon */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  margin: '0 auto 10px',
                  background: '#BBF7D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  boxShadow:
                    '0 7px 0px rgba(21,128,61,0.38), 0 18px 44px rgba(22,163,74,0.3), inset 0 -7px 16px rgba(22,163,74,0.25), inset 0 7px 16px rgba(255,255,255,0.95)',
                }}
              >
                ✅
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#14532D', margin: 0 }}>
                Compression Complete!
              </h3>
            </div>

            {/* BEFORE / AFTER SIZE COMPARISON */}
            <div
              style={{
                borderRadius: 20,
                padding: 18,
                marginBottom: 18,
                background: 'rgba(255,255,255,0.6)',
                boxShadow:
                  'inset 0 3px 10px rgba(255,255,255,0.7), inset 0 -3px 10px rgba(21,128,61,0.1)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {/* BEFORE */}
                <div style={{ textAlign: 'center' }}>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#9CA3AF',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      margin: '0 0 4px',
                    }}
                  >
                    Before
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#DC2626', margin: '0 0 2px' }}>
                    {formatFileSize(originalSize)}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: 0 }}>Original</p>
                </div>

                {/* Savings badge */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 14,
                      marginBottom: 4,
                      background: savedPercent > 0 ? '#BBF7D0' : '#FEF3C7',
                      boxShadow: savedPercent > 0
                        ? '0 4px 0px rgba(21,128,61,0.35), 0 10px 24px rgba(22,163,74,0.28), inset 0 -4px 10px rgba(22,163,74,0.22), inset 0 4px 10px rgba(255,255,255,0.9)'
                        : '0 4px 0px rgba(161,98,7,0.25), 0 10px 24px rgba(202,138,4,0.18), inset 0 -4px 10px rgba(202,138,4,0.15), inset 0 4px 10px rgba(255,255,255,0.9)',
                    }}
                  >
                    <p style={{ fontSize: '1.1rem', fontWeight: 900, color: savedPercent > 0 ? '#14532D' : '#92400E', margin: 0 }}>
                      {savedPercent > 0 ? `-${savedPercent}%` : '~0%'}
                    </p>
                  </div>
                  <span style={{ fontSize: '1.2rem' }}>→</span>
                </div>

                {/* AFTER */}
                <div style={{ textAlign: 'center' }}>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#9CA3AF',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      margin: '0 0 4px',
                    }}
                  >
                    After
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', margin: '0 0 2px' }}>
                    {formatFileSize(compressedSize)}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: '#6B7280', margin: 0 }}>Compressed</p>
                </div>
              </div>

              {/* Savings bar */}
              {savedPercent > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 10,
                      borderRadius: 999,
                      background: '#FEE2E2',
                      overflow: 'visible',
                      boxShadow: 'inset 0 2px 6px rgba(220,38,38,0.15)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${100 - savedPercent}%`,
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #22C55E, #16A34A)',
                        boxShadow: '0 0 8px rgba(34,197,94,0.5)',
                        transition: 'width 1s cubic-bezier(0.34,1.2,0.64,1)',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      color: '#15803D',
                      fontWeight: 700,
                      marginTop: 6,
                    }}
                  >
                    You saved {formatFileSize(originalSize - compressedSize)}
                  </p>
                </div>
              )}
            </div>

            {/* Edge case: minimal or no savings */}
            {savedPercent <= 5 && (
              <div
                style={{
                  borderRadius: 14,
                  padding: '10px 14px',
                  marginBottom: 16,
                  background: '#FEF3C7',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  boxShadow: 'inset 0 2px 6px rgba(251,191,36,0.2)',
                }}
              >
                <span>ℹ️</span>
                <p style={{ fontSize: '0.78rem', color: '#92400E', margin: 0, fontWeight: 500 }}>
                  {savedPercent <= 0
                    ? 'This PDF is already as compact as possible. No further compression could reduce its size — your original file is returned unchanged.'
                    : 'This PDF was already well-optimized. Minimal additional compression was possible — this is normal for PDFs created by modern tools.'}
                </p>
              </div>
            )}

            {/* Download button */}
            <button
              onClick={handleDownload}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 18,
                border: 'none',
                background: 'linear-gradient(160deg, #22C55E, #16A34A)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.05rem',
                cursor: 'pointer',
                marginBottom: 10,
                boxShadow:
                  '0 6px 0px rgba(21,128,61,0.5), 0 16px 40px rgba(22,163,74,0.4), inset 0 -6px 14px rgba(21,128,61,0.3), inset 0 6px 14px rgba(187,247,208,0.4)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = 'translateY(0) scale(1)')
              }
            >
              <Download size={20} /> Download Compressed PDF
            </button>

            {/* Compress another */}
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 16,
                border: 'none',
                background: 'rgba(255,255,255,0.7)',
                color: '#15803D',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow:
                  '0 4px 0px rgba(21,128,61,0.18), 0 10px 24px rgba(22,163,74,0.15), inset 0 -4px 10px rgba(22,163,74,0.12), inset 0 4px 10px rgba(255,255,255,0.95)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🗜️ Compress Another PDF
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECTION 2 — UPLOAD ZONE (no file loaded, not success)
            ═══════════════════════════════════════════════════════ */}
        {!pdfFile && !isSuccess && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{
              borderRadius: 28,
              padding: '24px 28px',
              minHeight: 140,
              background: isDragOver ? '#6EE7B7' : '#BBF7D0',
              boxShadow: isDragOver
                ? '0 8px 0px rgba(21,128,61,0.55), 0 28px 70px rgba(22,163,74,0.5), inset 0 -12px 26px rgba(22,163,74,0.38), inset 0 12px 26px rgba(255,255,255,0.95)'
                : '0 7px 0px rgba(21,128,61,0.4), 0 20px 55px rgba(22,163,74,0.32), inset 0 -10px 22px rgba(22,163,74,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
              border: isDragOver
                ? '2px dashed #059669'
                : '2px dashed rgba(110,231,183,0.7)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34,1.2,0.64,1)',
              transform: isDragOver ? 'scale(1.015)' : 'scale(1)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                flexShrink: 0,
                background: 'rgba(255,255,255,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 4px 0px rgba(21,128,61,0.22), 0 10px 26px rgba(22,163,74,0.2), inset 0 -4px 10px rgba(22,163,74,0.18), inset 0 4px 10px rgba(255,255,255,0.98)',
              }}
            >
              <Upload size={22} color="#15803D" />
            </div>

            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: '#14532D',
                  margin: '0 0 3px',
                }}
              >
                {isDragOver ? '📂 Drop your PDF here!' : 'Drop your PDF to compress'}
              </p>
              <p
                style={{
                  color: '#16A34A',
                  fontSize: '0.82rem',
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                or click to browse • Single PDF file
              </p>
            </div>

            <div
              style={{
                padding: '7px 14px',
                borderRadius: 12,
                flexShrink: 0,
                background: 'rgba(255,255,255,0.65)',
                color: '#15803D',
                fontWeight: 700,
                fontSize: '0.78rem',
                boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Upload size={13} /> Select File
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              hidden
              onChange={(e) => {
                if (e.target.files[0]) handleFileLoad(e.target.files[0]);
              }}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECTION 3 — FILE LOADED STATE
            ═══════════════════════════════════════════════════════ */}
        {pdfFile && !isSuccess && (
          <>
            {/* 3A — File Preview Card */}
            <div
              style={{
                borderRadius: 24,
                padding: '18px 22px',
                marginBottom: 16,
                background: '#BBF7D0',
                boxShadow:
                  '0 7px 0px rgba(21,128,61,0.4), 0 20px 55px rgba(22,163,74,0.32), inset 0 -10px 22px rgba(22,163,74,0.26), inset 0 10px 22px rgba(255,255,255,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                overflow: 'visible',
              }}
            >
              {/* PDF thumbnail */}
              <div
                style={{
                  width: 48,
                  height: 60,
                  borderRadius: 8,
                  flexShrink: 0,
                  overflow: 'hidden',
                  background: '#D1FAE5',
                  boxShadow:
                    '0 3px 0px rgba(21,128,61,0.3), 0 8px 20px rgba(22,163,74,0.22)',
                }}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    📄
                  </div>
                )}
              </div>

              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontWeight: 700,
                    color: '#14532D',
                    fontSize: '0.92rem',
                    margin: '0 0 3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pdfFile.name}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                    📦 {formatFileSize(pdfFile.size)}
                  </span>
                  {pageCount > 0 && (
                    <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                      📄 {pageCount} pages
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={handleRemoveFile}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: '#FEE2E2',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    '0 3px 0px rgba(185,28,28,0.28), 0 8px 20px rgba(220,38,38,0.18)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <X size={15} color="#DC2626" />
              </button>
            </div>

            {/* 3B — Compression Level Selector */}
            <p
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '0.82rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 10px',
              }}
            >
              Choose Compression Level
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                marginBottom: 20,
              }}
            >
              {COMPRESSION_LEVELS.map((level) => {
                const isSelected = compressionLevel === level.id;
                return (
                  <div
                    key={level.id}
                    onClick={() => setCompressionLevel(level.id)}
                    style={{
                      borderRadius: 20,
                      padding: '14px 12px',
                      background: isSelected ? level.selectedBg : level.bg,
                      boxShadow: isSelected
                        ? `0 8px 0px ${level.selectedShadow}, 0 22px 55px ${level.shadow}, inset 0 -10px 22px ${level.shadow}, inset 0 10px 22px rgba(255,255,255,0.95)`
                        : `0 4px 0px ${level.shadow.replace('0.4', '0.25')}, 0 12px 30px ${level.shadow.replace('0.4', '0.2')}, inset 0 -6px 14px ${level.shadow.replace('0.4', '0.18')}, inset 0 6px 14px rgba(255,255,255,0.85)`,
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                      transform: isSelected
                        ? 'translateY(-4px) scale(1.02)'
                        : 'translateY(0) scale(1)',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: level.accent,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          color: 'white',
                          fontWeight: 900,
                          boxShadow: `0 3px 8px ${level.shadow}`,
                        }}
                      >
                        ✓
                      </div>
                    )}
                    <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{level.emoji}</div>
                    <p
                      style={{
                        fontWeight: 800,
                        color: level.accent,
                        fontSize: '0.85rem',
                        margin: '0 0 2px',
                      }}
                    >
                      {level.label}
                    </p>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: level.accent,
                        opacity: 0.7,
                        margin: '0 0 6px',
                        fontWeight: 500,
                      }}
                    >
                      {level.sublabel}
                    </p>
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.6)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: level.accent,
                        boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.8)',
                      }}
                    >
                      {level.reduction}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3C — What Gets Removed */}
            <div
              style={{
                borderRadius: 16,
                padding: '12px 16px',
                marginBottom: 20,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>🧹</span>
              <div>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    margin: '0 0 3px',
                  }}
                >
                  How it works:
                </p>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: '0.75rem',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {compressionLevel === 'screen'
                    ? 'Pages are re-rendered as aggressively compressed JPEG images at screen resolution. Fonts, vectors, and metadata are stripped for maximum size reduction.'
                    : compressionLevel === 'ebook'
                    ? 'Pages are re-rendered as quality JPEG images at standard resolution. Good balance of file size and visual clarity.'
                    : 'Pages are re-rendered at high resolution and quality. Metadata is stripped while preserving visual fidelity for print.'}
                </p>
              </div>
            </div>

            {/* 3D — Compress Button */}
            <button
              onClick={handleCompress}
              disabled={!pdfFile || processing}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 20,
                border: 'none',
                background: processing
                  ? 'linear-gradient(160deg, #94A3B8, #64748B)'
                  : 'linear-gradient(160deg, #22C55E, #16A34A)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.05rem',
                cursor: processing ? 'not-allowed' : 'pointer',
                boxShadow: processing
                  ? 'none'
                  : '0 6px 0px rgba(21,128,61,0.55), 0 16px 40px rgba(22,163,74,0.45), inset 0 -6px 14px rgba(21,128,61,0.35), inset 0 6px 14px rgba(187,247,208,0.4)',
                transition:
                  'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                if (!processing)
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
              }}
            >
              {processing ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />{' '}
                  Compressing... {progress}%
                </>
              ) : (
                <>
                  🗜️ Compress PDF —{' '}
                  {compressionLevel === 'screen'
                    ? 'Maximum'
                    : compressionLevel === 'ebook'
                    ? 'Balanced'
                    : 'Light'}
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — PROCESSING OVERLAY
          ═══════════════════════════════════════════════════════ */}
      {processing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(5, 46, 22, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              borderRadius: 36,
              padding: '40px 36px',
              textAlign: 'center',
              maxWidth: 340,
              width: '100%',
              background: 'linear-gradient(145deg, #D1FAE5, #A7F3D0)',
              boxShadow:
                '0 12px 0px rgba(21,128,61,0.4), 0 36px 90px rgba(22,163,74,0.5), inset 0 -14px 32px rgba(22,163,74,0.28), inset 0 14px 32px rgba(255,255,255,0.95)',
            }}
          >
            {/* Animated icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                margin: '0 auto 20px',
                background: '#BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                boxShadow:
                  '0 6px 0px rgba(21,128,61,0.38), 0 16px 40px rgba(22,163,74,0.3), inset 0 -6px 14px rgba(22,163,74,0.25), inset 0 6px 14px rgba(255,255,255,0.95)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              🗜️
            </div>

            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 900,
                color: '#14532D',
                margin: '0 0 6px',
              }}
            >
              Compressing PDF
            </h3>
            <p
              style={{
                color: '#166534',
                fontSize: '0.85rem',
                margin: '0 0 20px',
                lineHeight: 1.5,
              }}
            >
              Optimizing structure and removing metadata...
            </p>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 10,
                borderRadius: 999,
                background: 'rgba(21,128,61,0.15)',
                boxShadow: 'inset 0 2px 6px rgba(21,128,61,0.2)',
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #22C55E, #16A34A)',
                  width: `${progress}%`,
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 10px rgba(34,197,94,0.6)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#15803D', fontWeight: 700 }}>
              {progress}%
            </p>

            {/* Step checklist */}
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              {[
                { label: 'Loading PDF', threshold: 20 },
                { label: 'Stripping metadata', threshold: 50 },
                { label: 'Optimizing structure', threshold: 80 },
                { label: 'Finalizing output', threshold: 100 },
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    opacity: progress >= i * 25 ? 1 : 0.35,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>
                    {progress >= step.threshold ? '✅' : '⏳'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#166534',
                      fontWeight: 600,
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
