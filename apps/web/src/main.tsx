import '@/monaco-setup';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="dark min-h-svh bg-background font-sans text-foreground antialiased">
      <App />
    </div>
  </StrictMode>,
);
