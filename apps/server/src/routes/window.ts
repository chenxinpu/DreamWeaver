/** window 橱窗材料路由（创作者） */
import { Router } from 'express';
import { db, nextId, touch } from '../db/store';
import type { WindowMaterial, WindowSpec, FabricPart } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { nowIso } from '../utils/time';
import { submitAndAudit, checkCompleteness } from '../engine/window';

export const windowRouter = Router();

const CATEGORIES = ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'];

/** 平台默认定价（橱窗材料表单不再采集原价/基础费用，审核通过时由平台按品类给参考价） */
const DEFAULT_PRICE: Record<string, number> = { 连衣裙: 299, 衬衫: 189, 半裙: 169, 外套: 699, 裤装: 229, 套装: 459 };
const DEFAULT_BASE_FEE: Record<string, number> = { 连衣裙: 79, 衬衫: 59, 半裙: 59, 外套: 109, 裤装: 69, 套装: 99 };

function readBody(b: Record<string, unknown>): {
  workId: number; postId?: number; photos: string[]; partsFabric: FabricPart[];
  spec: WindowSpec; productName: string; category: string; styleTags: string[];
  price: number; baseFee: number; patternMatIds: number[]; modelMatIds: number[]; action: 'draft' | 'submit';
} {
  const workId = Number(b.workId);
  if (!workId) bad('BAD_REQUEST', '请选择作品(workId)');
  const action: 'draft' | 'submit' = b.action === 'submit' ? 'submit' : 'draft';
  const photos: string[] = Array.isArray(b.photos) ? b.photos.map(String) : [];
  const partsFabric: FabricPart[] = Array.isArray(b.partsFabric) ? (b.partsFabric as FabricPart[]).filter((p) => p && p.part) : [];
  const specRaw = (b.spec || {}) as { label?: string; sizeChart?: WindowSpec['sizeChart']; note?: string };
  const sizeChart: WindowSpec['sizeChart'] = Array.isArray(specRaw.sizeChart) ? specRaw.sizeChart : [];
  const spec: WindowSpec = { label: String(specRaw.label || '标准版型'), sizeChart, ...(specRaw.note ? { note: String(specRaw.note) } : {}) };
  const category = String(b.category || '');
  // 原价/基础费用不再由表单填写：未提供时采用平台按品类默认定价
  const price = Number(b.price) > 0 ? Number(b.price) : (DEFAULT_PRICE[category] || 299);
  const baseFee = Number(b.baseFee) > 0 ? Number(b.baseFee) : (DEFAULT_BASE_FEE[category] || 79);
  return {
    workId,
    ...(b.postId ? { postId: Number(b.postId) } : {}),
    photos,
    partsFabric,
    spec,
    productName: String(b.productName || ''),
    category,
    styleTags: Array.isArray(b.styleTags) ? b.styleTags.map(String) : [],
    price,
    baseFee,
    patternMatIds: Array.isArray(b.patternMatIds) ? b.patternMatIds.map(Number) : [],
    modelMatIds: Array.isArray(b.modelMatIds) ? b.modelMatIds.map(Number) : [],
    action,
  };
}

function validateOwn(w: WindowMaterial, uid: number): WindowMaterial {
  if (w.creatorId !== uid) deny('只能操作自己的橱窗材料');
  return w;
}

/** 平台默认定价补齐：原价/基础费用缺失时按品类自动给参考价（表单已不再采集） */
function ensurePricing(w: WindowMaterial): WindowMaterial {
  if (!(w.price > 0)) w.price = DEFAULT_PRICE[w.category] || DEFAULT_PRICE['连衣裙'];
  if (!(w.baseFee > 0)) w.baseFee = DEFAULT_BASE_FEE[w.category] || DEFAULT_BASE_FEE['连衣裙'];
  return w;
}

windowRouter.get('/creator/window', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const status = req.query.status ? String(req.query.status) : undefined;
  const list = db.windows
    .filter((w) => w.creatorId === uid && (!status || w.status === status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((w) => {
      const work = db.works.find((x) => x.id === w.workId);
      const product = db.products.find((p) => p.windowId === w.id);
      return { ...w, work: work ? { id: work.id, title: work.title, cover: work.cover } : null, product: product ? { id: product.id, title: product.title, status: product.status } : null };
    });
  res.json(ok({ list, total: list.length }));
}));

windowRouter.post('/creator/window', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user || user.role !== 'creator') deny('仅创作者可提交橱窗材料');
  const b = readBody(req.body || {});
  const work = db.works.find((w) => w.id === b.workId && w.creatorId === uid);
  if (!work) bad('WORK_NOT_FOUND', '作品不存在');
  if (!CATEGORIES.includes(b.category)) bad('BAD_REQUEST', `category 需为 ${CATEGORIES.join('/')}`);
  const at = nowIso();
  const w: WindowMaterial = {
    id: nextId('windows'),
    creatorId: uid,
    workId: b.workId,
    ...(b.postId ? { postId: b.postId } : {}),
    status: 'draft',
    photos: b.photos,
    partsFabric: b.partsFabric,
    spec: b.spec,
    productName: b.productName || work.title,
    category: b.category,
    styleTags: b.styleTags.length ? b.styleTags : work.styleTags,
    price: b.price,
    baseFee: b.baseFee,
    patternMatIds: b.patternMatIds.length ? b.patternMatIds : work.patternMatIds,
    modelMatIds: b.modelMatIds.length ? b.modelMatIds : work.modelMatIds,
    auditLog: [],
    createdAt: at,
    updatedAt: at,
  };
  db.windows.push(w);
  if (b.action === 'submit') {
    ensurePricing(w);
    const result = submitAndAudit(w);
    res.json(ok({ ...w, audit: { pass: result.pass, missing: result.missing, note: result.note, product: result.product ? { id: result.product.id, title: result.product.title } : null }, completeness: checkCompleteness(w) }));
    return;
  }
  touch();
  res.json(ok({ ...w, audit: null, completeness: checkCompleteness(w) }));
}));

