'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { X, UserPlus } from 'lucide-react';

import MesasGrid from '@/components/pdv/MesasGrid';
import ComandaView from '@/components/pdv/ComandaView';
import CheckoutView from '@/components/pdv/CheckoutView';

// ── Constantes ───────────────────────────────────────────────────────────────
const TOTAL_MESAS = 20;
const MESAS_ARRAY = Array.from({ length: TOTAL_MESAS }, (_, i) => i + 1);

const gerarCodigo = () => String(Math.floor(10000000 + Math.random() * 90000000));

// ── Modal Cadastro Rápido ────────────────────────────────────────────────────
const ModalCadastroRapido = memo(function ModalCadastroRapido({ onClose, onSave }) {
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome) return;
    onSave({ nome, telefone: tel });
    setNome(''); setTel('');
  };
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" /> Cadastro Rápido
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Nome *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)} placeholder="João da Silva" autoFocus
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 h-12 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Telefone</label>
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 h-12 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold active:bg-blue-700 transition-all">
            Salvar e Selecionar
          </button>
        </form>
      </div>
    </div>
  );
});

// ── PÁGINA PRINCIPAL PDV ─────────────────────────────────────────────────────
export default function PDVPage() {
  const produtos = useLiveQuery(() => db?.produtos?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  const comandasAbertas = useLiveQuery(() =>
    db?.comandas?.where('status').anyOf(['aberta', 'faturando']).toArray() || [], []) || [];

  // View state: 'mesas' | 'comanda' | 'checkout'
  const [view, setView] = useState('mesas');
  const [mesaAtual, setMesaAtual] = useState(null);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [modalCadastro, setModalCadastro] = useState(false);
  const [cadastroPayIdx, setCadastroPayIdx] = useState(null);

  // ── Mapa mesa → comanda ────────────────────────────────────────────────────
  const comandasMap = useMemo(() => {
    const m = {};
    comandasAbertas.forEach(c => { m[c.mesa] = c; });
    return m;
  }, [comandasAbertas]);

  const comandaAtual = mesaAtual !== null ? comandasMap[mesaAtual] : null;

  // ── Abrir Mesa ─────────────────────────────────────────────────────────────
  const handleOpenMesa = useCallback(async (num, comanda) => {
    if (comanda) {
      // Mesa já tem comanda — abrir
      setMesaAtual(num);
      if (comanda.status === 'faturando') {
        setView('checkout');
      } else {
        setView('comanda');
      }
    } else {
      // Mesa livre — criar nova comanda
      const nova = {
        id: uuidv4(),
        mesa: num,
        status: 'aberta',
        codigo: gerarCodigo(),
        itens: [],
        pagamentos: [],
        cliente_id: null,
        aberta_em: new Date().toISOString(),
        concluida_em: null,
      };
      await db.comandas.add(nova);
      await addToSyncQueue('comandas', 'INSERT', nova);
      setMesaAtual(num);
      setView('comanda');
    }
  }, []);

  // ── Venda Balcão (sem mesa, cliente final) ─────────────────────────────────
  const handleVendaBalcao = useCallback(async () => {
    // Verifica se já existe uma comanda balcão aberta
    const existente = comandasAbertas.find(c => c.mesa === 0);
    if (existente) {
      setMesaAtual(0);
      if (existente.status === 'faturando') {
        setView('checkout');
      } else {
        setView('comanda');
      }
      return;
    }
    // Criar nova comanda balcão
    const nova = {
      id: uuidv4(),
      mesa: 0,
      status: 'aberta',
      codigo: gerarCodigo(),
      itens: [],
      pagamentos: [],
      cliente_id: null,
      aberta_em: new Date().toISOString(),
      concluida_em: null,
    };
    await db.comandas.add(nova);
    await addToSyncQueue('comandas', 'INSERT', nova);
    setMesaAtual(0);
    setView('comanda');
  }, [comandasAbertas]);

  // ── Add item à comanda ─────────────────────────────────────────────────────
  const handleAddItem = useCallback(async (produto) => {
    if (!comandaAtual) return;
    const itens = [...(comandaAtual.itens || [])];
    const ex = itens.find(i => i.id === produto.id);
    if (ex) {
      ex.qtde += 1;
    } else {
      itens.push({
        id: produto.id,
        nome: produto.nome,
        preco_centavos: produto.preco_centavos,
        qtde: 1,
        categoria: produto.categoria || '',
      });
    }
    const updated = { ...comandaAtual, itens };
    await db.comandas.put(updated);
    await addToSyncQueue('comandas', 'UPDATE', updated);
  }, [comandaAtual]);

  // ── Atualizar qtde ─────────────────────────────────────────────────────────
  const handleUpdateQtde = useCallback(async (itemId, delta) => {
    if (!comandaAtual) return;
    const itens = (comandaAtual.itens || []).map(i =>
      i.id === itemId ? { ...i, qtde: Math.max(1, i.qtde + delta) } : i
    );
    const updated = { ...comandaAtual, itens };
    await db.comandas.put(updated);
    await addToSyncQueue('comandas', 'UPDATE', updated);
  }, [comandaAtual]);

  // ── Remover item ───────────────────────────────────────────────────────────
  const handleRemoveItem = useCallback(async (itemId) => {
    if (!comandaAtual) return;
    const itens = (comandaAtual.itens || []).filter(i => i.id !== itemId);
    const updated = { ...comandaAtual, itens };
    await db.comandas.put(updated);
    await addToSyncQueue('comandas', 'UPDATE', updated);
  }, [comandaAtual]);

  // ── Atualizar Cliente da Comanda ───────────────────────────────────────────
  const handleUpdateCliente = useCallback(async (clienteId) => {
    if (!comandaAtual) return;
    const updated = { ...comandaAtual, cliente_id: clienteId };
    await db.comandas.put(updated);
    await addToSyncQueue('comandas', 'UPDATE', updated);
  }, [comandaAtual]);

  // ── Pedir conta (ir para checkout) ─────────────────────────────────────────
  const handlePedirConta = useCallback(async () => {
    if (!comandaAtual) return;
    const updated = { ...comandaAtual, status: 'faturando' };
    await db.comandas.put(updated);
    await addToSyncQueue('comandas', 'UPDATE', updated);
    setView('checkout');
  }, [comandaAtual]);

  // ── Voltar para mesas ──────────────────────────────────────────────────────
  const handleVoltar = useCallback(() => {
    setBuscaProduto('');
    setView('mesas');
    setMesaAtual(null);
  }, []);

  // ── Voltar do checkout para comanda ────────────────────────────────────────
  const handleVoltarCheckout = useCallback(async () => {
    if (comandaAtual) {
      const updated = { ...comandaAtual, status: 'aberta' };
      await db.comandas.put(updated);
      await addToSyncQueue('comandas', 'UPDATE', updated);
    }
    setView('comanda');
  }, [comandaAtual]);

  // ── Finalizar Venda ────────────────────────────────────────────────────────
  const handleFinalize = useCallback(async ({ pagamentos, troco }) => {
    if (!comandaAtual) return;
    const itens = comandaAtual.itens || [];
    const totalCentavos = itens.reduce((a, i) => a + i.preco_centavos * i.qtde, 0);

    // ── Validação de negócio: pagamento deve cobrir o total ────────────────
    const totalPagoCentavos = pagamentos.reduce(
      (a, p) => a + Math.round(parseFloat(p.valor || 0) * 100), 0
    );

    // Verifica se algum Fiado ficou sem cliente
    const fiadoSemCliente = pagamentos.some(
      p => p.metodo === 'Fiado' && !p.cliente_id && Math.round(parseFloat(p.valor || 0) * 100) > 0
    );
    if (fiadoSemCliente) {
      console.warn('[PDV] Tentativa de finalizar com Fiado sem cliente vinculado');
      return;
    }

    // Só finaliza se o total pago cobre o total da compra
    const pagamentoQuitado = totalPagoCentavos >= totalCentavos;
    if (!pagamentoQuitado) {
      console.warn(`[PDV] Pagamento insuficiente: pago=${totalPagoCentavos} total=${totalCentavos}`);
      return; // UI já bloqueia, mas safety net
    }

    // 1. Criar venda (compatível com o sistema existente)
    const venda = {
      id: uuidv4(),
      codigo: comandaAtual.codigo || gerarCodigo(),
      cliente_id: comandaAtual.cliente_id || pagamentos.find(p => p.cliente_id)?.cliente_id || null,
      total_centavos: totalCentavos,
      data_venda: new Date().toISOString(),
      pagamentos,
      itens: itens.map(i => ({ id: i.id, nome: i.nome, preco_centavos: i.preco_centavos, qtde: i.qtde })),
      mesa: comandaAtual.mesa,
      comanda_id: comandaAtual.id,
      status: 'finalizada', // venda concluída com pagamento quitado
    };
    await db.vendas.add(venda);
    await addToSyncQueue('vendas', 'INSERT', venda);

    // 2. Baixar estoque
    for (const item of itens) {
      const prod = await db.produtos.get(item.id);
      if (prod) {
        const nq = Math.max(0, (prod.quantidade || 0) - item.qtde);
        await db.produtos.update(item.id, { quantidade: nq });
        await addToSyncQueue('produtos', 'UPDATE', { ...prod, quantidade: nq });
      }
    }

    // 3. Fechar comanda — SOMENTE com status 'concluida' se pagamento quitou
    const concluida = {
      ...comandaAtual,
      status: 'concluida',
      pagamentos,
      concluida_em: new Date().toISOString(),
      total_centavos: totalCentavos,
      total_pago_centavos: totalPagoCentavos,
      troco_centavos: Math.max(0, totalPagoCentavos - totalCentavos),
    };
    await db.comandas.put(concluida);
    await addToSyncQueue('comandas', 'UPDATE', concluida);

    // 4. Gerar cupom PDF
    generatePDF(venda, troco);

    // 5. Voltar para mesas
    setView('mesas');
    setMesaAtual(null);
    setBuscaProduto('');
  }, [comandaAtual, empresa]);

  // ── Gerar PDF ──────────────────────────────────────────────────────────────
  const generatePDF = useCallback((venda, troco) => {
    const doc = new jsPDF('p', 'mm', [80, 297]);
    const co = empresa[0] || { nome: 'SDO', cnpj: '', telefone: '' };
    doc.setFontSize(14); doc.text(co.nome, 40, 10, { align: 'center' });
    doc.setFontSize(9);
    if (co.cnpj) doc.text(`CNPJ: ${co.cnpj}`, 40, 15, { align: 'center' });
    doc.text('CUPOM NÃO FISCAL', 40, 22, { align: 'center' });
    doc.text(`Cod: ${venda.codigo}  Mesa: ${venda.mesa || '-'}`, 40, 27, { align: 'center' });
    doc.text(new Date(venda.data_venda).toLocaleString('pt-BR'), 40, 32, { align: 'center' });
    let y = 39;
    (venda.itens || []).forEach(it => {
      const t = ((it.preco_centavos * it.qtde) / 100).toFixed(2);
      doc.text(`${it.qtde}x ${it.nome.substring(0, 16)}  R$ ${t}`, 4, y); y += 5;
    });
    y += 3; doc.setFontSize(12);
    doc.text(`TOTAL: R$ ${(venda.total_centavos / 100).toFixed(2)}`, 40, y, { align: 'center' }); y += 7;
    doc.setFontSize(9);
    (venda.pagamentos || []).forEach(p => { doc.text(`${p.metodo}: R$ ${parseFloat(p.valor || 0).toFixed(2)}`, 4, y); y += 5; });
    if (troco > 0) { doc.text(`TROCO: R$ ${troco.toFixed(2)}`, 4, y); y += 5; }
    doc.save(`cupom_${venda.codigo}.pdf`);
  }, [empresa]);

  // ── Cadastro rápido de cliente ─────────────────────────────────────────────
  const handleQuickSave = useCallback(async ({ nome, telefone }) => {
    const nc = { id: uuidv4(), nome, telefone, endereco: '' };
    await db.clientes.add(nc);
    await addToSyncQueue('clientes', 'INSERT', nc);
    setModalCadastro(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {view === 'mesas' && (
        <div className="flex-1 overflow-y-auto">
          <MesasGrid mesas={MESAS_ARRAY} comandasMap={comandasMap} onOpenMesa={handleOpenMesa} onVendaBalcao={handleVendaBalcao} />
        </div>
      )}

      {view === 'comanda' && comandaAtual && (
        <ComandaView
          mesa={mesaAtual}
          comanda={comandaAtual}
          produtos={produtos}
          clientes={clientes}
          buscaProduto={buscaProduto}
          onBuscaProdutoChange={setBuscaProduto}
          onAddItem={handleAddItem}
          onUpdateQtde={handleUpdateQtde}
          onRemoveItem={handleRemoveItem}
          onUpdateCliente={handleUpdateCliente}
          onPedirConta={handlePedirConta}
          onVoltar={handleVoltar}
          onOpenCadastroRapido={() => setModalCadastro(true)}
        />
      )}

      {view === 'checkout' && comandaAtual && (
        <CheckoutView
          mesa={mesaAtual}
          comanda={comandaAtual}
          clientes={clientes}
          onVoltar={handleVoltarCheckout}
          onFinalize={handleFinalize}
          onOpenCadastroRapido={(payIdx) => { setCadastroPayIdx(payIdx); setModalCadastro(true); }}
        />
      )}

      {modalCadastro && <ModalCadastroRapido onClose={() => setModalCadastro(false)} onSave={handleQuickSave} />}
    </div>
  );
}
