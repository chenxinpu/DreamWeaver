/**
 * 变现数据看板聚合（SPEC §3.9，桌面 BI 规范）：
 * KPI 卡 + 折线(成交额&订单量) + 柱状(商品销量) + 退货趋势 + 渠道饼图 + 明细表。
 */
import { db } from '../db/store';
import type { Order } from '../types';
import { r2, pct } from '../utils/misc';
import { startOfDayKey, dateKeyNow, dateKeyOf } from '../utils/time';
import { orderRevenue, commissionRateForProduct, poolStyleDuplication } from './commission';

export interface DashboardData {
  range: { days: number; from: string; to: string };
  productFilter: number | null;
  kpis: {
    windowCount: number;        // 橱窗上架商品数
    revenue30: number;          // 近 N 天成交额
    conversion: number;         // 转化率
    returnRate: number;         // 退货率
    estCommission: number;      // 预估佣金
    orders: number; views: number;
  };
  trend: { date: string; amount: number; orders: number }[];
  returnTrend: { date: string; rate: number }[];
  productCompare: { productId: number; title: string; cover: string; sales: number; amount: number; returnRate: number }[];
  channel: { name: string; value: number }[];
  rows: {
    productId: number; title: string; cover: string;
    views: number; orders: number; conversion: number; sales: number; returnRate: number; commissionRate: number; amount: number;
  }[];
  poolDup: { dup: number; notice: string };
  explain: string[];
}

const CHANNEL_NAMES = ['广场推荐', '商城分类', '搜索', '分享', '创作者推荐'];

function channelOf(o: Order): string {
  if (o.channel && CHANNEL_NAMES.includes(o.channel)) return o.channel;
  return CHANNEL_NAMES[0];
}

