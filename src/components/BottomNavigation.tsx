import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, BarChart2, GitCompare, Database } from 'lucide-react';
import { cn } from '../lib/utils.js';

export const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      label: 'Início',
      path: '/',
      icon: Home,
      isActive: location.pathname === '/'
    },
    {
      label: 'Mapa',
      path: '/resultado?lat=-23.5505&lon=-46.6333&address=S%C3%A3o%20Paulo%2C%20SP',
      icon: MapPin,
      isActive: location.pathname === '/resultado'
    },
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: BarChart2,
      isActive: location.pathname === '/dashboard'
    },
    {
      label: 'Comparar',
      path: '/comparar',
      icon: GitCompare,
      isActive: location.pathname === '/comparar'
    },
    {
      label: 'Fontes',
      path: '/admin/data-sources',
      icon: Database,
      isActive: location.pathname.startsWith('/admin')
    }
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-xl shadow-2xl px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Navegação inferior do aplicativo"
    >
      <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[48px] touch-manipulation cursor-pointer",
                item.isActive
                  ? "text-amber-500 bg-amber-500/10 font-bold"
                  : "text-slate-400 hover:text-slate-200 active:bg-slate-900"
              )}
              aria-current={item.isActive ? "page" : undefined}
            >
              <Icon className={cn("w-5 h-5 transition-transform", item.isActive && "scale-110 text-amber-500")} />
              <span className="text-[10px] mt-1 tracking-tight truncate w-full text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
