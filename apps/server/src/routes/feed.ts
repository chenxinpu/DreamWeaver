/** feed / posts 路由：广场、发推文、互动（点赞/评论/分享触发资源池增量评估） */
import { Router } from 'express';
import { db, nextId, touch } from '../db/store';
import type { Post } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { nowIso, dateKeyNow } from '../utils/time';
import { paginate } from '../utils/misc';
import { postDTO, toUserPublic, materialBrief } from './dto';
import { evalPool, poolMeta } from '../engine/pool';
import { notify } from '../engine/helpers';

export const feedRouter = Router();

const TAGS_REG = /#[^\s#，,]+/g;

feedRouter.post('/posts', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user) deny();
  if (user.role !== 'creator') deny('仅创作者可发布推文');
  const b = req.body || {};
  const content = String(b.content || '');
  if (!content.trim()) bad('BAD_REQUEST', '推文内容不能为空');
  const work = b.workId ? db.works.find((w) => w.id === Number(b.workId) && w.creatorId === uid) : undefined;
  if (b.workId && !work) bad('WORK_NOT_FOUND', '关联作品不存在');
  const patternMatIds: number[] = (b.patternMatIds || []).map(Number);
  const modelMatIds: number[] = (b.modelMatIds || []).map(Number);
  const allMatIds = [...patternMatIds, ...modelMatIds];
  const ownedOk = allMatIds.every((id) => db.materials.some((m) => m.id === id && m.creatorId === uid));
  if (allMatIds.length && !ownedOk) bad('MATERIAL_NOT_OWNED', '素材不存在或不属于当前账号');

  // 素材预览：images 自动补素材封面
  const images: string[] = Array.isArray(b.images) ? b.images.map(String) : [];
  if (!images.length && work && work.mediaImages.length) images.push(...work.mediaImages.slice(0, 3));
  for (const mid of allMatIds) {
    const m = db.materials.find((x) => x.id === mid);
    if (m && m.cover && images.length < 6) images.push(m.cover);
  }
  const tags: string[] = Array.isArray(b.tags) && b.tags.length ? b.tags.map(String) : (content.match(TAGS_REG) || []).map((t) => t.slice(1)).slice(0, 6);

  const p: Post = {
    id: nextId('posts'),
    authorId: uid,
    ...(work ? { workId: work.id } : {}),
    content,
    images: images.slice(0, 9),
    tags,
    createdAt: nowIso(),
    dateKey: dateKeyNow(),
    likes: 0,
    likedBy: [],
    comments: [],
    commentCount: 0,
    shareCount: 0,
    patternMatIds,
    modelMatIds,
  };
  db.posts.push(p);
  touch();
  // 发布后增量评估（作者今日推文）
  evalPool(dateKeyNow());
  const author = db.users.find((u) => u.id === uid);
  res.json(ok({ ...postDTO(p, uid, { detail: true }), materialPreview: materialBrief(allMatIds), author: author ? toUserPublic(author) : null }));
}));

feedRouter.get('/feed', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const tab = String(req.query.tab || 'rec');
  const user = db.users.find((u) => u.id === uid);
  let posts = [...db.posts];
  if (tab === 'follow' && user?.follows?.length) {
    const set = new Set(user.follows);
    posts = posts.filter((p) => set.has(p.authorId));
  } else if (tab === 'hot') {
    // 近 7 天按互动热度
    const weekAgo = Date.now() - 7 * 86400000;
    posts = posts.filter((p) => Date.parse(p.createdAt) >= weekAgo);
    posts.sort((a, b) => b.likes + b.commentCount * 3 + b.shareCount * 2 - (a.likes + a.commentCount * 3 + a.shareCount * 2));
  } else {
    // rec：关注优先 + 热度补足（确定性）
    const followSet = new Set(user?.follows || []);
    const score = (p: Post) => p.likes + p.commentCount * 4 + p.shareCount * 2 + Math.max(0, 3 - (Date.now() - Date.parse(p.createdAt)) / 86400000) * 2;
    const rec = posts.filter((p) => followSet.has(p.authorId));
    const other = posts.filter((p) => !followSet.has(p.authorId)).sort((a, b) => score(b) - score(a));
    posts = [...rec.sort((a, b) => score(b) - score(a)), ...other];
  }
  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 10;
  const paged = paginate(posts, page, pageSize);
  res.json(ok({ ...paged, list: paged.list.map((p) => postDTO(p, uid)), tab, meta: poolMeta() }));
}));

