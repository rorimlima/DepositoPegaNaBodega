import { Toast } from './toast.js';
const fmt = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); });
const _listeners = [];
let _cart = [];
export const Store = {
  get cart() { return _cart; },
  formatMoney: fmt,
  generateId: uid,
  addToCart(p) {
    const ex = _cart.find(i => i.produto_id === p.id);
    if (ex) { if (ex.quantidade >= p.estoque_atual) { Toast.warning('Estoque insuficiente!'); return; } ex.quantidade++; ex.subtotal = ex.quantidade * ex.preco_unitario; }
    else { if (p.estoque_atual <= 0) { Toast.warning('Sem estoque!'); return; } _cart.push({ produto_id:p.id, produto_nome:p.nome, preco_unitario:p.preco_venda, quantidade:1, subtotal:p.preco_venda }); }
    Toast.success(`${p.nome} adicionado`);
    this._notify();
  },
  updateQty(id, d) { const i = _cart.find(x => x.produto_id === id); if (!i) return; i.quantidade += d; if (i.quantidade <= 0) _cart = _cart.filter(x => x.produto_id !== id); else i.subtotal = i.quantidade * i.preco_unitario; this._notify(); },
  removeFromCart(id) { _cart = _cart.filter(x => x.produto_id !== id); this._notify(); },
  clearCart() { _cart = []; this._notify(); },
  getCartTotal() { return _cart.reduce((s,i) => s + i.subtotal, 0); },
  onCartChange(fn) { _listeners.push(fn); },
  _notify() { _listeners.forEach(fn => fn(_cart)); }
};
