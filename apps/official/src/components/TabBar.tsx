import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import type { IconName } from './Icon';

const TABS: { key: string; label: string; icon: IconName; activeIcon: IconName; path: string }[] = [
  { key: 'plaza', label: '首页', icon: 'home', activeIcon: 'home-filled', path: '/plaza' },
  { key: 'ranking', label: '榜单', icon: 'trophy', activeIcon: 'trophy-filled', path: '/ranking' },
  { key: 'learn', label: '学习', icon: 'book', activeIcon: 'book-filled', path: '/learn' },
  { key: 'mall', label: '商城', icon: 'bag', activeIcon: 'bag-filled', path: '/mall' },
  { key: 'profile', label: '我的', icon: 'user', activeIcon: 'user-filled', path: '/profile' },
];

export default function TabBar({ active }: { active: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
        height: 'calc(var(--tab-h) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
      }}
    >
      {TABS.map((t) => {
        const isActive = location.pathname.startsWith(t.path) || (t.key === active && location.pathname === '/');
        return (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: isActive ? 'var(--brand)' : 'var(--text-3)',
            }}
          >
            <Icon name={isActive ? t.activeIcon : t.icon} size={23} />
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
