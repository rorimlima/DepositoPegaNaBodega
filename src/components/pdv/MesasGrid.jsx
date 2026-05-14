'use client';
import { memo } from 'react';
import { Users, Plus, Clock, Receipt, ShoppingCart } from 'lucide-react';

const STATUS_STYLES = {
  livre:     { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Livre',     icon: Plus },
  aberta:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   label: 'Ocupada',   icon: Users },
  faturando: { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    label: 'Fechando',  icon: Receipt },
};

const MesaCard = memo(function MesaCard({ numero, comanda, onOpen }) {
  const status = comanda ? comanda.status : 'livre';
  const s = STATUS_STYLES[status] || STATUS_STYLES.livre;
  const Icon = s.icon;

  const totalCentavos = comanda
    ? (comanda.itens || []).reduce((a, i) => a + i.preco_centavos * i.qtde, 0)
    : 0;

  const tempoAberta = comanda?.aberta_em
    ? Math.floor((Date.now() - new Date(comanda.aberta_em).getTime()) / 60000)
    : 0;

  return (
    <button
      onClick={() => onOpen(numero, comanda)}
      className={`${s.bg} ${s.border} border-2 rounded-2xl p-4 text-left transition-all active:scale-95 hover:shadow-lg hover:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500 relative overflow-hidden group`}
    >
      {/* Glow sutil */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${s.bg}`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-black text-slate-100">{String(numero).padStart(2, '0')}</span>
          <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
            <Icon size={18} className={s.text} />
          </div>
        </div>

        <span className={`text-[11px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>

        {comanda && (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-black text-slate-100">
              R$ {(totalCentavos / 100).toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock size={10} /> {tempoAberta < 60 ? `${tempoAberta}min` : `${Math.floor(tempoAberta / 60)}h${tempoAberta % 60}m`}
              {' · '}{(comanda.itens || []).reduce((a, i) => a + i.qtde, 0)} itens
            </p>
          </div>
        )}
      </div>
    </button>
  );
});

export default memo(function MesasGrid({ mesas, comandasMap, onOpenMesa, onVendaBalcao }) {
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-blue-500">Mesas & Comandas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Toque em uma mesa para abrir ou gerenciar</p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_STYLES).map(([k, s]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${s.bg} ${s.border} border`} />
              <span className="text-[10px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Venda Balcão — venda rápida sem mesa */}
      <button
        onClick={onVendaBalcao}
        className="w-full mb-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-2 border-blue-500/40 rounded-2xl p-4 text-left transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-blue-900/20 hover:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/30 transition-colors">
            <ShoppingCart size={24} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-blue-400">Venda Balcão</p>
            <p className="text-xs text-slate-500">Venda rápida para cliente final · Sem mesa</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Plus size={20} className="text-blue-400" />
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {mesas.map(num => (
          <MesaCard
            key={num}
            numero={num}
            comanda={comandasMap[num] || null}
            onOpen={onOpenMesa}
          />
        ))}
      </div>
    </div>
  );
});
