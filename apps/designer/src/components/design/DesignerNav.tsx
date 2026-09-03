import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../Icon';
import type { IconName } from '../Icon';

/* ============ 设计师App 底部导航（路径自动高亮） ============ */
export default function DesignerNav() {
  const navigate = useNavigate();
  const loc = useLocation();
  const items: { key: string; label: string; icon: IconName; path: string; test: RegExp; center?: boolean }[] = [
    { key: 'home', label: '首页', icon: 'home', path: '/design', test: /^\/design$/, },
    { key: 'canvas', label: '画布', icon: 'pen-tool', path: '/design/canvas', test: /^\/design\/canvas/, center: true },
    { key: 'library', label: '素材', icon: 'layers', path: '/design/library', test: /^\/design\/library/ },
    { key: 'sim', label: '3D模拟', icon: 'dress', path: '/design/sim3d', test: /^\/design\/(sim3d|studio|tryon)/ },
    { key: 'works', label: '作品', icon: 'grid', path: '/design/works', test: /^\/design\/works/ },
  ];
  const active = items.find((i) => i.test.test(loc.pathname))?.key || 'home';
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, zIndex: 100,
      height: 'calc(var(--tab-h) + var(--safe-bottom))',
      paddingBottom: 'var(--safe-bottom)',
      background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderTop: '1px solid var(--line)', display: 'flex',
    }}>
      {items.map((t) => {
        const on = t.key === active;
        if (t.center) {
          return (
            <button key={t.key} onClick={() => navigate(t.path)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-grad)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: on ? '0 0 0 3px var(--brand-soft), 0 8px 20px rgba(232,92,135,.4)' : '0 6px 16px rgba(232,92,135,.35)',
                transform: 'translateY(-9px)', border: '3px solid #fff',
              }}>
                <Icon name="pen-tool" size={21} />
              </span>
              <span style={{ position: 'absolute', bottom: 4, fontSize: 9.5, color: on ? 'var(--brand)' : 'var(--text-3)', fontWeight: on ? 700 : 500 }}>画布</span>
            </button>
          );
        }
        return (
          <button key={t.key} onClick={() => navigate(t.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            color: on ? 'var(--brand)' : 'var(--text-3)',
          }}>
            <Icon name={t.icon} size={22} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
