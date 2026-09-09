/* ============================================================================
 * /c/home 创作者中心 · 总览（移动版）
 * 欢迎卡 + KPI 2×2（在售/近30天成交额/转化率/预估佣金）+ 快捷宫格 + 待办清单
 * 待办链接：创作/上架类 → 换到 /c/…；数据看板等桌面项保留 /creator/…
 * ==========================================================================*/
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { api } from '../../api/client';
import type { CreatorOverview } from '../../api/types';
import { fmtMoney } from '../../components/shared/utils';
import { useAsync, MEmpty, mcLink, MCardHd, Loading } from './bits';

const TODO_META: Record<string, { icon: IconName; badge: string; label: string; tone: string }> = {
  pool: { icon: 'grid', badge: 'c-badge-brand', label: '资源池', tone: '#7C5CD6' },
  audit: { icon: 'clock', badge: 'c-badge-blue', label: '审核中', tone: '#3B82F6' },
  reject: { icon: 'close', badge: 'c-badge-red', label: '需处理', tone: '#E5484D' },
  withdraw: { icon: 'wallet', badge: 'c-badge-gold', label: '去处理', tone: '#C9A23F' },
};

const SHORTCUTS: { icon: IconName; label: string; to: string; color: string; bg: string }[] = [
  { icon: 'layers', label: '素材库', to: '/c/library', color: '#B4547A', bg: '#FBEDF2' },
  { icon: 'tshirt', label: '作品', to: '/c/works', color: '#D44771', bg: '#FBEDF2' },
  { icon: 'send', label: '发推文', to: '/c/publish', color: '#3B82F6', bg: '#EAF2FE' },
  { icon: 'store', label: '橱窗', to: '/c/window', color: '#B4547A', bg: '#F6E9F0' },
  { icon: 'bag', label: '商品', to: '/c/products', color: '#237A54', bg: '#E6F5EE' },
  { icon: 'grid', label: '资源池', to: '/c/pool', color: '#7C5CD6', bg: '#F0EBFC' },
  { icon: 'chart', label: '数据看板', to: '/creator/dashboard', color: '#C9A23F', bg: '#FBF4E2' },
];

export default function MHomePage() {
  const navigate = useNavigate();
  const { data: ov, loading, error, reload } = useAsync<CreatorOverview>(() => api.creator.overview(), []);

  if (loading) return <Loading text="正在加载总览…" />;
  if (error || !ov) {
    return (
      <div className="mc-card">
        <MEmpty icon="home" title="总览加载失败" desc={error || '后端未连接'}
          action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重新加载</button>} />
      </div>
    );
  }

  const counts = ov.counts || {};
  const kpi = ov.kpi || {};
  const welcome = ov.welcome || {};

  const kpis = [
    { label: '橱窗在售', val: `${counts.productOnSale ?? '—'}`, sub: `共上架 ${counts.windowApproved ?? '—'} 件`, icon: 'store' as IconName, color: '#D44771' },
    { label: '近30天成交额', val: `¥${fmtMoney(kpi.revenue30)}`, sub: `${kpi.orders ?? 0} 单`, icon: 'chart' as IconName, color: '#C9A23F' },
    { label: '转化率', val: `${kpi.conversion ?? '—'}%`, sub: `${kpi.views ?? 0} 次浏览`, icon: 'trending' as IconName, color: '#3B82F6' },
    { label: '预估佣金', val: `¥${fmtMoney(kpi.estCommission)}`, sub: '佣金区间 2%-10%', icon: 'wallet' as IconName, color: '#237A54' },
  ];

  return (
    <div>
      {/* 欢迎卡 */}
      <div className="mc-hero">
        <div className="hi">你好，{welcome.nickname || '创作者'} 👋</div>
        <div className="desc">
          从设计文件到商品变现：素材库导入 → 发推文验证市场 → 达标自动入池 → 橱窗审核 → AI 生成详情上架商城。
          {typeof welcome.productCount === 'number' && <> 当前在售商品 <b>{welcome.productCount}</b> 件。</>}
        </div>
        <div className="counts">
          <span>素材 {counts.materials ?? 0}</span>
          <span>作品 {counts.works ?? 0}</span>
          <span>推文 {counts.posts ?? 0}</span>
          <span>资源池 {counts.poolTotal ?? 0}</span>
          <span>今日订单 {counts.orderToday ?? 0}</span>
        </div>
      </div>

      {/* KPI 2×2 */}
      <div className="mc-kpi-grid" style={{ marginTop: 10 }}>
        {kpis.map((k) => (
          <div className="mc-kpi" key={k.label}>
            <div className="k-label"><Icon name={k.icon} size={14} color={k.color} />{k.label}</div>
            <div className="k-val" style={{ color: '#262A31' }}>{k.val}</div>
            <div className="k-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 快捷宫格 */}
      <div className="mc-card" style={{ marginTop: 10 }}>
        <MCardHd icon="sparkle" title="快捷操作" />
        <div className="mc-grid">
          {SHORTCUTS.map((s) => (
            <button key={s.label} className="mc-grid-item" onClick={() => navigate(s.to)}>
              <span className="ico" style={{ background: s.bg, color: s.color }}>
                <Icon name={s.icon} size={19} />
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 待办清单 */}
      <div className="mc-card" style={{ marginTop: 10 }}>
        <MCardHd icon="clock" title="待办清单" right={<span className="c-pill">{ov.todo?.length || 0} 项</span>} />
        {!ov.todo?.length && (
          <MEmpty icon="check-circle" title="太棒了，暂无待办" desc="有新进展（入池 / 审核结果 / 可提现）会出现在这里" />
        )}
        {(ov.todo || []).map((t, i) => {
          const meta = TODO_META[t.type] || { icon: 'bell' as IconName, badge: 'c-badge-blue', label: '去处理', tone: '#3B82F6' };
          return (
            <button key={i} className="row" style={{
              width: '100%', gap: 10, padding: '11px 0', textAlign: 'left',
              borderBottom: i < (ov.todo?.length || 0) - 1 ? '1px dashed #ECEFF3' : 'none',
            }} onClick={() => navigate(mcLink(t.link))}>
              <span style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${meta.tone}18`, color: meta.tone,
              }}>
                <Icon name={meta.icon} size={16} />
              </span>
              <span className="flex-1" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>{t.text}</span>
              <span className={`c-badge ${meta.badge}`} style={{ flexShrink: 0 }}>{meta.label}</span>
              <Icon name="chevron-right" size={14} color="#C0C4CC" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
