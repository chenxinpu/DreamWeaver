/** pool 资源池路由 + dev eval */
import { Router } from 'express';
import { db } from '../db/store';
import { ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { evalPool, poolMeta } from '../engine/pool';
import { poolEntryDTO } from './dto';

export const poolRouter = Router();

/** 当前创作者池（含每条的 作品/推文/达标明细） */
poolRouter.get('/creator/pool', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const entries = db.pool.filter((e) => e.creatorId === uid).sort((a, b) => b.qualifiedAt.localeCompare(a.qualifiedAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const start = (page - 1) * pageSize;
  const list = entries.slice(start, start + pageSize).map((e) => poolEntryDTO(e, uid));
  res.json(ok({ list, total: entries.length, page, pageSize, meta: poolMeta() }));
}));

/** 手动触发评估 */
poolRouter.post('/dev/eval-pool', wrap(async (req, res) => {
  const result = evalPool();
  res.json(ok({
    ...result,
    added: result.added.map((e) => poolEntryDTO(e, currentUserId(req))),
  }));
}));

poolRouter.get('/pool/meta', wrap(async (_req, res) => {
  res.json(ok(poolMeta()));
}));
