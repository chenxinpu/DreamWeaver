import React from 'react';
import Icon from '../../components/Icon';
import { Price, Tag } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { K, isIn, toggleId, useLocalState } from '../../utils/store';
import type { Post, Work } from '../../data/types';

/* ---------- 数字格式化（1.2w） ---------- */
export const formatCount = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w` : String(n);

/* ---------- 图片加载失败兜底：隐藏 img，露出 img-ph 占位底色 ---------- */
export const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => {
  (e.target as HTMLImageElement).style.opacity = '0';
};

/* ---------- 关注状态（localStorage 持久化，zm_follows） ---------- */
export function useFollows() {
  const [follows, setFollows] = useLocalState<number[]>(K.follows, []);
  const isFollowing = React.useCallback((id: number) => follows.includes(id), [follows]);
  const toggle = React.useCallback(
    (id: number) => {
      const now = !follows.includes(id);
      setFollows((p) => (now ? [...p, id] : p.filter((x) => x !== id)));
      return now;
    },
    [follows, setFollows],
  );
  return { follows, isFollowing, toggle };
}

/* ---------- 关注按钮（小胶囊，已关注状态切换） ---------- */
export function FollowButton({ authorId, size = 'md' }: { authorId: number; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const { isFollowing, toggle } = useFollows();
  const following = isFollowing(authorId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        const now = toggle(authorId);
        toast(now ? '关注成功' : '已取消关注', now ? 'check' : undefined);
      }}
      style={{
        flexShrink: 0,
        height: size === 'sm' ? 24 : 28,
        padding: `0 ${size === 'sm' ? 10 : 14}px`,
        borderRadius: 99,
        fontSize: size === 'sm' ? 11.5 : 12.5,
        fontWeight: 600,
        background: following ? 'var(--bg-deep)' : 'var(--brand-grad)',
        color: following ? 'var(--text-2)' : '#fff',
        boxShadow: following ? 'none' : '0 2px 6px rgba(232,92,135,.3)',
        transition: 'all .15s ease',
      }}
    >
      {following ? '已关注' : '+ 关注'}
    </button>
  );
}

/* ---------- 推文图片区：1张全宽 / 2张并排 / 3+九宫格，视频带播放角标+时长 ---------- */
export function PostImages({ images, mediaType, postId }: { images: string[]; mediaType: Post['mediaType']; postId: number }) {
  const n = images.length;
  const video = mediaType === 'video';
  const secs = 15 + ((postId * 37) % 140);
  const dur = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

  const render = (src: string, box?: React.CSSProperties) => (
    <div key={src} className="img-ph" style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, ...box }}>
      <img src={src} alt="" style={imgStyle} onError={hideImg} loading="lazy" />
      {video && (
        <>
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 }}>
              <Icon name="play" size={20} color="#fff" />
            </span>
          </span>
          <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 99, lineHeight: 1.4 }}>
            {dur}
          </span>
        </>
      )}
    </div>
  );

  if (n === 1) return render(images[0], { aspectRatio: '4/3' });
  if (n === 2) {
    return (
      <div className="row" style={{ gap: 8 }}>
        {images.map((s) => render(s, { aspectRatio: '1', flex: 1 }))}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {images.map((s) => render(s, { aspectRatio: '1' }))}
    </div>
  );
}

/* ---------- 标签行（数据已含 #） ---------- */
export function TagRow({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {tags.map((t) => (
        <span key={t} style={{ fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 500 }}>{t}</span>
      ))}
    </div>
  );
}

/* ---------- 推文点赞 / 收藏交互（localStorage 持久化 + toast 反馈） ---------- */
export function usePostActions(post: Post) {
  const toast = useToast();
  const [liked, setLiked] = React.useState(() => isIn(K.likedPosts, post.id));
  const [likes, setLikes] = React.useState(() => post.likeCount + (isIn(K.likedPosts, post.id) ? 1 : 0));
  const [collected, setCollected] = React.useState(() => isIn(K.collectedPosts, post.id));
  const [collects, setCollects] = React.useState(() => post.collectCount + (isIn(K.collectedPosts, post.id) ? 1 : 0));
  const toggleLike = () => {
    const now = toggleId(K.likedPosts, post.id);
    setLiked(now);
    setLikes((c) => Math.max(0, c + (now ? 1 : -1)));
    toast(now ? '已点赞' : '已取消点赞', now ? 'heart' : undefined);
  };
  const toggleCollect = () => {
    const now = toggleId(K.collectedPosts, post.id);
    setCollected(now);
    setCollects((c) => Math.max(0, c + (now ? 1 : -1)));
    toast(now ? '已收藏' : '已取消收藏', now ? 'star' : undefined);
  };
  return { liked, likes, toggleLike, collected, collects, toggleCollect };
}

/* ---------- 作品横条小卡（关联作品） ---------- */
export function WorkMiniCard({ work, onClick }: { work: Work; onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
  return (
    <button
      onClick={onClick}
      className="row"
      style={{ width: '100%', gap: 10, padding: 8, borderRadius: 12, background: '#F9F6F3', textAlign: 'left' }}
    >
      <div className="img-ph" style={{ width: 46, height: 46, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
        <img src={work.cover} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideImg} loading="lazy" />
      </div>
      <div className="flex-1 col" style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{work.title}</div>
        <div className="row" style={{ gap: 8, marginTop: 3 }}>
          <Tag variant="line">{work.category}</Tag>
          <Price value={work.price} size={12.5} />
        </div>
      </div>
      <Icon name="chevron-right" size={16} color="var(--text-3)" />
    </button>
  );
}

/* ---------- 作品竖卡（横滑列表用） ---------- */
export function WorkTile({ work, onClick }: { work: Work; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 128, flexShrink: 0, textAlign: 'left' }}>
      <div className="img-ph" style={{ width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden' }}>
        <img src={work.cover} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideImg} loading="lazy" />
      </div>
      <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{work.title}</div>
      <div className="row" style={{ gap: 6, marginTop: 2 }}>
        <Price value={work.price} size={13} />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>已售 {work.sales}</span>
      </div>
    </button>
  );
}
