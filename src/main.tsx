import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initDatabase, cleanupDatabase } from './db'

// Initialize the database when the app starts
initDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
});

// Clean up the database when the app is closed
window.addEventListener('beforeunload', () => {
  cleanupDatabase().catch(error => {
    console.error('Failed to clean up database:', error);
  });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
