// ========== PDV Page ==========
Router.register('pdv', async (container) => {
  const produtos = (await DB.getAll('produtos')).filter(p => p.ativo !== false);
  const clientes = await DB.getAll('clientes');

  container.innerHTML = `<div class="page">
    <div class="pdv-layout">
      <!-- Products Panel -->
      <div class="pdv-products">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div class="search-bar" style="flex:1;min-width:200px;margin-bottom:0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="pdv-search" placeholder="Buscar produto...">
          </div>
        </div>
        <div class="filter-pills" id="pdv-cat-filters">
          <button class="filter-pill active" data-cat="all">Todos</button>
          ${CONFIG.CATEGORIAS.map(c => `<button class="filter-pill" data-cat="${c}">${c}</button>`).join('')}
        </div>
        <div class="product-grid" id="pdv-product-grid"></div>
      </div>

      <!-- Cart Panel -->
      <div class="pdv-cart">
        <div class="cart-header">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Cliente</label>
            <select class="form-select" id="pdv-cliente">
              ${clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="cart-items" id="cart-items">
          <div class="empty-state"><p>Carrinho vazio</p></div>
        </div>
        <div class="cart-footer">
          <div class="cart-total">
            <span class="cart-total-label">Total</span>
            <span class="cart-total-value" id="cart-total">R$ 0,00</span>
          </div>
          <button class="btn btn-primary btn-block" id="btn-finalizar" disabled>Finalizar Venda</button>
        </div>
      </div>
    </div>
  </div>`;

  // Render products
  let currentCat = 'all';
  function renderProducts(search = '') {
    const grid = document.getElementById('pdv-product-grid');
    const filtered = produtos.filter(p => {
      const matchCat = currentCat === 'all' || p.categoria === currentCat;
      const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Nenhum produto encontrado</p></div>';
      return;
    }
    grid.innerHTML = filtered.map(p => `
      <div class="product-card ${p.estoque_atual <= 0 ? 'no-stock' : p.estoque_atual <= 5 ? 'low-stock' : ''}" data-id="${p.id}">
        <div class="product-card-name">${p.nome}</div>
        <div class="product-card-cat">${p.categoria || '-'}</div>
        <div class="product-card-price">${Store.formatMoney(p.preco_venda)}</div>
        <div class="product-card-stock">Estoque: ${p.estoque_atual}</div>
      </div>`).join('');

    grid.querySelectorAll('.product-card:not(.no-stock)').forEach(card => {
      card.addEventListener('click', () => {
        const prod = produtos.find(p => p.id === card.dataset.id);
        if (prod) Store.addToCart(prod);
      });
    });
  }

  renderProducts();

  // Search
  document.getElementById('pdv-search').addEventListener('input', (e) => renderProducts(e.target.value));

  // Category filters
  document.getElementById('pdv-cat-filters').addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('#pdv-cat-filters .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentCat = pill.dataset.cat;
    renderProducts(document.getElementById('pdv-search').value);
  });

  // Cart rendering
  function renderCart() {
    const cartEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const btnFin = document.getElementById('btn-finalizar');
    const cart = Store.cart;

    if (cart.length === 0) {
      cartEl.innerHTML = '<div class="empty-state"><p>Carrinho vazio</p></div>';
      totalEl.textContent = 'R$ 0,00';
      btnFin.disabled = true;
      return;
    }

    cartEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.produto_nome}</div>
          <div class="cart-item-price">${Store.formatMoney(item.preco_unitario)} un.</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="Store.updateQty('${item.produto_id}', -1)">−</button>
          <span>${item.quantidade}</span>
          <button onclick="Store.updateQty('${item.produto_id}', 1)">+</button>
        </div>
        <div class="cart-item-subtotal">${Store.formatMoney(item.subtotal)}</div>
        <button class="cart-item-remove" onclick="Store.removeFromCart('${item.produto_id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    totalEl.textContent = Store.formatMoney(Store.getCartTotal());
    btnFin.disabled = false;
  }

  Store.onCartChange(renderCart);
  renderCart();

  // Finalizar Venda
  document.getElementById('btn-finalizar').addEventListener('click', () => openFinalizarModal(clientes));
});