/** 草稿更新 / 被拒后修改重提 */
windowRouter.patch('/creator/window/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const w = db.windows.find((x) => x.id === Number(req.params.id));
  if (!w) notFound('橱窗材料不存在');
  validateOwn(w, uid);
  const b = req.body || {};
  if (b.workId) {
    const work = db.works.find((x) => x.id === Number(b.workId) && x.creatorId === uid);
    if (!work) bad('WORK_NOT_FOUND', '作品不存在');
    w.workId = work.id;
  }
  if (Array.isArray(b.photos)) w.photos = b.photos.map(String);
  if (Array.isArray(b.partsFabric)) w.partsFabric = (b.partsFabric as FabricPart[]).filter((p) => p && p.part);
  if (b.spec) {
    if (Array.isArray(b.spec.sizeChart)) w.spec.sizeChart = b.spec.sizeChart;
    if (b.spec.label !== undefined) w.spec.label = String(b.spec.label);
    if (b.spec.note !== undefined) w.spec.note = String(b.spec.note);
  }
  if (b.productName) w.productName = String(b.productName);
  if (b.category) w.category = String(b.category);
  if (Array.isArray(b.styleTags)) w.styleTags = b.styleTags.map(String);
  if (b.price !== undefined) w.price = Number(b.price) || 0;
  if (b.baseFee !== undefined) w.baseFee = Number(b.baseFee) || 0;
  if (Array.isArray(b.patternMatIds)) w.patternMatIds = b.patternMatIds.map(Number);
  if (Array.isArray(b.modelMatIds)) w.modelMatIds = b.modelMatIds.map(Number);
  const wasApproved = w.status === 'approved';
  w.status = 'draft';
  w.updatedAt = nowIso();
  if (wasApproved) {
    // 材料变更 → 原商品下架提示（需重新审核）
    const product = db.products.find((p) => p.windowId === w.id);
    if (product && product.status === 'onSale') {
      product.status = 'offShelf';
    }
  }
  if (b.action === 'submit') {
    ensurePricing(w);
    const result = submitAndAudit(w);
    res.json(ok({ ...w, audit: { pass: result.pass, missing: result.missing, note: result.note, product: result.product ? { id: result.product.id, title: result.product.title } : null }, offShelf: wasApproved, completeness: checkCompleteness(w) }));
    return;
  }
  touch();
  res.json(ok({ ...w, audit: null, offShelf: wasApproved, completeness: checkCompleteness(w) }));
}));

/** 提交审核 */
windowRouter.post('/creator/window/:id/submit', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const w = db.windows.find((x) => x.id === Number(req.params.id));
  if (!w) notFound('橱窗材料不存在');
  validateOwn(w, uid);
  ensurePricing(w);
  const result = submitAndAudit(w);
  res.json(ok({ ...w, audit: { pass: result.pass, missing: result.missing, note: result.note, product: result.product ? { id: result.product.id, title: result.product.title } : null }, completeness: checkCompleteness(w) }));
}));

/** 删除橱窗材料（仅草稿 / 被拒状态可删；审核中、已通过需先处理关联商品） */
windowRouter.delete('/creator/window/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const idx = db.windows.findIndex((x) => x.id === Number(req.params.id));
  if (idx < 0) notFound('橱窗材料不存在');
  const w = db.windows[idx];
  validateOwn(w, uid);
  if (w.status === 'approved' || w.status === 'submitted') {
    deny(w.status === 'approved' ? '该材料已审核通过并生成商品，请先到「商品管理」下架后再处理' : '该材料正在审核中，暂不能删除，可在审核通过/驳回后再删除');
  }
  const product = db.products.find((p) => p.windowId === w.id);
  if (product) deny('该材料已生成商品，请先在商品管理中下架删除关联商品');
  db.windows.splice(idx, 1);
  touch();
  res.json(ok({ deleted: true, id: w.id }));
}));

windowRouter.get('/creator/window/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const w = db.windows.find((x) => x.id === Number(req.params.id));
  if (!w) notFound('橱窗材料不存在');
  if (w.creatorId !== uid) {
    const user = db.users.find((u) => u.id === uid);
    if (!user || (user.role !== 'auditor' && user.role !== 'admin')) deny();
  }
  const work = db.works.find((x) => x.id === w.workId);
  const product = db.products.find((p) => p.windowId === w.id);
  res.json(ok({ ...w, work: work || null, product: product || null, completeness: checkCompleteness(w) }));
}));
