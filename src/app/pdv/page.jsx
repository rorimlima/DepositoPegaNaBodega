'use client';

import { useState, useCallback, useMemo, memo, useEffect } from 'react';
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
  const [isCleaning, setIsCleaning] = useState(false);

  // ── Cleanup de comandas duplicadas/órfãs ───────────────────────────────────
  useEffect(() => {
    async function cleanupDuplicados() {
      try {
        setIsCleaning(true);
        const todasAbertas = await db.comandas
          .where('status')
          .anyOf(['aberta', 'faturando'])
          .toArray();

        // Agrupar por mesa
        const porMesa = {};
        todasAbertas.forEach(c => {
          if (!porMesa[c.mesa]) porMesa[c.mesa] = [];
          porMesa[c.mesa].push(c);
        });

        // Para cada mesa com mais de uma comanda aberta, resolver duplicados
        for (const [mesaStr, lista] of Object.entries(porMesa)) {
          if (lista.length <= 1) continue;

          console.warn(`[PDV Cleanup] Detectadas ${lista.length} comandas abertas para a mesa ${mesaStr}. Limpando...`);

          // Ordenar: as com mais itens primeiro, depois por aberta_em decrescente
          lista.sort((a, b) => {
            const qtdeA = (a.itens || []).reduce((sum, i) => sum + i.qtde, 0);
            const qtdeB = (b.itens || []).reduce((sum, i) => sum + i.qtde, 0);
            if (qtdeA !== qtdeB) return qtdeB - qtdeA; // Mais itens primeiro
            return new Date(b.aberta_em).getTime() - new Date(a.aberta_em).getTime(); // Mais recente primeiro
          });

          // A primeira é a que mantemos ativa
          const manter = lista[0];

          // O resto marcamos como 'concluida' ou deletamos se vazias
          for (let i = 1; i < lista.length; i++) {
            const comandaObsoleta = lista[i];
            const temItens = (comandaObsoleta.itens || []).length > 0;

            if (temItens) {
              // Se tinha itens, fecha como concluída para segurança de auditoria
              const resolvida = {
                ...comandaObsoleta,
                status: 'concluida',
                concluida_em: new Date().toISOString(),
                cancelada: true, // flag informativa
              };
              await db.comandas.put(resolvida);
              await addToSyncQueue('comandas', 'UPDATE', resolvida);
              console.log(`[PDV Cleanup] Comanda duplicada ${comandaObsoleta.id} com itens fechada.`);
            } else {
              // Se vazia, apenas deleta do banco local e avisa sync
              await db.comandas.delete(comandaObsoleta.id);
              await addToSyncQueue('comandas', 'DELETE', { id: comandaObsoleta.id });
              console.log(`[PDV Cleanup] Comanda duplicada vazia ${comandaObsoleta.id} deletada.`);
            }
          }
        }
      } catch (err) {
        console.error('[PDV Cleanup] Erro no cleanup de duplicados:', err);
      } finally {
        setIsCleaning(false);
      }
    }

    cleanupDuplicados();
  }, []);

  // ── Mapa mesa → comanda ────────────────────────────────────────────────────
  const comandasMap = useMemo(() => {
    const m = {};
    comandasAbertas.forEach(c => { m[c.mesa] = c; });
    return m;
  }, [comandasAbertas]);

  const comandaAtual = mesaAtual !== null ? comandasMap[mesaAtual] : null;

  const handleOpenMesa = useCallback(async (num, comanda) => {
    // ── Evitar race condition de carregamento lento do Dexie: consulta direta no banco
    const existente = await db.comandas
      .where('mesa')
      .equals(num)
      .filter(c => c.status === 'aberta' || c.status === 'faturando')
      .first();

    const activeComanda = existente || comanda;

    if (activeComanda) {
      // Mesa já tem comanda — abrir
      setMesaAtual(num);
      if (activeComanda.status === 'faturando') {
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

  const handleVendaBalcao = useCallback(async () => {
    // ── Evitar race condition de carregamento lento do Dexie: consulta direta no banco
    const existente = await db.comandas
      .where('mesa')
      .equals(0)
      .filter(c => c.status === 'aberta' || c.status === 'faturando')
      .first();

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
  }, []);

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
    const co = empresa[0] || { nome: 'SDO', cnpj: '', telefone: '', endereco: '' };
    const itens = venda.itens || [];
    const pagamentos = venda.pagamentos || [];

    // ── Kapbom KA-1445: papel 58mm, área útil ~48mm ──
    const W = 58;          // largura do papel em mm
    const CX = W / 2;      // centro X = 29mm
    const ML = 2;           // margem esquerda
    const MR = W - 2;       // margem direita
    const SEP = '-'.repeat(32);

    // Calcular altura dinâmica
    const baseH = 95;
    const itensH = itens.length * 8;
    const pagsH = pagamentos.length * 5;
    const totalH = baseH + itensH + pagsH;

    const doc = new jsPDF('p', 'mm', [W, totalH]);
    let y = 6;

    // ── Cabeçalho: Empresa ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(co.nome, CX, y, { align: 'center' }); y += 4;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    if (co.cnpj) { doc.text(`CNPJ: ${co.cnpj}`, CX, y, { align: 'center' }); y += 3; }
    if (co.endereco) { doc.text(co.endereco, CX, y, { align: 'center', maxWidth: W - 6 }); y += 3; }
    if (co.telefone) { doc.text(`Tel: ${co.telefone}`, CX, y, { align: 'center' }); y += 3; }

    // ── Separador ──
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    // ── Título ──
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CUPOM NÃO FISCAL', CX, y, { align: 'center' }); y += 4;

    // ── Info da venda ──
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cod: ${venda.codigo || venda.id.substring(0, 8)}`, ML, y); y += 3;
    const mesaTexto = venda.mesa ? `Mesa: ${venda.mesa}` : 'Balcão';
    doc.text(`Origem: ${mesaTexto}`, ML, y); y += 3;
    doc.text(`Data: ${new Date(venda.data_venda).toLocaleString('pt-BR')}`, ML, y); y += 3;

    // ── Separador ──
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    // ── Cabeçalho dos itens ──
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM', ML, y);
    doc.text('QTD', 30, y, { align: 'center' });
    doc.text('VALOR', MR, y, { align: 'right' }); y += 3;
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    // ── Itens ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    itens.forEach(it => {
      const totalItem = ((it.preco_centavos * it.qtde) / 100).toFixed(2);
      const nome = it.nome.length > 18 ? it.nome.substring(0, 18) + '.' : it.nome;
      doc.text(nome, ML, y);
      doc.text(`${it.qtde}`, 30, y, { align: 'center' });
      doc.text(`R$ ${totalItem}`, MR, y, { align: 'right' }); y += 4;
      // Preço unitário
      doc.setFontSize(5);
      doc.setTextColor(120);
      doc.text(`  un: R$ ${(it.preco_centavos / 100).toFixed(2)}`, ML, y); y += 4;
      doc.setFontSize(6);
      doc.setTextColor(0);
    });

    // ── Separador ──
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 4;

    // ── Total ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: R$ ${(venda.total_centavos / 100).toFixed(2)}`, CX, y, { align: 'center' }); y += 5;

    // ── Separador ──
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    // ── Pagamentos ──
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO', ML, y); y += 3;
    doc.setFont('helvetica', 'normal');
    pagamentos.forEach(p => {
      doc.text(p.metodo, ML, y);
      doc.text(`R$ ${parseFloat(p.valor || 0).toFixed(2)}`, MR, y, { align: 'right' }); y += 4;
    });
    if (troco > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('TROCO', ML, y);
      doc.text(`R$ ${troco.toFixed(2)}`, MR, y, { align: 'right' }); y += 4;
      doc.setFont('helvetica', 'normal');
    }

    // ── Separador ──
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 4;

    // ── Rodapé ──
    doc.setFontSize(6);
    doc.text('Obrigado pela preferência!', CX, y, { align: 'center' }); y += 3;
    doc.setFontSize(5);
    doc.text(`Emitido: ${new Date().toLocaleString('pt-BR')}`, CX, y, { align: 'center' });

    // ── 1. Salvar PDF (backup / download) ──
    doc.save(`cupom_${venda.codigo || venda.id.substring(0, 8)}.pdf`);

    // ── 2. Impressão automática via iframe oculto ──
    try {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Remover iframe antigo se existir
      const oldFrame = document.getElementById('print-cupom-frame');
      if (oldFrame) oldFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'print-cupom-frame';
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          // Injetar CSS de impressão configurado para Kapbom KA-1445 (58mm)
          const style = iframe.contentDocument.createElement('style');
          style.textContent = `
            @page {
              size: 58mm ${totalH}mm;
              margin: 0;
            }
            @media print {
              body { margin: 0; padding: 0; }
            }
          `;
          iframe.contentDocument.head.appendChild(style);

          // Disparar impressão automática
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Limpar após impressão (timeout para dar tempo ao diálogo)
            setTimeout(() => {
              URL.revokeObjectURL(pdfUrl);
              iframe.remove();
            }, 5000);
          }, 300);
        } catch (printErr) {
          console.warn('[PDV] Erro ao imprimir via iframe, usando fallback:', printErr);
          // Fallback: abrir em nova aba para impressão manual
          window.open(pdfUrl, '_blank');
        }
      };
    } catch (err) {
      console.warn('[PDV] Erro na impressão automática:', err);
    }
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
