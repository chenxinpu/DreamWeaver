/* ============================================================================
 * 商城独立页底部导航：推荐 / 分类 / 购物车 / 我的
 * ==========================================================================*/
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import type { IconName } from './Icon';

interface MallTabBarProps {
  cartCount?: number;
}

const TABS: { key: string; label: string; icon: IconName; activeIcon: IconName; path: string; match: string }[] = [
  { key: 'home', label: '推荐', icon: 'home', activeIcon: 'home-filled', path: '/mall/home', match: '/mall/home' },
  { key: 'category', label: '分类', icon: 'grid', activeIcon: 'grid', path: '/mall/category', match: '/mall/category' },
  { key: 'cart', label: '购物车', icon: 'cart', activeIcon: 'cart', path: '/mall/cart', match: '/mall/cart' },
  { key: 'mine', label: '我的', icon: 'user', activeIcon: 'user-filled', path: '/mall/mine', match: '/mall/mine' },
];

export default function MallTabBar({ cartCount = 0 }: MallTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
        height: 'calc(var(--tab-h) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'rgba(255,255,255,.98)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--mall-line, #F0F1F3)',
        display: 'flex',
        boxShadow: '0 -2px 12px rgba(10,10,30,.06)',
      }}
    >
      {TABS.map((t) => {
        const isActive = location.pathname.startsWith(t.match);
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
              <Icon name={isActive ? t.activeIcon : t.icon} size={23} />
              {t.key === 'cart' && cartCount > 0 && (
                <span className="badge-dot" style={{ position: 'absolute', top: -6, right: -12 }}>{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
