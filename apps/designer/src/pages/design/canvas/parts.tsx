/* ============ 2D 画布共享渲染件（parts） ============
 * MiniTemplate / TemplatePreview 供 CanvasPage 缩略，
 * TemplateBody / PatternDefs / Strokes / Annots 供画布编辑器复用。
 * 所有坐标均为模板 viewBox 用户单位（300 x 520）。
 */
import React from 'react';
import type { CSSProperties } from 'react';
import type { SketchAnnot, SketchFill, SketchStroke, SketchTemplate } from '../../../data/sketchTypes';
import { FABRICS, PATTERNS } from '../../../data/design';
import { templateById } from '../../../data/sketchTemplates';

/* ---------- 常量 ---------- */
export const CW = 300;
export const CH = 520;

const REGION_EMPTY = '#F4EFE8';        // 未填充区域的浅淡底
const REGION_LINE = '#CFC6BB';         // 区域描边
const BODY_STROKE = '#A8AFB6';         // 人体参考灰线

/* 面料弱化色（固定浅色调，按 id 取不同暖/冷浅色） */
const FABRIC_TINTS: Record<string, string> = {
  silk: '#F4E9E3', satin: '#EFE7F2', linen: '#F1EDE0', cotton: '#F2F0EA',
  chiffon: '#EDF1F4', wool: '#EFEAE4', cashmere: '#F3EDE6', knit: '#F0EAE2',
  denim: '#E8ECF2', velvet: '#F0E6EC', tulle: '#F0EEF4', lace: '#F4ECEA',
  suede: '#F1EBE2', jersey: '#EAF0EC', oxford: '#EDEFF1', tech: '#E9EEF1',
};

const PATTERN_META: Record<string, string> = {
  stripe: 'fz-p-stripe', polka: 'fz-p-dot', plaid: 'fz-p-plaid',
  floral: 'fz-p-flower', geo: 'fz-p-geo', dots2: 'fz-p-heart',
};

const noteOf = (fill: SketchFill) => {
  if (fill.kind === 'fabric') return FABRICS.find((f) => f.id === fill.value)?.name || '';
  if (fill.kind === 'pattern') return PATTERNS.find((p) => p.v === fill.value)?.label || '';
  return '';
};

/** 面料弱化主色（供画布填充 & 选单色片共用） */
export const fabricTintOf = (id: string) => FABRIC_TINTS[id] || '#F1EAE3';

/** 区域填充 → 渲染视觉 */
export function visualForFill(fill: SketchFill): { base: string; overlay?: string; note: string } {
  if (fill.kind === 'color') return { base: fill.value, note: '' };
  if (fill.kind === 'fabric') {
    return { base: fabricTintOf(fill.value), note: noteOf(fill) };
  }
  const def = PATTERN_META[fill.value];
  return {
    base: '#FAF5EE',
    overlay: def ? `url(#${def})` : undefined,
    note: noteOf(fill),
  };
}

/* ---------- 图案 defs（编辑器/预览 svg 内联使用；重复 id 内容一致无碍） ---------- */
export function PatternDefs() {
  return (
    <defs>
      <pattern id="fz-p-stripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill="none" />
        <line x1="0" y1="0" x2="0" y2="14" stroke="#D9CDC1" strokeWidth="1" />
        <line x1="7" y1="0" x2="7" y2="14" stroke="rgba(232,92,135,.5)" strokeWidth="1.4" />
      </pattern>
      <pattern id="fz-p-dot" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="none" />
        <circle cx="4" cy="4" r="1.8" fill="#CBB8A4" />
        <circle cx="12" cy="12" r="1.8" fill="rgba(232,92,135,.4)" />
      </pattern>
      <pattern id="fz-p-plaid" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="none" />
        <line x1="0" y1="12" x2="24" y2="12" stroke="#DCD1C4" strokeWidth="1" />
        <line x1="12" y1="0" x2="12" y2="24" stroke="#DCD1C4" strokeWidth="1" />
        <line x1="0" y1="0" x2="24" y2="0" stroke="rgba(196,162,63,.4)" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(196,162,63,.4)" strokeWidth="2" />
      </pattern>
      <pattern id="fz-p-flower" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="none" />
        <g fill="#E6B7C4">
          <circle cx="12" cy="6" r="1.7" /><circle cx="18" cy="12" r="1.7" />
          <circle cx="12" cy="18" r="1.7" /><circle cx="6" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="2" fill="rgba(196,84,78,.75)" />
        </g>
      </pattern>
      <pattern id="fz-p-geo" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="none" />
        <g fill="none" stroke="#C9BCAE" strokeWidth="1.3">
          <path d="M10 4 L15 10 L10 16 L5 10 Z" />
          <circle cx="10" cy="10" r="1.2" fill="#E8A0B0" stroke="none" />
        </g>
      </pattern>
      <pattern id="fz-p-heart" width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="none" />
        <g fill="rgba(216,112,132,.55)">
          <circle cx="7.4" cy="8" r="2.4" /><circle cx="12.6" cy="8" r="2.4" />
          <path d="M4.9 9.8 L15.1 9.8 L10 15.4 Z" />
        </g>
      </pattern>
    </defs>
  );
}

