'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, autenticarUsuario } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { LogIn, Eye, EyeOff, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [loginVal, setLoginVal]   = useState('');
  const [senha,    setSenha]      = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [erro,     setErro]       = useState('');
  const [loading,  setLoading]    = useState(false);

  const empresa = useLiveQuery(() => db?.empresa?.toArray() || [], []) || [];
  const nomeEmpresa = empresa[0]?.nome || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const user = await autenticarUsuario(loginVal, senha);
      if (!user) {
        setErro('Login ou senha incorretos. Verifique e tente novamente.');
      } else {
        login(user);
      }
    } catch (err) {
      setErro('Erro interno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center px-4 transition-colors">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 dark:bg-blue-600/20 border border-blue-600/30 mb-4">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">SDO</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Sistema PDV — SDO</h1>
          <p className="text-sm text-slate-500 mt-1">Seu Depósito Online</p>
          {nomeEmpresa && (
            <div className="mt-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-600 dark:text-blue-300 font-semibold text-sm">{nomeEmpresa}</p>
            </div>
          )}
        </div>

        {/* Card de login */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl shadow-black/5 dark:shadow-black/30 transition-colors">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-5">Entrar no Sistema</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-input" className="text-xs text-slate-500 font-medium mb-1.5 block">Login</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600 pointer-events-none" />
                <input
                  id="login-input"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Seu login"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 h-12 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-input" className="text-xs text-slate-500 font-medium mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-600 pointer-events-none" />
                <input
                  id="password-input"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-12 h-12 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3">
                <p className="text-red-600 dark:text-red-400 text-xs font-medium">{erro}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={16} /> Entrar</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-700 mt-6">
          Sistema PDV • SDO Seu Depósito Online
        </p>
      </div>
    </div>
  );
}
