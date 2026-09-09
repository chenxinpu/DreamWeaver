/* ============================================================================
 * SideDrawer —— 左侧滑出抽屉（参考抖音：头像/左上角触发）
 * 头部账号信息 + 宫格（商城 / 创作者平台 / 二手集市 / 学习中心 / 收藏夹 / 订单 / 设置…）
 * + 切换账号；商城与创作者平台视为“独立网页”打开（仍是站内独立路由族）。
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import type { IconName } from './Icon';
import { Avatar, CertBadge } from './ui';
import { useMe } from '../api/session';

const GridEntry: { icon: IconName; label: string; path: string; color: string; bg: string; ext?: string }[] = [
  { icon: 'store', label: '商城', path: '/mall/home', color: '#E85C87', bg: '#FBEDF2' },
  { icon: 'pen-tool', label: '创作者中心', path: '/c/home', color: '#7C5CD6', bg: '#F0EBFC' },
  { icon: 'cart', label: '二手集市', path: '/mall/resale', color: '#3B82F6', bg: '#EAF2FE' },
  { icon: 'book', label: '学习中心', path: '/learn', color: '#C9A23F', bg: '#FBF4E2' },
  { icon: 'star', label: '收藏夹', path: '/me/collections', color: '#F59E0B', bg: '#FDF3E3' },
  { icon: 'receipt', label: '我的订单', path: '/mall/orders', color: '#34A36F', bg: '#E6F5EE' },
  { icon: 'settings', label: '设置', path: '/me/settings', color: '#6B6470', bg: '#F1EDE9' },
  { icon: 'help-circle', label: '帮助中心', path: '/me/help', color: '#0EA5A4', bg: '#E6F7F7' },
];

interface DrawerCtx {
  open: () => void;
  close: () => void;
}
const Ctx = React.createContext<DrawerCtx>({ open: () => {}, close: () => {} });
export const useDrawer = () => React.useContext(Ctx);

export function SideDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpen] = React.useState(false);
  const open = React.useCallback(() => setOpen(true), []);
  const close = React.useCallback(() => setOpen(false), []);
  React.useEffect(() => {
    document.body.style.overflow = openState ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [openState]);
  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <SideDrawerBody open={openState} onClose={close} />
    </Ctx.Provider>
  );
}

function SideDrawerBody({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logout } = useMe();
  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, pointerEvents: open ? 'auto' : 'none' }}>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(20,14,18,.5)',
          opacity: open ? 1 : 0, transition: 'opacity .24s ease',
        }}
      />
      {/* 抽屉面板 */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: 'min(84vw, 320px)',
          background: 'linear-gradient(180deg,#FFF 0%,#FDF9F7 100%)',
          boxShadow: '10px 0 36px rgba(0,0,0,.24)',
          transform: open ? 'translateX(0)' : 'translateX(-104%)',
          transition: 'transform .26s cubic-bezier(.32,.72,.28,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* 账号头部 */}
        <div style={{
          padding: '18px 16px 16px', color: '#fff',
          background: 'linear-gradient(135deg,#F27BA0 0%,#E85C87 55%,#C93E6B 100%)',
          borderRadius: '0 0 26px 0',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,.9)', padding: 6, zIndex: 2 }}>
            <Icon name="close" size={20} />
          </button>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <Avatar src={user?.avatar} name={user?.nickname} size={56} ring style={{ boxShadow: '0 4px 14px rgba(0,0,0,.22)' }} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="ellipsis" style={{ fontSize: 17, fontWeight: 800, maxWidth: 170 }}>{user?.nickname || '未登录'}</span>
                {user && <CertBadge level={user.level || 0} />}
              </div>
              <div className="ellipsis" style={{ fontSize: 11.5, opacity: .9, marginTop: 5, maxWidth: 200 }}>
                {user?.bio || (user ? `${roleName(user.role)} · 织梦账号` : '登录后体验个性化定制')}
              </div>
              <div className="row" style={{ gap: 12, marginTop: 9, fontSize: 11.5, fontWeight: 600, opacity: .95 }}>
                <span>{user?.following ?? 0} 关注</span>
                <span>{user?.followers ?? 0} 粉丝</span>
              </div>
            </div>
          </div>
        </div>

        {/* 宫格入口 */}
        <div style={{ padding: '14px 12px 8px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 1, padding: '0 4px 8px' }}>功能入口</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {GridEntry.map((g) => (
              <button key={g.label} onClick={() => go(g.path)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '12px 2px', borderRadius: 14, background: '#fff',
                boxShadow: '0 1px 3px rgba(40,25,32,.05)', transition: 'transform .1s ease',
              }}>
                <span style={{
                  width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: g.bg, color: g.color,
                }}>
                  <Icon name={g.icon} size={20} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 账号操作 */}
        <div style={{ padding: '8px 12px 14px', marginTop: 'auto' }}>
          <button
            onClick={() => go('/login')}
            className="row"
            style={{ width: '100%', gap: 10, padding: '12px 14px', borderRadius: 13, background: 'var(--bg-deep)', justifyContent: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}
          >
            <Icon name="refresh" size={16} />切换演示账号
          </button>
          {user && (
            <button
              onClick={() => { logout(); go('/login'); }}
              className="row"
              style={{ width: '100%', gap: 10, padding: '11px 14px', borderRadius: 13, marginTop: 8, justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}
            >
              <Icon name="logout" size={15} />退出登录
            </button>
          )}
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.7 }}>
            织梦 · 个性化服装设计平台<br />
            点击即表示同意《用户协议》与《隐私政策》
          </div>
        </div>
      </div>
    </div>
  );
}

export function roleName(role?: string): string {
  if (role === 'creator') return '创作者';
  if (role === 'auditor') return '审核专员';
  if (role === 'admin') return '管理员';
  return '消费者';
}
