'use client';
import { useState, useMemo, memo, useCallback } from 'react';
import {
  X, Plus, ArrowLeft, Receipt, DollarSign, CreditCard,
  Search, UserPlus, User as UserIcon, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Helpers centavos-safe ────────────────────────────────────────────────────
const fmtBRL = (centavos) => `R$ ${(centavos / 100).toFixed(2)}`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const toCentavos = (reais) => Math.round(parseFloat(reais || 0) * 100);

// ── Linha de pagamento ───────────────────────────────────────────────────────
const PagRow = memo(function PagRow({
  pag, idx, onUpdate, onRemove, showRemove,
  clientes, onOpenClienteModal,
}) {
  const needCliente = pag.metodo === 'Fiado' && !pag.cliente_id;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Select value={pag.metodo} onValueChange={v => onUpdate(idx, 'metodo', v)}>
          <SelectTrigger className="h-10 text-xs bg-slate-900 border-slate-800 flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
            <SelectItem value="PIX">📱 PIX</SelectItem>
            <SelectItem value="Cartão Crédito">💳 Crédito</SelectItem>
            <SelectItem value="Cartão Débito">💳 Débito</SelectItem>
            <SelectItem value="Fiado">📝 Fiado</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="number" inputMode="decimal" placeholder="0.00" step="0.01"
          value={pag.valor} onChange={e => onUpdate(idx, 'valor', e.target.value)}
          className="h-10 w-28 bg-slate-900 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-bold"
        />
        {showRemove && (
          <button onClick={() => onRemove(idx)} className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Fiado → exige cliente */}
      {pag.metodo === 'Fiado' && (
        <div className="ml-1">
          {pag.cliente_id ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <UserIcon size={12} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium flex-1">{pag.cliente_nome}</span>
              <button onClick={() => { onUpdate(idx, 'cliente_id', null); onUpdate(idx, 'cliente_nome', ''); }}
                className="text-slate-500"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => onOpenClienteModal(idx)}
              className="w-full flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400 font-semibold active:bg-red-500/20">
              <AlertTriangle size={12} /> Vincular cliente obrigatório
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ── Cliente Search Modal ─────────────────────────────────────────────────────
const ClienteModal = memo(function ClienteModal({ clientes, onSelect, onClose, onQuickAdd }) {
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => {
    if (!busca) return clientes.slice(0, 20);
    const q = busca.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q)).slice(0, 20);
  }, [clientes, busca]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[80dvh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <UserIcon size={16} className="text-blue-500" /> Selecionar Cliente
          </h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"><X size={16} /></button>
        </div>
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input autoFocus placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 h-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filtrados.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
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
          {filtrados.length === 0 && <p className="text-center text-sm text-slate-600 py-8">Nenhum cliente encontrado</p>}
        </div>
        <div className="p-3 border-t border-slate-800 shrink-0">
          <button onClick={onQuickAdd}
            className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-700">
            <UserPlus size={14} /> Cadastro Rápido
          </button>
        </div>
      </div>
    </div>
  );
});

// ── CHECKOUT VIEW ────────────────────────────────────────────────────────────
export default memo(function CheckoutView({
  mesa, comanda, clientes,
  onVoltar, onFinalize,
  onOpenCadastroRapido,
}) {
  const itens = comanda?.itens || [];
  const totalCentavos = useMemo(() => itens.reduce((a, i) => a + i.preco_centavos * i.qtde, 0), [itens]);

  const clienteAtual = useMemo(() => {
    if (!comanda?.cliente_id) return null;
    return clientes.find(c => c.id === comanda.cliente_id) || null;
  }, [comanda?.cliente_id, clientes]);

  const [pagamentos, setPagamentos] = useState([{ valor: '', metodo: 'Dinheiro', cliente_id: null, cliente_nome: '' }]);
  const [clienteModalIdx, setClienteModalIdx] = useState(null); // idx do pagamento que precisa de cliente

  // ── Cálculos reativos (centavos-safe) ──────────────────────────────────────
  const totalPagoCentavos = useMemo(() =>
    pagamentos.reduce((a, p) => a + toCentavos(p.valor), 0),
  [pagamentos]);

  const saldoRestanteCentavos = useMemo(() =>
    Math.max(0, totalCentavos - totalPagoCentavos),
  [totalCentavos, totalPagoCentavos]);

  const excedenteCentavos = useMemo(() =>
    Math.max(0, totalPagoCentavos - totalCentavos),
  [totalCentavos, totalPagoCentavos]);

  // Verifica se tem Dinheiro no pagamento (para calcular troco)
  const temDinheiro = pagamentos.some(p => p.metodo === 'Dinheiro');

  // Verifica se algum pagamento não-dinheiro excede o total restante
  const temExcessoNaoDinheiro = useMemo(() => {
    // Calcula o excedente apenas de pagamentos não-dinheiro
    const totalNaoDinheiro = pagamentos
      .filter(p => p.metodo !== 'Dinheiro')
      .reduce((a, p) => a + toCentavos(p.valor), 0);
    return totalNaoDinheiro > totalCentavos;
  }, [pagamentos, totalCentavos]);

  // Verifica Fiado sem cliente
  const temFiadoSemCliente = pagamentos.some(p => p.metodo === 'Fiado' && !p.cliente_id && toCentavos(p.valor) > 0);

  // Pode finalizar: saldo zerado E nenhum fiado sem cliente E sem excesso de não-dinheiro
  const podeFinalizarCalc = saldoRestanteCentavos === 0 && !temFiadoSemCliente && !temExcessoNaoDinheiro;
  const troco = temDinheiro && excedenteCentavos > 0 ? excedenteCentavos : 0;
  const podeFinalizar = (saldoRestanteCentavos === 0 || (temDinheiro && excedenteCentavos >= 0 && totalPagoCentavos >= totalCentavos))
    && !temFiadoSemCliente && !temExcessoNaoDinheiro;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddPag = useCallback(() =>
    setPagamentos(p => [...p, { valor: '', metodo: 'PIX', cliente_id: null, cliente_nome: '' }]),
  []);

  const handleUpdatePag = useCallback((idx, field, val) => {
    setPagamentos(p => p.map((x, i) => {
      if (i !== idx) return x;
      const next = { ...x, [field]: val };
      // Auto-preencher cliente no Fiado se a comanda já tem um
      if (field === 'metodo' && val === 'Fiado' && !next.cliente_id && clienteAtual) {
        next.cliente_id = clienteAtual.id;
        next.cliente_nome = clienteAtual.nome;
      }
      return next;
    }));
  }, [clienteAtual]);

  const handleRemovePag = useCallback((idx) =>
    setPagamentos(p => p.filter((_, i) => i !== idx)),
  []);

  const handleSelectCliente = useCallback((c) => {
    if (clienteModalIdx !== null) {
      setPagamentos(p => p.map((x, i) => i === clienteModalIdx ? { ...x, cliente_id: c.id, cliente_nome: c.nome } : x));
      setClienteModalIdx(null);
    }
  }, [clienteModalIdx]);

  const handleFinalize = () => {
    if (!podeFinalizar) return;
    onFinalize({
      pagamentos: pagamentos.map(p => ({
        metodo: p.metodo,
        valor: round2(parseFloat(p.valor || 0)),
        cliente_id: p.cliente_id || null,
        data: new Date().toISOString().split('T')[0],
      })),
      troco: troco / 100,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onVoltar} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 active:bg-slate-700">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-blue-500">Fechamento · {mesa === 0 ? 'Venda Balcão' : `Mesa ${String(mesa).padStart(2, '0')}`}</span>
          </div>
          {clienteAtual && (
            <div className="flex items-center gap-1 mt-0.5">
              <UserIcon size={12} className="text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">{clienteAtual.nome}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Resumo itens */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Itens Consumidos</span>
            <span className="text-xs text-slate-500">{itens.reduce((a, i) => a + i.qtde, 0)} itens</span>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
            {itens.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 truncate">{it.nome}</p>
                  <p className="text-[11px] text-slate-500">{it.qtde}x {fmtBRL(it.preco_centavos)}</p>
                </div>
                <p className="text-sm font-bold text-blue-400 shrink-0 ml-3">{fmtBRL(it.preco_centavos * it.qtde)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total consumido */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5 text-center">
          <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Total Consumido</p>
          <p className="text-4xl font-black text-blue-400">{fmtBRL(totalCentavos)}</p>
        </div>

        {/* Carrinho de Pagamentos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider flex items-center gap-2">
              <CreditCard size={14} /> Carrinho de Pagamentos
            </span>
            <button onClick={handleAddPag} className="text-xs text-blue-500 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-500/10 active:bg-blue-500/20">
              <Plus size={12} /> Adicionar
            </button>
          </div>

          {pagamentos.map((pag, i) => (
            <PagRow key={i} pag={pag} idx={i}
              onUpdate={handleUpdatePag} onRemove={handleRemovePag}
              showRemove={pagamentos.length > 1}
              clientes={clientes}
              onOpenClienteModal={(idx) => setClienteModalIdx(idx)} />
          ))}
        </div>

        {/* Saldo Restante */}
        <div className={`rounded-2xl p-4 text-center border-2 transition-all ${
          saldoRestanteCentavos === 0
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Saldo Restante</p>
          <p className={`text-3xl font-black ${saldoRestanteCentavos === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {fmtBRL(saldoRestanteCentavos)}
          </p>
          {saldoRestanteCentavos === 0 && <p className="text-xs text-emerald-400 mt-1 flex items-center justify-center gap-1"><CheckCircle2 size={12} /> Conta fechada!</p>}
          {troco > 0 && <p className="text-xs text-blue-400 mt-1">💰 Troco: {fmtBRL(troco)}</p>}
        </div>

        {/* Erro: excesso não-dinheiro */}
        {temExcessoNaoDinheiro && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">O valor em cartão/PIX/Fiado não pode exceder o total da conta.</p>
          </div>
        )}
        {temFiadoSemCliente && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">Vincule um cliente ao pagamento Fiado para continuar.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <button onClick={handleFinalize} disabled={!podeFinalizar}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-base flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/30">
          <CheckCircle2 size={20} /> Finalizar Venda {troco > 0 && `(Troco: ${fmtBRL(troco)})`}
        </button>
      </div>

      {/* Modal seleção de cliente */}
      {clienteModalIdx !== null && (
        <ClienteModal
          clientes={clientes}
          onSelect={handleSelectCliente}
          onClose={() => setClienteModalIdx(null)}
          onQuickAdd={() => { onOpenCadastroRapido(clienteModalIdx); }}
        />
      )}
    </div>
  );
});
