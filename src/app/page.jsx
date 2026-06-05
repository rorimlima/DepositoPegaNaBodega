'use client';

import { useState, useMemo, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { SkeletonKPI } from '@/components/ui/Skeleton';
import {
  DollarSign, ShoppingCart, Users, Package,
  TrendingUp, Calendar, CalendarDays, CalendarClock,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';

const fmt = (centavos) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const KpiCard = memo(function KpiCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color} bg-current/10`}>
          <Icon size={16} />
        </div>
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">{sub}</p>}
    </div>
  );
});

export default function Dashboard() {
  const vendas    = useLiveQuery(() => db?.vendas?.filter(v => !v.is_deleted).toArray() || [], []);
  const clientes  = useLiveQuery(() => db?.clientes?.count() || 0, []);
  const produtos  = useLiveQuery(() => db?.produtos?.count() || 0, []);

  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim,    setPeriodoFim]    = useState('');

  // Loading state
  if (vendas === undefined) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl animate-skeleton" />
          <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-skeleton mt-2" />
        </div>
        <SkeletonKPI count={4} />
        <SkeletonKPI count={4} />
      </div>
    );
  }

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
  };
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  const vendasArr = vendas || [];

  const kpis = (() => {
    let total = 0, hoje = 0, semana = 0, mes = 0, periodo = 0;
    const hojeDt    = startOfDay(now).getTime();
    const semanaDt  = startOfWeek(now).getTime();
    const mesDt     = startOfMonth(now).getTime();
    const perIni    = periodoInicio ? new Date(periodoInicio + 'T00:00:00').getTime() : null;
    const perFim    = periodoFim    ? new Date(periodoFim    + 'T23:59:59').getTime() : null;

    let countHoje = 0, countSemana = 0, countMes = 0, countPeriodo = 0;

    vendasArr.forEach(v => {
      const t = v.total_centavos || 0;
      const d = new Date(v.data_venda).getTime();
      total += t;
      if (d >= hojeDt)   { hoje   += t; countHoje++; }
      if (d >= semanaDt) { semana += t; countSemana++; }
      if (d >= mesDt)    { mes    += t; countMes++; }
      if (perIni && perFim && d >= perIni && d <= perFim) { periodo += t; countPeriodo++; }
    });

    let totalFiado = 0;
    vendasArr.forEach(v => {
      if (v.pagamentos) {
        v.pagamentos.forEach(p => {
          if (p.metodo === 'Fiado') totalFiado += Math.round(parseFloat(p.valor || 0) * 100);
        });
      }
    });

    return { total, hoje, semana, mes, periodo, totalFiado, countHoje, countSemana, countMes, countPeriodo };
  })();

  const ultimasVendas = [...vendasArr].sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda)).slice(0, 8);

  const topProduto = (() => {
    const mapa = {};
    vendasArr.forEach(v => {
      (v.itens || []).forEach(it => {
        mapa[it.nome] = (mapa[it.nome] || 0) + (it.qtde || 1);
      });
    });
    const entries = Object.entries(mapa);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { nome: entries[0][0], qtde: entries[0][1] };
  })();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-blue-600 dark:text-blue-500">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumo em tempo real · Offline-First</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento Total" value={fmt(kpis.total)} icon={DollarSign} color="text-green-500 dark:text-green-400" sub={`${vendasArr.length} vendas`} />
        <KpiCard label="Faturamento Hoje" value={fmt(kpis.hoje)} icon={Calendar} color="text-blue-500 dark:text-blue-400" sub={`${kpis.countHoje} vendas`} />
        <KpiCard label="Faturamento Semanal" value={fmt(kpis.semana)} icon={CalendarDays} color="text-purple-500 dark:text-purple-400" sub={`${kpis.countSemana} vendas`} />
        <KpiCard label="Faturamento Mensal" value={fmt(kpis.mes)} icon={CalendarClock} color="text-amber-500 dark:text-amber-400" sub={`${kpis.countMes} vendas`} />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Clientes" value={String(clientes || 0)} icon={Users} color="text-blue-500 dark:text-blue-400" />
        <KpiCard label="Produtos" value={String(produtos || 0)} icon={Package} color="text-purple-500 dark:text-purple-400" />
        <KpiCard label="Fiado / Pendente" value={fmt(kpis.totalFiado)} icon={ArrowDownRight} color="text-red-500 dark:text-red-400" />
        {topProduto && (
          <KpiCard label="Mais Vendido" value={topProduto.nome} icon={ArrowUpRight} color="text-green-500 dark:text-green-400" sub={`${topProduto.qtde} unidades`} />
        )}
      </div>

      {/* Filtro por período */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-blue-600 dark:text-blue-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Faturamento por Período</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-slate-500 mb-1 block">Data Início</label>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs text-slate-500 mb-1 block">Data Fim</label>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="shrink-0 text-center sm:pb-0 pb-1">
            {periodoInicio && periodoFim ? (
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">{kpis.countPeriodo} vendas</p>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400">{fmt(kpis.periodo)}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-600">Selecione o período</p>
            )}
          </div>
        </div>
      </div>

      {/* Últimas vendas */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors">
        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Últimas Vendas</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {ultimasVendas.map(v => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg">{v.codigo || v.id.substring(0, 8)}</span>
                  {v.pagamentos?.some(p => p.metodo === 'Fiado') && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">FIADO</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{new Date(v.data_venda).toLocaleString('pt-BR')}</p>
              </div>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400 shrink-0 ml-3">{fmt(v.total_centavos || 0)}</p>
            </div>
          ))}
          {vendasArr.length === 0 && (
            <div className="flex flex-col items-center py-12 text-slate-400 dark:text-slate-600">
              <ShoppingCart size={36} className="mb-2" />
              <p className="text-sm">Nenhuma venda realizada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
