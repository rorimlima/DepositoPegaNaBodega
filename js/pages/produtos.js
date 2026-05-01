import { DB } from '../db.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { SyncEngine } from '../syncEngine.js';
import { Toast } from '../toast.js';
import { Modal } from '../modal.js';
import { CONFIG } from '../config.js';

Router.register('produtos', async (c) => {
  const produtos = await DB.getAll('produtos');
  c.innerHTML = `<div class="page"><div class="toolbar"><div class="search-bar" style="flex:1;max-width:400px;margin-bottom:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="p-search" placeholder="Buscar..."></div><button class="btn btn-primary" id="btn-add-p"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo</button></div><div class="table-wrapper"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Estoque</th><th style="width:100px">Ações</th></tr></thead><tbody id="p-tbody"></tbody></table></div></div>`;
  const render = (s='') => {
    const f = produtos.filter(p => !s || p.nome.toLowerCase().includes(s.toLowerCase()));
    const tb = document.getElementById('p-tbody');
    if (!f.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">Nenhum</td></tr>'; return; }
    tb.innerHTML = f.map(p => {
      let bg = '<span class="badge badge-success">OK</span>'; if(p.estoque_atual<=0) bg='<span class="badge badge-danger">Zerado</span>'; else if(p.estoque_atual<=5) bg='<span class="badge badge-warning">Baixo</span>';
      return `<tr><td style="font-weight:600">${p.nome}</td><td>${p.categoria||'-'}</td><td>${Store.formatMoney(p.preco_custo)}</td><td style="font-weight:600;color:var(--accent)">${Store.formatMoney(p.preco_venda)}</td><td>${p.estoque_atual} ${bg}</td><td><div class="table-actions"><button class="btn-edit" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-delete" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></td></tr>`;
    }).join('');
    tb.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => openForm(b.dataset.id));
    tb.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => del(b.dataset.id));
  };
  render();
  document.getElementById('p-search').oninput = e => render(e.target.value);
  document.getElementById('btn-add-p').onclick = () => openForm();
  function openForm(id) {
    const p = id ? produtos.find(x=>x.id===id) : null;
    Modal.open(p?'Editar Produto':'Novo Produto', `<div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="fp-n" value="${p?.nome||''}"></div><div class="form-group"><label class="form-label">Categoria</label><select class="form-select" id="fp-c"><option value="">Selecione</option>${CONFIG.CATEGORIAS.map(c=>`<option value="${c}" ${p?.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="form-row"><div class="form-group"><label class="form-label">Preço Custo</label><input type="number" step="0.01" class="form-input" id="fp-pc" value="${p?.preco_custo||0}"></div><div class="form-group"><label class="form-label">Preço Venda *</label><input type="number" step="0.01" class="form-input" id="fp-pv" value="${p?.preco_venda||0}"></div></div><div class="form-group"><label class="form-label">Estoque</label><input type="number" class="form-input" id="fp-e" value="${p?.estoque_atual||0}"></div>`, `<button class="btn btn-secondary" id="mc">Cancelar</button><button class="btn btn-primary" id="ms">Salvar</button>`);
    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('ms').onclick = async () => {
      const n = document.getElementById('fp-n').value.trim(); if(!n){Toast.warning('Nome obrigatório!');return;}
      const d = { id:p?.id||Store.generateId(), nome:n, categoria:document.getElementById('fp-c').value, preco_custo:parseFloat(document.getElementById('fp-pc').value)||0, preco_venda:parseFloat(document.getElementById('fp-pv').value)||0, estoque_atual:parseInt(document.getElementById('fp-e').value)||0, ativo:true, created_at:p?.created_at||new Date().toISOString(), updated_at:new Date().toISOString() };
      p ? await SyncEngine.update('produtos',d) : await SyncEngine.insert('produtos',d);
      Modal.close(); Toast.success(p?'Atualizado!':'Cadastrado!'); Router.navigate('produtos');
    };
  }
  async function del(id) {
    const p = produtos.find(x=>x.id===id); if(!p)return;
    Modal.open('Excluir', `<p>Excluir <strong>${p.nome}</strong>?</p>`, `<button class="btn btn-secondary" id="mc">Cancelar</button><button class="btn btn-danger" id="md">Excluir</button>`);
    document.getElementById('mc').onclick = () => Modal.close();
    document.getElementById('md').onclick = async () => { await SyncEngine.remove('produtos',id); Modal.close(); Toast.success('Excluído!'); Router.navigate('produtos'); };
  }
});
