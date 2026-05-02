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

  const [nome,      setNome]      = useState('');
  const [codigo,    setCodigo]    = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco,     setPreco]     = useState('');
  const [custo,     setCusto]     = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [busca,     setBusca]     = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [editId,    setEditId]    = useState(null);
  const [formOpen,  setFormOpen]  = useState(false); // mobile drawer

  const { custoEstoque, potencialVenda, totalItens } = useMemo(() => {
    let ce = 0, pv = 0, ti = 0;
    produtos.forEach(p => {
      const q = p.quantidade || 0;
      ti += q; ce += q * (p.custo_centavos || 0); pv += q * (p.preco_centavos || 0);
    });
    return { custoEstoque: ce, potencialVenda: pv, totalItens: ti };
  }, [produtos]);

  const produtosFiltrados = useMemo(() =>
    produtos.filter(p => {
      const mb = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase());
      const mc = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      return mb && mc;
    }),
  [produtos, busca, filtroCategoria]);

  const resetForm = () => { setNome(''); setCodigo(''); setCategoria(''); setPreco(''); setCusto(''); setQuantidade(''); setEditId(null); setFormOpen(false); };

  const startEdit = (p) => {
    setEditId(p.id); setNome(p.nome); setCodigo(p.codigo || ''); setCategoria(p.categoria || '');
    setPreco(((p.preco_centavos || 0) / 100).toFixed(2));
    setCusto(((p.custo_centavos  || 0) / 100).toFixed(2));
    setQuantidade(String(p.quantidade || 0));
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome || !preco) return;
    const preco_centavos = Math.round(parseFloat(preco.replace(',', '.')) * 100);
    const custo_centavos = custo ? Math.round(parseFloat(custo.replace(',', '.')) * 100) : 0;
    const qtd = quantidade ? parseInt(quantidade, 10) : 0;

    if (editId) {
      const updated = { id: editId, nome, codigo, categoria, preco_centavos, custo_centavos, quantidade: qtd };
      await db.produtos.put(updated);
      await addToSyncQueue('produtos', 'UPDATE', updated);
    } else {
      const np = { id: uuidv4(), nome, codigo, categoria, preco_centavos, custo_centavos, quantidade: qtd };
      await db.produtos.add(np);
      await addToSyncQueue('produtos', 'INSERT', np);
    }
    resetForm();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este produto?')) return;
    await db.produtos.delete(id);
    await addToSyncQueue('produtos', 'DELETE', { id });
  };

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <Input placeholder="Nome do Produto *" value={nome} onChange={e => setNome(e.target.value)} required
        className="bg-slate-900 border-slate-800 h-12" />
      <Input placeholder="Código (Ex: SK001)" value={codigo} onChange={e => setCodigo(e.target.value)}
        className="bg-slate-900 border-slate-800 h-12" />
      <Select value={categoria} onValueChange={setCategoria}>
        <SelectTrigger className="bg-slate-900 border-slate-800 h-12"><SelectValue placeholder="Selecione a Categoria" /></SelectTrigger>
        <SelectContent>{CATEGORIAS_DEPOSITO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Custo (R$)</label>
          <Input placeholder="0.00" type="number" step="0.01" min="0" value={custo} onChange={e => setCusto(e.target.value)}
            inputMode="decimal" className="bg-slate-900 border-slate-800 h-12" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1.5 block">Preço Venda *</label>
          <Input placeholder="0.00" type="number" step="0.01" min="0" value={preco} onChange={e => setPreco(e.target.value)}
            required inputMode="decimal" className="bg-slate-900 border-slate-800 h-12" />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Quantidade em Estoque</label>
        <Input placeholder="0" type="number" min="0" value={quantidade} onChange={e => setQuantidade(e.target.value)}
          inputMode="numeric" className="bg-slate-900 border-slate-800 h-12" />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 active:bg-blue-700 transition-all">
          {editId ? <><Save size={16} /> Salvar</> : <><Plus size={16} /> Cadastrar</>}
        </button>
        {editId && (
          <button type="button" onClick={resetForm} className="w-12 h-12 rounded-xl border border-slate-700 text-slate-400 flex items-center justify-center">
            <X size={16} />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Título + botão novo (mobile) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-500">Produtos</h1>
        <button
          onClick={() => { resetForm(); setFormOpen(true); }}
          className="md:hidden flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:bg-blue-700"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Itens Estoque', value: totalItens.toLocaleString('pt-BR'), icon: Package, color: 'text-purple-400' },
          { label: 'Custo Estoque', value: `R$ ${(custoEstoque / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: Warehouse, color: 'text-red-400' },
          { label: 'Pot. de Venda', value: `R$ ${(potencialVenda / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Lucro Potencial', value: `R$ ${((potencialVenda - custoEstoque) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500 font-medium leading-tight">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className={`text-lg font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Desktop form (always visible in sidebar) */}
        <div className="hidden lg:block w-[340px] shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-slate-800">
              <h2 className="font-bold text-slate-100">{editId ? '✏️ Editar Produto' : '📦 Novo Produto'}</h2>
            </div>
            <FormContent />
          </div>
        </div>

        {/* Lista de produtos */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
                className="bg-slate-900 border-slate-800 pl-10 h-11" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="bg-slate-900 border-slate-800 h-11 sm:w-[190px]"><SelectValue placeholder="Todas Categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {CATEGORIAS_DEPOSITO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {produtosFiltrados.map(p => {
              const margem = p.custo_centavos ? (((p.preco_centavos - p.custo_centavos) / p.custo_centavos) * 100).toFixed(0) : null;
              const estoqueOk = (p.quantidade || 0) > 5;
              return (
                <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[10px] text-slate-600 truncate">{p.codigo || p.categoria || 'S/Cód.'}</p>
                      <h3 className="font-semibold text-slate-100 text-sm leading-snug">{p.nome}</h3>
                      {p.categoria && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 rounded-full">{p.categoria}</span>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => startEdit(p)} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700">
                        <Edit size={13} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/60">
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase mb-0.5">Custo</p>
                      <p className="text-sm font-medium text-slate-400">R$ {((p.custo_centavos || 0) / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase mb-0.5">Preço</p>
                      <p className="text-sm font-bold text-blue-400">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase mb-0.5">Estoque</p>
                      <p className={`text-sm font-bold ${estoqueOk ? 'text-green-400' : 'text-red-400'}`}>{p.quantidade || 0} un.</p>
                    </div>
                  </div>
                  {margem && <p className="text-[10px] text-slate-600 mt-2">Margem: <span className="text-green-400 font-semibold">{margem}%</span></p>}
                </div>
              );
            })}
            {produtosFiltrados.length === 0 && (
              <div className="col-span-full flex flex-col items-center py-12 text-slate-600">
                <Package size={36} className="mb-2" />
                <p className="text-sm">Nenhum produto encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Form como bottom drawer */}
      {formOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end">
          <div className="w-full bg-slate-950 border-t border-slate-800 rounded-t-3xl overflow-hidden" style={{ maxHeight: '92dvh' }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800">
              <div className="w-10 h-1 bg-slate-700 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
              <h2 className="font-bold text-slate-100">{editId ? '✏️ Editar Produto' : '📦 Novo Produto'}</h2>
              <button onClick={resetForm} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 60px)' }}>
              <FormContent />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
