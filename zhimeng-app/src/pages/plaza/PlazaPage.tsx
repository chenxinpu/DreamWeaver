import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, CertBadge } from '../../components/ui';
import { CountButton, Segmented, useToast } from '../../components/Sheet';
import { posts, userById, workById } from '../../data/mock';
import type { Post, Work } from '../../data/types';
import { PostImages, TagRow, WorkMiniCard, useFollows, usePostActions } from './parts';

type TabKey = 'rec' | 'follow' | 'hot';

/* ============ 广场首页 ============ */
export default function PlazaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = React.useState<TabKey>('rec');
  const { isFollowing, toggle } = useFollows();

  const list = React.useMemo(() => {
    if (tab === 'follow') return posts.filter((p) => [1, 2, 3, 6].includes(p.authorId));
    if (tab === 'hot') return [...posts].sort((a, b) => b.likeCount - a.likeCount);
    return posts;
  }, [tab]);

  const handleFollow = (id: number) => {
    const now = toggle(id);
    toast(now ? '关注成功' : '已取消关注', now ? 'check' : undefined);
  };

  return (
    <div className="page">
      {/* 顶部：品牌 + 搜索 + 铃铛 + 发布 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '10px 16px 8px',
      }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 7, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--brand-grad)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 18, boxShadow: '0 4px 10px rgba(232,92,135,.35)',
            }}>织</div>
            <span style={{
              background: 'var(--brand-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontWeight: 800, fontSize: 19, letterSpacing: 1,
            }}>织梦</span>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="row"
            style={{ flex: 1, height: 36, background: 'var(--bg-deep)', borderRadius: 99, padding: '0 12px', gap: 6, color: 'var(--text-3)', fontSize: 13 }}
          >
            <Icon name="search" size={16} />
            <span className="ellipsis">搜索作品 / 设计师 / 风格</span>
          </button>
          <button onClick={() => navigate('/messages')} style={{ position: 'relative', padding: 6, flexShrink: 0 }}>
            <Icon name="bell" size={22} />
            <span style={{ position: 'absolute', top: 5, right: 4, width: 7, height: 7, borderRadius: 99, background: '#FF3B5C', border: '1.5px solid #fff' }} />
          </button>
          <button
            onClick={() => navigate('/plaza/publish')}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-grad)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(232,92,135,.4)',
            }}
          >
            <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* 下拉刷新（模拟） */}
        <button className="sim-pull row" onClick={() => toast('已刷新')} style={{ width: '100%', justifyContent: 'center', gap: 5 }}>
          <Icon name="refresh" size={14} />下拉刷新
        </button>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }}>
          <Segmented
            options={[{ value: 'rec', label: '推荐' }, { value: 'follow', label: '关注' }, { value: 'hot', label: '热门' }]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {/* 信息流 */}
        {list.map((p) => (
          <PostCard key={p.id} post={p} followed={isFollowing(p.authorId)} onFollow={handleFollow} />
        ))}

        {/* 上拉加载更多（模拟） */}
        <button className="row" onClick={() => toast('已是最新内容啦')} style={{ width: '100%', justifyContent: 'center', padding: '14px 0 6px', fontSize: 12.5, color: 'var(--text-3)' }}>
          上拉加载更多
        </button>
      </div>
    </div>
  );
}

/* ---------- 信息流卡片 ---------- */
function PostCard({ post, followed, onFollow }: { post: Post; followed: boolean; onFollow: (id: number) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { liked, likes, toggleLike, collected, collects, toggleCollect } = usePostActions(post);
  const author = userById(post.authorId);
  const linked = post.linkedWorkIds.map((id) => workById(id)).filter((w): w is Work => !!w);

  return (
    <div className="card fade-in" onClick={() => navigate(`/plaza/post/${post.id}`)} style={{ padding: 14, marginBottom: 10 }}>
      {/* 作者行 */}
      <div className="row" style={{ gap: 10 }}>
        <Avatar src={author.avatar} size={38} name={author.nickname} />
        <div className="flex-1 col" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="ellipsis bold" style={{ fontSize: 14, maxWidth: 110 }}>{author.nickname}</span>
            <CertBadge level={author.level} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{post.time}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFollow(post.authorId); }}
          style={{
            flexShrink: 0, height: 26, padding: '0 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            background: followed ? 'var(--bg-deep)' : 'var(--brand-grad)',
            color: followed ? 'var(--text-2)' : '#fff',
            boxShadow: followed ? 'none' : '0 2px 6px rgba(232,92,135,.3)',
          }}
        >
          {followed ? '已关注' : '关注'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); toast('更多操作'); }} style={{ padding: 4, flexShrink: 0 }}>
          <Icon name="more" size={18} color="var(--text-3)" />
        </button>
      </div>

      {/* 内容文本 */}
      <div className="ellipsis-2" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10, whiteSpace: 'pre-line' }}>{post.content}</div>

      {/* 图片区 */}
      <div style={{ marginTop: 10 }}>
        <PostImages images={post.images} mediaType={post.mediaType} postId={post.id} />
      </div>

      {/* 标签行 */}
      <TagRow tags={post.tags} />

      {/* 关联作品卡 */}
      {linked.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <WorkMiniCard
            work={linked[0]}
            onClick={(e) => { e.stopPropagation(); navigate(`/work/${linked[0].id}`); }}
          />
        </div>
      )}

      {/* 互动行 */}
      <div className="row" style={{ justifyContent: 'space-around', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <CountButton icon="heart" activeIcon="heart-filled" count={likes} active={liked} activeColor="#E5484D" onToggle={toggleLike} />
        <CountButton icon="star" activeIcon="star-filled" count={collects} active={collected} activeColor="#C9A23F" onToggle={toggleCollect} />
        <button className="row" onClick={(e) => { e.stopPropagation(); navigate(`/plaza/post/${post.id}`); }} style={{ gap: 5, color: 'var(--text-2)', fontSize: 13, padding: '4px 6px' }}>
          <Icon name="comment" size={20} />
          {post.commentCount > 0 && <span style={{ fontWeight: 600 }}>{post.commentCount}</span>}
        </button>
        <button className="row" onClick={(e) => { e.stopPropagation(); toast('已复制分享链接'); }} style={{ gap: 5, color: 'var(--text-2)', fontSize: 13, padding: '4px 6px' }}>
          <Icon name="share" size={20} />
          {post.shareCount > 0 && <span style={{ fontWeight: 600 }}>{post.shareCount}</span>}
        </button>
      </div>
    </div>
  );
}
