import { DB } from './db.js';
import { SyncEngine } from './syncEngine.js';
import { Router } from './router.js';
import { Toast } from './toast.js';
// Import pages to register routes
import './pages/dashboard.js';
import './pages/pdv.js';
import './pages/vendas.js';
import './pages/clientes.js';
import './pages/produtos.js';
import './pages/empresa.js';

(async function init() {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch(e) {}
  }

  // Open IndexedDB (creates new stores if DB_VERSION bumped)
  await DB.open();

  // Theme initialization
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
      themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') document.body.setAttribute('data-theme', 'dark');
  updateThemeIcon(savedTheme);

  themeToggle.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    if (newTheme === 'dark') document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  };

  // Initialize Sync Engine (network listeners, realtime, delta interval)
  SyncEngine.init();
  SyncEngine.updateBadge();

  // Non-blocking initial data load:
  // - First time: full fetch from Supabase
  // - Subsequent: delta sync only (records changed since last cursor)
  // This runs in background — UI renders immediately from IndexedDB cache
  if (navigator.onLine) {
    SyncEngine.initialLoad().catch(e => console.warn('[App] Initial load error:', e));
  }

  // Navigation
  document.querySelectorAll('.nav-item,.bottom-nav-item').forEach(el => {
    el.addEventListener('click', () => Router.navigate(el.dataset.page));
  });

  // Sidebar mobile toggle
  document.getElementById('menu-toggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  };
  document.getElementById('sidebar-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  };

  // Manual sync button
  document.getElementById('btn-sync').onclick = () => {
    if (!navigator.onLine) { Toast.warning('Sem conexão!'); return; }
    SyncEngine.sync();
  };

  // Navigate to dashboard (renders from IndexedDB cache immediately)
  Router.navigate('dashboard');
})();
