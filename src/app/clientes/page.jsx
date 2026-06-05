'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import {
  Trash2, Edit, Plus, User, MapPin, Phone, Save, X,
  Navigation, Search, Eye, ShoppingCart, DollarSign,
  Package, TrendingUp, ArrowDownRight
} from 'lucide-react';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ── Formulário isolado ──────────────────────────────────────────────────────
const ClienteForm = memo(function ClienteForm({ initial, onSave, onCancel }) {
  const [nome,     setNome]     = useState(initial?.nome     ?? '');
  const [telefone, setTelefone] = useState(initial?.telefone ?? '');
  const [endereco, setEndereco] = useState(initial?.endereco ?? '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome) return;
    onSave({ nome, telefone, endereco });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Nome Completo *</label>
        <Input placeholder="Nome do Cliente" value={nome} onChange={e => setNome(e.target.value)} required
          className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Telefone</label>
        <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)}
          inputMode="tel" className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
          <MapPin className="h-3 w-3 text-blue-500" /> Endereço
        </label>
        <Input placeholder="Rua, Número, Bairro, Cidade" value={endereco} onChange={e => setEndereco(e.target.value)}
          className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit"
          className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 active:bg-blue-700 transition-all">
          {initial?.isEdit ? <><Save size={16} /> Salvar</> : <><Plus size={16} /> Cadastrar</>}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="w-12 h-12 rounded-xl border border-slate-700 text-slate-400 flex items-center justify-center">
            <X size={16} />
          </button>
        )}
      </div>
    </form>
  );
});

