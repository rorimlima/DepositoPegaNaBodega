'use client';

import { useState, useMemo, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  Clock, AlertTriangle, DollarSign, CheckCircle, User,
  Calendar, ChevronDown, ChevronUp, CreditCard
} from 'lucide-react';

const fmt = (c) => `R$ ${((c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const TabButton = memo(function TabButton({ active, label, icon: Icon, count, color, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active ? `bg-${color}-500/15 text-${color}-400 border border-${color}-500/30` : 'text-slate-500 border border-transparent hover:text-slate-300'
      }`}>
      <Icon size={16} />
      {label}
      {count > 0 && (
        <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${active ? `bg-${color}-500/20` : 'bg-slate-800'}`}>
          {count}
        </span>
      )}
    </button>
  );
});

export default function FinanceiroPage() {
  const vendas   = useLiveQuery(() => db?.vendas?.toArray() || [], []) || [];
  const clientes = useLiveQuery(() => db?.clientes?.toArray() || [], []) || [];

  const [tab, setTab] = useState('receber'); // 'receber' | 'inadimplentes'
  const [expandedId, setExpandedId] = useState(null);

  const clienteMap = useMemo(() => {
    const m = {};
    clientes.forEach(c => { m[c.id] = c; });
    return m;
  }, [clientes]);

  const today = new Date().toISOString().split('T')[0];

  // Contas a receber: vendas com pagamento Fiado
  const contasReceber = useMemo(() => {
    const result = [];
    vendas.forEach(v => {
      (v.pagamentos || []).forEach((pag, pagIdx) => {
        if (pag.metodo === 'Fiado') {
          const valor = Math.round(parseFloat(pag.valor || 0) * 100);
          const dataVenc = pag.data || v.data_venda?.split('T')[0] || today;
          const vencido = dataVenc < today;
          result.push({
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
            itens: v.itens || [],
          });
        }
      });
    });
    result.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    return result;
  }, [vendas, clienteMap, today]);

  const inadimplentes = useMemo(() => contasReceber.filter(c => c.vencido), [contasReceber]);
  const aReceber      = useMemo(() => contasReceber.filter(c => !c.vencido), [contasReceber]);

  const totalReceber     = useMemo(() => contasReceber.reduce((a, c) => a + c.valor, 0), [contasReceber]);
  const totalInadimplente = useMemo(() => inadimplentes.reduce((a, c) => a + c.valor, 0), [inadimplentes]);
  const totalAReceber     = useMemo(() => aReceber.reduce((a, c) => a + c.valor, 0), [aReceber]);

  // Agrupar por cliente para a view de inadimplentes
  const inadimPorCliente = useMemo(() => {
    const mapa = {};
    inadimplentes.forEach(c => {
      if (!mapa[c.clienteNome]) mapa[c.clienteNome] = { nome: c.clienteNome, tel: c.clienteTel, items: [], total: 0 };
      mapa[c.clienteNome].items.push(c);
      mapa[c.clienteNome].total += c.valor;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [inadimplentes]);

  const listaAtual = tab === 'receber' ? aReceber : inadimplentes;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-blue-500">Financeiro</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Total Fiado</span>
            <CreditCard size={14} className="text-blue-400" />
          </div>
          <p className="text-xl font-black text-blue-400">{fmt(totalReceber)}</p>
          <p className="text-[10px] text-slate-600">{contasReceber.length} registros</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">A Receber</span>
            <Clock size={14} className="text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400">{fmt(totalAReceber)}</p>
          <p className="text-[10px] text-slate-600">{aReceber.length} pendentes</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Inadimplentes</span>
            <AlertTriangle size={14} className="text-red-400" />
          </div>
          <p className="text-xl font-black text-red-400">{fmt(totalInadimplente)}</p>
          <p className="text-[10px] text-slate-600">{inadimplentes.length} vencidos</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-500">Devedores</span>
            <User size={14} className="text-orange-400" />
          </div>
          <p className="text-xl font-black text-orange-400">{inadimPorCliente.length}</p>
          <p className="text-[10px] text-slate-600">clientes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setTab('receber')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            tab === 'receber'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-500 border border-transparent hover:text-slate-300'
          }`}>
          <Clock size={16} /> Contas a Receber
          {aReceber.length > 0 && <span className="text-xs font-black px-1.5 py-0.5 rounded-full bg-amber-500/20">{aReceber.length}</span>}
        </button>
        <button onClick={() => setTab('inadimplentes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            tab === 'inadimplentes'
              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'text-slate-500 border border-transparent hover:text-slate-300'
          }`}>
          <AlertTriangle size={16} /> Inadimplência
          {inadimplentes.length > 0 && <span className="text-xs font-black px-1.5 py-0.5 rounded-full bg-red-500/20">{inadimplentes.length}</span>}
        </button>
      </div>

      {/* ── CONTAS A RECEBER ── */}
      {tab === 'receber' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
          {aReceber.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-600">
              <CheckCircle size={36} className="mb-2" />
              <p className="text-sm">Nenhuma conta a receber no momento!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {aReceber.map((c, idx) => (
                <div key={`${c.vendaId}-${c.pagIdx}`} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-500 shrink-0" />
                        <p className="text-sm font-semibold text-slate-100 truncate">{c.clienteNome}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">#{c.codigo}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar size={9} /> Vence: {new Date(c.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <p className="text-base font-bold text-amber-400 shrink-0 ml-3">{fmt(c.valor)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INADIMPLÊNCIA ── */}
      {tab === 'inadimplentes' && (
        <div className="space-y-3">
          {inadimPorCliente.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center py-12 text-slate-600">
              <CheckCircle size={36} className="mb-2" />
              <p className="text-sm">Nenhum cliente inadimplente!</p>
            </div>
          ) : (
            inadimPorCliente.map(cliente => {
              const isOpen = expandedId === cliente.nome;
              return (
                <div key={cliente.nome} className="bg-slate-950 border border-red-500/20 rounded-2xl overflow-hidden">
                  <button onClick={() => setExpandedId(isOpen ? null : cliente.nome)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <AlertTriangle size={18} className="text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate">{cliente.nome}</p>
                        <p className="text-[11px] text-slate-500">{cliente.items.length} parcela(s) vencida(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-lg font-black text-red-400">{fmt(cliente.total)}</p>
                      {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 space-y-2">
                      {cliente.tel && (
                        <a href={`tel:${cliente.tel}`} className="text-xs text-blue-400 flex items-center gap-1">📱 {cliente.tel}</a>
                      )}
                      {cliente.items.map((c, i) => {
                        const diasAtraso = Math.floor((new Date().getTime() - new Date(c.dataVencimento + 'T12:00:00').getTime()) / 86400000);
                        return (
                          <div key={i} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs text-slate-400 font-mono">#{c.codigo}</p>
                              <p className="text-[10px] text-red-400">{diasAtraso} dias em atraso</p>
                            </div>
                            <p className="text-sm font-bold text-red-400">{fmt(c.valor)}</p>
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
