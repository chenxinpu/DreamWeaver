/** products 商城路由：列表/详情/详情编辑/上下架/浏览/收藏 */
import { Router } from 'express';
import { db, touch } from '../db/store';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { paginate } from '../utils/misc';
import { dateKeyNow } from '../utils/time';
import { productDetailDTO } from './dto';
import { notify } from '../engine/helpers';

export const productsRouter = Router();

productsRouter.get('/mall/products', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const category = req.query.category ? String(req.query.category) : undefined;
  const kw = req.query.kw ? String(req.query.kw) : undefined;
  const sort = String(req.query.sort || 'hot');
  let list = db.products.filter((p) => p.status === 'onSale');
  if (category) list = list.filter((p) => p.category === category);
  if (kw) list = list.filter((p) => (p.title + p.category + p.styleTags.join(' ')).toLowerCase().includes(kw.toLowerCase()));
  const score = (p: (typeof list)[0]) => p.sales * 3 + p.views / 100;
  if (sort === 'priceAsc') list.sort((a, b) => a.price - b.price);
  else if (sort === 'priceDesc') list.sort((a, b) => b.price - a.price);
  else if (sort === 'sales') list.sort((a, b) => b.sales - a.sales);
  else list.sort((a, b) => score(b) - score(a));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 12;
  const paged = paginate(list, page, pageSize);
  res.json(ok({
    ...paged,
    categories: ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'],
    list: paged.list.map((p) => {
      const creator = db.users.find((u) => u.id === p.creatorId);
      return {
        id: p.id, title: p.title, cover: p.cover, price: p.price, baseFee: p.baseFee,
        category: p.category, styleTags: p.styleTags, sales: p.sales, views: p.views,
        creator: creator ? { id: creator.id, nickname: creator.nickname, avatar: creator.avatar } : null,
        hasCustom: p.baseFee > 0,
      };
    }),
    meta: { viewerId: uid },
  }));
}));

/** 创作者：我的全部商品（含未上架 / 下架），供商品管理/BI 使用 */
productsRouter.get('/creator/products', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user || (user.role !== 'creator' && user.role !== 'auditor' && user.role !== 'admin')) deny('仅创作者可查看');
  const status = req.query.status ? String(req.query.status) : undefined;
  const kw = req.query.kw ? String(req.query.kw) : undefined;
  let list = db.products.filter((p) => p.creatorId === uid && (!status || p.status === status));
  if (kw) list = list.filter((p) => (p.title + p.category).toLowerCase().includes(kw.toLowerCase()));
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 30;
  const paged = paginate(list, page, pageSize);
  const counts = { draft: 0, onSale: 0, offShelf: 0 };
  list.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  res.json(ok({
    ...paged,
    counts,
    list: paged.list.map((p) => {
      const dto = productDetailDTO(p, uid) as Record<string, unknown>;
      const w = db.windows.find((x) => x.id === p.windowId);
      dto.windowStatus = w ? w.status : null;
      return dto;
    }),
  }));
}));

productsRouter.get('/products/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const id = Number(req.params.id);
  const p = db.products.find((x) => x.id === id);
  if (!p) notFound('商品不存在');
  res.json(ok(productDetailDTO(p, uid)));
}));

/** 创作者编辑非材料内容 detailEdits */
productsRouter.post('/creator/products/:id/edit-detail', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('商品不存在');
  if (p.creatorId !== uid) deny();
  const b = req.body || {};
  p.detailEdits = {
    ...(p.detailEdits || {}),
    ...(b.intro !== undefined ? { intro: String(b.intro) } : {}),
    ...(b.story !== undefined ? { story: String(b.story) } : {}),
    ...(b.manufacturer !== undefined ? { manufacturer: String(b.manufacturer) } : {}),
    ...(Array.isArray(b.sections) ? { sections: b.sections.map((s: { title: string; body: string }) => ({ title: String(s.title), body: String(s.body) })) } : {}),
  };
  touch();
  res.json(ok(productDetailDTO(p, uid)));
}));

/** 上/下架 */
productsRouter.patch('/creator/products/:id/shelf', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('商品不存在');
  if (p.creatorId !== uid) deny();
  const action = String(req.body?.action || 'off');
  if (action === 'off') p.status = 'offShelf';
  else if (action === 'on') {
    const w = db.windows.find((x) => x.id === p.windowId);
    if (w && w.status !== 'approved') bad('WINDOW_NOT_APPROVED', '该商品材料未通过橱窗审核，无法上架');
    p.status = 'onSale';
  } else bad('BAD_REQUEST', 'action 需为 on/off');
  touch();
  res.json(ok(productDetailDTO(p, uid)));
}));

/** 浏览计数 */
productsRouter.post('/products/:id/view', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const p = db.products.find((x) => x.id === id);
  if (!p) notFound('商品不存在');
  p.views++;
  const dayKey = dateKeyNow();
  const rec = db.viewsByDay.find((v) => v.productId === id && v.dayKey === dayKey);
  if (rec) rec.count++;
  else db.viewsByDay.push({ productId: id, creatorId: p.creatorId, dayKey, count: 1 });
  touch();
  res.json(ok({ views: p.views }));
}));

/** 收藏（预留给「我的·收藏」） */
function toggleCollect(p: import('../types').Product, uid: number, mode: 'like' | 'unlike') {
  const user = db.users.find((u) => u.id === uid);
  if (!user) deny();
  p.likedBy = p.likedBy || [];
  const has = p.likedBy.includes(uid);
  const collects = user.collectProductIds || [];
  if (mode === 'like') {
    if (!has) { p.likedBy.push(uid); user.collectProductIds = [...collects, p.id]; }
    if (p.creatorId !== uid) notify(p.creatorId, 'like', '❤️ 商品被收藏', `${user.nickname} 收藏了「${p.title}」`, `/creator/dashboard`);
  } else {
    if (has) p.likedBy = p.likedBy.filter((x) => x !== uid);
    user.collectProductIds = collects.filter((x) => x !== p.id);
  }
  touch();
}

productsRouter.post('/products/:id/like', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('商品不存在');
  toggleCollect(p, uid, 'like');
  res.json(ok({ liked: true }));
}));

productsRouter.post('/products/:id/unlike', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.products.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('商品不存在');
  toggleCollect(p, uid, 'unlike');
  res.json(ok({ liked: false }));
}));
