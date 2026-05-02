'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Edit, Plus, Image as ImageIcon } from 'lucide-react';

export default function ProdutosPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  // For simplicity photo is just a text or omitted, or base64. 

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nome || !preco) return;

    // Convert to cents to avoid float issues
    const preco_centavos = Math.round(parseFloat(preco.replace(',', '.')) * 100);

    const newProd = {
      id: uuidv4(),
      nome,
      codigo,
      categoria,
      preco_centavos
    };

    await db.produtos.add(newProd);
    await addToSyncQueue('produtos', 'INSERT', newProd);

    setNome('');
    setCodigo('');
    setCategoria('');
    setPreco('');
  };

  const handleDelete = async (id) => {
    await db.produtos.delete(id);
    await addToSyncQueue('produtos', 'DELETE', { id });
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-amber-500 mb-6">Gerenciar Produtos</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">Novo Produto</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input placeholder="Nome do Produto" value={nome} onChange={e => setNome(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
                <Input placeholder="Código (Ex: SK001)" value={codigo} onChange={e => setCodigo(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                <Input placeholder="Categoria (Ex: Cervejas)" value={categoria} onChange={e => setCategoria(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                <Input placeholder="Preço (Ex: 15.50)" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
                
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          {/* Card stack format for Mobile, Grid/Table for PC implicitly by styling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {produtos.map(p => (
              <Card key={p.id} className="bg-zinc-950 border-zinc-800">
                <div className="h-24 bg-zinc-900 flex items-center justify-center rounded-t-lg">
                  <ImageIcon size={32} className="text-zinc-800" />
                </div>
                <CardContent className="p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">{p.codigo || 'S/N'}</p>
                    <h3 className="font-semibold text-zinc-100 line-clamp-1">{p.nome}</h3>
                    <p className="text-xs text-zinc-400">{p.categoria}</p>
                    <p className="text-amber-500 font-bold mt-2">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="icon" variant="outline" className="h-8 w-8 text-zinc-400 border-zinc-800 hover:bg-zinc-800">
                      <Edit size={14} />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 border-zinc-800 hover:bg-red-500/20" onClick={() => handleDelete(p.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {produtos.length === 0 && <p className="text-zinc-500">Nenhum produto encontrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
