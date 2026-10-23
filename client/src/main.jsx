import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { applyTheme, getTheme } from './utils/theme'
import './index.css'

// Apply the saved theme before first paint (avoids a flash of the wrong theme).
applyTheme(getTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            background: '#ffffff',
            color: '#24145b',
            border: '1px solid #e4e8f2',
            borderRadius: '0.9rem',
            fontSize: '0.875rem',
            padding: '10px 14px',
            boxShadow: '0 16px 40px rgba(36,20,91,0.12)',
          },
          success: {
            iconTheme: { primary: '#245BFF', secondary: '#ffffff' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#ffffff' },
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>
)
