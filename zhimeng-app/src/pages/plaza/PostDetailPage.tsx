import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Avatar, CertBadge, EmptyState, SectionHeader } from '../../components/ui';
import { CountButton, Sheet, useToast } from '../../components/Sheet';
import { commentsByPost, me, postById, userById, workById, works } from '../../data/mock';
import type { Comment, Post, Work } from '../../data/types';
import { FollowButton, PostImages, TagRow, WorkMiniCard, WorkTile, usePostActions } from './parts';

/* ============ 推文详情 ============ */
export default function PostDetailPage() {
  const { id } = useParams();
  const post = postById(Number(id));
  if (!post) {
    return (
      <div className="page no-tab">
        <NavBar back title="推文详情" />
        <EmptyState icon="comment" title="推文不存在或已删除" desc="去看看其他精彩内容吧" />
      </div>
    );
  }
  return <PostDetail post={post} />;
}

function PostDetail({ post }: { post: Post }) {
  const navigate = useNavigate();
  const toast = useToast();
  const author = userById(post.authorId);
  const { liked, likes, toggleLike, collected, collects, toggleCollect } = usePostActions(post);

  const [comments, setComments] = React.useState<Comment[]>(commentsByPost[post.id] || []);
  const [commentCount, setCommentCount] = React.useState(post.commentCount);
  const [text, setText] = React.useState('');
  const [shareOpen, setShareOpen] = React.useState(false);

  const linked = post.linkedWorkIds.map((id) => workById(id)).filter((w): w is Work => !!w);
  const cats = linked.map((w) => w.category);
  const related = (cats.length
    ? works.filter((w) => cats.includes(w.category) && !post.linkedWorkIds.includes(w.id))
    : [...works].sort((a, b) => b.likes - a.likes)
  ).slice(0, 8);

  const scrollToComments = () => document.getElementById('plaza-comments')?.scrollIntoView({ behavior: 'smooth' });

  const sendComment = () => {
    const t = text.trim();
    if (!t) { toast('先写点内容吧'); return; }
    const c: Comment = { id: Date.now(), postId: post.id, userId: me.id, content: t, likes: 0, time: '刚刚' };
    setComments((p) => [...p, c]);
    setCommentCount((n) => n + 1);
    setText('');
    toast('评论成功', 'check');
    requestAnimationFrame(scrollToComments);
  };

  return (
    <div className="page no-tab">
      <NavBar back title="推文详情" />

      <div className="page-body" style={{ paddingBottom: 96 }}>
        {/* 作者栏 */}
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <Avatar src={author.avatar} size={44} name={author.nickname} />
          <div className="flex-1 col" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="bold" style={{ fontSize: 15 }}>{author.nickname}</span>
              <CertBadge level={author.level} />
            </div>
            <div className="ellipsis" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{author.bio || '这个人很懒，什么都没写'}</div>
          </div>
          <FollowButton authorId={post.authorId} />
        </div>

        {/* 正文全文 */}
        <div style={{ fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{post.content}</div>

        {/* 图片 */}
        <div style={{ marginTop: 12 }}>
          <PostImages images={post.images} mediaType={post.mediaType} postId={post.id} />
        </div>

        <TagRow tags={post.tags} />

        {/* 互动栏 */}
        <div className="card row" style={{ marginTop: 14, padding: '8px 6px', justifyContent: 'space-around' }}>
          <CountButton icon="heart" activeIcon="heart-filled" count={likes} active={liked} activeColor="#E5484D" onToggle={toggleLike} size={22} />
          <CountButton icon="star" activeIcon="star-filled" count={collects} active={collected} activeColor="#C9A23F" onToggle={toggleCollect} size={22} />
          <button className="row" onClick={scrollToComments} style={{ gap: 5, color: 'var(--text-2)', fontSize: 13, padding: '4px 8px' }}>
            <Icon name="comment" size={22} />
            <span style={{ fontWeight: 600 }}>{commentCount}</span>
          </button>
          <button className="row" onClick={() => setShareOpen(true)} style={{ gap: 5, color: 'var(--text-2)', fontSize: 13, padding: '4px 8px' }}>
            <Icon name="share" size={22} />
            <span style={{ fontWeight: 600 }}>{post.shareCount}</span>
          </button>
        </div>

        {/* 关联作品区（最多3个） */}
        {linked.length > 0 && (
          <>
            <SectionHeader title="相关作品" />
            <div className="col" style={{ gap: 8 }}>
              {linked.slice(0, 3).map((w) => (
                <WorkMiniCard key={w.id} work={w} onClick={() => navigate(`/work/${w.id}`)} />
              ))}
            </div>
          </>
        )}

        {/* 相关推荐：同品类横滑 */}
        {related.length > 0 && (
          <>
            <SectionHeader title="相关推荐" extra="更多" onClick={() => navigate('/ranking')} />
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {related.map((w) => (
                <WorkTile key={w.id} work={w} onClick={() => navigate(`/work/${w.id}`)} />
              ))}
            </div>
          </>
        )}

        {/* 评论区 */}
        <div id="plaza-comments">
          <SectionHeader title={`评论 ${commentCount}`} />
          {comments.length === 0 ? (
            <EmptyState icon="comment" title="还没有评论，来抢沙发" />
          ) : (
            <div className="card" style={{ padding: '0 14px' }}>
              {comments.map((c, i) => <CommentItem key={c.id} comment={c} last={i === comments.length - 1} />)}
            </div>
          )}
        </div>
      </div>

      {/* 底部固定操作栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 90,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        padding: '7px 12px calc(7px + var(--safe-bottom))',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <CountButton icon="heart" activeIcon="heart-filled" count={likes} active={liked} activeColor="#E5484D" onToggle={toggleLike} size={22} />
        <CountButton icon="star" activeIcon="star-filled" count={collects} active={collected} activeColor="#C9A23F" onToggle={toggleCollect} size={22} />
        <div className="row" style={{ flex: 1, height: 36, background: 'var(--bg-deep)', borderRadius: 99, padding: '0 6px 0 14px', gap: 4, marginLeft: 2 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
            placeholder="说点什么…"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13 }}
          />
          <button onClick={sendComment} style={{ display: 'flex', padding: 6, color: text.trim() ? 'var(--brand)' : 'var(--text-3)' }}>
            <Icon name="send" size={17} />
          </button>
        </div>
        <button onClick={() => setShareOpen(true)} style={{ padding: 8, color: 'var(--text-2)', display: 'flex' }}>
          <Icon name="share" size={21} />
        </button>
      </div>

      {/* 分享面板 */}
      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="分享到">
        <div className="row" style={{ gap: 12, justifyContent: 'space-around', padding: '18px 0 26px' }}>
          {([
            { label: '微信', icon: 'message', color: '#34A36F' },
            { label: '微博', icon: 'sparkle', color: '#FF7A45' },
            { label: '复制链接', icon: 'link', color: '#3B82F6' },
          ] as const).map((o) => (
            <button
              key={o.label}
              className="col"
              style={{ alignItems: 'center', gap: 8 }}
              onClick={() => {
                setShareOpen(false);
                toast(o.label === '复制链接' ? '链接已复制' : `已分享到${o.label}`, o.label === '复制链接' ? 'link' : 'check');
              }}
            >
              <span style={{ width: 52, height: 52, borderRadius: '50%', background: `${o.color}1A`, color: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={o.icon} size={24} />
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{o.label}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* ---------- 评论条目 ---------- */
function CommentItem({ comment, last }: { comment: Comment; last?: boolean }) {
  const toast = useToast();
  const author = userById(comment.userId);
  const [liked, setLiked] = React.useState(false);
  const [likes, setLikes] = React.useState(comment.likes);
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <Avatar src={author.avatar} size={32} name={author.nickname} />
      <div className="flex-1 col" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="ellipsis" style={{ fontSize: 13, fontWeight: 600, maxWidth: 140 }}>{author.nickname}</span>
          {comment.replyTo && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>回复 @{comment.replyTo}</span>}
        </div>
        <div style={{ fontSize: 14, marginTop: 3, lineHeight: 1.6 }}>{comment.content}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{comment.time}</div>
      </div>
      <button
        onClick={() => { setLiked(!liked); setLikes((n) => Math.max(0, n + (liked ? -1 : 1))); toast(liked ? '已取消点赞' : '已点赞', liked ? undefined : 'heart'); }}
        className="row"
        style={{ gap: 3, color: liked ? '#E5484D' : 'var(--text-3)', fontSize: 11.5, padding: 4, flexShrink: 0 }}
      >
        <Icon name={liked ? 'heart-filled' : 'heart'} size={15} />
        {likes > 0 && likes}
      </button>
    </div>
  );
}
