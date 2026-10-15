import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@bainbridge/shared-ui/global.css';
import { initSharedAuth, setupAuthFetch } from '@bainbridge/shared-auth';
import '../cards.css';
import './app-overrides.css';
import App from './App.jsx';

// Keep internal/ops sessions separate from admin (and agent) on the same origin.
initSharedAuth({ sessionScope: 'internal' });
setupAuthFetch();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
