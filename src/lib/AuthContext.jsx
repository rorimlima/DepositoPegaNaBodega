'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const SESSION_KEY = 'sdo_session';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);   // { id, nome, login, role }
  const [loading, setLoading] = useState(true);

  // Restaurar sessão do sessionStorage ao montar
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) setUsuario(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const login = (user) => {
    const session = { id: user.id, nome: user.nome, login: user.login, role: user.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUsuario(session);
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUsuario(null);
  };

  const isAdmin    = usuario?.role === 'admin';
  const isOperador = usuario?.role === 'operador';

  return (
    <AuthContext.Provider value={{ usuario, login, logout, isAdmin, isOperador, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
