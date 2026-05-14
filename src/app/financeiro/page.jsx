'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { SkeletonKPI } from '@/components/ui/Skeleton';
import {
  Clock, AlertTriangle, DollarSign, CheckCircle, User,
  Calendar, ChevronDown, ChevronUp, CreditCard, TrendingUp,
  Banknote, Smartphone, Wallet, FileText, Filter, ArrowDownRight,
  ArrowUpRight, BarChart3
} from 'lucide-react';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const METODO_CONFIG = {
  'Dinheiro':       { icon: Banknote,    color: 'text-green-500 dark:text-green-400',  bg: 'bg-green-500/10' },
  'PIX':            { icon: Smartphone,  color: 'text-blue-500 dark:text-blue-400',    bg: 'bg-blue-500/10' },
  'Cartão Crédito': { icon: CreditCard,  color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10' },
  'Cartão Débito':  { icon: CreditCard,  color: 'text-cyan-500 dark:text-cyan-400',    bg: 'bg-cyan-500/10' },
  'Fiado':          { icon: FileText,    color: 'text-red-500 dark:text-red-400',      bg: 'bg-red-500/10' },
};

export default function FinanceiroPage() {
  const vendas   = useLiveQuery(() => db?.vendas?.toArray(), []);
  const clientes = useLiveQuery(() => db?.clientes?.toArray(), []);

  const [tab, setTab] = useState('resumo');
  const [expandedId, setExpandedId] = useState(null);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const clienteMap = useMemo(() => {
    const m = {};
    (clientes || []).forEach(c => { m[c.id] = c; });
    return m;
  }, [clientes]);

  // Filtro por período — hooks ANTES de qualquer early return
  const vendasFiltradas = useMemo(() => {
    if (!vendas) return [];
    if (!periodoInicio && !periodoFim) return vendas;
    return vendas.filter(v => {
      const d = v.data_venda?.split('T')[0] || '';
      if (periodoInicio && d < periodoInicio) return false;
      if (periodoFim && d > periodoFim) return false;
      return true;
    });
  }, [vendas, periodoInicio, periodoFim]);

  // ══════════════════════════════════════════════════════════════════════
  // CÁLCULOS FINANCEIROS COMPLETOS — hook antes do early return
  // ══════════════════════════════════════════════════════════════════════
  const financeiro = useMemo(() => {
    let faturamentoTotal = 0;
    let recebidoTotal = 0;
    let fiadoTotal = 0;
    let fiadoPendente = 0;
    let fiadoVencido = 0;
    const porMetodo = {};
    const contasFiado = [];

    vendasFiltradas.forEach(v => {
      const totalVenda = v.total_centavos || 0;
      faturamentoTotal += totalVenda;

      (v.pagamentos || []).forEach((pag, pagIdx) => {
        const valor = Math.round(parseFloat(pag.valor || 0) * 100);
        const metodo = pag.metodo || 'Outros';

        if (!porMetodo[metodo]) porMetodo[metodo] = { total: 0, count: 0 };
        porMetodo[metodo].total += valor;
        porMetodo[metodo].count += 1;

        if (metodo === 'Fiado') {
          fiadoTotal += valor;
          const dataVenc = pag.data || v.data_venda?.split('T')[0] || today;
          const vencido = dataVenc < today;
          if (vencido) fiadoVencido += valor;
          else fiadoPendente += valor;

          contasFiado.push({
            vendaId: v.id,
            codigo: v.codigo || v.id.substring(0, 8),
            clienteId: v.cliente_id,
            clienteNome: clienteMap[v.cliente_id]?.nome || v.cliente_nome || 'Consumidor',
            clienteTel: clienteMap[v.cliente_id]?.telefone || '',
            valor,
            dataVenda: v.data_venda,
            dataVencimento: dataVenc,
            vencido,
            pagIdx,
          });
        } else {
          recebidoTotal += valor;
        }
      });
    });

    contasFiado.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    const inadimplentes = contasFiado.filter(c => c.vencido);
    const aReceber = contasFiado.filter(c => !c.vencido);

    // Agrupar inadimplentes por cliente
    const inadimPorCliente = {};
    inadimplentes.forEach(c => {
      if (!inadimPorCliente[c.clienteNome])
        inadimPorCliente[c.clienteNome] = { nome: c.clienteNome, tel: c.clienteTel, items: [], total: 0 };
      inadimPorCliente[c.clienteNome].items.push(c);
      inadimPorCliente[c.clienteNome].total += c.valor;
    });
    const inadimClienteList = Object.values(inadimPorCliente).sort((a, b) => b.total - a.total);

    return {
      faturamentoTotal, recebidoTotal, fiadoTotal, fiadoPendente, fiadoVencido,
      porMetodo, contasFiado, inadimplentes, aReceber, inadimClienteList,
      totalVendas: vendasFiltradas.length,
    };
  }, [vendasFiltradas, clienteMap, today]);

  const f = financeiro;

  // Loading — DEPOIS de todos os hooks
  if (vendas === undefined || clientes === undefined) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl animate-skeleton" />
        <SkeletonKPI count={4} />
        <SkeletonKPI count={4} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-black text-blue-600 dark:text-blue-500">Financeiro</h1>
        <p className="text-sm text-slate-500">Controle completo de receitas e recebimentos</p>
      </div>

      {/* ── FILTRO POR PERÍODO ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-blue-600 dark:text-blue-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtrar Período</span>
          {(periodoInicio || periodoFim) && (
            <button onClick={() => { setPeriodoInicio(''); setPeriodoFim(''); }}
              className="text-[10px] text-red-500 hover:underline ml-auto">Limpar</button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 mb-1 block">Início</label>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 mb-1 block">Fim</label>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-end">
            <span className="text-xs text-slate-500">{f.totalVendas} vendas</span>
          </div>
        </div>
      </div>

      {/* ── KPIs PRINCIPAIS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox label="Faturamento Total" value={fmt(f.faturamentoTotal)} icon={DollarSign}
          color="text-green-500 dark:text-green-400" sub={`${f.totalVendas} vendas`} />
        <KpiBox label="Recebido" value={fmt(f.recebidoTotal)} icon={ArrowUpRight}
          color="text-emerald-500 dark:text-emerald-400" sub="Pagamentos efetivados" />
        <KpiBox label="Total Fiado" value={fmt(f.fiadoTotal)} icon={FileText}
          color="text-amber-500 dark:text-amber-400" sub={`${f.contasFiado.length} parcelas`} />
        <KpiBox label="Inadimplentes" value={fmt(f.fiadoVencido)} icon={AlertTriangle}
          color="text-red-500 dark:text-red-400" sub={`${f.inadimplentes.length} vencidos`} />
      </div>

      {/* ── RECEITA POR MÉTODO ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-blue-600 dark:text-blue-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Receita por Método de Pagamento</h3>
        </div>
        {Object.keys(f.porMetodo).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nenhum pagamento registrado</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(f.porMetodo)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([metodo, data]) => {
                const config = METODO_CONFIG[metodo] || { icon: Wallet, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                const Icon = config.icon;
                const pct = f.faturamentoTotal > 0 ? ((data.total / f.faturamentoTotal) * 100) : 0;
                return (
                  <div key={metodo} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{metodo}</span>
                        <span className={`text-sm font-bold ${config.color}`}>{fmt(data.total)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${metodo === 'Fiado' ? 'bg-red-500' : metodo === 'PIX' ? 'bg-blue-500' : metodo === 'Dinheiro' ? 'bg-green-500' : 'bg-purple-500'}`}
                          style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-500">{data.count} pagamento{data.count > 1 ? 's' : ''}</span>
                        <span className="text-[10px] text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'resumo', label: 'Resumo', icon: TrendingUp, count: 0, activeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
          { id: 'receber', label: 'A Receber', icon: Clock, count: f.aReceber.length, activeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
          { id: 'inadimplentes', label: 'Inadimplência', icon: AlertTriangle, count: f.inadimplentes.length, activeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
              tab === t.id ? t.activeColor : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <t.icon size={16} />
            {t.label}
            {t.count > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-current/10">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMO ────────────────────────────────────────────────── */}
      {tab === 'resumo' && (
        <div className="space-y-3">
          {/* Resumo de recebimentos */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors">
            <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Fluxo de Caixa</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              <FluxoRow label="Faturamento Bruto" value={fmt(f.faturamentoTotal)} color="text-slate-800 dark:text-slate-100" bold />
              <FluxoRow label="(-) Fiado Pendente" value={`- ${fmt(f.fiadoPendente)}`} color="text-amber-500 dark:text-amber-400" />
              <FluxoRow label="(-) Fiado Vencido (Inadimplência)" value={`- ${fmt(f.fiadoVencido)}`} color="text-red-500 dark:text-red-400" />
              <FluxoRow label="(=) Receita Líquida Recebida" value={fmt(f.recebidoTotal)} color="text-emerald-600 dark:text-emerald-400" bold highlight />
            </div>
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiBox label="Ticket Médio" value={f.totalVendas > 0 ? fmt(Math.round(f.faturamentoTotal / f.totalVendas)) : 'R$ 0,00'} icon={TrendingUp} color="text-blue-500 dark:text-blue-400" />
            <KpiBox label="A Receber" value={fmt(f.fiadoPendente)} icon={Clock} color="text-amber-500 dark:text-amber-400" sub={`${f.aReceber.length} pendentes`} />
            <KpiBox label="Devedores" value={String(f.inadimClienteList.length)} icon={User} color="text-orange-500 dark:text-orange-400" sub="clientes" />
            <KpiBox label="% Fiado" value={f.faturamentoTotal > 0 ? `${((f.fiadoTotal / f.faturamentoTotal) * 100).toFixed(1)}%` : '0%'} icon={ArrowDownRight} color="text-red-500 dark:text-red-400" sub="do faturamento" />
          </div>
        </div>
      )}

      {/* ── TAB: CONTAS A RECEBER ──────────────────────────────────────── */}
      {tab === 'receber' && (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors">
          {f.aReceber.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400 dark:text-slate-600">
              <CheckCircle size={36} className="mb-2" />
              <p className="text-sm">Nenhuma conta a receber no momento!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {f.aReceber.map(c => (
                <div key={`${c.vendaId}-${c.pagIdx}`} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.clienteNome}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">#{c.codigo}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar size={9} /> Venda: {new Date(c.dataVenda).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-amber-500 dark:text-amber-400 flex items-center gap-1">
                          <Clock size={9} /> Vence: {new Date(c.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <p className="text-base font-bold text-amber-500 dark:text-amber-400 shrink-0 ml-3">{fmt(c.valor)}</p>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total a Receber</span>
                  <span className="text-lg font-black text-amber-500 dark:text-amber-400">{fmt(f.fiadoPendente)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INADIMPLÊNCIA ─────────────────────────────────────────── */}
      {tab === 'inadimplentes' && (
        <div className="space-y-3">
          {f.inadimClienteList.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center py-12 text-slate-400 dark:text-slate-600">
              <CheckCircle size={36} className="mb-2" />
              <p className="text-sm">Nenhum cliente inadimplente!</p>
            </div>
          ) : (
            f.inadimClienteList.map(cliente => {
              const isOpen = expandedId === cliente.nome;
              return (
                <div key={cliente.nome} className="bg-white dark:bg-slate-950 border border-red-200 dark:border-red-500/20 rounded-2xl overflow-hidden transition-colors">
                  <button onClick={() => setExpandedId(isOpen ? null : cliente.nome)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left" aria-label={`Expandir ${cliente.nome}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle size={18} className="text-red-500 dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{cliente.nome}</p>
                        <p className="text-[11px] text-slate-500">{cliente.items.length} parcela(s) vencida(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-lg font-black text-red-500 dark:text-red-400">{fmt(cliente.total)}</p>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
                      {cliente.tel && (
                        <a href={`tel:${cliente.tel}`} className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">📱 {cliente.tel}</a>
                      )}
                      {cliente.items.map((c, i) => {
                        const diasAtraso = Math.floor((Date.now() - new Date(c.dataVencimento + 'T12:00:00').getTime()) / 86400000);
                        return (
                          <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">#{c.codigo}</p>
                              <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold">{diasAtraso} dias em atraso</p>
                            </div>
                            <p className="text-sm font-bold text-red-500 dark:text-red-400">{fmt(c.valor)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function KpiBox({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
        <Icon size={14} className={color} />
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-600">{sub}</p>}
    </div>
  );
}

function FluxoRow({ label, value, color, bold, highlight }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${highlight ? 'bg-emerald-50 dark:bg-emerald-500/5' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-black' : 'font-semibold'} ${color}`}>{value}</span>
    </div>
  );
}
