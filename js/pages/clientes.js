import { SyncEngine } from '../syncEngine.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { Toast } from '../toast.js';
import { Modal } from '../modal.js';
import { CONFIG } from '../config.js';

Router.register('clientes', async (c) => {
  let clientes = await SyncEngine.getAll('clientes');

  function buildUI() {
    c.innerHTML = `<div class="page"><div class="toolbar"><div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="cli-search" placeholder="Buscar..."></div><button class="btn btn-primary" id="btn-add-cli"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo</button></div><div class="table-wrapper"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Obs.</th><th style="width:100px">Ações</th></tr></thead><tbody id="cli-tbody"></tbody></table></div></div>`;
    render();
    document.getElementById('cli-search').oninput = e => render(e.target.value);
    document.getElementById('btn-add-cli').onclick = () => openForm();
  }

  const render = (s='') => {
    const f = clientes.filter(c => !s || c.nome.toLowerCase().includes(s.toLowerCase()));
    const tb = document.getElementById('cli-tbody');
    if (!tb) return;
    if (!f.length) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum</td></tr>'; return; }
    tb.innerHTML = f.map(c => `<tr><td style="font-weight:600">${c.nome}</td><td>${c.telefone||'-'}</td><td>${c.endereco||'-'}</td><td>${c.observacoes||'-'}</td><td><div class="table-actions"><button class="btn-edit" data-id="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-delete" data-id="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></td></tr>`).join('');
    tb.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => openForm(b.dataset.id));
    tb.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => del(b.dataset.id));
  };

  function openForm(id) {
    const cl = id ? clientes.find(x=>x.id===id) : null;
    Modal.open(cl?'Editar Cliente':'Novo Cliente', `<div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="f-n" value="${cl?.nome||''}"></div><div class="form-row"><div class="form-group"><label class="form-label">Telefone</label><input class="form-input" id="f-t" value="${cl?.telefone||''}"></div><div class="form-group"><label class="form-label">Endereço</label><input class="form-input" id="f-e" value="${cl?.endereco||''}"></div></div><div class="form-group"><label class="form-label">Obs.</label><textarea class="form-textarea" id="f-o">${cl?.observacoes||''}</textarea></div>`, `<button class="btn btn-secondary" id="mc">Cancelar</button><button class="btn btn-primary" id="ms">Salvar</button>`);
    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('ms').onclick = async () => {
      const n = document.getElementById('f-n').value.trim(); if(!n){Toast.warning('Nome obrigatório!');return;}
      const d = { id:cl?.id||Store.generateId(), nome:n, telefone:document.getElementById('f-t').value.trim(), endereco:document.getElementById('f-e').value.trim(), observacoes:document.getElementById('f-o').value.trim(), ativo:true, is_deleted:false, created_at:cl?.created_at||new Date().toISOString(), updated_at:new Date().toISOString() };
      cl ? await SyncEngine.update('clientes',d) : await SyncEngine.insert('clientes',d);
      Modal.close(); Toast.success(cl?'Atualizado!':'Cadastrado!');
      // Optimistic: update local list immediately
      if (cl) { Object.assign(cl, d); } else { clientes.push(d); }
      render(document.getElementById('cli-search')?.value || '');
    };
  }

  async function del(id) {
    const cl = clientes.find(x=>x.id===id); if(!cl)return;
    Modal.open('Excluir', `<p>Excluir <strong>${cl.nome}</strong>?</p>`, `<button class="btn btn-secondary" id="mc">Cancelar</button><button class="btn btn-danger" id="md">Excluir</button>`);
    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('md').onclick = async () => {
      await SyncEngine.remove('clientes',id);
      Modal.close(); Toast.success('Excluído!');
      // Optimistic: remove from local list
      clientes = clientes.filter(x => x.id !== id);
      render(document.getElementById('cli-search')?.value || '');
    };
  }

  buildUI();

  // Reactive updates from sync/realtime
  SyncEngine.subscribe(['clientes'], async () => {
    if (Router.current === 'clientes') {
      clientes = await SyncEngine.getAll('clientes');
      render(document.getElementById('cli-search')?.value || '');
    }
  });
});
