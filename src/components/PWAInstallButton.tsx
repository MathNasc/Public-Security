import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress when already running as standalone PWA
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all rounded-lg shadow-md min-h-[44px] touch-manipulation cursor-pointer"
        aria-label="Instalar aplicativo Public Security"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-400 border border-amber-500/40 bg-slate-900/80 hover:bg-slate-800 transition rounded-lg min-h-[44px] touch-manipulation cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-500" /> Instalar no iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                1. Toque no botão <strong>Compartilhar</strong> no Safari (ícone de quadrado com seta para cima).<br /><br />
                2. Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.<br /><br />
                3. O <strong>Public Security</strong> será instalado como app nativo na sua tela principal.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition min-h-[44px]"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
