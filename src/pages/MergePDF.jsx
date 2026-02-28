import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Trash2, GripVertical, Plus, Download, Loader2, X, ArrowLeft,
} from 'lucide-react';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ────────────────────────────────────────────────────────────────
   Helper: human-readable file size
   ──────────────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Card accent colours — cycle through these */
const cardColors = [
  {
    bg: '#BFDBFE',
    accent: '#3B82F6',
    shadow: '0 8px 0px rgba(29,78,216,0.45), 0 24px 70px rgba(29,100,230,0.38), inset 0 -10px 24px rgba(37,99,235,0.3), inset 0 10px 24px rgba(255,255,255,0.92)',
  },
  {
    bg: '#DDD6FE',
    accent: '#8B5CF6',
    shadow: '0 8px 0px rgba(109,40,217,0.45), 0 24px 70px rgba(124,58,237,0.38), inset 0 -10px 24px rgba(124,58,237,0.3), inset 0 10px 24px rgba(255,255,255,0.92)',
  },
  {
    bg: '#BBF7D0',
    accent: '#22C55E',
    shadow: '0 8px 0px rgba(21,128,61,0.45), 0 24px 70px rgba(22,163,74,0.38), inset 0 -10px 24px rgba(22,163,74,0.3), inset 0 10px 24px rgba(255,255,255,0.92)',
  },
  {
    bg: '#FECACA',
    accent: '#EF4444',
    shadow: '0 8px 0px rgba(185,28,28,0.4), 0 24px 70px rgba(220,38,38,0.35), inset 0 -10px 24px rgba(220,38,38,0.28), inset 0 10px 24px rgba(255,255,255,0.92)',
  },
  {
    bg: '#FDE68A',
    accent: '#F59E0B',
    shadow: '0 8px 0px rgba(161,98,7,0.45), 0 24px 70px rgba(202,138,4,0.38), inset 0 -10px 24px rgba(202,138,4,0.3), inset 0 10px 24px rgba(255,255,255,0.92)',
  },
];

/* ════════════════════════════════════════════════════════════════
   MERGE PDF PAGE
   ════════════════════════════════════════════════════════════════ */
