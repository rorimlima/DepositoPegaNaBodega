'use client';
import { memo, useMemo, useState } from 'react';
import {
  Trash2, Plus, Minus, ShoppingCart, Search, Package,
  X, ArrowLeft, Receipt, Clock, UserPlus, User as UserIcon,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Helpers centavos-safe ────────────────────────────────────────────────────
const fmtBRL = (centavos) => `R$ ${(centavos / 100).toFixed(2)}`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── CartItem ─────────────────────────────────────────────────────────────────
const CartItem = memo(function CartItem({ item, onQtde, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-slate-900 rounded-xl p-3 border border-slate-800/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-100 truncate">{item.nome}</p>
        <p className="text-xs text-blue-400 font-bold">{fmtBRL(item.preco_centavos * item.qtde)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onQtde(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700"><Minus size={14} /></button>
        <span className="w-7 text-center text-sm font-bold text-slate-100">{item.qtde}</span>
        <button onClick={() => onQtde(item.id, 1)} className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700"><Plus size={14} /></button>
        <button onClick={() => onRemove(item.id)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20 ml-1"><Trash2 size={14} /></button>
      </div>
    </div>
  );
});

// ── Produto Button ───────────────────────────────────────────────────────────
const ProdutoBtn = memo(function ProdutoBtn({ p, onAdd }) {
  return (
    <button onClick={() => onAdd(p)}
      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden text-left active:scale-95 hover:border-blue-500/60 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500">
      <div className="h-16 sm:h-20 bg-slate-800/50 flex items-center justify-center relative">
        <Package size={24} className="text-slate-700" />
        <span className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${(p.quantidade || 0) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {p.quantidade || 0}
        </span>
      </div>
      <div className="p-2">
        <p className="text-[10px] text-slate-500 truncate">{p.categoria || p.codigo || ''}</p>
        <p className="text-xs font-semibold text-slate-100 line-clamp-1 leading-tight mt-0.5">{p.nome}</p>
        <p className="text-blue-400 font-black text-sm mt-0.5">{fmtBRL(p.preco_centavos)}</p>
      </div>
    </button>
  );
});

// ── Cliente Search Modal ─────────────────────────────────────────────────────
const ClienteModal = memo(function ClienteModal({ clientes, onSelect, onClose, onQuickAdd }) {
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => {
    if (!busca) return clientes.slice(0, 20);
    const q = busca.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q)).slice(0, 20);
  }, [clientes, busca]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[80dvh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <UserIcon size={16} className="text-blue-500" /> Selecionar Cliente
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input autoFocus placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filtrados.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <UserIcon size={14} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{c.nome}</p>
                {c.telefone && <p className="text-[11px] text-slate-500">{c.telefone}</p>}
              </div>
            </button>
          ))}
          {filtrados.length === 0 && <p className="text-center text-sm text-slate-600 py-8">Nenhum cliente encontrado</p>}
        </div>
        <div className="p-3 border-t border-slate-800 shrink-0">
          <button onClick={onQuickAdd}
            className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-700">
            <UserPlus size={14} /> Cadastro Rápido
          </button>
        </div>
      </div>
    </div>
  );
});

// ── COMANDA VIEW ─────────────────────────────────────────────────────────────
export default memo(function ComandaView({
  mesa, comanda, produtos, clientes,
  buscaProduto, onBuscaProdutoChange,
  onAddItem, onUpdateQtde, onRemoveItem,
  onUpdateCliente,
  onPedirConta, onVoltar, onOpenCadastroRapido
}) {
  const [showClienteModal, setShowClienteModal] = useState(false);
  const itens = comanda?.itens || [];
  const totalCentavos = useMemo(() => itens.reduce((a, i) => a + i.preco_centavos * i.qtde, 0), [itens]);
  const totalItens = useMemo(() => itens.reduce((a, i) => a + i.qtde, 0), [itens]);

  const clienteAtual = useMemo(() => {
    if (!comanda?.cliente_id) return null;
    return clientes.find(c => c.id === comanda.cliente_id) || null;
  }, [comanda?.cliente_id, clientes]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto) return produtos;
    const q = buscaProduto.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
  }, [produtos, buscaProduto]);

  const tempoAberta = comanda?.aberta_em
    ? Math.floor((Date.now() - new Date(comanda.aberta_em).getTime()) / 60000)
    : 0;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Catálogo de produtos ── */}
      <div className="flex-1 overflow-y-auto pb-36 lg:pb-6">
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button onClick={onVoltar} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 active:bg-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-blue-500 leading-none">
                {mesa === 0 ? 'Venda Balcão' : `Mesa ${String(mesa).padStart(2, '0')}`}
              </span>
              
              {/* Seleção de Cliente no Cabeçalho */}
              {clienteAtual ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg max-w-[150px] sm:max-w-[200px]">
                  <UserIcon size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-400 font-medium truncate">{clienteAtual.nome}</span>
                  <button onClick={() => onUpdateCliente(null)} className="text-emerald-400/50 hover:text-emerald-400 ml-1 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowClienteModal(true)} className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-xs font-medium transition-colors">
                  <UserIcon size={12} /> + Cliente
                </button>
              )}

            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1.5">
              <Clock size={9} /> {tempoAberta}min · {totalItens} itens · {fmtBRL(totalCentavos)}
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input type="search" placeholder="Buscar produto..."
              value={buscaProduto} onChange={e => onBuscaProdutoChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Grid produtos */}
        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
          {produtosFiltrados.map(p => <ProdutoBtn key={p.id} p={p} onAdd={onAddItem} />)}
          {produtosFiltrados.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-600">
              <Package size={32} className="mb-2" /><p className="text-sm">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar Comanda ── */}
      <div className="hidden lg:flex w-[380px] shrink-0 border-l border-slate-800 bg-slate-950 flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Receipt size={18} className="text-blue-500" /> Comanda
          </h2>
          {totalItens > 0 && <span className="bg-blue-500/10 text-blue-500 text-xs font-bold px-3 py-1 rounded-full">{totalItens} itens</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600">
              <ShoppingCart size={32} className="mb-2" /><p className="text-sm">Comanda vazia</p>
            </div>
          ) : itens.map(item => (
            <CartItem key={item.id} item={item} onQtde={onUpdateQtde} onRemove={onRemoveItem} />
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-slate-400 font-medium">Total</span>
            <span className="text-3xl font-black text-blue-500">{fmtBRL(totalCentavos)}</span>
          </div>
          <button onClick={onPedirConta} disabled={itens.length === 0}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-900/30">
            <Receipt size={20} /> Fechar Conta
          </button>
        </div>
      </div>

      {/* ── Mobile Footer ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 p-3 flex items-center gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{totalItens} itens</p>
          <p className="text-xl font-black text-blue-500">{fmtBRL(totalCentavos)}</p>
        </div>
        <button onClick={onPedirConta} disabled={itens.length === 0}
          className="h-12 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm flex items-center gap-2 active:opacity-80 disabled:opacity-30 transition-all shrink-0">
          <Receipt size={16} /> Fechar Conta
        </button>
      </div>

      {/* Modal seleção de cliente */}
      {showClienteModal && (
        <ClienteModal
          clientes={clientes}
          onSelect={(c) => { onUpdateCliente(c.id); setShowClienteModal(false); }}
          onClose={() => setShowClienteModal(false)}
          onQuickAdd={() => { setShowClienteModal(false); onOpenCadastroRapido(); }}
        />
      )}
    </div>
  );
});
