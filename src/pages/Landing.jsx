import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Zap,
  Download,
  FileText,
  Scissors,
  Minimize2,
  Image,
  FileImage,
  PenTool,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  UserX,
  Check,
} from 'lucide-react';

export default function Landing() {
  /* ── Tool data with clay color variants and 3D Emojis ──── */
  const tools = [
    {
      name: 'Merge PDF',
      path: '/merge',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Page%20facing%20up/3D/page_facing_up_3d.png',
      desc: 'Combine multiple PDFs into a single document.',
      clayClass: 'clay-blue',
      iconBg: '#93C5FD',
      iconColor: '#1e40af',
      accentColor: '#2563eb',
    },
    {
      name: 'Split PDF',
      path: '/split',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Scissors/3D/scissors_3d.png',
      desc: 'Separate pages or extract a range from a PDF.',
      clayClass: 'clay-purple',
      iconBg: '#C4B5FD',
      iconColor: '#5b21b6',
      accentColor: '#7c3aed',
    },
    {
      name: 'Compress PDF',
      path: '/compress',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Package/3D/package_3d.png',
      desc: 'Reduce file size while keeping quality high.',
      clayClass: 'clay-green',
      iconBg: '#6EE7B7',
      iconColor: '#166534',
      accentColor: '#16a34a',
    },
    {
      name: 'PDF → JPG',
      path: '/pdf-to-jpg',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Framed%20picture/3D/framed_picture_3d.png',
      desc: 'Convert every page into a high-res image.',
      clayClass: 'clay-peach',
      iconBg: '#FCA5A5',
      iconColor: '#991b1b',
      accentColor: '#dc2626',
    },
    {
      name: 'JPG → PDF',
      path: '/jpg-to-pdf',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Camera%20with%20flash/3D/camera_with_flash_3d.png',
      desc: 'Turn your photos into a polished PDF file.',
      clayClass: 'clay-pink',
      iconBg: '#F9A8D4',
      iconColor: '#9d174d',
      accentColor: '#db2777',
    },
    {
      name: 'Sign PDF',
      path: '/sign',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Pen/3D/pen_3d.png',
      desc: 'Add your digital signature in seconds.',
      clayClass: 'clay-yellow',
      iconBg: '#FDE047',
      iconColor: '#854d0e',
      accentColor: '#ca8a04',
    },
  ];

  const features = [
    {
      title: '100% Private',
      desc: 'Your files never leave your device. Everything runs locally.',
      icon: Lock,
      gradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
      lightBg: '#F0FDF4',
    },
    {
      title: 'Lightning Fast',
      desc: 'Near-native speed powered by WebAssembly in your browser.',
      icon: Zap,
      gradient: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
      lightBg: '#FDF2F8',
    },
    {
      title: 'No Sign-Up',
      desc: 'Zero accounts, zero tracking, zero hidden paywalls.',
      icon: UserX,
      gradient: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
      lightBg: '#EEF2FF',
    },
    {
      title: 'Works Offline',
      desc: 'Install as a PWA and use it anywhere, even without Wi-Fi.',
      icon: WifiOff,
      gradient: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)',
      lightBg: '#FFF7ED',
    },
  ];

  /* ── Carousel state ──────────────────────── */
  // `current` = index of the CENTER (hero) card
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardsToShow, setCardsToShow] = useState(3);
  const [pencilKey, setPencilKey] = useState(0);

  /* Re-trigger pencil draw every 10 s */
  useEffect(() => {
    const id = setInterval(() => setPencilKey(k => k + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const updateCards = () => {
      setCardsToShow(window.innerWidth < 768 ? 1 : 3);
    };
    updateCards();
    window.addEventListener('resize', updateCards);
    return () => window.removeEventListener('resize', updateCards);
  }, []);

  const lastIndex = tools.length - 1;

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c >= lastIndex ? 0 : c + 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [paused, lastIndex, current]);

  const prev = useCallback(() => setCurrent((c) => (c <= 0 ? lastIndex : c - 1)), [lastIndex]);
  const next = useCallback(() => setCurrent((c) => (c >= lastIndex ? 0 : c + 1)), [lastIndex]);

  /* Card width + gap for transform calculation */
  const cardWidth = 288;
  const gap = 24;

  /* Calculate scroll offset: position track so `current` is in the center */
  // On desktop (3 cards visible), we add paddingLeft = 1 card+gap to the track
  // so card 0 can sit in the center slot. translateX = current * step.
  const step = cardWidth + gap;

  /* Center the current card using CSS calc — works for ALL indices including 0 and last */
  const centerOffset = `calc(50% - ${current * step + cardWidth / 2}px)`;

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Navbar ─────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div className="clay-nav" style={{ padding: '12px 0' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <div className="clay-icon" style={{ width: 38, height: 38, borderRadius: 12, background: '#93C5FD' }}>
                <FileText size={20} color="#1d4ed8" />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8', letterSpacing: '-0.02em' }}>IHatePDF</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }} className="hidden sm:flex">
              <a href="#features" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}>Features</a>
              <a href="#tools" className="clay-btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Tools
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section style={{ paddingTop: '80px', paddingBottom: '16px', paddingLeft: '24px', paddingRight: '24px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(3rem, 7vw, 4.5rem)',
              fontWeight: 900,
              color: 'white',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
              textShadow: `
                0 1px 0 rgba(0,0,0,0.25),
                0 2px 0 rgba(0,0,0,0.22),
                0 3px 0 rgba(0,0,0,0.19),
                0 4px 0 rgba(0,0,0,0.16),
                0 5px 0 rgba(0,0,0,0.13),
                0 6px 0 rgba(0,0,0,0.10),
                0 7px 0 rgba(0,0,0,0.07),
                0 8px 0 rgba(0,0,0,0.04),
                0 12px 28px rgba(0,0,0,0.35)
              `,
            }}
          >
            Every{' '}
            <span style={{ position: 'relative', display: 'inline-block', padding: '0 6px', zIndex: 1 }}>
              {/* Orange pencil-shaded highlight */}
              <svg
                aria-hidden="true"
                preserveAspectRatio="none"
                viewBox="0 0 440 88"
                style={{
                  position: 'absolute',
                  left: '-4%', top: '-12%',
                  width: '108%', height: '124%',
                  zIndex: -1,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <filter id="pencilShade" x="-6%" y="-30%" width="112%" height="160%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.08" numOctaves="3" seed="12" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <g filter="url(#pencilShade)">
                  {/* Base wash — solid enough to read as orange */}
                  <path
                    d="M 18 18 C 90 10, 220 8, 360 13 C 410 15, 428 30, 425 46 C 422 62, 405 76, 354 79 C 220 84, 88 81, 20 76 C -4 72, 10 28, 18 18 Z"
                    fill="rgba(255,115,0,0.50)"
                  />
                  {/* Pencil strokes — vivid bright orange */}
                  <path d="M 16 24 C 100 19, 210 22, 330 20 C 390 19, 418 24, 422 27" stroke="rgba(255,120,0,0.88)" strokeWidth="9" fill="none" strokeLinecap="round" />
                  <path d="M 13 33 C 105 28, 215 32, 332 30 C 393 28, 420 33, 423 36" stroke="rgba(255,110,0,0.82)" strokeWidth="10" fill="none" strokeLinecap="round" />
                  <path d="M 14 42 C 102 38, 213 41, 331 39 C 392 37, 421 42, 424 45" stroke="rgba(255,125,0,0.90)" strokeWidth="9"  fill="none" strokeLinecap="round" />
                  <path d="M 15 51 C 103 47, 214 51, 332 49 C 393 47, 421 51, 424 54" stroke="rgba(255,115,0,0.84)" strokeWidth="10" fill="none" strokeLinecap="round" />
                  <path d="M 16 60 C 102 57, 212 60, 330 58 C 391 56, 419 60, 422 63" stroke="rgba(255,120,0,0.78)" strokeWidth="8"  fill="none" strokeLinecap="round" />
                  <path d="M 19 69 C 104 66, 212 68, 328 67 C 388 65, 416 68, 419 71" stroke="rgba(255,115,0,0.65)" strokeWidth="7"  fill="none" strokeLinecap="round" />
                </g>
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>PDF Tool</span>
            </span>{' '}<br />
            You'll Ever Need
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.85)', maxWidth: '576px', margin: '0 auto', lineHeight: 1.7, marginBottom: '20px' }}>
            Merge, split, compress, convert &amp; sign — all running{' '}
            <span style={{ fontWeight: 600, color: 'white' }}>100% in your browser</span>.{' '}
            <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
              No uploads. No risk. Just results.
              {/* Hand-drawn pencil underline — sits 2px below the text */}
              <svg
                style={{ position: 'absolute', left: '50%', bottom: '-6px', transform: 'translateX(-50%)', overflow: 'visible' }}
                width="270" height="16" viewBox="0 0 270 16"
                fill="none" xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Main bold pencil stroke */}
                <path
                  d="M3 9 C16 5, 32 12, 50 8.5 C68 5, 84 11, 102 8 C120 5, 136 11.5, 154 8.5 C172 5.5, 188 12, 206 8.5 C224 5, 240 11, 256 8 C262 7, 267 9, 269 10"
                  stroke="rgba(255,255,255,0.88)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 350,
                    strokeDashoffset: 350,
                    animation: 'pencilDraw 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s forwards',
                    filter: 'url(#pencilTex)',
                  }}
                  key={pencilKey}
                />
                {/* Ghost shadow stroke for pencil grain */}
                <path
                  d="M4 11 C18 7.5, 34 13, 52 10 C70 7, 86 12.5, 104 9.5 C122 6.5, 138 12.5, 156 10 C174 7.5, 190 13, 208 10 C226 7, 242 12, 258 9.5 C264 8.5, 268 10.5, 270 11.5"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 350,
                    strokeDashoffset: 350,
                    animation: 'pencilDraw 1.2s cubic-bezier(0.4,0,0.2,1) 0.6s forwards',
                  }}
                  key={`g-${pencilKey}`}
                />
                <defs>
                  <filter id="pencilTex" x="-4%" y="-100%" width="108%" height="300%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
              </svg>
            </span>
          </p>
          <style>{`
            @keyframes pencilDraw {
              to { stroke-dashoffset: 0; }
            }
          `}</style>

          {/* Stat Pills — clay-pill with colored left border */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
            {[
              { emoji: '🔒', label: '100% Private', border: '#3B82F6' },
              { emoji: '⚡', label: 'WASM Powered', border: '#F59E0B' },
              { emoji: '🌐', label: 'Works Offline', border: '#10B981' },
            ].map((pill) => (
              <div
                key={pill.label}
                className="clay-pill"
                style={{
                  padding: '10px 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#334155',
                  borderLeft: `4px solid ${pill.border}`,
                }}
              >
                <span>{pill.emoji}</span>
                {pill.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tools Carousel ─────────────────────── */}
      <section id="tools" style={{ paddingTop: '12px', paddingBottom: '24px' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 700, color: 'white', marginBottom: '4px', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
              All Your PDF Tools
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: 0 }}>Click any tool to get started instantly.</p>
          </div>

          {/* Carousel Wrapper */}
          <div style={{ position: 'relative' }}>
            {/* Arrows */}
            <button
              onClick={prev}
              className="clay-arrow"
              style={{ position: 'absolute', left: -8, top: '50%', marginTop: '-24px', zIndex: 10 }}
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={next}
              className="clay-arrow"
              style={{ position: 'absolute', right: -8, top: '50%', marginTop: '-24px', zIndex: 10 }}
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>

            {/* Track — outer clip container */}
            <div
              style={{ overflow: 'hidden', margin: '0 56px', padding: '20px 0' }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div
                className="clay-carousel-track"
                style={{
                  transform: `translateX(${centerOffset})`,
                }}
              >
                {tools.map((tool, i) => {
                  const isCenter = i === current;
                  const isSide = !isCenter;

                  return (
                    <Link
                      key={i}
                      to={tool.path}
                      className={`clay ${tool.clayClass}`}
                      style={{
                        flexShrink: 0,
                        width: cardWidth,
                        minHeight: 260,
                        padding: '28px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '14px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transform: isCenter ? 'scale(1.08)' : isSide ? 'scale(0.95)' : 'scale(1)',
                        opacity: isSide ? 0.88 : 1,
                        zIndex: isCenter ? 10 : 1,
                        transition: 'transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.5s ease',
                      }}
                    >
                      {/* 3D Emoji Icon — white clay chip floats on the card */}
                      <div className="clay-icon" style={{ width: 72, height: 72, borderRadius: 22 }}>
                        <img 
                          src={tool.emoji3D} 
                          alt={tool.name} 
                          style={{ width: 44, height: 44, objectFit: 'contain' }}
                        />
                      </div>

                      {/* Content */}
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>{tool.name}</h3>
                        <p style={{ color: '#475569', fontSize: '0.8rem', lineHeight: 1.55 }}>{tool.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              {tools.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`clay-dot${i === current ? ' active' : ''}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features + How It Works — Side by Side ── */}
      <section id="features" style={{ paddingTop: '12px', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px', overflow: 'visible' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* LEFT: Why IHatePDF — Flat Cards */}
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 700, color: 'white', marginBottom: '4px', textShadow: '0 2px 10px rgba(0,0,0,0.15)', position: 'relative', display: 'inline-block' }}>
                Why IHatePDF?
                {/* Hand-drawn red pencil circle around the heading */}
                <svg
                  key={`circle-${pencilKey}`}
                  viewBox="0 0 300 80"
                  preserveAspectRatio="none"
                  style={{
                    position: 'absolute',
                    top: '-10px', left: '-12px',
                    width: 'calc(100% + 24px)',
                    height: 'calc(100% + 18px)',
                    overflow: 'visible',
                    pointerEvents: 'none',
                    filter: 'url(#circleRough)',
                  }}
                >
                  <defs>
                    <filter id="circleRough" x="-10%" y="-25%" width="120%" height="150%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="7" result="n" />
                      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" />
                    </filter>
                  </defs>
                  <path
                    d="M 60 6 C 130 -2, 240 0, 280 18 C 300 28, 298 54, 270 66 C 230 78, 130 80, 60 72 C 20 66, 4 50, 6 38 C 8 20, 30 10, 60 6 Z"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="620"
                    strokeDashoffset="620"
                    style={{ animation: 'drawCircle 10s ease-in-out infinite' }}
                  />
                </svg>
              </h2>
              <style>{`
                @keyframes drawCircle {
                  0%   { stroke-dashoffset: 520; opacity: 0; }
                  5%   { opacity: 1; }
                  20%  { stroke-dashoffset: 0; opacity: 1; }
                  35%  { stroke-dashoffset: 0; opacity: 1; }
                  45%  { stroke-dashoffset: 0; opacity: 0; }
                  100% { stroke-dashoffset: 520; opacity: 0; }
                }
              `}</style>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
                Fast, private, and completely free.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {features.map((f, i) => {
                const IconComp = f.icon;
                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: f.lightBg,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Colored top with icon */}
                    <div style={{ background: f.gradient, padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      <IconComp size={36} color="white" strokeWidth={1.5} />
                      {/* Wavy divider */}
                      <svg viewBox="0 0 400 35" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 24 }}>
                        <path d="M0 35 C100 0, 200 28, 300 8 C350 -2, 380 12, 400 4 L400 35 Z" fill={f.lightBg} />
                      </svg>
                    </div>
                    {/* White bottom with text */}
                    <div style={{ padding: '14px 14px 16px', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>{f.title}</h3>
                      <p style={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.45, margin: 0 }}>{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Three Simple Steps — Vertical */}
          <div style={{ flex: '1 1 300px' }}>
            <div
              className="clay-container"
              style={{
                padding: '20px 20px',
                background: 'linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '16px' }}>
                Three Simple Steps
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {[
                  { step: '1', title: 'Upload', desc: 'Drag & drop your files into the browser.' },
                  { step: '2', title: 'Process', desc: 'Instant local processing — nothing uploaded.' },
                  { step: '3', title: 'Download', desc: 'Get your finished file in seconds.' },
                ].reduce((acc, s, i, arr) => {
                  acc.push(
                    <div key={`step-${i}`} style={{ textAlign: 'center', width: '100%' }}>
                      <div className="clay-step-number" style={{ margin: '0 auto 8px', width: 48, height: 48, fontSize: '1.1rem' }}>
                        {s.step}
                      </div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>{s.title}</h3>
                      <p style={{ color: '#475569', fontSize: '0.72rem', lineHeight: 1.4, margin: 0 }}>{s.desc}</p>
                    </div>
                  );
                  if (i < arr.length - 1) {
                    acc.push(
                      <div key={`arrow-${i}`} style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                        <svg width="20" height="36" viewBox="0 0 20 36" fill="none" style={{ display: 'block' }}>
                          <line x1="10" y1="2" x2="10" y2="24" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round"
                            style={{ animation: 'arrowPulseDown 1.5s ease-in-out infinite' }} />
                          <polyline points="4,20 10,32 16,20" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ animation: 'arrowPulseDown 1.5s ease-in-out infinite' }} />
                        </svg>
                      </div>
                    );
                  }
                  return acc;
                }, [])}
              </div>
              <style>{`
                @keyframes arrowPulseDown {
                  0%, 100% { opacity: 0.5; transform: translateY(0); }
                  50%       { opacity: 1;   transform: translateY(3px); }
                }
              `}</style>
            </div>
          </div>

        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer>
        <div className="clay-footer" style={{ padding: '16px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>© {new Date().getFullYear()} IHatePDF. Built with 💙 by Sarthak</p>
        </div>
      </footer>
    </div>
  );
}
