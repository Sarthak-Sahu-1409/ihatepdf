import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const DownloadButton = ({ onDownload, label = "Download" }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    onDownload?.();
    setTimeout(() => {
      setIsDownloading(false);
    }, 3500);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
      <motion.button
        onClick={handleDownloadClick}
        initial={false}
        animate={{ width: isDownloading ? 56 : 220 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          border: '2px solid #3B82F6',
          borderRadius: '9999px',
          overflow: 'hidden',
          cursor: isDownloading ? 'wait' : 'pointer',
          height: '52px',
          background: 'transparent',
          padding: 0,
        }}
      >
        {/* Spinning dot inside the circle during loading */}
        <AnimatePresence>
          {isDownloading && (
            <motion.div
              key="spinner"
              initial={{ opacity: 1 }}
              animate={{
                rotate: 360,
                x: [0, 18, 0, -18, 0],
                y: [0, -18, 0, 18, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 3,
                ease: 'easeInOut',
                times: [0, 0.25, 0.5, 0.75, 1]
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '8px',
                height: '8px',
                backgroundColor: 'white',
                borderRadius: '50%',
                margin: 'auto',
                zIndex: 20,
              }}
            />
          )}
        </AnimatePresence>

        {/* Blue circle with icon */}
        <motion.div
          animate={isDownloading ? { rotate: 180, scale: [0.95, 1, 0.95] } : { rotate: 0, scale: 1 }}
          transition={{ duration: isDownloading ? 1 : 0.4, times: isDownloading ? [0, 0.7, 1] : undefined }}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#3B82F6',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Progress fill inside circle */}
          <motion.div
            initial={{ height: '0%' }}
            animate={isDownloading ? { height: '100%' } : { height: '0%' }}
            transition={{ duration: 3, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              borderRadius: '50%',
              backgroundColor: '#1D4ED8',
              zIndex: 1,
            }}
          />

          {/* Arrow download icon */}
          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 1 }}
            animate={{ opacity: isDownloading ? 0 : 1 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'relative', zIndex: 20 }}
          >
            <path d="M12 19V5m0 14-4-4m4 4 4-4" />
          </motion.svg>

          {/* White loading dot */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isDownloading ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'white',
              position: 'absolute',
              zIndex: 20,
            }}
          />
        </motion.div>

        {/* Label text */}
        <AnimatePresence>
          {!isDownloading && (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                marginLeft: '10px',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                zIndex: 10,
                paddingRight: '16px',
              }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};