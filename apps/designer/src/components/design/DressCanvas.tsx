import React from 'react';
import type { CategoryKey, DesignParams } from '../../data/design';
import { shade } from '../../data/design';

/* =========================================================
 * 参数化服装渲染引擎（SVG 技术插画风格）
 * 18 类款式元素参数实时重建服装几何
 * 轮廓 = 节点采样 + Catmull-Rom 平滑，稳定可控
 * ========================================================= */

const CX = 180;
const W = 360, H = 560;

export interface Body { height: number; bust: number; waist: number; hip: number }

interface Pt { x: number; y: number }
interface Anchors {
  collarTopY: number; shoulderY: number; armholeY: number;
  waistY: number; hipY: number; hemY: number;
  neckHalf: number; shoulderHalf: number; bustHalf: number;
  waistHalf: number; hipHalf: number; hemHalf: number;
  scale: number;
}

function anchors(p: DesignParams, body?: Body | null): Anchors {
  const scale = body ? Math.min(1.12, Math.max(0.88, body.height / 165)) : 1;
  const waOff = body ? (body.waist - 84) * 0.24 : 0;
  const buOff = body ? (body.bust - 84) * 0.2 : 0;
  const hipOff = body ? (body.hip - 90) * 0.18 : 0;

  const waistY = p.category === 'pants' ? 154 : p.waist === 'high' ? 144 : p.waist === 'low' ? 190 : 166;
  const hipY = 216;
  const dropped = p.shoulder === 'dropped';
  const shoulderY = 80 + (dropped ? 18 : 0);
  const armholeY = dropped ? 134 : 118;
  const collarTopY = 48;

  const mapLen = (base: number, k: number) => Math.min(544, Math.max(58, (base + p.lengthCm * k) * scale + (1 - scale) * 46));
  const hemY = ({
    dress: mapLen(52, 3.5), shirt: mapLen(92, 2.4), skirt: mapLen(64, 3.32),
    coat: mapLen(50, 3.5), pants: mapLen(48, 4.12), suit: mapLen(60, 3.38),
  } as Record<CategoryKey, number>)[p.category];

  const bustHalf = 58 + buOff + waOff * 0.3;
  const fit: Record<string, { w: number; hm: number; lm?: number }> = {
    slim: { w: 0.8, hm: 0.96 }, fit: { w: 0.92, hm: 1.06 }, loose: { w: 1.12, hm: 1.44 },
    a: { w: 0.9, hm: 1.85 }, h: { w: 1.02, hm: 1.24 },
  };
  const f = fit[p.fit] || fit.fit;
  const pantsLeg: Record<string, number> = { slim: 0.62, fit: 0.85, loose: 1.5, a: 1.34, h: 1.06 };
  const leg = p.category === 'pants' ? pantsLeg[p.fit] || 0.85 : 1;

  const skirtFlare = p.category === 'skirt' ? 2.1 : 1;
  return {
    collarTopY, shoulderY, armholeY, waistY, hipY, hemY,
    neckHalf: 15, shoulderHalf: bustHalf * 1.16 + (dropped ? 9 : 0),
    bustHalf, waistHalf: bustHalf * f.w,
    hipHalf: bustHalf * (p.category === 'skirt' ? 1.62 : 1.1) + hipOff,
    hemHalf: p.category === 'skirt' ? bustHalf * 2.15 : (bustHalf * f.hm * skirtFlare) * leg,
    scale,
  };
}

/* =========================================================
 * 采样工具
 * ========================================================= */
function sample(start: Pt, end: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return out;
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 3) return pts.map((q) => `L ${q.x} ${q.y}`).join(' ');
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/* 连续点链转路径（点与点间按步长插值再平滑） */
function chainPath(knots: Pt[], seg = 4, smooth = true): string {
  const dense: Pt[] = [knots[0]];
  for (let i = 0; i < knots.length - 1; i++) dense.push(...sample(knots[i], knots[i + 1], seg));
  return smooth ? smoothPath(dense) : dense.map((q, i) => (i === 0 ? `M ${q.x} ${q.y}` : `L ${q.x} ${q.y}`)).join(' ');
}

/* =========================================================
 * 领口边缘采样（neckLeft → neckRight，随领型下凹）
 * ========================================================= */
function neckEdge(p: DesignParams, a: Anchors): Pt[] {
  const s = a.neckHalf * 2.3;
  const y0 = a.collarTopY + 8;
  const L: Pt = { x: CX - s, y: y0 + 2 };
  const R: Pt = { x: CX + s, y: y0 + 2 };
  switch (p.collar) {
    case 'vneck': {
      const depth = 58 * a.scale;
      const tip: Pt = { x: CX, y: y0 + depth };
      return [L, ...sample(L, tip, 4), ...sample(tip, R, 4)];
    }
    case 'square': {
      const d = 40;
      return [L, { x: CX - s * 0.62, y: y0 }, { x: CX - s * 0.62, y: y0 + d }, { x: CX + s * 0.62, y: y0 + d }, { x: CX + s * 0.62, y: y0 }, R];
    }
    case 'boat': {
      return [L, { x: CX - s * 0.5, y: y0 - 6 }, { x: CX, y: y0 - 10 }, { x: CX + s * 0.5, y: y0 - 6 }, R];
    }
    case 'shirt': {
      return [L, { x: CX - s * 0.42, y: y0 + 10 }, { x: CX, y: y0 + 16 }, { x: CX + s * 0.42, y: y0 + 10 }, R];
    }
    case 'stand': {
      return [L, { x: CX, y: y0 - 4 }, R];
    }
    default: {
      // 圆领：圆弧下凹
      const r = 34 * a.scale;
      const pts: Pt[] = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = CX - s + 2 * s * t;
        const dy = Math.sqrt(Math.max(0, r * r - Math.pow((x - CX) / (s / r), 2) * 0)) ; // placeholder
        void dy;
        const y = y0 + 2 + (1 - Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / s, 2)))) * r * 0.96;
        pts.push({ x, y });
      }
      return pts;
    }
  }
}

