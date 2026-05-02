import { SyncEngine } from '../syncEngine.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { Toast } from '../toast.js';
import { Modal } from '../modal.js';
import { Receipt } from '../receipt.js';
import { CONFIG } from '../config.js';

/**
 * ═══════════════════════════════════════════════════════════════
 * VENDAS PAGE — Full sales management with view/edit/delete
 * ═══════════════════════════════════════════════════════════════
 */
Router.register('vendas', async (container) => {
  let vendas = await SyncEngine.getAll('vendas');
  let clientes = await SyncEngine.getAll('clientes');
  let curFilter = 'all';

  // ── Build Main UI ──
  function buildUI() {
    container.innerHTML = `<div class="page">
      <div class="toolbar">
        <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="v-search" placeholder="Buscar por código, cliente...">
        </div>
      </div>
      <div class="filter-pills" id="v-filters">
        <button class="filter-pill active" data-f="all">Todas</button>
        <button class="filter-pill" data-f="today">Hoje</button>
        <button class="filter-pill" data-f="week">Semana</button>
        <button class="filter-pill" data-f="month">Mês</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Status</th>
              <th style="width:160px">Ações</th>
            </tr>
          </thead>
          <tbody id="v-tbody"></tbody>
        </table>
      </div>
    </div>`;

    renderTable();

    document.getElementById('v-search').oninput = (e) => renderTable(e.target.value);
    document.getElementById('v-filters').onclick = (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      document.querySelectorAll('#v-filters .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      curFilter = pill.dataset.f;
      renderTable(document.getElementById('v-search')?.value || '');
    };
  }

  // ── Render Table ──
  function renderTable(search = '') {
    const tb = document.getElementById('v-tbody');
    if (!tb) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let filtered = [...vendas];

    // Date filter
    if (curFilter === 'today') filtered = filtered.filter(v => new Date(v.created_at) >= today);
    else if (curFilter === 'week') filtered = filtered.filter(v => new Date(v.created_at) >= weekAgo);
    else if (curFilter === 'month') filtered = filtered.filter(v => new Date(v.created_at) >= monthStart);

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(v => {
        const cli = clientes.find(c => c.id === v.cliente_id);
        const cliNome = cli ? cli.nome.toLowerCase() : '';
        const codigo = (v.codigo_venda || v.id.substring(0, 8)).toLowerCase();
        return cliNome.includes(s) || codigo.includes(s);
      });
    }

    // Sort by most recent
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!filtered.length) {
      tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Nenhuma venda encontrada</td></tr>';
      return;
    }

    tb.innerHTML = filtered.map(v => {
      const cli = clientes.find(c => c.id === v.cliente_id);
      const statusClass = v.status === 'cancelada' ? 'badge-danger' : v.status === 'pendente' ? 'badge-warning' : 'badge-success';
      return `<tr>
        <td><span style="font-weight:600;color:var(--accent)">#${v.codigo_venda || v.id.substring(0, 8)}</span></td>
        <td>${new Date(v.created_at).toLocaleString('pt-BR')}</td>
        <td>${cli ? cli.nome : 'Cliente Balcão'}</td>
        <td style="font-weight:700">${Store.formatMoney(v.total)}</td>
        <td><span class="badge ${statusClass}">${v.status || 'finalizada'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn-view" data-id="${v.id}" title="Detalhes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn-edit" data-id="${v.id}" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-print" data-id="${v.id}" title="Recibo PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
            <button class="btn-delete" data-id="${v.id}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    // Bind actions
    tb.querySelectorAll('.btn-view').forEach(b => b.onclick = () => viewDetails(b.dataset.id));
    tb.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => editSale(b.dataset.id));
    tb.querySelectorAll('.btn-print').forEach(b => b.onclick = () => printSale(b.dataset.id));
    tb.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteSale(b.dataset.id));
  }

  // ── View Details ──
  async function viewDetails(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    const cli = clientes.find(c => c.id === venda.cliente_id) || { nome: 'Cliente Balcão' };
    const itens = (await SyncEngine.getAll('itens_venda')).filter(i => i.venda_id === id);
    const pags = (await SyncEngine.getAll('pagamentos_venda')).filter(p => p.venda_id === id);

    const statusClass = venda.status === 'cancelada' ? 'status-devedor' : venda.status === 'pendente' ? 'status-alerta' : 'status-ok';
    const statusText = venda.status === 'cancelada' ? 'Cancelada' : venda.status === 'pendente' ? 'Pendente' : 'Finalizada';

    Modal.open('Detalhes da Venda', `
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Código</div>
          <div class="detail-value accent">#${venda.codigo_venda || venda.id.substring(0, 8)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Data</div>
          <div class="detail-value">${new Date(venda.created_at).toLocaleString('pt-BR')}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Cliente</div>
          <div class="detail-value">${cli.nome}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div class="detail-value"><span class="status-badge ${statusClass}">${statusText}</span></div>
        </div>
        <div class="detail-item detail-full">
          <div class="detail-label">Total</div>
          <div class="detail-value accent">${Store.formatMoney(venda.total)}</div>
        </div>
      </div>

      <div class="section-title">Itens da Venda</div>
      <div class="table-wrapper" style="margin-bottom:16px">
        <table>
          <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>
            ${itens.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Sem itens</td></tr>' :
        itens.map(it => `<tr>
                <td style="font-weight:600">${it.produto_nome}</td>
                <td style="text-align:center">${it.quantidade}</td>
                <td style="text-align:right">${Store.formatMoney(it.preco_unitario)}</td>
                <td style="text-align:right;font-weight:700;color:var(--accent)">${Store.formatMoney(it.subtotal)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="section-title">Pagamentos</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
        ${pags.length === 0 ? '<div style="color:var(--text-muted);font-size:13px">Sem pagamentos registrados</div>' :
        pags.map(p => `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border)">
            <span style="font-weight:600">${p.forma_pagamento}</span>
            <span>${p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : ''}</span>
            <span style="font-weight:700;color:var(--accent)">${Store.formatMoney(p.valor)}</span>
          </div>`).join('')}
      </div>

      ${venda.observacoes ? `<div class="section-title">Observações</div><p style="font-size:13px;color:var(--text-secondary)">${venda.observacoes}</p>` : ''}
    `, `
      <button class="btn btn-secondary" id="v-print"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir</button>
      <button class="btn btn-secondary" id="v-pdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>PDF</button>
      <button class="btn btn-secondary" id="v-close">Fechar</button>
    `, 'modal-lg');

    document.getElementById('v-close').onclick = () => Modal.close();
    document.getElementById('v-print').onclick = () => Receipt.printSaleReceipt(venda);
    document.getElementById('v-pdf').onclick = () => Receipt.saleReceiptPDF(venda);
  }

  // ── Edit Sale ──
  function editSale(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;

    Modal.open('Editar Venda', `
      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item">
          <div class="detail-label">Código</div>
          <div class="detail-value accent">#${venda.codigo_venda || venda.id.substring(0, 8)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Total</div>
          <div class="detail-value accent">${Store.formatMoney(venda.total)}</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="ve-status">
          <option value="finalizada" ${venda.status === 'finalizada' ? 'selected' : ''}>Finalizada</option>
          <option value="pendente" ${venda.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="cancelada" ${venda.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <select class="form-select" id="ve-cli">
          ${clientes.map(c => `<option value="${c.id}" ${c.id === venda.cliente_id ? 'selected' : ''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-textarea" id="ve-obs">${venda.observacoes || ''}</textarea>
      </div>
    `, `
      <button class="btn btn-secondary" id="ve-cancel">Cancelar</button>
      <button class="btn btn-primary" id="ve-save">Salvar</button>
    `);

    document.getElementById('ve-cancel').onclick = () => Modal.close();
    document.getElementById('ve-save').onclick = async () => {
      const updatedVenda = {
        ...venda,
        status: document.getElementById('ve-status').value,
        cliente_id: document.getElementById('ve-cli').value,
        observacoes: document.getElementById('ve-obs').value.trim(),
        updated_at: new Date().toISOString()
      };
      await SyncEngine.update('vendas', updatedVenda);
      // Optimistic
      Object.assign(venda, updatedVenda);
      Modal.close();
      Toast.success('Venda atualizada!');
      renderTable(document.getElementById('v-search')?.value || '');
    };
  }

  // ── Print/PDF Sale ──
  async function printSale(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;

    Modal.open('Gerar Recibo', `
      <p style="margin-bottom:16px;color:var(--text-secondary)">Selecione o formato do recibo:</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <button class="btn btn-primary" id="rp-a4" style="flex-direction:column;padding:16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          PDF A4
        </button>
        <button class="btn btn-secondary" id="rp-thermal" style="flex-direction:column;padding:16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></svg>
          Térmico 80mm
        </button>
        <button class="btn btn-secondary" id="rp-print" style="flex-direction:column;padding:16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
      </div>
    `, `<button class="btn btn-secondary" id="rp-close">Fechar</button>`);

    document.getElementById('rp-a4').onclick = () => { Modal.close(); Receipt.saleReceiptPDF(venda); };
    document.getElementById('rp-thermal').onclick = () => { Modal.close(); Receipt.saleReceiptThermal(venda); };
    document.getElementById('rp-print').onclick = () => { Modal.close(); Receipt.printSaleReceipt(venda); };
    document.getElementById('rp-close').onclick = () => Modal.close();
  }

  // ── Delete Sale (with confirmation) ──
  function deleteSale(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;

    Modal.open('⚠️ Excluir Venda', `
      <div style="text-align:center;padding:16px 0">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="width:32px;height:32px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 style="margin-bottom:8px">Confirmar Exclusão</h3>
        <p style="color:var(--text-secondary);font-size:14px">
          Deseja excluir a venda <strong style="color:var(--accent)">#${venda.codigo_venda || venda.id.substring(0, 8)}</strong> no valor de <strong style="color:var(--danger)">${Store.formatMoney(venda.total)}</strong>?
        </p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:8px">Esta ação não pode ser desfeita.</p>
      </div>
    `, `
      <button class="btn btn-secondary" id="vd-cancel">Cancelar</button>
      <button class="btn btn-danger" id="vd-confirm">Excluir Venda</button>
    `);

    document.getElementById('vd-cancel').onclick = () => Modal.close();
    document.getElementById('vd-confirm').onclick = async () => {
      await SyncEngine.remove('vendas', id);
      vendas = vendas.filter(v => v.id !== id);
      Modal.close();
      Toast.success('Venda excluída!');
      renderTable(document.getElementById('v-search')?.value || '');
    };
  }

  // ── Initialize ──
  buildUI();

  // Reactive updates
  SyncEngine.subscribe(['vendas', 'clientes'], async () => {
    if (Router.current === 'vendas') {
      vendas = await SyncEngine.getAll('vendas');
      clientes = await SyncEngine.getAll('clientes');
      renderTable(document.getElementById('v-search')?.value || '');
    }
  });
});
