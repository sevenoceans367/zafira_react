import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@bainbridge/shared-ui/global.css';
import { setupAuthFetch } from '@bainbridge/shared-auth';
import '../cards.css';
import './app-overrides.css';
import App from './App.jsx';

setupAuthFetch();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
