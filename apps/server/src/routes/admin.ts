/** admin / dev 路由：演示账号列表、审核员强制审核、数据重置 */
import { Router } from 'express';
import { db, nextId, touch } from '../db/store';
import type { Product, Role } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { toUserPublic } from './dto';
import { nowIso } from '../utils/time';
import { buildProduct } from '../engine/aiProduct';
import { notify } from '../engine/helpers';
import { evalPool } from '../engine/pool';

export const adminRouter = Router();

function staffOnly(uid: number): void {
  const u = db.users.find((x) => x.id === uid);
  if (!u || (u.role !== 'auditor' && u.role !== 'admin')) deny('仅审核员/管理员可操作');
}

adminRouter.get('/admin/users', wrap(async (req, res) => {
  const role = req.query.role ? String(req.query.role) : undefined;
  let list = db.users.filter((u) => !role || u.role === role);
  list = [...list].sort((a, b) => a.id - b.id);
  res.json(ok({
    list: list.map((u) => ({ ...toUserPublic(u), roleDesc: roleDesc(u.role) })),
    roles: ['consumer', 'creator', 'auditor', 'admin'],
    hint: '演示账号：1=小织(creator) · 14=我的小号(consumer) · 99=平台审核专员(auditor)；登录 POST /api/auth/login',
  }));
}));

function roleDesc(r: Role): string {
  return r === 'creator' ? '创作者' : r === 'consumer' ? '消费者' : r === 'auditor' ? '审核员' : '管理员';
}

/** 审核员强制审核（覆盖演示结论） */
adminRouter.post('/admin/window/:id/force', wrap(async (req, res) => {
  const uid = currentUserId(req);
  staffOnly(uid);
  const w = db.windows.find((x) => x.id === Number(req.params.id));
  if (!w) notFound('橱窗材料不存在');
  const pass = req.body?.pass === true || req.body?.pass === 'true';
  const note = String(req.body?.note || (pass ? '审核员人工复核通过' : '审核员人工复核驳回'));
  if (!w.auditLog) w.auditLog = [];
  w.updatedAt = nowIso();
  if (pass) {
    // 若已有通过记录则直接返回
    const existingProduct = db.products.find((p) => p.windowId === w.id);
    if (existingProduct) {
      res.json(ok({ window: w, product: { id: existingProduct.id, title: existingProduct.title }, note: '该橱窗此前已通过' }));
      return;
    }
    w.status = 'approved';
    w.auditLog.push({ passed: true, note, at: nowIso() });
    const work = db.works.find((x) => x.id === w.workId);
    if (!work) bad('BAD_REQUEST', '关联作品不存在');
    const draft = buildProduct(w, work!);
    const product: Product = { id: nextId('products'), ...draft };
    db.products.push(product);
    notify(w.creatorId, 'audit', '✅ 橱窗材料审核通过', `「${w.productName}」经审核员复核通过，商品已上架商城。`, `/mall/product/${product.id}`);
    touch();
    res.json(ok({ window: w, product: { id: product.id, title: product.title }, note }));
  } else {
    w.status = 'rejected';
    w.auditLog.push({ passed: false, note, at: nowIso() });
    notify(w.creatorId, 'audit', '❌ 橱窗材料被驳回', `「${w.productName}」审核意见：${note}。请补齐材料后重新提交（status 已回草稿）。`, `/creator/window?workId=${w.workId}`);
    touch();
    res.json(ok({ window: w, note }));
  }
}));

/** 重置数据（重新 seed） */
adminRouter.post('/dev/reset', wrap(async (req, res) => {
  const uid = currentUserId(req);
  staffOnly(uid);
  const seed = req.body?.seed !== false;
  // 延迟 require seed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const seedMod = require('../db/seed');
  const before = db.orders.length + db.posts.length + db.products.length;
  seedMod.resetData(seed);
  // 重置后立即跑一次当日资源池评估，让演示状态立刻可用
  let evalInfo: { p60: number; added: number } | null = null;
  if (seed) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const poolMod = require('../engine/pool');
      const r = poolMod.evalPool();
      evalInfo = { p60: r.p60, added: r.added.length };
    } catch { /* ignore */ }
  }
  res.json(ok({ reset: true, seeded: seed, before, now: db.posts.length + db.products.length + db.orders.length, poolEval: evalInfo, msg: '数据已重置' }));
}));

adminRouter.get('/dev/info', wrap(async (_req, res) => {
  res.json(ok({
    version: 'v2.0.0',
    entities: { users: db.users.length, materials: db.materials.length, works: db.works.length, posts: db.posts.length, pool: db.pool.length, windows: db.windows.length, products: db.products.length, orders: db.orders.length, resale: db.resale.length, notifications: db.notifications.length, ledger: db.ledger.length },
  }));
}));

/**
 * dev 演示：把某篇推文的热度提升到指定点赞数（模拟真实互动），随后引擎自动做当日评估，
 * 命中规则（点赞>当日P60 或 评论≥10）即自动纳入资源池并给作者发通知。
 * 仅限作者本人对自己的推文使用（演示加速器，不改变生产语义）。
 */
adminRouter.post('/dev/surge-likes', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const postId = Number(req.body?.postId);
  const likes = Number(req.body?.likes);
  if (!postId || !Number.isFinite(likes) || likes < 0) bad('BAD_REQUEST', '需要 postId 与 likes(≥0)');
  const p = db.posts.find((x) => x.id === postId);
  if (!p) notFound('推文不存在');
  if (p.authorId !== uid) deny('只能对自己推文的演示热度做调整');
  const before = p.likes;
  const diff = likes - p.likes;
  if (diff > 0) {
    p.likes = likes;
    for (let i = 0; i < diff; i++) p.likedBy.push(9000000 + i);
  } else if (diff < 0) {
    p.likes = likes;
    p.likedBy = p.likedBy.slice(0, Math.max(0, p.likedBy.length + diff));
  }
  touch();
  const r = evalPool();
  const mine = db.pool.filter((e) => e.postId === p.id);
  const p60 = r.p60;
  res.json(ok({
    postId: p.id,
    likesBefore: before,
    likesNow: p.likes,
    p60,
    qualified: mine.length > 0,
    poolEntries: mine.map((e) => ({ id: e.id, reason: e.reason })),
    note: `当日 P60=${p60}，当前赞=${p.likes}，评论=${p.commentCount}（≥10 亦入池）`,
  }));
}));
