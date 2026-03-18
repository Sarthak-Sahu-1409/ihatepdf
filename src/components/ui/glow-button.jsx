import React, { forwardRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

export const GlowButton = forwardRef(({ label, color = "#3b82f6", emoji }, ref) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200);
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem 1.75rem',
        backgroundColor: color, // Solid vibrant background
        borderRadius: '12px', // Slightly rounded rectangle instead of full pill
        color: '#ffffff',
        fontSize: '1.05rem',
        fontWeight: 600,
        border: 'none',
        // Intense outer glow matching the button color, plus glassy inner highlights
        boxShadow: `0 0 10px 1px ${color}50, inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.15)`,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isClicked ? 'scale(0.95)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        // Expand the glow and lift the button on hover
        e.currentTarget.style.boxShadow = `0 0 20px 2px ${color}70, inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.15)`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        // Return to resting glow
        e.currentTarget.style.boxShadow = `0 0 10px 1px ${color}50, inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.15)`;
        e.currentTarget.style.transform = isClicked ? 'scale(0.95)' : 'translateY(0)';
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {emoji && <span style={{ fontSize: '18px', display: 'flex' }}>{emoji}</span>}
        {label}
        {/* The sparkles icon from the reference image */}
        <Sparkles size={18} style={{ marginLeft: '4px', opacity: 0.9 }} />
      </span>
    </button>
  );
});

GlowButton.displayName = "GlowButton";
