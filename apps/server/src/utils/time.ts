/** 时间工具：业务日期统一为东八区（+08:00），真实时钟演示用。 */

const TZ_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 86400000;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** ts → 'YYYY-MM-DDTHH:mm:ss+08:00' */
export function fmtTs(ts: number): string {
  const d = new Date(ts + TZ_OFFSET_MS);
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+08:00`
  );
}

/** ts → dateKey(YYYY-MM-DD 东八区) */
export function dateKeyOf(ts: number): string {
  const d = new Date(ts + TZ_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function dateKeyNow(): string {
  return dateKeyOf(Date.now());
}

export function nowIso(): string {
  return fmtTs(Date.now());
}

/** dateKey(东八区某日) 对应的真实毫秒起点 */
export function startOfDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - TZ_OFFSET_MS;
}

export function addDays(ts: number, n: number): number {
  return ts + n * DAY_MS;
}

/** 距今 n 天（正=过去）的真实时刻，用于构造历史数据 */
export function daysAgo(n: number, hour = 10, minute = 0): number {
  const base = startOfDayKey(dateKeyOf(Date.now()));
  return base - n * DAY_MS + hour * 3600000 + minute * 60000;
}

/** 下一个东八区 hour:minute 时刻距现在的毫秒数 */
export function nextDailyRunDelay(hour = 0, minute = 5): number {
  const now = Date.now();
  const target = startOfDayKey(dateKeyOf(now)) + hour * 3600000 + minute * 60000;
  let diff = target - now;
  if (diff <= 0) diff += DAY_MS;
  return diff;
}

/** ISO 与 dateKey 互换 */
export function dateKeyOfIso(iso: string): string {
  return iso.slice(0, 10);
}

/** 生成订单号 ZM + 时间戳 + 随机 */
export function genOrderNo(): string {
  const d = new Date(Date.now() + TZ_OFFSET_MS);
  const ts = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`;
  return `ZM${ts}${String(Math.floor(Math.random() * 9000) + 1000)}`;
}
