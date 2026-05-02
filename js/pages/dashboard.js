import { SyncEngine } from '../syncEngine.js';
import { Store } from '../store.js';
import { Router } from '../router.js';

Router.register('dashboard', async (container) => {
  let _unsub = null;

  async function render() {
    const vendas = await SyncEngine.getAll('vendas');
    const produtos = await SyncEngine.getAll('produtos');
    const clientes = await SyncEngine.getAll('clientes');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const calc = (from, to) => vendas.filter(v => { const d = new Date(v.created_at); return d >= from && d <= (to||now); }).reduce((s,v) => s + Number(v.total||0), 0);
    const fH = calc(today), fS = calc(weekAgo), fM = calc(monthStart), fT = calc(quarterStart), fA = calc(yearStart);
    const vH = vendas.filter(v => new Date(v.created_at) >= today).length;
    const days = [];
    for (let i=6;i>=0;i--) { const d = new Date(today); d.setDate(d.getDate()-i); const n = new Date(d); n.setDate(n.getDate()+1); days.push({ label: d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''), total: calc(d,n) }); }
    const maxD = Math.max(...days.map(d=>d.total), 1);
    const ultimasVendas = [...vendas].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    container.innerHTML = `<div class="page">
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Faturamento Hoje</div><div class="stat-value">${Store.formatMoney(fH)}</div><div class="stat-sub">${vH} venda(s)</div></div>
        <div class="stat-card success"><div class="stat-label">Semanal</div><div class="stat-value">${Store.formatMoney(fS)}</div></div>
        <div class="stat-card info"><div class="stat-label">Mensal</div><div class="stat-value">${Store.formatMoney(fM)}</div></div>
        <div class="stat-card warning"><div class="stat-label">Trimestral</div><div class="stat-value">${Store.formatMoney(fT)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card"><div class="card-header"><h3 class="card-title">Vendas - 7 dias</h3></div>
          <div class="chart-container"><div class="chart-bar-group">${days.map(d=>`<div class="chart-bar-wrapper"><div class="chart-bar" style="height:${Math.max((d.total/maxD)*180,4)}px" title="${Store.formatMoney(d.total)}"></div><div class="chart-bar-label">${d.label}</div></div>`).join('')}</div></div>
        </div>
        <div class="card"><div class="card-header"><h3 class="card-title">Resumo</h3></div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${[['Faturamento Anual',Store.formatMoney(fA)],['Total Vendas',vendas.length],['Produtos',produtos.length],['Clientes',clientes.length],['Estoque Baixo',produtos.filter(p=>p.estoque_atual<=5&&p.estoque_atual>0).length]].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)"><span style="color:var(--text-secondary)">${l}</span><span style="font-weight:700">${v}</span></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">Últimas Vendas</h3></div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr><th>Código</th><th>Data</th><th>Cliente</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${ultimasVendas.length === 0 ? '<tr><td colspan="4" style="text-align:center">Nenhuma venda encontrada</td></tr>' : ultimasVendas.map(v => {
                const cli = clientes.find(c => c.id === v.cliente_id);
                return `<tr>
                  <td><span style="font-weight:600;color:var(--accent)">#${v.codigo_venda || v.id.substring(0,8)}</span></td>
                  <td>${new Date(v.created_at).toLocaleString('pt-BR')}</td>
                  <td>${cli ? cli.nome : 'Cliente Balcão'}</td>
                  <td style="font-weight:700">${Store.formatMoney(v.total)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }

  await render();

  // Subscribe to realtime changes — auto re-render dashboard
  _unsub = SyncEngine.subscribe(['vendas', 'produtos', 'clientes'], () => {
    if (Router.current === 'dashboard') render();
  });
});
