/* ============================================================================
 * 创作者平台 · 桌面网页外壳（/creator 路由族布局 + Outlet）
 *  - 登录/角色守卫：未登录 → /login；consumer → 无权限；auditor/admin → 审核视角
 *  - 左侧固定导航（logo / 账号卡 / 分组菜单）+ 顶栏（面包屑 / 通知铃 / 外链）+ 内容区(<Outlet/>)
 * 角色范围守卫：CreatorScope（仅创作者可用）与 StaffScope（仅审核员/管理员可用）——
 * 供 App.tsx 的 /creator 子路由包裹对应模块页。
 * ==========================================================================*/
import type { ReactNode } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useMe, unreadText } from '../../api/session';
import { Avatar, CertBadge } from '../../components/ui';
import { Loading, imgSafe } from '../../components/shared/utils';
import { NoPerm, ROLE_TXT } from './_shared';

interface NavItem { icon: IconName; label: string; path: string }
interface NavGroup { title: string; items: NavItem[] }

const CREATOR_NAV: NavGroup[] = [
  {
    title: '运营',
    items: [
      { icon: 'home', label: '总览', path: '/creator' },
      { icon: 'chart', label: '数据看板', path: '/creator/dashboard' },
      { icon: 'wallet', label: '佣金', path: '/creator/commission' },
    ],
  },
  {
    title: '创作',
    items: [
      { icon: 'layers', label: '素材库', path: '/creator/library' },
      { icon: 'tshirt', label: '作品组织', path: '/creator/works' },
      { icon: 'send', label: '发推文', path: '/creator/publish' },
      { icon: 'grid', label: '资源池', path: '/creator/pool' },
    ],
  },
  {
    title: '上架',
    items: [
      { icon: 'store', label: '橱窗材料', path: '/creator/window' },
      { icon: 'bag', label: '商品管理', path: '/creator/products' },
    ],
  },
  {
    title: '系统',
    items: [
      { icon: 'bell', label: '通知', path: '/creator/notifications' },
      { icon: 'settings', label: '设置', path: '/creator/settings' },
    ],
  },
];

const STAFF_NAV: NavGroup[] = [
  {
    title: '平台',
    items: [{ icon: 'shield', label: '审核演示', path: '/creator/audit' }],
  },
  {
    title: '系统',
    items: [
      { icon: 'bell', label: '通知', path: '/creator/notifications' },
      { icon: 'settings', label: '设置', path: '/creator/settings' },
    ],
  },
];

