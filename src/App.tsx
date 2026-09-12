
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { PWAInstallButton } from './components/PWAInstallButton.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';
import { BottomNavigation } from './components/BottomNavigation.js';

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Result = lazy(() => import('./pages/Result').then(module => ({ default: module.Result })));
const Compare = lazy(() => import('./pages/Compare').then(module => ({ default: module.Compare })));
const DataQuality = lazy(() => import('./pages/DataQuality').then(module => ({ default: module.DataQuality })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const ApiDocs = lazy(() => import('./pages/ApiDocs').then(module => ({ default: module.ApiDocs })));

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] select-none md:select-auto">
        <OfflineIndicator />

        {/* Compact Header */}
        <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2.5 sticky top-0 z-40 backdrop-blur-xl shadow-lg pt-[max(0.625rem,env(safe-area-inset-top))]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-lg font-bold tracking-tight text-white flex items-center gap-2 touch-manipulation">
              <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">PS</div>
              <span className="truncate">Public Security</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Início</Link>
              <Link to="/resultado?lat=-23.5505&lon=-46.6333&address=S%C3%A3o%20Paulo%2C%20SP" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Mapa</Link>
              <Link to="/dashboard" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Dashboard</Link>
              <Link to="/comparar" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Comparar</Link>
              <Link to="/fontes" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Fontes</Link>
            </div>

            {/* Install Button & Mobile Quick Actions */}
            <div className="flex items-center gap-3">
              <PWAInstallButton />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-6xl mx-auto pb-20 md:pb-8">
          <Suspense fallback={<div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[40vh] gap-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Carregando aplicação...</span>
          </div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/resultado" element={<Result />} />
              <Route path="/comparar" element={<Compare />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/fontes" element={<DataQuality />} />
              <Route path="/qualidade-dados" element={<DataQuality />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/data-sources" element={<Navigate to="/admin" replace />} />
              <Route path="/api-docs" element={<ApiDocs />} />
            </Routes>
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNavigation />

        {/* Desktop Footer */}
        <footer className="hidden md:block border-t border-slate-800/60 py-8 px-4 text-center mt-auto">
          <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-3">
            <p className="text-slate-500 text-xs">Public Security &copy; 2026. Todos os dados são derivados de fontes governamentais oficiais.</p>
            <div className="flex items-center gap-4">
              <Link to="/api-docs" className="text-xs font-medium text-slate-400 hover:text-amber-500 transition-colors">API Pública</Link>
              <a href="https://github.com/MathNasc/Public-Security" target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-400 hover:text-amber-500 transition-colors">Código Aberto</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
