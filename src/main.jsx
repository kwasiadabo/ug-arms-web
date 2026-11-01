/**
 * Browser entry point of the UG-ARMS frontend.
 *
 * Loads the global styles, reports uncaught errors and unhandled promise rejections to the API (message, stack and
 * route only), and renders the application inside React's strict mode and a top-level error boundary.
 *
 * @author Kwasi Adabo Boakye
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';
import { ErrorBoundary } from './components/feedback/ErrorBoundary.jsx';
import { reportClientError } from './lib/api.js';

window.addEventListener('error', (e) => reportClientError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportClientError(e.reason));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
