'use client';

import { useState, useEffect } from 'react';
import { syncData } from '@/lib/syncEngine';
import { db } from '@/lib/db';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export function Header() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // useLiveQuery to get the count of items in sync_queue
  const pendingCount = useLiveQuery(() => db?.sync_queue?.count() || 0, []) || 0;

  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline || pendingCount === 0) return;
    setIsSyncing(true);
    try {
      await syncData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="flex items-center justify-between p-4 bg-slate-950 text-white border-b border-slate-800">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-blue-500 hidden md:block">SDO</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-500">
              <Wifi size={16} /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500">
              <WifiOff size={16} /> Offline
            </span>
          )}
        </div>
        
        <button
          onClick={handleSync}
          disabled={!isOnline || pendingCount === 0 || isSyncing}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 rounded-md text-sm transition-all"
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin text-amber-500' : ''} />
          <span className="hidden sm:inline">Sync ({pendingCount})</span>
          <span className="sm:hidden">{pendingCount}</span>
        </button>
      </div>
    </header>
  );
}
