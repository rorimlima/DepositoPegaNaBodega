import { DB } from './db.js';
import { SyncEngine } from './syncEngine.js';
import { Router } from './router.js';
import { Toast } from './toast.js';
// Import pages to register routes
import './pages/dashboard.js';
import './pages/pdv.js';
import './pages/clientes.js';
import './pages/produtos.js';
import './pages/empresa.js';

(async function init() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch(e) {}
  }
  await DB.open();
  SyncEngine.init();
  SyncEngine.updateBadge();
  if (navigator.onLine) {
    try { await SyncEngine.pullAll(); } catch(e) {}
  }
  document.querySelectorAll('.nav-item,.bottom-nav-item').forEach(el => {
    el.addEventListener('click', () => Router.navigate(el.dataset.page));
  });
  document.getElementById('menu-toggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  };
  document.getElementById('sidebar-overlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  };
  document.getElementById('btn-sync').onclick = () => {
    if (!navigator.onLine) { Toast.warning('Sem conexão!'); return; }
    SyncEngine.sync();
  };
  Router.navigate('dashboard');
})();
