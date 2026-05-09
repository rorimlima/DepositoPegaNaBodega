'use client';

import { useEffect } from 'react';
import { startAutoSync, fullSync } from '@/lib/syncEngine';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { InstallBanner } from '@/components/InstallBanner';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import LoginPage from '@/components/LoginPage';
import { DynamicTitle } from '@/components/DynamicTitle';

// Guard interno — só renderiza children se autenticado
function AuthGuard({ children }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-2xl font-black text-blue-400">SDO</span>
          </div>
          <span className="w-8 h-8 border-2 border-slate-300 dark:border-slate-800 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 dark:text-slate-600">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  if (!usuario) return <LoginPage />;

  return <>{children}</>;
}

// SW update listener
function SWUpdateListener() {
  const toast = useToast();

  useEffect(() => {
    const handleUpdate = () => {
      toast.info('Nova versão disponível! Recarregue para atualizar.', {
        title: '🔄 Atualização',
        duration: 8000,
      });
    };
    window.addEventListener('sw-updated', handleUpdate);
    return () => window.removeEventListener('sw-updated', handleUpdate);
  }, [toast]);

  return null;
}

// Sync bootstrapper
function SyncBootstrap() {
  useEffect(() => {
    // Inicia auto-sync com intervalo de 30s
    startAutoSync(30000);

    // Registra Background Sync no Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'REGISTER_SYNC' });

      const handleMessage = (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          fullSync().catch(console.error);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  useEffect(() => {
    const registerBackgroundSync = async () => {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.sync.register('sync-queue');
        } catch (_) {}
      }
    };
    const handleOffline = () => registerBackgroundSync();
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return null;
}

export function ClientProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DynamicTitle />
          <ConnectionStatus />
          <SyncBootstrap />
          <SWUpdateListener />
          <AuthGuard>{children}</AuthGuard>
          <InstallBanner />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
