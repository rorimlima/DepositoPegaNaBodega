import { DB } from '../db.js';
import { SyncEngine } from '../syncEngine.js';
import { Store } from '../store.js';
import { Router } from '../router.js';
import { Toast } from '../toast.js';
import { Modal } from '../modal.js';
import { CONFIG } from '../config.js';

Router.register('pdv', async (container) => {
  let produtos = (await SyncEngine.getAll('produtos')).filter(p => p.ativo !== false);
  let clientes = await SyncEngine.getAll('clientes');
  container.innerHTML = `<div class="page"><div class="pdv-layout">
    <div class="pdv-products">
      <div class="search-bar" style="margin-bottom:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="pdv-s" placeholder="Buscar produto..."></div>
      <div class="filter-pills" id="pdv-cats"><button class="filter-pill active" data-cat="all">Todos</button>${CONFIG.CATEGORIAS.map(c=>`<button class="filter-pill" data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="product-grid" id="pdv-grid"></div>
    </div>
    <div class="pdv-cart">
      <div class="cart-header">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Cliente</label>
          <div class="autocomplete-wrapper" id="client-autocomplete">
            <svg class="autocomplete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="autocomplete-input" id="pdv-cli-input" placeholder="Buscar cliente..." autocomplete="off">
            <input type="hidden" id="pdv-cli" value="">
            <div class="autocomplete-dropdown" id="pdv-cli-dropdown"></div>
          </div>
        </div>
      </div>
      <div class="cart-items" id="cart-items"><div class="empty-state"><p>Carrinho vazio</p></div></div>
      <div class="cart-footer"><div class="cart-total"><span class="cart-total-label">Total</span><span class="cart-total-value" id="cart-total">R$ 0,00</span></div><button class="btn btn-primary btn-block" id="btn-fin" disabled>Finalizar Venda</button></div>
    </div>
  </div></div>`;

  let curCat = 'all';
  function renderProds(s='') {
    const g = document.getElementById('pdv-grid');
    if (!g) return;
    const f = produtos.filter(p => (curCat==='all'||p.categoria===curCat) && (!s||p.nome.toLowerCase().includes(s.toLowerCase())));
    if(!f.length){g.innerHTML='<div class="empty-state"><p>Nenhum produto</p></div>';return;}
    g.innerHTML = f.map(p=>`<div class="product-card ${p.estoque_atual<=0?'no-stock':p.estoque_atual<=5?'low-stock':''}" data-id="${p.id}"><div class="product-card-name">${p.nome}</div><div class="product-card-cat">${p.categoria||'-'}</div><div class="product-card-price">${Store.formatMoney(p.preco_venda)}</div><div class="product-card-stock">Est: ${p.estoque_atual}</div></div>`).join('');
    g.querySelectorAll('.product-card:not(.no-stock)').forEach(c => { c.onclick = () => { const pr = produtos.find(p=>p.id===c.dataset.id); if(pr) Store.addToCart(pr); }; });
  }
  renderProds();
  document.getElementById('pdv-s').oninput = e => renderProds(e.target.value);
  document.getElementById('pdv-cats').onclick = e => { const p = e.target.closest('.filter-pill'); if(!p)return; document.querySelectorAll('#pdv-cats .filter-pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); curCat=p.dataset.cat; renderProds(document.getElementById('pdv-s').value); };

  function renderCart() {
    const ci = document.getElementById('cart-items'), ct = document.getElementById('cart-total'), bf = document.getElementById('btn-fin');
    if (!ci) return;
    const cart = Store.cart;
    if(!cart.length){ci.innerHTML='<div class="empty-state"><p>Carrinho vazio</p></div>';ct.textContent='R$ 0,00';bf.disabled=true;return;}
    ci.innerHTML = cart.map(i=>`<div class="cart-item"><div class="cart-item-info"><div class="cart-item-name">${i.produto_nome}</div><div class="cart-item-price">${Store.formatMoney(i.preco_unitario)} un.</div></div><div class="cart-item-qty"><button class="cq-minus" data-id="${i.produto_id}">−</button><span>${i.quantidade}</span><button class="cq-plus" data-id="${i.produto_id}">+</button></div><div class="cart-item-subtotal">${Store.formatMoney(i.subtotal)}</div><button class="cart-item-remove cr-btn" data-id="${i.produto_id}">✕</button></div>`).join('');
    ci.querySelectorAll('.cq-minus').forEach(b=>{b.onclick=()=>Store.updateQty(b.dataset.id,-1);});
    ci.querySelectorAll('.cq-plus').forEach(b=>{b.onclick=()=>Store.updateQty(b.dataset.id,1);});
    ci.querySelectorAll('.cr-btn').forEach(b=>{b.onclick=()=>Store.removeFromCart(b.dataset.id);});
    ct.textContent = Store.formatMoney(Store.getCartTotal());
    bf.disabled = false;
  }
  Store.onCartChange(renderCart);
  renderCart();

  // Autocomplete Logic
  let selectedClientId = '';
  let autocompleteIndex = -1;
  const cliInput = document.getElementById('pdv-cli-input');
  const cliHidden = document.getElementById('pdv-cli');
  const cliDropdown = document.getElementById('pdv-cli-dropdown');
  
  const defaultCli = clientes.find(c => c.nome.toLowerCase() === 'cliente balcão') || clientes[0];
  if (defaultCli) selectClient(defaultCli.id, defaultCli.nome);

  function renderDropdown(query = '') {
    const q = query.toLowerCase();
    const filtered = clientes.filter(c => c.nome.toLowerCase().includes(q));
    let html = '';
    
    if (filtered.length === 0) html += `<div class="autocomplete-empty">Nenhum cliente encontrado</div>`;
    else html += filtered.map((c, i) => `<div class="autocomplete-item" data-index="${i}" data-id="${c.id}" data-name="${c.nome}">${c.nome}</div>`).join('');
    
    html += `<div class="autocomplete-action" id="btn-novo-cliente">+ Novo Cliente</div>`;
    cliDropdown.innerHTML = html;
    
    cliDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.onclick = () => selectClient(item.dataset.id, item.dataset.name);
    });
    
    document.getElementById('btn-novo-cliente').onclick = openNewClientModal;
    autocompleteIndex = -1;
  }

  function selectClient(id, name) {
    selectedClientId = id;
    cliHidden.value = id;
    cliInput.value = name;
    cliDropdown.classList.remove('active');
  }

  let debounceTimer;
  cliInput.oninput = (e) => {
    clearTimeout(debounceTimer);
    cliDropdown.classList.add('active');
    debounceTimer = setTimeout(() => renderDropdown(e.target.value), 300);
  };

  cliInput.onfocus = () => {
    renderDropdown(cliInput.value);
    cliDropdown.classList.add('active');
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#client-autocomplete') && cliDropdown) {
      cliDropdown.classList.remove('active');
      if (!cliInput.value && defaultCli) selectClient(defaultCli.id, defaultCli.nome);
      else {
        const match = clientes.find(c => c.id === cliHidden.value);
        if (match) cliInput.value = match.nome;
      }
    }
  });

  cliInput.onkeydown = (e) => {
    const items = cliDropdown.querySelectorAll('.autocomplete-item');
    if (!cliDropdown.classList.contains('active')) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex + 1) % items.length;
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex - 1 + items.length) % items.length;
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (autocompleteIndex >= 0 && items[autocompleteIndex]) items[autocompleteIndex].click();
      else if (items.length > 0) items[0].click();
      else document.getElementById('btn-novo-cliente').click();
    } else if (e.key === 'Escape') {
      cliDropdown.classList.remove('active');
    }
  };

  function updateHighlight(items) {
    items.forEach(i => i.classList.remove('highlighted'));
    if (autocompleteIndex >= 0 && items[autocompleteIndex]) {
      items[autocompleteIndex].classList.add('highlighted');
      items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function openNewClientModal() {
    cliDropdown.classList.remove('active');
    Modal.open('Novo Cliente Rápido', `
      <div class="form-group"><label class="form-label">Nome do Cliente</label><input type="text" class="form-input" id="nc-nome" value="${cliInput.value}"></div>
      <div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-input" id="nc-tel" placeholder="(00) 00000-0000"></div>
    `, `<button class="btn btn-secondary" id="nc-cancel">Cancelar</button><button class="btn btn-primary" id="nc-save">Salvar</button>`);
    
    document.getElementById('nc-cancel').onclick = () => Modal.close();
    document.getElementById('nc-save').onclick = async () => {
      const nome = document.getElementById('nc-nome').value.trim();
      if (!nome) return Toast.warning('Nome obrigatório!');
      const newCli = { id: Store.generateId(), nome, telefone: document.getElementById('nc-tel').value, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await SyncEngine.insert('clientes', newCli);
      clientes.push(newCli);
      selectClient(newCli.id, newCli.nome);
      Modal.close();
      Toast.success('Cliente cadastrado!');
    };
  }

  document.getElementById('btn-fin').onclick = () => {
    const total = Store.getCartTotal();
    const cliId = document.getElementById('pdv-cli').value;
    const cliNome = document.getElementById('pdv-cli-input').value || 'Balcão';
    Modal.open('Finalizar Venda', `<div style="margin-bottom:16px"><strong>Cliente:</strong> ${cliNome}<br><strong>Total:</strong> <span style="color:var(--accent);font-weight:800;font-size:20px">${Store.formatMoney(total)}</span></div><h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">Pagamentos</h4><div id="pay-list"></div><button class="btn btn-secondary btn-sm" style="margin-top:8px" id="add-pay">+ Pagamento</button><div id="pay-rem" style="margin-top:12px;font-size:13px"></div>`, `<button class="btn btn-secondary" id="mc">Cancelar</button><button class="btn btn-primary" id="confirm-v">Confirmar</button>`);
    document.getElementById('mc').onclick = () => Modal.close();
    const addRow = () => {
      const list = document.getElementById('pay-list');
      const rows = list.querySelectorAll('.payment-row');
      const used = Array.from(rows).reduce((s,r)=>s+(parseFloat(r.querySelector('.pv').value)||0),0);
      const rem = Math.max(total-used,0);
      const row = document.createElement('div'); row.className='payment-row';
      row.innerHTML=`<div class="form-group" style="flex:1.5"><label class="form-label">Forma</label><select class="form-select pf">${CONFIG.FORMAS_PAGAMENTO.map(f=>`<option>${f}</option>`).join('')}</select></div><div class="form-group" style="flex:1"><label class="form-label">Valor</label><input type="number" step="0.01" class="form-input pv" value="${rem.toFixed(2)}"></div><div class="form-group" style="flex:1"><label class="form-label">Data</label><input type="date" class="form-input pd" value="${new Date().toISOString().split('T')[0]}"></div><button class="btn btn-sm btn-danger" style="align-self:center" onclick="this.closest('.payment-row').remove()">✕</button>`;
      list.appendChild(row);
      row.querySelector('.pv').oninput = updRem;
      updRem();
    };
    const updRem = () => {
      const rows = document.querySelectorAll('.payment-row');
      const paid = Array.from(rows).reduce((s,r)=>s+(parseFloat(r.querySelector('.pv').value)||0),0);
      const r = total-paid, el = document.getElementById('pay-rem');
      if(el){if(Math.abs(r)<0.01) el.innerHTML='<span style="color:var(--success)">✓ Completo</span>'; else if(r>0) el.innerHTML=`<span style="color:var(--warning)">Falta: ${Store.formatMoney(r)}</span>`; else el.innerHTML=`<span style="color:var(--danger)">Excesso: ${Store.formatMoney(Math.abs(r))}</span>`;}
    };
    addRow();
    document.getElementById('add-pay').onclick = addRow;
    document.getElementById('confirm-v').onclick = async () => {
      const rows = document.querySelectorAll('.payment-row');
      const paid = Array.from(rows).reduce((s,r)=>s+(parseFloat(r.querySelector('.pv').value)||0),0);
      if(Math.abs(total-paid)>0.01){Toast.warning('Valor não confere!');return;}
      const vid = Store.generateId();
      const codigoVenda = String(Date.now()).slice(-8);
      const venda = {id:vid,cliente_id:cliId,total,status:'finalizada',codigo_venda:codigoVenda,is_deleted:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      await SyncEngine.insert('vendas',venda);
      for(const it of Store.cart){
        await SyncEngine.insert('itens_venda',{id:Store.generateId(),venda_id:vid,produto_id:it.produto_id,produto_nome:it.produto_nome,quantidade:it.quantidade,preco_unitario:it.preco_unitario,subtotal:it.subtotal,is_deleted:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
        const pr = await SyncEngine.get('produtos',it.produto_id);
        if(pr){pr.estoque_atual=Math.max(0,pr.estoque_atual-it.quantidade);pr.updated_at=new Date().toISOString();await SyncEngine.update('produtos',pr);}
      }
      for(const r of rows){
        await SyncEngine.insert('pagamentos_venda',{id:Store.generateId(),venda_id:vid,valor:parseFloat(r.querySelector('.pv').value)||0,forma_pagamento:r.querySelector('.pf').value,data_pagamento:r.querySelector('.pd').value,is_deleted:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      }
      Modal.close(); Store.clearCart(); Toast.success('Venda finalizada!');
      genPDF(venda,cliNome);
      Router.navigate('pdv');
    };
  };

  // Reactive: refresh product list if sync brings in new data
  SyncEngine.subscribe(['produtos'], async () => {
    if (Router.current === 'pdv') {
      produtos = (await SyncEngine.getAll('produtos')).filter(p => p.ativo !== false);
      renderProds(document.getElementById('pdv-s')?.value || '');
    }
  });
});

async function genPDF(venda, cliNome) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'mm',format:[80,200]});
    const emp = (await SyncEngine.getAll('empresa'))[0]||{};
    let y=10;
    doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text(emp.nome||'PegaNaBodega',40,y,{align:'center'}); y+=5;
    doc.setFontSize(7); doc.setFont(undefined,'normal');
    if(emp.cnpj_cpf){doc.text(`CNPJ/CPF: ${emp.cnpj_cpf}`,40,y,{align:'center'});y+=4;}
    if(emp.telefone){doc.text(`Tel: ${emp.telefone}`,40,y,{align:'center'});y+=4;}
    y+=2; doc.line(5,y,75,y); y+=4;
    doc.setFontSize(8); doc.text(`Cliente: ${cliNome}`,5,y); y+=4;
    doc.text(`Data: ${new Date(venda.created_at).toLocaleString('pt-BR')}`,5,y); y+=4;
    if(venda.codigo_venda){doc.text(`Código: #${venda.codigo_venda}`,5,y); y+=4;}
    doc.line(5,y,75,y); y+=4;
    const itens = (await SyncEngine.getAll('itens_venda')).filter(i=>i.venda_id===venda.id);
    doc.setFontSize(7);
    for(const it of itens){const n=it.produto_nome.length>18?it.produto_nome.substring(0,18)+'...':it.produto_nome;doc.text(n,5,y);doc.text(`${it.quantidade}x`,42,y);doc.text(Store.formatMoney(it.subtotal),73,y,{align:'right'});y+=3.5;}
    y+=2; doc.line(5,y,75,y); y+=4;
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text(`TOTAL: ${Store.formatMoney(venda.total)}`,73,y,{align:'right'}); y+=5;
    const pags = (await SyncEngine.getAll('pagamentos_venda')).filter(p=>p.venda_id===venda.id);
    doc.setFontSize(7); doc.setFont(undefined,'normal');
    for(const p of pags){doc.text(`${p.forma_pagamento}: ${Store.formatMoney(p.valor)}`,5,y);y+=3.5;}
    y+=4; doc.text('Obrigado pela preferência!',40,y,{align:'center'});
    doc.save(`recibo_${venda.codigo_venda||venda.id.substring(0,8)}.pdf`);
    Toast.success('PDF gerado!');
  } catch(e) { console.error(e); Toast.error('Erro ao gerar PDF'); }
}

