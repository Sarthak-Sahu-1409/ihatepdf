import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  Zap,
  WifiOff,
  UserX,
} from 'lucide-react';
import { Radar, IconContainer } from '../components/ui/radar-effect';
import FutureNavbar from '../components/ui/future-navbar';
import { GooeyText } from '../components/ui/gooey-text-morphing';
import { StackedCards } from '../components/ui/stacked-activity-cards';
import CourseCard from '../components/ui/course-design-cards';
import { PremiumHowItWorks } from '../components/ui/premium-how-it-works';
import { HiDocumentText } from 'react-icons/hi';
import { HiMiniDocumentArrowUp, HiScissors } from 'react-icons/hi2';
import { BsFileEarmarkZip } from 'react-icons/bs';
import { BiSolidImageAlt } from 'react-icons/bi';
import { RiPenNibFill } from 'react-icons/ri';
import { IoWater } from 'react-icons/io5';
import { ShapeLandingHero } from '../components/ui/shape-landing-hero';

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
    {
      name: 'Watermark PDF',
      path: '/watermark',
      emoji3D: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Droplet/3D/droplet_3d.png',
      desc: 'Stamp text or logo on every page with live preview.',
      clayClass: 'clay-teal',
      iconBg: '#A5F3FC',
      iconColor: '#0e7490',
      accentColor: '#06b6d4',
    },
  ];

  const features = [
    {
      title: '100% Private',
      desc: 'Your files never leave your device. Everything runs locally.',
      icon: Lock,
      gradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
      lightBg: '#0f172a',
    },
    {
      title: 'Lightning Fast',
      desc: 'Near-native speed powered by WebAssembly in your browser.',
      icon: Zap,
      gradient: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
      lightBg: '#0f172a',
    },
    {
      title: 'No Sign-Up',
      desc: 'Zero accounts, zero tracking, zero hidden paywalls.',
      icon: UserX,
      gradient: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
      lightBg: '#0f172a',
    },
    {
      title: 'Works Offline',
      desc: 'Install as a PWA and use it anywhere, even without Wi-Fi.',
      icon: WifiOff,
      gradient: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)',
      lightBg: '#0f172a',
    },
  ];

  const [pencilKey, setPencilKey] = useState(0);

  /* Re-trigger pencil draw every 10 s */
  useEffect(() => {
    const id = setInterval(() => setPencilKey(k => k + 1), 10000);
    return () => clearInterval(id);
  }, []);

  /* Icon mapping for each tool */
  const toolIcons = [
    <HiDocumentText className="h-8 w-8 text-slate-600" />,
    <HiScissors className="h-8 w-8 text-slate-600" />,
    <BsFileEarmarkZip className="h-8 w-8 text-slate-600" />,
    <BiSolidImageAlt className="h-8 w-8 text-slate-600" />,
    <HiMiniDocumentArrowUp className="h-8 w-8 text-slate-600" />,
    <RiPenNibFill className="h-8 w-8 text-slate-600" />,
    <IoWater className="h-8 w-8 text-slate-600" />,
  ];

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative' }}>

      {/* ── Shape Landing Hero Background ───────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <ShapeLandingHero />
      </div>

      {/* ── Main Content ─────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Navbar ─────────────────────────────── */}
      <FutureNavbar />
      {/* ── Hero ───────────────────────────────── */}
      <section style={{ paddingTop: 'calc(80px + 0.9rem)', paddingBottom: '16px', paddingLeft: '24px', paddingRight: '24px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 8vw, 4.5rem)',
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
            <GooeyText texts={["PDF Tool", "PDF Utility"]} morphTime={1.25} cooldownTime={2.5} />{' '}
            You'll Ever Need
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.85)', maxWidth: '576px', margin: '0 auto', lineHeight: 1.7, marginBottom: '20px' }}>
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

          {/* Stat Pills — stacked-activity-cards */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px' }}>
            <StackedCards />
          </div>
        </div>
      </section>

      {/* ── Tools — Radar Effect ────────────────── */}
      <section id="tools" style={{ paddingTop: '8px', paddingBottom: '32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 900, color: '#818cf8', marginBottom: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
              All Your PDF Tools
            </h2>
          </div>

          <style>{`
            .radar-layout-container {
              position: relative;
              display: flex;
              height: 24rem;
              width: 100%;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 0.85rem;
              overflow: hidden;
              padding: 0 1rem;
            }
            .radar-row-wrap {
              display: flex;
              width: 100%;
              align-items: center;
              justify-content: space-between;
            }
            @media (max-width: 768px) {
              .radar-layout-container {
                height: auto;
                gap: 1.5rem;
                padding-bottom: 2rem;
              }
              .radar-row-wrap {
                justify-content: center;
                gap: 1.5rem;
                flex-wrap: wrap;
              }
            }
          `}</style>
          <div className="radar-layout-container">
            {/* Row 1 — 3 tools */}
            <div style={{ margin: '0 auto', width: '100%', maxWidth: '40rem' }}>
              <div className="radar-row-wrap">
                <Link to={tools[0].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[0].name} delay={0.2} icon={toolIcons[0]} />
                </Link>
                <Link to={tools[1].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[1].name} delay={0.4} icon={toolIcons[1]} />
                </Link>
                <Link to={tools[2].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[2].name} delay={0.3} icon={toolIcons[2]} />
                </Link>
              </div>
            </div>
            {/* Row 2 — 2 tools */}
            <div style={{ margin: '0 auto', width: '100%', maxWidth: '24rem' }}>
              <div className="radar-row-wrap">
                <Link to={tools[3].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[3].name} delay={0.5} icon={toolIcons[3]} />
                </Link>
                <Link to={tools[4].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[4].name} delay={0.8} icon={toolIcons[4]} />
                </Link>
              </div>
            </div>
            {/* Row 3 — 2 tools */}
            <div style={{ margin: '0 auto', width: '100%', maxWidth: '40rem' }}>
              <div className="radar-row-wrap">
                <Link to={tools[5].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[5].name} delay={0.6} icon={toolIcons[5]} />
                </Link>
                <Link to={tools[6].path} style={{ textDecoration: 'none' }}>
                  <IconContainer text={tools[6].name} delay={0.7} icon={toolIcons[6]} />
                </Link>
              </div>
            </div>

            <div className="mobile-radar-container" style={{ position: 'absolute', bottom: '-3rem', zIndex: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', left: 0 }}>
              <Radar />
            </div>
            <div style={{ position: 'absolute', bottom: 0, zIndex: 41, height: '1px', width: '100%', background: 'linear-gradient(to right, transparent, rgb(51,65,85), transparent)' }} />
          </div>
        </div>
      </section>

      {/* ── Features + How It Works — Side by Side ── */}
      <section id="features" style={{ paddingTop: '12px', paddingBottom: '24px', paddingLeft: '24px', paddingRight: '24px', overflow: 'visible' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* LEFT: Why IHatePDF — Flat Cards */}
          <div className="mobile-w-full" style={{ flex: '1 1 480px', minWidth: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 700, marginBottom: '4px', textShadow: '0 2px 10px rgba(0,0,0,0.15)', position: 'relative', display: 'inline-block' }}>
                <span style={{ color: 'white' }}>Why </span>
                <span style={{ color: '#818cf8' }}>IHatePDF?</span>
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
            </div>
            <div className="mobile-grid-1 mobile-gap-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', height: '100%' }}>
              {features.map((f, i) => {
                const colorClasses = ['green', 'red', 'blue', 'orange'];
                
                const cardData = {
                  id: i + 1,
                  colorClass: colorClasses[i],
                  title: f.title,
                  description: f.desc,
                  icon: f.icon
                };

                return (
                  <CourseCard key={cardData.id} data={cardData} />
                );
              })}
            </div>
          </div>

          {/* RIGHT: Three Simple Steps — Premium Glassmorphic Card */}
          <div id="workflow" className="mobile-w-full mobile-mt-16" style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
            <PremiumHowItWorks />
          </div>

        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer>
        <div className="clay-footer" style={{ padding: '16px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>© {new Date().getFullYear()} IHatePDF. Built with 💙 by Sarthak</p>
        </div>
      </footer>
      </div>
    </div>
  );
}
