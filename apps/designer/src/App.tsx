import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Sheet';

const L = (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
  const C = React.lazy(loader);
  return (props: any) => (
    <React.Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>加载中…</div>}>
      <C {...props} />
    </React.Suspense>
  );
};

const HomePage = L(() => import('./pages/design/home/HomePage'));
const CanvasPage = L(() => import('./pages/design/canvas/CanvasPage'));
const CanvasEditorPage = L(() => import('./pages/design/canvas/CanvasEditorPage'));
const LibraryPage = L(() => import('./pages/design/library/LibraryPage'));
const SimHubPage = L(() => import('./pages/design/sim3d/SimHubPage'));
const StudioPage = L(() => import('./pages/design/StudioPage'));
const TryonPage = L(() => import('./pages/design/TryonPage'));
const WorksPage = L(() => import('./pages/design/works/WorksPage'));
const WorksDetailPage = L(() => import('./pages/design/works/WorksDetailPage'));

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/design" replace />} />
            <Route path="/design" element={<HomePage />} />
            <Route path="/design/canvas" element={<CanvasPage />} />
            <Route path="/design/canvas/edit" element={<CanvasEditorPage />} />
            <Route path="/design/library" element={<LibraryPage />} />
            <Route path="/design/sim3d" element={<SimHubPage />} />
            <Route path="/design/studio" element={<StudioPage />} />
            <Route path="/design/tryon" element={<TryonPage />} />
            <Route path="/design/works" element={<WorksPage />} />
            <Route path="/design/works/:id" element={<WorksDetailPage />} />
            <Route path="*" element={<Navigate to="/design" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </ToastProvider>
  );
}
