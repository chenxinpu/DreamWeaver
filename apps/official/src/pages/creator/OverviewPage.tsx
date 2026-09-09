/* ============================================================================
 * /creator 总览 —— 欢迎卡 + KPI + 待办 + 最近订单 + 快捷操作 + 池引擎 meta
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { api } from '../../api/client';
import type { CreatorOverview } from '../../api/types';
import { fmtMoney } from '../../components/shared/utils';
import { useAsync, CState } from './_shared';

const TODO_META: Record<string, { icon: IconName; cls: string }> = {
  pool: { icon: 'grid', cls: 'c-badge-brand' },
  audit: { icon: 'clock', cls: 'c-badge-blue' },
  reject: { icon: 'close', cls: 'c-badge-red' },
  withdraw: { icon: 'wallet', cls: 'c-badge-gold' },
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data: ov, loading, error, reload } = useAsync<CreatorOverview>(() => api.creator.overview(), []);

  if (loading) return <div className="c-card"><CState icon="home" title="正在加载总览…" /></div>;
  if (error || !ov) {
    return (
      <div className="c-card">
        <CState danger icon="home" title="总览加载失败"
          desc={error || '后端未连接'}
          action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={14} />重新加载</button>} />
      </div>
    );
  }

  const counts = ov.counts || {};
  const kpi = ov.kpi || {};
  const welcome = ov.welcome || {};

  const quick: { icon: IconName; label: string; desc: string; to: string; primary?: boolean }[] = [
    { icon: 'upload', label: '导入素材', desc: 'DXF / OBJ / SVG', to: '/creator/library' },
    { icon: 'send', label: '发推文', desc: '3D 图 + 打版图', to: '/creator/publish', primary: true },
    { icon: 'store', label: '上橱窗', desc: '提交材料审核', to: '/creator/window' },
    { icon: 'chart', label: '看数据', desc: 'BI 变现看板', to: '/creator/dashboard' },
  ];

  const kpiCards: { icon: IconName; label: string; value: React.ReactNode; sub?: string; color?: string }[] = [
    { icon: 'store', label: '橱窗在售', value: counts.productOnSale ?? '—', sub: `共上架 ${counts.windowApproved ?? '—'} 件` },
    { icon: 'chart', label: '近30天成交额', value: `¥${fmtMoney(kpi.revenue30)}`, sub: `${kpi.orders ?? 0} 单` },
    { icon: 'trending', label: '转化率', value: `${kpi.conversion ?? '—'}%`, sub: `${kpi.views ?? 0} 次浏览` },
    { icon: 'wallet', label: '预估佣金', value: `¥${fmtMoney(kpi.estCommission)}`, sub: '佣金区间 2%-10%' },
  ];

  return (
    <div>
      {/* 欢迎卡 */}
      <div className="welcome-card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800 }}>你好，{welcome.nickname || '创作者'} 👋</div>
            <div style={{ opacity: .85, fontSize: 12.5, marginTop: 6, lineHeight: 1.8, maxWidth: 560 }}>
              从设计文件到商品变现：素材库导入 → 发推文验证市场 → 达标自动入池 → 橱窗审核 → AI 生成详情上架商城。
              {typeof welcome.productCount === 'number' && <span> 当前在售商品 <b>{welcome.productCount}</b> 件。</span>}
            </div>
            <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
              {quick.map((q) => (
                <button key={q.label} className="quick-btn" onClick={() => navigate(q.to)}>
                  <Icon name={q.icon} size={15} />
                  {q.label}
                  <span style={{ opacity: .75, fontSize: 11, fontWeight: 500 }}>{q.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, opacity: .8, lineHeight: 2 }}>
            <div>素材 {counts.materials ?? 0} · 作品 {counts.works ?? 0} · 推文 {counts.posts ?? 0}</div>
            <div>资源池 {counts.poolTotal ?? 0} · 今日订单 {counts.orderToday ?? 0}</div>
          </div>
        </div>
      </div>

      {/* KPI 四卡 */}
      <div className="kpi-row" style={{ marginTop: 14 }}>
        {kpiCards.map((k) => (
          <div className="bi-card" key={k.label}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: 'var(--creator-text-2)' }}>{k.label}</span>
              <Icon name={k.icon} size={17} color="var(--brand)" />
            </div>
            <div className="kpi-num" style={{ marginTop: 7 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 待办清单 */}
      <div className="c-card" style={{ marginTop: 12 }}>
        <div className="c-card-hd">
          <span className="c-card-title">待办清单</span>
          <span className="c-pill">{ov.todo?.length || 0} 项</span>
        </div>
        {!ov.todo?.length && (
          <CState icon="check-circle" title="太棒了，暂无待办" desc="有新进展（入池 / 审核结果 / 可提现）会出现在这里" />
        )}
        <div>
          {(ov.todo || []).map((t, i) => {
            const meta = TODO_META[t.type] || { icon: 'bell', cls: 'c-badge-blue' };
            return (
              <button key={i} className="row" style={{ width: '100%', gap: 11, padding: '11px 4px', borderBottom: i < (ov.todo?.length || 0) - 1 ? '1px dashed #ECEFF3' : 'none', textAlign: 'left' }} onClick={() => navigate(t.link)}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={meta.icon} size={16} />
                </span>
                <span className="flex-1" style={{ fontSize: 12.8, fontWeight: 600 }}>{t.text}</span>
                <span className={`c-badge ${meta.cls}`} style={{ flexShrink: 0 }}>{t.type === 'pool' ? '资源池' : t.type === 'audit' ? '审核中' : t.type === 'reject' ? '需处理' : '去处理'}</span>
                <Icon name="chevron-right" size={14} color="#C0C4CC" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