/* 网格（画布 5% 网格） */
export function GridDefs() {
  return (
    <defs>
      <pattern id="fz-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#EAE3DB" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

/* ---------- 人体参考 + 服装区域 + 填充（核心渲染） ---------- */
interface TemplateBodyProps {
  template: SketchTemplate;
  fills?: SketchFill[];
  showLabels?: boolean;
  dimBody?: boolean;         // 人体参考线淡化（便于描线）
  interactive?: boolean;     // 允许 hover/点击（填充模式）
  activeRegionId?: string | null;
  onRegionClick?: (regionId: string) => void;
  paper?: boolean;           // 是否自带白底
}

export function TemplateBody({ template, fills = [], showLabels, dimBody, interactive, activeRegionId, onRegionClick, paper }: TemplateBodyProps) {
  const [centers, setCenters] = React.useState<Record<string, { x: number; y: number }>>({});
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const pathRefs = React.useRef<Record<string, SVGPathElement | null>>({});

  React.useLayoutEffect(() => {
    if (!showLabels) return;
    const m: Record<string, { x: number; y: number }> = {};
    for (const r of template.regions) {
      const el = pathRefs.current[r.id];
      if (el) {
        try {
          const b = el.getBBox();
          m[r.id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        } catch { /* noop */ }
      }
    }
    setCenters(m);
  }, [template, showLabels]);

  const fillMap: Record<string, SketchFill> = {};
  for (const f of fills) fillMap[f.regionId] = f;

  const bodyOpacity = dimBody ? 0.32 : 0.5;

  /* 人体/参考描线组（croquis 画在服装区域之下；flat 的工艺线/扣子画在填充之上；
     始终 pointer-events:none，避免遮挡填充点击/标注点击） */
  const bodyGroup = (
    <g pointerEvents="none" fill="none" stroke={BODY_STROKE} strokeOpacity={bodyOpacity} strokeLinecap="round" strokeLinejoin="round">
      {(template.bodyPaths || []).map((bp, i) => (
        <path key={i} d={bp.d} strokeWidth={bp.sw ?? 1} />
      ))}
    </g>
  );

  /* 服装区域 + 填充 */
  const regionsLayer = template.regions.map((r) => {
    const fill = fillMap[r.id];
    const v = fill ? visualForFill(fill) : null;
    const isActive = interactive && r.id === activeRegionId;
    const isHover = interactive && r.id === hoverId;
    const pointer = interactive ? ('auto' as const) : ('none' as const);
    const setRef = (el: SVGPathElement | null) => { pathRefs.current[r.id] = el; };
    return (
      <g
        key={r.id}
        onClick={interactive && onRegionClick ? (e) => { e.stopPropagation(); onRegionClick(r.id); } : undefined}
        onPointerEnter={interactive ? () => setHoverId(r.id) : undefined}
        onPointerLeave={interactive ? () => setHoverId((h) => (h === r.id ? null : h)) : undefined}
        style={{ pointerEvents: pointer, cursor: interactive ? 'pointer' : undefined }}
      >
        <path
          ref={setRef}
          d={r.d}
          fill={v ? v.base : REGION_EMPTY}
          stroke={isActive ? 'var(--brand, #E85C87)' : isHover ? 'rgba(232,92,135,.8)' : REGION_LINE}
          strokeWidth={isActive || isHover ? 2 : 1}
          strokeOpacity={isActive || isHover ? 1 : 0.9}
          strokeDasharray={fill ? (isActive ? '6 3' : undefined) : '5 3'}
        />
        {v?.overlay && <path d={r.d} fill={v.overlay} pointerEvents="none" />}
        {showLabels && v?.note && fill && fill.kind !== 'color' && centers[r.id] && (
          <text
            x={centers[r.id].x}
            y={centers[r.id].y}
            fontSize="8.5"
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={fill.kind === 'pattern' ? '#A35A7C' : '#7A7266'}
            style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.6, pointerEvents: 'none' }}
          >
            {v.note}
          </text>
        )}
      </g>
    );
  });

  return (
    <React.Fragment>
      {paper && <rect x="0" y="0" width={CW} height={CH} fill="#fff" />}
      {template.kind === 'flat'
        ? <React.Fragment>{regionsLayer}{bodyGroup}</React.Fragment>
        : <React.Fragment>{bodyGroup}{regionsLayer}</React.Fragment>}
    </React.Fragment>
  );
}

/* ---------- 笔触层 ---------- */
export function Strokes({ strokes, live }: { strokes: SketchStroke[]; live?: SketchStroke | null }) {
  const all = live ? [...strokes, live] : strokes;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {all.map((s, i) => (
        <path key={i} d={s.path} stroke={s.color} strokeWidth={s.width} opacity={s.opacity ?? 1} />
      ))}
    </g>
  );
}

