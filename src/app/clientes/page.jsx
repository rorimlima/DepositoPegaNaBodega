'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Edit, Plus, User } from 'lucide-react';

export default function ClientesPage() {
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nome) return;

    const newClient = {
      id: uuidv4(),
      nome,
      telefone
    };

    await db.clientes.add(newClient);
    await addToSyncQueue('clientes', 'INSERT', newClient);

    setNome('');
    setTelefone('');
  };

  const handleDelete = async (id) => {
    await db.clientes.delete(id);
    await addToSyncQueue('clientes', 'DELETE', { id });
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-amber-500 mb-6">Gerenciar Clientes</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">Novo Cliente</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input placeholder="Nome Completo" value={nome} onChange={e => setNome(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
                <Input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clientes.map(c => (
              <Card key={c.id} className="bg-zinc-950 border-zinc-800 flex flex-row items-center p-4 gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                  <User size={20} className="text-zinc-500" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-semibold text-zinc-100 line-clamp-1">{c.nome}</h3>
                  <p className="text-xs text-zinc-400">{c.telefone || 'Sem telefone'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 border-zinc-800 hover:bg-red-500/20" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
            {clientes.length === 0 && <p className="text-zinc-500">Nenhum cliente cadastrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
