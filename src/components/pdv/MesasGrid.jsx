'use client';
import { memo, useState } from 'react';
import { Users, Plus, Clock, Receipt, ShoppingCart, X, AlertTriangle } from 'lucide-react';

const STATUS_STYLES = {
  livre:     { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Livre',     icon: Plus },
  aberta:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   label: 'Ocupada',   icon: Users },
  faturando: { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    label: 'Fechando',  icon: Receipt },
};

// ── Modal de Confirmação de Cancelamento ─────────────────────────────────────
const ModalCancelar = memo(function ModalCancelar({ numero, comanda, onConfirm, onClose }) {
  const totalCentavos = (comanda?.itens || []).reduce((a, i) => a + i.preco_centavos * i.qtde, 0);
  const totalItens = (comanda?.itens || []).reduce((a, i) => a + i.qtde, 0);

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-950 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl shadow-red-900/20 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h3 className="text-lg font-black text-slate-100">Cancelar Venda</h3>
          <p className="text-sm text-slate-400 mt-1">
            Mesa <span className="font-bold text-slate-200">{String(numero).padStart(2, '0')}</span>
          </p>
        </div>

        {/* Info */}
        <div className="mx-5 mb-4 bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Itens na comanda</span>
            <span className="text-slate-200 font-bold">{totalItens}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Valor total</span>
            <span className="text-red-400 font-bold">R$ {(totalCentavos / 100).toFixed(2)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center px-5 mb-4">
          Esta ação irá cancelar a venda, liberar a mesa e não poderá ser desfeita.
        </p>

        {/* Ações */}
        <div className="p-4 border-t border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm active:bg-slate-700 transition-all">
            Voltar
          </button>
          <button onClick={() => onConfirm(numero, comanda)}
            className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-red-700 transition-all shadow-lg shadow-red-900/30">
            <X size={16} /> Cancelar Venda
          </button>
        </div>
      </div>
    </div>
  );
});

const MesaCard = memo(function MesaCard({ numero, comanda, onOpen, onCancelar }) {
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
    <div className={`${s.bg} ${s.border} border-2 rounded-2xl text-left transition-all hover:shadow-lg hover:shadow-black/20 relative overflow-hidden group`}>
      {/* Botão cancelar — só aparece em mesas ocupadas */}
      {comanda && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancelar(numero, comanda); }}
          title="Cancelar venda e liberar mesa"
          className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 hover:text-red-300 active:scale-90 transition-all opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}

      {/* Área clicável principal */}
      <button
        onClick={() => onOpen(numero, comanda)}
        className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl active:scale-95 transition-all"
      >
        {/* Glow sutil */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${s.bg}`} />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-black text-slate-100">{String(numero).padStart(2, '0')}</span>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${comanda ? 'mr-6' : ''}`}>
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
    </div>
  );
});

export default memo(function MesasGrid({ mesas, comandasMap, onOpenMesa, onVendaBalcao, onCancelarVenda }) {
  const [cancelarMesa, setCancelarMesa] = useState(null); // { numero, comanda }

  const handleCancelarClick = (numero, comanda) => {
    setCancelarMesa({ numero, comanda });
  };

  const handleConfirmCancelar = async (numero, comanda) => {
    setCancelarMesa(null);
    if (onCancelarVenda) await onCancelarVenda(numero, comanda);
  };

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
            onCancelar={handleCancelarClick}
          />
        ))}
      </div>

      {/* Modal de confirmação de cancelamento */}
      {cancelarMesa && (
        <ModalCancelar
          numero={cancelarMesa.numero}
          comanda={cancelarMesa.comanda}
          onConfirm={handleConfirmCancelar}
          onClose={() => setCancelarMesa(null)}
        />
      )}
    </div>
  );
});
