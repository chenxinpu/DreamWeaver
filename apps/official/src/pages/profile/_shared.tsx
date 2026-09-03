/* ============ 织梦 · 我的模块共享小组件（仅本目录使用） ============ */
import { useState } from 'react';
import Icon, { type IconName } from '../../components/Icon';
import { Price } from '../../components/ui';
import type { Work } from '../../data/types';

/** 千分位格式化 */
export const fmt = (n: number) => n.toLocaleString('zh-CN');

/** 应用内"今天"（与 mock 时间线一致） */
export const TODAY = '2026-09-01';

/** 触控反馈类：点击缩放 + 透明度（配合各页根节点的 <TapStyle/>） */
export function TapStyle() {
  return (
    <style>{`.tap{transition:opacity .12s ease,transform .12s ease;cursor:pointer}.tap:active{opacity:.8;transform:scale(.985)}`}</style>
  );
}

/** 图片加载失败兜底 */
export function SafeImg({ src, alt = '', style }: { src?: string; alt?: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg,#F3B8CB,#E85C87)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
        }}
      >
        <Icon name="sparkle" size={Math.min(Number(style?.width) / 3 || 22, 30)} color="rgba(255,255,255,.85)" />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" style={{ objectFit: 'cover', ...style }} onError={() => setErr(true)} />
  );
}

/** 双列作品卡片（我的作品集 / 收藏用） */
export function WorkCard({ work, onClick, foot }: { work: Work; onClick?: () => void; foot?: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 'var(--r-md)', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(40,25,32,.05)', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <SafeImg src={work.cover} alt={work.title} style={{ width: '100%', aspectRatio: '3 / 4', display: 'block' }} />
      <div style={{ padding: '8px 10px 10px' }}>
        <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{work.title}</div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Price value={work.price} size={13} />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>销量 {work.sales}</span>
        </div>
        {foot}
      </div>
    </div>
  );
}

/** 设置/列表通用行 */
export function Row({ icon, iconColor, iconBg, label, value, danger, onClick, arrow = true, children }: {
  icon?: IconName; iconColor?: string; iconBg?: string; label: React.ReactNode; value?: React.ReactNode;
  danger?: boolean; onClick?: () => void; arrow?: boolean; children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="row" style={{ width: '100%', padding: '13px 0', gap: 12, textAlign: 'left' }}>
      {icon && (
        <span style={{
          width: 32, height: 32, borderRadius: 10, background: iconBg || 'var(--bg-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={icon} size={17} color={iconColor || 'var(--text-2)'} />
        </span>
      )}
      <span className="flex-1" style={{ fontSize: 14.5, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)' }}>{label}</span>
      {value && <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{value}</span>}
      {children}
      {arrow && <Icon name="chevron-right" size={16} color="var(--text-3)" />}
    </button>
  );
}

/** 开关（div 实现，避免嵌套在 Row 按钮内） */
export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 44, height: 26, borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer',
        background: on ? 'var(--brand-grad)' : 'var(--bg-deep)', transition: 'background .2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s ease',
      }} />
    </div>
  );
}
