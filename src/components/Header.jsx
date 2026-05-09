'use client';

import { useState, useEffect, useCallback } from 'react';
import { fullSync, getSyncStatus, onSyncStatusChange } from '@/lib/syncEngine';
import { isSupabaseReady } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wifi, WifiOff, RefreshCw, LogOut, ChevronDown, ShieldCheck, User,
  AlertTriangle, CheckCircle2, CloudOff, Cloud
} from 'lucide-react';

export function Header() {
  const { usuario, logout, isAdmin } = useAuth();
  const [isOnline, setIsOnline]           = useState(true);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [syncError, setSyncError]         = useState(null);
  const [lastSyncTime, setLastSyncTime]   = useState(null);
  const [syncTooltip, setSyncTooltip]     = useState(false);
  const [supabaseOk, setSupabaseOk]       = useState(true);

  const pendingCount = useLiveQuery(() => db?.sync_queue?.count() || 0, []) || 0;
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  const nomeEmpresa = empresa[0]?.nome || '';

  // Verifica configuração do Supabase
  useEffect(() => {
    setSupabaseOk(isSupabaseReady());
  }, []);

  // Status online/offline
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  // Escuta mudanças de status do sync engine
  useEffect(() => {
    const unsub = onSyncStatusChange((status) => {
      setIsSyncing(status.isSyncing);
      setSyncError(status.lastError);
      if (status.lastSync) setLastSyncTime(status.lastSync);
    });
    // Inicializa com status atual
    const current = getSyncStatus();
    setIsSyncing(current.isSyncing);
    setSyncError(current.lastError);
    if (current.lastSync) setLastSyncTime(current.lastSync);
    return unsub;
  }, []);

  const handleSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await fullSync();
      if (!result.success) {
        setSyncError(result.error || 'Falha parcial no sync');
      }
    } catch (e) {
      console.error(e);
      setSyncError(e?.message || 'Erro desconhecido');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  const formatLastSync = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Determina ícone e cor do status
  const getStatusIcon = () => {
    if (!supabaseOk) return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Sem config' };
    if (!isOnline) return { icon: CloudOff, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Offline' };
    if (isSyncing) return { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Sincronizando' };
    if (syncError) return { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Erro' };
    if (pendingCount > 0) return { icon: Cloud, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` };
    return { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Sincronizado' };
  };

  const status = getStatusIcon();
  const StatusIcon = status.icon;

  return (
    <header className="flex items-center gap-2 px-4 h-14 shrink-0 bg-slate-950 border-b border-slate-800">
      {/* Marca + empresa — sempre visível */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-xs font-black text-blue-500 leading-none tracking-tight hidden sm:block">
          Sistema PDV — SDO Seu Deposito Online
        </span>
        <span className="text-xs font-black text-blue-500 leading-none tracking-tight sm:hidden">
          PDV — SDO
        </span>
        {nomeEmpresa && (
          <span className="text-[11px] text-slate-500 leading-none mt-0.5 truncate">{nomeEmpresa}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Status online */}
        <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </span>

        {/* Sync status + botão */}
        <div className="relative">
          <button
            onClick={handleSync}
            onMouseEnter={() => setSyncTooltip(true)}
            onMouseLeave={() => setSyncTooltip(false)}
            disabled={!isOnline || isSyncing || !supabaseOk}
            className={`flex items-center gap-1.5 ${status.bg} hover:brightness-125 disabled:opacity-40 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[34px]`}
          >
            <StatusIcon
              size={13}
              className={`${status.color} ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span className={`hidden sm:inline ${status.color}`}>{status.label}</span>
            {pendingCount > 0 && (
              <span className="bg-blue-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {pendingCount > 99 ? '99' : pendingCount}
              </span>
            )}
          </button>

          {/* Tooltip com detalhes */}
          {syncTooltip && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 space-y-1.5">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Status:</span> {status.label}
              </p>
              {lastSyncTime && (
                <p className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Último sync:</span> {formatLastSync(lastSyncTime)}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Pendentes:</span> {pendingCount}
              </p>
              {!supabaseOk && (
                <p className="text-[10px] text-red-400 bg-red-500/10 rounded p-1.5 mt-1">
                  ⚠️ Supabase não configurado. Verifique .env
                </p>
              )}
              {syncError && (
                <p className="text-[10px] text-orange-400 bg-orange-500/10 rounded p-1.5 mt-1">
                  ⚠️ {syncError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Menu do usuário */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl px-2.5 py-1.5 min-h-[34px] transition-all"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isAdmin ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
              {isAdmin ? <ShieldCheck size={13} /> : <User size={13} />}
            </div>
            <span className="text-xs font-medium text-slate-300 hidden sm:block max-w-[80px] truncate">
              {usuario?.nome?.split(' ')[0] || usuario?.login}
            </span>
            <ChevronDown size={12} className="text-slate-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-bold text-slate-100 truncate">{usuario?.nome}</p>
                <p className="text-xs text-slate-500">@{usuario?.login}</p>
                <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                  {isAdmin ? '🛡️ Administrador' : '👤 Operador'}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} /> Sair do Sistema
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
