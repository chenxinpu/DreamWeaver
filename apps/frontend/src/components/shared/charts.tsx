/* ============================================================================
 * charts.tsx —— 无依赖 SVG 图表（供创作者平台桌面 BI 复用）
 * LineChart / BarChart / DonutChart / KpiCard / SparkLine / DataTable
 * 数据均可为空（渲染空态）；配色默认走品牌渐变。
 * ==========================================================================*/
import React from 'react';
import Icon from '../Icon';
import type { IconName } from '../Icon';

const BRAND_COLORS = ['#E85C87', '#F27BA0', '#D44771', '#C9A23F', '#3B82F6', '#34A36F', '#8B5CF6', '#F59E0B'];
const AXIS = '#E5DED8';

export interface LineSeries { name: string; color?: string; data: number[] }

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * p;
}

/* ------------------------------ LineChart ------------------------------ */
export function LineChart({ labels, series, height = 220, area = true, showLegend = true, unit = '' }: {
  labels: string[]; series: LineSeries[]; height?: number; area?: boolean; showLegend?: boolean; unit?: string;
}) {
  const W = 560;
  const padL = 46, padR = 14, padT = 18, padB = 28;
  const iw = W - padL - padR;
  const ih = height - padT - padB;
  const all = series.flatMap((s) => s.data);
  const max = niceMax(Math.max(...all, 1) * 1.15);
  const n = Math.max(labels.length, ...series.map((s) => s.data.length), 1);
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;

  const path = (data: number[]) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const gridYs = [0, 0.5, 1].map((f) => padT + ih - f * ih);

  return (
    <div style={{ width: '100%' }}>
      {showLegend && (
        <div className="row" style={{ gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
          {series.map((s, i) => (
            <span key={s.name} className="row" style={{ gap: 5, fontSize: 11.5, color: 'var(--text-2)' }}>
              <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color || BRAND_COLORS[i % BRAND_COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} preserveAspectRatio="xMidYMid meet">
        {gridYs.map((gy, gi) => (
          <g key={gi}>
            <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke={AXIS} strokeWidth={1} strokeDasharray={gi === 0 ? '0' : '4 4'} />
            <text x={padL - 6} y={gy + 3.5} textAnchor="end" fontSize={9.5} fill="#A8A1AC">{Math.round(max * (1 - gi * 0.5))}</text>
          </g>
        ))}
        {labels.map((lb, i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={9.5} fill="#A8A1AC">{lb}</text>
        ))}
        {series.map((s, si) => {
          const d = path(s.data);
          const color = s.color || BRAND_COLORS[si % BRAND_COLORS.length];
          const areaPath = s.data.length > 1
            ? `${d} L${x(s.data.length - 1).toFixed(1)},${padT + ih} L${x(0).toFixed(1)},${padT + ih} Z`
            : '';
          return (
            <g key={s.name}>
              {area && areaPath && <path d={areaPath} fill={color} opacity={0.09} />}
              <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {s.data.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill="#fff" stroke={color} strokeWidth={1.8} />
              ))}
            </g>
          );
        })}
        {unit && <text x={padL} y={14} fontSize={10} fill="#A8A1AC">{unit}</text>}
      </svg>
    </div>
  );
}

/* ------------------------------ BarChart ------------------------------ */
export function BarChart({ labels, values, colors, height = 220, unit = '' }: {
  labels: string[]; values: number[]; colors?: (string | undefined)[]; height?: number; unit?: string;
}) {
  const W = 560;
  const padL = 46, padR = 14, padT = 18, padB = 30;
  const iw = W - padL - padR;
  const ih = height - padT - padB;
  const max = niceMax(Math.max(...values, 1) * 1.12);
  const n = Math.max(labels.length, values.length, 1);
  const bw = Math.min(52, (iw / n) * 0.62);
  const gap = iw / n;
  const gridYs = [0, 0.5, 1].map((f) => padT + ih - f * ih);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }}>
      {gridYs.map((gy, gi) => (
        <g key={gi}>
          <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke={AXIS} strokeWidth={1} strokeDasharray={gi === 0 ? '0' : '4 4'} />
          <text x={padL - 6} y={gy + 3.5} textAnchor="end" fontSize={9.5} fill="#A8A1AC">{Math.round(max * (1 - gi * 0.5))}</text>
        </g>
      ))}
      {values.map((v, i) => {
        const bh = (v / max) * ih;
        const bx = padL + gap * i + (gap - bw) / 2;
        const color = (colors && colors[i]) || BRAND_COLORS[i % BRAND_COLORS.length];
        const by = padT + ih - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={Math.max(0, bh)} rx={Math.min(5, bw / 3)} fill={color} opacity={0.88} />
            {labels[i] !== undefined && (
              <text x={bx + bw / 2} y={height - 10} textAnchor="middle" fontSize={9.5} fill="#A8A1AC">
                {labels[i].length > 6 ? labels[i].slice(0, 6) + '…' : labels[i]}
              </text>
            )}
            {v > 0 && bh > 16 && <text x={bx + bw / 2} y={by + 13} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={600}>{v}</text>}
          </g>
        );
      })}
      {unit && <text x={padL} y={14} fontSize={10} fill="#A8A1AC">{unit}</text>}
    </svg>
  );
}

/* ------------------------------ DonutChart ------------------------------ */
export function DonutChart({ items, size = 168, thickness = 24, centerTitle, centerValue }: {
  items: { name: string; value: number; color?: string }[]; size?: number; thickness?: number;
  centerTitle?: string; centerValue?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const R = (size - thickness) / 2;
  const C = 2 * Math.PI * R;
  const cx = size / 2, cy = size / 2;
  let acc = 0;

  return (
    <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1EBE7" strokeWidth={thickness} />
        {items.filter((i) => i.value > 0).map((it, idx) => {
          const frac = it.value / total;
          const dash = frac * C;
          const off = -acc * C;
          acc += frac;
          const color = it.color || BRAND_COLORS[idx % BRAND_COLORS.length];
          return (
            <circle key={`${it.name}-${idx}`} cx={cx} cy={cy} r={R} fill="none" stroke={color}
              strokeWidth={thickness} strokeDasharray={`${Math.max(0, dash - 2)} ${C}`} strokeDashoffset={off}
              strokeLinecap="butt" opacity={0.92} />
          );
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 140 }}>
        {centerValue !== undefined && (
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
            {centerValue}
            {centerTitle && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>{centerTitle}</div>}
          </div>
        )}
        <div style={{ marginTop: centerValue !== undefined ? 10 : 0 }}>
          {items.map((it, idx) => {
            const pct = total > 0 ? ((it.value / total) * 100).toFixed(1) : '0';
            const color = it.color || BRAND_COLORS[idx % BRAND_COLORS.length];
            return (
              <div key={it.name} className="row" style={{ gap: 8, padding: '5px 0' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span className="flex-1 ellipsis" style={{ fontSize: 12, color: 'var(--text-2)' }}>{it.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ SparkLine ------------------------------ */
export function SparkLine({ data, color = '#E85C87', width = 120, height = 40 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data?.length) return <div style={{ width, height, color: 'var(--text-3)', fontSize: 11, display: 'flex', alignItems: 'center' }}>暂无数据</div>;
  const max = niceMax(Math.max(...data, 1));
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, max * 0.1, 1);
  const x = (i: number) => (data.length <= 1 ? width / 2 : (i / (data.length - 1)) * (width - 4)) + 2;
  const y = (v: number) => 3 + (height - 8) * (1 - (v - min) / range);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(data.length - 1).toFixed(1)},${height - 2} L${x(0).toFixed(1)},${height - 2} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.4} fill={color} />
    </svg>
  );
}

/* ------------------------------ KpiCard ------------------------------ */
export function KpiCard({ title, value, unit, sub, icon, color, delta, trend }: {
  title: string; value: React.ReactNode; unit?: string; sub?: string; icon?: IconName;
  color?: string; delta?: number; trend?: 'up' | 'down';
}) {
  const main = color || 'var(--brand)';
  return (
    <div className="card kpi-card" style={{ padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{title}</span>
        {icon && (
          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${main}1A`, color: main }}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{unit}</span>}
      </div>
      <div className="row" style={{ marginTop: 6, gap: 8 }}>
        {typeof delta === 'number' && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: trend === 'down' ? 'var(--success)' : trend === 'up' ? 'var(--danger)' : 'var(--text-3)' }}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : ''}{Math.abs(delta)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ------------------------------ DataTable ------------------------------ */
export interface DataColumn<T> { key: string; title: string; width?: number; align?: 'left' | 'center' | 'right'; render?: (row: T) => React.ReactNode }
export function DataTable<T extends Record<string, unknown>>({ columns, rows, empty }: {
  columns: DataColumn<T>[]; rows: T[]; empty?: string;
}) {
  if (!rows.length) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
        {empty || '暂无数据'}
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{
                textAlign: c.align || 'left', padding: '9px 10px', background: '#F7F4F1',
                color: 'var(--text-2)', fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap',
                width: c.width, borderBottom: '1px solid var(--line)',
              }}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #F3EEE9' }}>
              {columns.map((c) => (
                <td key={c.key} style={{
                  textAlign: c.align || 'left', padding: '10px', color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
                }}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { BRAND_COLORS, niceMax };
