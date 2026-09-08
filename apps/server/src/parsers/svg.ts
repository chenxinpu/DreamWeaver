/**
 * SVG 解析器：直接把文件文本作为 patternSvg；尽量从 viewBox/width/height 读取尺寸。
 */
export interface SvgParseResult {
  patternSvg: string;
  width?: number;
  height?: number;
  note?: string;
  parseWarn?: string;
}

export function parseSvgText(text: string): SvgParseResult {
  const trimmed = text.trim();
  const warns: string[] = [];
  let width: number | undefined;
  let height: number | undefined;
  // 尝试解析 viewBox="x y w h" 或 width="800"
  const vb = trimmed.match(/viewBox\s*=\s*["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  if (vb) { width = parseFloat(vb[3]); height = parseFloat(vb[4]); }
  if (width === undefined) {
    const wm = trimmed.match(/\bwidth\s*=\s*["']\s*([-\d.]+)\s*(?:px)?["']/i);
    if (wm) width = parseFloat(wm[1]);
  }
  if (height === undefined) {
    const hm = trimmed.match(/\bheight\s*=\s*["']\s*([-\d.]+)\s*(?:px)?["']/i);
    if (hm) height = parseFloat(hm[1]);
  }
  if (!/^<\s*(svg|!DOCTYPE|html)/i.test(trimmed)) warns.push('内容不是标准 SVG 文档，已按原始文本入库');
  return {
    patternSvg: trimmed,
    ...(width !== undefined ? { width: Math.round(width) } : {}),
    ...(height !== undefined ? { height: Math.round(height) } : {}),
    note: 'SVG 已直接作为打版/印花图内嵌展示。',
    parseWarn: warns.length ? warns.join('；') : undefined,
  };
}

/** 从 SVG 文本中计数 path/circle 等（粗糙统计，作 entityCount 展示用） */
export function svgShapeCount(text: string): number {
  const m = text.match(/<(path|circle|rect|ellipse|line|polyline|polygon)\b/gi);
  return m ? m.length : 1;
}
