import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// Register service worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');
    
    wb.addEventListener('installed', (event) => {
      if (event.isUpdate) {
        if (confirm('New version available! Reload to update?')) {
          window.location.reload();
        }
      }
    });
    
    wb.register();
  }).catch(() => {
    // Silently fail if workbox is not available
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);