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
      desc: 'Your files never leave your device — everything is processed locally in your browser using cutting-edge WebAssembly technology. No server uploads, no third-party access, no data retention. Your documents stay yours.',
      clayClass: 'clay-blue',
      emoji: '🔒',
    },
    {
      title: 'Lightning Fast',
      desc: 'Powered by compiled WebAssembly modules, IHatePDF runs at near-native speed right in your browser. Process large files in seconds without waiting for slow server round-trips or dealing with upload limits.',
      clayClass: 'clay-yellow',
      emoji: '⚡',
    },
    {
      title: 'No Sign-Up',
      desc: 'Jump straight into working with your PDFs — no accounts, no email verification, no subscriptions. IHatePDF is completely free with zero tracking, zero ads, and zero hidden paywalls.',
      clayClass: 'clay-green',
      emoji: '🎁',
    },
    {
      title: 'Works Offline',
      desc: 'Install IHatePDF as a Progressive Web App and use it anywhere — even without an internet connection. Perfect for when you\'re traveling, on a plane, or simply don\'t have reliable Wi-Fi.',
      clayClass: 'clay-purple',
      emoji: '📱',
    },
  ];

  /* ── Carousel state ──────────────────────── */
  // `current` = index of the CENTER (hero) card
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardsToShow, setCardsToShow] = useState(3);

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
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, padding: '0 16px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="clay-nav" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              textShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            Every PDF Tool <br />
            You'll Ever Need
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.85)', maxWidth: '576px', margin: '0 auto', lineHeight: 1.7, marginBottom: '20px' }}>
            Merge, split, compress, convert &amp; sign — all running{' '}
            <span style={{ fontWeight: 600, color: 'white' }}>100% in your browser</span>.
            No uploads. No risk. Just results.
          </p>

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
            <h2 style={{ fontSize: 'clamp(1.875rem, 4vw, 2.25rem)', fontWeight: 700, color: 'white', marginBottom: '12px', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
              All Your PDF Tools
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.125rem' }}>Click any tool to get started instantly.</p>
          </div>

          {/* Carousel Wrapper */}
          <div style={{ position: 'relative' }}>
            {/* Arrows */}
            <button
              onClick={prev}
              className="clay-arrow"
              style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={next}
              className="clay-arrow"
              style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
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

      {/* ── Features ───────────────────────────── */}
      <section id="features" style={{ paddingTop: '12px', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px', overflow: 'visible' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', overflow: 'visible' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: 'clamp(1.875rem, 4vw, 2.25rem)', fontWeight: 700, color: 'white', marginBottom: '12px', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
              Why IHatePDF?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.125rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
              Most PDF tools upload your files to shady servers. We built IHatePDF to be the opposite — fast, private, and completely free.
            </p>
          </div>

          <div className="clay-features-grid" style={{ overflow: 'visible' }}>
            {features.map((f, i) => (
              <div
                key={i}
                className={`clay-feature ${f.clayClass}`}
                style={{
                  borderRadius: 32,
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '12px',
                  minHeight: '200px',
                  overflow: 'visible',
                }}
              >
                <span style={{ fontSize: '2rem' }}>{f.emoji}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>{f.title}</h3>
                <p style={{ color: '#475569', fontSize: '0.78rem', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────── */}
      <section style={{ paddingTop: '12px', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px' }}>
        <div
          className="clay-container"
          style={{
            padding: '36px 32px',
            maxWidth: '896px',
            margin: '0 auto',
            background: 'linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)',
          }}
        >
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 1.875rem)', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '32px' }}>
            Three Simple Steps
          </h2>
          <div className="clay-steps-grid">
            {[
              { step: '1', title: 'Upload', desc: 'Drag & drop your files securely into the browser.' },
              { step: '2', title: 'Process', desc: 'Instant local processing — nothing uploaded anywhere.' },
              { step: '3', title: 'Download', desc: 'Get your finished file in seconds. Done!' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
                <div className="clay-step-number" style={{ margin: '0 auto 20px' }}>
                  {s.step}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>{s.title}</h3>
                <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer style={{ paddingLeft: '24px', paddingRight: '24px', paddingBottom: 0 }}>
        <div className="clay-footer" style={{ padding: '16px 32px', maxWidth: '1152px', margin: '16px auto 0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>© {new Date().getFullYear()} IHatePDF. Built with 💙 by Sarthak</p>
        </div>
      </footer>
    </div>
  );
}
