// ========== Produtos Page ==========
Router.register('produtos', async (container) => {
  const produtos = await DB.getAll('produtos');

  container.innerHTML = `<div class="page">
    <div class="toolbar">
      <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="prod-search" placeholder="Buscar produto...">
      </div>
      <button class="btn btn-primary" id="btn-add-prod">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo Produto
      </button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Estoque</th><th style="width:100px">Ações</th></tr></thead>
        <tbody id="prod-tbody"></tbody>
      </table>
    </div>
  </div>`;

  function renderTable(search = '') {
    const filtered = produtos.filter(p => !search || p.nome.toLowerCase().includes(search.toLowerCase()));
    const tbody = document.getElementById('prod-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum produto encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(p => {
      let stockBadge = '<span class="badge badge-success">OK</span>';
      if (p.estoque_atual <= 0) stockBadge = '<span class="badge badge-danger">Zerado</span>';
      else if (p.estoque_atual <= 5) stockBadge = '<span class="badge badge-warning">Baixo</span>';
      return `<tr>
        <td style="font-weight:600">${p.nome}</td>
        <td>${p.categoria || '-'}</td>
        <td>${Store.formatMoney(p.preco_custo)}</td>
        <td style="font-weight:600;color:var(--accent)">${Store.formatMoney(p.preco_venda)}</td>
        <td>${p.estoque_atual} ${stockBadge}</td>
        <td><div class="table-actions">
          <button class="btn-edit" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-delete" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => openProdForm(b.dataset.id)));
    tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => deleteProd(b.dataset.id)));
  }

  renderTable();
  document.getElementById('prod-search').addEventListener('input', (e) => renderTable(e.target.value));
  document.getElementById('btn-add-prod').addEventListener('click', () => openProdForm());

  function openProdForm(id) {
    const p = id ? produtos.find(x => x.id === id) : null;
    Modal.open(p ? 'Editar Produto' : 'Novo Produto', `
      <div class="form-group"><label class="form-label">Nome da Bebida *</label><input class="form-input" id="f-prod-nome" value="${p?.nome || ''}"></div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-select" id="f-prod-cat">
          <option value="">Selecione...</option>
          ${CONFIG.CATEGORIAS.map(c => `<option value="${c}" ${p?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Preço de Custo</label><input type="number" step="0.01" class="form-input" id="f-prod-custo" value="${p?.preco_custo || '0'}"></div>
        <div class="form-group"><label class="form-label">Preço de Venda *</label><input type="number" step="0.01" class="form-input" id="f-prod-venda" value="${p?.preco_venda || '0'}"></div>
      </div>
      <div class="form-group"><label class="form-label">Estoque Atual</label><input type="number" class="form-input" id="f-prod-est" value="${p?.estoque_atual || '0'}"></div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-prod">Salvar</button>
    `);

    document.getElementById('btn-save-prod').addEventListener('click', async () => {
      const nome = document.getElementById('f-prod-nome').value.trim();
      if (!nome) { Toast.warning('Nome é obrigatório!'); return; }
      const data = {
        id: p?.id || Store.generateId(),
        nome,
        categoria: document.getElementById('f-prod-cat').value,
        preco_custo: parseFloat(document.getElementById('f-prod-custo').value) || 0,
        preco_venda: parseFloat(document.getElementById('f-prod-venda').value) || 0,
        estoque_atual: parseInt(document.getElementById('f-prod-est').value) || 0,
        ativo: true,
        created_at: p?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (p) { await SyncEngine.update('produtos', data); } else { await SyncEngine.insert('produtos', data); }
      Modal.close();
      Toast.success(p ? 'Produto atualizado!' : 'Produto cadastrado!');
      Router.navigate('produtos');
    });
  }

  async function deleteProd(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    Modal.open('Excluir Produto', `<p>Deseja excluir <strong>${p.nome}</strong>?</p>`, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirm-del-prod">Excluir</button>
    `);
    document.getElementById('btn-confirm-del-prod').addEventListener('click', async () => {
      await SyncEngine.remove('produtos', id);
      Modal.close();
      Toast.success('Produto excluído!');
      Router.navigate('produtos');
    });
  }
});
