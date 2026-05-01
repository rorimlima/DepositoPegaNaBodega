// ========== Dashboard Page ==========
Router.register('dashboard', async (container) => {
  const vendas = await DB.getAll('vendas');
  const produtos = await DB.getAll('produtos');
  const clientes = await DB.getAll('clientes');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const calcTotal = (from, to) => vendas.filter(v => {
    const d = new Date(v.created_at);
    return d >= from && d <= (to || now);
  }).reduce((s, v) => s + Number(v.total || 0), 0);

  const faturHoje = calcTotal(today);
  const faturSemanal = calcTotal(weekAgo);
  const faturMensal = calcTotal(monthStart);
  const faturTrimestral = calcTotal(quarterStart);
  const faturAnual = calcTotal(yearStart);
  const vendasHoje = vendas.filter(v => new Date(v.created_at) >= today).length;

  // Chart data: last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const total = calcTotal(d, next);
    days.push({ label, total });
  }
  const maxDay = Math.max(...days.map(d => d.total), 1);

  container.innerHTML = `<div class="page">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Faturamento Hoje</div>
        <div class="stat-value">${Store.formatMoney(faturHoje)}</div>
        <div class="stat-sub">${vendasHoje} venda(s)</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Semanal</div>
        <div class="stat-value">${Store.formatMoney(faturSemanal)}</div>
      </div>
      <div class="stat-card info">
        <div class="stat-label">Mensal</div>
        <div class="stat-value">${Store.formatMoney(faturMensal)}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Trimestral</div>
        <div class="stat-value">${Store.formatMoney(faturTrimestral)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Vendas - Últimos 7 dias</h3></div>
        <div class="chart-container">
          <div class="chart-bar-group">
            ${days.map(d => `<div class="chart-bar-wrapper">
              <div class="chart-bar" style="height:${Math.max((d.total / maxDay) * 180, 4)}px" title="${Store.formatMoney(d.total)}"></div>
              <div class="chart-bar-label">${d.label}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Resumo</h3></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <span style="color:var(--text-secondary)">Faturamento Anual</span>
            <span style="font-weight:700">${Store.formatMoney(faturAnual)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <span style="color:var(--text-secondary)">Total de Vendas</span>
            <span style="font-weight:700">${vendas.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <span style="color:var(--text-secondary)">Produtos Cadastrados</span>
            <span style="font-weight:700">${produtos.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <span style="color:var(--text-secondary)">Clientes Cadastrados</span>
            <span style="font-weight:700">${clientes.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
            <span style="color:var(--text-secondary)">Produtos com Estoque Baixo</span>
            <span style="font-weight:700;color:var(--warning)">${produtos.filter(p => p.estoque_atual <= 5 && p.estoque_atual > 0).length}</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
});
