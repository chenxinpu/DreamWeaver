/** notifications 路由 */
import { Router } from 'express';
import { db, touch } from '../db/store';
import { ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { paginate } from '../utils/misc';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const unread = String(req.query.unread || '') === '1';
  const type = req.query.type ? String(req.query.type) : undefined;
  let list = db.notifications.filter((n) => n.userId === uid && (!unread || !n.read) && (!type || n.type === type));
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const paged = paginate(list, page, pageSize);
  const unreadCount = db.notifications.filter((n) => n.userId === uid && !n.read).length;
  res.json(ok({ ...paged, unreadCount }));
}));

notificationsRouter.post('/notifications/read', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const b = req.body || {};
  if (b.ids === 'all' || b.all) {
    for (const n of db.notifications) if (n.userId === uid) n.read = true;
  } else if (Array.isArray(b.ids)) {
    const set = new Set(b.ids.map(Number));
    for (const n of db.notifications) if (n.userId === uid && set.has(n.id)) n.read = true;
  } else {
    // 全部已读兜底
    for (const n of db.notifications) if (n.userId === uid) n.read = true;
  }
  touch();
  res.json(ok({ read: true, unreadCount: db.notifications.filter((n) => n.userId === uid && !n.read).length }));
}));
