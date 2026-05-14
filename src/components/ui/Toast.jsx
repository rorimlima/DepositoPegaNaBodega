'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS = {
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  error: 'bg-red-500/15 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  info: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
};

const TOAST_COLORS_LIGHT = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

let toastId = 0;

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

// ── Individual Toast ─────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const Icon = TOAST_ICONS[toast.type] || Info;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const colors = isDark ? TOAST_COLORS[toast.type] : TOAST_COLORS_LIGHT[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl
        max-w-[92vw] sm:max-w-md w-full pointer-events-auto
        ${colors}
        ${exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-sm font-bold leading-tight">{toast.title}</p>}
        <p className={`text-sm leading-snug ${toast.title ? 'opacity-80 mt-0.5' : 'font-medium'}`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-0.5"
        aria-label="Fechar notificação"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId;
    setToasts(prev => {
      const next = [...prev, { id, type, title, message, duration }];
      return next.slice(-3); // Max 3 visible
    });
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Convenience methods
  const toast = useCallback((message, opts = {}) => addToast({ message, ...opts }), [addToast]);
  toast.success = (message, opts = {}) => addToast({ type: 'success', message, ...opts });
  toast.error = (message, opts = {}) => addToast({ type: 'error', message, ...opts });
  toast.warning = (message, opts = {}) => addToast({ type: 'warning', message, ...opts });
  toast.info = (message, opts = {}) => addToast({ type: 'info', message, ...opts });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        aria-label="Notificações"
        className="fixed bottom-24 md:bottom-auto md:top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[100] flex flex-col gap-2 items-center md:items-end pointer-events-none"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
