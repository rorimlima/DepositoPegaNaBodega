'use client';

import { useEffect } from 'react';
import { startAutoSync } from '@/lib/syncEngine';
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
    startAutoSync(30000);
  }, []);

  return (
    <AuthProvider>
      <DynamicTitle />
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
