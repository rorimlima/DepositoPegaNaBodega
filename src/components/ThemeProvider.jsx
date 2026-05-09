'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}

/**
 * Theme provider: dark | light | system
 * Persists choice in localStorage, listens to system preference.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark'); // 'dark' | 'light' | 'system'
  const [resolved, setResolved] = useState('dark'); // actual applied theme

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sdo_theme') || 'dark';
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  // Listen to system changes when using 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolved(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const applyTheme = useCallback((t) => {
    let r;
    if (t === 'system') {
      r = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      r = t;
    }
    setResolved(r);
    document.documentElement.classList.toggle('dark', r === 'dark');
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem('sdo_theme', t);
    applyTheme(t);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggleTheme, isDark: resolved === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}
