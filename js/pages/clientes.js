// ========== Clientes Page ==========
Router.register('clientes', async (container) => {
  const clientes = await DB.getAll('clientes');

  container.innerHTML = `<div class="page">
    <div class="toolbar">
      <div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="clientes-search" placeholder="Buscar cliente...">
      </div>
      <button class="btn btn-primary" id="btn-add-cliente">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Novo Cliente
      </button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Obs.</th><th style="width:100px">Ações</th></tr></thead>
        <tbody id="clientes-tbody"></tbody>
      </table>
    </div>
  </div>`;

  function renderTable(search = '') {
    const filtered = clientes.filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()));
    const tbody = document.getElementById('clientes-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum cliente encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(c => `<tr>
      <td style="font-weight:600">${c.nome}</td>
      <td>${c.telefone || '-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.endereco || '-'}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.observacoes || '-'}</td>
      <td><div class="table-actions">
        <button class="btn-edit" data-id="${c.id}" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-delete" data-id="${c.id}" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
      </div></td>
    </tr>`).join('');

    tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openClienteForm(btn.dataset.id)));
    tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteCliente(btn.dataset.id)));
  }

  renderTable();
  document.getElementById('clientes-search').addEventListener('input', (e) => renderTable(e.target.value));
  document.getElementById('btn-add-cliente').addEventListener('click', () => openClienteForm());

  function openClienteForm(id) {
    const c = id ? clientes.find(x => x.id === id) : null;
    Modal.open(c ? 'Editar Cliente' : 'Novo Cliente', `
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f-cli-nome" value="${c?.nome || ''}" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-cli-tel" value="${c?.telefone || ''}"></div>
        <div class="form-group"><label class="form-label">Endereço</label><input class="form-input" id="f-cli-end" value="${c?.endereco || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Observações</label><textarea class="form-textarea" id="f-cli-obs">${c?.observacoes || ''}</textarea></div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-cli">Salvar</button>
    `);

    document.getElementById('btn-save-cli').addEventListener('click', async () => {
      const nome = document.getElementById('f-cli-nome').value.trim();
      if (!nome) { Toast.warning('Nome é obrigatório!'); return; }
      const data = {
        id: c?.id || Store.generateId(),
        nome,
        telefone: document.getElementById('f-cli-tel').value.trim(),
        endereco: document.getElementById('f-cli-end').value.trim(),
        observacoes: document.getElementById('f-cli-obs').value.trim(),
        ativo: true,
        created_at: c?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (c) { await SyncEngine.update('clientes', data); } else { await SyncEngine.insert('clientes', data); }
      Modal.close();
      Toast.success(c ? 'Cliente atualizado!' : 'Cliente cadastrado!');
      Router.navigate('clientes');
    });
  }

  async function deleteCliente(id) {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    Modal.open('Excluir Cliente', `<p>Deseja excluir o cliente <strong>${c.nome}</strong>?</p>`, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirm-del-cli">Excluir</button>
    `);
    document.getElementById('btn-confirm-del-cli').addEventListener('click', async () => {
      await SyncEngine.remove('clientes', id);
      Modal.close();
      Toast.success('Cliente excluído!');
      Router.navigate('clientes');
    });
  }
});
