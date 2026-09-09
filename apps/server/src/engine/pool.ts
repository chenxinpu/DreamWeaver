/**
 * 资源池引擎（SPEC §3.1）
 * - 每天 00:05 自动评估（scheduler）+ 点赞/评论/发帖增量评估 + POST /api/dev/eval-pool 手动。
 * - P60 = 当日全平台推文点赞集合升序第 ceil(n*0.6) 个（n≥3）；n<3 取当日均值。
 * - 合格：likes > P60 或 commentCount >= 10 → PoolEntry（同推文只入池一次）。
 */
import { db, nextId, touch } from '../db/store';
import type { PoolEntry, PoolEvalResult } from '../types';
import { dateKeyNow, nowIso } from '../utils/time';
import { notify } from './helpers';

function p60Of(likes: number[]): number {
  const n = likes.length;
  if (n === 0) return 0;
  const sorted = [...likes].sort((a, b) => a - b);
  if (n >= 3) {
    const idx = Math.ceil(n * 0.6) - 1; // ceil(n*0.6) 个值(1基) → 数组下标 -1
    return sorted[Math.max(0, Math.min(n - 1, idx))];
  }
  // 冷启动（当日 <3 篇推文）：P60 置 0，点赞 >0 即视为超出当日热度分位
  return 0;
}

/** 评估某个日期（默认今天）的全平台推文，返回新增入池明细 */
export function evalPool(dateKey?: string): PoolEvalResult {
  const key = dateKey || dateKeyNow();
  const posts = db.posts.filter((p) => p.dateKey === key);
  const likesAll = posts.map((p) => p.likes);
  const p60 = p60Of(likesAll);
  const explain: string[] = [];
  const added: PoolEntry[] = [];
  let evaluated = 0;

  for (const post of posts) {
    if (post.authorId <= 0) continue;
    const above = post.likes > p60;
    const manyComments = post.commentCount >= 10;
    if (!above && !manyComments) continue;
    const already = db.pool.find((e) => e.postId === post.id && e.dateKey === key);
    if (already) { evaluated++; continue; }
    evaluated++;
    const reasons: string[] = [];
    if (above) reasons.push('点赞超过当日P60');
    if (manyComments) reasons.push('评论数≥10');
    const entry: PoolEntry = {
      id: nextId('pool'),
      postId: post.id,
      ...(post.workId ? { workId: post.workId } : {}),
      creatorId: post.authorId,
      qualifiedAt: nowIso(),
      dateKey: key,
      reason: reasons.join(' / '),
      likeP60: p60,
      likeAtQualify: post.likes,
      commentAtQualify: post.commentCount,
      notifiedAt: nowIso(),
    };
    db.pool.push(entry);
    added.push(entry);
    // 通知作者：引导准备橱窗材料
    const link = post.workId ? `/creator/window?workId=${post.workId}&from=pool&poolId=${entry.id}` : `/creator/pool?poolId=${entry.id}`;
    notify(
      post.authorId,
      'pool_remind',
      '🎉 作品已进入资源池',
      `你的推文「${post.content.slice(0, 24)}…」${entry.reason}（当日 P60=${p60}，你的点赞 ${post.likes}）。市场认可度达标！请准备真人穿搭图/规格表/3D与打版文件，上橱窗 → 审核通过即自动上架商城。`,
      link,
    );
    explain.push(`post#${post.id}(${post.content.slice(0, 12)}…) 点赞${post.likes}>P60(${p60}) ${manyComments ? '且评论≥10' : ''} → 已入池`);
  }

  db.settings.lastPoolEval = nowIso();
  touch();
  return {
    evaluated,
    dateKey: key,
    p60,
    n: posts.length,
    added,
    explain,
  };
}

/** 引擎说明（pool/meta 用） */
export function poolMeta(): { engine: string; lastEval: string | null; rule: string[] } {
  return {
    engine: '资源池自动筛选：当日全平台推文点赞升序 P60(ceil(0.6n))；点赞超过 P60 或评论≥10 自动入池',
    lastEval: db.settings.lastPoolEval || null,
    rule: [
      '每日 00:05 自动评估一次；点赞/评论/发帖后对该作者推文增量评估',
      '点赞集合 P60 = 当日推文点赞数升序第 ceil(n*0.6) 个；当日不足 3 篇为冷启动，P60=0（点赞>0 即入池）',
      '合格即创建资源池条目并向创作者发送提醒（准备橱窗材料）',
    ],
  };
}
