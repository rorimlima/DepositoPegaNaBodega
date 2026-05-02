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