// ── Card de cliente ──────────────────────────────────────────────────────────
const ClienteCard = memo(function ClienteCard({ c, onEdit, onDelete, onDetails }) {
  const openMaps = () => {
    if (c.endereco) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.endereco)}`, '_blank');
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
          <User size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{c.nome}</h3>
          {c.telefone && (
            <a href={`tel:${c.telefone}`} className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 hover:text-blue-400">
              <Phone size={11} /> {c.telefone}
            </a>
          )}
          {c.endereco && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={11} className="text-slate-600 shrink-0" />
              <p className="text-xs text-slate-500 truncate flex-1">{c.endereco}</p>
              <button onClick={openMaps}
                className="shrink-0 text-[10px] text-blue-500 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 active:bg-blue-500/20">
                <Navigation size={9} /> Maps
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 ml-1">
          <button onClick={() => onDetails(c)} title="Detalhes" className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 active:bg-green-500/20">
            <Eye size={13} />
          </button>
          <button onClick={() => onEdit(c)} title="Editar" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700">
            <Edit size={13} />
          </button>
          <button onClick={() => onDelete(c.id)} title="Excluir" className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
});

// ── Modal de Detalhes ────────────────────────────────────────────────────────
const DetalhesModal = memo(function DetalhesModal({ cliente, vendas, onClose }) {
  const stats = useMemo(() => {
    const vendasCliente = vendas.filter(v => v.cliente_id === cliente.id);
    const totalVendas = vendasCliente.length;
    const totalFaturado = vendasCliente.reduce((a, v) => a + (v.total_centavos || 0), 0);

    // Total pago vs fiado
    let totalPago = 0, totalFiado = 0;
    vendasCliente.forEach(v => {
      (v.pagamentos || []).forEach(p => {
        const val = Math.round(parseFloat(p.valor || 0) * 100);
        if (p.metodo === 'Fiado') totalFiado += val;
        else totalPago += val;
      });
    });

    // Produto mais comprado
    const prodMap = {};
    vendasCliente.forEach(v => {
      (v.itens || []).forEach(it => {
        prodMap[it.nome] = (prodMap[it.nome] || 0) + (it.qtde || 1);
      });
    });
    const entries = Object.entries(prodMap);
    entries.sort((a, b) => b[1] - a[1]);
    const topProduto = entries.length ? { nome: entries[0][0], qtde: entries[0][1] } : null;

    return { totalVendas, totalFaturado, totalPago, totalFiado, topProduto, vendasCliente };
  }, [vendas, cliente]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <User size={18} className="text-blue-500" /> {cliente.nome}
            </h3>
            {cliente.telefone && <p className="text-xs text-slate-500 mt-0.5">{cliente.telefone}</p>}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* KPIs do cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingCart size={12} className="text-blue-400" />
                <span className="text-[10px] text-slate-500 uppercase">Vendas</span>
              </div>
              <p className="text-lg font-black text-blue-400">{stats.totalVendas}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} className="text-green-400" />
                <span className="text-[10px] text-slate-500 uppercase">Faturado</span>
              </div>
              <p className="text-lg font-black text-green-400">{fmt(stats.totalFaturado)}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-[10px] text-slate-500 uppercase">Pago</span>
              </div>
              <p className="text-lg font-black text-emerald-400">{fmt(stats.totalPago)}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight size={12} className="text-red-400" />
                <span className="text-[10px] text-slate-500 uppercase">Devedor</span>
              </div>
              <p className="text-lg font-black text-red-400">{fmt(stats.totalFiado)}</p>
            </div>
          </div>

          {/* Produto mais comprado */}
          {stats.topProduto && (
            <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Package size={18} className="text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Produto Favorito</p>
                <p className="text-sm font-bold text-purple-400">{stats.topProduto.nome}</p>
                <p className="text-[10px] text-slate-500">{stats.topProduto.qtde} unidades compradas</p>
              </div>
            </div>
          )}

          {/* Histórico de vendas */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase font-semibold mb-2">Histórico de Compras</h4>
            <div className="space-y-1.5">
              {stats.vendasCliente.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-4">Nenhuma compra registrada.</p>
              ) : (
                stats.vendasCliente.sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda)).slice(0, 15).map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono text-blue-400">#{v.codigo || v.id.substring(0, 8)}</span>
                      <p className="text-[10px] text-slate-500">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-bold text-slate-100">{fmt(v.total_centavos)}</p>
                      {v.pagamentos?.some(p => p.metodo === 'Fiado') && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">FIADO</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function ClientesPage() {
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const vendas   = useLiveQuery(() => db?.vendas?.filter(v => !v.is_deleted).toArray()   || [], []) || [];

  const [busca,    setBusca]    = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [detalhes, setDetalhes] = useState(null); // cliente para mostrar detalhes

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.telefone || '').includes(busca)
  );

  const handleSave = useCallback(async ({ nome, telefone, endereco }) => {
    if (editData?.id) {
      const up = { id: editData.id, nome, telefone, endereco };
      await db.clientes.put(up);
      await addToSyncQueue('clientes', 'UPDATE', up);
    } else {
      const nc = { id: uuidv4(), nome, telefone, endereco };
      await db.clientes.add(nc);
      await addToSyncQueue('clientes', 'INSERT', nc);
    }
    setFormOpen(false); setEditData(null);
  }, [editData]);

  const handleEdit = useCallback((c) => {
    setEditData({ id: c.id, isEdit: true, nome: c.nome, telefone: c.telefone || '', endereco: c.endereco || '' });
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Excluir este cliente?')) return;
    await db.clientes.delete(id);
    await addToSyncQueue('clientes', 'DELETE', { id });
  }, []);

  const handleCancel = useCallback(() => {
    setFormOpen(false); setEditData(null);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-500">Clientes</h1>
        <button
          onClick={() => { setEditData(null); setFormOpen(true); }}
          className="md:hidden flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:bg-blue-700">
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Desktop form */}
        <div className="hidden lg:block w-[340px] shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-slate-800">
              <h2 className="font-bold text-slate-100">{editData?.isEdit ? '✏️ Editar Cliente' : '👤 Novo Cliente'}</h2>
            </div>
            <ClienteForm key={editData?.id ?? 'new'} initial={editData} onSave={handleSave} onCancel={editData ? handleCancel : undefined} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <Input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
              className="bg-slate-900 border-slate-800 pl-10 h-11" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clientesFiltrados.map(c => (
              <ClienteCard key={c.id} c={c}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDetails={setDetalhes}
              />
            ))}
            {clientesFiltrados.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-12 text-slate-600">
                <User size={36} className="mb-2" />
                <p className="text-sm">Nenhum cliente encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Bottom Drawer */}
      {formOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full bg-slate-950 border-t border-slate-800 rounded-t-3xl overflow-hidden relative"
            style={{ maxHeight: '92dvh' }}>
            <div className="w-10 h-1 bg-slate-700 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
            <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-slate-800">
              <h2 className="font-bold text-slate-100">{editData?.isEdit ? '✏️ Editar Cliente' : '👤 Novo Cliente'}</h2>
              <button onClick={handleCancel} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 64px)' }}>
              <ClienteForm key={editData?.id ?? 'new'} initial={editData} onSave={handleSave} onCancel={handleCancel} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {detalhes && (
        <DetalhesModal cliente={detalhes} vendas={vendas} onClose={() => setDetalhes(null)} />
      )}
    </div>
  );
}
