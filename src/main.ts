import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { WeatherDashboard } from './client/WeatherDashboard'

// Create the UI
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>RxJS SQLite Adapter</h1>
    <div class="card">
      <p>A reactive adapter for SQLite using RxJS with Node.js backend</p>
    </div>
    <div id="dashboard-container"></div>
    <p class="read-the-docs">
      This demo uses a Node.js backend with the SQLite adapter and a browser frontend
    </p>
  </div>
`

// Initialize the weather dashboard
let dashboard: WeatherDashboard | null = null;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    dashboard = new WeatherDashboard('dashboard-container');
    console.log('Weather dashboard initialized');
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
  }
});

// Clean up when the page is unloaded
window.addEventListener('beforeunload', () => {
  if (dashboard) {
    dashboard.destroy();
    dashboard = null;
  }
});
