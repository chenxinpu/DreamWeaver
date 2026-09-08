/** resale 二手集市路由 */
import { Router } from 'express';
import { db } from '../db/store';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { paginate } from '../utils/misc';
import { buyResale, changePrice, cancelResale } from '../engine/resale';
import { ledger } from '../engine/helpers';

export const resaleRouter = Router();

function toDTO(l: typeof db.resale[0]) {
  return {
    ...l,
    // 原价划线：优先用挂单时记录的原价（降价不改变划线价），旧数据按 75% 反推
    originalPrice: l.originalPrice ?? Math.round(l.listPrice / 0.75 * 100) / 100,
    netEstimate: Math.round(l.listPrice * (1 - l.platformFeeRate) * 100) / 100,
  };
}

resaleRouter.get('/mall/resale', wrap(async (req, res) => {
  const list = db.resale.filter((r) => r.status === 'active').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 12;
  const paged = paginate(list, page, pageSize);
  res.json(ok({ ...paged, list: paged.list.map(toDTO) }));
}));

resaleRouter.get('/resale/mine', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const status = req.query.status ? String(req.query.status) : undefined;
  let list = db.resale.filter((r) => r.sellerId === uid && (!status || r.status === status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 12;
  const paged = paginate(list, page, pageSize);
  res.json(ok({ ...paged, list: paged.list.map(toDTO) }));
}));

resaleRouter.post('/resale/:id/buy', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const l = db.resale.find((x) => x.id === Number(req.params.id));
  if (!l) notFound('挂单不存在');
  // 买家钱包扣款（模拟）
  ledger(uid, 'resale_pay', -l.listPrice, `RS-${l.id}`);
  const r = buyResale(l, uid);
  res.json(ok({ ...toDTO(r.listing), msg: r.msg }));
}));

/** 卖家降价（只许 ≤） */
resaleRouter.patch('/resale/:id/price', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const l = db.resale.find((x) => x.id === Number(req.params.id));
  if (!l) notFound('挂单不存在');
  if (l.sellerId !== uid) deny('只有卖家可改价');
  const p = Number(req.body?.listPrice);
  if (!Number.isFinite(p) || p <= 0) bad('BAD_PRICE', '请提供有效 listPrice');
  changePrice(l, p);
  res.json(ok(toDTO(l)));
}));

resaleRouter.post('/resale/:id/cancel', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const l = db.resale.find((x) => x.id === Number(req.params.id));
  if (!l) notFound('挂单不存在');
  if (l.sellerId !== uid) deny('只有卖家可取消上架');
  cancelResale(l, String(req.body?.reason || ''));
  res.json(ok(toDTO(l)));
}));