export default function CreatorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, unread, hasToken } = useMe();
  const path = location.pathname;

  if (!hasToken) return <Navigate to="/login" replace state={{ from: path.startsWith('/creator') ? path : '/creator' }} />;
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--creator-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading text="正在进入创作者中心…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: path }} />;

  const staff = user.role === 'auditor' || user.role === 'admin';
  if (user.role === 'consumer') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--creator-bg)' }}>
        <div className="creator-content" style={{ padding: '60px 24px' }}>
          <NoPerm title="创作者平台 · 无权限" />
        </div>
      </div>
    );
  }
  // 审核员/管理员在 /creator 根路径自动进入审核视角
  if (staff && path === '/creator') return <Navigate to="/creator/audit" replace />;

  const nav = staff ? STAFF_NAV : CREATOR_NAV;
  const flat = nav.flatMap((g) => g.items);
  const active = flat.filter((n) => (n.path === '/creator' ? path === '/creator' : path.startsWith(n.path))).sort((a, b) => b.path.length - a.path.length)[0];
  const title = active?.label || (staff ? '审核演示' : '总览');

  return (
    <div className="creator-root">
      {/* ================= 左侧导航 ================= */}
      <aside className="creator-sidenav">
        <button className="row" style={{ gap: 9, padding: '16px 16px 10px', cursor: 'pointer', textAlign: 'left' }} onClick={() => navigate(staff ? '/creator/audit' : '/creator')}>
          <span style={{
            width: 36, height: 36, borderRadius: 11, background: 'var(--brand-grad)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18,
            boxShadow: '0 5px 12px rgba(232,92,135,.35)', flexShrink: 0,
          }}>织</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>织梦创作者中心</span>
            <span style={{ fontSize: 10, color: '#9AA0AA' }}>Creator Platform · 桌面端</span>
          </span>
        </button>

        {/* 账号卡 */}
        <div className="c-acc">
          <div className="row" style={{ gap: 10, minWidth: 0 }}>
            <Avatar src={imgSafe(user.avatar) || undefined} name={user.nickname} size={40} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="c-acc-name">
                <span className="ellipsis">{user.nickname}</span>
                <CertBadge level={user.level || 0} />
              </div>
              <div className="c-acc-id">#{user.id} · {ROLE_TXT[user.role] || user.role}</div>
            </div>
          </div>
          <div className="c-acc-actions">
            <button className="c-btn c-btn-sm c-btn-outline" style={{ flex: 1 }} onClick={() => navigate('/login')}>
              <Icon name="refresh" size={12} />切换账号
            </button>
            <button className="c-btn c-btn-sm c-btn-outline" style={{ flex: 1 }} onClick={() => navigate('/home')} title="回到消费者端">
              <Icon name="user" size={12} />消费者端
            </button>
          </div>
        </div>

        {/* 分组菜单 */}
        <div className="flex-1" style={{ overflowY: 'auto', paddingBottom: 10 }}>
          {staff && (
            <div className="c-notice info" style={{ margin: '0 12px 8px', fontSize: 11.5 }}>
              <Icon name="shield" size={13} />
              <span>当前为审核视角。运营/创作模块需切到创作者账号（小织 #1）。</span>
            </div>
          )}
          {nav.map((g) => (
            <div key={g.title}>
              <div className="creator-nav-group">{g.title}</div>
              {g.items.map((n) => {
                const on = active?.path === n.path;
                return (
                  <button key={n.path} className={`creator-nav-item ${on ? 'on' : ''}`} onClick={() => navigate(n.path)}>
                    <Icon name={n.icon} size={17} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--creator-line)' }}>
          <div className="row" style={{ gap: 6, fontSize: 11, color: '#9AA0AA' }}>
            <Icon name="heart" size={12} />
            织梦 DreamWeaver · v2.0
          </div>
        </div>
      </aside>

      {/* ================= 主内容 ================= */}
      <main className="creator-main">
        <div className="creator-content">
          <div className="creator-topbar">
            <div className="crumb">
              <Icon name="store" size={14} color="var(--brand)" />
              <span>创作者平台</span>
              <Icon name="chevron-right" size={13} />
              <b>{title}</b>
            </div>
            <div className="top-actions">
              <button className="bell-wrap c-btn c-btn-sm c-btn-outline" onClick={() => navigate('/creator/notifications')}>
                <Icon name="bell" size={14} />
                通知
                {unread > 0 && <span className="bell-badge" style={{ position: 'static', background: 'var(--brand)', marginLeft: 2 }}>{unreadText(unread)}</span>}
              </button>
              <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate('/mall/home')}>
                <Icon name="bag" size={14} />进入商城
              </button>
              <button className="c-btn c-btn-sm c-btn-outline" onClick={() => navigate('/home')}>
                <Icon name="external" size={13} />官方首页
              </button>
            </div>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ------------------------- 角色范围守卫（App.tsx 子路由使用） ------------------------- */
function useRoleUser() {
  const { user, hasToken } = useMe();
  if (!hasToken || !user) return null;
  return user;
}

/** 仅创作者：审核员/管理员/消费者访问创作者模块时给出引导 */
export function CreatorScope({ children }: { children: ReactNode }) {
  const user = useRoleUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'auditor' || user.role === 'admin') return <Navigate to="/creator/audit" replace />;
  if (user.role !== 'creator') {
    return (
      <div className="c-card">
        <NoPerm title="此模块仅创作者可用" />
      </div>
    );
  }
  return <>{children}</>;
}

/** 仅审核员/管理员（审核演示等） */
export function StaffScope({ children }: { children: ReactNode }) {
  const user = useRoleUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'creator' || user.role === 'consumer') {
    return (
      <div className="c-card">
        <NoPerm title="审核演示 · 仅审核员/管理员可用" />
      </div>
    );
  }
  return <>{children}</>;
}