export default function MergePDF() {
  /* ── state ──────────────────────────────────────────────── */
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [mergedPdfBlob, setMergedPdfBlob] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const addMoreInputRef = useRef(null);

  /* ── robust PDF file loading (3-attempt strategy) ──────── */
  const handleFilesAdded = useCallback(async (fileList) => {
    const newFiles = Array.from(fileList).filter((f) => {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        return false;
      }
      return true;
    });

    if (newFiles.length === 0) {
      setError('Please select valid PDF files only.');
      return;
    }

    for (const file of newFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

        let pdfDoc;
        let isEncrypted = false;

        // ATTEMPT 1: Load normally
        try {
          pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer.slice(0),
            verbosity: 0,
          }).promise;
        } catch (err) {
          // ATTEMPT 2: Try with empty password
          if (err.name === 'PasswordException' || err.message?.includes('password')) {
            try {
              pdfDoc = await pdfjsLib.getDocument({
                data: arrayBuffer.slice(0),
                password: '',
                verbosity: 0,
              }).promise;
              isEncrypted = true;
            } catch {
              setPdfFiles((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  file,
                  arrayBuffer,
                  name: file.name,
                  size: file.size,
                  pageCount: 0,
                  thumbnail: null,
                  pageThumbs: {},
                  selectedPages: new Set(),
                  error: 'Password protected — cannot read pages',
                  isEncrypted: true,
                  warning: null,
                },
              ]);
              continue;
            }
          } else if (
            err.message?.includes('corrupt') ||
            err.message?.includes('Invalid')
          ) {
            // ATTEMPT 3: Try pdf-lib as fallback
            try {
              const { PDFDocument } = await import('pdf-lib');
              const pdfLibDoc = await PDFDocument.load(arrayBuffer, {
                ignoreEncryption: true,
                updateMetadata: false,
              });
              const pageCount = pdfLibDoc.getPageCount();

              setPdfFiles((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  file,
                  arrayBuffer,
                  name: file.name,
                  size: file.size,
                  pageCount,
                  thumbnail: null,
                  pageThumbs: {},
                  selectedPages: new Set(
                    Array.from({ length: pageCount }, (_, i) => i + 1)
                  ),
                  warning:
                    'Preview unavailable — file may have minor issues but can still be merged',
                  error: null,
                  isEncrypted: false,
                },
              ]);
              continue;
            } catch {
              setError(
                `"${file.name}" could not be read. It may be severely corrupted.`
              );
              continue;
            }
          } else {
            throw err;
          }
        }

        const pageCount = pdfDoc.numPages;

        // Generate thumbnail from page 1
        let thumbnail = null;
        try {
          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          }).promise;
          thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        } catch {
          thumbnail = null;
        }

        // Generate per-page mini thumbnails (max 20)
        const pageThumbs = {};
        const pagesToRender = Math.min(pageCount, 20);
        for (let i = 1; i <= pagesToRender; i++) {
          try {
            const p = await pdfDoc.getPage(i);
            const vp = p.getViewport({ scale: 0.12 });
            const c = document.createElement('canvas');
            c.width = vp.width;
            c.height = vp.height;
            await p.render({
              canvasContext: c.getContext('2d'),
              viewport: vp,
            }).promise;
            pageThumbs[i] = c.toDataURL('image/jpeg', 0.5);
          } catch {
            pageThumbs[i] = null;
          }
        }

        setPdfFiles((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            arrayBuffer,
            name: file.name,
            size: file.size,
            pageCount,
            thumbnail,
            pageThumbs,
            selectedPages: new Set(
              Array.from({ length: pageCount }, (_, i) => i + 1)
            ),
            isEncrypted,
            warning: isEncrypted ? 'Opened with empty password' : null,
            error: null,
          },
        ]);
      } catch (outerErr) {
        console.error('File processing error:', outerErr);
        setError(`Could not process "${file.name}": ${outerErr.message}`);
      }
    }
  }, []);

  /* ── page selection helpers ─────────────────────────────── */
  const togglePage = (fileId, pageNum) => {
    setPdfFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const s = new Set(f.selectedPages);
        s.has(pageNum) ? s.delete(pageNum) : s.add(pageNum);
        return { ...f, selectedPages: s };
      })
    );
  };

  const toggleAllPages = (fileId) => {
    setPdfFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const allSelected = f.selectedPages.size === f.pageCount;
        return {
          ...f,
          selectedPages: allSelected
            ? new Set()
            : new Set(Array.from({ length: f.pageCount }, (_, i) => i + 1)),
        };
      })
    );
  };

  /* ── drag-to-reorder ────────────────────────────────────── */
  const handleDragStart = (idx) => setDragIndex(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (idx !== dragIndex) setDropTarget(idx);
  };
  const handleCardDrop = (idx) => {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null);
      setDropTarget(null);
      return;
    }
    setPdfFiles((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIndex(null);
    setDropTarget(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTarget(null);
  };

  /* ── remove file ────────────────────────────────────────── */
  const removeFile = (id) =>
    setPdfFiles((prev) => prev.filter((f) => f.id !== id));

  /* ── merge ──────────────────────────────────────────────── */
  const handleMerge = async () => {
    const mergeableFiles = pdfFiles.filter(
      (f) => !f.error && f.selectedPages.size > 0
    );
    if (mergeableFiles.length < 2) {
      setError('Need at least 2 valid PDFs with pages selected to merge.');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      const totalPages = mergeableFiles.reduce(
        (sum, f) => sum + f.selectedPages.size,
        0
      );
      let processedPages = 0;

      for (const pdfFile of mergeableFiles) {
        const srcDoc = await PDFDocument.load(pdfFile.arrayBuffer);
        const selectedPageIndices = Array.from(pdfFile.selectedPages)
          .sort((a, b) => a - b)
          .map((n) => n - 1);

        const copiedPages = await mergedPdf.copyPages(srcDoc, selectedPageIndices);
        copiedPages.forEach((page) => mergedPdf.addPage(page));

        processedPages += selectedPageIndices.length;
        setProgress(Math.round((processedPages / totalPages) * 90));
      }

      const mergedBytes = await mergedPdf.save();
      setProgress(100);

      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      setMergedPdfBlob(blob);
      setIsSuccess(true);
    } catch (err) {
      setError(`Merge failed: ${err.message}. Try with smaller files.`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── download ───────────────────────────────────────────── */
  const handleDownload = () => {
    if (!mergedPdfBlob) return;
    const url = URL.createObjectURL(mergedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── reset ──────────────────────────────────────────────── */
  const handleMergeAnother = () => {
    setIsSuccess(false);
    setMergedPdfBlob(null);
    setPdfFiles([]);
    setProgress(0);
    setError(null);
  };

  /* ── drop zone file handler ─────────────────────────────── */
  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  /* ── computed ───────────────────────────────────────────── */
  const totalSelectedPages = pdfFiles.reduce(
    (s, f) => s + f.selectedPages.size,
    0
  );
  const estimatedSize = pdfFiles.reduce((s, f) => {
    if (f.pageCount === 0) return s;
    return s + (f.selectedPages.size / f.pageCount) * f.size;
  }, 0);
  const mergeableCount = pdfFiles.filter(
    (f) => !f.error && f.selectedPages.size > 0
  ).length;
  const canMerge = mergeableCount >= 2 && totalSelectedPages > 0 && !processing;

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: 'hidden',
        padding: '32px 16px 120px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* ── ZONE 1 — Header ─────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.92)',
              fontWeight: 700,
              color: '#3730A3',
              textDecoration: 'none',
              boxShadow:
                '0 6px 0px rgba(55,48,163,0.25), 0 16px 40px rgba(60,100,220,0.22), inset 0 -5px 12px rgba(100,130,220,0.18), inset 0 5px 12px rgba(255,255,255,0.98)',
              transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              marginBottom: 24,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = 'translateY(-4px)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = 'translateY(0px)')
            }
          >
            <ArrowLeft size={18} /> Back to Home
          </Link>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              color: 'white',
              marginBottom: 10,
              lineHeight: 1.1,
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
              letterSpacing: '-0.02em',
            }}
          >
            Merge PDF Files
          </h1>
        </div>

        {/* ── ZONE 2 — Upload Drop Zone ───────────────────── */}
        {!isSuccess && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropZoneDrop}
            style={{
              background: isDragOver
                ? 'linear-gradient(160deg, #93C5FD 0%, #60A5FA 100%)'
                : 'linear-gradient(160deg, #DBEAFE 0%, #BFDBFE 100%)',
              borderRadius: 32,
              minHeight: 240,
              boxShadow: isDragOver
                ? '0 10px 0px rgba(29,78,216,0.55), 0 30px 90px rgba(29,100,230,0.5), inset 0 -14px 32px rgba(37,99,235,0.4), inset 0 14px 32px rgba(255,255,255,0.95)'
                : '0 8px 0px rgba(29,78,216,0.45), 0 24px 70px rgba(29,100,230,0.38), inset 0 -12px 28px rgba(37,99,235,0.32), inset 0 12px 28px rgba(255,255,255,0.92)',
              border: isDragOver ? '3px dashed #2563EB' : '3px dashed transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '48px 24px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              transform: isDragOver ? 'scale(1.02) translateY(-4px)' : 'scale(1)',
              marginBottom: 32,
              position: 'relative',
            }}
          >
            {/* upload icon box — big and dramatic */}
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 24,
                background: 'rgba(255,255,255,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  '0 8px 0px rgba(29,78,216,0.35), 0 20px 50px rgba(29,100,230,0.35), inset 0 -8px 20px rgba(37,99,235,0.22), inset 0 8px 20px rgba(255,255,255,1)',
                marginBottom: 4,
              }}
            >
              <Upload size={38} color="#1D4ED8" strokeWidth={2.5} />
            </div>
            <h3
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: '#1e3a5f',
                letterSpacing: '-0.01em',
              }}
            >
              Drop PDFs here
            </h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 500 }}>
              or click anywhere in this box to browse files
            </p>
            {/* sub-badge */}
            <div
              style={{
                padding: '6px 18px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.7)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#3B82F6',
                boxShadow:
                  'inset 0 -2px 6px rgba(59,130,246,0.1), inset 0 2px 6px rgba(255,255,255,0.8)',
              }}
            >
              PDF files only • Multiple files supported
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              hidden
              onChange={(e) => {
                handleFilesAdded(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* ── ZONE 3 — Uploaded Files Panel ────────────────── */}
        {pdfFiles.length > 0 && !isSuccess && (
          <div style={{ marginBottom: 28 }}>
            {/* section header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: 2,
                    textShadow: '0 2px 10px rgba(0,0,0,0.15)',
                  }}
                >
                  Your PDFs ({pdfFiles.length} added)
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                  Drag to reorder • Select pages to include from each PDF
                </p>
              </div>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.92)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: '#3730A3',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow:
                    '0 5px 0px rgba(55,48,163,0.2), 0 12px 30px rgba(60,100,220,0.18), inset 0 -4px 10px rgba(100,130,220,0.15), inset 0 4px 10px rgba(255,255,255,0.98)',
                  transition:
                    'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onClick={() => addMoreInputRef.current?.click()}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateY(-3px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateY(0)')
                }
              >
                <Plus size={16} /> Add More
              </button>
              <input
                ref={addMoreInputRef}
                type="file"
                accept=".pdf"
                multiple
                hidden
                onChange={(e) => {
                  handleFilesAdded(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* file card list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pdfFiles.map((pdf, idx) => {
                const color = cardColors[idx % cardColors.length];
                return (
                  <div
                    key={pdf.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleCardDrop(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      borderRadius: 28,
                      padding: '20px 24px',
                      background: color.bg,
                      boxShadow: color.shadow,
                      borderLeft: `5px solid ${color.accent}`,
                      opacity: dragIndex === idx ? 0.4 : 1,
                      transform:
                        dragIndex === idx ? 'scale(0.98)' : 'scale(1)',
                      transition:
                        'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
                      outline:
                        dropTarget === idx && dragIndex !== idx
                          ? '2px dashed #60A5FA'
                          : 'none',
                      outlineOffset: dropTarget === idx ? -2 : 0,
                      overflow: 'visible',
                    }}
                  >
                    {/* top row — thumbnail + info + controls */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        marginBottom: pdf.error ? 0 : 14,
                      }}
                    >
                      {/* thumbnail */}
                      {pdf.thumbnail ? (
                        <img
                          src={pdf.thumbnail}
                          alt={pdf.name}
                          style={{
                            width: 56,
                            height: 72,
                            objectFit: 'cover',
                            borderRadius: 10,
                            flexShrink: 0,
                            boxShadow:
                              '0 4px 0px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.1)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 56,
                            height: 72,
                            borderRadius: 10,
                            background: '#E2E8F0',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            boxShadow:
                              '0 4px 0px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.06)',
                          }}
                        >
                          📄
                        </div>
                      )}

                      {/* file info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontWeight: 700,
                            color: '#1e293b',
                            fontSize: '0.95rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {pdf.name}
                        </p>
                        <p
                          style={{
                            fontSize: '0.78rem',
                            color: '#64748b',
                            marginTop: 2,
                          }}
                        >
                          {formatSize(pdf.size)}
                          {pdf.pageCount > 0 &&
                            ` • ${pdf.pageCount} page${pdf.pageCount !== 1 ? 's' : ''}`}
                        </p>

                        {/* position pill */}
                        <div
                          style={{
                            display: 'inline-block',
                            marginTop: 6,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.75)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#475569',
                            boxShadow:
                              'inset 0 -2px 6px rgba(0,0,0,0.06), inset 0 2px 6px rgba(255,255,255,0.8)',
                          }}
                        >
                          File {idx + 1} of {pdfFiles.length}
                        </div>

                        {/* warning badge */}
                        {pdf.warning && (
                          <p
                            style={{
                              fontSize: '0.72rem',
                              color: '#92400e',
                              marginTop: 4,
                              fontWeight: 500,
                            }}
                          >
                            ⚠️ {pdf.warning}
                          </p>
                        )}
                      </div>

                      {/* controls */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            cursor: 'grab',
                            color: '#94a3b8',
                            padding: 4,
                          }}
                          title="Drag to reorder"
                        >
                          <GripVertical size={20} />
                        </div>
                        <button
                          onClick={() => removeFile(pdf.id)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            background: 'rgba(255,255,255,0.85)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ef4444',
                            boxShadow:
                              '0 3px 0px rgba(0,0,0,0.1), inset 0 -2px 6px rgba(0,0,0,0.06), inset 0 2px 6px rgba(255,255,255,0.9)',
                            transition:
                              'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                          }}
                          title="Remove file"
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.transform = 'scale(1.1)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.transform = 'scale(1)')
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* page selector or error */}
                    {pdf.error ? (
                      <div
                        style={{
                          padding: '8px 16px',
                          borderRadius: 12,
                          background: '#FEE2E2',
                          color: '#991B1B',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          marginTop: 10,
                        }}
                      >
                        ⚠️ {pdf.error} — this file will be skipped
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            Pages to include:
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{ fontSize: '0.72rem', color: '#94a3b8' }}
                            >
                              {pdf.selectedPages.size} of {pdf.pageCount}{' '}
                              selected
                            </span>
                            <button
                              onClick={() => toggleAllPages(pdf.id)}
                              style={{
                                fontSize: '0.72rem',
                                color: '#3b82f6',
                                fontWeight: 600,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {pdf.selectedPages.size === pdf.pageCount
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                          </div>
                        </div>

                        {/* page chips */}
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            overflowX: 'auto',
                            paddingBottom: 4,
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                          }}
                        >
                          {Array.from(
                            { length: Math.min(pdf.pageCount, 20) },
                            (_, i) => i + 1
                          ).map((pageNum) => {
                            const selected = pdf.selectedPages.has(pageNum);
                            return (
                              <button
                                key={pageNum}
                                onClick={() => togglePage(pdf.id, pageNum)}
                                style={{
                                  flexShrink: 0,
                                  width: 48,
                                  height: 60,
                                  borderRadius: 12,
                                  border: selected
                                    ? '2px solid #60A5FA'
                                    : '2px solid #e2e8f0',
                                  background: selected ? '#EFF6FF' : '#fff',
                                  opacity: selected ? 1 : 0.5,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 2,
                                  cursor: 'pointer',
                                  position: 'relative',
                                  transition: 'all 0.15s ease',
                                  overflow: 'hidden',
                                  padding: 0,
                                  boxShadow: selected
                                    ? '0 3px 0px rgba(59,130,246,0.2), inset 0 -3px 8px rgba(59,130,246,0.1), inset 0 3px 8px rgba(255,255,255,0.8)'
                                    : 'none',
                                }}
                              >
                                {pdf.pageThumbs[pageNum] ? (
                                  <img
                                    src={pdf.pageThumbs[pageNum]}
                                    alt={`Page ${pageNum}`}
                                    style={{
                                      width: '100%',
                                      height: 40,
                                      objectFit: 'cover',
                                      borderRadius: '10px 10px 0 0',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: 40,
                                      background: '#f1f5f9',
                                      borderRadius: '10px 10px 0 0',
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 600,
                                    color: selected ? '#2563eb' : '#94a3b8',
                                  }}
                                >
                                  {pageNum}
                                </span>
                                {selected && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: 2,
                                      right: 2,
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      background: '#3b82f6',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.45rem',
                                      color: 'white',
                                    }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {pdf.pageCount > 20 && (
                            <div
                              style={{
                                flexShrink: 0,
                                width: 48,
                                height: 60,
                                borderRadius: 12,
                                border: '2px dashed #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                color: '#94a3b8',
                              }}
                            >
                              +{pdf.pageCount - 20}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error State ──────────────────────────────────── */}
        {error && (
          <div
            style={{
              borderRadius: 24,
              padding: '20px 24px',
              background: '#FEE2E2',
              boxShadow:
                '0 6px 0px rgba(185,28,28,0.3), 0 16px 40px rgba(220,38,38,0.25), inset 0 -6px 16px rgba(220,38,38,0.2), inset 0 6px 16px rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontWeight: 700,
                  color: '#991b1b',
                  fontSize: '0.9rem',
                }}
              >
                Something went wrong
              </p>
              <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                padding: '6px 14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.8)',
                border: 'none',
                fontSize: '0.78rem',
                cursor: 'pointer',
                color: '#475569',
                fontWeight: 600,
                boxShadow:
                  '0 3px 0px rgba(0,0,0,0.08), inset 0 -2px 6px rgba(0,0,0,0.04), inset 0 2px 6px rgba(255,255,255,0.9)',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Success State ────────────────────────────────── */}
        {isSuccess && (
          <div
            style={{
              borderRadius: 32,
              padding: '28px 32px',
              background: 'linear-gradient(145deg, #D1FAE5 0%, #A7F3D0 50%, #86EFAC 100%)',
              boxShadow:
                '0 12px 0px rgba(21,128,61,0.4), 0 36px 90px rgba(22,163,74,0.4), inset 0 -14px 32px rgba(22,163,74,0.3), inset 0 14px 32px rgba(255,255,255,0.95)',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            {/* success icon with glow ring */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4ADE80, #22C55E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: '1.8rem',
                boxShadow:
                  '0 6px 0px rgba(21,128,61,0.45), 0 16px 40px rgba(22,163,74,0.4), inset 0 -8px 18px rgba(21,128,61,0.35), inset 0 8px 18px rgba(187,247,208,0.7), 0 0 30px rgba(74,222,128,0.3)',
              }}
            >
              ✅
            </div>
            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: '#14532D',
                marginBottom: 4,
                letterSpacing: '-0.01em',
              }}
            >
              Merge Complete!
            </h3>
            <p style={{ color: '#166534', fontSize: '0.88rem', fontWeight: 500, marginBottom: 18 }}>
              {totalSelectedPages} pages merged from {pdfFiles.length} PDFs
            </p>

            {/* download button — big and chunky */}
            <button
              onClick={handleDownload}
              style={{
                padding: '14px 44px',
                borderRadius: 22,
                border: 'none',
                background:
                  'linear-gradient(160deg, #22C55E 0%, #16A34A 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.05rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                boxShadow:
                  '0 8px 0px rgba(21,128,61,0.55), 0 20px 50px rgba(22,163,74,0.45), inset 0 -8px 18px rgba(21,128,61,0.35), inset 0 8px 18px rgba(200,255,210,0.45)',
                transition:
                  'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform =
                  'translateY(-5px) scale(1.02)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform =
                  'translateY(0) scale(1)')
              }
            >
              <Download size={20} /> Download Merged PDF
            </button>

            {/* secondary actions — clay pills */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handleMergeAnother}
                style={{
                  padding: '11px 26px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.9)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  color: '#166534',
                  boxShadow:
                    '0 5px 0px rgba(21,128,61,0.2), 0 12px 30px rgba(22,163,74,0.18), inset 0 -4px 10px rgba(22,163,74,0.12), inset 0 4px 10px rgba(255,255,255,0.95)',
                  transition:
                    'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateY(-4px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateY(0)')
                }
              >
                Merge More PDFs
              </button>
              <Link
                to="/"
                style={{
                  padding: '11px 26px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.9)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  color: '#166534',
                  boxShadow:
                    '0 5px 0px rgba(21,128,61,0.2), 0 12px 30px rgba(22,163,74,0.18), inset 0 -4px 10px rgba(22,163,74,0.12), inset 0 4px 10px rgba(255,255,255,0.95)',
                  transition:
                    'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateY(-4px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateY(0)')
                }
              >
                Back to Tools
              </Link>
            </div>
          </div>
        )}

        {/* ── ZONE 4 — Merge Action Bar ────────────────────── */}
        {pdfFiles.length >= 2 && !isSuccess && (
          <div
            style={{
              position: 'sticky',
              bottom: 24,
              zIndex: 40,
              borderRadius: 32,
              padding: '20px 28px',
              background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
              boxShadow:
                '0 10px 0px rgba(29,78,216,0.3), 0 30px 80px rgba(60,100,220,0.35), inset 0 -12px 28px rgba(37,99,235,0.22), inset 0 12px 28px rgba(255,255,255,0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              flexWrap: 'wrap',
              overflow: 'visible',
              marginTop: 24,
              maxWidth: 720,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {/* summary pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                `📄 ${pdfFiles.length} PDFs`,
                `📋 ${totalSelectedPages} pages`,
                `📁 ~${formatSize(estimatedSize)}`,
              ].map((label, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    padding: '5px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.8)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#475569',
                    boxShadow:
                      'inset 0 -2px 6px rgba(0,0,0,0.05), inset 0 2px 6px rgba(255,255,255,0.8)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleMergeAnother}
                style={{
                  padding: '10px 18px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.85)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  color: '#475569',
                  boxShadow:
                    '0 4px 0px rgba(0,0,0,0.08), inset 0 -3px 8px rgba(0,0,0,0.04), inset 0 3px 8px rgba(255,255,255,0.9)',
                  transition:
                    'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'translateY(-3px)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'translateY(0)')
                }
              >
                Clear All
              </button>
              <button
                onClick={handleMerge}
                disabled={!canMerge}
                style={{
                  padding: '16px 40px',
                  borderRadius: 20,
                  border: 'none',
                  background: processing
                    ? '#94A3B8'
                    : 'linear-gradient(160deg, #6366F1 0%, #4F46E5 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  cursor: canMerge ? 'pointer' : 'not-allowed',
                  boxShadow: processing
                    ? 'none'
                    : '0 6px 0px rgba(55,48,163,0.6), 0 16px 40px rgba(79,70,229,0.5), inset 0 -6px 14px rgba(55,48,163,0.4), inset 0 6px 14px rgba(200,210,255,0.35)',
                  transition:
                    'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease',
                  opacity: canMerge ? 1 : 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (canMerge)
                    e.currentTarget.style.transform =
                      'translateY(-5px) scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
              >
                {processing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />{' '}
                    Merging... {progress}%
                  </>
                ) : (
                  <>Merge {pdfFiles.length} PDFs</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Processing Overlay ──────────────────────────────── */}
      {processing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(30, 58, 138, 0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              borderRadius: 32,
              padding: 40,
              textAlign: 'center',
              maxWidth: 360,
              margin: '0 16px',
              background: 'linear-gradient(145deg, #EFF6FF, #DBEAFE)',
              boxShadow:
                '0 10px 0px rgba(29,78,216,0.3), 0 30px 80px rgba(60,100,220,0.4), inset 0 -12px 28px rgba(37,99,235,0.25), inset 0 12px 28px rgba(255,255,255,0.95)',
            }}
          >
            {/* animated icon */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '2rem',
                boxShadow:
                  '0 6px 0px rgba(29,78,216,0.3), 0 16px 40px rgba(29,100,230,0.3), inset 0 -8px 18px rgba(37,99,235,0.25), inset 0 8px 18px rgba(255,255,255,0.8)',
                animation: 'bounce 1s infinite',
              }}
            >
              ⚡
            </div>
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: '#1e293b',
                marginBottom: 6,
              }}
            >
              Merging PDFs
            </h3>
            <p
              style={{
                color: '#64748b',
                fontSize: '0.85rem',
                marginBottom: 24,
              }}
            >
              Running locally in your browser...
            </p>
            {/* progress bar */}
            <div
              style={{
                width: '100%',
                background: '#DBEAFE',
                borderRadius: 999,
                height: 12,
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 6px rgba(60,100,220,0.2)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: '#2563eb',
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {progress}%
            </p>
          </div>
        </div>
      )}

      {/* bounce keyframes (inline style fallback) */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}