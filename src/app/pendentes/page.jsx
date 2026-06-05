'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addToSyncQueue } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Eye, Edit, Trash2, Printer, Search, X, CheckCircle2,
  ClipboardList, Calendar, DollarSign, AlertTriangle,
  Clock, UserPlus, User as UserIcon, Filter, Plus,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const toCentavos = (v) => Math.round(parseFloat(v || 0) * 100);

// ── Helpers: detectar se venda é pendente ────────────────────────────────────
function getMotivoPendencia(v) {
  const motivos = [];
  const totalVenda = v.total_centavos || 0;
  const pagamentos = v.pagamentos || [];
  const totalPago = pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0);

  if (totalPago < totalVenda) motivos.push('Pagamento Parcial');
  if (pagamentos.some(p => p.metodo === 'Fiado')) motivos.push('Fiado');
  if (pagamentos.some(p => p.metodo === 'Fiado' && !p.cliente_id && toCentavos(p.valor) > 0)) motivos.push('Sem Cliente');
  if (pagamentos.length === 0 && totalVenda > 0) motivos.push('Sem Pagamento');

  return motivos;
}

function isVendaPendente(v) {
  const totalVenda = v.total_centavos || 0;
  const pagamentos = v.pagamentos || [];
  const totalPago = pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0);

  // Pendente se: pagamento parcial, tem fiado, fiado sem cliente, ou sem pagamento
  if (totalPago < totalVenda) return true;
  if (pagamentos.some(p => p.metodo === 'Fiado')) return true;
  if (pagamentos.some(p => p.metodo === 'Fiado' && !p.cliente_id && toCentavos(p.valor) > 0)) return true;
  if (pagamentos.length === 0 && totalVenda > 0) return true;

  return false;
}

// ── Badge de status ──────────────────────────────────────────────────────────
const StatusBadge = memo(function StatusBadge({ motivo }) {
  const configs = {
    'Pagamento Parcial': { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Clock },
    'Fiado':             { bg: 'bg-red-500/15',    text: 'text-red-400',    icon: AlertTriangle },
    'Sem Cliente':       { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: UserPlus },
    'Sem Pagamento':     { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: DollarSign },
  };
  const c = configs[motivo] || configs['Fiado'];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <Icon size={10} /> {motivo}
    </span>
  );
});

