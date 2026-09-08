/**
 * 佣金 KPI 引擎（SPEC §3.8）：
 * - 基础 6%；上浮：单品近30天转化率≥8% 且 销量≥10 → +2（封顶 10）
 * - 下浮：近30天退货率>6% → −1.5/档（>10% 再 −1.5）；资源池样式重复度(≥60%重叠) ≥3 → −1，≥5 → −2
 * - 结算：已支付有效订单在收货 T+7 自动写 LedgerEvent（幂等）；结算演示即展示预估/已结算/可提现
 */
import { db, touch } from '../db/store';
import type { Order, Product } from '../types';
import { r2, pct } from '../utils/misc';
import { startOfDayKey, dateKeyNow, nowIso, dateKeyOf } from '../utils/time';
import { ledger } from './helpers';

export const BASE_RATE = 6;

/** 某个商品近 N 天 KPI（views/paid/sales/returns/退货率/转化率） */
export interface ProductKpi {
  productId: number;
  views: number;
  paid: number;          // 近N天下单且已支付（未取消）
  sales: number;         // 有效成交（收货/已完成）——转化口径用 paid
  returns: number;
  conversionRate: number;
  returnRate: number;
}

export function productKpis(productId: number, days = 30): ProductKpi {
  const now = Date.now();
  const fromTs = startOfDayKey(dateKeyNow()) - days * 86400000;
  const fromKey = dateKeyOf(fromTs);
  const views = db.viewsByDay.filter((v) => v.productId === productId && v.dayKey >= fromKey).reduce((a, v) => a + v.count, 0);
  let paid = 0;
  let returns = 0;
  for (const o of db.orders) {
    if (o.productId !== productId) continue;
    if (Date.parse(o.createdAt) < fromTs || Date.parse(o.createdAt) > now) continue;
    if (o.status === 'cancelled') continue;
    if (o.status !== 'created') paid++;
    if (o.returnReq && o.returnReq.state === 'done') returns++;
  }
  return {
    productId,
    views,
    paid,
    sales: paid,
    returns,
    conversionRate: pct(paid, views),
    returnRate: pct(returns, paid),
  };
}

/** 资源池样式重复度：与其同 styleTags 重叠度≥60% 的池内其他作品数 */
export function poolStyleDuplication(styleTags: string[], selfWorkId?: number): number {
  const tagSet = new Set(styleTags || []);
  if (!tagSet.size) return 0;
  let cnt = 0;
  const seen = new Set<number>();
  for (const e of db.pool) {
    if (!e.workId || e.workId === selfWorkId) continue;
    if (seen.has(e.workId)) continue;
    const w = db.works.find((x) => x.id === e.workId);
    if (!w) continue;
    const overlap = (w.styleTags || []).filter((t) => tagSet.has(t)).length;
    const ratio = overlap / Math.max(1, tagSet.size);
    if (ratio >= 0.6) { cnt++; seen.add(e.workId); }
  }
  return cnt;
}

export interface RateResult {
  productId: number;
  rate: number;
  base: number;
  breaks: { name: string; delta: number }[];
  reasons: string[];
  explain: string;
}

export function commissionRateForProduct(productId: number, days = 30): RateResult {
  const product = db.products.find((p) => p.id === productId);
  if (!product) throw Object.assign(new Error('商品不存在'), { code: 'NOT_FOUND' });
  const kpi = productKpis(productId, days);
  const dup = poolStyleDuplication(product.styleTags || [], product.workId);
  const breaks: { name: string; delta: number }[] = [];
  const reasons: string[] = [];
  let rate = BASE_RATE;
  breaks.push({ name: '基础佣金', delta: BASE_RATE });
  reasons.push('所有已支付有效订单均按基础 6% 起步');

  if (kpi.conversionRate >= 8 && kpi.sales >= 10) {
    breaks.push({ name: `近30天转化率 ${kpi.conversionRate}% ≥8% 且销量 ${kpi.sales} ≥10`, delta: 2 });
    rate += 2;
    reasons.push(`单品近30天转化率 ${kpi.conversionRate}%（≥8%）且销量 ${kpi.sales}（≥10）→ +2 上浮`);
  } else {
    reasons.push(`转化率 ${kpi.conversionRate}% 或销量 ${kpi.sales} 未达上浮线（需 ≥8% 且 ≥10）`);
  }
  if (kpi.returnRate > 6) {
    const step = kpi.returnRate > 10 ? 2 : 1;
    breaks.push({ name: `近30天退货率 ${kpi.returnRate}% >6%${step > 1 ? '（且>10%再降一档）' : ''}`, delta: -1.5 * step });
    rate -= 1.5 * step;
    reasons.push(`退货率 ${kpi.returnRate}% > 6% → -${1.5 * step} 下浮${step > 1 ? '（超过 10% 触发两档）' : ''}`);
  }
  if (dup >= 5) {
    breaks.push({ name: `资源池同款风格 ≥5 件（重叠度≥60% 共 ${dup} 件）`, delta: -2 });
    rate -= 2;
    reasons.push(`资源池样式重复度：重叠度≥60% 的其他作品 ${dup} 件（≥5）→ -2 下浮，激励差异化原创`);
  } else if (dup >= 3) {
    breaks.push({ name: `资源池同款风格 ≥3 件（重叠度≥60% 共 ${dup} 件）`, delta: -1 });
    rate -= 1;
    reasons.push(`资源池样式重复度：重叠度≥60% 的其他作品 ${dup} 件（≥3）→ -1 下浮`);
  } else if (dup > 0) {
    reasons.push(`资源池重复度 ${dup} 件 <3，未触发下浮`);
  } else {
    reasons.push('资源池样式重复度为 0，差异化优秀');
  }
  rate = Math.max(2, Math.min(10, rate));
  return {
    productId,
    rate,
    base: BASE_RATE,
    breaks,
    reasons,
    explain: `佣金 = max(2%, min(10%, 6% ${breaks.map((b) => (b.delta > 0 ? `+${b.delta}` : `${b.delta}`)).join(' ') })) = ${rate}%（基础 6%，KPI 浮动区间 2%-10%）`,
  };
}