/* =========================================================
 * 侧面轮廓节点
 * ========================================================= */
function sideKnotsTop(p: DesignParams, a: Anchors, side: 1 | -1): Pt[] {
  const cx = CX;
  const dropped = p.shoulder === 'dropped';
  const noSleeve = p.sleeve === 'none';
  const arm = a.armholeY;
  const waist = Math.max(a.waistY, arm + 10);
  const shoulder = { x: cx + side * a.shoulderHalf, y: a.shoulderY };
  const out: Pt[] = [shoulder];
  if (noSleeve) {
    out.push({ x: cx + side * a.bustHalf * 1.02, y: arm + 12 });
    out.push({ x: cx + side * a.bustHalf * 1.16, y: arm + 34 });
  } else {
    out.push({ x: cx + side * (a.shoulderHalf * 0.8 - (dropped ? 2 : 0)), y: arm - 2 });
    out.push({ x: cx + side * a.bustHalf * 1.08, y: arm + 8 });
    out.push({ x: cx + side * a.bustHalf * 1.2, y: arm + 36 });
  }
  out.push({ x: cx + side * a.waistHalf * 1.18, y: waist });
  if (p.category === 'dress') {
    out.push({ x: cx + side * a.hipHalf * 1.06, y: a.hipY });
    out.push({ x: cx + side * a.hemHalf, y: a.hemY - 6 });
  } else if (p.category === 'coat' || p.category === 'suit') {
    out.push({ x: cx + side * Math.min(a.hipHalf * 1.02, a.hemHalf * 1.02), y: a.hipY });
    out.push({ x: cx + side * a.hemHalf, y: a.hemY - 6 });
  } else {
    // shirt
    out.push({ x: cx + side * Math.min(a.hipHalf, a.hemHalf), y: a.hipY });
    out.push({ x: cx + side * a.hemHalf, y: a.hemY - 6 });
  }
  return out;
}

/* ---------- 摆底采样（右→左） ---------- */
function hemBottom(p: DesignParams, a: Anchors): Pt[] {
  const half = a.hemHalf;
  const yb = a.hemY - 6;
  const n = 44;
  const out: Pt[] = [];
  const wave = p.drape > 0.38 ? p.drape * 8 * a.scale : 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = CX + half - 2 * half * t; // +half → -half
    let y = yb;
    const cx = CX;
    switch (p.hem) {
      case 'round': {
        const k = Math.abs((x - cx) / half);
        y = yb + 18 * a.scale * (1 - k * k);
        break;
      }
      case 'asym': {
        y = yb - 20 * a.scale * t; // 左高右低
        break;
      }
      case 'slithem': {
        const cut = half * 0.2;
        const d = Math.abs(x - cx);
        if (d < cut) y = yb - 24 * a.scale * (1 - d / cut) * 0 + (d < cut ? yb - 22 * a.scale : yb);
        else y = yb;
        break;
      }
      case 'ruffle': {
        const phase = Math.PI * (1 - t) * 6; // 3 个完整荷叶弧
        y = yb + 11 * a.scale * (Math.abs(Math.sin(phase)));
        break;
      }
      default: {
        if (wave > 0) y = yb + wave * Math.sin(Math.PI * 4 * (0.5 - t)) * 0.5;
      }
    }
    out.push({ x, y });
  }
  // slithem 需要真正的开衩切口
  if (p.hem === 'slithem') {
    const cut = half * 0.2;
    const up = 20 * a.scale;
    const res: Pt[] = [];
    for (const q of out) {
      const d = Math.abs(q.x - CX);
      if (d > cut) res.push(q);
      else if (q.x < CX) res.push({ x: CX - cut, y: q.y }, { x: CX - cut, y: q.y - up });
      else res.push({ x: CX + cut, y: q.y - up }, { x: CX + cut, y: q.y });
    }
    return res;
  }
  return out;
}

/* ---------- 连衣裙/上装/外套/套装 轮廓 ---------- */
function topOutline(p: DesignParams, a: Anchors): string {
  const knots: Pt[] = [];
  // 领口左端 → 领口边缘(左→右) → 右肩 → 右侧下 → 摆底(右→左) → 左侧上 → 左肩 → Z 闭合到领口左
  const neck = neckEdge(p, a);            // neckLeft → neckRight
  const R = sideKnotsTop(p, a, 1);        // 右肩 → hemRight
  const hem = hemBottom(p, a);            // hemRight → hemLeft
  const up = [...sideKnotsTop(p, a, -1)].reverse(); // hemLeft → … → 左肩
  knots.push(...neck, ...R, ...hem, ...up);
  return chainPath(knots) + ' Z';
}

/* ---------- 半裙轮廓 ---------- */
function skirtOutline(p: DesignParams, a: Anchors): string {
  const cx = CX;
  const wy = a.waistY - 8;
  const ww = a.waistHalf * 1.2;
  const hem = hemBottom(p, a);
  // 顺时针：腰右端 → 右下摆（裙身侧面）→ 摆底 → 左侧上 → 腰左端
  const sideR: Pt[] = [
    { x: cx + ww, y: wy },
    { x: cx + a.hemHalf * 0.96, y: a.hemY - 14 },
    ...hem,
    { x: cx - a.hemHalf * 0.96, y: a.hemY - 14 },
    { x: cx - ww, y: wy },
  ];
  return chainPath(sideR) + ' Z';
}

