export const Router = {
  _current: 'dashboard', _pages: {},
  register(name, fn) { this._pages[name] = fn; },
  async navigate(page) {
    if (!this._pages[page]) return;
    this._current = page;
    document.querySelectorAll('.nav-item,.bottom-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = { dashboard:'Dashboard', pdv:'Ponto de Venda', clientes:'Clientes', produtos:'Produtos', empresa:'Minha Empresa' };
    document.getElementById('header-title').textContent = titles[page] || page;
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
    const c = document.getElementById('page-container');
    c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Carregando...</div>';
    try { await this._pages[page](c); } catch(e) { console.error(e); c.innerHTML = '<div class="empty-state"><p>Erro ao carregar</p></div>'; }
  },
  get current() { return this._current; }
};
