/* =========================================================
 * 首页 / 素材库 · 共享小组件
 * （本文件由「首页 & 素材库」模块独占，供 HomePage / LibraryPage 复用）
 * ========================================================= */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';

/* ---------- 图片 onError 兜底（灰底 + 图标） ---------- */
export function Cover({ src, alt = '', style, icon = 'dress', radius = 0 }: {
  src: string; alt?: string; style?: CSSProperties; icon?: IconName; radius?: number;
}) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div
        className="img-ph"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', borderRadius: radius, ...style,
        }}
      >
        <Icon name={icon} size={22} />
      </div>
    );
  }
  return (
    <img
      src={src} alt={alt} loading="lazy"
      onError={() => setErr(true)}
      style={{ display: 'block', objectFit: 'cover', background: 'var(--bg-deep)', borderRadius: radius, ...style }}
    />
  );
}

/* ---------- 面料 id → 固定代表主色（主色调圆点 / 氛围色块） ---------- */
export const FEEL_COLORS: Record<string, string> = {
  silk: '#E9C7AE', satin: '#F2AFC4', linen: '#D9D2BE', cotton: '#F4EFE6',
  chiffon: '#F9D8CF', wool: '#B6A68C', cashmere: '#D8C3AB', knit: '#C9BBA4',
  denim: '#6C7FA8', velvet: '#83414D', tulle: '#EFD8E2', lace: '#F3E4E3',
  suede: '#B58E6B', jersey: '#D6C7BD', oxford: '#9FB0C6', tech: '#7E8FA8',
};
export const feelColor = (id: string) => FEEL_COLORS[id] || '#D9C9BE';

/* ---------- 深紫「工作台」渐变（少量点缀：AI 工坊 / 3D 主入口） ---------- */
export const WORKBENCH = 'linear-gradient(140deg, #6E5AA8 0%, #4A3877 52%, #332752 100%)';

/* ---------- 十六进制亮度（决定深底/浅底上的图标颜色） ---------- */
export function isLight(hex: string): boolean {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  } catch { return true; }
}