function openFinalizarModal(clientes) {
  const total = Store.getCartTotal();
  const clienteId = document.getElementById('pdv-cliente').value;
  const clienteNome = document.getElementById('pdv-cliente').selectedOptions[0]?.textContent || 'Cliente Balcão';

  Modal.open('Finalizar Venda', `
    <div style="margin-bottom:16px">
      <strong>Cliente:</strong> ${clienteNome}<br>
      <strong>Total:</strong> <span style="color:var(--accent);font-weight:800;font-size:20px">${Store.formatMoney(total)}</span>
    </div>
    <h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary)">Formas de Pagamento</h4>
    <div id="payments-list"></div>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="addPaymentRow()">+ Adicionar Pagamento</button>
    <div id="payment-remaining" style="margin-top:12px;font-size:13px;color:var(--text-muted)"></div>
  `, `
    <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
    <button class="btn btn-primary" id="btn-confirm-venda">Confirmar Venda</button>
  `);

  addPaymentRow();
  updatePaymentRemaining();

  document.getElementById('btn-confirm-venda').addEventListener('click', () => confirmVenda(clienteId));
}

window._paymentCounter = 0;
function addPaymentRow() {
  window._paymentCounter++;
  const list = document.getElementById('payments-list');
  const total = Store.getCartTotal();
  const existing = list.querySelectorAll('.payment-row');
  const usedTotal = Array.from(existing).reduce((s, row) => {
    return s + (parseFloat(row.querySelector('.pay-valor').value) || 0);
  }, 0);
  const remaining = Math.max(total - usedTotal, 0);

  const row = document.createElement('div');
  row.className = 'payment-row';
  row.innerHTML = `
    <div class="form-group" style="flex:1.5">
      <label class="form-label">Forma</label>
      <select class="form-select pay-forma">
        ${CONFIG.FORMAS_PAGAMENTO.map(f => `<option value="${f}">${f}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="flex:1">
      <label class="form-label">Valor</label>
      <input type="number" step="0.01" class="form-input pay-valor" value="${remaining.toFixed(2)}">
    </div>
    <div class="form-group" style="flex:1">
      <label class="form-label">Data</label>
      <input type="date" class="form-input pay-data" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <button class="btn btn-sm btn-danger btn-remove-pay" onclick="this.closest('.payment-row').remove();updatePaymentRemaining()">✕</button>
  `;
  list.appendChild(row);
  row.querySelector('.pay-valor').addEventListener('input', updatePaymentRemaining);
}

function updatePaymentRemaining() {
  const total = Store.getCartTotal();
  const rows = document.querySelectorAll('.payment-row');
  const paid = Array.from(rows).reduce((s, r) => s + (parseFloat(r.querySelector('.pay-valor').value) || 0), 0);
  const remaining = total - paid;
  const el = document.getElementById('payment-remaining');
  if (el) {
    if (Math.abs(remaining) < 0.01) {
      el.innerHTML = '<span style="color:var(--success)">✓ Pagamento completo</span>';
    } else if (remaining > 0) {
      el.innerHTML = `<span style="color:var(--warning)">Falta: ${Store.formatMoney(remaining)}</span>`;
    } else {
      el.innerHTML = `<span style="color:var(--danger)">Excesso: ${Store.formatMoney(Math.abs(remaining))}</span>`;
    }
  }
}

async function confirmVenda(clienteId) {
  const total = Store.getCartTotal();
  const rows = document.querySelectorAll('.payment-row');
  const paid = Array.from(rows).reduce((s, r) => s + (parseFloat(r.querySelector('.pay-valor').value) || 0), 0);

  if (Math.abs(total - paid) > 0.01) {
    Toast.warning('O valor dos pagamentos não confere com o total!');
    return;
  }

  const vendaId = Store.generateId();
  const venda = {
    id: vendaId,
    cliente_id: clienteId,
    total: total,
    status: 'finalizada',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Save venda
  await SyncEngine.insert('vendas', venda);

  // Save itens
  for (const item of Store.cart) {
    const itemVenda = {
      id: Store.generateId(),
      venda_id: vendaId,
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.subtotal,
      created_at: new Date().toISOString()
    };
    await SyncEngine.insert('itens_venda', itemVenda);

    // Update stock locally
    const prod = await DB.get('produtos', item.produto_id);
    if (prod) {
      prod.estoque_atual = Math.max(0, prod.estoque_atual - item.quantidade);
      prod.updated_at = new Date().toISOString();
      await SyncEngine.update('produtos', prod);
    }
  }

  // Save payments
  for (const row of rows) {
    const pag = {
      id: Store.generateId(),
      venda_id: vendaId,
      valor: parseFloat(row.querySelector('.pay-valor').value) || 0,
      forma_pagamento: row.querySelector('.pay-forma').value,
      data_pagamento: row.querySelector('.pay-data').value,
      created_at: new Date().toISOString()
    };
    await SyncEngine.insert('pagamentos_venda', pag);
  }

  Modal.close();
  Store.clearCart();
  Toast.success('Venda finalizada com sucesso!');

  // Offer PDF
  generateReceipt(venda, Store.cart, Array.from(rows).map(r => ({
    forma_pagamento: r.querySelector('.pay-forma').value,
    valor: parseFloat(r.querySelector('.pay-valor').value),
    data_pagamento: r.querySelector('.pay-data').value
  })), clienteId);

  // Refresh page
  Router.navigate('pdv');
}

async function generateReceipt(venda, items, payments, clienteId) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const empresa = (await DB.getAll('empresa'))[0] || {};
    const clientes = await DB.getAll('clientes');
    const cliente = clientes.find(c => c.id === clienteId) || { nome: 'Cliente Balcão' };

    let y = 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(empresa.nome || 'PegaNaBodega', 40, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    if (empresa.cnpj_cpf) { doc.text(`CNPJ/CPF: ${empresa.cnpj_cpf}`, 40, y, { align: 'center' }); y += 4; }
    if (empresa.telefone) { doc.text(`Tel: ${empresa.telefone}`, 40, y, { align: 'center' }); y += 4; }
    if (empresa.endereco) { doc.text(empresa.endereco, 40, y, { align: 'center' }); y += 4; }

    y += 2;
    doc.line(5, y, 75, y); y += 4;
    doc.setFontSize(8);
    doc.text(`Cliente: ${cliente.nome}`, 5, y); y += 4;
    doc.text(`Data: ${new Date(venda.created_at).toLocaleString('pt-BR')}`, 5, y); y += 4;
    doc.line(5, y, 75, y); y += 4;

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('Item', 5, y);
    doc.text('Qtd', 40, y);
    doc.text('Valor', 55, y, { align: 'right' });
    doc.text('Total', 73, y, { align: 'right' });
    y += 3;
    doc.setFont(undefined, 'normal');

    const itens = await DB.getAll('itens_venda');
    const vendaItems = itens.filter(i => i.venda_id === venda.id);
    for (const item of vendaItems) {
      const name = item.produto_nome.length > 18 ? item.produto_nome.substring(0, 18) + '...' : item.produto_nome;
      doc.text(name, 5, y);
      doc.text(String(item.quantidade), 42, y);
      doc.text(Store.formatMoney(item.preco_unitario), 55, y, { align: 'right' });
      doc.text(Store.formatMoney(item.subtotal), 73, y, { align: 'right' });
      y += 3.5;
    }

    y += 2;
    doc.line(5, y, 75, y); y += 4;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: ${Store.formatMoney(venda.total)}`, 73, y, { align: 'right' });
    y += 5;

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('Pagamentos:', 5, y); y += 3.5;
    doc.setFont(undefined, 'normal');

    const pags = await DB.getAll('pagamentos_venda');
    const vendaPags = pags.filter(p => p.venda_id === venda.id);
    for (const p of vendaPags) {
      doc.text(`${p.forma_pagamento}: ${Store.formatMoney(p.valor)}`, 5, y);
      y += 3.5;
    }

    y += 4;
    doc.setFontSize(7);
    doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });

    doc.save(`recibo_${venda.id.substring(0, 8)}.pdf`);
    Toast.success('PDF do recibo gerado!');
  } catch (e) {
    console.error('PDF error:', e);
    Toast.error('Erro ao gerar PDF');
  }
}