/* ---------- 裤装轮廓 ---------- */
function pantsOutline(p: DesignParams, a: Anchors): string {
  const cx = CX;
  const topY = a.waistY - 6;
  const hip = a.hipHalf * 1.16;
  const rise = 40;
  const legTop = ({ slim: 46, fit: 60, loose: 88, a: 80, h: 66 })[p.fit] || 60;
  const ankle = ({ slim: 30, fit: 42, loose: 84, a: 76, h: 54 })[p.fit] || 42;
  const flare = p.hem === 'slithem' || p.hem === 'asym' ? 18 : 0;
  const hemY = a.hemY;
  const L = `M ${cx - hip} ${topY}
    L ${cx - legTop} ${topY + rise}
    L ${cx - ankle - flare} ${hemY - 4}
    Q ${cx - ankle - flare - 6} ${hemY + 4} ${cx - ankle - flare + 5} ${hemY + 2}
    L ${cx - 5} ${hemY} L ${cx - 5} ${topY + rise - 20} Z`;
  const R = `M ${cx + hip} ${topY}
    L ${cx + legTop} ${topY + rise}
    L ${cx + ankle + flare} ${hemY - 4}
    Q ${cx + ankle + flare + 6} ${hemY + 4} ${cx + ankle + flare - 5} ${hemY + 2}
    L ${cx + 5} ${hemY} L ${cx + 5} ${topY + rise - 20} Z`;
  return `${L} ${R}`;
}

function outlinePath(p: DesignParams, a: Anchors): string {
  if (p.category === 'pants') return pantsOutline(p, a);
  if (p.category === 'skirt') return skirtOutline(p, a);
  return topOutline(p, a);
}

/* =========================================================
 * 袖型路径
 * ========================================================= */
function sleevePath(p: DesignParams, a: Anchors, side: 1 | -1): string {
  const dir = side;
  const sh = CX + dir * a.shoulderHalf * 0.98;
  const sy = a.shoulderY + 4;
  const ax = CX + dir * a.bustHalf * 1.1;
  const w = (k: number) => dir * k;
  switch (p.sleeve) {
    case 'none': return '';
    case 'short': {
      const endY = a.armholeY + 56, cw = 30;
      const P: Pt[] = [
        { x: sh, y: sy - 2 }, { x: sh + w(34), y: sy + 6 }, { x: sh + w(38), y: sy + 26 },
        { x: sh + w(cw + 4), y: endY }, { x: sh + w(cw - 6), y: endY + 8 }, { x: ax, y: endY + 10 },
      ];
      return chainPath(P);
    }
    case 'long': {
      const endY = a.armholeY + 160, cw = 26;
      const P: Pt[] = [
        { x: sh, y: sy - 2 }, { x: sh + w(40), y: sy + 8 }, { x: sh + w(41), y: sy + 34 },
        { x: sh + w(30), y: a.armholeY + 120 }, { x: sh + w(cw + 4), y: endY - 8 },
        { x: sh + w(cw - 8), y: endY + 4 }, { x: ax, y: endY + 6 },
      ];
      return chainPath(P);
    }
    case 'puff': {
      const endY = a.armholeY + 130, cw = 26;
      const P: Pt[] = [
        { x: sh, y: sy - 2 }, { x: sh + w(56), y: sy - 12 }, { x: sh + w(64), y: sy + 6 },
        { x: sh + w(48), y: sy + 46 }, { x: sh + w(32), y: sy + 70 }, { x: sh + w(cw + 2), y: endY - 6 },
        { x: sh + w(cw - 8), y: endY + 4 }, { x: ax, y: endY + 6 },
      ];
      return chainPath(P);
    }
    case 'lantern': {
      const endY = a.armholeY + 130, cw = 25;
      const P: Pt[] = [
        { x: sh, y: sy - 2 }, { x: sh + w(42), y: sy + 10 }, { x: sh + w(56), y: sy + 42 },
        { x: sh + w(62), y: sy + 78 }, { x: sh + w(40), y: sy + 108 }, { x: sh + w(cw + 2), y: endY - 6 },
        { x: sh + w(cw - 8), y: endY + 4 }, { x: ax, y: endY + 6 },
      ];
      return chainPath(P);
    }
    case 'bell': {
      const endY = a.armholeY + 122;
      const P: Pt[] = [
        { x: sh, y: sy - 2 }, { x: sh + w(38), y: sy + 10 }, { x: sh + w(39), y: sy + 40 },
        { x: sh + w(22), y: sy + 78 }, { x: sh + w(58), y: endY }, { x: sh + w(46), y: endY + 8 },
        { x: ax, y: endY + 10 },
      ];
      return chainPath(P);
    }
    default: return '';
  }
}

/* =========================================================
 * 主组件
 * ========================================================= */
