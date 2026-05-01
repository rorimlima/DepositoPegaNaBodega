// ========== Global Store ==========
const Store = {
  _cart: [],
  _listeners: [],

  // Cart management
  get cart() { return this._cart; },

  addToCart(product) {
    const existing = this._cart.find(i => i.produto_id === product.id);
    if (existing) {
      if (existing.quantidade >= product.estoque_atual) {
        Toast.warning('Estoque insuficiente!');
        return;
      }
      existing.quantidade++;
      existing.subtotal = existing.quantidade * existing.preco_unitario;
    } else {
      if (product.estoque_atual <= 0) {
        Toast.warning('Produto sem estoque!');
        return;
      }
      this._cart.push({
        produto_id: product.id,
        produto_nome: product.nome,
        preco_unitario: product.preco_venda,
        quantidade: 1,
        subtotal: product.preco_venda
      });
    }
    Toast.success(`${product.nome} adicionado`);
    this._notify();
  },

  updateQty(produtoId, delta) {
    const item = this._cart.find(i => i.produto_id === produtoId);
    if (!item) return;
    item.quantidade += delta;
    if (item.quantidade <= 0) {
      this._cart = this._cart.filter(i => i.produto_id !== produtoId);
    } else {
      item.subtotal = item.quantidade * item.preco_unitario;
    }
    this._notify();
  },

  removeFromCart(produtoId) {
    this._cart = this._cart.filter(i => i.produto_id !== produtoId);
    this._notify();
  },

  clearCart() {
    this._cart = [];
    this._notify();
  },

  getCartTotal() {
    return this._cart.reduce((sum, i) => sum + i.subtotal, 0);
  },

  onCartChange(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => fn(this._cart)); },

  // Helpers
  formatMoney(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  },

  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};
