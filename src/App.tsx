
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Result = lazy(() => import('./pages/Result').then(module => ({ default: module.Result })));
const Compare = lazy(() => import('./pages/Compare').then(module => ({ default: module.Compare })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const ApiDocs = lazy(() => import('./pages/ApiDocs').then(module => ({ default: module.ApiDocs })));







export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
        <header className="bg-slate-900/50 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-slate-950 font-bold">PS</div> Public Security </a>
            <div className="flex items-center gap-6">
              <a href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Dashboard Nacional</a>
              
            </div>
</div></header>

        <main className="max-w-5xl mx-auto">
          
          <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando módulo...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/resultado" element={<Result />} />
              <Route path="/comparar" element={<Compare />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Navigate to="/admin/data-sources" replace />} />
              <Route path="/admin/data-sources" element={<Admin />} />
              <Route path="/api-docs" element={<ApiDocs />} />
            </Routes>
          </Suspense>

        
        </main>
        <footer className="mt-20 border-t border-slate-800/50 py-8 px-4 text-center">
          <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-4">
            <p className="text-slate-500 text-sm">Public Security &copy; 2026. Todos os dados são derivados de fontes governamentais.</p>
            <div className="flex items-center gap-4">
              <a href="/api-docs" className="text-xs font-medium text-slate-400 hover:text-amber-500 transition-colors">API Pública</a>
              <a href="https://github.com/MathNasc/Public-Security" target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-400 hover:text-amber-500 transition-colors">Código Aberto</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
