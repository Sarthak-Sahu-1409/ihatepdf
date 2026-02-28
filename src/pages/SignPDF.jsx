import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, Download, Loader2, Plus } from 'lucide-react';
import SignaturePad from '../components/features/SignaturePad';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const fmt = (b) => b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB';

const FONTS = {
  dancing: { name:'Elegant',  family:"'Dancing Script',cursive", url:'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap' },
  pacifico:{ name:'Casual',   family:"'Pacifico',cursive",       url:'https://fonts.googleapis.com/css2?family=Pacifico&display=swap' },
  satisfy: { name:'Flowing',  family:"'Satisfy',cursive",        url:'https://fonts.googleapis.com/css2?family=Satisfy&display=swap' },
  pinyon:  { name:'Formal',   family:"'Pinyon Script',cursive",  url:'https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap' },
};
const COLORS = ['#1E293B','#1E3A8A','#166534','#7C2D12'];

const CS  = '0 6px 0px rgba(161,98,7,0.38), 0 18px 48px rgba(202,138,4,0.3), inset 0 -8px 20px rgba(202,138,4,0.24), inset 0 8px 20px rgba(255,255,255,0.92)';
const SS  = '0 4px 0px rgba(161,98,7,0.28), 0 10px 26px rgba(202,138,4,0.2), inset 0 -4px 10px rgba(202,138,4,0.15), inset 0 4px 10px rgba(255,255,255,0.9)';
const BS  = '0 5px 0px rgba(161,98,7,0.55), 0 14px 36px rgba(202,138,4,0.45), inset 0 -5px 12px rgba(161,98,7,0.35), inset 0 5px 12px rgba(254,240,138,0.4)';
const spl = { padding:'5px 12px', borderRadius:'10px', background:'rgba(255,255,255,0.75)', fontSize:'0.8rem', fontWeight:600, color:'#422006', boxShadow:'inset 0 2px 6px rgba(255,255,255,0.8)', display:'inline-flex', alignItems:'center', gap:'4px' };