// ── Modal de Detalhes / Edição ───────────────────────────────────────────────
const PendenteModal = memo(function PendenteModal({ venda, clientes, empresa, mode, onClose, onSave }) {
  const [pagamentos, setPagamentos] = useState(venda?.pagamentos || []);
  const [clienteModal, setClienteModal] = useState(null); // idx do pagamento
  const [buscaCliente, setBuscaCliente] = useState('');
  const isEdit = mode === 'edit';
  const cliente = clientes?.find(c => c.id === venda?.cliente_id);
  const totalVenda = venda?.total_centavos || 0;
  const totalPago = pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0);
  const saldo = Math.max(0, totalVenda - totalPago);

  const handleUpdatePag = (idx, field, val) => {
    setPagamentos(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  };

  const handleAddPag = () => {
    setPagamentos(p => [...p, { metodo: 'Dinheiro', valor: '', cliente_id: null, data: new Date().toISOString().split('T')[0] }]);
  };

  const handleRemovePag = (idx) => {
    setPagamentos(p => p.filter((_, i) => i !== idx));
  };

  const handleSelectCliente = (c, idx) => {
    setPagamentos(p => p.map((x, i) => i === idx ? { ...x, cliente_id: c.id, cliente_nome: c.nome } : x));
    setClienteModal(null);
    setBuscaCliente('');
  };

  const handleSave = async () => {
    try {
      const totalPagoAtualizado = pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0);
      const novoStatus = totalPagoAtualizado >= totalVenda &&
        !pagamentos.some(p => p.metodo === 'Fiado') ? 'finalizada' : venda.status;

      const updated = { ...venda, pagamentos, status: novoStatus };
      await db.vendas.put(updated);
      await addToSyncQueue('vendas', 'UPDATE', updated);
      onSave?.();
    } catch (err) {
      console.error('[Pendentes] Erro ao salvar:', err);
      alert('Erro ao salvar alterações. Tente novamente.');
    }
  };

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente) return (clientes || []).slice(0, 20);
    const q = buscaCliente.toLowerCase();
    return (clientes || []).filter(c => c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q)).slice(0, 20);
  }, [clientes, buscaCliente]);

  if (!venda) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-100">
            {isEdit ? '✏️ Editar Venda Pendente' : '📋 Detalhes da Venda'}
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
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

          {/* Motivos */}
          <div className="flex flex-wrap gap-1.5">
            {getMotivoPendencia(venda).map(m => <StatusBadge key={m} motivo={m} />)}
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
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-slate-500 uppercase font-semibold">Pagamentos</h4>
              {isEdit && (
                <button onClick={handleAddPag} className="text-xs text-blue-500 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-500/10">
                  <Plus size={12} /> Adicionar
                </button>
              )}
            </div>
            <div className="space-y-2">
              {pagamentos.map((pag, i) => (
                <div key={i} className="space-y-1.5">
                  {isEdit ? (
                    <div className="flex items-center gap-2">
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
                        className="w-24 h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 text-right font-bold" />
                      <input type="date" value={pag.data || ''}
                        onChange={e => handleUpdatePag(i, 'data', e.target.value)}
                        className="w-36 h-10 bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-100" />
                      {pagamentos.length > 1 && (
                        <button onClick={() => handleRemovePag(i)} className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full bg-slate-900 rounded-lg px-3 py-2.5">
                      <span className="text-sm text-slate-300">{pag.metodo}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-100">R$ {parseFloat(pag.valor || 0).toFixed(2)}</span>
                        {pag.data && <p className="text-[10px] text-slate-500">{new Date(pag.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                      </div>
                    </div>
                  )}

                  {/* Fiado: vincular cliente */}
                  {isEdit && pag.metodo === 'Fiado' && (
                    <div className="ml-1">
                      {pag.cliente_id ? (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                          <UserIcon size={12} className="text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium flex-1">{pag.cliente_nome || 'Cliente vinculado'}</span>
                          <button onClick={() => { handleUpdatePag(i, 'cliente_id', null); handleUpdatePag(i, 'cliente_nome', ''); }}
                            className="text-slate-500"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setClienteModal(i)}
                          className="w-full flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400 font-semibold active:bg-red-500/20">
                          <AlertTriangle size={12} /> Vincular cliente obrigatório
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Saldo */}
            {isEdit && (
              <div className={`mt-3 rounded-xl p-3 text-center border ${saldo === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Saldo Restante</p>
                <p className={`text-xl font-black ${saldo === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(saldo)}</p>
              </div>
            )}
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

      {/* Modal de seleção de cliente para Fiado */}
      {clienteModal !== null && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[80dvh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <UserIcon size={16} className="text-blue-500" /> Selecionar Cliente
              </h3>
              <button onClick={() => { setClienteModal(null); setBuscaCliente(''); }} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input autoFocus placeholder="Buscar cliente..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {clientesFiltrados.map(c => (
                <button key={c.id} onClick={() => handleSelectCliente(c, clienteModal)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{c.nome}</p>
                    {c.telefone && <p className="text-[11px] text-slate-500">{c.telefone}</p>}
                  </div>
                </button>
              ))}
              {clientesFiltrados.length === 0 && <p className="text-center text-sm text-slate-600 py-8">Nenhum cliente encontrado</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Linha da lista ───────────────────────────────────────────────────────────
const PendenteRow = memo(function PendenteRow({ v, clienteNome, motivos, onView, onEdit, onDelete, onPrint, onQuitar }) {
  const totalPago = (v.pagamentos || []).reduce((a, p) => a + toCentavos(p.valor), 0);
  const totalVenda = v.total_centavos || 0;
  const pct = totalVenda > 0 ? Math.min(100, Math.round((totalPago / totalVenda) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-slate-800 text-blue-400 px-2 py-0.5 rounded-lg">
              {v.codigo || v.id.substring(0, 8)}
            </span>
            {motivos.map(m => <StatusBadge key={m} motivo={m} />)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {new Date(v.data_venda).toLocaleString('pt-BR')} · {clienteNome}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-base font-bold text-amber-400">{fmt(totalVenda)}</p>
            <p className="text-[10px] text-slate-500">Pago: {fmt(totalPago)}</p>
          </div>
        </div>
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
          <button onClick={() => onQuitar(v)} title="Quitar" className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 active:bg-emerald-500/20">
            <CheckCircle2 size={14} />
          </button>
          <button onClick={() => onDelete(v)} title="Excluir" className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {/* Barra de progresso do pagamento */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-500">Progresso do pagamento</span>
          <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      </div>
    </div>
  );
});

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function PendentesPage() {
  const vendas   = useLiveQuery(() => db?.vendas?.filter(v => !v.is_deleted).toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];
  const empresa  = useLiveQuery(() => db?.empresa?.toArray()  || [], []) || [];

  const [busca, setBusca]             = useState('');
  const [modal, setModal]             = useState(null);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim]       = useState('');
  const toast = useToast();

  const clienteMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  // Filtrar vendas pendentes
  const vendasPendentes = useMemo(() => {
    let arr = vendas.filter(isVendaPendente);

    // Filtro por período
    if (periodoInicio || periodoFim) {
      arr = arr.filter(v => {
        const d = v.data_venda?.split('T')[0] || '';
        if (periodoInicio && d < periodoInicio) return false;
        if (periodoFim && d > periodoFim) return false;
        return true;
      });
    }

    // Filtro de busca
    if (busca) {
      const q = busca.toLowerCase();
      arr = arr.filter(v =>
        (v.codigo || '').toLowerCase().includes(q) ||
        (clienteMap[v.cliente_id] || '').toLowerCase().includes(q)
      );
    }

    // Ordenar por data (mais recente primeiro)
    arr.sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));
    return arr;
  }, [vendas, busca, clienteMap, periodoInicio, periodoFim]);

  // KPIs
  const kpis = useMemo(() => {
    const pendentes = vendas.filter(isVendaPendente);
    const totalPendente = pendentes.reduce((a, v) => {
      const totalVenda = v.total_centavos || 0;
      const totalPago = (v.pagamentos || []).reduce((aa, p) => aa + toCentavos(p.valor), 0);
      return a + Math.max(0, totalVenda - totalPago);
    }, 0);

    const fiadoSemCliente = pendentes.filter(v =>
      (v.pagamentos || []).some(p => p.metodo === 'Fiado' && !p.cliente_id && toCentavos(p.valor) > 0)
    ).length;

    const valorFiado = pendentes.reduce((a, v) => {
      return a + (v.pagamentos || []).filter(p => p.metodo === 'Fiado').reduce((aa, p) => aa + toCentavos(p.valor), 0);
    }, 0);

    return { total: pendentes.length, totalPendente, fiadoSemCliente, valorFiado };
  }, [vendas]);

  const handleDelete = useCallback(async (v) => {
    if (!confirm(`Excluir venda pendente ${v.codigo || v.id.substring(0, 8)}?`)) return;
    try {
      await db.vendas.delete(v.id);
      await addToSyncQueue('vendas', 'DELETE', { id: v.id });
      toast.success('Venda pendente excluída.');
    } catch (err) {
      console.error('[Pendentes] Erro ao excluir:', err);
      toast.error('Erro ao excluir venda.');
    }
  }, [toast]);

  const handleQuitar = useCallback(async (v) => {
    if (!confirm(`Marcar venda ${v.codigo || v.id.substring(0, 8)} como quitada?`)) return;
    try {
      const totalVenda = v.total_centavos || 0;
      const pagamentos = v.pagamentos || [];
      const totalPago = pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0);
      const falta = Math.max(0, totalVenda - totalPago);

      let novosPagamentos = [...pagamentos];
      if (falta > 0) {
        novosPagamentos.push({
          metodo: 'Dinheiro',
          valor: (falta / 100).toFixed(2),
          data: new Date().toISOString().split('T')[0],
          cliente_id: null,
        });
      }

      const updated = {
        ...v,
        pagamentos: novosPagamentos,
        status: 'finalizada',
      };
      await db.vendas.put(updated);
      await addToSyncQueue('vendas', 'UPDATE', updated);
      toast.success('Venda quitada com sucesso! \u2705');
    } catch (err) {
      console.error('[Pendentes] Erro ao quitar:', err);
      toast.error('Erro ao quitar venda.');
    }
  }, [toast]);

  // ── Gerar PDF (mesmo padrão de pdv/vendas com fix do nome) ─────────────────
  const handlePrint = useCallback((v) => {
    const co = empresa[0] || { nome: 'SDO', cnpj: '', telefone: '', endereco: '' };
    const itens = v.itens || [];
    const pagamentos = v.pagamentos || [];

    const W = 58;
    const CX = W / 2;
    const ML = 2;
    const MR = W - 2;
    const SEP = '-'.repeat(32);

    // Pré-calcular quebra de linhas do nome da empresa
    const tmpDoc = new jsPDF('p', 'mm', [W, 100]);
    tmpDoc.setFontSize(9);
    tmpDoc.setFont('helvetica', 'bold');
    const nomeMaxWidth = 42;
    const nomeLines = tmpDoc.splitTextToSize(co.nome, nomeMaxWidth);
    const nomeExtraH = Math.max(0, (nomeLines.length - 1) * 4);

    const baseH = 90;
    const itensH = itens.length * 8;
    const pagsH = pagamentos.length * 5;
    const totalH = baseH + itensH + pagsH + nomeExtraH;

    const doc = new jsPDF('p', 'mm', [W, totalH]);
    let y = 6;

    // Cabeçalho com quebra de linha
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

    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CUPOM NÃO FISCAL', CX, y, { align: 'center' }); y += 4;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cod: ${v.codigo || v.id.substring(0, 8)}`, ML, y); y += 3;
    doc.text(`Data: ${new Date(v.data_venda).toLocaleString('pt-BR')}`, ML, y); y += 3;

    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM', ML, y);
    doc.text('QTD', 30, y, { align: 'center' });
    doc.text('VALOR', MR, y, { align: 'right' }); y += 3;
    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    itens.forEach(it => {
      const totalItem = ((it.preco_centavos * it.qtde) / 100).toFixed(2);
      const nome = it.nome.length > 18 ? it.nome.substring(0, 18) + '.' : it.nome;
      doc.text(nome, ML, y);
      doc.text(`${it.qtde}`, 30, y, { align: 'center' });
      doc.text(`R$ ${totalItem}`, MR, y, { align: 'right' }); y += 4;
      doc.setFontSize(5);
      doc.setTextColor(120);
      doc.text(`  un: R$ ${(it.preco_centavos / 100).toFixed(2)}`, ML, y); y += 4;
      doc.setFontSize(6);
      doc.setTextColor(0);
    });

    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${fmt(v.total_centavos)}`, CX, y, { align: 'center' }); y += 5;

    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text(SEP, CX, y, { align: 'center' }); y += 3;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO', ML, y); y += 3;
    doc.setFont('helvetica', 'normal');
    pagamentos.forEach(p => {
      doc.text(p.metodo, ML, y);
      doc.text(`R$ ${parseFloat(p.valor || 0).toFixed(2)}`, MR, y, { align: 'right' }); y += 4;
    });

    doc.setFontSize(5);
    doc.text(SEP, CX, y, { align: 'center' }); y += 4;

    doc.setFontSize(6);
    doc.text('Obrigado pela preferência!', CX, y, { align: 'center' }); y += 3;
    doc.setFontSize(5);
    doc.text(`Emitido: ${new Date().toLocaleString('pt-BR')}`, CX, y, { align: 'center' });

    // Preview antes de imprimir
    try {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const previewWin = window.open(pdfUrl, '_blank');
      if (previewWin) {
        previewWin.addEventListener('load', () => {
          setTimeout(() => { previewWin.focus(); previewWin.print(); }, 500);
        });
        const checkClosed = setInterval(() => {
          if (previewWin.closed) { clearInterval(checkClosed); URL.revokeObjectURL(pdfUrl); }
        }, 1000);
      } else {
        doc.save(`cupom_${v.codigo || v.id.substring(0, 8)}.pdf`);
      }
    } catch (err) {
      console.warn('[Pendentes] Erro ao abrir preview:', err);
      doc.save(`cupom_${v.codigo || v.id.substring(0, 8)}.pdf`);
    }
  }, [empresa]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-500 flex items-center gap-2">
            <ClipboardList size={22} /> Vendas Pendentes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Vendas não finalizadas, fiados e pagamentos parciais</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Pendentes</span>
            <ClipboardList size={14} className="text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400">{kpis.total}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">A Receber</span>
            <DollarSign size={14} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-red-400">{fmt(kpis.totalPendente)}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Fiado s/ Cliente</span>
            <AlertTriangle size={14} className="text-orange-400" />
          </div>
          <p className="text-xl font-black text-orange-400">{kpis.fiadoSemCliente}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Total Fiado</span>
            <Calendar size={14} className="text-purple-400" />
          </div>
          <p className="text-xl font-black text-purple-400">{fmt(kpis.valorFiado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input placeholder="Buscar por código ou cliente..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
            placeholder="Início"
            className="h-11 bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
            placeholder="Fim"
            className="h-11 bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {(periodoInicio || periodoFim) && (
            <button onClick={() => { setPeriodoInicio(''); setPeriodoFim(''); }}
              className="h-11 px-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold active:bg-red-500/20">
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        {vendasPendentes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <CheckCircle2 size={36} className="mb-2" />
            <p className="text-sm">Nenhuma venda pendente encontrada.</p>
            <p className="text-xs text-slate-700 mt-1">Todas as vendas estão quitadas! 🎉</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/50">
              <span className="text-xs text-slate-500">{vendasPendentes.length} venda{vendasPendentes.length > 1 ? 's' : ''} pendente{vendasPendentes.length > 1 ? 's' : ''}</span>
            </div>
            {vendasPendentes.map(v => (
              <PendenteRow
                key={v.id}
                v={v}
                clienteNome={clienteMap[v.cliente_id] || 'Consumidor'}
                motivos={getMotivoPendencia(v)}
                onView={(v) => setModal({ venda: v, mode: 'view' })}
                onEdit={(v) => setModal({ venda: v, mode: 'edit' })}
                onDelete={handleDelete}
                onPrint={handlePrint}
                onQuitar={handleQuitar}
              />
            ))}
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <PendenteModal
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
