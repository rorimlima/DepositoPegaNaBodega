'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Trash2, Plus, Minus, Receipt, ShoppingCart,
  Package, Search, X, UserPlus,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes FORA do componente pai — evita remount a cada keystroke
// ─────────────────────────────────────────────────────────────────────────────

/** Item individual do carrinho */
const CartItem = memo(function CartItem({ item, onQtde, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-xl p-3 border border-slate-800/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100 truncate">{item.nome}</p>
        <p className="text-xs text-blue-400 font-bold">
          R$ {((item.preco_centavos * item.qtde) / 100).toFixed(2)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onQtde(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700">
          <Minus size={14} />
        </button>
        <span className="w-7 text-center text-sm font-bold text-slate-100">{item.qtde}</span>
        <button onClick={() => onQtde(item.id, 1)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700">
          <Plus size={14} />
        </button>
        <button onClick={() => onRemove(item.id)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20 ml-1">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

/** Linha de pagamento */
const PagRow = memo(function PagRow({ pag, idx, onUpdate, onRemove, showRemove }) {
  return (
    <div className="flex gap-2 items-center">
      <Select value={pag.metodo} onValueChange={v => onUpdate(idx, 'metodo', v)}>
        <SelectTrigger className="h-10 text-xs bg-slate-900 border-slate-800 flex-1 min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
          <SelectItem value="PIX">📱 PIX</SelectItem>
          <SelectItem value="Cartão Crédito">💳 Crédito</SelectItem>
          <SelectItem value="Cartão Débito">💳 Débito</SelectItem>
          <SelectItem value="Fiado">📝 Fiado</SelectItem>
        </SelectContent>
      </Select>
      <input
        type="number" inputMode="decimal" placeholder="0,00" step="0.01"
        value={pag.valor} onChange={e => onUpdate(idx, 'valor', e.target.value)}
        className="h-10 w-24 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showRemove && (
        <button onClick={() => onRemove(idx)} className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  );
});

/** Autocomplete de clientes */
const ClienteSearch = memo(function ClienteSearch({
  value, onChange, clientes, selectedId, onSelect, onClear, onOpenModal,
}) {
  const [open, setOpen] = useState(false);

  const filtrados = useMemo(() =>
    clientes.filter(c =>
      c.nome.toLowerCase().includes(value.toLowerCase()) ||
      (c.telefone || '').includes(value)
    ).slice(0, 5),
  [clientes, value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
      <input
        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Buscar cliente..."
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {selectedId && (
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={onClear}>
          <X size={14} />
        </button>
      )}
      {open && (
        <ul className="absolute z-30 w-full mt-1 border border-slate-700 rounded-lg overflow-hidden bg-slate-900 divide-y divide-slate-800/60 shadow-xl">
          {filtrados.map(c => (
            <li key={c.id} onMouseDown={() => { onSelect(c); setOpen(false); }}
              className="px-4 py-3 cursor-pointer text-sm text-slate-300 hover:bg-slate-800 hover:text-blue-400">
              <span className="font-medium">{c.nome}</span>
              {c.telefone && <span className="block text-[11px] text-slate-500">{c.telefone}</span>}
            </li>
          ))}
          {filtrados.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500 text-center">Nenhum encontrado</li>
          )}
          <li onMouseDown={() => { setOpen(false); onOpenModal(); }}
            className="px-4 py-3 text-sm font-semibold text-blue-500 bg-blue-500/10 flex items-center justify-center gap-2 cursor-pointer hover:bg-blue-500/20">
            <UserPlus size={14} /> Cadastrar Rápido
          </li>
        </ul>
      )}
    </div>
  );
});

/** Painel do carrinho — isolado para não re-renderizar a grade de produtos */
const CartPanel = memo(function CartPanel({
  cart, clientes, pagamentos,
  totalCentavos,
  buscaCliente, selectedClient,
  onClienteChange, onClienteSelect, onClienteClear, onOpenModal,
  onQtde, onRemove,
  onAddPag, onUpdatePag, onRemovePag,
  onFinalize,
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Cliente */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <label className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
          Cliente (opcional)
        </label>
        <ClienteSearch
          value={buscaCliente}
          onChange={onClienteChange}
          clientes={clientes}
          selectedId={selectedClient}
          onSelect={onClienteSelect}
          onClear={onClienteClear}
          onOpenModal={onOpenModal}
        />
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600">
            <ShoppingCart size={32} className="mb-2" />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          cart.map(item => (
            <CartItem key={item.id} item={item} onQtde={onQtde} onRemove={onRemove} />
          ))
        )}

        {/* Pagamentos */}
        {cart.length > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">Pagamento</span>
              <button onClick={onAddPag} className="text-xs text-blue-500 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-500/10">
                <Plus size={12} /> Add
              </button>
            </div>
            {pagamentos.map((pag, i) => (
              <PagRow key={i} pag={pag} idx={i}
                onUpdate={onUpdatePag} onRemove={onRemovePag}
                showRemove={pagamentos.length > 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-slate-400 font-medium">Total</span>
          <span className="text-3xl font-black text-blue-500">
            R$ {(totalCentavos / 100).toFixed(2)}
          </span>
        </div>
        <button
          onClick={onFinalize}
          disabled={cart.length === 0}
          className="w-full h-14 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center gap-2 active:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Receipt size={20} /> Finalizar Venda
        </button>
      </div>
    </div>
  );
});

/** Modal de cadastro rápido de cliente */
const ModalCadastroRapido = memo(function ModalCadastroRapido({ onClose, onSave }) {
  const [nome, setNome] = useState('');
  const [tel,  setTel]  = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome) return;
    onSave({ nome, telefone: tel });
    setNome(''); setTel('');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" /> Cadastro Rápido
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Nome *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)}
              placeholder="João da Silva" autoFocus
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 h-12 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Telefone</label>
            <input value={tel} onChange={e => setTel(e.target.value)}
              placeholder="(11) 99999-9999" inputMode="tel"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 h-12 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold active:bg-blue-700 transition-all">
            Salvar e Selecionar
          </button>
        </form>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL — mínimo de estado, handlers com useCallback
// ─────────────────────────────────────────────────────────────────────────────
export default function PDVPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa  = useLiveQuery(() => db?.empresa?.toArray()  || [], []) || [];

  const [cart,       setCart]       = useState([]);
  const [pagamentos, setPagamentos] = useState([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  // Cliente
  const [buscaCliente,   setBuscaCliente]   = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [modalOpen,      setModalOpen]      = useState(false);

  const gerarCodigo = () => String(Math.floor(10000000 + Math.random() * 90000000));

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto) return produtos;
    const q = buscaProduto.toLowerCase();
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)
    );
  }, [produtos, buscaProduto]);

  const totalCentavos = useMemo(() => cart.reduce((a, i) => a + i.preco_centavos * i.qtde, 0), [cart]);
  const totalItens    = useMemo(() => cart.reduce((a, i) => a + i.qtde, 0), [cart]);

  // ── Handlers estáveis (useCallback) ──────────────────────────────────────
  const addToCart = useCallback((p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      return ex ? prev.map(i => i.id === p.id ? { ...i, qtde: i.qtde + 1 } : i) : [...prev, { ...p, qtde: 1 }];
    });
  }, []);

  const updateQtde = useCallback((id, delta) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qtde: Math.max(1, i.qtde + delta) } : i)),
  []);

  const removeFromCart = useCallback((id) =>
    setCart(prev => prev.filter(i => i.id !== id)),
  []);

  const handleAddPag    = useCallback(() =>
    setPagamentos(p => [...p, { valor: '', metodo: 'PIX', data: new Date().toISOString().split('T')[0] }]),
  []);

  const handleUpdatePag = useCallback((idx, field, val) =>
    setPagamentos(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x)),
  []);

  const handleRemovePag = useCallback((idx) =>
    setPagamentos(p => p.filter((_, i) => i !== idx)),
  []);

  const handleClienteSelect = useCallback((c) => {
    setSelectedClient(c.id); setBuscaCliente(c.nome);
  }, []);

  const handleClienteClear = useCallback(() => {
    setSelectedClient(''); setBuscaCliente('');
  }, []);

  const handleQuickSave = useCallback(async ({ nome, telefone }) => {
    const nc = { id: uuidv4(), nome, telefone, endereco: '' };
    await db.clientes.add(nc);
    await addToSyncQueue('clientes', 'INSERT', nc);
    setSelectedClient(nc.id); setBuscaCliente(nc.nome);
    setModalOpen(false);
  }, []);

  const generatePDF = useCallback((venda) => {
    const doc = new jsPDF('p', 'mm', [80, 297]);
    const co = empresa[0] || { nome: 'SDO', cnpj: '00.000.000/0000-00', telefone: '' };
    doc.setFontSize(14); doc.text(co.nome, 40, 10, { align: 'center' });
    doc.setFontSize(9);  doc.text(`CNPJ: ${co.cnpj || ''}`, 40, 15, { align: 'center' });
    doc.text('─────────────────────', 40, 19, { align: 'center' });
    doc.text('CUPOM NÃO FISCAL', 40, 24, { align: 'center' });
    doc.text(`Cód: ${venda.codigo}  ${new Date(venda.data_venda).toLocaleString('pt-BR')}`, 40, 29, { align: 'center' });
    let y = 36;
    doc.text('QTD DESCRIÇÃO         V.UN   TOTAL', 4, y); y += 5;
    venda.itens.forEach(it => {
      const vu = (it.preco_centavos / 100).toFixed(2);
      const t  = ((it.preco_centavos * it.qtde) / 100).toFixed(2);
      doc.text(`${String(it.qtde).padEnd(3)} ${it.nome.substring(0,14).padEnd(14)} ${vu.padStart(6)} ${t.padStart(6)}`, 4, y);
      y += 5;
    });
    y += 3; doc.text('─────────────────────', 40, y, { align: 'center' }); y += 5;
    doc.setFontSize(12); doc.text(`TOTAL: R$ ${(venda.total_centavos / 100).toFixed(2)}`, 40, y, { align: 'center' }); y += 8;
    doc.setFontSize(9);
    venda.pagamentos.forEach(pg => { doc.text(`${pg.metodo}: R$ ${parseFloat(pg.valor || 0).toFixed(2)}`, 4, y); y += 5; });
    doc.save(`cupom_${venda.codigo}.pdf`);
  }, [empresa]);

  const handleFinalize = useCallback(async () => {
    if (!cart.length) return alert('Carrinho vazio!');
    const codigo = gerarCodigo();
    const venda = {
      id: uuidv4(), codigo,
      cliente_id: selectedClient || null,
      total_centavos: totalCentavos,
      data_venda: new Date().toISOString(),
      pagamentos, itens: cart,
    };
    await db.vendas.add(venda);
    for (const item of cart) {
      const prod = await db.produtos.get(item.id);
      if (prod) {
        const nq = Math.max(0, (prod.quantidade || 0) - item.qtde);
        await db.produtos.update(item.id, { quantidade: nq });
        await addToSyncQueue('produtos', 'UPDATE', { ...prod, quantidade: nq });
      }
    }
    await addToSyncQueue('vendas', 'INSERT', venda);
    generatePDF(venda);
    setCart([]);
    setPagamentos([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
    setSelectedClient(''); setBuscaCliente(''); setBuscaProduto('');
    setCartOpen(false);
  }, [cart, selectedClient, totalCentavos, pagamentos, generatePDF]);

  // Props estáveis para CartPanel
  const cartPanelProps = {
    cart, clientes, pagamentos, totalCentavos,
    buscaCliente, selectedClient,
    onClienteChange: setBuscaCliente,
    onClienteSelect: handleClienteSelect,
    onClienteClear: handleClienteClear,
    onOpenModal: () => setModalOpen(true),
    onQtde: updateQtde,
    onRemove: removeFromCart,
    onAddPag: handleAddPag,
    onUpdatePag: handleUpdatePag,
    onRemovePag: handleRemovePag,
    onFinalize: handleFinalize,
  };

  return (
    <div className="flex flex-col lg:flex-row h-full relative">
      {/* ── Grade de Produtos ── */}
      <div className="flex-1 overflow-y-auto pb-36 lg:pb-6">
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="search" placeholder="Buscar produto..."
              value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="hidden sm:block text-lg font-black text-blue-500 shrink-0">PDV</span>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {produtosFiltrados.map(p => (
            <button
              key={p.id}
              onClick={() => { addToCart(p); setCartOpen(true); }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden text-left active:scale-95 hover:border-blue-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="h-20 sm:h-28 bg-slate-800/50 flex items-center justify-center relative">
                <Package size={32} className="text-slate-700" />
                <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${(p.quantidade || 0) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {p.quantidade || 0}
                </span>
              </div>
              <div className="p-3">
                <p className="text-[10px] text-slate-500 truncate">{p.categoria || p.codigo || ''}</p>
                <p className="text-sm font-semibold text-slate-100 line-clamp-2 leading-tight mt-0.5">{p.nome}</p>
                <p className="text-blue-400 font-black text-base mt-1">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
              </div>
            </button>
          ))}
          {produtosFiltrados.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-600">
              <Package size={40} className="mb-3" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE: FAB + Drawer ── */}
      <div className="lg:hidden">
        <button
          onClick={() => setCartOpen(v => !v)}
          className="fixed bottom-20 right-4 z-40 w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-900/50 flex items-center justify-center flex-col gap-0.5 active:bg-blue-700 transition-all"
        >
          <ShoppingCart size={22} />
          {totalItens > 0 && <span className="text-[11px] font-black leading-none">{totalItens}</span>}
        </button>

        {cartOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setCartOpen(false)} />}

        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl transition-transform duration-300 ${cartOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
        >
          <div className="shrink-0 pt-3 pb-2 px-4 border-b border-slate-800">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-100 flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-500" /> Carrinho
                {totalItens > 0 && <span className="bg-blue-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{totalItens}</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <CartPanel {...cartPanelProps} />
          </div>
        </div>
      </div>

      {/* ── DESKTOP: Sidebar ── */}
      <div className="hidden lg:flex w-[400px] shrink-0 border-l border-slate-800 bg-slate-950 flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-500" /> Carrinho
          </h2>
          {totalItens > 0 && <span className="bg-blue-500/10 text-blue-500 text-xs font-bold px-3 py-1 rounded-full">{totalItens} itens</span>}
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <CartPanel {...cartPanelProps} />
        </div>
      </div>

      {/* ── Modal Cadastro Rápido ── */}
      {modalOpen && <ModalCadastroRapido onClose={() => setModalOpen(false)} onSave={handleQuickSave} />}
    </div>
  );
}
