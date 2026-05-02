'use client';

import { useState, useCallback, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { Trash2, Edit, Plus, User, MapPin, Phone, Save, X, Navigation, Search } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Formulário FORA do pai — estado interno isolado
// ─────────────────────────────────────────────────────────────────────────────
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

/** Card de cliente */
const ClienteCard = memo(function ClienteCard({ c, onEdit, onDelete }) {
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
          <button onClick={() => onEdit(c)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700">
            <Edit size={13} />
          </button>
          <button onClick={() => onDelete(c.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];

  const [busca,    setBusca]    = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);

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
        {/* Desktop: form lateral sempre visível */}
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
              <ClienteCard key={c.id} c={c} onEdit={handleEdit} onDelete={handleDelete} />
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
    </div>
  );
}
