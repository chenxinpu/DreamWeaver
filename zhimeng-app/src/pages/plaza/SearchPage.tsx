import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Avatar, CertBadge, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { posts, userById, users, works } from '../../data/mock';
import type { Post } from '../../data/types';
import { formatCount, hideImg, WorkTile } from './parts';

const HOT_WORDS = ['法式', '碎花连衣裙', '真丝半裙', '通勤穿搭', '针织开衫', '泡泡袖', '定制西装', '买家秀'];

/* ============ 全局搜索 ============ */
export default function SearchPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [q, setQ] = React.useState('');
  const [history, setHistory] = useLocalState<string[]>('zm_search_history', []);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const keyword = q.trim();
  const workHits = keyword ? works.filter((w) => w.title.includes(keyword)) : [];
  const userHits = keyword ? users.filter((u) => u.nickname.includes(keyword) || (u.brandName || '').includes(keyword)) : [];
  const postHits = keyword ? posts.filter((p) => p.content.includes(keyword) || p.tags.some((t) => t.includes(keyword))) : [];
  const none = keyword.length > 0 && workHits.length === 0 && userHits.length === 0 && postHits.length === 0;

  const commit = (word: string) => {
    const v = word.trim();
    if (!v) return;
    setQ(v);
    setHistory((h) => [v, ...h.filter((x) => x !== v)].slice(0, 10));
  };

  return (
    <div className="page no-tab">
      <NavBar
        back
        title={
          <div className="row" style={{ background: 'var(--bg-deep)', borderRadius: 99, padding: '0 12px', height: 36, gap: 6 }}>
            <Icon name="search" size={16} color="var(--text-3)" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(q); }}
              placeholder="搜索作品 / 设计师 / 风格"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5 }}
            />
            {q && (
              <button onClick={() => setQ('')} style={{ display: 'flex', padding: 2, color: 'var(--text-3)' }}>
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        }
      />

      <div className="page-body">
        {!keyword ? (
          <>
            {/* 热搜榜 */}
            <div className="row" style={{ gap: 6, margin: '6px 0 12px', fontSize: 15, fontWeight: 700 }}>
              <Icon name="fire" size={18} color="#FF6B3D" />热搜榜
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {HOT_WORDS.map((h, i) => (
                <button key={h} onClick={() => commit(h)} className="row" style={{ gap: 6, padding: '8px 12px', background: '#fff', borderRadius: 99, border: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 16, color: i < 3 ? '#FF5A5F' : 'var(--text-3)' }}>{i + 1}</span>
                  <span style={{ fontSize: 13 }}>{h}</span>
                </button>
              ))}
            </div>

            {/* 搜索历史 */}
            {history.length > 0 && (
              <>
                <div className="row" style={{ justifyContent: 'space-between', margin: '26px 0 10px' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>搜索历史</span>
                  <button onClick={() => setHistory([])} className="row" style={{ gap: 3, color: 'var(--text-3)', fontSize: 12.5 }}>
                    <Icon name="trash" size={14} />清空
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {history.map((h) => (
                    <button key={h} onClick={() => commit(h)} className="tag tag-line" style={{ fontSize: 12.5 }}>{h}</button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* 作品结果 */}
            {workHits.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 12px' }}>
                  作品 <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>{workHits.length} 个</span>
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {workHits.map((w) => (
                    <WorkTile key={w.id} work={w} onClick={() => navigate(`/work/${w.id}`)} />
                  ))}
                </div>
              </>
            )}

            {/* 创作者结果 */}
            {userHits.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>
                  创作者 <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>{userHits.length} 位</span>
                </div>
                <div className="card" style={{ padding: '0 14px' }}>
                  {userHits.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => toast('进入主页')}
                      className="row"
                      style={{ width: '100%', gap: 10, padding: '12px 0', borderBottom: i < userHits.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left' }}
                    >
                      <Avatar src={u.avatar} size={42} name={u.nickname} />
                      <div className="flex-1 col" style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="ellipsis bold" style={{ fontSize: 14, maxWidth: 140 }}>{u.nickname}</span>
                          <CertBadge level={u.level} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{formatCount(u.followers)} 粉丝</span>
                      </div>
                      <Icon name="chevron-right" size={16} color="var(--text-3)" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 推文结果 */}
            {postHits.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>
                  推文 <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>{postHits.length} 篇</span>
                </div>
                <div className="col" style={{ gap: 10 }}>
                  {postHits.map((p) => (
                    <SearchPostRow key={p.id} post={p} onClick={() => navigate(`/plaza/post/${p.id}`)} />
                  ))}
                </div>
              </>
            )}

            {/* 空结果 */}
            {none && <EmptyState icon="search" title={`没有找到「${keyword}」相关内容`} desc="换个关键词试试吧" />}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 搜索推文结果行 ---------- */
function SearchPostRow({ post, onClick }: { post: Post; onClick: () => void }) {
  const author = userById(post.authorId);
  return (
    <button onClick={onClick} className="card row" style={{ width: '100%', gap: 10, padding: 10, textAlign: 'left' }}>
      <div className="img-ph" style={{ width: 62, height: 62, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
        <img src={post.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideImg} loading="lazy" />
      </div>
      <div className="flex-1 col" style={{ minWidth: 0 }}>
        <div className="ellipsis-2" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{post.content}</div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <Avatar src={author.avatar} size={18} name={author.nickname} />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{author.nickname}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>· {post.time}</span>
        </div>
      </div>
    </button>
  );
}
