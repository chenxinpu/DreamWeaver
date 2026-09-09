/* ============================================================================
 * /post/:id 推文详情 —— 内容 / 关联素材(3D·打版弹层) / 评论（发评论调 API）
 * 评论数 ≥ 10 时展示“已满足资源池入选”提示
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Avatar, CertBadge, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { FeedItem, PostComment } from '../../api/types';
import { ImgGrid, matsOf, AuthorRow, FollowButton } from './parts';
import MaterialViewer from '../../components/shared/MaterialViewer';
import { Loading, ErrorBox, relTime, fmtCount, hideBadImg, imgSafe } from '../../components/shared/utils';
export default function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasToken } = useMe();

  const [post, setPost] = React.useState<FeedItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [viewer, setViewer] = React.useState<'3d' | 'pattern' | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await api.posts.get(id || '0');
      setPost(p);
    } catch (e) {
      setError((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const mats = post ? matsOf(post) : { pattern: 0, model: 0 };
  const viewIds = post
    ? { pattern: post.patternMatIds?.length ? post.patternMatIds : (post.linkedWork?.patternMatIds || []), model: post.modelMatIds?.length ? post.modelMatIds : (post.linkedWork?.modelMatIds || []) }
    : { pattern: [], model: [] };

  const submitComment = async () => {
    const text = input.trim();
    if (!text) { toast('先写点什么吧'); return; }
    if (!user && !hasToken) { toast('请先登录后再评论'); navigate('/login'); return; }
    setSending(true);
    try {
      const updated = await api.posts.comment(post!.id, text);
      setPost(updated);
      setInput('');
      toast('评论成功', 'check');
      if ((updated.commentCount || updated.comments?.length || 0) >= 10) {
        toast('评论已达 10 条，该作品满足资源池入选条件 🎉', 'award');
      }
    } catch (e) {
      toast((e as Error).message || '评论失败');
    } finally {
      setSending(false);
    }
  };

  const postSafe = post; // 渲染保护：post 非空时才渲染正文区块

  return (
    <div className="page no-tab page-bleed" style={{ paddingBottom: 'calc(var(--safe-bottom) + 90px)' }}>
      <NavBar back title="作品详情" right={<button onClick={() => navigate('/search')} style={{ padding: 5 }}><Icon name="search" size={20} color="var(--text-2)" /></button>} />

      {loading && <Loading text="加载推文中…" />}
      {!loading && error && (
        <div className="state-box">
          <ErrorBox msg={error} onRetry={load}>
            请确认后端服务已启动；本地无演示数据（V2 数据全部走 API）
          </ErrorBox>
        </div>
      )}

      {postSafe && post && (
        <>
          {/* ---------- 主体卡片 ---------- */}
          <article className="card" style={{ margin: '4px 12px 10px', padding: '14px' }}>
            <AuthorRow author={post.author} time={`${relTime(post.createdAt)} · ${post.dateKey || ''}`} action={<FollowButton userId={post.authorId} size="sm" />} />
            <div className="whitespace-pre" style={{ fontSize: 15, lineHeight: 1.75, marginTop: 12 }}>{post.content}</div>
            <div style={{ marginTop: 10 }}><ImgGrid images={post.images || []} /></div>

            {post.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {post.tags.map((t) => <span key={t} style={{ fontSize: 13, color: 'var(--brand-deep)' }}>{t}</span>)}
              </div>
            )}

            {/* 素材入口 */}
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {(mats.model > 0 || viewIds.model.length > 0) && (
                <button className="row" style={{ gap: 5, padding: '6px 12px', borderRadius: 99, background: 'var(--info-soft)', color: 'var(--info)', fontSize: 12, fontWeight: 700 }} onClick={() => setViewer('3d')}>
                  <Icon name="layers" size={13} />查看 3D（{viewIds.model.length}）
                </button>
              )}
              {(mats.pattern > 0 || viewIds.pattern.length > 0) && (
                <button className="row" style={{ gap: 5, padding: '6px 12px', borderRadius: 99, background: 'var(--gold-soft)', color: '#9A7A1E', fontSize: 12, fontWeight: 700 }} onClick={() => setViewer('pattern')}>
                  <Icon name="pen-tool" size={13} />打版图（{viewIds.pattern.length}）
                </button>
              )}
            </div>

            {/* 市场认可状态条 */}
            {((post.commentCount || 0) >= 10) && (
              <div className="row" style={{ gap: 8, marginTop: 12, background: 'linear-gradient(120deg,#E6F5EE,#D9F0E4)', borderRadius: 12, padding: '9px 12px', fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                <Icon name="check-circle" size={16} />
                已自动纳入资源池：评论数 {post.commentCount || post.comments?.length || 0} ≥ 10
              </div>
            )}
          </article>

          {/* ---------- 关联作品 ---------- */}
          {post.linkedWork && (
            <div className="card" style={{ margin: '0 12px 10px', padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>关联作品</div>
              <div className="row" style={{ gap: 12 }}>
                <div className="img-ph" style={{ width: 72, height: 88, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={imgSafe(post.linkedWork.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
                </div>
                <div className="flex-1 col" style={{ minWidth: 0, justifyContent: 'center' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{post.linkedWork.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{post.linkedWork.category} · {post.linkedWork.fabric}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {post.linkedWork.styleTags?.slice(0, 3).map((t) => (
                      <span key={t} style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', borderRadius: 99, padding: '2px 8px', fontSize: 10.5 }}>{t}</span>
                    ))}
                  </div>
                  <button onClick={() => toast('该作品相关商品可在「商城 → 商品」中查看/定制')} style={{ marginTop: 8, color: 'var(--brand-deep)', fontSize: 12, fontWeight: 700, alignSelf: 'flex-start' }}>
                    去商城看看 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- 评论区 ---------- */}
          <div style={{ padding: '0 12px' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>评论 <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{post.commentCount || post.comments?.length || 0}</span></span>
              {((post.commentCount || post.comments?.length || 0) >= 10) && (
                <span className="row" style={{ gap: 3, fontSize: 11, color: 'var(--success)' }}><Icon name="fire" size={11} />热门讨论中</span>
              )}
            </div>
            {(post.comments || []).length === 0 ? (
              <EmptyState icon="comment" title="还没有评论" desc="来抢沙发，说说你的看法吧" />
            ) : (
              (post.comments || []).map((c: PostComment) => (
                <CommentRow key={c.id} c={c} />
              ))
            )}
          </div>

          {/* ---------- 底部评论输入条 ---------- */}
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 90,
            background: 'rgba(255,255,255,.98)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--line)', padding: '9px 12px calc(var(--safe-bottom) + 9px)',
            display: 'flex', alignItems: 'center', gap: 9,
          }}>
            <div className="row flex-1" style={{ background: 'var(--bg-deep)', borderRadius: 99, padding: '0 14px', height: 40, gap: 8 }}>
              <Avatar src={user?.avatar ? imgSafe(user.avatar) : undefined} name={user?.nickname || '?'} size={26} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                placeholder="友善评论，说说你的看法…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, minWidth: 0 }}
              />
            </div>
            <button onClick={submitComment} disabled={sending} className="btn btn-primary btn-sm" style={{ height: 38, flexShrink: 0, width: 66, padding: 0 }}>
              <Icon name="send" size={15} />
            </button>
          </div>

          {/* 素材查看弹层 */}
          <MaterialViewer matIds={viewer === '3d' ? viewIds.model : viewer === 'pattern' ? viewIds.pattern : []} mode={viewer === 'pattern' ? 'pattern' : '3d'} open={!!viewer} onClose={() => setViewer(null)} title={viewer === 'pattern' ? '打版图预览' : '3D 模型'} />
        </>
      )}
    </div>
  );
}

/* 单条评论 */
function CommentRow({ c }: { c: PostComment }) {
  const author = c.author;
  return (
    <div className="card" style={{ padding: '11px 13px', marginBottom: 8 }}>
      <div className="row" style={{ gap: 9 }}>
        <Avatar src={author?.avatar ? imgSafe(author.avatar) : undefined} name={author?.nickname || '织梦用户'} size={32} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{author?.nickname || '织梦用户'}</span>
            {author && !!author.level && author.level > 0 && <CertBadge level={author.level} />}
          </div>
          <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.55, wordBreak: 'break-word' }}>{c.content}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 5 }}>{relTime(c.createdAt)}{c.likes > 0 && ` · ${fmtCount(c.likes)} 赞`}</div>
        </div>
      </div>
    </div>
  );
}
