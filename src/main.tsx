import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless ResizeObserver loop limit exceeded error
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
