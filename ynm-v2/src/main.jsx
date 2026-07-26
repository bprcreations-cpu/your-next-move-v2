import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Storage shim — works in all environments
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      try { const v = localStorage.getItem(key); return v !== null ? { key, value: v } : null; } catch(e) { return null; }
    },
    set: async (key, value) => {
      try { localStorage.setItem(key, String(value)); return { key, value }; } catch(e) { return null; }
    },
    delete: async (key) => {
      try { localStorage.removeItem(key); return { key, deleted: true }; } catch(e) { return null; }
    },
    list: async (prefix) => {
      try { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys }; } catch(e) { return { keys: [] }; }
    }
  };
}

// Error boundary — no more white screens
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', background: '#FAFAF8' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#B0728A', marginBottom: 16 }}>Something went wrong</p>
        <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 32, color: '#1A1916', marginBottom: 16 }}>We hit an unexpected error.</h2>
        <p style={{ fontSize: 15, color: '#78716C', marginBottom: 32, maxWidth: 380, lineHeight: 1.7 }}>Your saved strategies are safe. Reload the page to continue.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '14px 32px', background: '#1A1916', color: '#fff', border: 'none', borderRadius: 100, fontSize: 13, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Reload the page
        </button>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
