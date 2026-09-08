/**
 * DXF R12 子集解析器（纯 TS，无第三方）：
 * 支持 HEADER(跳过)、TABLES/Layer(名字+颜色号)、ENTITIES 中
 * LINE / LWPOLYLINE(含 bulge→圆弧样条化) / CIRCLE / ARC / POINT / TEXT / INSERT(跳过)。
 * 输出：layerNames、entityCount、patternSvg（各实体按图层上色、自动包围盒/视图变换、
 * 内联 SVG，含比例说明与标注线）。解析失败或残缺返回 parseWarn（部分仍可渲染）。
 */

export interface DxfParseResult {
  layerNames: string[];
  entityCount: number;
  patternSvg: string;
  width: number;
  height: number;
  parseWarn?: string;
  note?: string;
}

interface Pair { code: string; val: string; }

type Num = number;
interface Vec { x: Num; y: Num; }

type RawEnt =
  | { type: 'LINE'; layer: string; a: Vec; b: Vec }
  | { type: 'LWPOLYLINE'; layer: string; closed: boolean; pts: { x: number; y: number; bulge: number }[] }
  | { type: 'CIRCLE'; layer: string; c: Vec; r: number }
  | { type: 'ARC'; layer: string; c: Vec; r: number; a0: number; a1: number }
  | { type: 'POINT'; layer: string; p: Vec }
  | { type: 'TEXT'; layer: string; p: Vec; height: number; text: string }
  | { type: 'INSERT'; layer: string }
  | { type: 'UNKNOWN'; layer: string };

interface LayerDef { name: string; color: number; }

/* ------------------------------------------------------------------ */
/* 基础读取                                                             */
/* ------------------------------------------------------------------ */

function readPairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    if (code === '') { i -= 1; continue; } // 容忍空行
    out.push({ code, val: lines[i + 1].trim() });
  }
  return out;
}

function sectionContent(pairs: Pair[], name: string): Pair[] {
  for (let i = 0; i + 1 < pairs.length; i++) {
    if (pairs[i].code === '0' && pairs[i].val === 'SECTION' &&
      pairs[i + 1] && pairs[i + 1].code === '2' && pairs[i + 1].val === name) {
      const c: Pair[] = [];
      let j = i + 2;
      while (j < pairs.length && !(pairs[j].code === '0' && pairs[j].val === 'ENDSEC')) {
        c.push(pairs[j]); j++;
      }
      return c;
    }
  }
  return [];
}

function get(pairs: Pair[], start: number, code: string): string {
  for (let i = start; i < pairs.length; i++) {
    if (pairs[i].code === '0') break;
    if (pairs[i].code === code) return pairs[i].val;
  }
  return '';
}

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

/** 解析 LAYER 表 */
function parseLayers(content: Pair[]): LayerDef[] {
  const layers: LayerDef[] = [];
  let i = 0;
  while (i < content.length) {
    if (content[i].code === '0' && content[i].val === 'LAYER') {
      let name = '0'; let color = 7;
      let j = i + 1;
      while (j < content.length && !(content[j].code === '0')) {
        if (content[j].code === '2') name = content[j].val;
        if (content[j].code === '62') color = Math.trunc(num(content[j].val));
        j++;
      }
      layers.push({ name, color });
      i = j;
    } else i++;
  }
  return layers;
}

