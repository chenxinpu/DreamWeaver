/**
 * 订单引擎（SPEC §3.5）：创建 → 支付 → 生产履约状态机 + 演示推进。
 * 状态机：created→paid→producing→qc→shipping→received→(completed)
 */
import { db, nextId, touch } from '../db/store';
import type { Order, OrderStatus, Product } from '../types';
import { fmtTs, genOrderNo, nowIso, addDays, startOfDayKey, dateKeyOf } from '../utils/time';
import { r2 } from '../utils/misc';
import { notify, ledger } from './helpers';
import { adaptToProduct } from './custom';

export function createDirectOrder(product: Product, buyerId: number, size?: string): Order {
  const order: Order = {
    id: nextId('orders'),
    no: genOrderNo(),
    productId: product.id,
    productTitle: product.title,
    cover: product.cover,
    creatorId: product.creatorId,
    kind: 'direct',
    buyerId,
    specUsed: { size: size || 'M' },
    amounts: { price: product.price, baseFee: 0, total: r2(product.price) },
    status: 'created',
    timeline: [{ t: nowIso(), text: '订单已创建（直接购买）' }],
    prodDays: product.prodDays || 9,
    createdAt: nowIso(),
  };
  db.orders.push(order);
  touch();
  return order;
}

export function createCustomOrder(product: Product, buyerId: number, body: Parameters<typeof adaptToProduct>[1]): { order: Order; adapt: ReturnType<typeof adaptToProduct> } {
  const adapt = adaptToProduct(product, body);
  const order: Order = {
    id: nextId('orders'),
    no: genOrderNo(),
    productId: product.id,
    productTitle: product.title,
    cover: product.cover,
    creatorId: product.creatorId,
    kind: 'custom',
    buyerId,
    specUsed: { size: adapt.baseSize, adjusted: adapt.adjustedSpec.map((s) => ({ ...s })), body },
    amounts: { price: product.price, baseFee: product.baseFee, total: r2(product.price + product.baseFee) },
    status: 'created',
    timeline: [{ t: nowIso(), text: `定制订单已创建（基码 ${adapt.baseSize}，含基础费用）` }],
    prodDays: product.prodDays || 9,
    createdAt: nowIso(),
  };
  db.orders.push(order);
  touch();
  return { order, adapt };
}

/** 换货重做订单：旧单 exchanged，新单再收 baseFee（金额 = 0×price + baseFee） */
export function createExchangeOrder(oldOrder: Order, product: Product): Order {
  const order: Order = {
    id: nextId('orders'),
    no: genOrderNo(),
    productId: product.id,
    productTitle: product.title,
    cover: product.cover,
    creatorId: product.creatorId,
    kind: 'custom',
    buyerId: oldOrder.buyerId,
    specUsed: oldOrder.specUsed,
    amounts: { price: 0, baseFee: product.baseFee, total: r2(product.baseFee) },
    status: 'created',
    timeline: [{ t: nowIso(), text: `换货重新定制订单已创建（原价已付第一单，本次仅再付基础费用 ¥${product.baseFee}）` }],
    prodDays: product.prodDays || 9,
    simulate: true,
    createdAt: nowIso(),
  };
  db.orders.push(order);
  touch();
  return order;
}

/** 支付（模拟，直接成功） */
export function payOrder(order: Order): Order {
  if (order.status !== 'created') throw Object.assign(new Error('仅待支付订单可支付'), { code: 'ORDER_STATE' });
  order.status = 'paid';
  order.paidAt = nowIso();
  order.timeline.push({ t: nowIso(), text: `支付成功 ¥${order.amounts.total}（模拟）` });
  touch();
  // 通知创作者
  notify(order.creatorId, 'order', '💰 收到新订单', `${order.buyerId === 14 ? '「我的小号」' : '买家#' + order.buyerId} 支付了「${order.productTitle}」${order.kind === 'custom' ? '（私人定制）' : ''} ¥${order.amounts.total}`, `/creator/dashboard`);
  return order;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: 'producing',
  producing: 'qc',
  qc: 'shipping',
  shipping: 'received',
};

const STAGE_INFO: Record<string, { name: string; percent: number; text: string }> = {
  paid: { name: '待排产', percent: 8, text: '已支付，等待排产' },
  producing: { name: '生产制作', percent: 30, text: '已进入柔性工厂排产（C2M 小单快反）' },
  qc: { name: '出厂质检', percent: 82, text: '完成面料/车缝/尺寸出厂质检' },
  shipping: { name: '已发货', percent: 94, text: '包裹已交物流' },
  received: { name: '已收货', percent: 100, text: '买家确认收货' },
};

