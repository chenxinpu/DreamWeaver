/* ============================================================================
 * /mall/mine 商城·我的 —— 订单入口 / 我的转售 / 地址 / 客服
 * ==========================================================================*/
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { Avatar, CertBadge } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useMe } from '../../api/session';
import { imgSafe } from '../../components/shared/utils';
import { useCart } from '../../utils/v2';

const ENTRY: { icon: IconName; label: string; sub: string; to: string; color: string; bg: string }[] = [
  { icon: 'receipt', label: '全部订单', sub: '', to: '/mall/orders', color: '#E85C87', bg: '#FBEDF2' },
  { icon: 'package', label: '生产中', sub: '', to: '/mall/orders?filter=producing', color: '#C9A23F', bg: '#FBF4E2' },
  { icon: 'truck', label: '待收货', sub: '', to: '/mall/orders?filter=shipping', color: '#3B82F6', bg: '#EAF2FE' },
  { icon: 'wallet', label: '退款/售后', sub: '', to: '/mall/orders?filter=aftersale', color: '#E5484D', bg: '#FCEBEC' },
  { icon: 'cart', label: '二手集市', sub: '', to: '/mall/resale', color: '#F59E0B', bg: '#FDF3E3' },
  { icon: 'store', label: '我的转售', sub: '', to: '/mall/resale/mine', color: '#34A36F', bg: '#E6F5EE' },
  { icon: 'star', label: '我的收藏', sub: '', to: '/me/collections', color: '#8B5CF6', bg: '#F0EBFC' },
  { icon: 'headphones', label: '客服', sub: '', to: '', color: '#0EA5A4', bg: '#E6F7F7' },
];

const TOOLS: { icon: IconName; label: string; to: string }[] = [
  { icon: 'location', label: '收货地址', to: '' },
  { icon: 'help-circle', label: '帮助中心', to: '/me/help' },
  { icon: 'bell', label: '消息通知', to: '/messages' },
  { icon: 'settings', label: '设置', to: '/me/settings' },
];

export default function MallMinePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, loading } = useMe();
  const cart = useCart();

  return (
    <div className="mall-page" style={{ background: '#F4F5F7', minHeight: '100dvh' }}>
      {/* 头部 */}
      <div style={{ background: 'linear-gradient(135deg,#F27BA0,#E85C87 60%,#C93E6B)', color: '#fff', padding: '24px 16px 30px', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', right: -24, top: -26, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
        <div style={{ fontSize: 16, fontWeight: 800 }}>商城·我的</div>
        <div className="row" style={{ gap: 12, marginTop: 18, position: 'relative' }}>
          <Avatar src={user?.avatar ? imgSafe(user.avatar) : undefined} name={user?.nickname} size={58} ring style={{ boxShadow: '0 4px 12px rgba(0,0,0,.2)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {user ? (
              <>
                <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{user.nickname}</span>
                  <CertBadge level={user.level || 0} />
                </div>
                <div style={{ fontSize: 11.5, opacity: .9, marginTop: 3 }}>{user.bio || '购物、定制、转售一站式体验'}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{loading ? '加载中…' : '登录后享受会员价与专属定制'}</div>
                <button onClick={() => navigate('/login')} style={{ marginTop: 8, background: '#fff', color: 'var(--brand-deep)', borderRadius: 99, padding: '5px 16px', fontSize: 12, fontWeight: 800 }}>立即登录</button>
              </>
            )}
          </div>
          <button onClick={() => toast('购物车共 ' + cart.count + ' 件商品')} style={{ color: '#fff', padding: 6, position: 'relative' }}>
            <Icon name="cart" size={23} />
            {cart.count > 0 && <span className="badge-dot" style={{ position: 'absolute', top: -2, right: -4 }}>{cart.count}</span>}
          </button>
        </div>
      </div>

      {/* 订单状态宫格 */}
      <div style={{ margin: '-16px 12px 0', position: 'relative', background: '#fff', borderRadius: 16, padding: '16px 4px', boxShadow: '0 6px 20px rgba(20,20,30,.06)', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {ENTRY.slice(0, 4).map((e) => (
          <button key={e.label} onClick={() => e.to ? navigate(e.to) : toast('功能演示占位')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '6px 0' }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, background: e.bg, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={e.icon} size={19} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{e.label}</span>
          </button>
        ))}
      </div>

      {/* 服务宫格 */}
      <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 16, padding: '14px 6px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {ENTRY.slice(4).map((e) => (
          <button key={e.label} onClick={() => e.to ? navigate(e.to) : toast('在线客服工作时间为工作日 9:00-21:00')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '6px 0' }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, background: e.bg, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={e.icon} size={19} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{e.label}</span>
          </button>
        ))}
      </div>

      {/* 工具列表 */}
      <div style={{ margin: '12px 12px 0', background: '#fff', borderRadius: 16, padding: '4px 16px', marginBottom: 20 }}>
        {TOOLS.map((t, i) => (
          <button key={t.label} onClick={() => (t.to ? navigate(t.to) : toast('收货地址管理即将上线（V2 占位）'))} className="row" style={{ width: '100%', padding: '13px 0', gap: 10, borderBottom: i < TOOLS.length - 1 ? '1px solid var(--mall-line)' : 'none', textAlign: 'left' }}>
            <Icon name={t.icon} size={17} color="var(--text-2)" />
            <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 600 }}>{t.label}</span>
            <Icon name="chevron-right" size={15} color="var(--text-3)" />
          </button>
        ))}
      </div>

      {/* 底部提示 */}
      <div style={{ textAlign: 'center', padding: '6px 0 calc(var(--safe-bottom) + 60px)', fontSize: 10.5, color: 'var(--text-3)' }}>
        织梦商城 · 设计透明 / 工厂直发 / 私人定制<br />售后政策：现货支持退款，定制退货自动进二手集市
      </div>
    </div>
  );
}
