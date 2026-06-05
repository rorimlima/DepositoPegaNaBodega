'use client';

import { useState, useMemo, useCallback } from 'react';
import { db, addToSyncQueue } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/lib/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  CheckCircle2, AlertTriangle, Calculator, FileText, 
  Wallet, ArrowRightLeft, Lock, ArrowDown, ArrowUp 
} from 'lucide-react';
import { clsx } from 'clsx';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (centavos) => `R$ ${(centavos / 100).toFixed(2)}`;
const toCentavos = (reais) => Math.round(parseFloat(reais || 0) * 100);

// ── Modal Calculadora de Notas ───────────────────────────────────────────────
function CalculadoraNotas({ onClose, onConfirm }) {
  const [notas, setNotas] = useState({
    200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '', 1: '', 0.5: '', 0.25: '', 0.1: '', 0.05: ''
  });

  const totalCentavos = useMemo(() => {
    return Object.entries(notas).reduce((acc, [valor, qtd]) => {
      return acc + Math.round(parseFloat(valor) * 100) * (parseInt(qtd) || 0);
    }, 0);
  }, [notas]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <Calculator size={18} className="text-blue-500" /> Calculadora de Notas
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {Object.keys(notas).sort((a,b) => b-a).map(valor => (
            <div key={valor} className="flex items-center gap-3">
              <div className="w-20 text-sm font-semibold text-slate-300 text-right">
                {parseFloat(valor) >= 2 ? `R$ ${valor},00` : `${parseFloat(valor)*100}¢`}
              </div>
              <div className="text-slate-500 text-xs">x</div>
              <input
                type="number" min="0" placeholder="0"
                value={notas[valor]}
                onChange={e => setNotas(prev => ({ ...prev, [valor]: e.target.value }))}
                className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 text-center"
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 text-sm">Total Calculado:</span>
            <span className="text-2xl font-black text-blue-400">{fmtBRL(totalCentavos)}</span>
          </div>
          <button 
            onClick={() => onConfirm(totalCentavos / 100)}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <CheckCircle2 size={18} /> Usar este valor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────────────────────────
export default function CaixaPage() {
  const { usuario } = useAuth();
  
  // Queries
  const today = new Date().toISOString().split('T')[0];
  const vendasHoje = useLiveQuery(() => 
    db?.vendas?.filter(v => v.data_venda.startsWith(today) && !v.is_deleted).toArray() || [], [today]
  ) || [];
  
  const fechamentoHoje = useLiveQuery(() => 
    db?.fechamentos_caixa?.where('data').equals(today).first() || null, [today]
  );

  const movimentacoes = useLiveQuery(() => 
    db?.movimentacoes_caixa?.filter(m => m.data.startsWith(today)).toArray() || [], [today]
  ) || [];

  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];

  // State
  const [fisico, setFisico] = useState({
    'Dinheiro': '', 'Cartão Crédito': '', 'Cartão Débito': '', 'PIX': '', 'Fiado': ''
  });
  const [justificativa, setJustificativa] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cálculos Sistêmicos
  const sistemicos = useMemo(() => {
    const totais = { 'Dinheiro': 0, 'Cartão Crédito': 0, 'Cartão Débito': 0, 'PIX': 0, 'Fiado': 0 };
    
    // Soma Vendas
    vendasHoje.forEach(v => {
      (v.pagamentos || []).forEach(p => {
        if (totais[p.metodo] !== undefined) {
          totais[p.metodo] += Math.round(parseFloat(p.valor) * 100);
        }
      });
      // Subtrai troco do dinheiro
      if (v.troco_centavos) totais['Dinheiro'] -= v.troco_centavos;
    });

    // Aplica Movimentações (Sangrias/Suprimentos afetam Dinheiro)
    movimentacoes.forEach(m => {
      if (m.tipo === 'sangria') totais['Dinheiro'] -= m.valor_centavos;
      if (m.tipo === 'suprimento') totais['Dinheiro'] += m.valor_centavos;
    });

    return totais;
  }, [vendasHoje, movimentacoes]);

  const totais = useMemo(() => {
    let tSist = 0; let tFis = 0; let diff = 0;
    Object.keys(sistemicos).forEach(k => {
      tSist += sistemicos[k];
      tFis += toCentavos(fisico[k]);
    });
    diff = tFis - tSist;
    return { sist: tSist, fis: tFis, diff };
  }, [sistemicos, fisico]);

  const temDivergencia = totais.diff !== 0;
  const podeFinalizar = !fechamentoHoje && (!temDivergencia || (temDivergencia && justificativa.trim().length > 5));

  // Handlers
  const handleUpdateFisico = (metodo, val) => {
    setFisico(prev => ({ ...prev, [metodo]: val }));
  };

  const gerarPDF = useCallback((fechamentoData) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const co = empresa[0] || { nome: 'SDO', cnpj: '' };
    
    doc.setFontSize(20);
    doc.text('Fechamento de Caixa', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Data: ${new Date(fechamentoData.data).toLocaleDateString('pt-BR')}`, 20, 30);
    doc.text(`Operador: ${usuario?.nome || 'Admin'}`, 20, 35);
    doc.text(`Empresa: ${co.nome}`, 20, 40);

    doc.autoTable({
      startY: 50,
      head: [['Forma de Pagamento', 'Sistêmico', 'Físico', 'Diferença']],
      body: Object.keys(sistemicos).map(k => {
        const s = sistemicos[k];
        const f = fechamentoData.fisico[k];
        return [
          k,
          fmtBRL(s),
          fmtBRL(f),
          fmtBRL(f - s)
        ];
      }),
      foot: [['TOTAL', fmtBRL(totais.sist), fmtBRL(totais.fis), fmtBRL(totais.diff)]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    if (fechamentoData.justificativa) {
      const finalY = doc.lastAutoTable.finalY || 100;
      doc.text('Justificativa de Divergência:', 20, finalY + 10);
      doc.setFontSize(9);
      doc.text(fechamentoData.justificativa, 20, finalY + 15, { maxWidth: 170 });
    }

    doc.save(`Fechamento_Caixa_${today}.pdf`);
  }, [empresa, sistemicos, totais, today, usuario]);

  const handleFinalizar = async () => {
    if (!podeFinalizar || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        id: uuidv4(),
        data: today,
        operador_id: usuario?.id || null,
        status: 'fechado',
        sistemico: sistemicos,
        fisico: Object.keys(fisico).reduce((acc, k) => ({ ...acc, [k]: toCentavos(fisico[k]) }), {}),
        totais,
        justificativa: temDivergencia ? justificativa : null,
        fechado_em: new Date().toISOString()
      };

      await db.fechamentos_caixa.add(payload);
      await addToSyncQueue('fechamentos_caixa', 'INSERT', payload);
      
      gerarPDF(payload);
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar caixa');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (fechamentoHoje) {
    return (
      <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <Lock className="text-emerald-500" size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-100 mb-2">Caixa Fechado</h2>
        <p className="text-slate-400 max-w-md mb-8">
          O caixa do dia {new Date(today).toLocaleDateString('pt-BR')} já foi conferido e fechado. 
          Nenhuma nova alteração pode ser feita neste fechamento.
        </p>
        <button 
          onClick={() => gerarPDF(fechamentoHoje)}
          className="h-12 px-6 rounded-xl bg-slate-800 text-white font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"
        >
          <FileText size={18} /> Re-imprimir Resumo
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto pb-24">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <Wallet className="text-blue-500" size={28} /> Fechamento de Caixa
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Data: <span className="font-semibold text-slate-300">{new Date(today).toLocaleDateString('pt-BR')}</span> • 
              Operador: <span className="font-semibold text-slate-300">{usuario?.nome || 'Admin'}</span>
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
            <span className="text-amber-400 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Caixa Aberto
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Sangrias / Suprimentos Resumo */}
        {movimentacoes.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ArrowRightLeft size={16} /> Movimentações Extras (Dinheiro)
            </h3>
            <div className="space-y-2">
              {movimentacoes.map(m => (
                <div key={m.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                  <span className="text-sm text-slate-300 flex items-center gap-2">
                    {m.tipo === 'sangria' ? <ArrowDown size={14} className="text-red-400"/> : <ArrowUp size={14} className="text-emerald-400"/>}
                    <span className="capitalize">{m.tipo}</span> • {m.descricao || 'Sem desc.'}
                  </span>
                  <span className={clsx("font-bold", m.tipo === 'sangria' ? "text-red-400" : "text-emerald-400")}>
                    {m.tipo === 'sangria' ? '-' : '+'}{fmtBRL(m.valor_centavos)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conferência Lado a Lado */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            
            {/* Esquerda: Sistêmico */}
            <div className="p-6 bg-slate-900/40">
              <h2 className="text-lg font-bold text-slate-300 mb-6 flex items-center gap-2">
                Valor Sistêmico <span className="text-xs font-normal text-slate-500">(Esperado)</span>
              </h2>
              <div className="space-y-5">
                {Object.keys(sistemicos).map(metodo => (
                  <div key={metodo} className="flex justify-between items-center pb-2 border-b border-slate-800/50 last:border-0">
                    <span className="text-sm text-slate-400 font-medium">{metodo}</span>
                    <span className="text-lg font-bold text-slate-200">{fmtBRL(sistemicos[metodo])}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">Total Esperado</span>
                <span className="text-2xl font-black text-blue-400">{fmtBRL(totais.sist)}</span>
              </div>
            </div>

            {/* Direita: Físico */}
            <div className="p-6 bg-slate-900">
              <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                Valor Físico <span className="text-xs font-normal text-slate-500">(Contado)</span>
              </h2>
              <div className="space-y-4">
                {Object.keys(sistemicos).map(metodo => {
                  const s = sistemicos[metodo];
                  const f = toCentavos(fisico[metodo]);
                  const diff = f - s;
                  
                  return (
                    <div key={metodo} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-slate-300 font-medium w-28 shrink-0">{metodo}</label>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                          <input 
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={fisico[metodo]} onChange={e => handleUpdateFisico(metodo, e.target.value)}
                            className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 text-slate-100 font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
                          />
                        </div>
                        {metodo === 'Dinheiro' && (
                          <button 
                            onClick={() => setShowCalc(true)}
                            className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500/20 shrink-0"
                            title="Calculadora de Notas"
                          >
                            <Calculator size={18} />
                          </button>
                        )}
                      </div>
                      {/* Diferença */}
                      {fisico[metodo] !== '' && (
                        <div className="flex justify-end pr-[52px]">
                          <span className={clsx(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                            diff === 0 ? "bg-emerald-500/10 text-emerald-400" : 
                            diff > 0 ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                          )}>
                            {diff === 0 ? <><CheckCircle2 size={10}/> Bateu</> : 
                             diff > 0 ? `Sobra: +${fmtBRL(diff)}` : `Quebra: ${fmtBRL(diff)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">Total Contado</span>
                <span className="text-2xl font-black text-slate-100">{fmtBRL(totais.fis)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo e Justificativa */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full text-center md:text-left border-b md:border-b-0 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-6">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Diferença Geral</p>
              <div className={clsx(
                "text-4xl font-black tracking-tight",
                totais.diff === 0 ? "text-emerald-400" : totais.diff > 0 ? "text-blue-400" : "text-red-500"
              )}>
                {totais.diff > 0 ? '+' : ''}{fmtBRL(totais.diff)}
              </div>
            </div>
            
            <div className="flex-[2] w-full">
              {temDivergencia ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <AlertTriangle size={16} /> Justificativa de Divergência Obrigatória
                  </label>
                  <textarea
                    placeholder="Explique o motivo da sobra/quebra de caixa..."
                    value={justificativa} onChange={e => setJustificativa(e.target.value)}
                    className="w-full bg-slate-950 border border-red-500/30 rounded-xl p-3 text-sm text-slate-100 focus:border-red-500 focus:ring-1 focus:ring-red-500 min-h-[80px] resize-none"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center md:justify-start gap-3 text-emerald-400 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                  <CheckCircle2 size={24} />
                  <div>
                    <h4 className="font-bold">Caixa Bateu!</h4>
                    <p className="text-xs opacity-80">Nenhuma divergência de valores encontrada.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botão Finalizar */}
        <button 
          onClick={handleFinalizar}
          disabled={!podeFinalizar || isSubmitting}
          className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all shadow-xl shadow-blue-900/20 hover:shadow-blue-900/40"
        >
          {isSubmitting ? 'Processando...' : <><Lock size={20} /> Finalizar Fechamento</>}
        </button>

      </div>

      {showCalc && (
        <CalculadoraNotas 
          onClose={() => setShowCalc(false)} 
          onConfirm={(val) => { handleUpdateFisico('Dinheiro', val); setShowCalc(false); }} 
        />
      )}
    </div>
  );
}
