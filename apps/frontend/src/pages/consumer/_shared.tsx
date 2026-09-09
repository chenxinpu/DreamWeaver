/* ============ 消费者「我的」模块共享小组件 ============ */
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';

/** 列表通用行 */
export function Row({ icon, iconColor, iconBg, label, value, danger, onClick, arrow = true, children }: {
  icon?: IconName; iconColor?: string; iconBg?: string; label: React.ReactNode; value?: React.ReactNode;
  danger?: boolean; onClick?: () => void; arrow?: boolean; children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="row" style={{ width: '100%', padding: '12px 0', gap: 12, textAlign: 'left', borderBottom: '1px solid #F7F1EC' }}>
      {icon && (
        <span style={{ width: 30, height: 30, borderRadius: 9, background: iconBg || 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={16} color={iconColor || 'var(--text-2)'} />
        </span>
      )}
      <span className="flex-1" style={{ fontSize: 14, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--text)' }}>{label}</span>
      {value && <span style={{ fontSize: 12.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>{value}</span>}
      {children}
      {arrow && <Icon name="chevron-right" size={15} color="var(--text-3)" />}
    </button>
  );
}

/** 开关 */
export function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{ width: 42, height: 25, borderRadius: 99, flexShrink: 0, position: 'relative', cursor: 'pointer', background: on ? 'var(--brand-grad)' : 'var(--bg-deep)', transition: 'background .2s ease' }}
    >
      <span style={{ position: 'absolute', top: 2.5, left: on ? 20 : 2.5, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s ease' }} />
    </div>
  );
}