/** 解析 ENTITIES */
function parseEntities(content: Pair[]): RawEnt[] {
  const ents: RawEnt[] = [];
  let i = 0;
  const pushed: RawEnt[] = [];
  void pushed;
  while (i < content.length) {
    if (content[i].code === '0') {
      const t = content[i].val;
      let j = i + 1;
      // 收集该实体字段
      const field = (code: string): string => get(content, j, code);
      const layer = field('8') || '0';
      if (t === 'LINE') {
        ents.push({
          type: 'LINE', layer,
          a: { x: num(field('10')), y: num(field('20')) },
          b: { x: num(field('11')), y: num(field('21')) },
        });
      } else if (t === 'LWPOLYLINE') {
        const pts: { x: number; y: number; bulge: number }[] = [];
        let closed = false;
        let k = j;
        while (k < content.length && !(content[k].code === '0')) {
          if (content[k].code === '70') closed = (Math.trunc(num(content[k].val)) & 1) === 1;
          if (content[k].code === '90') { /* 顶点数（可选） */ }
          if (content[k].code === '10') {
            const x = num(content[k].val);
            let y = 0; let bulge = 0;
            if (content[k + 1] && content[k + 1].code === '20') { y = num(content[k + 1].val); k++; }
            if (content[k + 1] && content[k + 1].code === '42') { bulge = num(content[k + 1].val); k++; }
            pts.push({ x, y, bulge });
          }
          k++;
        }
        ents.push({ type: 'LWPOLYLINE', layer, closed, pts });
      } else if (t === 'CIRCLE') {
        ents.push({ type: 'CIRCLE', layer, c: { x: num(field('10')), y: num(field('20')) }, r: num(field('40')) });
      } else if (t === 'ARC') {
        ents.push({
          type: 'ARC', layer,
          c: { x: num(field('10')), y: num(field('20')) }, r: num(field('40')),
          a0: num(field('50')), a1: num(field('51')),
        });
      } else if (t === 'POINT') {
        ents.push({ type: 'POINT', layer, p: { x: num(field('10')), y: num(field('20')) } });
      } else if (t === 'TEXT') {
        ents.push({
          type: 'TEXT', layer,
          p: { x: num(field('10')), y: num(field('20')) },
          height: num(field('40')) || 30,
          text: field('1'),
        });
      } else if (t === 'INSERT') {
        ents.push({ type: 'INSERT', layer });
      } else {
        ents.push({ type: 'UNKNOWN', layer });
      }
      // 跳到下一个 0 组
      while (j < content.length && content[j].code !== '0') j++;
      i = j;
    } else i++;
  }
  return ents;
}

/* ------------------------------------------------------------------ */
/* 几何 → 采样点                                                        */
/* ------------------------------------------------------------------ */