export default function SignPDF() {
  /* file */
  const [pdfFile, setPdfFile]       = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageCount, setPageCount]   = useState(0);
  const [pdfThumb, setPdfThumb]     = useState(null);
  const pdfDocRef = useRef(null);
  const fileInputRef = useRef(null);

  /* signature creator */
  const [sigMode, setSigMode]       = useState('draw');
  const [sigDataUrl, setSigDataUrl] = useState(null);   // current sig being positioned
  const [drawnSig, setDrawnSig]     = useState(null);
  const [penColor, setPenColor]     = useState('#1E293B');
  const [typedName, setTypedName]   = useState('');
  const [selFont, setSelFont]       = useState('dancing');
  const [uploadPreview, setUploadPreview] = useState(null);
  const sigUploadRef = useRef(null);

  /* placement of the CURRENT (active) signature */
  const [sigPage, setSigPage]       = useState(1);
  const [sigPos, setSigPos]         = useState({ x: 30, y: 60 });
  const [sigSize, setSigSize]       = useState(25);
  const [sigOpacity, setSigOpacity] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOff, setDragOff]       = useState({ x:0, y:0 });

  /* ★ list of placed signatures (what gets embedded) */
  const [placed, setPlaced] = useState([]); // [{id, sigDataUrl, page, pos, size, opacity}]

  /* preview canvas */
  const pageCanvasRef  = useRef(null);
  const previewContRef = useRef(null);

  /* processing */
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState(0);
  const [error, setError]           = useState(null);
  const [isSuccess, setIsSuccess]   = useState(false);
  const [signedBlob, setSignedBlob] = useState(null);
  const [signedSize, setSignedSize] = useState(0);

  /* ── load PDF ─────────────────────────────────────────────── */
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

  /* ── render page preview ──────────────────────────────────── */
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

  /* Google Fonts */
  useEffect(() => {
    const id = `gfont-${selFont}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = FONTS[selFont].url;
      document.head.appendChild(link);
    }
  }, [selFont]);

  /* ── drag active sig on preview ─────────────────────────────  */
  const onSigMouseDown = (e) => {
    e.preventDefault(); setIsDragging(true);
    const r = e.currentTarget.getBoundingClientRect();
    setDragOff({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onPreviewMouseMove = useCallback((e) => {
    if (!isDragging || !previewContRef.current) return;
    const r = previewContRef.current.getBoundingClientRect();
    setSigPos({
      x: Math.max(0, Math.min(100 - sigSize, ((e.clientX - r.left - dragOff.x) / r.width) * 100)),
      y: Math.max(0, Math.min(92,            ((e.clientY - r.top  - dragOff.y) / r.height) * 100)),
    });
  }, [isDragging, dragOff, sigSize]);
  const onPreviewMouseUp = () => setIsDragging(false);

  /* ── also allow dragging placed sigs ───────────────────────── */
  const [activePlaced, setActivePlaced] = useState(null); // id of placed sig being dragged
  const [placedDragOff, setPlacedDragOff] = useState({ x:0, y:0 });

  const onPlacedMouseDown = (e, id) => {
    e.preventDefault(); e.stopPropagation();
    setActivePlaced(id);
    const r = e.currentTarget.getBoundingClientRect();
    setPlacedDragOff({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onPreviewMouseMoveAll = useCallback((e) => {
    // handle new sig drag
    if (isDragging && previewContRef.current) {
      const r = previewContRef.current.getBoundingClientRect();
      setSigPos({
        x: Math.max(0, Math.min(100 - sigSize, ((e.clientX - r.left - dragOff.x) / r.width) * 100)),
        y: Math.max(0, Math.min(92,            ((e.clientY - r.top  - dragOff.y) / r.height) * 100)),
      });
    }
    // handle placed sig drag
    if (activePlaced && previewContRef.current) {
      const r = previewContRef.current.getBoundingClientRect();
      const pl = placed.find(p => p.id === activePlaced);
      if (!pl) return;
      const nx = Math.max(0, Math.min(100 - pl.size, ((e.clientX - r.left - placedDragOff.x) / r.width) * 100));
      const ny = Math.max(0, Math.min(92,             ((e.clientY - r.top  - placedDragOff.y) / r.height) * 100));
      setPlaced(prev => prev.map(p => p.id === activePlaced ? { ...p, pos: { x: nx, y: ny } } : p));
    }
  }, [isDragging, dragOff, sigSize, activePlaced, placedDragOff, placed]);
  const onPreviewUpAll = () => { setIsDragging(false); setActivePlaced(null); };

  /* ── Generate typed signature ───────────────────────────────  */
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

  /* ★ Add current sig+placement to the placed list */
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
    // Reset placement state so user can add another
    setSigDataUrl(null);
    setSigPos({ x: 30, y: 60 });
    setSigSize(25);
    setSigOpacity(1.0);
  };

  /* ── PDF coordinate conversion ────────────────────────────── */
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

  /* ★ Apply ALL placed signatures */
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
      }

      const bytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      setSignedBlob(blob); setSignedSize(blob.size);
      setProgress(100); setIsSuccess(true);
    } catch (e) { setError(`Signing failed: ${e.message}`); }
    finally { setProcessing(false); }
  };

  const handleDownload = () => {
    if (!signedBlob) return;
    const url = URL.createObjectURL(signedBlob);
    const a = document.createElement('a');
    a.href = url; a.download = pdfFile.name.replace(/\.pdf$/i, '') + '-signed.pdf'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReset = () => {
    setPdfFile(null); setPdfThumb(null); setPageCount(0); setSigDataUrl(null);
    setDrawnSig(null); setUploadPreview(null); setIsSuccess(false); setError(null);
    setSignedBlob(null); setSignedSize(0); pdfDocRef.current = null; setProgress(0);
    setPlaced([]); setSigPos({ x:30, y:60 }); setSigSize(25); setSigOpacity(1.0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── helpers ─────────────────────────────────────────────────  */
  const ModeCard = ({ id, emoji, label }) => {
    const sel = sigMode === id;
    return (
      <div onClick={() => setSigMode(id)} style={{ borderRadius:16, padding:'10px 8px', textAlign:'center', cursor:'pointer', background: sel ? '#FDE047' : '#FEF08A', boxShadow: sel ? CS : SS, transform: sel ? 'translateY(-4px) scale(1.02)' : 'scale(1)', transition:'all 0.22s cubic-bezier(0.34,1.2,0.64,1)', position:'relative' }}>
        {sel && <div style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#A16207', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:900 }}>✓</div>}
        <div style={{ fontSize:'1.2rem', marginBottom:3 }}>{emoji}</div>
        <p style={{ fontWeight:800, color:'#422006', fontSize:'0.78rem', margin:0 }}>{label}</p>
      </div>
    );
  };

  const YBtn = ({ onClick, disabled, children, style: s = {} }) => (
    <button onClick={onClick} disabled={disabled} style={{ width:'100%', padding:'10px', borderRadius:14, border:'none', background: disabled ? 'linear-gradient(160deg,#94A3B8,#64748B)' : 'linear-gradient(160deg,#FACC15,#A16207)', color:'white', fontWeight:800, fontSize:'0.88rem', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: disabled ? 'none' : BS, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', ...s }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >{children}</button>
  );

  /* sigs on current page (already placed) */
  const placedOnPage = placed.filter(p => p.page === sigPage);

  /* ════════════════════════════════════════ RENDER */
  return (
    <div style={{ minHeight:'100vh', fontFamily:"'Inter',system-ui,sans-serif", padding:'32px 24px 140px', overflowX:'hidden' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>

        {/* HEADER */}
        <div style={{ marginBottom:28 }}>
          <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:14, marginBottom:24, background:'rgba(255,255,255,0.88)', color:'#3730A3', fontWeight:600, fontSize:'0.85rem', textDecoration:'none', boxShadow:'0 4px 0px rgba(55,48,163,0.2), 0 10px 28px rgba(60,100,220,0.18), inset 0 -3px 8px rgba(100,130,220,0.15), inset 0 3px 8px rgba(255,255,255,0.98)', transition:'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>← Back</Link>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:10 }}>
            <div style={{ width:52, height:52, borderRadius:16, flexShrink:0, background:'#FEF08A', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:SS }}><span style={{ fontSize:'1.5rem' }}>✍️</span></div>
            <div>
              <h1 style={{ fontSize:'1.75rem', fontWeight:900, color:'white', margin:0, textShadow:'0 2px 12px rgba(0,0,0,0.2)' }}>Sign PDF</h1>
              <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.875rem', margin:0 }}>Add your signature — place multiple on any page or across pages</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['🔒 Files never uploaded','✍️ Draw, type or upload','📌 Multiple signatures supported'].map((b,i) => (
              <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 14px', borderRadius:999, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'rgba(255,255,255,0.9)', fontSize:'0.78rem', fontWeight:600 }}>{b}</div>
            ))}
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div style={{ borderRadius:20, padding:'16px 20px', marginBottom:16, background:'#FEE2E2', boxShadow:'0 5px 0px rgba(185,28,28,0.28), 0 14px 36px rgba(220,38,38,0.22), inset 0 -6px 14px rgba(220,38,38,0.18), inset 0 6px 14px rgba(255,255,255,0.85)', display:'flex', alignItems:'flex-start', gap:12 }}>
            <span style={{ fontSize:'1.2rem' }}>⚠️</span>
            <p style={{ flex:1, fontWeight:700, color:'#991B1B', fontSize:'0.9rem', margin:0 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ padding:'5px 12px', borderRadius:10, border:'none', background:'rgba(255,255,255,0.7)', color:'#991B1B', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* SUCCESS */}
        {isSuccess && (
          <div style={{ borderRadius:32, padding:'36px 32px', background:'linear-gradient(145deg,#FEF9C3,#FEF08A)', boxShadow:'0 12px 0px rgba(161,98,7,0.4), 0 36px 90px rgba(202,138,4,0.42), inset 0 -14px 32px rgba(202,138,4,0.26), inset 0 14px 32px rgba(255,255,255,0.95)', marginBottom:16 }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ width:68, height:68, borderRadius:20, margin:'0 auto 12px', background:'#FEF08A', fontSize:'2rem', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:CS }}>✅</div>
              <h3 style={{ fontSize:'1.4rem', fontWeight:900, color:'#422006', margin:'0 0 4px' }}>PDF Signed!</h3>
              <p style={{ color:'#A16207', fontSize:'0.82rem', margin:0 }}>🔒 {placed.length} signature{placed.length !== 1 ? 's' : ''} embedded — signed entirely in your browser</p>
            </div>
            <div style={{ borderRadius:20, padding:'18px 20px', marginBottom:20, background:'rgba(255,255,255,0.6)', boxShadow:'inset 0 3px 10px rgba(255,255,255,0.7)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, textAlign:'center' }}>
                {[{ emoji:'📄', value:`${pageCount} pages`, label:'Document' },{ emoji:'✍️', value:`${placed.length} signatures`, label:'Embedded' },{ emoji:'📦', value:signedSize ? fmt(signedSize) : '—', label:'File size' }].map((s,i) => (
                  <div key={i}>
                    <p style={{ fontSize:'1.4rem', margin:'0 0 2px' }}>{s.emoji}</p>
                    <p style={{ fontWeight:900, color:'#422006', fontSize:'0.95rem', margin:'0 0 2px' }}>{s.value}</p>
                    <p style={{ fontSize:'0.7rem', color:'#A16207', margin:0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleDownload} style={{ width:'100%', padding:16, borderRadius:18, border:'none', background:'linear-gradient(160deg,#FACC15,#A16207)', color:'white', fontWeight:800, fontSize:'1.05rem', cursor:'pointer', marginBottom:10, boxShadow:BS, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-4px) scale(1.01)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0) scale(1)'}><Download size={20} /> Download Signed PDF</button>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleReset} style={{ flex:1, padding:11, borderRadius:14, border:'none', background:'rgba(255,255,255,0.7)', color:'#A16207', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', boxShadow:SS, transition:'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>✍️ Sign Another PDF</button>
              <Link to="/" style={{ flex:1, padding:11, borderRadius:14, background:'rgba(255,255,255,0.7)', color:'#3730A3', fontWeight:700, fontSize:'0.85rem', textDecoration:'none', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:SS, transition:'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>← Back to Tools</Link>
            </div>
          </div>
        )}

        {/* UPLOAD ZONE */}
        {!pdfFile && !isSuccess && (
          <div onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
            style={{ borderRadius:28, padding:'24px 28px', minHeight:140, background: isDragOver ? '#FDE047' : '#FEF08A', boxShadow: isDragOver ? '0 8px 0px rgba(161,98,7,0.55), 0 28px 70px rgba(202,138,4,0.5), inset 0 -12px 26px rgba(202,138,4,0.38), inset 0 12px 26px rgba(255,255,255,0.95)' : '0 7px 0px rgba(161,98,7,0.4), 0 20px 55px rgba(202,138,4,0.32), inset 0 -10px 22px rgba(202,138,4,0.26), inset 0 10px 22px rgba(255,255,255,0.9)', border: isDragOver ? '2px dashed #A16207' : '2px dashed rgba(250,204,21,0.7)', cursor:'pointer', transition:'all 0.25s cubic-bezier(0.34,1.2,0.64,1)', transform: isDragOver ? 'scale(1.015)' : 'scale(1)', display:'flex', alignItems:'center', gap:18, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:14, flexShrink:0, background:'rgba(255,255,255,0.85)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:SS }}><Upload size={22} color="#A16207" /></div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:800, fontSize:'1.05rem', color:'#422006', margin:'0 0 3px' }}>{isDragOver ? '📂 Drop your PDF here!' : 'Drop your PDF to sign'}</p>
              <p style={{ color:'#A16207', fontSize:'0.82rem', margin:0, fontWeight:500 }}>or click to browse • Single PDF file</p>
            </div>
            <div style={{ padding:'7px 14px', borderRadius:12, flexShrink:0, background:'rgba(255,255,255,0.65)', color:'#A16207', fontWeight:700, fontSize:'0.78rem', boxShadow:'inset 0 2px 6px rgba(255,255,255,0.8)', display:'flex', alignItems:'center', gap:4 }}><Upload size={13} /> Select File</div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files[0]) handleFileLoad(e.target.files[0]); e.target.value=''; }} />

        {/* WORKSPACE */}
        {pdfFile && !isSuccess && (
          <div style={{ display:'grid', gridTemplateColumns:'55% 45%', gap:16, marginBottom:16, alignItems:'start' }}>

            {/* LEFT — PDF preview */}
            <div>
              {/* File card */}
              <div style={{ borderRadius:20, padding:'14px 18px', marginBottom:12, background:'#FEF08A', boxShadow:CS, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:42, height:52, borderRadius:8, flexShrink:0, overflow:'hidden', background:'#FEF9C3', boxShadow:SS }}>
                  {pdfThumb ? <img src={pdfThumb} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>📄</div>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, color:'#422006', fontSize:'0.88rem', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pdfFile.name}</p>
                  <p style={{ color:'#A16207', fontSize:'0.75rem', margin:0, fontWeight:600 }}>{fmt(pdfFile.size)} · {pageCount} pages</p>
                </div>
                <button onClick={handleReset} style={{ width:30, height:30, borderRadius:8, border:'none', background:'#FEE2E2', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 0px rgba(185,28,28,0.25)' }}><X size={13} color="#DC2626" /></button>
              </div>

              {/* Page selector */}
              {pageCount > 1 && (
                <div style={{ borderRadius:18, padding:'12px 16px', marginBottom:12, background:'#FEF08A', boxShadow:SS, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#422006', flexShrink:0 }}>Page:</span>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1 }}>
                    {Array.from({ length: Math.min(pageCount, 10) }, (_, i) => i+1).map(n => {
                      const hasSig = placed.some(p => p.page === n);
                      return (
                        <div key={n} onClick={() => setSigPage(n)} style={{ width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:700, fontSize:'0.8rem', background: sigPage===n ? '#FDE047' : 'rgba(255,255,255,0.55)', color: sigPage===n ? '#422006' : '#A16207', boxShadow: sigPage===n ? SS : 'inset 0 2px 5px rgba(255,255,255,0.6)', transform: sigPage===n ? 'translateY(-2px)' : 'none', transition:'all 0.18s ease', position:'relative' }}>
                          {n}
                          {hasSig && <div style={{ position:'absolute', top:-3, right:-3, width:8, height:8, borderRadius:'50%', background:'#A16207' }} />}
                        </div>
                      );
                    })}
                    {pageCount > 10 && <span style={{ fontSize:'0.72rem', color:'#A16207', fontWeight:600, display:'flex', alignItems:'center' }}>+{pageCount-10} more</span>}
                  </div>
                </div>
              )}

              {/* Page preview canvas */}
              <div style={{ borderRadius:20, padding:12, background:'#FEF08A', boxShadow:CS, marginBottom:12 }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 10px' }}>
                  📄 Page {sigPage}
                  {(sigDataUrl || placedOnPage.length > 0) && <span style={{ color:'#A16207', fontWeight:500, textTransform:'none', fontSize:'0.7rem' }}> · drag to reposition</span>}
                </p>
                <div ref={previewContRef} style={{ position:'relative', borderRadius:12, overflow:'hidden', background:'white', boxShadow:'0 4px 0px rgba(0,0,0,0.12), 0 12px 32px rgba(0,0,0,0.18)', cursor: (sigDataUrl || placedOnPage.length > 0) ? 'crosshair' : 'default', userSelect:'none' }}
                  onMouseMove={onPreviewMouseMoveAll} onMouseUp={onPreviewUpAll} onMouseLeave={onPreviewUpAll}>
                  <canvas ref={pageCanvasRef} style={{ display:'block', width:'100%', height:'auto' }} />

                  {/* ★ All placed sigs on this page (draggable) */}
                  {placedOnPage.map(p => (
                    <div key={p.id} onMouseDown={e => onPlacedMouseDown(e, p.id)} style={{ position:'absolute', left:`${p.pos.x}%`, top:`${p.pos.y}%`, width:`${p.size}%`, cursor:'grab', userSelect:'none', filter:`opacity(${p.opacity})`, outline: activePlaced === p.id ? '2px solid #FACC15' : '2px dashed rgba(161,98,7,0.4)', borderRadius:4 }}>
                      <img src={p.sigDataUrl} draggable={false} style={{ width:'100%', display:'block', pointerEvents:'none' }} alt="sig" />
                      <button onMouseDown={e => e.stopPropagation()} onClick={() => setPlaced(prev => prev.filter(x => x.id !== p.id))} style={{ position:'absolute', top:-8, right:-8, width:18, height:18, borderRadius:'50%', border:'none', background:'#DC2626', color:'white', fontSize:'0.6rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'all' }}>✕</button>
                    </div>
                  ))}

                  {/* Active new sig being positioned */}
                  {sigDataUrl && (
                    <div onMouseDown={onSigMouseDown} style={{ position:'absolute', left:`${sigPos.x}%`, top:`${sigPos.y}%`, width:`${sigSize}%`, cursor:'grab', userSelect:'none', filter:`opacity(${sigOpacity})`, outline: isDragging ? '2px solid #FACC15' : '2px dashed #A16207', borderRadius:4 }}>
                      <img src={sigDataUrl} draggable={false} style={{ width:'100%', display:'block', pointerEvents:'none' }} alt="new signature" />
                      {!isDragging && <div style={{ position:'absolute', top:-20, left:'50%', transform:'translateX(-50%)', padding:'2px 8px', borderRadius:6, background:'rgba(161,98,7,0.85)', color:'white', fontSize:'0.6rem', fontWeight:700, whiteSpace:'nowrap' }}>⠿ drag to position</div>}
                    </div>
                  )}

                  {/* Empty state */}
                  {!sigDataUrl && placedOnPage.length === 0 && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(254,240,138,0.15)', pointerEvents:'none' }}>
                      <div style={{ padding:'12px 20px', borderRadius:14, background:'rgba(254,240,138,0.9)', border:'2px dashed rgba(161,98,7,0.4)', textAlign:'center' }}>
                        <p style={{ fontSize:'0.82rem', fontWeight:700, color:'#A16207', margin:0 }}>✍️ Create your signature →</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Size + Opacity sliders (for active sig) */}
              {sigDataUrl && (
                <div style={{ borderRadius:18, padding:'14px 16px', background:'#FEF08A', boxShadow:SS, marginBottom:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {[
                      { label:'Size', min:5, max:60, val:sigSize, set:setSigSize, suffix:'%', lo:'Small', hi:'Large' },
                      { label:'Opacity', min:20, max:100, val:Math.round(sigOpacity*100), set:v=>setSigOpacity(v/100), suffix:'%', lo:'Ghost', hi:'Solid' },
                    ].map(sl => (
                      <div key={sl.label}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <label style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006' }}>{sl.label}</label>
                          <span style={{ fontSize:'0.72rem', color:'#A16207', fontWeight:600 }}>{sl.val}{sl.suffix}</span>
                        </div>
                        <input type="range" min={sl.min} max={sl.max} value={sl.val} onChange={e => sl.set(Number(e.target.value))} style={{ width:'100%', accentColor:'#A16207', cursor:'pointer', height:4, borderRadius:999 }} />
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.6rem', color:'#CA8A04', marginTop:2 }}><span>{sl.lo}</span><span>{sl.hi}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ★ Placed signatures review list */}
              {placed.length > 0 && (
                <div style={{ borderRadius:18, padding:'14px 16px', background:'#FEF08A', boxShadow:SS }}>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 10px' }}>
                    📌 {placed.length} signature{placed.length !== 1 ? 's' : ''} placed
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {placed.map((p, idx) => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:12, background:'rgba(255,255,255,0.6)', boxShadow:'inset 0 2px 5px rgba(255,255,255,0.7)' }}>
                        <div style={{ fontWeight:700, fontSize:'0.68rem', color:'#A16207', flexShrink:0, minWidth:20 }}>#{idx+1}</div>
                        <img src={p.sigDataUrl} style={{ height:28, maxWidth:80, objectFit:'contain', flexShrink:0 }} alt="" />
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#422006', margin:0 }}>Page {p.page}</p>
                          <p style={{ fontSize:'0.62rem', color:'#A16207', margin:0 }}>Size {p.size}% · Opacity {Math.round(p.opacity*100)}%</p>
                        </div>
                        <button onClick={() => setSigPage(p.page)} style={{ padding:'3px 8px', borderRadius:7, border:'none', background:'#FDE047', color:'#422006', fontSize:'0.62rem', fontWeight:700, cursor:'pointer', flexShrink:0 }}>View</button>
                        <button onClick={() => setPlaced(prev => prev.filter(x => x.id !== p.id))} style={{ width:22, height:22, borderRadius:'50%', border:'none', background:'#FEE2E2', color:'#DC2626', fontSize:'0.7rem', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — signature creator */}
            <div>
              <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.78rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 10px' }}>Create Signature</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                <ModeCard id="draw" emoji="✍️" label="Draw" />
                <ModeCard id="type" emoji="⌨️" label="Type" />
                <ModeCard id="upload" emoji="🖼️" label="Upload" />
              </div>

              {/* DRAW */}
              {sigMode === 'draw' && (
                <div style={{ borderRadius:22, padding:16, background:'#FEF08A', boxShadow:CS, marginBottom:10 }}>
                  <p style={{ fontWeight:700, color:'#422006', fontSize:'0.82rem', margin:'0 0 10px' }}>Draw your signature below</p>
                  <div style={{ borderRadius:14, overflow:'hidden', background:'white', border:'2px solid rgba(161,98,7,0.25)', boxShadow:'inset 0 3px 10px rgba(0,0,0,0.05)' }}>
                    <SignaturePad onSignatureComplete={setDrawnSig} />
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006' }}>Ink:</span>
                    {COLORS.map(c => <div key={c} onClick={() => setPenColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', boxShadow: penColor===c ? `0 0 0 3px white, 0 0 0 5px ${c}` : '0 2px 6px rgba(0,0,0,0.2)', transform: penColor===c ? 'scale(1.15)' : 'scale(1)', transition:'all 0.15s ease' }} />)}
                  </div>
                  <YBtn onClick={useDrawn} style={{ marginTop:12 }}>✓ Use This Signature</YBtn>
                </div>
              )}

              {/* TYPE */}
              {sigMode === 'type' && (
                <div style={{ borderRadius:22, padding:16, background:'#FEF08A', boxShadow:CS, marginBottom:10 }}>
                  <p style={{ fontWeight:700, color:'#422006', fontSize:'0.82rem', margin:'0 0 10px' }}>Type your name</p>
                  <input type="text" value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Your full name" style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:'none', fontSize:'1rem', color:'#422006', background:'rgba(255,255,255,0.85)', boxShadow:'inset 0 2px 8px rgba(161,98,7,0.1)', outline:'none', marginBottom:12, fontWeight:600, boxSizing:'border-box' }} />
                  <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006', margin:'0 0 8px' }}>Choose style:</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:12 }}>
                    {Object.entries(FONTS).map(([id, f]) => {
                      const sel = selFont === id;
                      return <div key={id} onClick={() => setSelFont(id)} style={{ borderRadius:12, padding:'10px 14px', cursor:'pointer', background: sel ? '#FDE047' : 'rgba(255,255,255,0.5)', boxShadow: sel ? SS : 'inset 0 2px 5px rgba(255,255,255,0.6)', transform: sel ? 'translateY(-2px)' : 'none', transition:'all 0.18s ease', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#A16207' }}>{f.name}</span>
                        <span style={{ fontFamily:f.family, fontSize:'1.1rem', color:'#1E293B', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{typedName || 'Your Name'}</span>
                      </div>;
                    })}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#422006' }}>Color:</span>
                    {COLORS.map(c => <div key={c} onClick={() => setPenColor(c)} style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', boxShadow: penColor===c ? `0 0 0 3px white, 0 0 0 5px ${c}` : '0 2px 6px rgba(0,0,0,0.2)', transform: penColor===c ? 'scale(1.15)' : 'scale(1)', transition:'all 0.15s ease' }} />)}
                  </div>
                  <YBtn onClick={genTyped} disabled={!typedName.trim()}>✓ Use This Signature</YBtn>
                </div>
              )}

              {/* UPLOAD */}
              {sigMode === 'upload' && (
                <div style={{ borderRadius:22, padding:16, background:'#FEF08A', boxShadow:CS, marginBottom:10 }}>
                  <p style={{ fontWeight:700, color:'#422006', fontSize:'0.82rem', margin:'0 0 4px' }}>Upload signature image</p>
                  <p style={{ fontSize:'0.75rem', color:'#A16207', margin:'0 0 12px' }}>PNG with transparent background works best</p>
                  <div onClick={() => sigUploadRef.current?.click()} style={{ borderRadius:14, padding:20, textAlign:'center', border:'2px dashed rgba(161,98,7,0.4)', background:'rgba(255,255,255,0.5)', cursor:'pointer', transition:'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.75)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.5)'}>
                    {uploadPreview ? <><img src={uploadPreview} style={{ maxHeight:80, maxWidth:'100%', objectFit:'contain', display:'block', margin:'0 auto 8px' }} alt="" /><p style={{ fontSize:'0.72rem', color:'#A16207', margin:0, fontWeight:600 }}>Click to change</p></> : <><span style={{ fontSize:'2rem' }}>🖼️</span><p style={{ color:'#A16207', fontSize:'0.82rem', fontWeight:600, margin:'6px 0 0' }}>Click to upload PNG / JPG</p></>}
                  </div>
                  <input ref={sigUploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files[0]; if (f) setUploadPreview(URL.createObjectURL(f)); }} />
                  {uploadPreview && <YBtn onClick={useUploaded} style={{ marginTop:12 }}>✓ Use This Signature</YBtn>}
                </div>
              )}

              {/* Active sig chip + Add to Document */}
              {sigDataUrl && (
                <div style={{ borderRadius:18, padding:'14px 16px', background:'#FEF9C3', boxShadow:SS, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <img src={sigDataUrl} style={{ height:36, maxWidth:100, objectFit:'contain', flexShrink:0 }} alt="" />
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, color:'#422006', fontSize:'0.78rem', margin:'0 0 1px' }}>✅ Signature ready</p>
                      <p style={{ fontSize:'0.68rem', color:'#A16207', margin:0 }}>Drag it on the preview, then add</p>
                    </div>
                    <button onClick={() => setSigDataUrl(null)} style={{ width:24, height:24, borderRadius:'50%', border:'none', background:'#FEE2E2', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', color:'#DC2626' }}>✕</button>
                  </div>
                  {/* Page picker inline */}
                  <p style={{ fontSize:'0.68rem', fontWeight:700, color:'#A16207', margin:'0 0 6px' }}>Place on page:</p>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                    {Array.from({ length: Math.min(pageCount, 10) }, (_, i) => i+1).map(n => (
                      <div key={n} onClick={() => { setSigPage(n); renderPage(n); }} style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:700, fontSize:'0.78rem', background: sigPage===n ? '#FDE047' : 'rgba(255,255,255,0.7)', color: sigPage===n ? '#422006' : '#A16207', boxShadow: sigPage===n ? SS : 'inset 0 1px 4px rgba(255,255,255,0.7)', transition:'all 0.15s ease' }}>{n}</div>
                    ))}
                  </div>

                  <button onClick={handleAddToDocument} style={{ width:'100%', padding:'11px', borderRadius:14, border:'none', background:'linear-gradient(160deg,#FACC15,#A16207)', color:'white', fontWeight:800, fontSize:'0.9rem', cursor:'pointer', boxShadow:BS, display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)' }} onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                    <Plus size={16} /> Add to Document
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STICKY ACTION BAR — Apply All */}
        {pdfFile && placed.length > 0 && !isSuccess && (
          <div style={{ position:'sticky', bottom:20, zIndex:40, borderRadius:24, padding:'16px 20px', background:'linear-gradient(135deg,#FEF9C3,#FEF08A)', boxShadow:'0 8px 0px rgba(161,98,7,0.3), 0 24px 65px rgba(202,138,4,0.32), inset 0 -10px 24px rgba(202,138,4,0.2), inset 0 10px 24px rgba(255,255,255,0.95)', display:'flex', alignItems:'center', gap:12, marginTop:16 }}>
            <div style={{ display:'flex', gap:8, flex:1, flexWrap:'wrap' }}>
              <div style={spl}>📄 {pageCount} page doc</div>
              <div style={spl}>✍️ {placed.length} signature{placed.length !== 1 ? 's' : ''} placed</div>
              {sigDataUrl && <div style={{ ...spl, background:'rgba(254,240,138,0.9)', color:'#7C2D00' }}>⚠️ 1 pending — click Add first</div>}
            </div>
            <button onClick={handleApplyAll} disabled={processing} style={{ padding:'12px 28px', borderRadius:16, border:'none', background: processing ? 'linear-gradient(160deg,#94A3B8,#64748B)' : 'linear-gradient(160deg,#FACC15,#A16207)', color:'white', fontWeight:800, fontSize:'0.95rem', cursor: processing ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', flexShrink:0, boxShadow: processing ? 'none' : BS, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', display:'flex', alignItems:'center', gap:6 }} onMouseEnter={e => { if (!processing) e.currentTarget.style.transform='translateY(-4px) scale(1.02)'; }} onMouseLeave={e => { e.currentTarget.style.transform='translateY(0) scale(1)'; }}>
              {processing ? <><Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> Signing…</> : <>✍️ Apply All &amp; Download</>}
            </button>
          </div>
        )}
      </div>

      {/* PROCESSING OVERLAY */}
      {processing && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(66,32,6,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ borderRadius:36, padding:'40px 36px', textAlign:'center', maxWidth:320, width:'100%', background:'linear-gradient(145deg,#FEF9C3,#FEF08A)', boxShadow:'0 12px 0px rgba(161,98,7,0.45), 0 36px 90px rgba(202,138,4,0.5), inset 0 -14px 32px rgba(202,138,4,0.28), inset 0 14px 32px rgba(255,255,255,0.95)' }}>
            <div style={{ width:72, height:72, borderRadius:22, margin:'0 auto 20px', background:'#FEF08A', fontSize:'2rem', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:CS, animation:'pulse 1.5s ease-in-out infinite' }}>✍️</div>
            <h3 style={{ fontSize:'1.2rem', fontWeight:900, color:'#422006', margin:'0 0 6px' }}>Signing your PDF</h3>
            <p style={{ color:'#A16207', fontSize:'0.85rem', margin:'0 0 16px', lineHeight:1.5 }}>Embedding {placed.length} signature{placed.length !== 1 ? 's' : ''} locally…</p>
            <div style={{ width:'100%', height:8, borderRadius:999, background:'rgba(161,98,7,0.15)', overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', borderRadius:999, background:'linear-gradient(90deg,#FACC15,#A16207)', width:`${progress}%`, transition:'width 0.3s ease' }} />
            </div>
            <p style={{ fontSize:'0.82rem', color:'#A16207', fontWeight:700, margin:0 }}>{progress}%</p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
    </div>
  );
}
