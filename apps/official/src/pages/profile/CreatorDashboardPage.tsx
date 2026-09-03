/* ============ 织梦 · 创作者后台（KPI 数据面板） ============ */
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Tag } from '../../components/ui';
import { Segmented, Sheet } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { dashboard, workById } from '../../data/mock';
import { fmt, SafeImg, TapStyle } from './_shared';
import type { KpiWork } from '../../data/types';

type Period = 'today' | '7d' | '30d';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: '7d', label: '近7日' },
  { value: '30d', label: '近30日' },
];

/* ---------- 折线图（渐变面积 + 圆点 + 日期标签） ---------- */
function LineChart({ data, height = 148, suffix = '' }: { data: { date: string; value: number }[]; height?: number; suffix?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 330, H = height, padL = 6, padR = 6, padT = 24, padB = 22;
  const max = Math.max(...data.map((d) => d.value)) * 1.25;
  const iw = W - padL - padR, ih = H - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * iw,
    y: padT + (1 - d.value / max) * ih,
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${padL},${padT + ih} ${line} ${pts[pts.length - 1].x},${padT + ih}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E85C87" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#E85C87" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((r) => (
        <line key={r} x1={padL} x2={W - padR} y1={padT + ih * r} y2={padT + ih * r} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      <polygon points={area} fill={`url(#grad-${uid})`} />
      <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-2)">{data[i].value}{suffix}</text>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--brand)" strokeWidth="2" />
        </g>
      ))}
      {pts.map((p, i) => (
        <text key={`t${i}`} x={p.x} y={H - 7} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">{data[i].date.slice(3)}</text>
      ))}
    </svg>
  );
}