/** 圆弧采样（bulge/ARC/CIRCLE 通用），theta>0 逆时针 */
function arcSamples(c: Vec, r: number, a0: number, theta: number, n: number): Vec[] {
  const out: Vec[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + (theta * k) / n;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/** 由 bulge 计算圆心与圆心角（P0→P1） */
function bulgeArc(c0: Vec, c1: Vec, bulge: number): { center: Vec; r: number; a0: number; theta: number } {
  const theta = 4 * Math.atan(bulge);            // 圆心角(带符号)
  const dx = c1.x - c0.x; const dy = c1.y - c0.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return { center: c0, r: 0, a0: 0, theta: 0 };
  const sin2 = Math.sin(theta / 2);
  const r = Math.abs(chord / (2 * Math.max(1e-9, sin2)));
  const h = chord / (2 * Math.max(1e-9, Math.tan(theta / 2))); // 弦中点到圆心距离（带符号）
  // 圆心在 P0→P1 前进方向的左侧(+theta 即逆时针)
  const mx = (c0.x + c1.x) / 2; const my = (c0.y + c1.y) / 2;
  const nx = -dy / chord; const ny = dx / chord; // 单位左法向
  const center = { x: mx + nx * h, y: my + ny * h };
  const a0 = Math.atan2(c0.y - center.y, c0.x - center.x);
  return { center, r, a0, theta };
}

interface PathShape { layer: string; pts: Vec[]; closed: boolean; fill: boolean; kind: 'curve' | 'line'; }

function entityToShapes(e: RawEnt): { shapes: PathShape[]; texts: { x: number; y: number; text: string; height: number; layer: string }[]; notes: Vec[] } {
  const shapes: PathShape[] = [];
  const texts: { x: number; y: number; text: string; height: number; layer: string }[] = [];
  const notes: Vec[] = [];
  switch (e.type) {
    case 'LINE': {
      shapes.push({ layer: e.layer, pts: [e.a, e.b], closed: false, fill: false, kind: 'line' });
      break;
    }
    case 'LWPOLYLINE': {
      const pts = e.pts;
      const ptsOut: Vec[] = [];
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        ptsOut.push({ x: p0.x, y: p0.y });
        if (p0.bulge && p0.bulge !== 0) {
          const { center, r, a0, theta } = bulgeArc({ x: p0.x, y: p0.y }, { x: p1.x, y: p1.y }, p0.bulge);
          if (r > 0) {
            const segs = Math.max(3, Math.min(24, Math.ceil(Math.abs(theta) / (Math.PI / 10))));
            const arcs = arcSamples(center, r, a0, theta, segs);
            for (let s = 1; s < arcs.length; s++) ptsOut.push(arcs[s]); // 去掉首点(重复 p0)
          }
        }
      }
      shapes.push({ layer: e.layer, pts: ptsOut, closed: e.closed, fill: e.closed, kind: 'curve' });
      break;
    }
    case 'CIRCLE': {
      const segs = 32;
      shapes.push({ layer: e.layer, pts: arcSamples(e.c, e.r, 0, Math.PI * 2, segs), closed: true, fill: false, kind: 'curve' });
      break;
    }
    case 'ARC': {
      const d = e.a1 - e.a0; // 角度为度数；DXF ARC 方向逆时针（默认）
      const segs = Math.max(6, Math.min(48, Math.ceil(Math.abs(d) / 8)));
      shapes.push({ layer: e.layer, pts: arcSamples(e.c, e.r, (e.a0 * Math.PI) / 180, (d * Math.PI) / 180, segs), closed: false, fill: false, kind: 'curve' });
      break;
    }
    case 'POINT': {
      notes.push(e.p);
      break;
    }
    case 'TEXT': {
      texts.push({ x: e.p.x, y: e.p.y, text: e.text, height: e.height || 30, layer: e.layer });
      break;
    }
    default: break; // INSERT / UNKNOWN 跳过
  }
  return { shapes, texts, notes };
}

/* ------------------------------------------------------------------ */
/* 图层配色                                                            */
/* ------------------------------------------------------------------ */

const PALETTE: [string, string][] = [
  ['#D44771', '#E85C87'], ['#3B82F6', '#60A5FA'], ['#10B981', '#34D399'], ['#F59E0B', '#FBBF24'],
  ['#8B5CF6', '#A78BFA'], ['#06B6D4', '#22D3EE'], ['#EF4444', '#F87171'], ['#64748B', '#94A3B8'],
  ['#0EA5E9', '#38BDF8'], ['#84CC16', '#A3E635'], ['#EC4899', '#F472B6'], ['#78716C', '#A8A29E'],
];

function layerColor(layers: LayerDef[], name: string): string {
  const def = layers.find((l) => l.name === name);
  let c = def ? def.color : 7;
  if (c <= 0) c = 7;
  if (c === 7) return '#2E2E33';      // 白/黑按近黑处理
  if (c === 1) return '#D44771';      // 结构主色（品牌色）红
  if (c === 2) return '#E8A13A';      // 黄
  if (c === 3) return '#3FA66B';      // 绿
  if (c === 4) return '#3A9BD5';      // 青
  if (c === 5) return '#3B6FE0';      // 蓝
  if (c === 6) return '#C04FC9';      // 品红
  if (c === 8) return '#9AA0A6';      // 灰
  if (c === 9) return '#C9CDD3';
  const k = PALETTE[Math.abs(c) % PALETTE.length];
  return k ? k[0] : '#2E2E33';
}

const LAYER_LABEL: Record<string, string> = {
  '轮廓线': '轮廓线', '结构线': '结构线', '辅助线': '辅助线', '标注': '标注', '0': '图层 0',
};

/* ------------------------------------------------------------------ */
/* SVG 生成                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number, d = 1): string {
  const v = Number(n.toFixed(d));
  return String(v);
}

export function parseDxf(text: string, opts?: { title?: string }): DxfParseResult {
  const pairs = readPairs(text);
  const layers = parseLayers(sectionContent(pairs, 'TABLES'));
  const rawEnts = parseEntities(sectionContent(pairs, 'ENTITIES'));
  const entityCount = rawEnts.length;
  const warns: string[] = [];
  if (layers.length === 0) warns.push('未找到 LAYER 表，按默认图层渲染');
  if (entityCount === 0) warns.push('ENTITIES 中未解析到可渲染实体（LINE/LWPOLYLINE/CIRCLE/ARC/POINT/TEXT）');

  const layerNames = layers.length ? layers.map((l) => l.name) : (entityCount ? ['0'] : []);

  // 实体 → 形状
  const allShapes: PathShape[] = [];
  const allTexts: { x: number; y: number; text: string; height: number; layer: string }[] = [];
  const allNotes: Vec[] = [];
  for (const e of rawEnts) {
    const { shapes, texts, notes } = entityToShapes(e);
    allShapes.push(...shapes); allTexts.push(...texts); allNotes.push(...notes);
  }

  // 包围盒
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  const visit = (v: Vec) => {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  };
  for (const s of allShapes) s.pts.forEach(visit);
  for (const t of allTexts) visit(t);
  for (const n of allNotes) visit(n);

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX - minX < 1e-6 || maxY - minY < 1e-6) {
    // 无可渲染内容：返回占位 SVG
    return {
      layerNames,
      entityCount,
      width: 0,
      height: 0,
      patternSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260"><rect width="420" height="260" fill="#ffffff"/><text x="210" y="128" text-anchor="middle" fill="#9AA0A6" font-size="16">未解析到可渲染几何（请确认 DXF 为 R12 且包含 ENTITIES）</text></svg>`,
      parseWarn: warns.join('；') || '文件无可用实体',
    };
  }

  const wModel = maxX - minX; const hModel = maxY - minY;

  // 视口变换：Y 轴翻转（DXF Y 向上 → SVG Y 向下），留白放标注
  const marginL = 84; const marginR = 30; const marginT = 66; const marginB = 62;
  const viewW = Math.max(200, 940 - marginL - marginR);
  const viewH = Math.max(200, 620 - marginT - marginB);
  const s = Math.min(viewW / wModel, viewH / hModel);
  const canvasW = Math.ceil(marginL + wModel * s + marginR);
  const canvasH = Math.ceil(marginT + hModel * s + marginB);
  const sx = (x: number) => marginL + (x - minX) * s;
  const sy = (y: number) => marginT + (maxY - y) * s;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}" font-family="PingFang SC, Microsoft YaHei, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="#ffffff"/>`);

  // 标题 + 图例
  const title = opts?.title || 'DXF 打版图';
  parts.push(`<text x="${marginL}" y="26" font-size="15" font-weight="600" fill="#2E2E33">${esc(title)}</text>`);
  parts.push(`<text x="${marginL}" y="46" font-size="10.5" fill="#8A8F98">图层 ${layerNames.length} · 实体 ${entityCount} · 1 比例示意（DXF 单位）</text>`);
  // 标注线/标尺外框
  parts.push(`<text x="${canvasW - marginR}" y="26" text-anchor="end" font-size="10.5" fill="#8A8F98">${esc(layerNames.join(' / ') || '-')}</text>`);

  // 实体描边
  const uniq = new Map<string, string>();
  for (const sh of allShapes) {
    const color = layerColor(layers, sh.layer);
    const pts = sh.pts;
    if (pts.length < 2) continue;
    let d = `M ${fmt(sx(pts[0].x))} ${fmt(sy(pts[0].y))}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${fmt(sx(pts[i].x))} ${fmt(sy(pts[i].y))}`;
    if (sh.closed) d += ' Z';
    const fill = sh.closed && sh.fill ? `${color}14` : 'none';
    const extra = sh.kind === 'line' ? ' stroke-dasharray="6 4"' : '';
    parts.push(`<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${sh.kind === 'line' ? 1.1 : 1.6}" stroke-linejoin="round"${extra}/>`);
    uniq.set(sh.layer, color);
  }
  // POINT → 十字刀口标记
  for (const n of allNotes) {
    const color = layerColor(layers, '辅助线');
    parts.push(`<path d="M ${fmt(sx(n.x) - 4)} ${fmt(sy(n.y))} L ${fmt(sx(n.x) + 4)} ${fmt(sy(n.y))} M ${fmt(sx(n.x))} ${fmt(sy(n.y) - 4)} L ${fmt(sx(n.x))} ${fmt(sy(n.y) + 4)}" stroke="${color}" stroke-width="1.2"/>`);
    parts.push(`<circle cx="${fmt(sx(n.x))}" cy="${fmt(sy(n.y))}" r="1.6" fill="${color}"/>`);
  }
  // TEXT
  for (const t of allTexts) {
    if (!t.text) continue;
    const fs = Math.max(9, Math.min(13, t.height * s * 0.9));
    parts.push(`<text x="${fmt(sx(t.x))}" y="${fmt(sy(t.y) - 4)}" font-size="${fmt(fs, 1)}" fill="#565B63">${esc(t.text)}</text>`);
  }

  // 图例（图层配色）
  const legendLayers = layers.filter((l) => uniq.has(l.name) || true).slice(0, 8);
  if (layers.length === 0 && entityCount > 0) legendLayers.push({ name: '0', color: 7 });
  let lx = canvasW - marginR;
  for (let i = legendLayers.length - 1; i >= 0; i--) {
    const l = legendLayers[i];
    const color = layerColor(layers, l.name);
    const label = LAYER_LABEL[l.name] || l.name;
    const w = 12 + label.length * 9 + 26;
    lx -= w;
    parts.push(`<rect x="${fmt(lx)}" y="32" width="9" height="9" rx="1.5" fill="${color}"/>`);
    parts.push(`<text x="${fmt(lx + 13)}" y="40" font-size="10" fill="#8A8F98">${esc(label)}</text>`);
  }

  // 尺寸标注：底宽 + 右高（模型单位）
  const dimY = canvasH - 26;
  parts.push(`<line x1="${fmt(sx(minX))}" y1="${fmt(dimY)}" x2="${fmt(sx(maxX))}" y2="${fmt(dimY)}" stroke="#C2C6CC" stroke-width="1"/>`);
  parts.push(`<line x1="${fmt(sx(minX))}" y1="${fmt(dimY - 5)}" x2="${fmt(sx(minX))}" y2="${fmt(dimY + 5)}" stroke="#C2C6CC"/>`);
  parts.push(`<line x1="${fmt(sx(maxX))}" y1="${fmt(dimY - 5)}" x2="${fmt(sx(maxX))}" y2="${fmt(dimY + 5)}" stroke="#C2C6CC"/>`);
  parts.push(`<rect x="${fmt((sx(minX) + sx(maxX)) / 2 - 40)}" y="${fmt(dimY - 13)}" width="80" height="14" fill="#ffffff"/>`);
  parts.push(`<text x="${fmt((sx(minX) + sx(maxX)) / 2)}" y="${fmt(dimY - 2)}" text-anchor="middle" font-size="10.5" fill="#565B63">${fmt(wModel)} 单位</text>`);
  const dimXR = canvasW - 12;
  parts.push(`<line x1="${fmt(dimXR)}" y1="${fmt(sy(minY))}" x2="${fmt(dimXR)}" y2="${fmt(sy(maxY))}" stroke="#C2C6CC" stroke-width="1"/>`);
  parts.push(`<line x1="${fmt(dimXR - 5)}" y1="${fmt(sy(minY))}" x2="${fmt(dimXR + 5)}" y2="${fmt(sy(minY))}" stroke="#C2C6CC"/>`);
  parts.push(`<line x1="${fmt(dimXR - 5)}" y1="${fmt(sy(maxY))}" x2="${fmt(dimXR + 5)}" y2="${fmt(sy(maxY))}" stroke="#C2C6CC"/>`);
  const midY = (sy(minY) + sy(maxY)) / 2;
  parts.push(`<text x="${fmt(dimXR + 4)}" y="${fmt(midY + 3)}" font-size="10.5" fill="#565B63">${fmt(hModel)}</text>`);

  parts.push('</svg>');

  return {
    layerNames,
    entityCount,
    width: Math.round(wModel),
    height: Math.round(hModel),
    patternSvg: parts.join('\n'),
    parseWarn: warns.length ? warns.join('；') : undefined,
    note: `DXF R12 解析：${rawEnts.length} 个实体 / ${layers.length} 个图层；圆弧(bulge)已还原为路径。`,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 供 seed/import 使用：DxfParseResult 转 Material 需要的摘要 */
export function dxfMaterialSummary(r: DxfParseResult): { layerNames: string[]; entityCount: number; patternSvg: string; width: number; height: number; parseWarn?: string; note?: string } {
  return {
    layerNames: r.layerNames,
    entityCount: r.entityCount,
    patternSvg: r.patternSvg,
    width: r.width,
    height: r.height,
    parseWarn: r.parseWarn,
    note: r.note,
  };
}