/** 订单对创作者的有效收入（退货/取消后剩余） */
export function orderRevenue(o: Order): number {
  if (o.status === 'cancelled') return 0;
  if (o.returnReq && o.returnReq.state === 'done') {
    return o.kind === 'custom' ? o.amounts.baseFee : 0; // 定制退货留 baseFee；direct 质量退货全退
  }
  return o.amounts.total;
}

export function orderSettled(o: Order): boolean {
  return db.ledger.some((l) => l.kind === 'commission_settle' && l.refNo === o.no);
}

export function orderSettleDue(o: Order): boolean {
  if (o.status === 'cancelled' || o.status === 'created') return false;
  const rev = orderRevenue(o);
  if (rev <= 0) return false;
  if (o.status === 'received' || o.status === 'completed') {
    const baseTs = Date.parse(o.receivedAt || o.createdAt);
    return baseTs + 7 * 86400000 <= Date.now();
  }
  // 生产/质检/运输中的订单：按已支付且在途估算（演示：收货满 T+7 才真正结算）
  return false;
}

/** 结算所有到期订单（幂等；调度器/接口触发） */
export function settleDueCommissions(): number {
  let n = 0;
  const now = nowIso();
  for (const o of db.orders) {
    if (orderSettled(o)) continue;
    if (!orderSettleDue(o)) continue;
    const rate = commissionRateForProduct(o.productId).rate / 100;
    const gross = r2(orderRevenue(o) * rate);
    if (gross <= 0) continue;
    ledger(o.creatorId, 'commission_settle', gross, o.no);
    n++;
  }
  if (n) touch();
  return n;
}

export interface CommissionSummary {
  withdrawable: number;
  pending: number;
  settled: number;
  estimatedTotal: number;
  ledger: typeof db.ledger;
  rules: typeof db.commissionRules;
}

export function commissionSummary(creatorId: number): CommissionSummary {
  let settled = 0;
  let withdrawn = 0;
  const myLedger = db.ledger.filter((l) => l.userId === creatorId).reverse();
  for (const l of db.ledger) {
    if (l.userId !== creatorId) continue;
    if (l.kind === 'commission_settle') settled += l.amount;
    if (l.kind === 'withdraw') withdrawn += Math.abs(l.amount);
  }
  // 预估：已支付未到期订单（收货未满 T+7 / 在途）
  let pending = 0;
  for (const o of db.orders) {
    if (o.creatorId !== creatorId) continue;
    if (o.status === 'cancelled' || o.status === 'created') continue;
    if (orderSettled(o)) continue;
    const rev = orderRevenue(o);
    if (rev <= 0) continue;
    const rate = commissionRateForProduct(o.productId).rate / 100;
    pending += rev * rate;
  }
  pending = r2(pending);
  return {
    withdrawable: r2(settled - withdrawn),
    pending,
    settled: r2(settled),
    estimatedTotal: r2(settled + pending),
    ledger: myLedger,
    rules: db.commissionRules.filter((r) => r.active),
  };
}

/** 提现 */
export function withdraw(creatorId: number, amount: number): { amount: number; balance: number } {
  const sum = commissionSummary(creatorId);
  if (amount <= 0) throw Object.assign(new Error('提现金额需大于 0'), { code: 'BAD_AMOUNT' });
  if (amount > sum.withdrawable) throw Object.assign(new Error(`可提现余额不足（可提现 ¥${sum.withdrawable}）`), { code: 'NO_BALANCE' });
  const ev = ledger(creatorId, 'withdraw', -amount, `WD-${nowIso().replace(/[-:T]/g, '').slice(2, 14)}`);
  touch();
  return { amount, balance: ev.balance };
}
