'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

/**
 * Full-width connection status bar.
 * Shows when offline, animates away when reconnected.
 */
export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2
        px-4 py-2 text-xs font-semibold
        animate-slide-down
        ${isOnline
          ? 'bg-emerald-500/90 text-white backdrop-blur-sm'
          : 'bg-red-500/90 text-white backdrop-blur-sm'
        }
      `}
      role="status"
      aria-live="assertive"
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>Reconectado — sincronizando dados...</span>
          <RefreshCw size={12} className="animate-spin" />
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Sem conexão — trabalhando offline</span>
        </>
      )}
    </div>
  );
}
