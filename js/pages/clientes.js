import { SyncEngine } from '../syncEngine.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { Toast } from '../toast.js';
import { Modal } from '../modal.js';
import { Receipt } from '../receipt.js';
import { CONFIG } from '../config.js';

/**
 * ═══════════════════════════════════════════════════════════════
 * CLIENTES PAGE — Full client management + Profile + Financials
 * ═══════════════════════════════════════════════════════════════
 */
Router.register('clientes', async (c) => {
  let clientes = await SyncEngine.getAll('clientes');

  // ── Build UI ──
  function buildUI() {
    c.innerHTML = `<div class="page">
      <div class="toolbar">
        <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="cli-search" placeholder="Buscar clientes...">
        </div>
        <button class="btn btn-primary" id="btn-add-cli">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Cliente
        </button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Obs.</th>
              <th style="width:150px">Ações</th>
            </tr>
          </thead>
          <tbody id="cli-tbody"></tbody>
        </table>
      </div>
    </div>`;

    render();
    document.getElementById('cli-search').oninput = e => render(e.target.value);
    document.getElementById('btn-add-cli').onclick = () => openForm();
  }

  // ── Render Table ──
  async function render(s = '') {
    const tb = document.getElementById('cli-tbody');
    if (!tb) return;
    const f = clientes.filter(cl => !s || cl.nome.toLowerCase().includes(s.toLowerCase()));

    if (!f.length) {
      tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum cliente encontrado</td></tr>';
      return;
    }

    // Pre-calculate financials for each client to show badge
    const rows = [];
    for (const cl of f) {
      const fin = await Receipt.getClientFinancials(cl.id);
      const badgeClass = fin.status === 'ok' ? 'status-ok' : 'status-devedor';
      const badgeText = fin.status === 'ok' ? 'OK' : `Devendo ${Store.formatMoney(fin.saldoDevedor)}`;
      rows.push(`<tr>
        <td style="font-weight:600">${cl.nome}</td>
        <td>${cl.telefone || '-'}</td>
        <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cl.observacoes || '-'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-view" data-id="${cl.id}" title="Ficha do Cliente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            <button class="btn-edit" data-id="${cl.id}" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-delete" data-id="${cl.id}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`);
    }
    tb.innerHTML = rows.join('');

    tb.querySelectorAll('.btn-view').forEach(b => b.onclick = () => openProfile(b.dataset.id));
    tb.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => openForm(b.dataset.id));
    tb.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => del(b.dataset.id));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLIENT PROFILE — Ficha do Cliente (Dashboard Modal)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function openProfile(id) {
    const cl = clientes.find(x => x.id === id);
    if (!cl) return;

    const fin = await Receipt.getClientFinancials(cl.id);
    const initials = cl.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const statusClass = fin.status === 'ok' ? 'status-ok' : 'status-devedor';
    const statusText = fin.status === 'ok' ? 'Adimplente' : 'Devedor';

    // Get all payments for tab rendering
    const allPagamentos = (await SyncEngine.getAll('pagamentos_venda'));
    const vendaIds = new Set(fin.vendas.map(v => v.id));
    const pagamentos = allPagamentos.filter(p => vendaIds.has(p.venda_id));

    Modal.open('Ficha do Cliente', `
      <!-- PROFILE HEADER -->
      <div class="profile-header">
        <div class="profile-avatar">${initials}</div>
        <div class="profile-info">
          <div class="profile-name">${cl.nome}</div>
          <div class="profile-meta">
            ${cl.telefone ? `📞 ${cl.telefone}` : ''}
            ${cl.endereco ? ` · 📍 ${cl.endereco}` : ''}
          </div>
          <div style="margin-top:6px"><span class="status-badge ${statusClass}">${statusText}</span></div>
        </div>
      </div>

      <!-- MINI STATS -->
      <div class="mini-stats">
        <div class="mini-stat">
          <div class="mini-stat-value">${fin.totalVendas}</div>
          <div class="mini-stat-label">Compras</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-value" style="color:var(--accent)">${Store.formatMoney(fin.totalGasto)}</div>
          <div class="mini-stat-label">Total Gasto</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-value" style="color:var(--success)">${Store.formatMoney(fin.totalPago)}</div>
          <div class="mini-stat-label">Pago</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-value" style="color:${fin.saldoDevedor > 0 ? 'var(--danger)' : 'var(--success)'}">${Store.formatMoney(fin.saldoDevedor)}</div>
          <div class="mini-stat-label">Saldo Devedor</div>
        </div>
      </div>

      <!-- TABS -->
      <div class="tabs" id="prof-tabs">
        <button class="tab-btn active" data-tab="info">Informações</button>
        <button class="tab-btn" data-tab="vendas">Vendas (${fin.totalVendas})</button>
        <button class="tab-btn" data-tab="pagamentos">Pagamentos (${pagamentos.length})</button>
      </div>

      <!-- TAB: INFO -->
      <div class="tab-content active" id="tab-info">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Nome Completo</div>
            <div class="detail-value">${cl.nome}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Telefone</div>
            <div class="detail-value">${cl.telefone || 'Não informado'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Endereço</div>
            <div class="detail-value">${cl.endereco || 'Não informado'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Cliente Desde</div>
            <div class="detail-value">${new Date(cl.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
          ${cl.observacoes ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Observações</div>
            <div class="detail-value">${cl.observacoes}</div>
          </div>` : ''}
        </div>

        <!-- FINANCIAL STATUS SECTION -->
        <div class="section-title">Status Financeiro</div>
        <div style="padding:16px;background:${fin.saldoDevedor > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'};border:1px solid ${fin.saldoDevedor > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'};border-radius:var(--radius-sm);margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:13px;color:var(--text-muted)">Situação</div>
              <div style="font-size:18px;font-weight:800;color:${fin.saldoDevedor > 0 ? 'var(--danger)' : 'var(--success)'}">${fin.saldoDevedor > 0 ? '⚠ DEVEDOR' : '✓ ADIMPLENTE'}</div>
            </div>
            ${fin.totalFiado > 0 ? `<div style="text-align:right">
              <div style="font-size:11px;color:var(--text-muted)">Total em Fiado</div>
              <div style="font-size:16px;font-weight:700;color:var(--warning)">${Store.formatMoney(fin.totalFiado)}</div>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- TAB: VENDAS -->
      <div class="tab-content" id="tab-vendas">
        ${fin.vendas.length === 0 ? '<div class="empty-state"><p>Nenhuma venda registrada</p></div>' : `
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Código</th><th>Data</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              ${fin.vendas.map(v => `<tr>
                <td style="font-weight:600;color:var(--accent)">#${v.codigo_venda || v.id.substring(0, 8)}</td>
                <td>${new Date(v.created_at).toLocaleString('pt-BR')}</td>
                <td style="font-weight:700">${Store.formatMoney(v.total)}</td>
                <td><span class="badge ${v.status === 'cancelada' ? 'badge-danger' : 'badge-success'}">${v.status || 'finalizada'}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>

      <!-- TAB: PAGAMENTOS -->
      <div class="tab-content" id="tab-pagamentos">
        ${pagamentos.length === 0 ? '<div class="empty-state"><p>Nenhum pagamento registrado</p></div>' : `
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Forma</th><th>Data</th><th>Venda</th><th>Valor</th></tr></thead>
            <tbody>
              ${pagamentos.sort((a, b) => new Date(b.data_pagamento || b.created_at) - new Date(a.data_pagamento || a.created_at)).map(p => {
      const v = fin.vendas.find(v => v.id === p.venda_id);
      return `<tr>
                  <td><span class="badge ${p.forma_pagamento === 'Fiado' ? 'badge-warning' : 'badge-success'}">${p.forma_pagamento}</span></td>
                  <td>${p.data_pagamento ? new Date(p.data_pagamento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td style="color:var(--accent)">#${v ? (v.codigo_venda || v.id.substring(0, 8)) : '-'}</td>
                  <td style="font-weight:700">${Store.formatMoney(p.valor)}</td>
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    `, `
      <button class="btn btn-secondary" id="pf-print">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir Ficha
      </button>
      <button class="btn btn-secondary" id="pf-pdf">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        PDF
      </button>
      <button class="btn btn-secondary" id="pf-close">Fechar</button>
    `, 'modal-xl');

    // Tab switching
    document.getElementById('prof-tabs').onclick = (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    };

    // Actions
    document.getElementById('pf-close').onclick = () => Modal.close();
    document.getElementById('pf-print').onclick = () => Receipt.printClientProfile(cl);
    document.getElementById('pf-pdf').onclick = () => Receipt.clientProfilePDF(cl);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CRUD — Create/Edit Form
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function openForm(id) {
    const cl = id ? clientes.find(x => x.id === id) : null;
    Modal.open(cl ? 'Editar Cliente' : 'Novo Cliente', `
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input class="form-input" id="f-n" value="${cl?.nome || ''}" placeholder="Nome completo do cliente">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input class="form-input" id="f-t" value="${cl?.telefone || ''}" placeholder="(00) 00000-0000">
        </div>
        <div class="form-group">
          <label class="form-label">Endereço</label>
          <input class="form-input" id="f-e" value="${cl?.endereco || ''}" placeholder="Rua, nº, bairro">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-textarea" id="f-o" placeholder="Informações adicionais sobre o cliente...">${cl?.observacoes || ''}</textarea>
      </div>
    `, `
      <button class="btn btn-secondary" id="mc">Cancelar</button>
      <button class="btn btn-primary" id="ms">Salvar</button>
    `);

    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('ms').onclick = async () => {
      const nome = document.getElementById('f-n').value.trim();
      if (!nome) { Toast.warning('Nome obrigatório!'); return; }

      const data = {
        id: cl?.id || Store.generateId(),
        nome,
        telefone: document.getElementById('f-t').value.trim(),
        endereco: document.getElementById('f-e').value.trim(),
        observacoes: document.getElementById('f-o').value.trim(),
        ativo: true,
        is_deleted: false,
        created_at: cl?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      cl ? await SyncEngine.update('clientes', data) : await SyncEngine.insert('clientes', data);
      Modal.close();
      Toast.success(cl ? 'Cliente atualizado!' : 'Cliente cadastrado!');

      // Optimistic update
      if (cl) { Object.assign(cl, data); } else { clientes.push(data); }
      render(document.getElementById('cli-search')?.value || '');
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELETE — Warning confirmation modal
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function del(id) {
    const cl = clientes.find(x => x.id === id);
    if (!cl) return;

    const fin = await Receipt.getClientFinancials(cl.id);

    Modal.open('⚠️ Excluir Cliente', `
      <div style="text-align:center;padding:16px 0">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="width:32px;height:32px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 style="margin-bottom:8px">Confirmar Exclusão</h3>
        <p style="color:var(--text-secondary);font-size:14px">
          Deseja excluir <strong>${cl.nome}</strong>?
        </p>
        ${fin.totalVendas > 0 ? `<p style="color:var(--warning);font-size:12px;margin-top:8px">⚠ Este cliente possui ${fin.totalVendas} venda(s) registrada(s).</p>` : ''}
        ${fin.saldoDevedor > 0 ? `<p style="color:var(--danger);font-size:12px;margin-top:4px">⚠ Saldo devedor: ${Store.formatMoney(fin.saldoDevedor)}</p>` : ''}
      </div>
    `, `
      <button class="btn btn-secondary" id="mc">Cancelar</button>
      <button class="btn btn-danger" id="md">Excluir</button>
    `);

    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('md').onclick = async () => {
      await SyncEngine.remove('clientes', id);
      clientes = clientes.filter(x => x.id !== id);
      Modal.close();
      Toast.success('Cliente excluído!');
      render(document.getElementById('cli-search')?.value || '');
    };
  }

  // ── Initialize ──
  buildUI();

  // Reactive updates
  SyncEngine.subscribe(['clientes', 'vendas', 'pagamentos_venda'], async () => {
    if (Router.current === 'clientes') {
      clientes = await SyncEngine.getAll('clientes');
      render(document.getElementById('cli-search')?.value || '');
    }
  });
});