export interface DressCanvasProps {
  params: DesignParams;
  body?: Body | null;
  showModel?: boolean;
  showGrid?: boolean;
  uid?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function DressCanvas({ params: p, body, showModel, showGrid, uid = 'g', className, style }: DressCanvasProps) {
  const a = anchors(p, body || null);
  const base = p.color;
  const dark = shade(base, -0.18);
  const darker = shade(base, -0.33);
  const light = shade(base, 0.18);
  const accent = p.accent;
  const isPants = p.category === 'pants';
  const isSkirt = p.category === 'skirt';
  const isTop = !isPants && !isSkirt;
  const patternId = `${uid}-ptn-${p.pattern}-${base.replace('#', '')}`;
  const clipId = `${uid}-clip-${base.replace('#', '')}`;
  const usePattern = p.pattern !== 'none';
  const garment = outlinePath(p, a);
  const showBtn = p.placket === 'single' || p.placket === 'double';
  const btnRows = p.category === 'coat' || p.category === 'suit' ? 3 : p.category === 'pants' ? 1 : 4;
  const btnStyle = p.buttons === 'metal'
    ? { fill: '#c8ced8', inner: '#fff' as string | undefined }
    : p.buttons === 'fabric'
      ? { fill: shade(base, 0.02), inner: dark as string | undefined }
      : { fill: '#8a6244', inner: undefined as string | undefined };
  const stitchCol = p.stitch === 'contrast' ? accent : darker;
  const neckKey = `${p.category}-${p.collar}-${p.sleeve}-${p.fit}-${p.waist}-${p.hem}-${p.lengthCm}-${p.shoulder}-${body ? body.height : 0}`;

  return (
    <svg key={neckKey} viewBox={`0 0 ${W} ${H}`} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }}>
      <defs>
        {patternDef()}
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light} stopOpacity="0.5" />
          <stop offset="0.42" stopColor={base} stopOpacity="0" />
          <stop offset="0.8" stopColor={dark} stopOpacity="0.42" />
          <stop offset="1" stopColor={darker} stopOpacity="0.66" />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.32" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.48" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}><path d={garment} /></clipPath>
      </defs>

      {showGrid && (
        <g opacity={0.4}>
          {[120, 220, 320, 420, 520].map((y) => <line key={y} x1={36} y1={y} x2={324} y2={y} stroke="#b6abc6" strokeWidth="0.7" strokeDasharray="2 7" />)}
          <line x1={CX} y1={28} x2={CX} y2={544} stroke="#b6abc6" strokeWidth="0.7" strokeDasharray="2 7" />
          <circle cx={CX} cy={300} r={148} fill="none" stroke="#b6abc6" strokeWidth="0.7" strokeDasharray="2 7" />
          <text x={CX} y={552} textAnchor="middle" fontSize="9.5" fill="#9d92ae">参数化 3D 画布 · 拖动旋转 · 双指缩放</text>
        </g>
      )}

      <ellipse cx={CX} cy={a.hemY + 22} rx={Math.max(a.hemHalf, 62) * 0.92} ry={9} fill="rgba(80,55,95,.15)" />

      {showModel && <Model a={a} p={p} />}

      {/* 袖子 */}
      {isTop && p.sleeve !== 'none' && (
        <g>
          {([-1, 1] as const).map((s) => {
            const sp = sleevePath(p, a, s);
            return (
              <g key={s}>
                <path d={sp} fill={usePattern ? `url(#${patternId})` : base} stroke={darker} strokeWidth={1.6} strokeLinejoin="round" />
                <path d={sp} fill={dark} opacity={0.1} transform={`translate(${s * 3},0)`} />
              </g>
            );
          })}
        </g>
      )}

      {/* 主体 */}
      <g>
        <path d={garment} fill={usePattern ? `url(#${patternId})` : base} stroke={darker} strokeWidth={1.7} strokeLinejoin="round" />
        <path d={garment} fill={`url(#${uid}-shade)`} />
        {usePattern && p.printPos !== 'full' && isTop && (
          <g clipPath={`url(#${clipId})`}>
            {p.printPos === 'center' && <rect x={CX - 96} y={a.armholeY + 30} width={192} height={Math.max(70, a.hemY - a.armholeY - 60)} fill={`url(#${patternId})`} />}
            {p.printPos === 'bottom' && <rect x={CX - a.hemHalf} y={a.hemY - 88} width={a.hemHalf * 2} height={102} fill={`url(#${patternId})`} />}
            {p.printPos === 'chest' && <circle cx={CX} cy={a.armholeY + 50} r={44} fill={`url(#${patternId})`} />}
          </g>
        )}
      </g>

      {/* 光泽 */}
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={W} height={H} fill={`url(#${uid}-sheen)`} opacity={0.14 + p.gloss * 0.8} />
      </g>

      {p.lining !== 'none' && !isPants && (
        <path d={neckInnerLine()} fill="none" stroke={darker} strokeWidth={p.lining === 'full' ? 2.2 : 1.3} opacity={0.32} strokeDasharray={p.lining === 'half' ? '2 3' : undefined} />
      )}

      {isPants && <PantsDetails />}
      {isSkirt && <SkirtDetails />}
      {isTop && <TopDetails />}

      {p.ornament === 'embroidery' && isTop && <ChestFlower />}
      {p.ornament === 'bow' && isTop && <Bow />}
      {p.ornament === 'pearls' && isTop && <Pearls />}
      {p.ornament === 'lace' && !isPants && <LaceHem />}

      {p.stitch !== 'hidden' && !isPants && (
        <g fill="none" stroke={stitchCol} strokeWidth={1.1} strokeDasharray="3.5 3" opacity={0.85}>
          <path d={neckEdgeStitch()} />
        </g>
      )}
    </svg>
  );

  /* ============ 细节层 ============ */
  function TopDetails() {
    const cx = CX;
    const isOuter = p.category === 'coat' || p.category === 'suit';
    const showLapel = isOuter && p.placket !== 'none' && (p.collar === 'round' || p.collar === 'vneck' || p.collar === 'boat');
    const s = a.neckHalf * 2.3;
    const nk = a.collarTopY + 8;
    return (
      <g>
        {p.collar === 'stand' && (
          <path d={`M ${cx - s * 1.06} ${nk - 8} Q ${cx} ${nk - 20} ${cx + s * 1.06} ${nk - 8} L ${cx + s} ${nk + 6} Q ${cx} ${nk + 16} ${cx - s} ${nk + 6} Z`} fill={shade(base, 0.06)} stroke={darker} strokeWidth={1.1} />
        )}
        {p.collar === 'shirt' && (
          <g fill={shade(base, 0.05)} stroke={darker} strokeWidth={1}>
            <path d={`M ${cx - s * 1.04} ${nk - 2} L ${cx - s * 0.4} ${nk + 24} L ${cx + s * 0.18} ${nk + 10} Q ${cx} ${nk - 6} ${cx - s * 1.04} ${nk - 2} Z`} />
            <path d={`M ${cx + s * 1.04} ${nk - 2} L ${cx + s * 0.4} ${nk + 24} L ${cx - s * 0.18} ${nk + 10} Q ${cx} ${nk - 6} ${cx + s * 1.04} ${nk - 2} Z`} />
          </g>
        )}
        {showLapel && (
          <g fill={shade(base, -0.08)} stroke={darker} strokeWidth={1.1}>
            <path d={`M ${cx - s * 0.96} ${nk} Q ${cx - a.shoulderHalf * 0.55} ${nk + 46} ${cx} ${a.armholeY} L ${cx - a.shoulderHalf * 0.26} ${nk + 42} Q ${cx - a.shoulderHalf * 0.9} ${nk + 8} ${cx - s * 1.0} ${nk} Z`} />
            <path d={`M ${cx + s * 0.96} ${nk} Q ${cx + a.shoulderHalf * 0.55} ${nk + 46} ${cx} ${a.armholeY} L ${cx + a.shoulderHalf * 0.26} ${nk + 42} Q ${cx + a.shoulderHalf * 0.9} ${nk + 8} ${cx + s * 1.0} ${nk} Z`} />
          </g>
        )}

        {p.placket === 'hidden' && (
          <line x1={cx} y1={nk + 12} x2={cx} y2={Math.min(a.waistY + 4, a.hemY - 4)} stroke={darker} strokeWidth={1.6} strokeDasharray="2 2.6" opacity={0.55} />
        )}
        {p.placket === 'tie' && (
          <g>
            <path d={`M ${cx - 5} ${a.armholeY + 8} Q ${cx - 22} ${a.armholeY + 40} ${cx - 26} ${a.armholeY + 62} M ${cx + 5} ${a.armholeY + 8} Q ${cx + 22} ${a.armholeY + 40} ${cx + 26} ${a.armholeY + 62}`} fill="none" stroke={darker} strokeWidth={3.6} strokeLinecap="round" />
            <circle cx={cx} cy={a.armholeY + 10} r={5} fill={accent} stroke={darker} strokeWidth={1} />
          </g>
        )}
        {(p.placket === 'single' || p.placket === 'double') && !isOuter && p.category !== 'suit' && (
          <line x1={cx} y1={nk + (p.collar === 'shirt' ? 22 : 16)} x2={cx} y2={Math.min(a.waistY + 2, a.hemY - 6)} stroke={darker} strokeWidth={0.9} opacity={0.5} />
        )}

        {showBtn && p.category !== 'pants' && Array.from({ length: btnRows }).map((_, i) => {
          const y = a.armholeY + 50 + i * (isOuter ? 32 : 27);
          const xs = p.placket === 'double' ? [cx - 8, cx + 8] : [cx];
          return xs.map((bx) => (
            <g key={`${bx}-${i}`}>
              <circle cx={bx} cy={y} r={isOuter ? 4.6 : 3.6} fill={btnStyle.fill} stroke="rgba(15,8,25,.32)" strokeWidth={0.7} />
              {btnStyle.inner && <circle cx={bx} cy={y} r={1.3} fill={btnStyle.inner} />}
            </g>
          ));
        })}

        {p.pockets === 'patch' && [-1, 1].map((s2) => (
          <rect key={s2} x={s2 < 0 ? cx - a.waistHalf * 1.18 - 34 : cx + a.waistHalf * 1.18} y={Math.min(a.waistY + 16, a.hemY - 44)} width={34} height={p.category === 'shirt' ? 36 : 40} rx={4} fill={shade(base, 0.04)} stroke={darker} strokeWidth={1.2} />
        ))}
        {p.pockets === 'slash' && [-1, 1].map((s2) => (
          <path key={s2} d={`M ${cx + s2 * a.waistHalf * 1.08} ${Math.min(a.waistY + 6, a.hipY)} L ${cx + s2 * (a.waistHalf * 1.08 + 28)} ${Math.min(a.waistY + 30, a.hipY + 18)}`} stroke={darker} strokeWidth={3.4} strokeLinecap="round" opacity={0.6} />
        ))}
        {p.pockets === 'welt' && [-1, 1].map((s2) => (
          <rect key={s2} x={s2 < 0 ? cx - a.waistHalf * 1.18 - 30 : cx + a.waistHalf * 1.18} y={Math.min(a.waistY + 22, a.hemY - 26)} width={30} height={4.8} rx={2.4} fill={darker} opacity={0.6} />
        ))}

        {(p.dart === 'bust' || p.dart === 'waistdart') && (
          <g stroke={darker} strokeWidth={1} opacity={0.42}>
            {[-1, 1].map((s2) => (
              <g key={s2}>
                <line x1={cx + s2 * a.bustHalf * 0.5} y1={a.armholeY + 44} x2={cx + s2 * a.bustHalf * 0.62} y2={a.waistY - 6} />
                {p.dart === 'waistdart' && <line x1={cx + s2 * a.bustHalf * 0.3} y1={a.armholeY + 54} x2={cx + s2 * a.bustHalf * 0.46} y2={a.waistY - 2} />}
              </g>
            ))}
          </g>
        )}
        {p.dart === 'shoulder' && (
          <g stroke={darker} strokeWidth={1} opacity={0.42}>
            {[-1, 1].map((s2) => <line key={s2} x1={cx + s2 * a.shoulderHalf * 0.6} y1={a.shoulderY + 18} x2={cx + s2 * a.bustHalf * 0.6} y2={a.armholeY + 48} />)}
          </g>
        )}

        {p.zipper !== 'none' && (
          <g>
            <line x1={cx + a.bustHalf * 1.14} y1={a.collarTopY + 30} x2={cx + a.bustHalf * 1.14} y2={a.waistY + 10} stroke={darker} strokeWidth={1.1} opacity={0.7} />
            <rect x={cx + a.bustHalf * 1.14 - 3.6} y={a.collarTopY + 20} width={7.2} height={11} rx={2} fill="#fff" stroke={p.zipper === 'metal' ? '#9aa0aa' : darker} strokeWidth={0.8} />
          </g>
        )}

        {p.waist === 'elastic' && (
          <rect x={cx - a.waistHalf * 1.18} y={a.waistY - 7} width={a.waistHalf * 2.36} height={13} rx={6.5} fill={shade(base, 0.1)} stroke={darker} strokeWidth={0.9} opacity={0.95} />
        )}

        {p.category === 'dress' && (
          <path d={`M ${cx - a.waistHalf * 1.18} ${a.waistY} Q ${cx} ${a.waistY + 3} ${cx + a.waistHalf * 1.18} ${a.waistY}`} fill="none" stroke={darker} strokeWidth={1} opacity={0.5} />
        )}
      </g>
    );
  }

  function SkirtDetails() {
    const cx = CX;
    return (
      <g>
        <rect x={cx - a.waistHalf * 1.2} y={a.waistY - 8} width={a.waistHalf * 2.4} height={15} rx={3} fill={p.waist === 'elastic' ? shade(base, -0.07) : shade(base, 0.09)} stroke={darker} strokeWidth={1} />
        {p.pleat !== 'none' && (
          <g>
            {p.pleat === 'pressed' && Array.from({ length: 6 }).map((_, i) => {
              const t = (i + 1) / 7;
              return <line key={i} x1={cx - a.waistHalf * 1.05 + a.waistHalf * 2.1 * t} y1={a.waistY + 10} x2={cx - a.hemHalf + a.hemHalf * 2 * t} y2={a.hemY - 8} stroke={darker} strokeWidth={1.1} opacity={0.5} />;
            })}
            {p.pleat === 'natural' && Array.from({ length: 5 }).map((_, i) => {
              const t = (i + 1) / 6;
              const x = cx - a.waistHalf * 1.05 + a.waistHalf * 2.1 * t;
              const xb = cx - a.hemHalf + a.hemHalf * 2 * t;
              return <path key={i} d={`M ${x} ${a.waistY + 12} Q ${(x + xb) / 2} ${(a.waistY + a.hemY) / 2 + 8} ${xb} ${a.hemY - 6}`} fill="none" stroke={darker} strokeWidth={0.9} opacity={0.5} />;
            })}
            {p.pleat === 'shirred' && [18, 36, 54].map((o) => (
              <path key={o} d={`M ${cx - a.waistHalf * 1.05 + 3} ${a.waistY + o} Q ${cx} ${a.waistY + o + 4} ${cx + a.waistHalf * 1.05 - 3} ${a.waistY + o}`} fill="none" stroke={shade(base, -0.16)} strokeWidth={1.5} opacity={0.8} />
            ))}
          </g>
        )}
        {p.slit === 'back' && <line x1={cx} y1={a.waistY + 12} x2={cx} y2={a.hemY - 6} stroke={darker} strokeWidth={1.1} strokeDasharray="4 4" opacity={0.4} />}
        {p.zipper !== 'none' && (
          <g>
            <line x1={cx + a.waistHalf * 1.05} y1={a.waistY - 8} x2={cx + a.waistHalf * 1.05} y2={a.waistY + 32} stroke={darker} strokeWidth={1.2} opacity={0.75} />
            <rect x={cx + a.waistHalf * 1.05 - 3.4} y={a.waistY - 8} width={6.8} height={10} rx={2} fill="#fff" stroke={p.zipper === 'metal' ? '#9aa0aa' : darker} strokeWidth={0.7} />
          </g>
        )}
        {p.pockets === 'patch' && [-1, 1].map((s2) => (
          <rect key={s2} x={s2 < 0 ? cx - a.waistHalf * 1.05 - 34 : cx + a.waistHalf * 1.05} y={a.waistY + 48} width={34} height={36} rx={4} fill={shade(base, 0.04)} stroke={darker} strokeWidth={1.1} />
        ))}
      </g>
    );
  }

  function PantsDetails() {
    const cx = CX;
    const topY = a.waistY - 6;
    const legTop = ({ slim: 46, fit: 60, loose: 88, a: 80, h: 66 })[p.fit] || 60;
    const hemY = a.hemY;
    return (
      <g>
        <rect x={cx - a.hipHalf * 1.16} y={topY - 3} width={a.hipHalf * 2.32} height={17} rx={3} fill={p.waist === 'elastic' ? shade(base, -0.08) : shade(base, 0.08)} stroke={darker} strokeWidth={1} />
        {p.placket !== 'none' && <line x1={cx} y1={topY} x2={cx} y2={topY + 26} stroke={darker} strokeWidth={1} opacity={0.5} />}
        {showBtn && <circle cx={cx} cy={topY + 10} r={3.6} fill={btnStyle.fill} stroke="rgba(15,8,25,.32)" strokeWidth={0.6} />}
        {p.pleat === 'pressed' && (
          <g stroke={darker} strokeWidth={1} opacity={0.5}>
            <line x1={cx - legTop * 0.64} y1={topY + 20} x2={cx - legTop * 0.74} y2={hemY - 4} />
            <line x1={cx + legTop * 0.64} y1={topY + 20} x2={cx + legTop * 0.74} y2={hemY - 4} />
          </g>
        )}
        {p.pleat === 'natural' && (
          <g stroke={darker} strokeWidth={1} opacity={0.5}>
            <path d={`M ${cx - legTop * 0.9} ${topY + 14} q 8 18 0 34`} fill="none" />
            <path d={`M ${cx + legTop * 0.9} ${topY + 14} q -8 18 0 34`} fill="none" />
          </g>
        )}
        {p.pockets === 'slash' && [-1, 1].map((s2) => (
          <path key={s2} d={`M ${cx + s2 * a.hipHalf * 1.1} ${topY + 12} L ${cx + s2 * (a.hipHalf * 1.1 - 30)} ${topY + 36}`} stroke={darker} strokeWidth={3.4} strokeLinecap="round" opacity={0.6} />
        ))}
        {p.pockets === 'patch' && [-1, 1].map((s2) => (
          <rect key={s2} x={s2 < 0 ? cx - a.hipHalf * 1.1 - 36 : cx + a.hipHalf * 1.1} y={topY + 48} width={36} height={42} rx={5} fill={shade(base, 0.04)} stroke={darker} strokeWidth={1.1} />
        ))}
        {p.zipper === 'metal' && <line x1={cx} y1={topY + 24} x2={cx} y2={topY + 44} stroke="#9aa0aa" strokeWidth={1.4} />}
      </g>
    );
  }

  /* ============ 装饰 ============ */
  function ChestFlower() {
    const cy = a.armholeY + 54;
    const cxx = CX - a.bustHalf * 0.55;
    return (
      <g>
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <ellipse key={i} cx={cxx} cy={cy - 11} rx={3.4} ry={8} fill={accent} opacity={0.94} transform={`rotate(${deg} ${cxx} ${cy})`} />
        ))}
        <circle cx={cxx} cy={cy} r={4.2} fill={shade(accent, 0.34)} stroke={shade(accent, -0.3)} strokeWidth={0.6} />
      </g>
    );
  }
  function Bow() {
    const by = a.collarTopY + 32;
    return (
      <g>
        <path d={`M ${CX} ${by} L ${CX - 15} ${by - 11} Q ${CX - 18} ${by + 3} ${CX} ${by + 4} Z`} fill={accent} stroke={shade(accent, -0.32)} strokeWidth={1} />
        <path d={`M ${CX} ${by} L ${CX + 15} ${by - 11} Q ${CX + 18} ${by + 3} ${CX} ${by + 4} Z`} fill={accent} stroke={shade(accent, -0.32)} strokeWidth={1} />
        <circle cx={CX} cy={by + 1} r={4.6} fill={shade(accent, -0.14)} stroke={shade(accent, -0.36)} strokeWidth={0.8} />
      </g>
    );
  }
  function Pearls() {
    const s = a.neckHalf * 2.2;
    const n = 9;
    return (
      <g>
        {Array.from({ length: n }).map((_, i) => {
          const t = i / (n - 1);
          const x = CX - s + 2 * s * t;
          const depth = p.collar === 'vneck' ? 48 * Math.sin(Math.PI * t) : 12;
          const y = a.collarTopY + 12 + depth;
          return <circle key={i} cx={x} cy={y} r={2.4} fill="#fdfaf4" stroke="rgba(120,95,135,.5)" strokeWidth={0.5} />;
        })}
      </g>
    );
  }
  function LaceHem() {
    const n = Math.max(10, Math.round((a.hemHalf * 2) / 20));
    const seg = (a.hemHalf * 2) / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      d += `a ${seg / 2} ${seg / 2} 0 0 1 ${seg} 0`;
    }
    return (
      <g>
        <path d={`M ${CX - a.hemHalf} ${a.hemY} ${d}`} fill="none" stroke="#f8f4ee" strokeWidth={3.8} opacity={0.96} />
        <path d={`M ${CX - a.hemHalf} ${a.hemY} ${d}`} fill="none" stroke="#cfc4d4" strokeWidth={0.6} opacity={0.5} />
      </g>
    );
  }

  function patternDef() {
    switch (p.pattern) {
      case 'floral': return (
        <pattern id={patternId} width="46" height="46" patternUnits="userSpaceOnUse">
          <rect width="46" height="46" fill={base} />
          <g fill={accent} opacity={0.88}>
            <circle cx="13" cy="13" r="4.4" /><circle cx="33" cy="32" r="4.4" />
          </g>
          <g fill={shade(accent, 0.34)} opacity={0.85}>
            <circle cx="13" cy="13" r="1.9" /><circle cx="33" cy="32" r="1.9" />
          </g>
          <path d="M13 5.5v2.6M5.5 13h2.6M13 20.5v-2.6M20.5 13h-2.6M33 24.5v2.6M25.5 32h2.6M33 39.5v-2.6M40.5 32h-2.6" stroke={accent} strokeWidth="1.1" opacity="0.75" />
        </pattern>
      );
      case 'stripe': return (
        <pattern id={patternId} width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
          <rect width="26" height="26" fill={base} />
          <rect width="9" height="26" fill={shade(base, -0.09)} />
          <rect x="13" width="2" height="26" fill={accent} opacity={0.9} />
        </pattern>
      );
      case 'plaid': return (
        <pattern id={patternId} width="52" height="52" patternUnits="userSpaceOnUse">
          <rect width="52" height="52" fill={base} />
          <rect width="52" height="14" fill={shade(base, -0.08)} />
          <rect width="14" height="52" fill={shade(base, -0.08)} />
          <rect y="22" width="52" height="3.4" fill={accent} opacity="0.8" />
          <rect x="22" width="3.4" height="52" fill={accent} opacity="0.8" />
        </pattern>
      );
      case 'polka': return (
        <pattern id={patternId} width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="34" fill={base} />
          <circle cx="9" cy="9" r="5" fill={accent} opacity="0.85" />
          <circle cx="25" cy="25" r="5" fill={accent} opacity="0.85" />
        </pattern>
      );
      case 'dots2': return (
        <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={base} />
          <g fill={accent} opacity="0.9">
            <circle cx="11" cy="10" r="5.5" /><circle cx="29" cy="30" r="5.5" />
          </g>
          <g fill="none" stroke={accent} strokeWidth="1.4" opacity="0.7">
            <path d="M11 4.5v11M4.5 10h13" /><path d="M29 24.5v11M22.5 30h13" />
          </g>
        </pattern>
      );
      case 'geo': return (
        <pattern id={patternId} width="44" height="44" patternUnits="userSpaceOnUse">
          <rect width="44" height="44" fill={base} />
          <path d="M0 22h44M22 0v44M0 0l44 44M44 0 0 44" stroke={shade(base, -0.13)} strokeWidth="2.2" opacity="0.9" />
          <circle cx="22" cy="22" r="4.4" fill={accent} opacity="0.9" />
        </pattern>
      );
      default: return null;
    }
  }

  function neckEdgeStitch(): string {
    const s = a.neckHalf * 2.3;
    const y0 = a.collarTopY + 8;
    const cx = CX;
    if (isPants || isSkirt) return '';
    switch (p.collar) {
      case 'vneck': return `M ${cx - s} ${y0} L ${cx} ${y0 + 58} L ${cx + s} ${y0}`;
      case 'square': return `M ${cx - s} ${y0} L ${cx - s * 0.62} ${y0} L ${cx - s * 0.62} ${y0 + 40} L ${cx + s * 0.62} ${y0 + 40} L ${cx + s * 0.62} ${y0} L ${cx + s} ${y0}`;
      case 'shirt': return `M ${cx - s} ${y0 + 2} L ${cx - s * 0.42} ${y0 + 12} L ${cx} ${y0 + 18} L ${cx + s * 0.42} ${y0 + 12} L ${cx + s} ${y0 + 2}`;
      case 'boat': return `M ${cx - s} ${y0 - 4} Q ${cx} ${y0 - 14} ${cx + s} ${y0 - 4}`;
      case 'stand': return `M ${cx - s} ${y0} Q ${cx} ${y0 - 6} ${cx + s} ${y0}`;
      default: return `M ${cx - s} ${y0} Q ${cx} ${y0 + 32} ${cx + s} ${y0}`;
    }
  }

  function neckInnerLine(): string {
    if (isSkirt || isPants) return '';
    return neckEdgeStitch();
  }
}

