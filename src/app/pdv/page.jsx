'use client';

import { useState, useMemo } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Trash2, Plus, Minus, Receipt, ShoppingCart, Package, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function PDVPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];

  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [busca, setBusca] = useState('');
  const [pagamentos, setPagamentos] = useState([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);

  // Generate 8-digit sale code
  const gerarCodigo = () => String(Math.floor(10000000 + Math.random() * 90000000));

  // Filter products
  const produtosFiltrados = useMemo(() => {
    if (!busca) return produtos;
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo || '').toLowerCase().includes(busca.toLowerCase())
    );
  }, [produtos, busca]);

  const addToCart = (produto) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === produto.id);
      if (existing) {
        return prev.map(item => item.id === produto.id ? { ...item, qtde: item.qtde + 1 } : item);
      }
      return [...prev, { ...produto, qtde: 1 }];
    });
  };

  const updateCartQtde = (id, change) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQtde = item.qtde + change;
        return newQtde > 0 ? { ...item, qtde: newQtde } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalCentavos = cart.reduce((acc, item) => acc + (item.preco_centavos * item.qtde), 0);
  const totalItens = cart.reduce((acc, item) => acc + item.qtde, 0);

  const handleAddPagamento = () => {
    setPagamentos([...pagamentos, { valor: '', metodo: 'PIX', data: new Date().toISOString().split('T')[0] }]);
  };

  const handleUpdatePagamento = (index, field, value) => {
    setPagamentos(prev => prev.map((pag, i) => i === index ? { ...pag, [field]: value } : pag));
  };

  const handleRemovePagamento = (index) => {
    setPagamentos(prev => prev.filter((_, i) => i !== index));
  };

  const generatePDF = (venda) => {
    const doc = new jsPDF('p', 'mm', [80, 297]);
    const myCompany = empresa.length > 0 ? empresa[0] : { nome: 'SDO Seu Deposito Online', cnpj: '00.000.000/0000-00', telefone: '(00) 00000-0000' };

    doc.setFontSize(14);
    doc.text(myCompany.nome, 40, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`CNPJ: ${myCompany.cnpj}`, 40, 15, { align: 'center' });
    doc.text(`Tel: ${myCompany.telefone}`, 40, 20, { align: 'center' });
    doc.text('--------------------------------', 40, 25, { align: 'center' });
    
    doc.text('CUPOM NÃO FISCAL', 40, 30, { align: 'center' });
    doc.text(`Código: ${venda.codigo}`, 40, 35, { align: 'center' });
    doc.text(`Data: ${new Date(venda.data_venda).toLocaleString()}`, 40, 40, { align: 'center' });

    let y = 50;
    doc.setFontSize(9);
    doc.text('QTD  DESCRIÇÃO          V.UN   TOTAL', 5, y);
    y += 5;

    venda.itens.forEach(item => {
      const vUn = (item.preco_centavos / 100).toFixed(2);
      const t = ((item.preco_centavos * item.qtde) / 100).toFixed(2);
      doc.text(`${item.qtde.toString().padEnd(3, ' ')} ${item.nome.substring(0, 15).padEnd(15, ' ')} ${vUn.padStart(6, ' ')} ${t.padStart(6, ' ')}`, 5, y);
      y += 5;
    });

    y += 5;
    doc.text('--------------------------------', 40, y, { align: 'center' });
    y += 5;
    doc.setFontSize(12);
    doc.text(`TOTAL: R$ ${(venda.total_centavos / 100).toFixed(2)}`, 40, y, { align: 'center' });

    y += 10;
    doc.setFontSize(10);
    doc.text('PAGAMENTOS:', 5, y);
    y += 5;
    venda.pagamentos.forEach(pag => {
      doc.text(`${pag.metodo} - R$ ${parseFloat(pag.valor).toFixed(2)} - ${pag.data}`, 5, y);
      y += 5;
    });

    doc.save(`cupom_${venda.codigo}.pdf`);
  };

  const handleFinalize = async () => {
    if (cart.length === 0) return alert('Carrinho vazio!');
    
    const codigo = gerarCodigo();

    const venda = {
      id: uuidv4(),
      codigo,
      cliente_id: selectedClient || null,
      total_centavos: totalCentavos,
      data_venda: new Date().toISOString(),
      pagamentos,
      itens: cart
    };

    // 1. Save locally
    await db.vendas.add(venda);

    // 2. Deduct stock for each item
    for (const item of cart) {
      const prod = await db.produtos.get(item.id);
      if (prod) {
        const newQtd = Math.max(0, (prod.quantidade || 0) - item.qtde);
        await db.produtos.update(item.id, { quantidade: newQtd });
        await addToSyncQueue('produtos', 'UPDATE', { ...prod, quantidade: newQtd });
      }
    }

    // 3. Add to Sync Queue
    await addToSyncQueue('vendas', 'INSERT', venda);

    // 4. Generate PDF
    generatePDF(venda);

    // 5. Reset PDV
    setCart([]);
    setPagamentos([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
    setSelectedClient('');
    setBusca('');
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Product Grid ── */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto pb-48 lg:pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-amber-500">PDV — Ponto de Venda</h2>
          <div className="relative w-full sm:w-auto sm:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="search"
              placeholder="Buscar produto..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="bg-zinc-950 border-zinc-800 pl-10"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {produtosFiltrados.map(p => (
            <Card
              key={p.id}
              className="bg-zinc-950 border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => addToCart(p)}
            >
              <div className="h-24 sm:h-32 bg-zinc-900 rounded-t-lg flex items-center justify-center relative">
                <Package size={36} className="text-zinc-800" />
                {(p.quantidade || 0) > 0 && (
                  <span className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {p.quantidade} un.
                  </span>
                )}
                {(p.quantidade || 0) === 0 && (
                  <span className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    Sem estoque
                  </span>
                )}
              </div>
              <CardContent className="p-3">
                <p className="text-[10px] text-zinc-500 truncate">{p.codigo || p.categoria || ''}</p>
                <h3 className="font-semibold text-zinc-100 text-sm line-clamp-1">{p.nome}</h3>
                <p className="text-amber-500 font-bold mt-1">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
          {produtosFiltrados.length === 0 && (
            <div className="col-span-full text-center text-zinc-500 py-10">
              {busca ? 'Nenhum produto encontrado para essa busca.' : 'Nenhum produto cadastrado. Vá em "Produtos" para adicionar.'}
            </div>
          )}
        </div>
      </div>

      {/* ── Cart Sidebar (fixed bottom on mobile, right sidebar on desktop) ── */}
      <div className="w-full lg:w-[400px] bg-zinc-950 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col fixed lg:relative bottom-16 lg:bottom-0 z-40 max-h-[55vh] lg:max-h-none">
        {/* Cart Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart size={20} className="text-amber-500" /> 
            Carrinho
          </h2>
          <span className="bg-amber-500/10 text-amber-500 text-xs font-bold px-2 py-1 rounded-full">
            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Cart Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Client Selector */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Cliente</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Cliente (Opcional)" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cart Items */}
          <div className="space-y-2">
            {cart.length === 0 && (
              <div className="text-center py-6 text-zinc-600">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Toque em um produto para adicionar</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg">
                <div className="flex-1 overflow-hidden mr-2">
                  <p className="text-sm font-medium text-zinc-100 line-clamp-1">{item.nome}</p>
                  <p className="text-xs text-amber-500 font-semibold">R$ {((item.preco_centavos * item.qtde) / 100).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => updateCartQtde(item.id, -1)}>
                    <Minus size={14} />
                  </Button>
                  <span className="text-sm font-bold w-6 text-center text-zinc-100">{item.qtde}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => updateCartQtde(item.id, 1)}>
                    <Plus size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-500/20 ml-1" onClick={() => removeFromCart(item.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Payments */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs text-zinc-400 uppercase font-semibold">Pagamentos</h3>
                <Button size="sm" variant="ghost" onClick={handleAddPagamento} className="h-6 px-2 text-xs text-amber-500 hover:bg-amber-500/10">
                  <Plus size={12} className="mr-1"/> Add
                </Button>
              </div>
              {pagamentos.map((pag, i) => (
                <div key={i} className="space-y-2 bg-zinc-900/50 p-2 rounded-lg">
                  <div className="flex gap-2">
                    <Select value={pag.metodo} onValueChange={(val) => handleUpdatePagamento(i, 'metodo', val)}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800 flex-1">
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
                    <Input
                      type="number"
                      value={pag.valor}
                      onChange={(e) => handleUpdatePagamento(i, 'valor', e.target.value)}
                      className="h-8 text-xs bg-zinc-900 border-zinc-800 w-24"
                      placeholder="R$ 0.00"
                      step="0.01"
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleRemovePagamento(i)} className="h-8 w-8 text-red-500 hover:bg-red-500/20 shrink-0">
                      <X size={14} />
                    </Button>
                  </div>
                  <Input
                    type="date"
                    value={pag.data}
                    onChange={(e) => handleUpdatePagamento(i, 'data', e.target.value)}
                    className="h-7 text-[11px] bg-zinc-900 border-zinc-800"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-medium text-zinc-400">Total</span>
            <span className="text-2xl font-black text-amber-500">R$ {(totalCentavos / 100).toFixed(2)}</span>
          </div>
          <Button
            onClick={handleFinalize}
            disabled={cart.length === 0}
            className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold h-12 text-lg disabled:opacity-30"
          >
            <Receipt className="mr-2 h-5 w-5" />
            Finalizar Venda
          </Button>
        </div>
      </div>
    </div>
  );
}
