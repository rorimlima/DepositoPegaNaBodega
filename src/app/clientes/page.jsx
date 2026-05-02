'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Edit, Plus, User, MapPin, Phone, Save, X, Navigation, Search } from 'lucide-react';

export default function ClientesPage() {
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [busca, setBusca] = useState('');
  const [editId, setEditId] = useState(null);

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.telefone || '').includes(busca)
  );

  const resetForm = () => {
    setNome(''); setTelefone(''); setEndereco(''); setEditId(null);
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setNome(c.nome);
    setTelefone(c.telefone || '');
    setEndereco(c.endereco || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome) return;

    if (editId) {
      const updated = { id: editId, nome, telefone, endereco };
      await db.clientes.put(updated);
      await addToSyncQueue('clientes', 'UPDATE', updated);
    } else {
      const newClient = { id: uuidv4(), nome, telefone, endereco };
      await db.clientes.add(newClient);
      await addToSyncQueue('clientes', 'INSERT', newClient);
    }

    resetForm();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este cliente?')) return;
    await db.clientes.delete(id);
    await addToSyncQueue('clientes', 'DELETE', { id });
  };

  const openInMaps = (addr) => {
    if (!addr) return;
    const encoded = encodeURIComponent(addr);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-500">Gerenciar Clientes</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Form ── */}
        <div className="w-full lg:w-[360px] shrink-0">
          <Card className="bg-slate-950 border-slate-800">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-100">{editId ? '✏️ Editar Cliente' : '👤 Novo Cliente'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nome Completo *</label>
                  <Input placeholder="Nome do Cliente" value={nome} onChange={e => setNome(e.target.value)} required className="bg-slate-900 border-slate-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telefone</label>
                  <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)} className="bg-slate-900 border-slate-800" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-blue-500" /> Endereço
                  </label>
                  <Input placeholder="Rua, Número, Bairro, Cidade" value={endereco} onChange={e => setEndereco(e.target.value)} className="bg-slate-900 border-slate-800" />
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold">
                    {editId ? <><Save className="mr-2 h-4 w-4" /> Salvar</> : <><Plus className="mr-2 h-4 w-4" /> Cadastrar</>}
                  </Button>
                  {editId && (
                    <Button type="button" variant="outline" onClick={resetForm} className="border-slate-800 text-slate-400 hover:bg-slate-800">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Client List ── */}
        <div className="flex-1">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input placeholder="Buscar cliente por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} className="bg-slate-900 border-slate-800 pl-10" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clientesFiltrados.map(c => (
              <Card key={c.id} className="bg-slate-950 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={18} className="text-blue-500" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-semibold text-slate-100 line-clamp-1">{c.nome}</h3>
                      {c.telefone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Phone size={10} /> {c.telefone}
                        </p>
                      )}
                      {c.endereco && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin size={10} className="text-slate-500 shrink-0" />
                          <p className="text-xs text-slate-400 line-clamp-1 flex-1">{c.endereco}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openInMaps(c.endereco)}
                            className="h-6 px-2 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 shrink-0"
                          >
                            <Navigation size={10} className="mr-1" /> Maps
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-7 w-7 text-zinc-400 border-zinc-800 hover:bg-zinc-800" onClick={() => startEdit(c)}>
                        <Edit size={12} />
                      </Button>
                      <Button size="icon" variant="outline" className="h-7 w-7 text-red-500 border-zinc-800 hover:bg-red-500/20" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {clientesFiltrados.length === 0 && <p className="text-zinc-500 col-span-full">Nenhum cliente encontrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