/* ============ 虚拟人台 ============ */
function Model({ a, p }: { a: Anchors; p: DesignParams }) {
  const cx = CX;
  const torso = '#efe3d8';
  const line = '#d6c5b4';
  const waistY = a.waistY;
  const hemY = a.hemY;
  const isPants = p.category === 'pants';
  const showArms = p.category !== 'skirt' && !isPants;
  return (
    <g opacity={0.94}>
      <ellipse cx={cx} cy={27} rx={15} ry={16.5} fill={torso} stroke={line} strokeWidth={1.2} />
      <path d={`M ${cx - 5.5} ${20} q 2 2.6 0 5 q 2.8 2.2 0 4.6`} stroke={line} strokeWidth={1} fill="none" opacity={0.55} />
      <rect x={cx - 6.5} y={40} width={13} height={18} rx={5} fill={torso} stroke={line} strokeWidth={1} />
      <path
        d={`M ${cx - a.shoulderHalf * 0.98} ${a.shoulderY + 10}
           Q ${cx} ${a.shoulderY - 10} ${cx + a.shoulderHalf * 0.98} ${a.shoulderY + 10}
           L ${cx + a.bustHalf * 0.66} ${waistY}
           Q ${cx + a.bustHalf * 0.46} ${waistY + 28} ${cx + a.hipHalf * 0.52} ${a.hipY + 8}
           L ${cx - a.hipHalf * 0.52} ${a.hipY + 8}
           Q ${cx - a.bustHalf * 0.46} ${waistY + 28} ${cx - a.bustHalf * 0.66} ${waistY} Z`}
        fill={torso} stroke={line} strokeWidth={1.2}
      />
      {showArms && [-1, 1].map((s) => (
        <path
          key={s}
          d={`M ${cx + s * a.shoulderHalf * 0.94} ${a.shoulderY + 6}
             Q ${cx + s * (a.shoulderHalf * 0.94 + 11)} ${a.shoulderY + 30} ${cx + s * (a.shoulderHalf * 0.94 + 10)} ${a.armholeY + 70}
             Q ${cx + s * (a.shoulderHalf * 0.94 + 6)} ${a.armholeY + 160} ${cx + s * (a.shoulderHalf * 0.9)} ${a.armholeY + 176}
             L ${cx + s * (a.shoulderHalf * 0.9 - 8)} ${a.armholeY + 170}
             Q ${cx + s * (a.shoulderHalf * 0.9 - 7)} ${a.armholeY + 100} ${cx + s * (a.shoulderHalf * 0.9 - 5)} ${a.armholeY + 50}
             Q ${cx + s * (a.shoulderHalf * 0.88)} ${a.shoulderY + 20} ${cx + s * a.shoulderHalf * 0.94} ${a.shoulderY + 6} Z`}
          fill={torso} stroke={line} strokeWidth={1.1}
        />
      ))}
      {!isPants && hemY < 506 && [-1, 1].map((s) => (
        <path
          key={s}
          d={`M ${cx + s * a.hipHalf * 0.36} ${Math.max(hemY + 6, a.hipY + 10)}
             L ${cx + s * a.hipHalf * 0.34} 514 L ${cx + s * (a.hipHalf * 0.34 - 12)} 514 L ${cx + s * (a.hipHalf * 0.36 - 12)} ${Math.max(hemY + 6, a.hipY + 10)} Z`}
          fill={torso} stroke={line} strokeWidth={1.1}
        />
      ))}
    </g>
  );
}
