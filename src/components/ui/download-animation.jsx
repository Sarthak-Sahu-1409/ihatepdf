import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SAVE_RESULT_BROWSER } from '../../utils/saveBlobToDisk';

/**
 * Download CTA: loading, then success only when the handler confirms a real save.
 *
 * Return `true` after a confirmed write (Save picker finished). Return `false` if cancelled or nothing to save.
 * Return `SAVE_RESULT_BROWSER` or `undefined` for anchor-only downloads (no false "Downloaded!").
 */

// Input: none. Output: { schedule, clearTimers } for timeout management.
// Queues timeouts in a ref and clears them on unmount to avoid setState after unmount.
function useDownloadTimers() {
  const timersRef = useRef([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { schedule, clearTimers };
}

export const DownloadButton = ({
  onDownload,
  label = 'Download',
  disabled = false,
}) => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'done'
  const mountedRef = useRef(true);
  const { schedule, clearTimers } = useDownloadTimers();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Input: next status ('idle' | 'loading' | 'done'). Output: void.
  // Sets React state only when the component is still mounted (avoids warnings on unmount).
  const safeSetStatus = useCallback((next) => {
    if (mountedRef.current) setStatus(next);
  }, []);

  // Input: none. Output: void.
  // Maps onDownload result: only `true` shows success; `false` / throw reset; browser/undefined skips success.
  const handleDownloadClick = async () => {
    if (status !== 'idle' || disabled) return;
    clearTimers();
    setStatus('loading');

    const startTime = Date.now();

    let result;
    try {
      result = await Promise.resolve(onDownload?.());
    } catch (_) {
      safeSetStatus('idle');
      return;
    }

    const elapsed = Date.now() - startTime;
    const remainingForSuccess = Math.max(0, 1500 - elapsed);

    const browserHandled =
      result === SAVE_RESULT_BROWSER || result === undefined;

    if (result === false) {
      safeSetStatus('idle');
      return;
    }

    // Both confirmed saves (true) and browser-handled anchor downloads show "Downloaded!"
    const delay = browserHandled
      ? Math.max(0, 400 - elapsed)   // anchor is instant; short loading feel
      : remainingForSuccess;          // picker: wait out the 1.5 s minimum

    schedule(() => {
      safeSetStatus('done');
      schedule(() => safeSetStatus('idle'), 2500);
    }, delay);
  };

  const isLoading = status === 'loading';
  const isDone = status === 'done';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginBottom: '16px',
      }}
    >
      <motion.button
        type="button"
        onClick={handleDownloadClick}
        disabled={disabled || isLoading || isDone}
        initial={false}
        animate={{ maxWidth: isLoading ? 56 : 280 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          border: `2px solid ${isDone ? '#22C55E' : '#3B82F6'}`,
          borderRadius: '9999px',
          overflow: 'hidden',
          cursor: disabled ? 'not-allowed' : isLoading ? 'wait' : 'pointer',
          height: '52px',
          background: 'transparent',
          padding: 0,
          opacity: disabled ? 0.45 : 1,
          transition: 'border-color 0.25s ease, opacity 0.2s ease',
        }}
      >
        <motion.div
          animate={
            isLoading
              ? { scale: [1, 1.03, 1] }
              : { scale: 1 }
          }
          transition={
            isLoading
              ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.25 }
          }
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isDone ? '#22C55E' : '#3B82F6',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            boxShadow: isDone
              ? '0 4px 14px rgba(34,197,94,0.4)'
              : '0 4px 14px rgba(59,130,246,0.4)',
            flexShrink: 0,
            zIndex: 10,
            overflow: 'hidden',
            transition: 'background-color 0.25s ease, box-shadow 0.25s ease',
          }}
        >
          <motion.div
            initial={false}
            animate={
              isLoading
                ? { scaleY: 0.88 }
                : isDone
                  ? { scaleY: 1 }
                  : { scaleY: 0 }
            }
            transition={{
              duration: isLoading ? 12 : 0.35,
              ease: isLoading ? [0.22, 1, 0.36, 1] : 'easeInOut',
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transformOrigin: 'bottom',
              backgroundColor: '#1D4ED8',
              zIndex: 1,
            }}
          />

          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="spinner"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 0.15 },
                  rotate: { repeat: Infinity, duration: 0.75, ease: 'linear' },
                }}
                style={{
                  position: 'absolute',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.28)',
                  borderTopColor: '#fff',
                  zIndex: 20,
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {isDone && (
              <motion.svg
                key="check"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'relative', zIndex: 20 }}
              >
                <polyline points="20 6 9 17 4 12" />
              </motion.svg>
            )}
          </AnimatePresence>

          <motion.svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ opacity: isLoading || isDone ? 0 : 1 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'absolute', zIndex: 20, pointerEvents: 'none' }}
          >
            <path d="M12 19V5m0 14-4-4m4 4 4-4" />
          </motion.svg>
        </motion.div>

        <AnimatePresence initial={false}>
          {!isLoading && (
            <motion.span
              key={isDone ? 'done' : 'label'}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.2 }}
              style={{
                marginLeft: '10px',
                color: isDone ? '#22C55E' : 'white',
                fontSize: '0.9rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                zIndex: 10,
                paddingRight: '16px',
                transition: 'color 0.25s ease',
              }}
            >
              {isDone ? 'Downloaded!' : label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
