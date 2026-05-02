'use client';

import { useState, useMemo } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Trash2, Plus, Minus, Receipt, ShoppingCart, Package, Search, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function PDVPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];

  const [cart, setCart] = useState([]);
  const [pagamentos, setPagamentos] = useState([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
  const [buscaProduto, setBuscaProduto] = useState('');

  // ── Autocomplete State ──
  const [buscaCliente, setBuscaCliente] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  // ── Quick Add Client Modal State ──
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');

  const gerarCodigo = () => String(Math.floor(10000000 + Math.random() * 90000000));

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto) return produtos;
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(buscaProduto.toLowerCase()) || (p.codigo || '').toLowerCase().includes(buscaProduto.toLowerCase())
    );
  }, [produtos, buscaProduto]);

  const clientesBuscados = useMemo(() => {
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || 
      (c.telefone || '').includes(buscaCliente)
    ).slice(0, 5); // Limit suggestions
  }, [clientes, buscaCliente]);

  const handleSelectClient = (c) => {
    setSelectedClient(c.id);
    setBuscaCliente(c.nome);
    setDropdownOpen(false);
  };

  const handleQuickAddClient = async (e) => {
    e.preventDefault();
    if (!novoClienteNome) return;
    const newClient = { id: uuidv4(), nome: novoClienteNome, telefone: novoClienteTelefone, endereco: '' };
    await db.clientes.add(newClient);
    await addToSyncQueue('clientes', 'INSERT', newClient);
    
    // Auto select
    handleSelectClient(newClient);
    setModalClienteOpen(false);
    setNovoClienteNome('');
    setNovoClienteTelefone('');
  };

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

  const handleAddPagamento = () => setPagamentos([...pagamentos, { valor: '', metodo: 'PIX', data: new Date().toISOString().split('T')[0] }]);
  const handleUpdatePagamento = (index, field, value) => setPagamentos(prev => prev.map((pag, i) => i === index ? { ...pag, [field]: value } : pag));
  const handleRemovePagamento = (index) => setPagamentos(prev => prev.filter((_, i) => i !== index));

  const generatePDF = (venda) => {
    // A impressão SEMPRE será fundo branco e texto preto (garantido pelo jspdf nativo)
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
      id: uuidv4(), codigo, cliente_id: selectedClient || null, total_centavos: totalCentavos,
      data_venda: new Date().toISOString(), pagamentos, itens: cart
    };

    await db.vendas.add(venda);
    for (const item of cart) {
      const prod = await db.produtos.get(item.id);
      if (prod) {
        const newQtd = Math.max(0, (prod.quantidade || 0) - item.qtde);
        await db.produtos.update(item.id, { quantidade: newQtd });
        await addToSyncQueue('produtos', 'UPDATE', { ...prod, quantidade: newQtd });
      }
    }
    await addToSyncQueue('vendas', 'INSERT', venda);
    generatePDF(venda);

    setCart([]);
    setPagamentos([{ valor: '', metodo: 'Dinheiro', data: new Date().toISOString().split('T')[0] }]);
    setSelectedClient('');
    setBuscaCliente('');
    setBuscaProduto('');
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Product Grid ── */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto pb-48 lg:pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-blue-500">PDV Corporativo</h2>
          <div className="relative w-full sm:w-auto sm:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="search" placeholder="Buscar produto..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)}
              className="bg-slate-950 border-slate-800 pl-10"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {produtosFiltrados.map(p => (
            <Card key={p.id} onClick={() => addToCart(p)} className="bg-slate-950 border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]">
              <div className="h-24 sm:h-32 bg-slate-900 rounded-t-lg flex items-center justify-center relative">
                <Package size={36} className="text-slate-800" />
                {(p.quantidade || 0) > 0 && <span className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{p.quantidade} un.</span>}
                {(p.quantidade || 0) === 0 && <span className="absolute top-2 right-2 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Sem estoque</span>}
              </div>
              <CardContent className="p-3">
                <p className="text-[10px] text-slate-500 truncate">{p.codigo || p.categoria || ''}</p>
                <h3 className="font-semibold text-slate-100 text-sm line-clamp-1">{p.nome}</h3>
                <p className="text-blue-500 font-bold mt-1">R$ {(p.preco_centavos / 100).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Cart Sidebar ── */}
      <div className="w-full lg:w-[400px] bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col fixed lg:relative bottom-16 lg:bottom-0 z-30 max-h-[55vh] lg:max-h-none">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
            <ShoppingCart size={20} className="text-blue-500" /> Carrinho
          </h2>
          <span className="bg-blue-500/10 text-blue-500 text-xs font-bold px-2 py-1 rounded-full">{totalItens} itens</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Autocomplete Cliente Customizado */}
          <div className="space-y-2 relative">
            <label className="text-xs text-slate-500 uppercase font-semibold block">Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar cliente..." value={buscaCliente}
                onChange={(e) => { setBuscaCliente(e.target.value); setDropdownOpen(true); setHighlightedIndex(0); if (!e.target.value) setSelectedClient(''); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                onKeyDown={(e) => {
                  if (!dropdownOpen) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(p => (p < clientesBuscados.length - 1 ? p + 1 : p)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(p => (p > 0 ? p - 1 : 0)); }
                  if (e.key === 'Enter') { e.preventDefault(); if (clientesBuscados[highlightedIndex]) handleSelectClient(clientesBuscados[highlightedIndex]); }
                }}
                className="bg-slate-900 border-slate-800 pl-10 h-10 w-full focus-visible:ring-blue-500 text-sm"
              />
              {selectedClient && (
                <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 hover:text-white" onClick={() => { setSelectedClient(''); setBuscaCliente(''); }}>
                  <X size={14} />
                </Button>
              )}
            </div>
            {dropdownOpen && (buscaCliente.length > 0 || clientes.length > 0) && (
              <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-md shadow-xl divide-y divide-slate-800/50">
                {clientesBuscados.map((c, index) => (
                  <li key={c.id} onClick={() => handleSelectClient(c)} className={`px-3 py-2 cursor-pointer text-sm flex flex-col ${highlightedIndex === index ? 'bg-slate-800 text-blue-400' : 'text-slate-300 hover:bg-slate-800/50'}`}>
                    <span className="font-semibold">{c.nome}</span>
                    {c.telefone && <span className="text-[10px] text-slate-500">{c.telefone}</span>}
                  </li>
                ))}
                {clientesBuscados.length === 0 && <li className="px-3 py-2 text-sm text-slate-500 text-center">Nenhum cliente encontrado.</li>}
                <li onClick={() => { setDropdownOpen(false); setModalClienteOpen(true); }} className="px-3 py-2 cursor-pointer text-sm font-semibold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 flex items-center justify-center gap-2">
                  <UserPlus size={14} /> Cadastrar Rápido
                </li>
              </ul>
            )}
          </div>

          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800/50">
                <div className="flex-1 overflow-hidden mr-2">
                  <p className="text-sm font-medium text-slate-100 line-clamp-1">{item.nome}</p>
                  <p className="text-xs text-blue-500 font-semibold">R$ {((item.preco_centavos * item.qtde) / 100).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => updateCartQtde(item.id, -1)}><Minus size={14} /></Button>
                  <span className="text-sm font-bold w-6 text-center text-slate-100">{item.qtde}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => updateCartQtde(item.id, 1)}><Plus size={14} /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-500/20 ml-1" onClick={() => removeFromCart(item.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs text-slate-400 uppercase font-semibold">Pagamentos</h3>
                <Button size="sm" variant="ghost" onClick={handleAddPagamento} className="h-6 px-2 text-xs text-blue-500 hover:bg-blue-500/10"><Plus size={12} className="mr-1"/> Add</Button>
              </div>
              {pagamentos.map((pag, i) => (
                <div key={i} className="space-y-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                  <div className="flex gap-2">
                    <Select value={pag.metodo} onValueChange={(val) => handleUpdatePagamento(i, 'metodo', val)}>
                      <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                        <SelectItem value="PIX">📱 PIX</SelectItem>
                        <SelectItem value="Cartão Crédito">💳 Crédito</SelectItem>
                        <SelectItem value="Cartão Débito">💳 Débito</SelectItem>
                        <SelectItem value="Fiado">📝 Fiado (Devedor)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={pag.valor} onChange={(e) => handleUpdatePagamento(i, 'valor', e.target.value)} className="h-8 text-xs bg-slate-900 border-slate-800 w-24" placeholder="R$ 0.00" step="0.01" />
                    <Button size="icon" variant="ghost" onClick={() => handleRemovePagamento(i)} className="h-8 w-8 text-red-500 hover:bg-red-500/20 shrink-0"><X size={14} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-medium text-slate-400">Total</span>
            <span className="text-2xl font-black text-blue-500">R$ {(totalCentavos / 100).toFixed(2)}</span>
          </div>
          <Button onClick={handleFinalize} disabled={cart.length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg disabled:opacity-30">
            <Receipt className="mr-2 h-5 w-5" /> Finalizar Venda
          </Button>
        </div>
      </div>

      {/* ── Modal Novo Cliente Rápido ── */}
      {modalClienteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <h3 className="font-bold text-slate-100 flex items-center gap-2"><UserPlus size={18} className="text-blue-500" /> Cadastro Rápido</h3>
              <Button size="icon" variant="ghost" onClick={() => setModalClienteOpen(false)} className="h-8 w-8 text-slate-400 hover:text-white"><X size={16} /></Button>
            </div>
            <form onSubmit={handleQuickAddClient} className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nome do Cliente *</label>
                <Input required value={novoClienteNome} onChange={e => setNovoClienteNome(e.target.value)} className="bg-slate-900 border-slate-800 focus-visible:ring-blue-500" placeholder="Ex: João da Silva" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Telefone (Opcional)</label>
                <Input value={novoClienteTelefone} onChange={e => setNovoClienteTelefone(e.target.value)} className="bg-slate-900 border-slate-800 focus-visible:ring-blue-500" placeholder="(11) 99999-9999" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">Salvar e Selecionar</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
