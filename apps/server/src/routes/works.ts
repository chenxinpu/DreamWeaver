/** works 路由：作品组织（素材组装） */
import { Router } from 'express';
import { db, nextId, touch } from '../db/store';
import type { Work } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { nowIso } from '../utils/time';

export const worksRouter = Router();

const CATEGORIES = ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'];

worksRouter.post('/works', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user || user.role !== 'creator') deny('仅创作者可组织作品');
  const b = req.body || {};
  if (!b.title) bad('BAD_REQUEST', '请填写作品标题');
  if (!CATEGORIES.includes(b.category)) bad('BAD_REQUEST', `category 需为 ${CATEGORIES.join('/')}`);
  const patternMatIds: number[] = (b.patternMatIds || []).map(Number);
  const modelMatIds: number[] = (b.modelMatIds || []).map(Number);
  const owned = (ids: number[]) => ids.every((id) => db.materials.some((m) => m.id === id && m.creatorId === uid));
  if (!owned(patternMatIds) || !owned(modelMatIds)) bad('MATERIAL_NOT_OWNED', '素材不存在或不属于当前账号');
  const w: Work = {
    id: nextId('works'),
    creatorId: uid,
    title: String(b.title),
    category: String(b.category),
    styleTags: Array.isArray(b.styleTags) ? b.styleTags.map(String) : [],
    fabric: String(b.fabric || ''),
    desc: String(b.desc || ''),
    cover: String(b.cover || ''),
    patternMatIds,
    modelMatIds,
    mediaImages: Array.isArray(b.mediaImages) ? b.mediaImages.map(String) : [],
    createdAt: nowIso(),
  };
  db.works.push(w);
  touch();
  res.json(ok(w));
}));

worksRouter.get('/works/mine', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const list = db.works.filter((w) => w.creatorId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(ok({ list, total: list.length }));
}));

worksRouter.get('/works/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const w = db.works.find((x) => x.id === id);
  if (!w) notFound('作品不存在');
  const poolEntries = db.pool.filter((e) => e.workId === id);
  const product = db.products.find((p) => p.workId === id);
  res.json(ok({ ...w, inPool: poolEntries.length > 0, pool: poolEntries, product: product ? { id: product.id, status: product.status, title: product.title } : null }));
}));
