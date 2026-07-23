import React from 'react';
import ReactDOM from 'react-dom/client';
import { client, SigmaClientProvider } from '@sigmacomputing/plugin';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SigmaClientProvider client={client}>
      <App />
    </SigmaClientProvider>
  </React.StrictMode>,
);
