import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-slate-950 shadow-xl border border-amber-400/40 animate-pulse">
      <WifiOff className="w-4 h-4 text-slate-950" />
      <span>Modo Offline — Exibindo dados em cache</span>
    </div>
  );
};
