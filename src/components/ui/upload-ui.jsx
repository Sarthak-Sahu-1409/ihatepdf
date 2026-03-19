import React, { useState } from 'react';
import { X, ArrowDownCircle, CheckCircle, XCircle, UploadCloud } from 'lucide-react';

export const UploadCard = ({
  status = 'idle',
  progress = 0,
  title,
  description,
  primaryButtonText,
  onPrimaryButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
  onDrop,
  onClick
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const isIdle = status === 'idle';
  const isUploading = status === 'uploading';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const handleDragOver = (e) => {
    e.preventDefault();
    if (isIdle) setIsDragOver(true);
  };
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isIdle && onDrop) onDrop(e);
  };

  // Premium styling properties matching reference exactly
  const getTheme = () => {
    if (isUploading) return { glow: 'rgba(59,130,246,0.35)', iconColor: '#60A5FA', icon: <ArrowDownCircle size={22} color="#60A5FA" strokeWidth={2} /> };
    if (isSuccess) return { glow: 'rgba(16,185,129,0.3)', iconColor: '#34D399', icon: <CheckCircle size={22} color="#34D399" strokeWidth={2} /> };
    if (isError) return { glow: 'rgba(239,68,68,0.3)', iconColor: '#F87171', icon: <XCircle size={22} color="#F87171" strokeWidth={2} /> };
    
    return { 
      glow: isDragOver ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.25)', 
      iconColor: isDragOver ? '#A5B4FC' : '#818CF8', 
      icon: <UploadCloud size={22} color={isDragOver ? '#A5B4FC' : '#818CF8'} strokeWidth={2.5} /> 
    };
  };

  const theme = getTheme();

  return (
    <div
      onClick={isIdle ? onClick : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        borderRadius: '14px',
        backgroundColor: '#1C1D21', // Closer to the reference image background
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
        border: isIdle ? (isDragOver ? '1px dashed rgba(99,102,241,0.5)' : '1px dashed rgba(255,255,255,0.12)') : '1px solid rgba(255,255,255,0.06)',
        padding: '28px 24px',
        cursor: isIdle ? 'pointer' : 'default',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'all 0.2s ease',
        transform: isIdle && isDragOver ? 'scale(1.02)' : 'scale(1)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Top right gradient glow covering exactly the reference area */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 100% 0%, ${theme.glow} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Close button */}
      {!isIdle && (
        <button
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#A1A1AA',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'white'}
          onMouseLeave={e => e.currentTarget.style.color = '#A1A1AA'}
        >
          <X size={16} />
        </button>
      )}

      <div style={{ display: 'flex', alignItems: isIdle ? 'center' : 'flex-start', gap: '20px', position: 'relative', zIndex: 10 }}>
        {/* Left Icon matching proportions */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isIdle ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${theme.iconColor}30`,
          boxShadow: isIdle ? 'inset 0 2px 4px rgba(255,255,255,0.05)' : 'none'
        }}>
          {theme.icon}
        </div>

        {/* Right Content */}
        <div style={{ flex: 1, minWidth: 0, marginTop: isIdle ? '0' : '2px' }}>
          <h3 style={{ 
            color: 'white', 
            fontSize: '1.05rem', 
            fontWeight: 700, 
            margin: '0 0 6px 0',
            letterSpacing: '0.01em'
          }}>
            {title}
          </h3>
          <p style={{ 
            color: '#A1A1AA', 
            fontSize: '0.85rem', 
            margin: isIdle ? '0' : '0 0 24px 0',
            lineHeight: 1.5,
            paddingRight: !isIdle ? '24px' : '0'
          }}>
            {description}
          </p>

          {/* Uploading State matched to reference */}
          {isUploading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginTop: '16px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-22px', right: '0', color: '#E4E4E7', fontSize: '0.75rem', fontWeight: 600 }}>
                  {progress}%
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '4px', 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '99px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #4338CA, #60A5FA)',
                    width: progress + '%',
                    borderRadius: '99px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
              {secondaryButtonText && (
                <button
                  onClick={onSecondaryButtonClick}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#E4E4E7',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '6px 20px',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
                >
                  {secondaryButtonText}
                </button>
              )}
            </div>
          )}

          {/* Success / Error State Buttons matched to reference */}
          {(isSuccess || isError) && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {primaryButtonText && (
                <button
                  onClick={onPrimaryButtonClick}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#E4E4E7',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '8px 24px',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
                >
                  {primaryButtonText}
                </button>
              )}
              {secondaryButtonText && (
                <button
                  onClick={onSecondaryButtonClick}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#E4E4E7',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '8px 24px',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E4E4E7'; }}
                >
                  {secondaryButtonText}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