/* ---------- 柱状图（30 天） ---------- */
function BarChart({ data, height = 128 }: { data: { date: string; orders: number }[]; height?: number }) {
  const W = 330, H = height, padT = 14, padB = 20;
  const max = Math.max(...data.map((d) => d.orders)) * 1.2;
  const ih = H - padT - padB;
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {data.map((d, i) => {
        const h = (d.orders / max) * ih;
        const hot = d.orders >= max * 0.78;
        return (
          <g key={i}>
            <rect x={i * bw + bw * 0.25} y={padT + ih - h} width={bw * 0.5} height={Math.max(h, 2)} rx="2.5" fill={hot ? 'var(--brand)' : 'rgba(232,92,135,.28)'} />
            {i % 5 === 0 && <text x={i * bw + bw * 0.5} y={H - 6} textAnchor="middle" fontSize="8.5" fill="var(--text-3)">{d.date.slice(3)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- 饼图（渠道分布） ---------- */
function PieChart({ data, size = 140 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const c = size / 2, r = size / 2 - 3;
  const cum = data.reduce<number[]>((arr, d) => [...arr, (arr[arr.length - 1] || 0) + d.value], []);
  const segs = data.map((d, i) => {
    const a0 = ((i === 0 ? 0 : cum[i - 1]) / total) * Math.PI * 2;
    const a1 = (cum[i] / total) * Math.PI * 2;
    const p = (a: number) => [c + r * Math.cos(a - Math.PI / 2), c + r * Math.sin(a - Math.PI / 2)] as const;
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { path: `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`, color: d.color };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block', flexShrink: 0 }}>
      {segs.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      <circle cx={c} cy={c} r={r * 0.55} fill="#fff" />
      <text x={c} y={c - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text)">100%</text>
      <text x={c} y={c + 14} textAnchor="middle" fontSize="9" fill="var(--text-3)">总流量</text>
    </svg>
  );
}

/* ---------- 明细内迷你折线 ---------- */
function MiniLine({ values }: { values: number[] }) {
  const W = 300, H = 62, padT = 6, padB = 6;
  const max = Math.max(...values) * 1.15, min = Math.min(...values) * 0.85;
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: padT + (1 - (v - min) / range) * (H - padT - padB),
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--brand)" />)}
    </svg>
  );
}

/* ---------- 作品明细 ---------- */
function WorkDetailSheet({ work }: { work: KpiWork }) {
  const w = workById(work.id);
  const trend = [2.2, 2.6, 2.5, 2.9, 3.0, 3.1, work.conversionRate];
  return (
    <div>
      <div className="row" style={{ gap: 12 }}>
        <SafeImg src={work.cover} alt={work.title} style={{ width: 76, height: 96, borderRadius: 12 }} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{work.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 5 }}>
            {w ? `${w.category} · ${w.styleTags.slice(0, 3).join(' / ')}` : '—'}
          </div>
          <div className="price" style={{ fontSize: 17, marginTop: 6 }}>¥{fmt(w?.price || 0)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        {[
          ['今日销量', `${work.dailyOrders} 单`],
          ['转化率', `${work.conversionRate}%`],
          ['点击率', `${work.clickRate}%`],
          ['榜单排名', `#${work.rank}`],
          ['月销量', `${work.monthlyOrders} 单`],
          ['退货率', `${work.returnRate}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ background: 'var(--bg-deep)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{k}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>近7日转化率趋势</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>单位 %</span>
        </div>
        <MiniLine values={trend} />
      </div>

      {work.returnRate > 10 ? (
        <div className="row" style={{ gap: 8, marginTop: 14, background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 1.6 }}>
          <Icon name="close" size={16} style={{ flexShrink: 0 }} />
          <span>退货率 {work.returnRate}% 超标（&gt;10%），将影响佣金资格，建议排查版型与质检问题！</span>
        </div>
      ) : (
        <div className="row" style={{ gap: 8, marginTop: 14, background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 10, padding: 12, fontSize: 12.5 }}>
          <Icon name="check-circle" size={16} style={{ flexShrink: 0 }} />
          <span>退货率 {work.returnRate}%（低于10%门槛 ✓），佣金资格正常</span>
        </div>
      )}
    </div>
  );
}

export default function CreatorDashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('today');
  const [detail, setDetail] = useState<KpiWork | null>(null);

  const kpi = useMemo(() => {
    if (period === 'today') {
      return { amount: dashboard.todayAmount, visitors: dashboard.todayVisitors, conv: dashboard.conversionRate, rank: dashboard.rank };
    }
    if (period === '7d') {
      return {
        amount: dashboard.trend7d.reduce((s, d) => s + d.amount, 0),
        visitors: Math.round(dashboard.todayVisitors * 6.7),
        conv: 3.1, rank: 12,
      };
    }
    const orders30 = dashboard.trend30d.reduce((s, d) => s + d.orders, 0);
    return { amount: orders30 * 328, visitors: Math.round(dashboard.todayVisitors * 28.1), conv: 2.9, rank: 9 };
  }, [period]);

  const lastReturnRate = dashboard.returnTrend[dashboard.returnTrend.length - 1].rate;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label || '';

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="创作者后台" />
      <div className="page-body">
        {/* 时间筛选 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        </div>

        {/* KPI 概览 */}
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <Icon name="chart" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>数据概览</span>
            <span className="flex-1" />
            <Tag variant={period === 'today' ? 'primary' : 'gray'}>{periodLabel}</Tag>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--brand-soft)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>成交额</div>
              <div className="price" style={{ fontSize: 21, marginTop: 4 }}>¥{fmt(kpi.amount)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{period === 'today' ? '今日实时' : `${periodLabel}累计`}</div>
            </div>
            {[
              { label: '访客数', value: fmt(kpi.visitors), sub: period === 'today' ? '今日UV' : '周期UV' },
              { label: '转化率', value: `${kpi.conv}%`, sub: '下单转化' },
              { label: '榜单排名', value: `#${kpi.rank}`, sub: '周榜 / 月榜' },
            ].map((s) => (
              <div key={s.label} style={{ borderRadius: 12, background: 'var(--bg-deep)', padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 5 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 近7天成交量趋势 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="row" style={{ gap: 6, fontSize: 14.5, fontWeight: 700 }}><Icon name="chart" size={16} color="var(--brand)" /> 近7天成交量趋势</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>单位：单</span>
          </div>
          <LineChart data={dashboard.trend7d.map((d) => ({ date: d.date, value: d.orders }))} />
        </div>

        {/* 近30天柱状图 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="row" style={{ gap: 6, fontSize: 14.5, fontWeight: 700 }}><Icon name="chart" size={16} color="var(--brand)" /> 近30天成交量</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>共 {dashboard.trend30d.reduce((s, d) => s + d.orders, 0)} 单</span>
          </div>
          <BarChart data={dashboard.trend30d} />
        </div>

        {/* 作品列表 */}
        <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
          <div className="row" style={{ padding: '14px 16px 6px', gap: 6 }}>
            <Icon name="layers" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>作品表现</span>
          </div>
          {dashboard.works.map((w, i) => (
            <div key={w.id}>
              {i > 0 && <div className="divider" style={{ margin: '0 16px' }} />}
              <button className="tap row" style={{ width: '100%', padding: '12px 16px', gap: 10, textAlign: 'left' }} onClick={() => setDetail(w)}>
                <SafeImg src={w.cover} alt={w.title} style={{ width: 48, height: 48, borderRadius: 10 }} />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</div>
                  <div className="row" style={{ gap: 8, marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
                    <span>转化 {w.conversionRate}%</span><span>点击 {w.clickRate}%</span><span>排名 {w.rank}</span><span>退货 {w.returnRate}%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-deep)' }}>
                    {w.dailyOrders}<span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-3)', marginLeft: 2 }}>单/今日</span>
                  </div>
                  <Icon name="chevron-right" size={14} color="var(--text-3)" style={{ marginTop: 5 }} />
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* 退货分析 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="row" style={{ gap: 6, fontSize: 14.5, fontWeight: 700 }}><Icon name="shield" size={16} color="var(--success)" /> 退货率分析</span>
            <Tag variant="success" icon="check">{lastReturnRate}% &lt; 10%</Tag>
          </div>
          <LineChart data={dashboard.returnTrend.map((d) => ({ date: d.date, value: d.rate }))} suffix="%" />
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', background: 'var(--success-soft)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7 }}>
            当前退货率 {lastReturnRate}%，低于 10% 佣金门槛 ✓，佣金资格正常。退货率越低，榜单排名权重越高，继续把控版型与工艺哦～
          </div>
        </div>

        {/* 渠道分布 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <Icon name="share" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>流量渠道分布</span>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <PieChart data={dashboard.channelShare} />
            <div className="flex-1 col" style={{ gap: 12 }}>
              {dashboard.channelShare.map((c) => (
                <div key={c.name} className="row" style={{ gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.name}</span>
                  <span className="flex-1" />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 佣金摘要 */}
        <button className="card tap row" style={{ marginTop: 12, padding: 16, width: '100%', textAlign: 'left', gap: 10 }} onClick={() => navigate('/profile/commission')}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="wallet" size={19} color="#C9A23F" />
          </span>
          <div className="flex-1">
            <div style={{ fontSize: 14, fontWeight: 700 }}>佣金</div>
            <div className="row" style={{ gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>
              <span>可提现 <span className="price">¥{dashboard.commission.withdrawable.toLocaleString('zh-CN')}</span></span>
              <span>待结算 <span className="price">¥{dashboard.commission.pending.toLocaleString('zh-CN')}</span></span>
            </div>
          </div>
          <Icon name="chevron-right" size={16} color="var(--text-3)" />
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 16 }}>数据每日 00:30 更新 · 仅供参考</div>
      </div>

      {/* 作品明细 */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title="作品明细" height="88%">
        {detail && <WorkDetailSheet work={detail} />}
      </Sheet>
    </div>
  );
}
