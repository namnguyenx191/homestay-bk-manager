import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { CurrencyProvider } from './context/CurrencyContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <App />
            <Toaster position="top-right" />
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
