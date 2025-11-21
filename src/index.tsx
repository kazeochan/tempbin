import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from "@vercel/speed-insights/react"
import './i18n/config';
import App from './App';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
      <SpeedInsights />
    </React.StrictMode>
  );
}