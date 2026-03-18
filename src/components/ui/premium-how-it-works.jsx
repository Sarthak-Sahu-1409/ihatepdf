import React from 'react';
import { UploadCloud, Cpu, Download } from 'lucide-react';
import { PixelCanvas } from './pixel-canvas';

const steps = [
  {
    icon: <UploadCloud size={24} strokeWidth={1.5} />,
    title: 'Upload File',
    desc: 'Securely drop your PDF directly into the browser. No external uploads required.'
  },
  {
    icon: <Cpu size={24} strokeWidth={1.5} />,
    title: 'WASM Process',
    desc: 'Local WebAssembly engine instantly compresses, merges, or splits your document.'
  },
  {
    icon: <Download size={24} strokeWidth={1.5} />,
    title: 'Instant Save',
    desc: 'Retrieve your pristine, fully processed file with zero server-side delays.'
  }
];

export const PremiumHowItWorks = () => {
  return (
    <div className="phiw-wrapper">
      <div className="phiw-card group">
        <PixelCanvas
          gap={30}
          speed={10}
          colors={["#e0f2fe", "#7dd3fc", "#0ea5e9"]}
          variant="default"
          style={{ zIndex: 1 }}
        />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div className="phiw-header">
            <span className="phiw-label">Workflow</span>
            <h2 className="phiw-title">How it works</h2>
          </div>

          <div className="phiw-timeline">
            {steps.map((step, idx) => (
              <div className="phiw-step" key={idx} style={{ animationDelay: `${0.1 + idx * 0.15}s` }}>
                <div className="phiw-icon-col">
                  <div className="phiw-icon-wrapper">
                    <span className="phiw-icon">{step.icon}</span>
                  </div>
                  {/* Glowing Separator Line (except last) */}
                  {idx !== steps.length - 1 && (
                    <div className="phiw-separator">
                       <div className="phiw-separator-glow" />
                    </div>
                  )}
                </div>
                <div className="phiw-content-col">
                  <h3 className="phiw-step-title">{step.title}</h3>
                  <p className="phiw-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .phiw-wrapper {
          position: relative;
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          perspective: 1200px;
          /* Ensures the 3D hover doesn't get clipped by nearby components */
          z-index: 10; 
        }

        .phiw-card {
          position: relative;
          background: #080c16;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 32px;
          padding: 32px 32px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          overflow: hidden;
          transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.5s ease;
          will-change: transform;
        }

        .phiw-card:hover {
          transform: translateY(-6px) rotateX(3deg) rotateY(-2deg);
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }

        .phiw-header {
          text-align: left;
          margin-bottom: 24px;
        }

        .phiw-label {
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          background: linear-gradient(to right, #60a5fa, #2dd4bf);
          -webkit-background-clip: text;
          color: transparent;
          margin-bottom: 8px;
          display: inline-block;
        }

        .phiw-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.03em;
          margin: 0;
          line-height: 1.1;
        }

        .phiw-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .phiw-step {
          display: flex;
          align-items: stretch;
          gap: 20px;
          opacity: 0;
          transform: translateY(20px);
          animation: phiw-fadeSlide 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes phiw-fadeSlide {
          to { opacity: 1; transform: translateY(0); }
        }

        .phiw-icon-col {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .phiw-icon-wrapper {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 20px rgba(0,0,0,0.3);
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s ease, box-shadow 0.3s ease;
          z-index: 2;
        }

        .phiw-step:hover .phiw-icon-wrapper {
          transform: scale(1.1) translateY(-2px);
          border-color: rgba(56, 189, 248, 0.5);
          box-shadow: 0 15px 30px rgba(0,0,0,0.5), 0 0 25px rgba(56, 189, 248, 0.4);
        }

        .phiw-icon {
          color: #94a3b8;
          transition: color 0.3s ease, filter 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .phiw-step:hover .phiw-icon {
          color: #ffffff;
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.6));
        }

        /* Soft Glowing Separator Line */
        .phiw-separator {
          width: 2px;
          flex-grow: 1;
          min-height: 20px;
          background: rgba(255, 255, 255, 0.05);
          margin: 8px 0;
          position: relative;
          overflow: hidden;
          border-radius: 2px;
        }

        /* Animated Vercel-style glowing photon scanline */
        .phiw-separator-glow {
          position: absolute;
          top: -40px;
          left: 0;
          width: 100%;
          height: 40px;
          background: linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.9), #fff);
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
          animation: phiw-scanline 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        .phiw-step:nth-child(2) .phiw-separator-glow {
          animation-delay: 1.2s;
        }

        @keyframes phiw-scanline {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(120px); opacity: 0; }
          100% { transform: translateY(120px); opacity: 0; }
        }

        .phiw-content-col {
          padding-top: 6px;
          padding-bottom: 12px;
          flex: 1;
        }

        .phiw-step-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0 0 8px 0;
          letter-spacing: -0.01em;
          transition: color 0.3s ease;
        }

        .phiw-step:hover .phiw-step-title {
          color: #ffffff;
        }

        .phiw-step-desc {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
          margin: 0;
          max-width: 280px;
          transition: color 0.3s ease;
        }

        .phiw-step:hover .phiw-step-desc {
          color: #cbd5e1;
        }
      `}</style>
    </div>
  );
};
