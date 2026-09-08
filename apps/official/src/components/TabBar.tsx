/* ============================================================================
 * 消费者手机壳底部导航：首页 / 消息 / 我的（V2；商城入口已移入侧边抽屉）
 * ==========================================================================*/
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { unreadText } from '../api/session';

interface TabBarProps {
  active: 'home' | 'messages' | 'me';
  /** 未读通知数（消息 tab 角标） */
  unread?: number;
}

const TABS = [
  { key: 'home', label: '首页', icon: 'home', activeIcon: 'home-filled', path: '/home' },
  { key: 'messages', label: '消息', icon: 'message', activeIcon: 'message', path: '/messages' },
  { key: 'me', label: '我的', icon: 'user', activeIcon: 'user-filled', path: '/me' },
] as const;

export default function TabBar({ active, unread = 0 }: TabBarProps) {
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
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        boxShadow: '0 -2px 12px rgba(40,25,32,.05)',
      }}
    >
      {TABS.map((t) => {
        const isActive = location.pathname === t.path || t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              color: isActive ? 'var(--brand)' : 'var(--text-3)', position: 'relative',
            }}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon name={isActive ? t.activeIcon : t.icon} size={24} />
              {t.key === 'messages' && unread > 0 && (
                <span className="badge-dot" style={{ position: 'absolute', top: -5, right: -10 }}>{unreadText(unread)}</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>{t.label}</span>
            {isActive && <span style={{ position: 'absolute', top: 0, width: 18, height: 3, borderRadius: 99, background: 'var(--brand-grad)' }} />}
          </button>
        );
      })}
    </div>
  );
}
