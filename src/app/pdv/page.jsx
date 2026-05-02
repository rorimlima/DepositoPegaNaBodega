'use client';

import { useState } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Trash2, Plus, Minus, Receipt, CreditCard, ShoppingCart, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function PDVPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];

  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [pagamentos, setPagamentos] = useState([{ valor: 0, metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);

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

  const handleAddPagamento = () => {
    setPagamentos([...pagamentos, { valor: 0, metodo: 'PIX', data: new Date().toISOString().split('T')[0] }]);
  };

  const handleUpdatePagamento = (index, field, value) => {
    setPagamentos(prev => prev.map((pag, i) => i === index ? { ...pag, [field]: value } : pag));
  };

  const handleRemovePagamento = (index) => {
    setPagamentos(prev => prev.filter((_, i) => i !== index));
  };

  const generatePDF = (venda) => {
    const doc = new jsPDF('p', 'mm', [80, 297]); // Thermal 80mm
    const myCompany = empresa.length > 0 ? empresa[0] : { nome: 'SDO Seu Deposito Online', cnpj: '00.000.000/0000-00', telefone: '(00) 00000-0000' };

    doc.setFontSize(14);
    doc.text(myCompany.nome, 40, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`CNPJ: ${myCompany.cnpj}`, 40, 15, { align: 'center' });
    doc.text(`Tel: ${myCompany.telefone}`, 40, 20, { align: 'center' });
    doc.text('--------------------------------', 40, 25, { align: 'center' });
    
    doc.text('CUPOM NÃO FISCAL', 40, 30, { align: 'center' });
    doc.text(`Data: ${new Date(venda.data_venda).toLocaleString()}`, 40, 35, { align: 'center' });

    let y = 45;
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

    doc.save(`cupom_${venda.id}.pdf`);
  };

  const handleFinalize = async () => {
    if (cart.length === 0) return alert('Carrinho vazio!');
    
    const venda = {
      id: uuidv4(),
      cliente_id: selectedClient || null,
      total_centavos: totalCentavos,
      data_venda: new Date().toISOString(),
      pagamentos,
      itens: cart
    };

    // 1. Salvar Local
    await db.vendas.add(venda);

    // 2. Add to Sync Queue
    await addToSyncQueue('vendas', 'INSERT', venda);

    // 3. Generate PDF
    generatePDF(venda);

    // 4. Limpar PDV
    setCart([]);
    setPagamentos([{ valor: 0, metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
    setSelectedClient('');
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Lista de Produtos */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-amber-500">Produtos</h2>
          <Input type="search" placeholder="Buscar produto..." className="max-w-xs bg-zinc-950 border-zinc-800" />
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produtos.map(p => (
            <Card key={p.id} className="bg-zinc-950 border-zinc-800 hover:border-amber-500/50 cursor-pointer transition-colors" onClick={() => addToCart(p)}>
              <div className="h-32 bg-zinc-900 rounded-t-lg flex items-center justify-center">
                {/* Fallback Image if no foto */}
                <Package size={48} className="text-zinc-800" />
              </div>
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500">{p.codigo}</p>
                <h3 className="font-semibold text-zinc-100 line-clamp-1">{p.nome}</h3>
                <p className="text-amber-500 font-bold mt-2">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
          {produtos.length === 0 && (
            <div className="col-span-full text-center text-zinc-500 py-10">
              Nenhum produto cadastrado. Vá em "Produtos" para adicionar.
            </div>
          )}
        </div>
      </div>

      {/* Carrinho (Fixo no bottom em mobile, Sidebar na direita em Desktop) */}
      <div className="w-full md:w-[400px] bg-zinc-950 border-l border-zinc-800 flex flex-col fixed md:relative bottom-16 md:bottom-0 z-40 max-h-[60vh] md:max-h-none">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart size={20} className="text-amber-500" /> 
            Carrinho Atual
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-semibold">Cliente</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Selecione um cliente (Opcional)" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium line-clamp-1">{item.nome}</p>
                  <p className="text-xs text-amber-500">R$ {((item.preco_centavos * item.qtde) / 100).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400" onClick={() => updateCartQtde(item.id, -1)}><Minus size={14} /></Button>
                  <span className="text-sm font-medium w-4 text-center">{item.qtde}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-zinc-400" onClick={() => updateCartQtde(item.id, 1)}><Plus size={14} /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-500/20" onClick={() => removeFromCart(item.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-zinc-400">
                <h3 className="text-sm uppercase font-semibold">Pagamentos</h3>
                <Button size="sm" variant="ghost" onClick={handleAddPagamento} className="h-6 px-2 text-xs text-amber-500"><Plus size={12} className="mr-1"/> Add</Button>
              </div>
              {pagamentos.map((pag, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select value={pag.metodo} onValueChange={(val) => handleUpdatePagamento(i, 'metodo', val)}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Cartão Crédito">Crédito</SelectItem>
                        <SelectItem value="Cartão Débito">Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input type="number" value={pag.valor} onChange={(e) => handleUpdatePagamento(i, 'valor', e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="0.00" />
                  </div>
                  <div className="col-span-3 flex items-center justify-end">
                    <Button size="icon" variant="ghost" onClick={() => handleRemovePagamento(i)} className="h-8 w-8 text-red-500 hover:bg-red-500/20"><Trash2 size={14} /></Button>
                  </div>
                  <div className="col-span-12 mt-1">
                    <Input type="date" value={pag.data} onChange={(e) => handleUpdatePagamento(i, 'data', e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium text-zinc-400">Total</span>
            <span className="text-2xl font-black text-amber-500">R$ {(totalCentavos / 100).toFixed(2)}</span>
          </div>
          <Button onClick={handleFinalize} disabled={cart.length === 0} className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold h-12 text-lg">
            <Receipt className="mr-2 h-5 w-5" />
            Finalizar Venda
          </Button>
        </div>
      </div>
    </div>
  );
}
