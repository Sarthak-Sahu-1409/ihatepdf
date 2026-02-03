import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { Workbox } from 'workbox-window';

// Register service worker
if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');
  
  wb.addEventListener('installed', (event) => {
    if (event.isUpdate) {
      if (confirm('New version available! Reload to update?')) {
        window.location.reload();
      }
    }
  });
  
  wb.register();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);