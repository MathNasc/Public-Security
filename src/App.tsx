import { Dashboard } from "./pages/Dashboard";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Result } from "./pages/Result";
import { Admin } from "./pages/Admin";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
        <header className="bg-slate-900/50 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center text-slate-950 font-bold">V</div>
              Vizinhança <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded ml-1">MVP</span>
            </a>
            <div className="flex items-center gap-6">
              <a href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Dashboard Nacional</a>
              <a href="/admin/data-sources" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Admin</a>
            </div>
</div></header>

        <main className="max-w-5xl mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/resultado" element={<Result />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/data-sources" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
