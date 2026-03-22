/**
 * Generic card with an animated dithering shader background.
 *
 * Adapted from the Aceternity / paper-design prompt:
 * - No "use client" (Vite/React, not Next.js)
 * - All layout via inline styles — avoids Tailwind scan issues
 * - The Dithering shader is lazy-loaded so it never blocks first paint
 * - `accentColor` defaults to the site's indigo to match theme
 */
import { useState, Suspense, lazy } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const Dithering = lazy(() =>
  import('@paper-design/shaders-react').then((mod) => ({ default: mod.Dithering }))
);

export interface HeroDitheringCardProps {
  /** Content rendered inside the card. */
  children: ReactNode;
  /** Shader foreground colour. Defaults to site indigo. */
  accentColor?: string;
  /** Minimum card height in px. */
  minHeight?: number;
  /** Extra styles applied to the outer wrapper. */
  style?: CSSProperties;
}

// Input: HeroDitheringCardProps. Output: rounded card with animated dithering background.
// Speed increases on hover for a subtle interactive feel.
export function HeroDitheringCard({
  children,
  accentColor = '#6366f1',
  minHeight = 460,
  style,
}: HeroDitheringCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ width: '100%', ...style }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 32,
          border: `1px solid ${hovered ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.07)'}`,
          background: '#100e1a',
          minHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.4s ease',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Dithering shader — lazy, never blocks paint */}
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.04)' }} />}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: 'none',
              opacity: hovered ? 0.45 : 0.28,
              mixBlendMode: 'screen',
              transition: 'opacity 0.5s ease',
            }}
          >
            <Dithering
              colorBack="#00000000"
              colorFront={accentColor}
              shape="warp"
              type="4x4"
              speed={hovered ? 0.6 : 0.18}
              style={{ width: '100%', height: '100%' }}
              minPixelRatio={1}
            />
          </div>
        </Suspense>

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            padding: '48px 28px',
            maxWidth: 560,
            width: '100%',
            margin: '0 auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default HeroDitheringCard;
