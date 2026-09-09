import React from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

/* ---------- Avatar ---------- */
export function Avatar({ src, size = 40, name, ring, style }: {
  src?: string; size?: number; name?: string; ring?: boolean; style?: React.CSSProperties;
}) {
  const [err, setErr] = React.useState(false);
  if (!src || err) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          background: 'linear-gradient(135deg,#F3B8CB,#E85C87)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: size * 0.4, flexShrink: 0, ...style,
        }}
      >
        {(name || '织').slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={src} alt={name || ''}
      style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
        border: ring ? '2px solid #fff' : 'none',
        boxShadow: ring ? '0 0 0 2px var(--brand)' : '0 1px 3px rgba(0,0,0,.12)',
        ...style,
      }}
      onError={() => setErr(true)}
    />
  );
}

/* ---------- Tag ---------- */
const TAG_VARIANTS: Record<string, string> = {
  primary: 'tag tag-primary', gold: 'tag tag-gold', gray: 'tag tag-gray',
  success: 'tag tag-success', danger: 'tag tag-danger', info: 'tag tag-info', line: 'tag tag-line',
};
export function Tag({ children, variant = 'primary', icon, className }: {
  children: React.ReactNode; variant?: 'primary' | 'gold' | 'gray' | 'success' | 'danger' | 'info' | 'line'; icon?: IconName; className?: string;
}) {
  return (
    <span className={`${TAG_VARIANTS[variant]} ${className || ''}`}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/* ---------- 价格 ---------- */
export function Price({ value, size = 16, symbol = true }: { value: number; size?: number; symbol?: boolean }) {
  const s = value >= 1000 ? value.toLocaleString('zh-CN') : value.toFixed(value % 1 === 0 ? 0 : 2);
  return (
    <span className="price" style={{ fontSize: size }}>
      {symbol && <span className="price-symbol">¥</span>}{s}
    </span>
  );
}

/* ---------- 空状态 ---------- */
export function EmptyState({ icon = 'bag', title, desc, action }: {
  icon?: IconName; title: string; desc?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--text-3)' }}>
      <div style={{
        width: 84, height: 84, margin: '0 auto 16px', borderRadius: '50%',
        background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={36} color="var(--text-3)" />
      </div>
      <div style={{ fontSize: 15, color: 'var(--text-2)', fontWeight: 600 }}>{title}</div>
      {desc && <div style={{ fontSize: 13, marginTop: 6 }}>{desc}</div>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

/* ---------- 区块标题 ---------- */
export function SectionHeader({ title, extra, onClick }: {
  title: React.ReactNode; extra?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}>
      <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
        {title}
      </div>
      {extra && (onClick ? (
        <button onClick={onClick} className="row" style={{ fontSize: 12.5, color: 'var(--text-3)', gap: 2 }}>
          {extra}<Icon name="chevron-right" size={13} />
        </button>
      ) : (
        <span className="row" style={{ fontSize: 12, color: 'var(--text-3)' }}>{extra}</span>
      ))}
    </div>
  );
}

/* ---------- 认证徽章 ---------- */
const LEVEL_META: Record<number, { label: string; icon: IconName; color: string; bg: string }> = {
  0: { label: '新手', icon: 'sparkle', color: '#6B6470', bg: '#F1EDE9' },
  1: { label: '设计学徒', icon: 'award', color: '#9A7A1E', bg: '#FBF4E2' },
  2: { label: '设计师', icon: 'vip', color: '#B4547A', bg: '#FBEDF2' },
  3: { label: '资深设计师', icon: 'crown', color: '#8A5A00', bg: '#F9EFD8' },
};
export function CertBadge({ level }: { level: number }) {
  const m = LEVEL_META[level] || LEVEL_META[0];
  return (
    <span className="row" style={{ gap: 3, fontSize: 10.5, fontWeight: 600, color: m.color, background: m.bg, borderRadius: 99, padding: '2px 7px', lineHeight: 1.3 }}>
      <Icon name={m.icon} size={11} />{m.label}
    </span>
  );
}

/* ---------- 数据统计格 ---------- */
export function StatCell({ label, value, sub, color }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{label}{sub && <span style={{ marginLeft: 2 }}>{sub}</span>}</div>
    </div>
  );
}
