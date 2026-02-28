import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// vite-plugin-pwa injects the SW registration automatically via injectRegister:'auto'.
// This module is the virtual shim that handles update prompts.
import { registerSW } from 'virtual:pwa-register';

registerSW({
  // Re-check for a new SW every hour while the app is open
  onRegisteredSW(swUrl, r) {
    r && setInterval(async () => {
      if (!r.installing && navigator.onLine) {
        const resp = await fetch(swUrl, { cache: 'no-store', headers: { cache: 'no-store' } });
        if (resp?.status === 200) await r.update();
      }
    }, 60 * 60 * 1000);
  },
  // Silently auto-update — no confirm dialog needed for a local-only tool
  onNeedRefresh() {},
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
