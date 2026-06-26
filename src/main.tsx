import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept benign WebSocket/HMR errors arising from disabled HMR in AI Studio sandbox
if (typeof window !== 'undefined') {
  const isViteWsError = (err: any) => {
    if (!err) return false;
    const message = err.message || String(err);
    return (
      message.includes('WebSocket') ||
      message.includes('failed to connect to websocket') ||
      message.includes('ws://') ||
      message.includes('wss://')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isViteWsError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isViteWsError(event.error) || isViteWsError(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

