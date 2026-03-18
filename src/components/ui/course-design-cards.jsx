import React from 'react';

const EllipsisIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
  </svg>
);

export const CourseCard = ({ data }) => {
  const {
    colorClass,
    title,
    description,
    icon: IconComp, 
  } = data;

  const getAccentColor = (c) => {
    switch (c) {
      case 'green': return '#00ffcc'; // Hyper-neon cyan-green
      case 'red': return '#ff1166'; // Hyper-neon shocking pink-red
      case 'orange': return '#ffaa00'; // Hyper-neon golden amber
      case 'blue': return '#00aaff'; // Hyper-neon electric azure blue
      default: return '#00aaff';
    }
  };

  const accentColor = getAccentColor(colorClass);

  return (
    <div 
      className={`card ${colorClass}`}
      style={{
        // Enlarged drastically brighter, glowing radial sweep to supercharge the visual neon appearance
        background: `radial-gradient(130% 130% at 95% 5%, ${accentColor}60 0%, transparent 60%), #121822`, 
        borderRadius: '24px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.03)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Header mimics original structural width but using the Icon & Ellipsis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ color: accentColor }}>
          {IconComp && <IconComp size={22} />}
        </div>
        <div style={{ color: '#64748b' }}>
          <EllipsisIcon />
        </div>
      </div>

      {/* Centered Body typography from the reference styling */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.45, margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
};

export default CourseCard;