/** 我的推文（作者本人，按近 1/3/7 天筛选；每条附带 market 市场认可进度） */
feedRouter.get('/posts/mine', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const since = Date.now() - days * 86400000;
  const list = db.posts
    .filter((p) => p.authorId === uid && Date.parse(p.createdAt) >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 30;
  const paged = paginate(list, page, pageSize);
  res.json(ok({ ...paged, days, list: paged.list.map((p) => postDTO(p, uid, { detail: true })) }));
}));

feedRouter.get('/posts/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const id = Number(req.params.id);
  const p = db.posts.find((x) => x.id === id);
  if (!p) notFound('推文不存在');
  res.json(ok(postDTO(p, uid, { detail: true })));
}));

/** 点赞/取消赞 通用处理器 */
function toggleLike(p: Post, uid: number, doLike: boolean) {
  const likedBy = p.likedBy || [];
  const has = likedBy.includes(uid);
  if (doLike && !has) { p.likedBy = [...likedBy, uid]; p.likes++; }
  if (!doLike && has) { p.likedBy = likedBy.filter((x) => x !== uid); p.likes = Math.max(0, p.likes - 1); }
  touch();
  if (doLike && !has && p.authorId !== uid) {
    notify(p.authorId, 'like', '❤️ 收到了新点赞', `${db.users.find((u) => u.id === uid)?.nickname || '用户'} 赞了你的推文「${p.content.slice(0, 20)}…」`, `/post/${p.id}`);
  }
}

feedRouter.post('/posts/:id/like', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.posts.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('推文不存在');
  toggleLike(p, uid, true);
  evalPool(dateKeyNow());
  res.json(ok({ likes: p.likes, liked: true }));
}));

feedRouter.post('/posts/:id/unlike', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.posts.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('推文不存在');
  toggleLike(p, uid, false);
  res.json(ok({ likes: p.likes, liked: false }));
}));

feedRouter.post('/posts/:id/comment', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.posts.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('推文不存在');
  const content = String(req.body?.content || '').trim();
  if (!content) bad('BAD_REQUEST', '评论不能为空');
  p.comments.push({ id: nextId('comments'), userId: uid, content, createdAt: nowIso(), likes: 0 });
  p.commentCount = p.comments.length;
  touch();
  evalPool(dateKeyNow());
  if (p.authorId !== uid) {
    notify(p.authorId, 'comment', '💬 收到了新评论', `${db.users.find((u) => u.id === uid)?.nickname || '用户'} 评论：「${content.slice(0, 24)}」`, `/post/${p.id}`);
  }
  const comment = p.comments[p.comments.length - 1];
  const u = db.users.find((x) => x.id === uid);
  res.json(ok({ comment: { ...comment, author: u ? toUserPublic(u) : null }, commentCount: p.commentCount }));
}));

feedRouter.post('/posts/:id/share', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const p = db.posts.find((x) => x.id === Number(req.params.id));
  if (!p) notFound('推文不存在');
  p.shareCount++;
  touch();
  res.json(ok({ shareCount: p.shareCount }));
}));

/** 消费者首页补充：达人/官方精选（可选） */
feedRouter.get('/feed/recommend/seed', wrap(async (_req, res) => {
  const creators = db.users.filter((u) => u.role === 'creator').sort((a, b) => b.followers - a.followers).slice(0, 6);
  const featuredWorks = db.pool
    .map((e) => e.workId && db.works.find((w) => w.id === e.workId))
    .filter(Boolean)
    .slice(0, 4);
  res.json(ok({ creators: creators.map((c) => ({ id: c.id, nickname: c.nickname, avatar: c.avatar, bio: c.bio, followers: c.followers })), featured: featuredWorks }));
}));
