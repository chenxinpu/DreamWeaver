import type { CategoryKey, DesignParams } from './design';
import { LENGTH_RANGE } from './design';

/* =========================================================
 * 2D 版片（纸样）几何引擎 —— 与 3D 参数同源
 * 版片 = 参数(DesignParams) 的几何投影；手柄拖拽 = 修改连续参数(长度/腰松/摆量)
 * ========================================================= */

export const SHEET_W = 210;   // 单张版片画布宽（本地坐标）
export const SHEET_H = 300;

export interface PatternPieceDef {
  id: string;
  name: string;
  qty: number;
  fold?: boolean;           // 对折裁（画 1/2）
  fabric?: 'shell' | 'lining';
  note?: string;
}

export interface Handle {
  id: string;
  param: 'lengthCm' | 'waistMul' | 'hemMul';
  x: number;
  y: number;
  dir: 'v' | 'h';           // 拖拽方向
  hint: string;
}

export interface DimLine {
  label: string;
  cm: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface PatternSheet {
  pieceId: string;
  name: string;
  qty: number;
  fold?: boolean;
  /** 版片闭合路径（1/2：左缘=对折中线，右缘=侧缝；整片：左右对称） */
  path: string;
  /** 对折中线（虚线） */
  foldLine?: string;
  /** 纱向线 */
  grain?: string;
  handles: Handle[];
  dims: DimLine[];
  notches: { x: number; y: number }[];
}

/* ---------- 基础度量（与 DressCanvas anchors 同源思路，供版片投影） ---------- */
const FIT_W: Record<string, number> = { slim: 0.8, fit: 0.92, loose: 1.12, a: 0.9, h: 1.02 };
const FIT_HEM: Record<string, number> = { slim: 0.96, fit: 1.06, loose: 1.44, a: 1.85, h: 1.24 };
const BASE_BUST = 60;

function catPieces(cat: CategoryKey): PatternPieceDef[] {
  switch (cat) {
    case 'dress': return [
      { id: 'front', name: '前片（连裙）', qty: 1, fold: true },
      { id: 'back', name: '后片（连裙）', qty: 1, fold: true },
      { id: 'sleeve', name: '袖片', qty: 2 },
    ];
    case 'shirt': return [
      { id: 'front', name: '前身片', qty: 1, fold: true },
      { id: 'back', name: '后身片', qty: 1, fold: true },
      { id: 'sleeve', name: '袖片', qty: 2 },
    ];
    case 'skirt': return [
      { id: 'front', name: '前裙片', qty: 1, fold: true },
      { id: 'back', name: '后裙片', qty: 1, fold: true },
      { id: 'band', name: '腰头（直裁）', qty: 1 },
    ];
    case 'coat': return [
      { id: 'front', name: '前片', qty: 2 },
      { id: 'back', name: '后片', qty: 1, fold: true },
      { id: 'sleeve', name: '袖片', qty: 2 },
    ];
    case 'pants': return [
      { id: 'front', name: '前裤片', qty: 2 },
      { id: 'back', name: '后裤片', qty: 2 },
      { id: 'band', name: '腰头（直裁）', qty: 1 },
    ];
    case 'suit': return [
      { id: 'front', name: '前片（上衣）', qty: 2 },
      { id: 'back', name: '后片', qty: 1, fold: true },
      { id: 'sleeve', name: '袖片', qty: 2 },
    ];
  }
}

/* ---------- 长度→版片高度映射（px） ---------- */
function lengthPx(cm: number, base: number, k: number): number {
  return base + cm * k;
}

/* ---------- 尺寸标注小工具 ---------- */
function dimHL(label: string, cm: number, x: number, y: number): DimLine {
  return { label, cm, from: { x, y }, to: { x: x + 46, y } };
}

/* =========================================================
 * 每品类版片几何
 * 约定：1/2 片左缘 x=18 为对折中线；整片左右对称于 x=SHEET_W/2
 * ========================================================= */
function clamp01(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function bodyPiece(params: DesignParams, kind: 'front' | 'back'): PatternSheet | null {
  const cat = params.category;
  const fitW = FIT_W[params.fit] || 0.92;
  const fitH = FIT_HEM[params.fit] || 1.06;
  const isDress = cat === 'dress';
  const isCoat = cat === 'coat' || cat === 'suit';
  const len = LENGTH_RANGE[cat];
  const cm = clamp01(params.lengthCm, len.min, len.max);
  const fold = !isCoat; // 外套前片左右开 → 画整片两侧（简化：仍 1/2 但 qty2 由 def 处理）
  void fold;

  const baseH = lengthPx(cm, 26, isDress ? 2.0 : isCoat ? 2.0 : 1.55);
  const H = Math.min(284, baseH);
  const lenK = baseH > 284 ? 284 / baseH : 1;

  const bust = BASE_BUST;
  const waist = bust * fitW * (params.waistMul ?? 1);
  const hem = Math.min(96, bust * fitH * (params.hemMul ?? 1));
  const halfW = Math.max(waist, hem, bust) + 6;

  const kx = Math.min(1, (SHEET_W - 64) / halfW); // 归一到画布
  const yTop = 16;
  const ySh = yTop + (isCoat ? 14 : 10) * lenK;
  const yArm = yTop + (isDress ? 64 : isCoat ? 62 : 52) * lenK;
  const yWaist = yTop + (26 + cm * (isDress ? 0.78 : isCoat ? 0.8 : 0.9)) * lenK;
  const yHip = yTop + (60 + cm * (isDress ? 0.9 : isCoat ? 0.95 : 1.0)) * lenK;

  const neckDip = kind === 'back' ? 2 : 10;
  const neckX = 20 * kx;

  // 使用折线位于左缘 x=16
  const w = (v: number) => 16 + v * kx;
  const topPt = { x: 16, y: yTop };
  const path: string[] = [];
  path.push(`M ${topPt.x} ${topPt.y}`);
  // 领口（自中线向右）
  if (kind === 'front') {
    path.push(`Q ${16 + neckX * 0.4} ${yTop + neckDip * 0.4 * lenK} ${16 + neckX} ${yTop + neckDip * lenK}`);
    path.push(`L ${w(bust * 0.96)} ${ySh}`);
  } else {
    path.push(`L ${w(bust * 0.96)} ${yTop + 6 * lenK}`);
  }
  // 肩→袖窿→胸
  path.push(`Q ${w(bust * 0.98)} ${yArm - 4 * lenK} ${w(bust * 0.86)} ${yArm}`);
  // 胸→腰
  path.push(`Q ${w(bust)} ${(yArm + yWaist) / 2} ${w(waist)} ${yWaist}`);
  // 腰→胯→摆
  path.push(`Q ${w(Math.max(waist, hem) * 0.96)} ${(yWaist + yHip) / 2} ${w(Math.max(waist, hem))} ${yHip}`);
  path.push(`L ${w(hem)} ${H - 8}`);
  // 摆边
  path.push(`Q ${16 + (w(hem) - 16) * 0.5} ${H + 4 * lenK} ${16} ${H}`);
  path.push('Z');
  const d = path.join(' ');

  const dims: DimLine[] = [];
  dims.push(dimHL('衣长', Math.round(cm), 6, yTop + 4));
  dims.push(dimHL('腰围', Math.round(waist * 2 * 1.0), w(waist) - 4, Math.min(H - 14, yHip + 8)));
  const waistYdim = Math.min(H - 16, Math.max(yWaist + 10, yHip + 2));
  void waistYdim;
  const handles: Handle[] = [];
  const hemEndX = w(hem);
  handles.push({
    id: 'hem', param: 'hemMul', x: hemEndX, y: H, dir: 'h', hint: '横向拖动=摆量',
  });
  handles.push({ id: 'hemV', param: 'lengthCm', x: hemEndX, y: H, dir: 'v', hint: '竖向拖动=衣长' });
  // 摆量标注（另画）
  dims.push({ label: '摆宽', cm: Math.round(hem * 2), from: { x: 16, y: H + 10 }, to: { x: w(hem), y: H + 10 } });
  // 腰侧手柄
  handles.push({ id: 'waist', param: 'waistMul', x: w(waist), y: yWaist, dir: 'h', hint: '横向拖动=腰围松量' });
  dims.push({ label: '腰宽', cm: Math.round(waist * 2), from: { x: 16, y: yWaist + 14 }, to: { x: w(waist), y: yWaist + 14 } });

  return {
    pieceId: kind,
    name: kind === 'front' ? (isDress ? '前片（连裙）' : isCoat ? '前片' : '前身片') : (isDress ? '后片（连裙）' : isCoat ? '后片' : '后身片'),
    qty: 1,
    fold: true,
    path: d,
    foldLine: `M 16 14 L 16 ${H + 6}`,
    grain: `M ${16 + (w(Math.max(waist, hem)) - 16) * 0.5} ${yTop + 20} L ${16 + (w(Math.max(waist, hem)) - 16) * 0.5} ${H - 20}`,
    handles,
    dims,
    notches: [
      { x: w(waist), y: yWaist },
      { x: w(hem), y: H - 8 },
      { x: w(bust), y: (yArm + yWaist) / 2 },
    ],
  };
}

function sleevePiece(params: DesignParams): PatternSheet | null {
  const type = params.sleeve;
  if (type === 'none') return null;
  const catLen: Record<string, number> = { short: 96, long: 210, puff: 176, lantern: 174, bell: 158 };
  const Lpx = catLen[type] || 130;
  const cap = { short: 1.0, long: 1.0, puff: 1.42, lantern: 1.26, bell: 1.18 }[type] || 1;
  const cuff = { short: 0.62, long: 0.5, puff: 0.48, lantern: 0.5, bell: 0.96 }[type] || 0.6;
  const W = 46;
  const Hpx = Math.min(270, 30 + Lpx);
  const cy = SHEET_W / 2;
  const capW = W * cap;
  // 袖山弧（上宽下窄再到袖口/喇叭）
  const capTopY = 20;
  const cuffY = Hpx - 14;
  const cuffW = W * cuff;
  const midBulge = type === 'lantern' ? W * 1.32 : type === 'puff' ? W * 1.18 : W;
  let d = `M ${cy - capW * 0.5} ${capTopY + 8}
    Q ${cy - capW * 0.85} ${capTopY - 4} ${cy - capW * 0.3} ${capTopY - 6}
    Q ${cy + capW * 0.3} ${capTopY - 6} ${cy + capW * 0.85} ${capTopY - 4}
    Q ${cy + capW * 0.5} ${capTopY + 8} ${cy + capW * 0.5} ${capTopY + 22}
    L ${cy + midBulge} ${capTopY + 66}
    L ${cy + cuffW} ${cuffY}`;
  if (type === 'bell') {
    d += ` Q ${cy + cuffW * 1.3} ${cuffY + 10} ${cy} ${cuffY + 12}`;
  } else {
    d += ` Q ${cy + cuffW * 0.4} ${cuffY + 12} ${cy} ${cuffY + 10}`;
  }
  d += ` Q ${cy - cuffW * 0.4} ${cuffY + 12} ${cy - cuffW} ${cuffY}
    L ${cy - midBulge} ${capTopY + 66}
    L ${cy - capW * 0.5} ${capTopY + 22} Z`;
  const dims: DimLine[] = [];
  const cmLen = params.lengthCm;
  void cmLen;
  dims.push(dimHL(type === 'short' ? '袖长(短)' : type === 'long' ? '袖长' : `袖长(${type === 'puff' ? '泡泡' : type === 'lantern' ? '灯笼' : '喇叭'})`, Math.round((Lpx - 40) / 2.4), cy - 6, 12));
  dims.push({ label: '袖口', cm: Math.round(W * cuff * 1.15 * 2), from: { x: cy - cuffW, y: cuffY + 16 }, to: { x: cy + cuffW, y: cuffY + 16 } });
  return {
    pieceId: 'sleeve', name: '袖片', qty: 2, path: d,
    grain: `M ${cy} 40 L ${cy} ${cuffY - 8}`,
    handles: [{ id: 'cuff', param: 'hemMul', x: cy, y: cuffY + 8, dir: 'h', hint: '横向拖动=袖口' }],
    dims, notches: [{ x: cy + cuffW * 0.5, y: cuffY }],
  };
}

function skirtPiece(params: DesignParams, kind: 'front' | 'back'): PatternSheet {
  const fitH = FIT_HEM[params.fit] || 1.06;
  const len = LENGTH_RANGE.skirt;
  const cm = clamp01(params.lengthCm, len.min, len.max);
  const H = Math.min(286, 24 + cm * 2.6);
  const waist = BASE_BUST * (params.waistMul ?? 1) * (kind === 'back' ? 0.98 : 1);
  const hem = Math.min(92, BASE_BUST * fitH * (params.hemMul ?? 1));
  const w = (v: number) => 16 + v * 0.92;
  const yW = 26;
  let d = `M 16 ${yW} L ${w(waist)} ${yW}`;
  d += ` Q ${w(Math.max(waist, hem) * 0.97)} ${(yW + H) / 2} ${w(hem)} ${H - 10}`;
  d += ` Q ${16 + (w(hem) - 16) * 0.5} ${H + 5} 16 ${H} Z`;
  const dims: DimLine[] = [];
  dims.push(dimHL('裙长', Math.round(cm), 6, yW + 6));
  dims.push({ label: '摆宽', cm: Math.round(hem * 1.9), from: { x: 16, y: H + 12 }, to: { x: w(hem), y: H + 12 } });
  return {
    pieceId: kind, name: kind === 'front' ? '前裙片' : '后裙片', qty: 1, fold: true, path: d,
    foldLine: 'M 16 18 L 16 ' + (H + 6),
    grain: `M ${16 + (w(hem) - 16) * 0.5} ${yW + 18} L ${16 + (w(hem) - 16) * 0.5} ${H - 12}`,
    handles: [
      { id: 'hem', param: 'hemMul', x: w(hem), y: H, dir: 'h', hint: '横向=摆量' },
      { id: 'len', param: 'lengthCm', x: w(hem), y: H, dir: 'v', hint: '竖向=裙长' },
      { id: 'waist', param: 'waistMul', x: w(waist), y: yW, dir: 'h', hint: '腰围松量' },
    ],
    dims, notches: [{ x: w(waist), y: yW }, { x: w(hem), y: H - 8 }],
  };
}

function pantsPiece(params: DesignParams, kind: 'front' | 'back'): PatternSheet {
  const len = LENGTH_RANGE.pants;
  const cm = clamp01(params.lengthCm, len.min, len.max);
  const H = Math.min(288, 16 + cm * 2.2);
  const hip = 46 * (params.waistMul ?? 1) * (kind === 'back' ? 1.08 : 1);
  const cy = SHEET_W / 2;
  const rise = 40;
  const crotchX = 34; // 裆深内凹
  const ankle = { slim: 20, fit: 24, loose: 46, a: 40, h: 30 }[params.fit] || 24;
  const topW = hip;
  const w = (v: number) => cy - v;
  let d = `M ${w(topW)} 26 L ${w(ankle)} ${H - 8} Q ${w(ankle) + 3} ${H + 2} ${w(ankle) - 6} ${H - 2} L ${w(crotchX)} ${H - 8}`;
  d += ` Q ${w(crotchX) - 6} ${H - rise} ${w(crotchX) - 2} ${H - rise - 14} L ${w(crotchX)} ${H - rise - 22} L ${w(topW * 0.96)} ${26 + 18} Z`;
  const dims: DimLine[] = [];
  dims.push(dimHL(kind === 'back' ? '裤长(后)' : '裤长', Math.round(cm), 6, 16));
  dims.push({ label: '脚口', cm: Math.round(ankle * 2.1), from: { x: w(ankle) - 22, y: H + 14 }, to: { x: w(ankle) + 4, y: H + 14 } });
  return {
    pieceId: kind, name: kind === 'front' ? '前裤片' : '后裤片', qty: 2, path: d,
    grain: `M ${cy - topW * 0.5} 40 L ${cy - topW * 0.5} ${H - 30}`,
    handles: [
      { id: 'len', param: 'lengthCm', x: w(ankle), y: H, dir: 'v', hint: '竖向=裤长' },
      { id: 'hip', param: 'waistMul', x: w(topW), y: 26, dir: 'h', hint: '横向=围度' },
    ],
    dims, notches: [{ x: w(crotchX), y: H - rise - 22 }],
  };
}

function bandPiece(): PatternSheet {
  const d = `M 70 40 L 140 40 L 140 58 L 70 58 Z`;
  return {
    pieceId: 'band', name: '腰头（直裁）', qty: 1, path: d,
    dims: [dimHL('腰头宽', 4, 74, 30)],
    handles: [], notches: [],
  };
}

/* ---------- 对外 API ---------- */
export function patternPieces(cat: CategoryKey): PatternPieceDef[] {
  return catPieces(cat);
}

export function pieceSheetOf(params: DesignParams, defId: string): PatternSheet | null {
  const cat = params.category;
  if (defId === 'sleeve') return sleevePiece(params);
  if (defId === 'band') return bandPiece();
  if (defId === 'front' || defId === 'back') {
    if (cat === 'skirt') return skirtPiece(params, defId);
    if (cat === 'pants') return pantsPiece(params, defId);
    return bodyPiece(params, defId);
  }
  return null;
}

/** 2D 编辑映射：手柄拖拽增量 → 参数（UI 传入转换后的 raw 增量） */
export function applyHandle(params: DesignParams, param: 'lengthCm' | 'waistMul' | 'hemMul', delta: number): Partial<DesignParams> {
  const len = LENGTH_RANGE[params.category];
  if (param === 'lengthCm') {
    return { lengthCm: clamp01(params.lengthCm + delta, len.min, len.max) };
  }
  if (param === 'waistMul') {
    return { waistMul: clamp01((params.waistMul ?? 1) + delta, 0.8, 1.4) };
  }
  return { hemMul: clamp01((params.hemMul ?? 1) + delta, 0.82, 1.75) };
}

export const SHEET_VIEWBOX = `0 0 ${SHEET_W} ${SHEET_H}`;
