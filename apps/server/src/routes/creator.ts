/** creator 创作者平台：工作台/看板/佣金 */
import { Router } from 'express';
import { db } from '../db/store';
import { bad, deny, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { dashboard, seriesData } from '../engine/dashboard';
import { commissionSummary, commissionRateForProduct, settleDueCommissions, withdraw, poolStyleDuplication } from '../engine/commission';
import { poolMeta } from '../engine/pool';
import { r2 } from '../utils/misc';

export const creatorRouter = Router();

function requireCreator(uid: number): void {
  const u = db.users.find((x) => x.id === uid);
  if (!u || u.role !== 'creator') deny('仅创作者可访问创作者平台');
}

/** 工作台总览 */
creatorRouter.get('/creator/overview', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  const windows = db.windows.filter((w) => w.creatorId === uid);
  const poolEntries = db.pool.filter((e) => e.creatorId === uid);
  const products = db.products.filter((p) => p.creatorId === uid);
  const posts = db.posts.filter((p) => p.authorId === uid);
  const orders = db.orders.filter((o) => o.creatorId === uid);
  const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
  void todayKey;
  const unhandledPool = poolEntries.filter((e) => {
    // 池条目尚无对应 submitted/approved 橱窗材料
    if (!e.workId) return false;
    return !db.windows.some((w) => w.workId === e.workId && (w.status === 'submitted' || w.status === 'approved'));
  });
  const recentOrders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  res.json(ok({
    welcome: { nickname: db.users.find((u) => u.id === uid)?.nickname, productCount: products.length },
    counts: {
      materials: db.materials.filter((m) => m.creatorId === uid).length,
      works: db.works.filter((w) => w.creatorId === uid).length,
      posts: posts.length,
      poolTotal: poolEntries.length,
      poolUnhandled: unhandledPool.length,
      windowDraft: windows.filter((w) => w.status === 'draft').length,
      windowSubmitted: windows.filter((w) => w.status === 'submitted').length,
      windowApproved: windows.filter((w) => w.status === 'approved').length,
      windowRejected: windows.filter((w) => w.status === 'rejected').length,
      productOnSale: products.filter((p) => p.status === 'onSale').length,
      orderToday: orders.filter((o) => o.createdAt.slice(0, 10) >= new Date(Date.now() - 86400000).toISOString().slice(0, 10)).length,
    },
    todo: [
      ...(unhandledPool.length ? [{ type: 'pool', text: `${unhandledPool.length} 个入池作品待准备橱窗材料`, link: '/creator/pool' }] : []),
      ...(windows.filter((w) => w.status === 'submitted').length ? [{ type: 'audit', text: `${windows.filter((w) => w.status === 'submitted').length} 份橱窗材料审核中`, link: '/creator/window' }] : []),
      ...(windows.filter((w) => w.status === 'rejected').length ? [{ type: 'reject', text: `${windows.filter((w) => w.status === 'rejected').length} 份橱窗材料被拒，请补齐后重新提交`, link: '/creator/window' }] : []),
    ],
    recentOrders: recentOrders.map((o) => ({ id: o.id, no: o.no, productTitle: o.productTitle, status: o.status, total: o.amounts.total, createdAt: o.createdAt, buyerId: o.buyerId })),
    kpi: (() => {
      const d = dashboard(uid, 30);
      return d.kpis;
    })(),
    meta: poolMeta(),
  }));
}));

/** BI 看板 */
creatorRouter.get('/creator/dashboard', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  if (productId && !db.products.some((p) => p.id === productId && p.creatorId === uid)) bad('BAD_REQUEST', '该商品不属于当前账号');
  res.json(ok(dashboard(uid, days, productId)));
}));

/** 佣金汇总 */
creatorRouter.get('/creator/commission', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  settleDueCommissions(); // 演示即时结算（幂等）
  const s = commissionSummary(uid);
  res.json(ok({
    withdrawable: s.withdrawable,
    pending: s.pending,
    settled: s.settled,
    estimatedTotal: s.estimatedTotal,
    ledger: s.ledger.slice(0, 30),
    rules: s.rules,
    rateExplain: `佣金区间 2%-10%，基础 6%；退货率>6% 或资源池重复度高会下浮，转化率≥8% 且销量≥10 上浮 +2%。`,
    withdrawHistory: s.ledger.filter((l) => l.kind === 'withdraw'),
  }));
}));

/** 单品佣金率（含逐条 breaks/reasons） */
creatorRouter.get('/creator/commission/rate', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  const productId = Number(req.query.productId);
  if (!productId) {
    // 所有商品
    const products = db.products.filter((p) => p.creatorId === uid && p.status === 'onSale');
    res.json(ok({ list: products.map((p) => ({ ...commissionRateForProduct(p.id), title: p.title, cover: p.cover })) }));
    return;
  }
  const p = db.products.find((x) => x.id === productId && x.creatorId === uid);
  if (!p) bad('NOT_FOUND', '商品不存在');
  res.json(ok({ product: { id: p!.id, title: p!.title, cover: p!.cover }, ...commissionRateForProduct(p!.id) }));
}));

/** 提现 */
creatorRouter.post('/creator/commission/withdraw', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount)) bad('BAD_REQUEST', '请提供提现金额');
  const r = withdraw(uid, amount);
  const s = commissionSummary(uid);
  res.json(ok({ ...r, withdrawable: s.withdrawable }));
}));

/** 图序列 */
creatorRouter.get('/creator/bi/series', wrap(async (req, res) => {
  const uid = currentUserId(req);
  requireCreator(uid);
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const metric = (['order', 'amount', 'returnRate'].includes(String(req.query.metric)) ? String(req.query.metric) : 'amount') as 'order' | 'amount' | 'returnRate';
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  res.json(ok({ metric, days, series: seriesData(uid, days, metric, productId) }));
}));
