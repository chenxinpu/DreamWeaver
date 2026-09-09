/* ============================================================================
 * 消费者端 信息流共享组件（首页 / 推文详情复用）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, CertBadge } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { FeedItem, User } from '../../api/types';
import { imgSafe, fmtCount, hideBadImg, relTime } from '../../components/shared/utils';
import { MaterialEntryBadges } from '../../components/shared/MaterialBadge';
import { useLocalState, K } from '../../utils/store';

/* 关注按钮（local 演示态；服务器 follow tab 以 /api/feed 返回为准） */
export function FollowButton({ userId, size = 'md' }: { userId: number; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const [follows, setFollows] = useLocalState<number[]>(K.follows, []);
  const following = follows.includes(userId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        const now = !following;
        setFollows(now ? [...follows, userId] : follows.filter((x) => x !== userId));
        toast(now ? '关注成功' : '已取消关注', now ? 'check' : undefined);
      }}
      style={{
        flexShrink: 0, height: size === 'sm' ? 24 : 28, padding: `0 ${size === 'sm' ? 10 : 13}px`,
        borderRadius: 99, fontSize: size === 'sm' ? 11.5 : 12.5, fontWeight: 700,
        background: following ? 'var(--bg-deep)' : 'var(--brand-grad)',
        color: following ? 'var(--text-2)' : '#fff',
        boxShadow: following ? 'none' : '0 2px 6px rgba(232,92,135,.3)',
      }}
    >
      {following ? '已关注' : '+ 关注'}
    </button>
  );
}

