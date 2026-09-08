/* ============================================================================
 * /creator/dashboard 变现数据看板（桌面 BI 规范）
 * 时间范围 7/30/90 + 单品筛选 + 说明；KPI 卡 → 成交额&订单折线 | 商品销量柱 →
 * 退货趋势（超阈值红标）| 渠道饼图 → 明细表（可排序）→ 资源池重复度提示
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { api } from '../../api/client';
import type { DashboardData, DashboardRow } from '../../api/types';
import { fmtCount, fmtMoney } from '../../components/shared/utils';
import { LineChart, BarChart, DonutChart } from '../../components/shared/charts';
import { useAsync, CState, Loading } from './_shared';

const SORTABLE: { key: string; label: string }[] = [
  { key: 'amount', label: '成交额' }, { key: 'views', label: '浏览' }, { key: 'orders', label: '订单' },
  { key: 'conversion', label: '转化率' }, { key: 'sales', label: '销量' }, { key: 'returnRate', label: '退货率' }, { key: 'commissionRate', label: '佣金率' },
];

export default function DashboardPage() {
  const [days, setDays] = React.useState(30);
  const [productId, setProductId] = React.useState<number | ''>('');
  const [showExplain, setShowExplain] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 }>({ key: 'amount', dir: -1 });
  const [products, setProducts] = React.useState<{ id: number; title: string; status?: string }[]>([]);

  const { data: d, loading, error, reload } = useAsync<DashboardData>(
    () => api.creator.dashboard({ days, productId: productId || undefined }),
    [days, productId],
  );

  React.useEffect(() => {
    api.products.myAll({ pageSize: 100 }).then((r) => setProducts((r?.list || []).map((p) => ({ id: p.id, title: p.title, status: p.status })))).catch(() => {});
  }, []);

  const kpis: { icon: IconName; label: string; value: string; sub?: string }[] = d ? [
    { icon: 'store', label: '橱窗商品', value: `${d.kpis?.windowCount ?? 0}`, sub: 'onSale' },
    { icon: 'wallet', label: '成交额', value: `¥${fmtMoney(d.kpis?.revenue30)}`, sub: `${d.kpis?.orders ?? 0} 笔有效订单` },
    { icon: 'trending', label: '转化率', value: `${d.kpis?.conversion ?? 0}%`, sub: `${d.kpis?.views ?? 0} 次浏览` },
    { icon: 'refresh', label: '退货率', value: `${d.kpis?.returnRate ?? 0}%`, sub: d.kpis?.returnRate != null && d.kpis.returnRate > 6 ? '⚠️ 高于 6% 触发佣金下浮' : '低于 6% 阈值' },
    { icon: 'chart', label: '预估佣金', value: `¥${fmtMoney(d.kpis?.estCommission)}`, sub: '按各商品佣金率估算' },
  ] : [];

  const trend = d?.trend || [];
  const labels = trend.map((t) => t.date);
  const retTrend = d?.returnTrend || [];
  const hotRet = retTrend.filter((r) => r.rate > 6);
  const productCompare = d?.productCompare || [];
  const channel = d?.channel || [];
  const rows: DashboardRow[] = [...(d?.rows || [])];

  const sortedRows = [...rows];
  if (sort.key) {
    sortedRows.sort((a, b) => {
      const va = Number((a as unknown as Record<string, unknown>)[sort.key] ?? 0);
      const vb = Number((b as unknown as Record<string, unknown>)[sort.key] ?? 0);
      return (va - vb) * sort.dir;
    });
  }
  const clickSort = (key: string) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'title' ? 1 : -1 }));

  return (
    <div>
      {/* 工具条 */}
      <div className="c-card">
        <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="calendar" size={15} color="var(--brand)" />
            <b style={{ fontSize: 14 }}>变现数据看板</b>
            {d?.range && <span className="c-pill">{d.range.from} ~ {d.range.to}</span>}
          </div>
          <div className="flex-1" />
          <div className="c-tabs">
            {[7, 30, 90].map((x) => (
              <button key={x} className={`c-tab ${days === x ? 'on' : ''}`} onClick={() => setDays(x)}>{x} 天</button>
            ))}
          </div>
          <select className="c-select" style={{ width: 220 }} value={String(productId)} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">全部商品</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button className="c-btn c-btn-sm c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />刷新</button>
          <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setShowExplain((v) => !v)}>
            <Icon name="help-circle" size={13} />说明
          </button>
        </div>
        {showExplain && d?.explain?.length ? (
          <div style={{ marginTop: 10, fontSize: 11.8, color: '#6B7180', lineHeight: 2, background: '#F7F8FA', borderRadius: 10, padding: '10px 12px' }}>
            {(d.explain || []).map((x, i) => <div key={i}>· {x}</div>)}
          </div>
        ) : null}
      </div>

      {loading && <div className="c-card" style={{ marginTop: 12 }}><Loading text="聚合数据中…" /></div>}
      {!loading && error && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <CState danger icon="chart" title="看板加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重试</button>} />
        </div>
      )}
      {!loading && d && (
        <>
          {/* KPI */}
          <div className="kpi-row" style={{ marginTop: 12 }}>
            {kpis.map((k) => (
              <div className="bi-card" key={k.label}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--creator-text-2)' }}>{k.label}</span>
                  <Icon name={k.icon} size={16} color={k.sub?.includes('⚠️') ? 'var(--danger)' : 'var(--brand)'} />
                </div>
                <div className="kpi-num" style={{ fontSize: 21, marginTop: 7 }}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* 重复度警示 */}
          {d.poolDup && (
            <div className={`c-notice ${(d.poolDup.dup || 0) >= 3 ? 'warn' : 'ok'}`} style={{ marginTop: 12 }}>
              <Icon name="layers" size={15} />
              <span>{d.poolDup.notice}</span>
            </div>
          )}

          {/* 折线 + 柱状 */}
          <div className="kpi-row" style={{ marginTop: 12, gridTemplateColumns: '1.5fr 1fr' }}>
            <div className="bi-card">
              <div className="bi-card-hd"><span className="bi-card-title">成交额 & 订单量</span><span className="bi-card-extra">近 {days} 天</span></div>
              {trend.length ? (
                <LineChart labels={labels} series={[
                  { name: '成交额(¥)', data: trend.map((t) => t.amount) },
                  { name: '订单量', data: trend.map((t) => t.orders), color: '#3B82F6' },
                ]} height={230} />
              ) : <CState icon="chart" title="暂无趋势数据" />}
            </div>
            <div className="bi-card">
              <div className="bi-card-hd"><span className="bi-card-title">商品销量对比</span><span className="bi-card-extra">{productCompare.length} 件</span></div>
              {productCompare.length ? (
                <BarChart labels={productCompare.map((p) => p.title)} values={productCompare.map((p) => p.sales)} height={230} unit="销量" />
              ) : <CState icon="chart" title="暂无商品对比" />}
            </div>
          </div>

          {/* 退货趋势 + 渠道 */}
          <div className="kpi-row" style={{ marginTop: 12, gridTemplateColumns: '1.5fr 1fr' }}>
            <div className="bi-card">
              <div className="bi-card-hd">
                <span className="bi-card-title">退货率趋势</span>
                {hotRet.length ? (
                  <span className="c-badge c-badge-red"><Icon name="fire" size={11} />{hotRet.length} 天超过 6% 阈值</span>
                ) : <span className="c-badge c-badge-green">均在阈值内</span>}
              </div>
              {retTrend.length ? (
                <div>
                  <LineChart labels={retTrend.map((r) => r.date)} series={[{ name: '退货率(%)', data: retTrend.map((r) => r.rate), color: hotRet.length ? '#E5484D' : '#34A36F' }]} height={220} />
                  <div className="c-hint" style={{ fontSize: 11.5, marginTop: 8 }}>
                    阈值 6%：超过即对该商品佣金 −1.5%/档（超过 10% 再降一档）。超阈值日期：{hotRet.length ? hotRet.map((r) => r.date).slice(0, 6).join('、') : '无'}。
                  </div>
                </div>
              ) : <CState icon="chart" title="暂无退货数据" />}
            </div>
            <div className="bi-card">
              <div className="bi-card-hd"><span className="bi-card-title">渠道来源</span><span className="bi-card-extra">成交金额占比</span></div>
              {channel.length ? (
                <DonutChart items={channel.map((c) => ({ name: c.name, value: c.value }))} centerTitle="总渠道" centerValue={`${channel.reduce((s, c) => s + c.value, 0)}%`} />
              ) : <CState icon="chart" title="暂无渠道数据" />}
            </div>
          </div>

          {/* 明细表 */}
          <div className="c-card" style={{ marginTop: 12 }}>
            <div className="c-card-hd">
              <span className="c-card-title">商品明细</span>
              <span className="c-hint">点击列头排序 · 转化率 = 订单/浏览</span>
            </div>
            {!sortedRows.length ? <CState icon="search" title="该筛选下暂无明细" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="c-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>商品</th>
                      {SORTABLE.map((s) => (
                        <th key={s.key} className="c-sortable" onClick={() => clickSort(s.key)}>
                          {s.label} {sort.key === s.key ? (sort.dir === -1 ? '↓' : '↑') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.productId}>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            {r.cover && <img src={r.cover} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} style={{ width: 34, height: 42, objectFit: 'cover', borderRadius: 7 }} />}
                            <span className="ellipsis" style={{ maxWidth: 190, display: 'block' }}>#{r.productId} {r.title}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>¥{fmtMoney(r.amount)}</td>
                        <td>{fmtCount(r.views)}</td>
                        <td>{r.orders}</td>
                        <td>{r.conversion}%</td>
                        <td>{r.sales}</td>
                        <td><span style={{ color: r.returnRate > 6 ? 'var(--danger)' : undefined, fontWeight: r.returnRate > 6 ? 800 : 500 }}>{r.returnRate}%</span></td>
                        <td><span className="c-badge c-badge-brand">{r.commissionRate}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
