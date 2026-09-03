import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../Icon';
import type { IconName } from '../Icon';

/* 服装设计App 自己的底部导航（独立App体验） */
const TABS: { key: string; label: string; icon: IconName; active: IconName; path: string; center?: boolean }[] = [
  { key: 'home', label: '灵感', icon: 'sparkle', active: 'sparkle', path: '/design' },
  { key: 'studio', label: '创作', icon: 'pen-tool', active: 'pen-tool', path: '/design/studio', center: true },
  { key: 'tryon', label: '试衣', icon: 'user', active: 'user-filled', path: '/design/tryon' },
  { key: 'works', label: '作品', icon: 'grid', active: 'grid', path: '/design/works' },
  { key: 'learn', label: '学习', icon: 'book', active: 'book-filled', path: '/design/learn' },
];

export default function DesignTabBar({ active }: { active: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
        height: 'calc(var(--tab-h) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'rgba(255,255,255,.97)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
      }}
    >
      {TABS.map((t) => {
        const on = t.path === location.pathname || (t.key === active && location.pathname === '/design');
        if (t.center) {
          return (
            <button key={t.key} onClick={() => navigate(t.path)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-grad)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: '0 8px 20px rgba(232,92,135,.45)', transform: 'translateY(-8px)',
                border: '3px solid #fff',
              }}>
                <Icon name="pen-tool" size={21} />
              </span>
            </button>
          );
        }
        return (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: on ? 'var(--brand)' : 'var(--text-3)',
            }}
          >
            <Icon name={on ? t.active : t.icon} size={22} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