/* 图片网格：1 张 4/3，2 张并排，3+ 三列宫格 */
export function ImgGrid({ images, tall }: { images: string[]; tall?: boolean }) {
  const n = images.length;
  if (!n) return null;
  const renderImg = (src: string) => (
    <img key={src} src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
  );
  if (n === 1) {
    return <div className="img-ph" style={{ width: '100%', aspectRatio: tall ? '3/4' : '4/3', borderRadius: 12, overflow: 'hidden' }}>{renderImg(images[0])}</div>;
  }
  if (n === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {images.map((s) => <div key={s} className="img-ph" style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden' }}>{renderImg(s)}</div>)}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
      {images.slice(0, 9).map((s) => <div key={s} className="img-ph" style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>{renderImg(s)}</div>)}
    </div>
  );
}

/** 从推文取素材引用（顶层或关联作品） */
export function matsOf(p: FeedItem): { pattern: number; model: number } {
  const w = p.linkedWork;
  return {
    pattern: (p.patternMatIds?.length ? p.patternMatIds : w?.patternMatIds)?.length || 0,
    model: (p.modelMatIds?.length ? p.modelMatIds : w?.modelMatIds)?.length || 0,
  };
}

/* 作者行（列表卡 + 详情头共用） */
export function AuthorRow({ author, time, action, onClick }: {
  author?: User | null; time?: string; action?: React.ReactNode; onClick?: () => void;
}) {
  const a = author || { id: 0, nickname: '织梦用户', avatar: '', bio: '', role: 'consumer', level: 0, followers: 0, following: 0, createdAt: '' };
  return (
    <div className="row" style={{ gap: 10 }}>
      <button onClick={onClick} style={{ display: 'flex', padding: 0 }}>
        <Avatar src={a.avatar ? imgSafe(a.avatar) : undefined} name={a.nickname} size={40} />
      </button>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="ellipsis" style={{ fontSize: 14.5, fontWeight: 700, maxWidth: 130 }}>{a.nickname}</span>
          {!!a.level && a.level > 0 && <CertBadge level={a.level} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{time || ''}</div>
      </div>
      {action}
    </div>
  );
}

/** 互动（点赞/评论/分享）—— 乐观更新 + API 持久化 */
export function usePostLikes(p: FeedItem) {
  const toast = useToast();
  const { user } = useMe();
  const [liked, setLiked] = React.useState<boolean>(() => !!(p.viewer?.liked ?? p.likedBy?.includes(user?.id ?? -1)));
  const [likes, setLikes] = React.useState<number>(p.likes || p.likedBy?.length || 0);
  const [busy, setBusy] = React.useState(false);
  const toggle = async () => {
    if (busy) return;
    const target = !liked;
    setLiked(target);
    setLikes((c) => Math.max(0, c + (target ? 1 : -1)));
    setBusy(true);
    try {
      await (target ? api.posts.like(p.id) : api.posts.unlike(p.id));
      toast(target ? '已点赞' : '已取消点赞', target ? 'heart' : undefined);
    } catch (e) {
      toast((e as Error).message || '操作失败');
      setLiked(!target);
      setLikes((c) => Math.max(0, c + (target ? -1 : 1)));
    } finally { setBusy(false); }
  };
  const share = async () => {
    try { await api.posts.share(p.id); } catch { /* 网络不可用不打断分享 toast */ }
    if (navigator.share) {
      navigator.share({ title: '织梦', text: p.content?.slice(0, 50), url: location.href }).catch(() => {});
    } else {
      try { await navigator.clipboard.writeText(location.href); toast('链接已复制'); } catch { toast('已分享'); }
    }
  };
  return { liked, likes, toggle, share };
}

/* 信息流卡片 */
export function FeedCard({ p, productLink, onOpenAuthor }: {
  p: FeedItem;
  /** workId → 对应商城 productId（页面预取；无则不跳商品） */
  productLink?: (workId: number) => number | undefined;
  onOpenAuthor?: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { liked, likes, toggle, share } = usePostLikes(p);
  const mats = matsOf(p);
  const goDetail = () => navigate(`/post/${p.id}`);
  const productId = p.workId && productLink ? productLink(p.workId) : undefined;
  const commentTip = (p.commentCount || 0) >= 10;

  return (
    <article className="card" style={{ padding: '14px 14px 6px', marginBottom: 10 }}>
      <AuthorRow author={p.author} time={relTime(p.createdAt)} action={<FollowButton userId={p.authorId} size="sm" />} onClick={onOpenAuthor} />

      {/* 文案 */}
      <div onClick={goDetail} className="whitespace-pre" style={{ fontSize: 14.5, lineHeight: 1.65, marginTop: 10, cursor: 'pointer' }}>
        {p.content}
      </div>

      {/* 图集 */}
      <div style={{ marginTop: 8 }} onClick={goDetail}>
        <ImgGrid images={p.images || []} />
      </div>

      {/* 标签 */}
      {(p.tags?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
          {p.tags.slice(0, 6).map((t) => (
            <span key={t} style={{ fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      )}

      {/* 素材徽标（3D / 打版素材数） */}
      {commentTip && (
        <div className="row" style={{ gap: 4, marginTop: 8, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
          <Icon name="award" size={12} />市场认可：评论已达 10+（自动纳入资源池）
        </div>
      )}
      <MaterialEntryBadges pattern={mats.pattern} model={mats.model} />

      {/* 关联作品/商品卡 */}
      {p.linkedWork && (
        <button
          onClick={() => {
            if (productId !== undefined) navigate(`/mall/product/${productId}`);
            else toast('该作品已进入生产评估，暂未上架商城');
          }}
          className="row"
          style={{
            width: '100%', gap: 10, marginTop: 10, padding: 9, borderRadius: 13,
            background: '#F9F6F3', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <div className="img-ph" style={{ width: 50, height: 50, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src={imgSafe(p.linkedWork.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{p.linkedWork.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {p.linkedWork.category} · {p.linkedWork.fabric || '—'}
            </div>
            {productId !== undefined && (
              <div style={{ fontSize: 11.5, color: 'var(--brand-deep)', fontWeight: 600, marginTop: 3 }}>去看看商品 / 私人定制 →</div>
            )}
          </div>
          <Icon name="chevron-right" size={16} color="var(--text-3)" />
        </button>
      )}

      {/* 互动条 */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '8px 2px 4px' }}>
        <button onClick={toggle} className="row" style={{ gap: 4, color: liked ? 'var(--brand)' : 'var(--text-2)', fontSize: 13, padding: '4px 8px', fontWeight: 600 }}>
          <Icon name={liked ? 'heart-filled' : 'heart'} size={19} color={liked ? 'var(--brand)' : undefined} />
          {fmtCount(likes)}
        </button>
        <button onClick={goDetail} className="row" style={{ gap: 4, color: 'var(--text-2)', fontSize: 13, padding: '4px 8px', fontWeight: 600 }}>
          <Icon name="comment" size={18} />
          {fmtCount(p.commentCount || p.comments?.length || 0)}
        </button>
        <button onClick={share} className="row" style={{ gap: 4, color: 'var(--text-2)', fontSize: 13, padding: '4px 8px', fontWeight: 600 }}>
          <Icon name="share" size={17} />
          {fmtCount(p.shareCount)}
        </button>
      </div>
    </article>
  );
}
