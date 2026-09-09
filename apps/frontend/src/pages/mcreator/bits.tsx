/* ============================================================================
 * 创作者中心 · 移动版共享小组件（430 壳内）
 * 表单 / 弹层 / 素材选择等复用 pages/creator/_shared.tsx 的实现（其 CSS 全局生效）。
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { Loading } from '../../components/shared/utils';
import { useAsync, Modal, Confirm, Field, TagInput, MaterialPickModal, CState, MatPreview, WindowBadge, ProductBadge, fmtDT, fmtD, SIZE_OPTIONS, DIM_FIELDS } from '../creator/_shared';
export { Loading, Modal, Confirm, Field, TagInput, MaterialPickModal, CState, MatPreview, WindowBadge, ProductBadge, fmtDT, fmtD, SIZE_OPTIONS, DIM_FIELDS };
export { useAsync };

export function MEmpty({ icon = 'layers', title, desc, action }: {
  icon?: IconName; title: string; desc?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '34px 14px' }}>
      <div style={{
        width: 54, height: 54, margin: '0 auto 12px', borderRadius: '50%',
        background: '#F1F2F5', color: '#9AA0AA', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#3A3F48' }}>{title}</div>
      {desc && <div className="mc-sub" style={{ marginTop: 6 }}>{desc}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/** 横滑 pill 切换（含可选数量） */
export function MTabs({ items, value, onChange }: {
  items: { key: string; label: React.ReactNode; count?: number }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="mc-tabs">
      {items.map((t) => (
        <button key={t.key} className={`mc-tab ${value === t.key ? 'on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {typeof t.count === 'number' && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** 桌面 /creator 链接 → 移动版 /c 链接；无移动版的模块（数据看板/佣金等）保留桌面链接 */
export function mcLink(link?: string | null): string {
  if (!link) return '/c/home';
  const map: Record<string, string> = {
    '/creator/library': '/c/library',
    '/creator/works': '/c/works',
    '/creator/publish': '/c/publish',
    '/creator/pool': '/c/pool',
    '/creator/window': '/c/window',
    '/creator/products': '/c/products',
    '/creator/dashboard': '/creator/dashboard',
  };
  if (map[link]) return map[link];
  if (link.startsWith('/creator/')) return link;
  return link;
}

/* 移动端小卡片标题头 */
export function MCardHd({ icon, title, right }: { icon?: IconName; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mc-hd">
      <div className="mc-hd-title" style={{ flex: 1 }}>
        {icon && <Icon name={icon} size={15} color="var(--brand)" />}
        {title}
      </div>
      {right}
    </div>
  );
}
