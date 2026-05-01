// ========== App Initialization ==========
(async function () {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) { console.log('SW registration skipped', e); }
  }

  // Initialize IndexedDB
  await DB.open();

  // Initialize Sync Engine
  SyncEngine.init();
  SyncEngine.updateBadge();

  // Initial data pull
  if (navigator.onLine) {
    try { await SyncEngine._pullAll(); } catch (e) { console.log('Initial pull skipped'); }
  }

  // Navigation events
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
    el.addEventListener('click', () => Router.navigate(el.dataset.page));
  });

  // Mobile menu toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  });

  // Sync button
  document.getElementById('btn-sync').addEventListener('click', () => {
    if (!navigator.onLine) { Toast.warning('Sem conexão com a internet!'); return; }
    SyncEngine.sync();
  });

  // Load initial page
  Router.navigate('dashboard');
})();
