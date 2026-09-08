/** orders 路由：创建/支付/我的订单/详情/推进/售后 */
import { Router } from 'express';
import type { Request } from 'express';
import { db } from '../db/store';
import type { Order } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { paginate, r2 } from '../utils/misc';
import { orderDTO } from './dto';
import { createDirectOrder, createCustomOrder, payOrder, devAdvance, estimateStage } from '../engine/orderflow';
import { returnCustomOrder, exchangeCustomOrder, cancelOrder, returnDirectOrder } from '../engine/aftercare';
import { ledger } from '../engine/helpers';

export const ordersRouter = Router();

function findMyOrder(_req: Request, id: number, uid: number): Order {
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound('订单不存在');
  const user = db.users.find((u) => u.id === uid);
  if (!user) deny();
  if (o.buyerId !== uid && o.creatorId !== uid && user.role !== 'auditor' && user.role !== 'admin') deny('无权查看该订单');
  return o;
}

/** 创建订单 */
ordersRouter.post('/orders', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const b = req.body || {};
  const product = db.products.find((p) => p.id === Number(b.productId));
  if (!product) notFound('商品不存在');
  if (product.status !== 'onSale') bad('PRODUCT_OFF', '商品已下架');
  const kind = String(b.kind || 'direct');
  let order: Order;
  let adapt;
  if (kind === 'custom') {
    if (!b.body || typeof b.body !== 'object') bad('BAD_REQUEST', '私人定制需要提供 body（体型数据）');
    const body = b.body;
    ({ order, adapt } = createCustomOrder(product, uid, body));
  } else if (kind === 'direct') {
    order = createDirectOrder(product, uid, b.size ? String(b.size) : undefined);
  } else {
    bad('BAD_REQUEST', 'kind 需为 direct/custom');
  }
  const role = db.users.find((u) => u.id === uid)?.role || 'consumer';
  const dto = orderDTO(order, uid, role);
  res.json(ok({
    ...dto,
    ...(adapt ? { adapt: { baseSize: adapt.baseSize, adjustedSpec: adapt.adjustedSpec, fitAlerts: adapt.fitAlerts, totalEstimate: adapt.totalEstimate } } : {}),
  }));
}));

/** 支付（模拟） */
ordersRouter.post('/orders/:id/pay', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) notFound('订单不存在');
  if (o.buyerId !== uid) deny('只有买家可支付');
  if (o.status !== 'created') bad('ORDER_STATE', '仅待支付订单可支付');
  if (o.amounts.total > 0) {
    ledger(uid, 'order_pay', -o.amounts.total, o.no); // 模拟钱包扣款
  }
  const updated = payOrder(o);
  res.json(ok(orderDTO(updated, uid, db.users.find((u) => u.id === uid)?.role || 'consumer')));
}));

/** 我的订单（买家） */
ordersRouter.get('/orders/mine', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const status = req.query.status ? String(req.query.status) : undefined;
  let list = db.orders.filter((o) => o.buyerId === uid);
  if (status) {
    if (status === 'aftersale') list = list.filter((o) => o.returnReq && o.returnReq.state !== 'none');
    else list = list.filter((o) => o.status === status);
  }
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => {
    o.stage = estimateStage(o);
    return o;
  });
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 10;
  const paged = paginate(list, page, pageSize);
  res.json(ok({ ...paged, list: paged.list.map((o) => orderDTO(o, uid, 'consumer')) }));
}));

/** 创作者视角订单 */
ordersRouter.get('/orders/seller/mine', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user || (user.role !== 'creator' && user.role !== 'auditor' && user.role !== 'admin')) deny('仅创作者可查看');
  const status = req.query.status ? String(req.query.status) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  let list = db.orders.filter((o) => o.creatorId === uid && (!productId || o.productId === productId));
  if (status) list = list.filter((o) => o.status === status);
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((o) => { o.stage = estimateStage(o); return o; });
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 10;
  const paged = paginate(list, page, pageSize);
  const stats = {
    total: list.length,
    paidTotal: list.filter((o) => o.status !== 'created' && o.status !== 'cancelled').reduce((a, o) => a + o.amounts.total, 0),
    pendingShip: list.filter((o) => ['paid', 'producing', 'qc'].includes(o.status)).length,
  };
  res.json(ok({ ...paged, list: paged.list.map((o) => orderDTO(o, uid, user.role)), stats: { ...stats, paidTotal: r2(stats.paidTotal) } }));
}));

/** 订单详情 */
ordersRouter.get('/orders/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = findMyOrder(req, Number(req.params.id), uid);
  o.stage = estimateStage(o);
  res.json(ok(orderDTO(o, uid, user?.role || 'consumer')));
}));

/** 演示推进 */
ordersRouter.post('/orders/:id/dev-advance', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = findMyOrder(req, Number(req.params.id), uid);
  if (!user || (user.role !== 'auditor' && user.role !== 'admin' && o.buyerId !== uid && o.creatorId !== uid)) deny();
  const r = devAdvance(o);
  res.json(ok({ msg: r.msg, ...orderDTO(o, uid, user?.role || 'consumer') }));
}));

/** 定制退货（自动建二手挂单） */
ordersRouter.post('/orders/:id/return', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) notFound('订单不存在');
  if (o.buyerId !== uid) deny('只有买家可发起售后');
  const reason = String(req.body?.reason || '不想要了');
  if (o.kind === 'custom') {
    const r = returnCustomOrder(o, reason);
    res.json(ok({ msg: r.msg, resaleId: r.resaleId, refundAmount: r.order.returnReq?.refundAmount, ...orderDTO(r.order, uid, user?.role || 'consumer') }));
  } else {
    const r = returnDirectOrder(o, reason);
    res.json(ok({ msg: r.msg, ...orderDTO(r.order, uid, user?.role || 'consumer') }));
  }
}));

/** 换货重做 */
ordersRouter.post('/orders/:id/exchange', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) notFound('订单不存在');
  if (o.buyerId !== uid) deny('只有买家可发起换货');
  const reason = String(req.body?.reason || '尺码/版型不合适');
  const r = exchangeCustomOrder(o, reason);
  const role = user?.role || 'consumer';
  res.json(ok({ msg: r.msg, newOrderId: r.newOrder.id, newOrderAmount: r.newOrder.amounts.total, order: orderDTO(r.oldOrder, uid, role), newOrder: orderDTO(r.newOrder, uid, role) }));
}));

/** 取消 */
ordersRouter.post('/orders/:id/cancel', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) notFound('订单不存在');
  if (o.buyerId !== uid) deny('只有买家可取消');
  const reason = String(req.body?.reason || '用户取消');
  const r = cancelOrder(o, reason);
  res.json(ok({ msg: r.msg, ...orderDTO(r.order, uid, user?.role || 'consumer') }));
}));

/** 确认收货 */
ordersRouter.post('/orders/:id/confirm-received', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  const o = db.orders.find((x) => x.id === Number(req.params.id));
  if (!o) notFound('订单不存在');
  if (o.buyerId !== uid) deny('只有买家可确认收货');
  if (o.status !== 'shipping') bad('ORDER_STATE', '当前状态不可确认收货');
  const r = devAdvance(o);
  res.json(ok({ msg: r.msg, ...orderDTO(o, uid, user?.role || 'consumer') }));
}));
