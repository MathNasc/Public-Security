
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Code, ExternalLink, Terminal } from 'lucide-react';
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

function HeaderNav() {
  return (
    <div className="hidden md:flex items-center gap-6">
      <Link to="/" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Início</Link>
      <Link to="/dashboard" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Dashboard</Link>
      <Link to="/comparar" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Comparar</Link>
      <Link to="/fontes" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Fontes</Link>
    </div>
  );
}

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
            <HeaderNav />

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

        {/* Footer */}
        <footer className="border-t border-slate-800/80 py-8 px-4 text-center mt-auto pb-24 md:pb-8 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-4">
            <p className="text-slate-400 text-xs sm:text-sm max-w-lg leading-relaxed">
              Plataforma de código aberto e transparente para análise de segurança pública no Brasil.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-semibold">
              <a 
                href="https://github.com/MathNasc/Public-Security" 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/50 hover:bg-slate-800 transition-all shadow-sm"
              >
                <Code className="w-4 h-4 text-amber-500" />
                <span>Código Aberto (GitHub)</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>

              <Link 
                to="/api-docs" 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/50 hover:bg-slate-800 transition-all shadow-sm"
              >
                <Terminal className="w-4 h-4 text-amber-500" />
                <span>API Pública (v1)</span>
              </Link>
            </div>

            <p className="text-slate-500 text-[11px] pt-1">
              Public Security &copy; 2026 &bull; Todos os dados são extraídos de portais oficiais de transparência governamental.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
