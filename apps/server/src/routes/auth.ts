/** auth 路由：login / switch / me / me/body */
import { Router } from 'express';
import { db, touch } from '../db/store';
import { issueToken, authRequired } from '../middleware/auth';
import { bad, ok, wrap } from '../utils/resp';
import { nowIso } from '../utils/time';
import { toUserPublic } from './dto';

export const authRouter = Router();

function login(userId: number) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) bad('USER_NOT_FOUND', `演示账号 id=${userId} 不存在`);
  const token = issueToken(userId);
  return { token, user: toUserPublic(user!), ...meAgg(userId) };
}

function meAgg(userId: number) {
  const user = db.users.find((u) => u.id === userId)!;
  const unread = db.notifications.filter((n) => n.userId === userId && !n.read).length;
  const agg: Record<string, unknown> = {
    unread,
    orderCounts: {
      created: db.orders.filter((o) => o.buyerId === userId && o.status === 'created').length,
      paid: db.orders.filter((o) => o.buyerId === userId && o.status === 'paid').length,
      shipping: db.orders.filter((o) => o.buyerId === userId && o.status === 'shipping').length,
      received: db.orders.filter((o) => o.buyerId === userId && o.status === 'received').length,
      completed: db.orders.filter((o) => o.buyerId === userId && o.status === 'completed').length,
    },
    cartCount: 0,
  };
  if (user.role === 'creator' || user.role === 'auditor' || user.role === 'admin') {
    agg.creator = {
      poolUnhandled: db.pool.filter((p) => p.creatorId === userId && p.notifiedAt && !db.windows.some((w) => w.workId === p.workId && w.status === 'submitted')).length,
      productCount: db.products.filter((p) => p.creatorId === userId && p.status === 'onSale').length,
      poolCount: db.pool.filter((p) => p.creatorId === userId).length,
      unread: db.notifications.filter((n) => n.userId === userId && !n.read).length,
    };
  }
  return agg;
}

authRouter.post('/auth/login', wrap(async (req, res) => {
  const userId = Number(req.body?.userId);
  if (!userId) bad('BAD_REQUEST', '请传 userId');
  res.json(ok(login(userId)));
}));

authRouter.post('/auth/switch', wrap(async (req, res) => {
  const userId = Number(req.body?.userId);
  if (!userId) bad('BAD_REQUEST', '请传 userId');
  res.json(ok(login(userId)));
}));

authRouter.get('/me', authRequired, wrap(async (req, res) => {
  const userId = (req as unknown as { userId: number }).userId;
  const user = db.users.find((u) => u.id === userId);
  if (!user) bad('USER_NOT_FOUND', '用户不存在');
  res.json(ok({ user: toUserPublic(user), ...meAgg(userId) }));
}));

/** 保存体型数据（手动 12 项 / AI 量体结果） */
authRouter.post('/me/body', authRequired, wrap(async (req, res) => {
  const userId = (req as unknown as { userId: number }).userId;
  const user = db.users.find((u) => u.id === userId);
  if (!user) bad('USER_NOT_FOUND', '用户不存在');
  const b = req.body || {};
  const BODY_KEYS = ['height', 'weight', 'bust', 'underBust', 'waist', 'hip', 'shoulderWidth', 'armLength', 'thigh', 'calf', 'neck', 'backLength'] as const;
  const next: Record<string, number | string> = { ...(user.body || {}) };
  for (const k of BODY_KEYS) {
    if (b[k] !== undefined) {
      const v = Number(b[k]);
      if (Number.isFinite(v)) next[k] = v;
    }
  }
  if (b.source === 'manual' || b.source === 'ai') next.source = b.source;
  next.updatedAt = nowIso();
  user.body = next as unknown as typeof user.body;
  touch();
  res.json(ok({ user: toUserPublic(user) }));
}));
