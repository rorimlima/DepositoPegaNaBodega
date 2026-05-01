// ========== Router ==========
const Router = {
  _current: 'dashboard',
  _pages: {},

  register(name, renderFn) { this._pages[name] = renderFn; },

  async navigate(page) {
    if (!this._pages[page]) return;
    this._current = page;

    // Update nav items
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update header
    const titles = { dashboard: 'Dashboard', pdv: 'Ponto de Venda', clientes: 'Clientes', produtos: 'Produtos', empresa: 'Minha Empresa' };
    document.getElementById('header-title').textContent = titles[page] || page;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');

    // Render page
    const container = document.getElementById('page-container');
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    try {
      await this._pages[page](container);
    } catch (err) {
      console.error('Page render error:', err);
      container.innerHTML = `<div class="empty-state"><p>Erro ao carregar página</p></div>`;
    }
  },

  get current() { return this._current; }
};
