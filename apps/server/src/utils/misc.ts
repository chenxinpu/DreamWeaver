/** 通用小工具 */

/** 保留两位小数（金额展示/计算统一） */
export const r2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

/** 简单伪随机（确定性种子，供 seed 使用） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 随机整数 [min,max] */
export function randInt(min: number, max: number, rnd: () => number = Math.random): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

/** 从数组中随机取 n 个（允许重复索引不同的下标） */
export function pick<T>(arr: T[], n: number, rnd: () => number = Math.random): T[] {
  if (arr.length <= n) return [...arr];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(rnd() * arr.length)]);
  return out;
}

/** 分页工具 */
export function paginate<T>(list: T[], page = 1, pageSize = 10): { list: T[]; total: number; page: number; pageSize: number } {
  const p = Math.max(1, Math.floor(page) || 1);
  const ps = Math.min(100, Math.max(1, Math.floor(pageSize) || 10));
  const total = list.length;
  const start = (p - 1) * ps;
  return { list: list.slice(start, start + ps), total, page: p, pageSize: ps };
}

/** 百分比计算（避免除零） */
export function pct(n: number, d: number): number {
  if (!d) return 0;
  return r2((n / d) * 100);
}

/** SVG 编码（内联占位图用） */
export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
