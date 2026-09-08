/**
 * 售后引擎（SPEC §3.6）：
 * - 定制退货：退款 = amounts.price（原价全额退，基础费用不退）→ 自动创建二手挂单 listPrice=price×0.75
 * - 换货重做：旧单 exchanged + 新建 custom 单（再收一次基础费用）
 * - direct：未发货可取消（全额退）；收货后质量问题退货可退原价（demo 简化）
 */
import { db, touch } from '../db/store';
import type { Order, Product } from '../types';
import { nowIso } from '../utils/time';
import { r2 } from '../utils/misc';
import { notify, ledger } from './helpers';
import { createExchangeOrder } from './orderflow';
import { createResaleFromReturn } from './resale';

function findProduct(o: Order): Product | undefined {
  return db.products.find((p) => p.id === o.productId);
}

/** 定制退货 */
export function returnCustomOrder(order: Order, reason: string): { order: Order; resaleId: number; msg: string } {
  if (order.kind !== 'custom') throw Object.assign(new Error('仅私人定制订单支持该退货规则'), { code: 'ORDER_KIND' });
  if (order.status !== 'received' && order.status !== 'completed') throw Object.assign(new Error('确认收货后才能发起退货'), { code: 'ORDER_STATE' });
  if (order.returnReq && order.returnReq.state !== 'none') throw Object.assign(new Error('该订单已有售后记录'), { code: 'ORDER_STATE' });

  const price = order.amounts.price;
  const baseFee = order.amounts.baseFee;
  const at = nowIso();
  // 原价退给消费者，基础费用不退（加工/材料/人工）
  const resale = createResaleFromReturn(order, price);
  order.returnReq = {
    state: 'done',
    refundAmount: price,
    baseFeeKept: baseFee,
    reason,
    at,
    resaleListingId: resale.id,
  };
  order.timeline.push({ t: at, text: `退货退款 ¥${r2(price)}（原价全额退；基础费用 ¥${r2(baseFee)} 不退）` });
  ledger(order.buyerId, 'refund', price, `R-${order.no}`);
  touch();
  notify(order.buyerId, 'refund', '💸 退货退款已到账', `「${order.productTitle}」退货成功：退还商品原价 ¥${r2(price)}，基础费用 ¥${r2(baseFee)} 不退（加工/材料/人工）。二手集市已自动挂出该件商品（标价 原价×75%）。`, `/mall/resale`);
  notify(order.creatorId, 'refund', '↩️ 收到定制退货', `「${order.productTitle}」被退货：您保留基础费用 ¥${r2(baseFee)}（定制损耗补偿），商品已自动进入二手集市。`, `/creator/dashboard`);
  return { order, resaleId: resale.id, msg: `退货成功：退还 ¥${r2(price)}（基础费用不退），已自动创建二手挂单 ¥${r2(resale.listPrice)}` };
}

/** 换货重做（再付一次基础费用） */
export function exchangeCustomOrder(order: Order, reason: string): { oldOrder: Order; newOrder: Order; msg: string } {
  if (order.kind !== 'custom') throw Object.assign(new Error('仅私人定制订单支持换货重做'), { code: 'ORDER_KIND' });
  if (order.status !== 'received' && order.status !== 'completed') throw Object.assign(new Error('确认收货后才能换货'), { code: 'ORDER_STATE' });
  if (order.returnReq && order.returnReq.state !== 'none') throw Object.assign(new Error('该订单已有售后记录'), { code: 'ORDER_STATE' });
  const product = findProduct(order);
  if (!product) throw Object.assign(new Error('商品不存在'), { code: 'NOT_FOUND' });
  const at = nowIso();
  const newOrder = createExchangeOrder(order, product);
  order.returnReq = {
    state: 'exchanged',
    refundAmount: 0,
    baseFeeKept: 0,
    reason,
    at,
    newOrderId: newOrder.id,
  };
  order.timeline.push({ t: at, text: `换货重做：原价已含在第一单，新单 #${newOrder.no} 仅需再付基础费用 ¥${product.baseFee}` });
  touch();
  notify(order.buyerId, 'refund', '🔄 换货重做已受理', `「${order.productTitle}」换货重做：旧单标记 exchanged，新定制订单已创建（再付一次基础费用 ¥${product.baseFee}），请前往支付。`, `/mall/orders/${newOrder.id}`);
  return { oldOrder: order, newOrder, msg: `换货重做订单已创建：仅需再付基础费用 ¥${r2(product.baseFee)}` };
}

/** direct 取消（未发货全额退）；custom 仅支付前取消（无退款） */
export function cancelOrder(order: Order, reason: string): { order: Order; msg: string } {
  if (order.status === 'cancelled') throw Object.assign(new Error('订单已取消'), { code: 'ORDER_STATE' });
  const wasPaid = !!order.paidAt;
  if (order.kind === 'custom' && order.status !== 'created') {
    throw Object.assign(new Error('定制订单生产后不支持取消，可收货后走退/换货流程'), { code: 'ORDER_STATE' });
  }
  if (order.kind === 'direct' && order.shippedAt) {
    throw Object.assign(new Error('订单已发货，取消需联系客服或收货后走售后'), { code: 'ORDER_STATE' });
  }
  const at = nowIso();
  order.status = 'cancelled';
  order.timeline.push({ t: at, text: `订单已取消（${reason || '用户取消'}）` });
  if (wasPaid && order.amounts.total > 0) {
    ledger(order.buyerId, 'refund', order.amounts.total, `C-${order.no}`);
    order.timeline.push({ t: at, text: `全额退款 ¥${r2(order.amounts.total)} 已原路退回` });
    notify(order.buyerId, 'refund', '💸 取消订单退款到账', `「${order.productTitle}」已取消并全额退款 ¥${r2(order.amounts.total)}。`, `/mall/orders/${order.id}`);
  }
  touch();
  return { order, msg: '订单已取消' };
}

/** 直接购买收货后质量问题退货（demo 简化可退原价） */
export function returnDirectOrder(order: Order, reason: string): { order: Order; msg: string } {
  if (order.kind !== 'direct') throw Object.assign(new Error('定制订单请走定制退货流程'), { code: 'ORDER_KIND' });
  if (order.status !== 'received' && order.status !== 'completed') throw Object.assign(new Error('确认收货后才能发起退货'), { code: 'ORDER_STATE' });
  if (order.returnReq && order.returnReq.state !== 'none') throw Object.assign(new Error('该订单已有售后记录'), { code: 'ORDER_STATE' });
  const at = nowIso();
  const amount = order.amounts.total;
  order.returnReq = { state: 'done', refundAmount: amount, baseFeeKept: 0, reason, at };
  order.timeline.push({ t: at, text: `质量问题退货：全额退款 ¥${r2(amount)}（质检判定演示通过）` });
  ledger(order.buyerId, 'refund', amount, `R-${order.no}`);
  touch();
  notify(order.buyerId, 'refund', '💸 退货退款到账', `「${order.productTitle}」质量问题退货通过质检判定，全额退款 ¥${r2(amount)}。`, `/mall/orders/${order.id}`);
  return { order, msg: '质量问题退货成功，全额退款' };
}
