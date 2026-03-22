import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, ArrowLeft, Plus, Trash2, Download, GripVertical, Zap } from 'lucide-react';
import { HeroDitheringCard } from '../components/ui/hero-dithering-card';
import { UploadCard } from '../components/ui/upload-ui';
import { DownloadButton } from '../components/ui/download-animation';
import MotionButton from '../components/ui/motion-button';
import { saveBlobToDisk } from '../utils/saveBlobToDisk';
import { useWorker } from '../hooks/useWorker';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/* ────────────────────────────────────────────────────────────────
   Helper: human-readable file size
   ──────────────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ────────────────────────────────────────────────────────────────
   Card styles (Dark theme) 
   ──────────────────────────────────────────────────────────────── */


/* ════════════════════════════════════════════════════════════════
   MERGE PDF PAGE
   ════════════════════════════════════════════════════════════════ */
export default function MergePDF() {
  /* ── state ──────────────────────────────────────────────── */
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [error, setError] = useState(null);
  const [mergedPdfBlob, setMergedPdfBlob] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const addMoreInputRef = useRef(null);

  // Web Worker for off-main-thread merging
  const { run: runWorker, progress, running: processing, cancel: cancelWorker } = useWorker('pdf');

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

  /* ── merge (runs in Web Worker) ─────────────────────────── */
  const handleMerge = async () => {
    const mergeableFiles = pdfFiles.filter(
      (f) => !f.error && f.selectedPages.size > 0
    );
    if (mergeableFiles.length < 2) {
      setError('Need at least 2 valid PDFs with pages selected to merge.');
      return;
    }

    setError(null);

    try {
      // Prepare data for the worker — copy ArrayBuffers so originals stay intact
      const files = mergeableFiles.map((f) => ({
        buffer: f.arrayBuffer.slice(0),
        selectedPageIndices: Array.from(f.selectedPages)
          .sort((a, b) => a - b)
          .map((n) => n - 1),
      }));

      // Collect transferables (the copied buffers)
      const transferables = files.map((f) => f.buffer);

      const result = await runWorker('merge', { files }, transferables);

      const blob = new Blob([result.data], { type: 'application/pdf' });
      setMergedPdfBlob(blob);
      setIsSuccess(true);
    } catch (err) {
      setError(`Merge failed: ${err.message}. Try with smaller files.`);
    }
  };

  /* ── download ───────────────────────────────────────────── */
  const handleDownload = async () => {
    if (!mergedPdfBlob) return false;
    return saveBlobToDisk(mergedPdfBlob, `merged-${Date.now()}.pdf`);
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
              padding: '10px 20px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.06)',
              fontWeight: 600,
              color: '#E4E4E7',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s ease',
              marginBottom: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = '#E4E4E7';
            }}
          >
            <ArrowLeft size={18} /> Back to Home
          </Link>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              color: 'white',
              marginBottom: 10,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Merge PDF Files
          </h1>
        </div>

        {/* ── ZONE 2 — Upload Drop Zone ───────────────────── */}
        {!isSuccess && (
          <div onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} style={{ marginBottom: 20 }}>
            <UploadCard
              status="idle"
              title={isDragOver ? "Drop PDFs here!" : "Drop PDFs to merge"}
              description="or click to browse • Multiple files supported"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDropZoneDrop}
            />
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
                  }}
                >
                  Your PDFs ({pdfFiles.length} added)
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#A1A1AA' }}>
                  Drag to reorder • Select pages to include from each PDF
                </p>
              </div>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.06)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: '#E4E4E7',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => addMoreInputRef.current?.click()}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = '#E4E4E7';
                }}
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
                return (
                  <div
                    key={pdf.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleCardDrop(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      borderRadius: 14,
                      padding: '24px',
                      backgroundColor: '#1C1D21',
                      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                      opacity: dragIndex === idx ? 0.4 : 1,
                      transform: dragIndex === idx ? 'scale(0.98)' : 'scale(1)',
                      transition: 'transform 0.25s ease, opacity 0.2s ease',
                      outline: dropTarget === idx && dragIndex !== idx ? '2px dashed #818CF8' : 'none',
                      outlineOffset: dropTarget === idx ? -2 : 0,
                      overflow: 'visible',
                      position: 'relative'
                    }}
                  >
                    {/* Subtle top right glow */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at 100% 0%, rgba(99,102,241,0.1) 0%, transparent 65%)',
                      pointerEvents: 'none',
                      borderRadius: 14
                    }} />
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
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                          }}
                        >
                          📄
                        </div>
                      )}

                      {/* file info */}
                      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 10 }}>
                        <p
                          style={{
                            fontWeight: 700,
                            color: 'white',
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
                            color: '#A1A1AA',
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
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#E4E4E7',
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
                            color: '#52525B',
                            padding: 4,
                            position: 'relative',
                            zIndex: 10
                          }}
                          title="Drag to reorder"
                        >
                          <GripVertical size={20} />
                        </div>
                        <button
                          onClick={() => removeFile(pdf.id)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'transparent',
                            border: '1px solid rgba(239,68,68,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#EF4444',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            zIndex: 10
                          }}
                          title="Remove file"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            e.currentTarget.style.color = '#F87171';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#EF4444';
                          }}
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
                              color: '#A1A1AA',
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
                              style={{ fontSize: '0.72rem', color: '#A1A1AA' }}
                            >
                              {pdf.selectedPages.size} of {pdf.pageCount}{' '}
                              selected
                            </span>
                            <button
                              onClick={() => toggleAllPages(pdf.id)}
                              style={{
                                fontSize: '0.72rem',
                                color: '#818CF8',
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
                                    ? '1px solid #818CF8'
                                    : '1px solid rgba(255,255,255,0.08)',
                                  background: selected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                                  opacity: selected ? 1 : 0.4,
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
                                      borderRadius: '11px 11px 0 0',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: 40,
                                      background: 'rgba(255,255,255,0.05)',
                                      borderRadius: '11px 11px 0 0',
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 600,
                                    color: selected ? '#A5B4FC' : '#71717A',
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
                                      background: '#818CF8',
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
                                border: '1px dashed rgba(255,255,255,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: '#A1A1AA',
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
              borderRadius: 14,
              padding: '20px 24px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
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
                  color: '#F87171',
                  fontSize: '0.9rem',
                }}
              >
                Something went wrong
              </p>
              <p style={{ fontSize: '0.8rem', color: '#FCA5A5' }}>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                color: '#E4E4E7',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = '#E4E4E7';
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Success State ────────────────────────────────── */}
        {isSuccess && (
          <HeroDitheringCard
            accentColor="#6366f1"
            minHeight={420}
            style={{ marginBottom: 20 }}
          >
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'white',
                marginBottom: 6,
                letterSpacing: '-0.02em',
                textAlign: 'center',
              }}
            >
              Merge Complete!
            </h3>
            <p style={{ color: '#A1A1AA', fontSize: '0.9rem', fontWeight: 500, marginBottom: 28, textAlign: 'center' }}>
              {totalSelectedPages} pages merged from {pdfFiles.length} PDFs
            </p>

            <DownloadButton
              onDownload={handleDownload}
              label="Download Merged PDF"
              disabled={!mergedPdfBlob}
            />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <button
                onClick={handleMergeAnother}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  color: '#E4E4E7',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = '#E4E4E7';
                }}
              >
                Merge More PDFs
              </button>
              <Link
                to="/"
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  color: '#E4E4E7',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = '#E4E4E7';
                }}
              >
                Back to Tools
              </Link>
            </div>
          </HeroDitheringCard>
        )}

        {/* ── ZONE 4 — Merge Action Bar ────────────────────── */}
        {pdfFiles.length >= 2 && !isSuccess && (
          <div
            style={{
              position: 'sticky',
              bottom: 24,
              zIndex: 40,
              borderRadius: 24,
              padding: '16px 20px',
              backgroundColor: '#18181B',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginTop: 24,
              marginBottom: 40,
              maxWidth: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {/* action buttons */}
            <div style={{ display: 'contents' }}>
              <button
                onClick={handleMergeAnother}
                style={{
                  padding: '12px 24px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: '#A1A1AA',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#A1A1AA';
                }}
              >
                Clear All
              </button>
              <MotionButton
                type="button"
                onClick={handleMerge}
                disabled={!canMerge || processing}
                loading={processing}
                label={
                  processing
                    ? `Merging… ${progress}%`
                    : `Merge ${pdfFiles.length} PDFs`
                }
                classes="shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Processing Overlay ──────────────────────────────── */}
      {/* Always in DOM; opacity-fade prevents the compositing-layer flicker that mount/unmount causes */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: processing ? 'blur(8px)' : 'none',
          opacity: processing ? 1 : 0,
          pointerEvents: processing ? 'auto' : 'none',
          transition: 'opacity 0.18s ease',
          willChange: 'opacity',
        }}
      >
          <div
            style={{
              borderRadius: 20,
              padding: '40px 32px',
              textAlign: 'center',
              width: '100%',
              maxWidth: 360,
              margin: '0 16px',
              background: '#1C1D21',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* subtle glow */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
            
            <div style={{ position: 'relative', zIndex: 10 }}>
              {/* animated icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  animation: 'bounce 1s infinite',
                }}
              >
                <Zap size={28} strokeWidth={1.8} color="#818cf8" fill="rgba(99,102,241,0.3)" />
              </div>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'white',
                  marginBottom: 6,
                }}
              >
                Merging PDFs
              </h3>
              <p
                style={{
                  color: '#A1A1AA',
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
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  height: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #4338CA, #60A5FA)',
                    borderRadius: 999,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#60A5FA',
                  fontWeight: 600,
                  marginTop: 10,
                }}
              >
                {progress}%
              </p>
            </div>
          </div>
        </div>

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