export function dashboard(creatorId: number, days = 30, productId?: number): DashboardData {
  const now = Date.now();
  const fromTs = startOfDayKey(dateKeyNow()) - days * 86400000;
  const fromKey = dateKeyOf(fromTs);
  const todayKey = dateKeyNow();
  const products = db.products.filter((p) => p.creatorId === creatorId && (!productId || p.id === productId));
  const productIds = new Set(products.map((p) => p.id));

  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(fromTs + i * 86400000);
    dayKeys.push(dateKeyOf(d.getTime()));
  }
  const keySet = new Set(dayKeys);

  const orders = db.orders.filter((o) => o.creatorId === creatorId && productIds.has(o.productId) && Date.parse(o.createdAt) >= fromTs && Date.parse(o.createdAt) <= now && o.status !== 'cancelled' && o.status !== 'created');
  const paidOrders = orders;
  const viewsMap = new Map<string, number>();
  let totalViews = 0;
  for (const v of db.viewsByDay) {
    if (!productIds.has(v.productId) || !keySet.has(v.dayKey)) continue;
    totalViews += v.count;
    viewsMap.set(v.dayKey, (viewsMap.get(v.dayKey) || 0) + v.count);
  }

  // KPI
  const revenue30 = r2(paidOrders.reduce((a, o) => a + orderRevenue(o), 0));
  const returns30 = paidOrders.filter((o) => o.returnReq && o.returnReq.state === 'done');
  const conversion = pct(paidOrders.length, totalViews);
  const returnRate = pct(returns30.length, paidOrders.length);
  let estCommission = 0;
  for (const p of products) {
    const rate = commissionRateForProduct(p.id, days).rate / 100;
    const sub = paidOrders.filter((o) => o.productId === p.id);
    estCommission += sub.reduce((a, o) => a + orderRevenue(o) * rate, 0);
  }
  estCommission = r2(estCommission);

  // 折线
  const amountByDay = new Map<string, number>();
  const ordersByDay = new Map<string, number>();
  for (const o of paidOrders) {
    const k = dateKeyOf(Date.parse(o.createdAt));
    if (!keySet.has(k)) continue;
    amountByDay.set(k, (amountByDay.get(k) || 0) + orderRevenue(o));
    ordersByDay.set(k, (ordersByDay.get(k) || 0) + 1);
  }
  const trend = dayKeys.map((k) => ({
    date: k.slice(5),
    amount: r2(amountByDay.get(k) || 0),
    orders: ordersByDay.get(k) || 0,
  }));

  // 退货趋势
  const returnByDay = new Map<string, number>();
  const paidByDay = new Map<string, number>();
  for (const o of paidOrders) {
    const k = dateKeyOf(Date.parse(o.createdAt));
    paidByDay.set(k, (paidByDay.get(k) || 0) + 1);
    if (o.returnReq && o.returnReq.state === 'done') {
      const rk = o.returnReq.at ? dateKeyOf(Date.parse(o.returnReq.at)) : k;
      returnByDay.set(rk, (returnByDay.get(rk) || 0) + 1);
    }
  }
  const returnTrend = dayKeys.map((k) => ({ date: k.slice(5), rate: r2(((returnByDay.get(k) || 0) / Math.max(1, paidByDay.get(k) || 0)) * 100) }));

  // 柱状/明细
  const rows = products.map((p) => {
    const sub = paidOrders.filter((o) => o.productId === p.id);
    const viewsP = db.viewsByDay.filter((v) => v.productId === p.id && v.dayKey >= fromKey && v.dayKey <= todayKey).reduce((a, v) => a + v.count, 0);
    const ret = sub.filter((o) => o.returnReq && o.returnReq.state === 'done').length;
    return {
      productId: p.id,
      title: p.title,
      cover: p.cover,
      views: viewsP,
      orders: sub.length,
      conversion: pct(sub.length, viewsP),
      sales: sub.length,
      returnRate: pct(ret, sub.length),
      commissionRate: commissionRateForProduct(p.id, days).rate,
      amount: r2(sub.reduce((a, o) => a + orderRevenue(o), 0)),
    };
  });

  // 渠道
  const channelMap = new Map<string, number>();
  for (const o of paidOrders) {
    const c = channelOf(o);
    channelMap.set(c, (channelMap.get(c) || 0) + orderRevenue(o));
  }
  const chTotal = [...channelMap.values()].reduce((a, b) => a + b, 0) || 1;
  const channel = CHANNEL_NAMES.map((name) => ({ name, value: Math.round(((channelMap.get(name) || 0) / chTotal) * 100) })).filter((c) => c.value > 0);

  const styles = products.flatMap((p) => p.styleTags || []);
  const dup = poolStyleDuplication(styles, products[0]?.workId);
  const dupNotice =
    dup >= 5 ? `⚠️ 资源池同款风格偏多（重叠≥60% 的池内作品 ${dup} 件）：触发 -2% 佣金下浮，建议差异化迭代。`
    : dup >= 3 ? `⚠️ 资源池样式重复度 ${dup} 件（≥3）：触发 -1% 佣金下浮，注意与热门款拉开差异。`
    : dup > 0 ? `资源池样式重复度 ${dup} 件（<3），不影响佣金。` : '资源池样式差异化优秀，无重复度扣减。';

  return {
    range: { days, from: fromKey, to: todayKey },
    productFilter: productId || null,
    kpis: {
      windowCount: products.filter((p) => p.status === 'onSale').length,
      revenue30,
      conversion,
      returnRate,
      estCommission,
      orders: paidOrders.length,
      views: totalViews,
    },
    trend,
    returnTrend,
    productCompare: rows.map((r) => ({ productId: r.productId, title: r.title, cover: r.cover, sales: r.sales, amount: r.amount, returnRate: r.returnRate })).sort((a, b) => b.amount - a.amount),
    channel,
    rows: rows.sort((a, b) => b.amount - a.amount),
    poolDup: { dup, notice: dupNotice },
    explain: [
      `统计口径：近 ${days} 天（${fromKey} ~ ${todayKey}），已支付未取消订单；成交额按订单有效收入（退货仅计基础费用/直购不计）`,
      `转化率 = 下单 ${paidOrders.length} / 浏览 ${totalViews} = ${conversion}%；退货率 = ${returns30.length}/${paidOrders.length} = ${returnRate}%`,
      `渠道金额占比按订单种子的渠道标记聚合（广场推荐/分类/搜索/分享/创作者推荐）`,
    ],
  };
}

/** 图序列接口 */
export function seriesData(creatorId: number, days: number, metric: 'order' | 'amount' | 'returnRate', productId?: number): { date: string; value: number }[] {
  const d = dashboard(creatorId, days, productId);
  const mapFn = metric === 'order' ? (x: typeof d.trend[0]) => x.orders : metric === 'amount' ? (x: typeof d.trend[0]) => x.amount : null;
  if (metric === 'returnRate') return d.returnTrend.map((r) => ({ date: r.date, value: r.rate }));
  return d.trend.map((x) => ({ date: x.date, value: mapFn ? mapFn(x) : 0 }));
}
