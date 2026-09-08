/** users 路由：公开资料 + 创作者聚合 */
import { Router } from 'express';
import { db } from '../db/store';
import { bad, ok, wrap } from '../utils/resp';
import { toUserPublic, workBrief } from './dto';

export const usersRouter = Router();

usersRouter.get('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const user = db.users.find((u) => u.id === id);
  if (!user) bad('NOT_FOUND', '用户不存在');
  const works = db.works.filter((w) => w.creatorId === id).slice(-12);
  const agg: Record<string, unknown> = {
    user: toUserPublic(user),
    works: works.reverse().map((w) => ({ ...workBrief(w), createdAt: w.createdAt })),
    creator: user.role === 'creator' || user.role === 'auditor'
      ? {
          productCount: db.products.filter((p) => p.creatorId === id && p.status === 'onSale').length,
          poolCount: db.pool.filter((p) => p.creatorId === id).length,
          postsCount: db.posts.filter((p) => p.authorId === id).length,
        }
      : undefined,
  };
  res.json(ok(agg));
}));
