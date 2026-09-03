/* ============ 织梦 · 我的收藏 ============ */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { Avatar, CertBadge, EmptyState, Price } from '../../components/ui';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { postById, userById, workById } from '../../data/mock';
import { K, toggleId, useLocalState } from '../../utils/store';
import { fmt, SafeImg, TapStyle, WorkCard } from './_shared';
import type { Post, Work } from '../../data/types';

const FOLDER_ICONS: IconName[] = ['star', 'sparkle', 'cart', 'layers'];

export default function CollectionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const historyMode = params.get('tab') === 'history';

  const [tab, setTab] = useState<'works' | 'posts' | 'users' | 'folders'>('works');
  const [collectedWorks, setCollectedWorks] = useLocalState<number[]>(K.collectedWorks, []);
  const [collectedPosts, setCollectedPosts] = useLocalState<number[]>(K.collectedPosts, []);
  const [follows, setFollows] = useLocalState<number[]>(K.follows, [1, 2, 3]);
  const [folders] = useLocalState<string[]>('zm_folders', ['默认收藏', '灵感', '想买']);
  const [history, setHistory] = useLocalState<number[]>('zm_history', [101, 104, 117, 103]);
  const [folderDetail, setFolderDetail] = useState<{ name: string } | null>(null);

  const myWorks = collectedWorks.map(workById).filter((w): w is Work => !!w);
  const myPosts = collectedPosts.map(postById).filter((p): p is Post => !!p);
  const myUsers = follows.map(userById);
  const historyWorks = history.map(workById).filter((w): w is Work => !!w);

  const toggleCollected = (id: number, name: string) => {
    toggleId(K.collectedWorks, id);
    setCollectedWorks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    toast(collectedWorks.includes(id) ? `已取消收藏「${name}」` : `已收藏「${name}」`, 'check');
  };

  const togglePost = (id: number) => {
    toggleId(K.collectedPosts, id);
    setCollectedPosts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    toast('已取消收藏该推文');
  };

  const unfollow = (id: number, name: string) => {
    toggleId(K.follows, id);
    setFollows(follows.filter((x) => x !== id));
    toast(`已取消关注 ${name}`);
  };

  /* ---------- 浏览历史视图（?tab=history） ---------- */
  if (historyMode) {
    return (
      <div className="page no-tab">
        <TapStyle />
        <NavBar back title="浏览历史" right={
          <button onClick={() => { setHistory([]); toast('浏览历史已清空', 'check'); }} style={{ fontSize: 13, color: 'var(--brand-deep)', fontWeight: 600 }}>清空</button>
        } />
        <div className="page-body">
          <div className="card" style={{ padding: '6px 16px 16px' }}>
            {historyWorks.length === 0 ? (
              <EmptyState icon="clock" title="暂无浏览记录" desc="去广场逛逛，看看喜欢的作品吧" action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/plaza')}>去逛逛</button>
              } />
            ) : (
              historyWorks.map((w) => (
                <div key={w.id} className="tap row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }} onClick={() => navigate(`/work/${w.id}`)}>
                  <SafeImg src={w.cover} alt={w.title} style={{ width: 52, height: 64, borderRadius: 8 }} />
                  <div className="flex-1" style={{ marginLeft: 10, minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</div>
                    <div className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{w.category} · {w.styleTags.slice(0, 2).join(' / ')}</div>
                    <Price value={w.price} size={13} />
                  </div>
                  <Icon name="chevron-right" size={15} color="var(--text-3)" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="我的收藏" />
      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Segmented
            options={[{ value: 'works', label: '作品' }, { value: 'posts', label: '推文' }, { value: 'users', label: '达人' }, { value: 'folders', label: '收藏夹' }]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {/* 作品 */}
        {tab === 'works' && (
          myWorks.length === 0 ? (
            <EmptyState icon="star" title="还没有收藏作品" desc="看到喜欢的作品，点个收藏吧～" action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/plaza')}>去广场逛逛</button>
            } />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {myWorks.map((w) => (
                <WorkCard key={w.id} work={w} onClick={() => navigate(`/work/${w.id}`)} foot={
                  <button className="btn btn-sm tap" style={{ marginTop: 8, width: '100%', height: 30, border: '1px solid var(--line)', borderRadius: 99, color: 'var(--text-2)', fontSize: 12, background: '#fff' }} onClick={(e) => { e.stopPropagation(); toggleCollected(w.id, w.title); }}>
                    取消收藏
                  </button>
                } />
              ))}
            </div>
          )
        )}

        {/* 推文 */}
        {tab === 'posts' && (
          myPosts.length === 0 ? (
            <EmptyState icon="comment" title="还没有收藏推文" desc="收藏喜欢的穿搭分享与灵感笔记" />
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {myPosts.map((p) => {
                const author = userById(p.authorId);
                return (
                  <div key={p.id} className="tap" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }} onClick={() => toast('推文详情（模拟）')}>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar src={author.avatar} size={30} name={author.nickname} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{author.nickname}</span>
                      <span className="flex-1" />
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.time}</span>
                    </div>
                    <div className="ellipsis-2" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>{p.content}</div>
                    {p.images.length > 0 && (
                      <SafeImg src={p.images[0]} alt="推文图片" style={{ width: 96, height: 96, borderRadius: 10, marginTop: 8 }} />
                    )}
                    <div className="row" style={{ gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                      <span className="row" style={{ gap: 4 }}><Icon name="heart" size={13} />{fmt(p.likeCount)}</span>
                      <span className="row" style={{ gap: 4 }}><Icon name="star" size={13} />{fmt(p.collectCount)}</span>
                      <span className="flex-1" />
                      <button className="tap" style={{ fontSize: 12, color: 'var(--text-3)' }} onClick={(e) => { e.stopPropagation(); togglePost(p.id); }}>取消收藏</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 达人 */}
        {tab === 'users' && (
          myUsers.length === 0 ? (
            <EmptyState icon="heart" title="还没有关注的人" desc="关注喜欢的创作者，第一时间看到新作品" />
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {myUsers.map((u) => (
                <div key={u.id} className="row" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)', gap: 10 }}>
                  <Avatar src={u.avatar} size={44} name={u.nickname} />
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{u.nickname}</span>
                      <CertBadge level={u.level} />
                    </div>
                    <div className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{fmt(u.followers)} 粉丝 · {u.bio || '暂无简介'}</div>
                  </div>
                  <button className="btn btn-sm" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', height: 30 }} onClick={() => unfollow(u.id, u.nickname)}>
                    <Icon name="check" size={13} /> 已关注
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* 收藏夹 */}
        {tab === 'folders' && (
          <div className="card" style={{ padding: '6px 16px 16px' }}>
            {folders.map((f, i) => (
              <div key={f} className="tap row" style={{ padding: '13px 0', borderBottom: i < folders.length - 1 ? '1px solid var(--line)' : 'none' }} onClick={() => setFolderDetail({ name: f })}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={FOLDER_ICONS[i % FOLDER_ICONS.length]} size={18} color="var(--brand)" />
                </span>
                <span className="flex-1" style={{ fontSize: 14, fontWeight: 600, marginLeft: 10 }}>{f}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>{myWorks.length} 件</span>
                <Icon name="chevron-right" size={15} color="var(--text-3)" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 收藏夹内作品（模拟：展示当前收藏作品） */}
      <Sheet open={!!folderDetail} onClose={() => setFolderDetail(null)} title={`「${folderDetail?.name || ''}」中的作品`} height="80%">
        {myWorks.length === 0 ? (
          <EmptyState icon="star" title="收藏夹还是空的" desc="去收藏几件喜欢的作品吧" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 14 }}>
            {myWorks.map((w) => (
              <WorkCard key={w.id} work={w} onClick={() => navigate(`/work/${w.id}`)} />
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
