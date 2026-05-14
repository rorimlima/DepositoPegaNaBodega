'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * Smart PWA install banner.
 * - Android/Desktop: uses beforeinstallprompt
 * - iOS: shows manual instructions
 * - Appears after 2nd visit
 * - Dismissible with localStorage persistence
 */
export function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if dismissed
    const dismissed = localStorage.getItem('sdo_install_dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Track visits
    const visits = parseInt(localStorage.getItem('sdo_visits') || '0') + 1;
    localStorage.setItem('sdo_visits', String(visits));

    // Only show after 2nd visit
    if (visits < 2) return;

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      setShowBanner(true);
      return;
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('sdo_install_dismissed', String(Date.now()));
    setShowBanner(false);
  };

  if (!showBanner || isStandalone) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[90] animate-slide-up">
      <div className="bg-slate-900 dark:bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
            {isIOS ? <Share size={20} className="text-blue-400" /> : <Download size={20} className="text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-100">Instalar SDO</h3>
            {isIOS ? (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Toque em <Share size={12} className="inline text-blue-400" /> e depois em{' '}
                <span className="font-semibold text-slate-300">"Adicionar à Tela Inicial"</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Instale o app para acesso rápido e uso offline completo.
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            aria-label="Fechar banner de instalação"
          >
            <X size={14} />
          </button>
        </div>

        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Download size={16} /> Instalar Agora
          </button>
        )}
      </div>
    </div>
  );
}
