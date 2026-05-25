'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Eye, Edit, Trash2, Printer, FileDown, Search, X,
  ShoppingCart, Calendar, DollarSign, Filter
} from 'lucide-react';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ── Modal de Detalhes / Edição ───────────────────────────────────────────────
const VendaModal = memo(function VendaModal({ venda, clientes, empresa, mode, onClose, onSave }) {
  const [pagamentos, setPagamentos] = useState(venda?.pagamentos || []);
  const isEdit = mode === 'edit';
  const cliente = clientes?.find(c => c.id === venda?.cliente_id);

  const handleUpdatePag = (idx, field, val) => {
    setPagamentos(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  };

  const handleSave = async () => {
    const updated = { ...venda, pagamentos };
    await db.vendas.put(updated);
    await addToSyncQueue('vendas', 'UPDATE', updated);
    onSave?.();
  };

  if (!venda) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-100">
            {isEdit ? '✏️ Editar Venda' : '📋 Detalhes da Venda'}
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Código</p>
              <p className="text-sm font-bold text-blue-400 font-mono">{venda.codigo || venda.id.substring(0, 8)}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Data</p>
              <p className="text-sm font-bold text-slate-100">{new Date(venda.data_venda).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Cliente</p>
              <p className="text-sm font-bold text-slate-100">{cliente?.nome || venda.cliente_nome || 'Consumidor'}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase">Total</p>
              <p className="text-sm font-black text-green-400">{fmt(venda.total_centavos)}</p>
            </div>
          </div>

          {/* Itens */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase font-semibold mb-2">Itens</h4>
            <div className="space-y-1.5">
              {(venda.itens || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">{it.nome}</p>
                    <p className="text-[11px] text-slate-500">{it.qtde}x {fmt(it.preco_centavos)}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-400 shrink-0">{fmt(it.preco_centavos * it.qtde)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamentos */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase font-semibold mb-2">Pagamentos</h4>
            <div className="space-y-2">
              {pagamentos.map((pag, i) => (
                <div key={i} className="flex items-center gap-2">
                  {isEdit ? (
                    <>
                      <select value={pag.metodo} onChange={e => handleUpdatePag(i, 'metodo', e.target.value)}
                        className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-slate-100">
                        <option value="Dinheiro">💵 Dinheiro</option>
                        <option value="PIX">📱 PIX</option>
                        <option value="Cartão Crédito">💳 Crédito</option>
                        <option value="Cartão Débito">💳 Débito</option>
                        <option value="Fiado">📝 Fiado</option>
                      </select>
                      <input type="number" step="0.01" value={pag.valor}
                        onChange={e => handleUpdatePag(i, 'valor', e.target.value)}
                        className="w-24 h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-slate-100" />
                      <input type="date" value={pag.data || ''}
                        onChange={e => handleUpdatePag(i, 'data', e.target.value)}
                        className="w-36 h-10 bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-100" />
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full bg-slate-900 rounded-lg px-3 py-2.5">
                      <span className="text-sm text-slate-300">{pag.metodo}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-100">R$ {parseFloat(pag.valor || 0).toFixed(2)}</span>
                        {pag.data && <p className="text-[10px] text-slate-500">{new Date(pag.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isEdit && (
          <div className="p-4 border-t border-slate-800 shrink-0">
            <button onClick={handleSave}
              className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold active:bg-blue-700 transition-all">
              Salvar Alterações
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Componente de linha da tabela ────────────────────────────────────────────
const VendaRow = memo(function VendaRow({ v, clienteNome, onView, onEdit, onDelete, onPrint }) {
  const hasFiado = v.pagamentos?.some(p => p.metodo === 'Fiado');
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-slate-800 text-blue-400 px-2 py-0.5 rounded-lg">
            {v.codigo || v.id.substring(0, 8)}
          </span>
          {hasFiado && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">FIADO</span>}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {new Date(v.data_venda).toLocaleString('pt-BR')} · {clienteNome}
        </p>
      </div>
      <p className="text-base font-bold text-blue-400 shrink-0">{fmt(v.total_centavos)}</p>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onView(v)} title="Ver" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700">
          <Eye size={14} />
        </button>
        <button onClick={() => onEdit(v)} title="Editar" className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 active:bg-blue-500/20">
          <Edit size={14} />
        </button>
        <button onClick={() => onPrint(v)} title="Imprimir" className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 active:bg-green-500/20">
          <Printer size={14} />
        </button>
        <button onClick={() => onDelete(v)} title="Excluir" className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function VendasPage() {
  const vendas   = useLiveQuery(() => db?.vendas?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa  = useLiveQuery(() => db?.empresa?.toArray()  || [], []) || [];

  const [busca, setBusca]       = useState('');
  const [modal, setModal]       = useState(null); // { venda, mode: 'view' | 'edit' }

  const clienteMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  const vendasOrdenadas = useMemo(() => {
    let arr = [...vendas].sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));
    if (busca) {
      const q = busca.toLowerCase();
      arr = arr.filter(v =>
        (v.codigo || '').toLowerCase().includes(q) ||
        (clienteMap[v.cliente_id] || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [vendas, busca, clienteMap]);

  const totalVendas = useMemo(() => vendas.reduce((a, v) => a + (v.total_centavos || 0), 0), [vendas]);

  const handleDelete = useCallback(async (v) => {
    if (!confirm(`Excluir venda ${v.codigo || v.id.substring(0, 8)}?`)) return;
    await db.vendas.delete(v.id);
    await addToSyncQueue('vendas', 'DELETE', { id: v.id });
  }, []);

  const handlePrint = useCallback((v) => {
    const co = empresa[0] || { nome: 'SDO', cnpj: '', telefone: '', endereco: '' };
    const itens = v.itens || [];
    const pagamentos = v.pagamentos || [];

    // ── Kapbom KA-1445: papel 58mm, área útil ~48mm ──
    const W = 58;          // largura do papel em mm
    const CX = W / 2;      // centro X = 29mm
    const ML = 2;           // margem esquerda
    const MR = W - 2;       // margem direita
    const SEP = '-'.repeat(32);

    // Calcular altura dinâmica
    const baseH = 90;
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
    doc.text(`Cod: ${v.codigo || v.id.substring(0, 8)}`, ML, y); y += 3;
    doc.text(`Data: ${new Date(v.data_venda).toLocaleString('pt-BR')}`, ML, y); y += 3;

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
    doc.text(`TOTAL: ${fmt(v.total_centavos)}`, CX, y, { align: 'center' }); y += 5;

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

    // ── Separador ──
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 4;

    // ── Rodapé ──
    doc.setFontSize(6);
    doc.text('Obrigado pela preferência!', CX, y, { align: 'center' }); y += 3;
    doc.setFontSize(5);
    doc.text(`Emitido: ${new Date().toLocaleString('pt-BR')}`, CX, y, { align: 'center' });

    doc.save(`cupom_${v.codigo || v.id.substring(0, 8)}.pdf`);
  }, [empresa]);

  const handleExportAll = useCallback(() => {
    const doc = new jsPDF();
    const co = empresa[0] || { nome: 'SDO' };
    doc.setFontSize(18); doc.text(`${co.nome} — Relatório de Vendas`, 14, 22);
    doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const headers = [['Código', 'Data', 'Cliente', 'Total', 'Pagamento']];
    const rows = vendasOrdenadas.map(v => [
      v.codigo || v.id.substring(0, 8),
      new Date(v.data_venda).toLocaleDateString('pt-BR'),
      clienteMap[v.cliente_id] || 'Consumidor',
      fmt(v.total_centavos),
      (v.pagamentos || []).map(p => p.metodo).join(', '),
    ]);
    doc.autoTable({ head: headers, body: rows, startY: 36, theme: 'grid', styles: { fontSize: 9 } });
    doc.save('relatorio_vendas.pdf');
  }, [vendasOrdenadas, clienteMap, empresa]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-blue-500">Vendas</h1>
        <button onClick={handleExportAll}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl active:bg-green-700">
          <FileDown size={16} /> Exportar PDF
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Total Vendas</span>
            <ShoppingCart size={14} className="text-blue-400" />
          </div>
          <p className="text-xl font-black text-blue-400">{vendas.length}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Faturado</span>
            <DollarSign size={14} className="text-green-400" />
          </div>
          <p className="text-xl font-black text-green-400">{fmt(totalVendas)}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Ticket Médio</span>
            <Calendar size={14} className="text-purple-400" />
          </div>
          <p className="text-xl font-black text-purple-400">
            {vendas.length ? fmt(Math.round(totalVendas / vendas.length)) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input placeholder="Buscar por código ou cliente..." value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Lista */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        {vendasOrdenadas.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <ShoppingCart size={36} className="mb-2" />
            <p className="text-sm">Nenhuma venda encontrada.</p>
          </div>
        ) : (
          vendasOrdenadas.map(v => (
            <VendaRow
              key={v.id}
              v={v}
              clienteNome={clienteMap[v.cliente_id] || 'Consumidor'}
              onView={(v) => setModal({ venda: v, mode: 'view' })}
              onEdit={(v) => setModal({ venda: v, mode: 'edit' })}
              onDelete={handleDelete}
              onPrint={handlePrint}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {modal && (
        <VendaModal
          venda={modal.venda}
          clientes={clientes}
          empresa={empresa}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSave={() => setModal(null)}
        />
      )}
    </div>
  );
}
