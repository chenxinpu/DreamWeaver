/* ============================================================================
 * 创作者中心 · 移动版外壳（/c* 路由族，430 手机壳内）
 *  - 不套桌面 CreatorLayout / 侧边导航；也不显示消费者 TabBar / MallTabBar
 *  - 顶栏：返回 → 官方首页；标题「创作者中心」；右侧「桌面版」→ /creator
 *  - 底部固定 5 Tab：总览 /c/home · 作品 /c/works · 发布 /c/publish · 橱窗 /c/window · 商品 /c/products
 *  - 角色守卫：仅 creator 角色可进入全部运营/创作模块；consumer 提示无权限，
 *    auditor/admin 引导到桌面审核端。
 * ==========================================================================*/
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useMe } from '../../api/session';
import { Loading } from './bits';

const TABS: { key: string; label: string; icon: IconName; path: string }[] = [
  { key: 'home', label: '总览', icon: 'home', path: '/c/home' },
  { key: 'works', label: '作品', icon: 'tshirt', path: '/c/works' },
  { key: 'publish', label: '发布', icon: 'send', path: '/c/publish' },
  { key: 'window', label: '橱窗', icon: 'store', path: '/c/window' },
  { key: 'products', label: '商品', icon: 'bag', path: '/c/products' },
];

export default function MCreatorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { user, loading, hasToken } = useMe();

  if (!hasToken) return <Navigate to="/login" replace state={{ from: path }} />;
  if (loading) {
    return (
      <div className="mc-app">
        <div className="mc-scroll" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loading text="正在进入创作者中心…" />
        </div>
      </div>
    );
  }
  if (!user || user.role !== 'creator') {
    const staff = user && (user.role === 'auditor' || user.role === 'admin');
    return (
      <div className="mc-app">
        <MCHeader />
        <div className="mc-scroll">
          <div className="mc-card" style={{ marginTop: 40, textAlign: 'center', padding: '40px 18px' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ban" size={30} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{staff ? '审核 / 管理请用桌面版' : '创作者中心 · 无权限'}</div>
            <div className="mc-sub" style={{ marginTop: 8 }}>
              {staff
                ? '当前账号为「审核 / 管理员」视角。审核台、通知与设置走桌面版创作者中心；运营 / 创作模块需切换创作者账号。'
                : '当前账号不是创作者。该模块需要创作者角色，请先登录「小织 #1」等创作者演示账号。'}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <button className="c-btn c-btn-outline" onClick={() => navigate('/login')}>
                <Icon name="refresh" size={13} />切换账号
              </button>
              <button className="c-btn c-btn-primary" onClick={() => navigate(staff ? '/creator/audit' : '/creator')}>
                <Icon name="external" size={13} />打开桌面版
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeKey = TABS.find((t) => path === t.path || path.startsWith(`${t.path}/`))?.key;

  return (
    <div className="mc-app">
      <MCHeader />
      <div className="mc-scroll">
        <Outlet />
      </div>
      {/* 底部 5 Tab（常驻，编辑弹层使用遮罩位于其上） */}
      <nav className="mc-tabbar">
        {TABS.map((t) => {
          const on = activeKey === t.key;
          return (
            <button key={t.key} className={on ? 'on' : ''} onClick={() => navigate(t.path)}>
              <Icon name={t.icon} size={22} />
              <span className="lb">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MCHeader() {
  const navigate = useNavigate();
  return (
    <header className="mc-topbar">
      <button className="back" onClick={() => navigate('/home')} aria-label="返回官方首页">
        <Icon name="arrow-left" size={21} />
      </button>
      <div className="mc-topbar-title">创作者中心</div>
      <button className="desk" onClick={() => navigate('/creator')}>
        <Icon name="external" size={12} />桌面版
      </button>
    </header>
  );
}
