/* ============================================================================
 * 素材种类徽标（dxf/obj/svg/glb/png/…），consumer 信息流与 mall/creator 复用
 * ==========================================================================*/
import Icon from '../Icon';
import type { IconName } from '../Icon';

const KIND_META: Record<string, { label: string; icon: IconName; color: string; bg: string; desc: string }> = {
  dxf: { label: 'DXF', icon: 'pen-tool', color: '#B4547A', bg: '#FBEDF2', desc: '打版图纸（CAD R12）' },
  svg: { label: 'SVG', icon: 'scissors', color: '#8A5A00', bg: '#FBF4E2', desc: '矢量图案' },
  obj: { label: 'OBJ', icon: 'layers', color: '#3B82F6', bg: '#EAF2FE', desc: '3D 模型网格' },
  glb: { label: 'GLB', icon: 'rotate', color: '#5B5BD6', bg: '#EDEDFC', desc: '3D 场景' },
  png: { label: 'PNG', icon: 'image', color: '#2E7D5B', bg: '#E6F5EE', desc: '位图' },
  jpg: { label: 'JPG', icon: 'image', color: '#2E7D5B', bg: '#E6F5EE', desc: '位图' },
  zprj: { label: 'ZPRJ', icon: 'package', color: '#6B6470', bg: '#F1EDE9', desc: 'CLO 工程包' },
  ai: { label: 'AI', icon: 'pen-tool', color: '#B26A00', bg: '#FBF0E0', desc: 'Illustrator 源文件' },
  pdf: { label: 'PDF', icon: 'note', color: '#E5484D', bg: '#FCEBEC', desc: '文档' },
  image: { label: '图片', icon: 'image', color: '#2E7D5B', bg: '#E6F5EE', desc: '图片素材' },
};

export const materialKindLabel = (kind?: string) =>
  KIND_META[(kind || '').toLowerCase()]?.label || (kind || '素材').toUpperCase();

/** 单个素材徽标 */
export function MaterialBadge({ kind, size = 'sm', dim }: { kind?: string; size?: 'sm' | 'md'; dim?: boolean }) {
  const m = KIND_META[(kind || '').toLowerCase()] || KIND_META.image;
  const sm = size === 'sm';
  return (
    <span className="row" style={{
      gap: sm ? 3 : 5,
      padding: sm ? '2px 8px' : '3px 10px',
      borderRadius: 99,
      fontSize: sm ? 10 : 11.5,
      fontWeight: 700,
      lineHeight: 1.3,
      background: dim ? 'rgba(30,22,28,.6)' : m.bg,
      color: dim ? '#fff' : m.color,
      backdropFilter: dim ? 'blur(4px)' : undefined,
      WebkitBackdropFilter: dim ? 'blur(4px)' : undefined,
      whiteSpace: 'nowrap',
    }} title={`${m.label} · ${m.desc}`}>
      <Icon name={m.icon} size={sm ? 10 : 12} />
      {m.label}
    </span>
  );
}

/** 素材入口徽标组（打版素材数 / 3D 素材数）——信息流卡片 / 商品详情用 */
export function MaterialEntryBadges({ pattern = 0, model = 0 }: { pattern?: number; model?: number }) {
  if (!pattern && !model) return null;
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {model > 0 && <MaterialBadge kind="obj" />}
      {pattern > 0 && <MaterialBadge kind="dxf" />}
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
        {[model > 0 ? `${model} 个 3D 素材` : '', pattern > 0 ? `${pattern} 个打版素材` : ''].filter(Boolean).join(' · ')}
      </span>
    </div>
  );
}
