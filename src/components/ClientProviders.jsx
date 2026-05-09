'use client';

import { useEffect } from 'react';
import { startAutoSync, fullSync } from '@/lib/syncEngine';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/LoginPage';
import { DynamicTitle } from '@/components/DynamicTitle';

// Guard interno — só renderiza children se autenticado
function AuthGuard({ children }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) return <LoginPage />;

  return <>{children}</>;
}

export function ClientProviders({ children }) {
  useEffect(() => {
    // Inicia auto-sync com intervalo de 30s
    startAutoSync(30000);

    // Registra Background Sync no Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'REGISTER_SYNC' });

      // Escuta mensagens do SW para trigger sync
      const handleMessage = (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          fullSync().catch(console.error);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  // Registra o background sync quando houver itens pendentes
  useEffect(() => {
    const registerBackgroundSync = async () => {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.sync.register('sync-queue');
        } catch (_) {
          // Background Sync não suportado neste browser
        }
      }
    };

    // Escuta mudanças de online/offline para registrar sync
    const handleOffline = () => registerBackgroundSync();
    window.addEventListener('offline', handleOffline);

    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    <AuthProvider>
      <DynamicTitle />
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