/* ---------- 标注层 ---------- */
export function Annots({ annots, deletable, onDelete }: {
  annots: SketchAnnot[]; deletable?: boolean; onDelete?: (a: SketchAnnot) => void;
}) {
  return (
    <g pointerEvents="none">
      {annots.map((a, i) => {
        const x = Math.min(CW - 62, Math.max(8, a.x));
        const y = Math.min(CH - 14, Math.max(14, a.y));
        const tx = Math.min(CW - 44, x + 22);
        const tw = a.text.length * 6.6 + 8;
        return (
          <g
            key={i}
            onClick={deletable ? (e) => { e.stopPropagation(); onDelete?.(a); } : undefined}
            style={{ pointerEvents: deletable ? 'all' : 'none', cursor: deletable ? 'pointer' : undefined }}
          >
            <circle cx={x} cy={y} r="2.4" fill="#6B6470" />
            <line x1={x} y1={y} x2={tx} y2={y - 9} stroke="#6B6470" strokeWidth="0.9" />
            <rect x={tx - 4} y={y - 25} width={tw} height={17} rx={3} fill="transparent" />
            <text
              x={tx}
              y={y - 13}
              fontSize="9"
              fill="#4A4350"
              style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,.92)', strokeWidth: 2.6 }}
            >
              {a.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- 模板微缩（模板卡缩略图，无交互） ---------- */
export function MiniTemplate({ template, width = 78, style }: { template: SketchTemplate; width?: number; style?: CSSProperties }) {
  const h = (width * template.h) / template.w;
  return (
    <svg viewBox={`0 0 ${template.w} ${template.h}`} width={width} height={h} style={{ display: 'block', ...style }} aria-hidden="true">
      <PatternDefs />
      <TemplateBody template={template} paper />
    </svg>
  );
}

/* ---------- 作品缩略（草稿卡） ---------- */
export function TemplatePreview({ work, width = 76, style }: {
  work: { templateId: string; strokes: SketchStroke[]; fills: SketchFill[]; annots: SketchAnnot[] };
  width?: number; style?: CSSProperties;
}) {
  const template = templateById(work.templateId) || TEMPLATE_FALLBACK;
  const h = (width * template.h) / template.w;
  return (
    <svg viewBox={`0 0 ${template.w} ${template.h}`} width={width} height={h} style={{ display: 'block', ...style }} aria-hidden="true">
      <PatternDefs />
      <TemplateBody template={template} fills={work.fills} />
      <Strokes strokes={work.strokes} />
      <Annots annots={work.annots} />
    </svg>
  );
}

/* 模板缺失时的兜底（保持 300x520 白纸） */
const TEMPLATE_FALLBACK: SketchTemplate = {
  id: '__fallback', name: '画纸', kind: 'flat', view: 'front', w: 300, h: 520,
  bodyPaths: [{ d: `M 30 30 L 270 30 L 270 490 L 30 490 Z` }], regions: [], hint: '',
};