/** 由时间推导 stage（读取时兜底，可被 dev-advance 覆盖） */
export function estimateStage(order: Order): Order['stage'] {
  const info = STAGE_INFO[order.status];
  if (!info) {
    if (order.status === 'completed') return { name: '已完成', percent: 100, eta: '', doneAt: order.receivedAt };
    if (order.status === 'cancelled') return { name: '已取消', percent: 0, eta: '', doneAt: order.createdAt };
    if (order.status === 'created') return { name: '待支付', percent: 4, eta: '', doneAt: undefined };
    return { name: order.status, percent: 0, eta: '', doneAt: undefined };
  }
  // producing 期间按已过天数推进 percent
  let percent = info.percent;
  let eta = '';
  if (order.status === 'producing' && order.paidAt && order.prodDays) {
    const paidTs = Date.parse(order.paidAt);
    const elapsed = (Date.now() - paidTs) / 86400000;
    const p = Math.min(80, Math.max(15, Math.round((elapsed / order.prodDays) * 80)));
    percent = p;
    const etaDate = new Date(paidTs + order.prodDays * 86400000);
    eta = `预计 ${fmtTs(etaDate.getTime()).slice(5, 10).replace('-', '/')} 完成生产`;
  }
  if (order.status === 'qc') eta = `质检中，${(order.prodDays || 9) / 2} 天内交付物流`;
  if (order.status === 'shipping') eta = '运输中，约 2-3 天送达';
  return { name: info.name, percent, eta, ...(order.receivedAt ? { doneAt: order.receivedAt } : {}) };
}

/** 演示推进：paid→producing→qc→shipping→received，自动写 timeline/质检/物流 */
export function devAdvance(order: Order): { order: Order; msg: string } {
  const next = NEXT_STATUS[order.status];
  if (!next) {
    if (order.status === 'received' || order.status === 'completed') {
      throw Object.assign(new Error('订单已收货/完成，无下一步'), { code: 'ORDER_DONE' });
    }
    if (order.status === 'cancelled') throw Object.assign(new Error('订单已取消'), { code: 'ORDER_STATE' });
    if (order.status === 'created') throw Object.assign(new Error('请先支付'), { code: 'ORDER_STATE' });
    throw Object.assign(new Error('当前状态不可推进'), { code: 'ORDER_STATE' });
  }
  const t = nowIso();
  if (next === 'producing') {
    order.status = 'producing';
    order.timeline.push({ t, text: '开始生产：版片排料 → 裁剪 → 车缝（含您的基础费用项下的个性化加工）' });
  } else if (next === 'qc') {
    order.status = 'qc';
    order.qcReport = {
      pass: true,
      items: [
        { k: '面料成分', v: '与详情页声明一致 ✓' },
        { k: '车缝线距', v: '3cm/12-14针，无跳线漏线 ✓' },
        { k: '尺寸偏差', v: `与定版偏差 ${(Math.random() * 0.6 + 0.1).toFixed(1)}mm（≤5mm）✓` },
      ],
      at: t,
    };
    order.timeline.push({ t, text: '通过出厂质检（qcReport 已生成）' });
  } else if (next === 'shipping') {
    order.status = 'shipping';
    const company = Math.random() > 0.5 ? '顺丰速运' : '京东物流';
    const trackingNo = (company.startsWith('顺丰') ? 'SF' : 'JD') + String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
    order.logistics = {
      company,
      trackingNo,
      traces: [
        { time: t, text: '已揽收，包裹从织梦柔性工厂发出' },
        { time: fmtTs(Date.now() + 3600000), text: `到达华东转运中心（${company}）` },
      ],
    };
    order.shippedAt = t;
    order.timeline.push({ t, text: `已发货：${company} ${trackingNo}` });
  } else if (next === 'received') {
    order.status = 'received';
    order.receivedAt = t;
    order.timeline.push({ t, text: '买家确认收货，交易完成（T+7 后佣金自动结算）' });
    notify(order.buyerId, 'order', '📦 订单已收货', `「${order.productTitle}」确认收货成功。定制商品可在订单详情发起退/换货。`, `/mall/orders/${order.id}`);
  }
  order.stage = estimateStage(order);
  touch();
  return { order, msg: `订单推进至「${STAGE_INFO[next]?.name || next}」` };
}

/** 到期(收货T+7)订单自动转 completed（供调度器调用） */
export function autoCompleteReceived(): number {
  let n = 0;
  for (const o of db.orders) {
    if (o.status === 'received' && o.receivedAt) {
      const receivedTs = Date.parse(o.receivedAt);
      if (receivedTs + 7 * 86400000 <= Date.now()) {
        o.status = 'completed';
        o.timeline.push({ t: nowIso(), text: '收货满 7 天，订单完成（可评价）' });
        n++;
      }
    }
  }
  if (n) touch();
  return n;
}

/** 订单创建/收货日期落在指定 dateKey 范围内（BI/筛选用） */
export function orderInRange(o: Order, fromTs: number, toTs: number): boolean {
  const ts = Date.parse(o.createdAt);
  return ts >= fromTs && ts < toTs;
}

export function fmtDateKey(ts: number): string { return dateKeyOf(ts); }
export function startTsOfKey(key: string): number { return startOfDayKey(key); }
export { addDays };
