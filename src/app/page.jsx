'use client';

import { useState, useMemo, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  DollarSign, ShoppingCart, Users, Package,
  TrendingUp, Calendar, CalendarDays, CalendarClock,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';

const fmt = (centavos) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const KpiCard = memo(function KpiCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color} bg-opacity-15`}>
          <Icon size={16} />
        </div>
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
    </div>
  );
});

export default function Dashboard() {
  const vendas    = useLiveQuery(() => db?.vendas?.toArray() || [], []) || [];
  const clientes  = useLiveQuery(() => db?.clientes?.count() || 0, []) || 0;
  const produtos  = useLiveQuery(() => db?.produtos?.count() || 0, []) || 0;

  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim,    setPeriodoFim]    = useState('');

  const now = new Date();

  // Helpers de data
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // segunda
    return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
  };
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  // KPIs calculados
  const kpis = useMemo(() => {
    let total = 0, hoje = 0, semana = 0, mes = 0, periodo = 0;
    const hojeDt    = startOfDay(now).getTime();
    const semanaDt  = startOfWeek(now).getTime();
    const mesDt     = startOfMonth(now).getTime();
    const perIni    = periodoInicio ? new Date(periodoInicio + 'T00:00:00').getTime() : null;
    const perFim    = periodoFim    ? new Date(periodoFim    + 'T23:59:59').getTime() : null;

    let countHoje = 0, countSemana = 0, countMes = 0, countPeriodo = 0;

    vendas.forEach(v => {
      const t = v.total_centavos || 0;
      const d = new Date(v.data_venda).getTime();
      total += t;
      if (d >= hojeDt)   { hoje   += t; countHoje++; }
      if (d >= semanaDt) { semana += t; countSemana++; }
      if (d >= mesDt)    { mes    += t; countMes++; }
      if (perIni && perFim && d >= perIni && d <= perFim) { periodo += t; countPeriodo++; }
    });

    // Fiado / devedores
    let totalFiado = 0;
    vendas.forEach(v => {
      if (v.pagamentos) {
        v.pagamentos.forEach(p => {
          if (p.metodo === 'Fiado') totalFiado += Math.round(parseFloat(p.valor || 0) * 100);
        });
      }
    });

    return { total, hoje, semana, mes, periodo, totalFiado, countHoje, countSemana, countMes, countPeriodo };
  }, [vendas, periodoInicio, periodoFim]);

  // Últimas vendas
  const ultimasVendas = useMemo(() =>
    [...vendas].sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda)).slice(0, 8),
  [vendas]);

  // Produto mais vendido
  const topProduto = useMemo(() => {
    const mapa = {};
    vendas.forEach(v => {
      (v.itens || []).forEach(it => {
        mapa[it.nome] = (mapa[it.nome] || 0) + (it.qtde || 1);
      });
    });
    const entries = Object.entries(mapa);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { nome: entries[0][0], qtde: entries[0][1] };
  }, [vendas]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-blue-500">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumo em tempo real · Offline-First</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento Total" value={fmt(kpis.total)} icon={DollarSign} color="text-green-400" sub={`${vendas.length} vendas`} />
        <KpiCard label="Faturamento Hoje" value={fmt(kpis.hoje)} icon={Calendar} color="text-blue-400" sub={`${kpis.countHoje} vendas`} />
        <KpiCard label="Faturamento Semanal" value={fmt(kpis.semana)} icon={CalendarDays} color="text-purple-400" sub={`${kpis.countSemana} vendas`} />
        <KpiCard label="Faturamento Mensal" value={fmt(kpis.mes)} icon={CalendarClock} color="text-amber-400" sub={`${kpis.countMes} vendas`} />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Clientes" value={String(clientes)} icon={Users} color="text-blue-400" />
        <KpiCard label="Produtos" value={String(produtos)} icon={Package} color="text-purple-400" />
        <KpiCard label="Fiado / Pendente" value={fmt(kpis.totalFiado)} icon={ArrowDownRight} color="text-red-400" />
        {topProduto && (
          <KpiCard label="Mais Vendido" value={topProduto.nome} icon={ArrowUpRight} color="text-green-400" sub={`${topProduto.qtde} unidades`} />
        )}
      </div>

      {/* Filtro por período */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-blue-500" />
          <h3 className="font-bold text-slate-100 text-sm">Faturamento por Período</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-slate-500 mb-1 block">Data Início</label>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
              className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs text-slate-500 mb-1 block">Data Fim</label>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
              className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="shrink-0 text-center sm:pb-0 pb-1">
            {periodoInicio && periodoFim ? (
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">{kpis.countPeriodo} vendas</p>
                <p className="text-xl font-black text-blue-400">{fmt(kpis.periodo)}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">Selecione o período</p>
            )}
          </div>
        </div>
      </div>

      {/* Últimas vendas */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-slate-800">
          <h3 className="font-bold text-slate-100">Últimas Vendas</h3>
        </div>
        <div className="divide-y divide-slate-800/60">
          {ultimasVendas.map(v => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-slate-800 text-blue-400 px-2 py-0.5 rounded-lg">{v.codigo || v.id.substring(0, 8)}</span>
                  {v.pagamentos?.some(p => p.metodo === 'Fiado') && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">FIADO</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{new Date(v.data_venda).toLocaleString('pt-BR')}</p>
              </div>
              <p className="text-base font-bold text-blue-400 shrink-0 ml-3">{fmt(v.total_centavos || 0)}</p>
            </div>
          ))}
          {vendas.length === 0 && (
            <p className="text-slate-600 text-sm p-4 text-center">Nenhuma venda realizada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
