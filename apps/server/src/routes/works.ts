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

/** 编辑作品（作品管理 → 编辑） */
worksRouter.patch('/works/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const w = db.works.find((x) => x.id === Number(req.params.id));
  if (!w) notFound('作品不存在');
  if (w.creatorId !== uid) deny('只能编辑自己的作品');
  const b = req.body || {};
  if (b.title !== undefined) w.title = String(b.title);
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(String(b.category))) bad('BAD_REQUEST', `category 需为 ${CATEGORIES.join('/')}`);
    w.category = String(b.category);
  }
  if (Array.isArray(b.styleTags)) w.styleTags = b.styleTags.map(String);
  if (b.fabric !== undefined) w.fabric = String(b.fabric);
  if (b.desc !== undefined) w.desc = String(b.desc);
  if (b.cover !== undefined) w.cover = String(b.cover);
  if (Array.isArray(b.mediaImages)) w.mediaImages = b.mediaImages.map(String);
  if (b.patternMatIds !== undefined || b.modelMatIds !== undefined) {
    const patternMatIds: number[] = (b.patternMatIds ?? w.patternMatIds).map(Number);
    const modelMatIds: number[] = (b.modelMatIds ?? w.modelMatIds).map(Number);
    const owned = (ids: number[]) => ids.every((id) => db.materials.some((m) => m.id === id && m.creatorId === uid));
    if (!owned(patternMatIds) || !owned(modelMatIds)) bad('MATERIAL_NOT_OWNED', '素材不存在或不属于当前账号');
    w.patternMatIds = patternMatIds;
    w.modelMatIds = modelMatIds;
  }
  touch();
  res.json(ok(w));
}));

/** 删除作品（作品管理 → 删除）：已被橱窗材料/商品/资源池引用的作品不允许删除 */
worksRouter.delete('/works/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const idx = db.works.findIndex((x) => x.id === Number(req.params.id));
  if (idx < 0) notFound('作品不存在');
  if (db.works[idx].creatorId !== uid) deny('只能删除自己的作品');
  const id = db.works[idx].id;
  const usedByWindow = db.windows.some((w) => w.workId === id && w.status !== 'rejected');
  const usedByProduct = db.products.some((p) => p.workId === id);
  const usedByPool = db.pool.some((e) => e.workId === id);
  if (usedByWindow || usedByProduct || usedByPool) {
    bad('WORK_IN_USE', '该作品已被橱窗/商品/资源池引用，无法删除；可先删除对应橱窗材料或下架商品');
  }
  const [removed] = db.works.splice(idx, 1);
  touch();
  res.json(ok({ deleted: true, id: removed.id }));
}));

worksRouter.get('/works/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const w = db.works.find((x) => x.id === id);
  if (!w) notFound('作品不存在');
  const poolEntries = db.pool.filter((e) => e.workId === id);
  const product = db.products.find((p) => p.workId === id);
  res.json(ok({ ...w, inPool: poolEntries.length > 0, pool: poolEntries, product: product ? { id: product.id, status: product.status, title: product.title } : null }));
}));
