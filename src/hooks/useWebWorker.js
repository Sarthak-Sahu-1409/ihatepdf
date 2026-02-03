import { useCallback, useEffect, useRef } from 'react';

export function useWebWorker() {
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/pdfWorker.js', import.meta.url),
      { type: 'module' }
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const executeTask = useCallback((type, data, onProgress, onComplete, onError) => {
    if (!workerRef.current) return;

    workerRef.current.onmessage = (e) => {
      const { type: msgType, progress, result, error } = e.data;

      if (msgType === 'PROGRESS') onProgress?.(progress);
      else if (msgType === 'COMPLETE') onComplete?.(result);
      else if (msgType === 'ERROR') onError?.(error);
    };

    workerRef.current.postMessage({ type, data });
  }, []);

  return { executeTask };
}