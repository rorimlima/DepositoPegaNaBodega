'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue, CATEGORIAS_DEPOSITO } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, Package, DollarSign, TrendingUp, Warehouse, Search, Save, X } from 'lucide-react';

export default function ProdutosPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  const [custo, setCusto] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  // Edit mode
  const [editId, setEditId] = useState(null);

  // ── Computed KPIs ──
  const { custoEstoque, potencialVenda, totalItens } = useMemo(() => {
    let ce = 0, pv = 0, ti = 0;
    produtos.forEach(p => {
      const qtd = p.quantidade || 0;
      ti += qtd;
      ce += qtd * (p.custo_centavos || 0);
      pv += qtd * (p.preco_centavos || 0);
    });
    return { custoEstoque: ce, potencialVenda: pv, totalItens: ti };
  }, [produtos]);

  // ── Filtered list ──
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase());
      const matchCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      return matchBusca && matchCategoria;
    });
  }, [produtos, busca, filtroCategoria]);

  const resetForm = () => {
    setNome(''); setCodigo(''); setCategoria(''); setPreco(''); setCusto(''); setQuantidade(''); setEditId(null);
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setNome(p.nome);
    setCodigo(p.codigo || '');
    setCategoria(p.categoria || '');
    setPreco(((p.preco_centavos || 0) / 100).toFixed(2));
    setCusto(((p.custo_centavos || 0) / 100).toFixed(2));
    setQuantidade(String(p.quantidade || 0));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome || !preco) return;

    const preco_centavos = Math.round(parseFloat(preco.replace(',', '.')) * 100);
    const custo_centavos = custo ? Math.round(parseFloat(custo.replace(',', '.')) * 100) : 0;
    const qtd = quantidade ? parseInt(quantidade, 10) : 0;

    if (editId) {
      // UPDATE
      const updated = { id: editId, nome, codigo, categoria, preco_centavos, custo_centavos, quantidade: qtd };
      await db.produtos.put(updated);
      await addToSyncQueue('produtos', 'UPDATE', updated);
    } else {
      // INSERT
      const newProd = { id: uuidv4(), nome, codigo, categoria, preco_centavos, custo_centavos, quantidade: qtd };
      await db.produtos.add(newProd);
      await addToSyncQueue('produtos', 'INSERT', newProd);
    }

    resetForm();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este produto?')) return;
    await db.produtos.delete(id);
    await addToSyncQueue('produtos', 'DELETE', { id });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-amber-500">Gerenciar Produtos</h1>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Total Itens em Estoque</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-zinc-100">{totalItens.toLocaleString('pt-BR')}</div></CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Custo do Estoque</CardTitle>
            <Warehouse className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-red-400">R$ {(custoEstoque / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Potencial de Venda</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-green-400">R$ {(potencialVenda / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400">Lucro Potencial</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-amber-500">R$ {((potencialVenda - custoEstoque) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Form ── */}
        <div className="w-full lg:w-[360px] shrink-0">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">{editId ? '✏️ Editar Produto' : '📦 Novo Produto'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input placeholder="Nome do Produto *" value={nome} onChange={e => setNome(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
                <Input placeholder="Código (Ex: SK001)" value={codigo} onChange={e => setCodigo(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue placeholder="Selecione a Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DEPOSITO.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Custo (R$)</label>
                    <Input placeholder="0.00" type="number" step="0.01" min="0" value={custo} onChange={e => setCusto(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Preço Venda (R$) *</label>
                    <Input placeholder="0.00" type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)} required className="bg-zinc-900 border-zinc-800" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Quantidade em Estoque</label>
                  <Input placeholder="0" type="number" min="0" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="bg-zinc-900 border-zinc-800" />
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold">
                    {editId ? <><Save className="mr-2 h-4 w-4" /> Salvar</> : <><Plus className="mr-2 h-4 w-4" /> Cadastrar</>}
                  </Button>
                  {editId && (
                    <Button type="button" variant="outline" onClick={resetForm} className="border-zinc-800 text-zinc-400 hover:bg-zinc-800">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Product List ── */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} className="bg-zinc-900 border-zinc-800 pl-10" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 w-full sm:w-[200px]">
                <SelectValue placeholder="Todas Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Categorias</SelectItem>
                {CATEGORIAS_DEPOSITO.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {produtosFiltrados.map(p => {
              const margem = p.custo_centavos ? (((p.preco_centavos - p.custo_centavos) / p.custo_centavos) * 100).toFixed(0) : null;
              return (
                <Card key={p.id} className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs text-zinc-500">{p.codigo || 'S/C'}</p>
                        <h3 className="font-semibold text-zinc-100 line-clamp-1">{p.nome}</h3>
                        {p.categoria && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-500 rounded-full">{p.categoria}</span>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button size="icon" variant="outline" className="h-7 w-7 text-zinc-400 border-zinc-800 hover:bg-zinc-800" onClick={() => startEdit(p)}>
                          <Edit size={12} />
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7 text-red-500 border-zinc-800 hover:bg-red-500/20" onClick={() => handleDelete(p.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-800/50">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Custo</p>
                        <p className="text-sm font-medium text-zinc-300">R$ {((p.custo_centavos || 0) / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Preço</p>
                        <p className="text-sm font-bold text-amber-500">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Estoque</p>
                        <p className={`text-sm font-bold ${(p.quantidade || 0) <= 5 ? 'text-red-400' : 'text-green-400'}`}>
                          {p.quantidade || 0} un.
                        </p>
                      </div>
                    </div>
                    {margem && (
                      <div className="mt-2 text-[10px] text-zinc-500">Margem: <span className="text-green-400 font-semibold">{margem}%</span></div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {produtosFiltrados.length === 0 && <p className="text-zinc-500 col-span-full">Nenhum produto encontrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
