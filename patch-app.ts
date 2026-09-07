import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const newImports = `
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Result = lazy(() => import('./pages/Result').then(module => ({ default: module.Result })));
const Compare = lazy(() => import('./pages/Compare').then(module => ({ default: module.Compare })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
`;

// Replace old imports
code = code.replace(/import \{ Dashboard \} from "\.\/pages\/Dashboard";/g, '');
code = code.replace(/import \{ BrowserRouter as Router, Routes, Route \} from "react-router-dom";/g, '');
code = code.replace(/import \{ Home \} from "\.\/pages\/Home";/g, '');
code = code.replace(/import \{ Result \} from "\.\/pages\/Result";/g, '');
code = code.replace(/import \{ Compare \} from "\.\/pages\/Compare";/g, '');
code = code.replace(/import \{ Admin \} from "\.\/pages\/Admin";/g, '');

code = newImports + code;

const suspensedRoutes = `
          <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando módulo...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/resultado" element={<Result />} />
              <Route path="/comparar" element={<Compare />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin/data-sources" element={<Admin />} />
            </Routes>
          </Suspense>
`;

code = code.replace(/<Routes>[\s\S]*?<\/Routes>/m, suspensedRoutes);

fs.writeFileSync('src/App.tsx', code);
