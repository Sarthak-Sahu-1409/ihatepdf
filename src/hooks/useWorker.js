/* ════════════════════════════════════════════════════════════════
   useWorker — Reusable React hook for Web Worker communication
   
   Provides: run(action, payload, transferables?) → Promise<result>
   Plus reactive progress state and cancellation.
   ════════════════════════════════════════════════════════════════ */

import { useRef, useState, useCallback, useEffect } from 'react';

// Import workers using Vite's ?worker query for proper bundling
import PdfWorker from '../workers/pdf.worker.js?worker';
import ImageWorker from '../workers/image.worker.js?worker';

const WORKER_MAP = {
  pdf: PdfWorker,
  image: ImageWorker,
};

/**
 * @param {'pdf' | 'image'} workerType — which worker to use
 * @returns {{ run, progress, cancel, running }}
 */
export function useWorker(workerType) {
  const workerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Run an action on the worker.
   * @param {string} action — e.g. 'merge', 'compress', 'pdfToJpg', 'jpgToPdf'
   * @param {object} payload — data to send to the worker
   * @param {Transferable[]} [transferables] — optional transferable objects
   * @returns {Promise<any>} — resolves with the worker's result
   */
  const run = useCallback((action, payload, transferables = []) => {
    return new Promise((resolve, reject) => {
      // Create a fresh worker for each run to avoid stale state
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const WorkerClass = WORKER_MAP[workerType];
      if (!WorkerClass) {
        return reject(new Error(`Unknown worker type: ${workerType}`));
      }

      const worker = new WorkerClass();
      workerRef.current = worker;
      setRunning(true);
      setProgress(0);

      worker.onmessage = (e) => {
        const msg = e.data;

        switch (msg.type) {
          case 'progress':
            setProgress(msg.value);
            break;

          case 'result':
            setRunning(false);
            resolve(msg);
            break;

          case 'error':
            setRunning(false);
            reject(new Error(msg.message));
            break;

          default:
            break;
        }
      };

      worker.onerror = (err) => {
        setRunning(false);
        reject(new Error(err.message || 'Worker execution failed'));
      };

      // Post message with transferables for zero-copy
      worker.postMessage({ action, payload }, transferables);
    });
  }, [workerType]);

  /**
   * Cancel the currently running worker operation.
   */
  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setRunning(false);
      setProgress(0);
    }
  }, []);

  return { run, progress, cancel, running };
}
