'use client';

import { useState, useEffect } from 'react';
import { syncData } from '@/lib/syncEngine';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wifi, WifiOff, RefreshCw, LogOut, ChevronDown, ShieldCheck, User } from 'lucide-react';

export function Header() {
  const { usuario, logout, isAdmin } = useAuth();
  const [isOnline, setIsOnline]   = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  const pendingCount = useLiveQuery(() => db?.sync_queue?.count() || 0, []) || 0;
  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  const nomeEmpresa = empresa[0]?.nome || '';

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  const handleSync = async () => {
    if (!isOnline || pendingCount === 0) return;
    setIsSyncing(true);
    try { await syncData(); } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

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

        {/* Sync */}
        <button
          onClick={handleSync}
          disabled={!isOnline || pendingCount === 0 || isSyncing}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 transition-all min-h-[34px]"
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin text-blue-400' : 'text-slate-500'} />
          {pendingCount > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

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
