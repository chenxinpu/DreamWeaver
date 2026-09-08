/** DTO 序列化辅助：去掉内部字段 + 组装 author/linkedWork/viewer 等展示对象 */
import { db } from '../db/store';
import type { Post, Product, User, Work, CommentItem, PoolEntry } from '../types';

export function toUserPublic(u: User) {
  return {
    id: u.id,
    nickname: u.nickname,
    avatar: u.avatar,
    bio: u.bio,
    role: u.role,
    level: u.level,
    followers: u.followers,
    following: u.following,
    createdAt: u.createdAt,
    ...(u.body ? { body: u.body } : {}),
  };
}

export function toCommentDTO(c: CommentItem) {
  const user = db.users.find((u) => u.id === c.userId);
  return { ...c, author: user ? toUserPublic(user) : null };
}

export function workBrief(w?: Work) {
  if (!w) return undefined;
  return { id: w.id, title: w.title, category: w.category, cover: w.cover, styleTags: w.styleTags, fabric: w.fabric };
}

export function materialBrief(ids: number[]) {
  return (ids || [])
    .map((id) => db.materials.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => ({ id: (m as typeof db.materials[0]).id, kind: (m as typeof db.materials[0]).kind, fileName: (m as typeof db.materials[0]).fileName, cover: (m as typeof db.materials[0]).cover }));
}

export function postDTO(p: Post, viewerId: number, opts?: { detail?: boolean }) {
  const author = db.users.find((u) => u.id === p.authorId);
  const work = p.workId ? db.works.find((w) => w.id === p.workId) : undefined;
  const dto: Record<string, unknown> = {
    id: p.id,
    authorId: p.authorId,
    author: author ? toUserPublic(author) : null,
    content: p.content,
    images: p.images,
    tags: p.tags,
    createdAt: p.createdAt,
    dateKey: p.dateKey,
    likes: p.likes,
    commentCount: p.commentCount,
    shareCount: p.shareCount,
    workId: p.workId,
    linkedWork: workBrief(work),
    patternMatIds: p.patternMatIds || [],
    modelMatIds: p.modelMatIds || [],
    materialPreview: materialBrief([...(p.patternMatIds || []), ...(p.modelMatIds || [])]).slice(0, 4),
    patternCount: (p.patternMatIds || []).length,
    modelCount: (p.modelMatIds || []).length,
    viewer: {
      liked: (p.likedBy || []).includes(viewerId),
      collected: (db.users.find((u) => u.id === viewerId)?.collectPostIds || []).includes(p.id),
    },
    inPool: !!db.pool.find((e) => e.postId === p.id),
  };
  if (opts?.detail) {
    dto.comments = (p.comments || []).map(toCommentDTO);
    // 作者查看自己推文时提供「市场认可进度」
    if (p.authorId === viewerId) {
      const todayPosts = db.posts.filter((x) => x.dateKey === p.dateKey);
      const likesAll = todayPosts.map((x) => x.likes).sort((a, b) => a - b);
      const n = likesAll.length;
      const p60 = n >= 3 ? likesAll[Math.min(n - 1, Math.ceil(n * 0.6) - 1)] : n ? likesAll.reduce((a, b) => a + b, 0) / n : 0;
      dto.market = {
        p60: Math.round(p60),
        p60Note: n >= 3 ? `当日共 ${n} 篇推文，P60=${Math.round(p60)}（点赞超过即入池）` : n ? `当日仅 ${n} 篇，按均值 P60=${Math.round(p60)}` : '当日暂无其他推文',
        commentTarget: 10,
        likes: p.likes,
        comments: p.commentCount,
        qualified: p.likes > p60 || p.commentCount >= 10,
      };
    }
  }
  return dto;
}

export function poolEntryDTO(e: PoolEntry, viewerId: number) {
  const post = db.posts.find((p) => p.id === e.postId);
  const work = e.workId ? db.works.find((w) => w.id === e.workId) : undefined;
  const product = e.workId ? db.products.find((pr) => pr.workId === e.workId) : undefined;
  const windowRec = e.workId ? db.windows.find((w) => w.workId === e.workId) : undefined;
  return {
    id: e.id,
    postId: e.postId,
    workId: e.workId,
    creatorId: e.creatorId,
    qualifiedAt: e.qualifiedAt,
    dateKey: e.dateKey,
    reason: e.reason,
    likeP60: e.likeP60,
    likeAtQualify: e.likeAtQualify,
    commentAtQualify: e.commentAtQualify,
    notifiedAt: e.notifiedAt,
    post: post ? postDTO(post, viewerId) : null,
    work: workBrief(work),
    productStatus: product ? product.status : null,
    productId: product?.id,
    windowStatus: windowRec?.status || null,
    creator: (() => {
      const u = db.users.find((x) => x.id === e.creatorId);
      return u ? toUserPublic(u) : null;
    })(),
  };
}

export function productDetailDTO(p: Product, viewerId: number) {
  const creator = db.users.find((u) => u.id === p.creatorId);
  const work = db.works.find((w) => w.id === p.workId);
  const windowRec = db.windows.find((w) => w.id === p.windowId);
  const { likedBy: _likedBy, ...pub } = p;
  return {
    ...pub,
    creator: creator ? { id: creator.id, nickname: creator.nickname, avatar: creator.avatar, followers: creator.followers } : null,
    work: workBrief(work),
    window: windowRec
      ? { id: windowRec.id, status: windowRec.status, updatedAt: windowRec.updatedAt, auditLog: windowRec.auditLog || [] }
      : null,
    patternMatIds: p.patternMatIds,
    modelMatIds: p.modelMatIds,
    patternMaterials: materialBrief(p.patternMatIds),
    modelMaterials: materialBrief(p.modelMatIds),
    viewer: {
      liked: (p.likedBy || []).includes(viewerId),
      collected: (db.users.find((u) => u.id === viewerId)?.collectProductIds || []).includes(p.id),
    },
  };
}

/** 订单详情（含 stage/qc/logistics/returnReq） */
export function orderDTO(o: import('../types').Order, viewerId: number, role: string) {
  const isOwner = o.buyerId === viewerId;
  const isSeller = o.creatorId === viewerId;
  const canReturn = isOwner && o.kind === 'custom' && (o.status === 'received' || o.status === 'completed') && (!o.returnReq || o.returnReq.state === 'none');
  const canExchange = isOwner && o.kind === 'custom' && (o.status === 'received' || o.status === 'completed') && (!o.returnReq || o.returnReq.state === 'none');
  const canCancel = isOwner && ((o.kind === 'direct' && !o.shippedAt && o.status !== 'cancelled') || (o.kind === 'custom' && o.status === 'created'));
  const canPay = isOwner && o.status === 'created';
  const canConfirm = isOwner && o.status === 'shipping';
  return {
    ...o,
    stage: o.stage,
    can: {
      isOwner,
      isSeller,
      canReturn,
      canExchange,
      canCancel,
      canPay,
      canConfirm,
      canAdvance: role === 'auditor' || role === 'admin' || isSeller || isOwner,
    },
  };
}
