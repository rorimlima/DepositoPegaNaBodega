'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Eye, Edit, Trash2, Printer, FileDown, Search, X,
  ShoppingCart, Calendar, DollarSign, Filter,
  ChevronLeft, ChevronRight, CreditCard, Banknote,
  Smartphone, ClipboardList, TrendingUp, ReceiptText,
  PackageOpen, ArrowUpDown
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ── Helpers de Período ──────────────────────────────────────────────────────
function getStartOfDay(d = new Date()) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function getStartOfWeek(d = new Date()) {
  const r = getStartOfDay(d); r.setDate(r.getDate() - r.getDay()); return r;
}
function getStartOfMonth(d = new Date()) {
  const r = getStartOfDay(d); r.setDate(1); return r;
}

const PERIODOS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'tudo', label: 'Tudo' },
];

const METODOS_FILTER = [
  { key: 'todos', label: 'Todos', icon: Filter, color: 'text-slate-400', bg: 'bg-slate-800', activeBg: 'bg-blue-600', activeText: 'text-white' },
  { key: 'Dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-400', bg: 'bg-green-500/10', activeBg: 'bg-green-600', activeText: 'text-white' },
  { key: 'PIX', label: 'PIX', icon: Smartphone, color: 'text-cyan-400', bg: 'bg-cyan-500/10', activeBg: 'bg-cyan-600', activeText: 'text-white' },
  { key: 'Cartão', label: 'Cartão', icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10', activeBg: 'bg-purple-600', activeText: 'text-white' },
  { key: 'Fiado', label: 'Fiado', icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/10', activeBg: 'bg-amber-600', activeText: 'text-white' },
];

const ITEMS_PER_PAGE = 20;

// ── Badge de Pagamento ──────────────────────────────────────────────────────
function PaymentBadge({ metodo }) {
  const map = {
    'Dinheiro':       { icon: Banknote, color: 'text-green-400', bg: 'bg-green-500/15', label: 'Dinheiro' },
    'PIX':            { icon: Smartphone, color: 'text-cyan-400', bg: 'bg-cyan-500/15', label: 'PIX' },
    'Cartão Crédito': { icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/15', label: 'Crédito' },
    'Cartão Débito':  { icon: CreditCard, color: 'text-indigo-400', bg: 'bg-indigo-500/15', label: 'Débito' },
    'Fiado':          { icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Fiado' },
  };
  const cfg = map[metodo] || { icon: DollarSign, color: 'text-slate-400', bg: 'bg-slate-500/15', label: metodo };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ── Modal de Detalhes / Edição ───────────────────────────────────────────────
const VendaModal = memo(function VendaModal({ venda, clientes, empresa, mode, onClose, onSave }) {
  const [pagamentos, setPagamentos] = useState(venda?.pagamentos || []);
  const isEdit = mode === 'edit';
  const cliente = clientes?.find(c => c.id === venda?.cliente_id);

  const handleUpdatePag = (idx, field, val) => {
    setPagamentos(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  };

  const handleSave = async () => {
    try {
      const updated = { ...venda, pagamentos };
      await db.vendas.put(updated);
      await addToSyncQueue('vendas', 'UPDATE', updated);
      onSave?.();
    } catch (err) {
      console.error('[Vendas] Erro ao salvar:', err);
      alert('Erro ao salvar alterações. Tente novamente.');
    }
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

// ── Card de Venda (Mobile-first) ─────────────────────────────────────────────
const VendaCard = memo(function VendaCard({ v, clienteNome, onView, onEdit, onDelete, onPrint, index }) {
  const hasFiado = v.pagamentos?.some(p => p.metodo === 'Fiado');
  const metodos = [...new Set((v.pagamentos || []).map(p => p.metodo))];
  const dateObj = new Date(v.data_venda);
  const isToday = getStartOfDay().getTime() === getStartOfDay(dateObj).getTime();

  return (
    <div
      className="animate-slide-up bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 hover:border-slate-700/80 transition-all duration-300 hover:bg-slate-900/80 group"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms`, animationFillMode: 'both' }}
    >
      {/* Top row: code + date + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-800 text-blue-400 px-2.5 py-1 rounded-lg font-bold tracking-wide">
              #{v.codigo || v.id.substring(0, 8)}
            </span>
            {hasFiado ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 animate-pulse-dot">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                FIADO
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                PAGO
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Calendar size={10} />
            {isToday ? (
              <span className="text-blue-400 font-medium">Hoje, {dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-blue-400 tracking-tight">{fmt(v.total_centavos)}</p>
        </div>
      </div>

      {/* Middle: client + payment badges */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-300 truncate mr-2">
          {clienteNome}
        </p>
        <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
          {metodos.map(m => <PaymentBadge key={m} metodo={m} />)}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/50">
        <button onClick={() => onView(v)} title="Ver"
          className="flex-1 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center gap-1.5 text-slate-400 active:bg-slate-700 text-xs font-medium transition-colors">
          <Eye size={13} /> Ver
        </button>
        <button onClick={() => onEdit(v)} title="Editar"
          className="flex-1 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center gap-1.5 text-blue-400 active:bg-blue-500/20 text-xs font-medium transition-colors">
          <Edit size={13} /> Editar
        </button>
        <button onClick={() => onPrint(v)} title="Imprimir"
          className="flex-1 h-9 rounded-xl bg-green-500/10 flex items-center justify-center gap-1.5 text-green-400 active:bg-green-500/20 text-xs font-medium transition-colors">
          <Printer size={13} /> PDF
        </button>
        <button onClick={() => onDelete(v)} title="Excluir"
          className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20 transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
});

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center py-16 px-6 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
          <PackageOpen size={40} className="text-slate-600" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <ReceiptText size={14} className="text-blue-400" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-300 mb-2">
        {hasFilters ? 'Nenhuma venda encontrada' : 'Nenhuma venda registrada'}
      </h3>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
        {hasFilters
          ? 'Tente ajustar os filtros de período, método de pagamento ou o termo de busca.'
          : 'As vendas realizadas no PDV aparecerão aqui automaticamente.'}
      </p>
      {hasFilters && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-600">
          <Filter size={12} />
          <span>Filtros ativos — limpe para ver todas</span>
        </div>
      )}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function VendasPage() {
  const vendas   = useLiveQuery(() => db?.vendas?.filter(v => !v.is_deleted).toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa  = useLiveQuery(() => db?.empresa?.toArray()  || [], []) || [];
  const toast = useToast();

  const [busca, setBusca]             = useState('');
  const [modal, setModal]             = useState(null); // { venda, mode: 'view' | 'edit' }
  const [periodo, setPeriodo]         = useState('tudo');
  const [metodoFilter, setMetodoFilter] = useState('todos');
  const [pagina, setPagina]           = useState(1);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo]     = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const clienteMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  // ── Filtrar por período ───────────────────────────────────────────────────
  const vendasFiltradas = useMemo(() => {
    let arr = [...vendas].sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));

    // Período
    if (periodo !== 'tudo') {
      const now = new Date();
      let start;
      if (periodo === 'hoje')   start = getStartOfDay(now);
      if (periodo === 'semana') start = getStartOfWeek(now);
      if (periodo === 'mes')    start = getStartOfMonth(now);
      if (periodo === 'custom' && customDateFrom) {
        start = new Date(customDateFrom + 'T00:00:00');
      }
      if (start) {
        arr = arr.filter(v => new Date(v.data_venda) >= start);
      }
      if (periodo === 'custom' && customDateTo) {
        const end = new Date(customDateTo + 'T23:59:59');
        arr = arr.filter(v => new Date(v.data_venda) <= end);
      }
    }

    // Método de pagamento
    if (metodoFilter !== 'todos') {
      arr = arr.filter(v =>
        (v.pagamentos || []).some(p =>
          metodoFilter === 'Cartão'
            ? p.metodo?.startsWith('Cartão')
            : p.metodo === metodoFilter
        )
      );
    }

    // Busca
    if (busca) {
      const q = busca.toLowerCase();
      arr = arr.filter(v =>
        (v.codigo || '').toLowerCase().includes(q) ||
        (clienteMap[v.cliente_id] || '').toLowerCase().includes(q)
      );
    }

    return arr;
  }, [vendas, busca, clienteMap, periodo, metodoFilter, customDateFrom, customDateTo]);

  // Reset page on filter change
  const vendasOrdenadas = vendasFiltradas; // alias for PDF export compatibility

  // ── KPIs sobre vendas filtradas ───────────────────────────────────────────
  const stats = useMemo(() => {
    const total = vendasFiltradas.reduce((a, v) => a + (v.total_centavos || 0), 0);
    const fiado = vendasFiltradas.filter(v => v.pagamentos?.some(p => p.metodo === 'Fiado'));
    const fiadoTotal = fiado.reduce((a, v) => a + (v.total_centavos || 0), 0);
    const ticket = vendasFiltradas.length ? Math.round(total / vendasFiltradas.length) : 0;
    return { count: vendasFiltradas.length, total, fiadoCount: fiado.length, fiadoTotal, ticket };
  }, [vendasFiltradas]);

  // ── Paginação ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(vendasFiltradas.length / ITEMS_PER_PAGE));
  const safePage = Math.min(pagina, totalPages);
  const paginatedVendas = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return vendasFiltradas.slice(start, start + ITEMS_PER_PAGE);
  }, [vendasFiltradas, safePage]);

  // Reset page when filters change
  const handlePeriodoChange = (p) => { setPeriodo(p); setPagina(1); if (p !== 'custom') setShowCustomDate(false); if (p === 'custom') setShowCustomDate(true); };
  const handleMetodoChange = (m) => { setMetodoFilter(m); setPagina(1); };
  const handleBuscaChange = (e) => { setBusca(e.target.value); setPagina(1); };

  const hasFilters = busca || periodo !== 'tudo' || metodoFilter !== 'todos';

  const handleDelete = useCallback(async (v) => {
    if (!confirm(`Excluir venda ${v.codigo || v.id.substring(0, 8)}?`)) return;
    try {
      // 1. Excluir a venda localmente e enfileirar soft delete
      await db.vendas.delete(v.id);
      await addToSyncQueue('vendas', 'DELETE', { id: v.id });

      // 2. Se a venda tem comanda associada, garantir que ela esteja marcada como
      //    concluída e is_deleted para não reabrir a mesa no PDV
      if (v.comanda_id) {
        const comanda = await db.comandas.get(v.comanda_id);
        if (comanda) {
          const updated = {
            ...comanda,
            status: 'concluida',
            is_deleted: true,
            updated_at: new Date().toISOString(),
          };
          await db.comandas.put(updated);
          await addToSyncQueue('comandas', 'UPDATE', updated);
        }
      }

      toast.success('Venda excluída.');
    } catch (err) {
      console.error('[Vendas] Erro ao excluir:', err);
      toast.error('Erro ao excluir venda.');
    }
  }, [toast]);

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

    // ── Pré-calcular quebra de linhas do nome da empresa ──
    const tmpDoc = new jsPDF('p', 'mm', [W, 100]);
    tmpDoc.setFontSize(9);
    tmpDoc.setFont('helvetica', 'bold');
    const nomeMaxWidth = 42; // área imprimível real ~48mm, com margem de segurança
    const nomeLines = tmpDoc.splitTextToSize(co.nome, nomeMaxWidth);
    const nomeExtraH = Math.max(0, (nomeLines.length - 1) * 4);

    // Calcular altura dinâmica
    const baseH = 90;
    const itensH = itens.length * 8;
    const pagsH = pagamentos.length * 5;
    const totalH = baseH + itensH + pagsH + nomeExtraH;

    const doc = new jsPDF('p', 'mm', [W, totalH]);
    let y = 6;

    // ── Cabeçalho: Empresa (com quebra de linha automática) ──
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    nomeLines.forEach((line) => {
      doc.text(line, CX, y, { align: 'center' });
      y += 4;
    });
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

    // ── Abrir PDF em nova janela para preview antes de imprimir ──
    try {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const previewWin = window.open(pdfUrl, '_blank');
      if (previewWin) {
        // Aguardar carregamento e abrir diálogo de impressão automaticamente
        previewWin.addEventListener('load', () => {
          setTimeout(() => {
            previewWin.focus();
            previewWin.print();
          }, 500);
        });
        // Limpar URL após fechar a janela
        const checkClosed = setInterval(() => {
          if (previewWin.closed) {
            clearInterval(checkClosed);
            URL.revokeObjectURL(pdfUrl);
          }
        }, 1000);
      } else {
        // Fallback: se popup bloqueado, salvar PDF
        doc.save(`cupom_${v.codigo || v.id.substring(0, 8)}.pdf`);
      }
    } catch (err) {
      console.warn('[Vendas] Erro ao abrir preview de impressão:', err);
      // Fallback: salvar PDF
      doc.save(`cupom_${v.codigo || v.id.substring(0, 8)}.pdf`);
    }
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

  // ── Period label for KPI subtitle ─────────────────────────────────────────
  const periodLabel = periodo === 'hoje' ? 'hoje' : periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mês' : periodo === 'custom' ? 'período custom' : 'total';

  return (
    <div className="p-4 md:p-6 space-y-4 animate-page-enter">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Vendas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {vendas.length} {vendas.length === 1 ? 'venda registrada' : 'vendas registradas'}
          </p>
        </div>
        <button onClick={handleExportAll}
          className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-green-900/20 hover:shadow-green-900/40">
          <FileDown size={16} /> Exportar PDF
        </button>
      </div>

      {/* ── Period Tabs ─────────────────────────────────────────────────────── */}
      <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-1.5 overflow-x-auto">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePeriodoChange(p.key)}
              className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                periodo === p.key
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => handlePeriodoChange('custom')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
              periodo === 'custom'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Calendar size={12} /> Período
          </button>
        </div>
        {/* Custom date range inputs */}
        {showCustomDate && (
          <div className="flex items-center gap-2 mt-2 animate-slide-up">
            <input
              type="date"
              value={customDateFrom}
              onChange={e => { setCustomDateFrom(e.target.value); setPagina(1); }}
              className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="De"
            />
            <span className="text-slate-600 text-xs font-bold">até</span>
            <input
              type="date"
              value={customDateTo}
              onChange={e => { setCustomDateTo(e.target.value); setPagina(1); }}
              className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Até"
            />
          </div>
        )}
      </div>

      {/* ── Payment Filter Chips ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 animate-slide-up" style={{ animationDelay: '100ms' }}>
        {METODOS_FILTER.map(m => {
          const active = metodoFilter === m.key;
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => handleMetodoChange(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                active
                  ? `${m.activeBg} ${m.activeText} shadow-md`
                  : `${m.bg} ${m.color} hover:opacity-80`
              }`}
            >
              <Icon size={12} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '150ms' }}>
        {/* Total de Vendas */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Vendas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <ShoppingCart size={14} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-400">{stats.count}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{periodLabel}</p>
        </div>

        {/* Faturamento */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Faturado</span>
            <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
              <DollarSign size={14} className="text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-green-400">{fmt(stats.total)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{periodLabel}</p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Ticket Médio</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-400">{stats.ticket ? fmt(stats.ticket) : 'R$ 0,00'}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{periodLabel}</p>
        </div>

        {/* Fiado Pendente */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fiado</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ClipboardList size={14} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-400">{fmt(stats.fiadoTotal)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{stats.fiadoCount} {stats.fiadoCount === 1 ? 'venda' : 'vendas'} pendente{stats.fiadoCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative animate-slide-up" style={{ animationDelay: '200ms' }}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          placeholder="Buscar por código ou cliente..."
          value={busca}
          onChange={handleBuscaChange}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-10 h-12 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
        {busca && (
          <button onClick={() => { setBusca(''); setPagina(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200">
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Results Header ──────────────────────────────────────────────────── */}
      {vendasFiltradas.length > 0 && (
        <div className="flex items-center justify-between px-1 animate-fade-in">
          <p className="text-xs text-slate-500">
            {vendasFiltradas.length} resultado{vendasFiltradas.length !== 1 ? 's' : ''}
            {hasFilters ? ' filtrado' + (vendasFiltradas.length !== 1 ? 's' : '') : ''}
          </p>
          <p className="text-xs text-slate-600">
            Página {safePage}/{totalPages}
          </p>
        </div>
      )}

      {/* ── Sales Cards List ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {paginatedVendas.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <EmptyState hasFilters={hasFilters} />
          </div>
        ) : (
          paginatedVendas.map((v, idx) => (
            <VendaCard
              key={v.id}
              v={v}
              index={idx}
              clienteNome={clienteMap[v.cliente_id] || 'Consumidor'}
              onView={(v) => setModal({ venda: v, mode: 'view' })}
              onEdit={(v) => setModal({ venda: v, mode: 'edit' })}
              onDelete={handleDelete}
              onPrint={handlePrint}
            />
          ))
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 pb-4 animate-fade-in">
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed active:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let page;
            if (totalPages <= 5) {
              page = i + 1;
            } else if (safePage <= 3) {
              page = i + 1;
            } else if (safePage >= totalPages - 2) {
              page = totalPages - 4 + i;
            } else {
              page = safePage - 2 + i;
            }
            return (
              <button
                key={page}
                onClick={() => setPagina(page)}
                className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                  page === safePage
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setPagina(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed active:bg-slate-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
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
