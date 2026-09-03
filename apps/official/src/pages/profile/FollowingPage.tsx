/* ============ 织梦 · 我的关注 ============ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, CertBadge, EmptyState, Tag } from '../../components/ui';
import { Segmented, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { userById, worksByCreator } from '../../data/mock';
import { K, toggleId, useLocalState } from '../../utils/store';
import { fmt, SafeImg, TapStyle } from './_shared';
import type { User } from '../../data/types';

export default function FollowingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'users' | 'works'>('users');
  const [follows, setFollows] = useLocalState<number[]>(K.follows, [1, 2, 3]);

  const users = follows.map(userById);

  const unfollow = (u: User) => {
    toggleId(K.follows, u.id);
    setFollows(follows.filter((x) => x !== u.id));
    toast(`已取消关注 ${u.nickname}`);
  };

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="我的关注" />
      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Segmented options={[{ value: 'users', label: '达人' }, { value: 'works', label: '作品集' }]} value={tab} onChange={setTab} />
        </div>

        {/* 达人 */}
        {tab === 'users' && (
          users.length === 0 ? (
            <EmptyState icon="heart" title="还没有关注的人" desc="关注喜欢的创作者，第一时间看到新作品" action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/plaza')}>去逛逛</button>
            } />
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {users.map((u) => (
                <div key={u.id} className="row" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)', gap: 10 }}>
                  <Avatar src={u.avatar} size={46} name={u.nickname} />
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{u.nickname}</span>
                      <CertBadge level={u.level} />
                    </div>
                    <div className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{fmt(u.followers)} 粉丝 · {u.bio || '暂无简介'}</div>
                  </div>
                  <button className="btn btn-sm" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)', height: 30 }} onClick={() => unfollow(u)}>
                    <Icon name="check" size={13} /> 已关注
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* 作品集 */}
        {tab === 'works' && (
          users.filter((u) => worksByCreator(u.id).length > 0 || u.works > 0).length === 0 ? (
            <EmptyState icon="store" title="还没有关注的作品集" desc="关注创作者后，这里会展示他们的作品集" />
          ) : (
            users.filter((u) => worksByCreator(u.id).length > 0 || u.works > 0).map((u) => {
              const ws = worksByCreator(u.id);
              const covers = ws.slice(0, 3).map((w) => w.cover);
              return (
                <button
                  key={u.id}
                  className="tap card"
                  style={{ padding: 14, width: '100%', textAlign: 'left', marginBottom: 12 }}
                  onClick={() => toast(`「${u.brandName || u.nickname}」作品集（模拟）`)}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {covers.length > 0 ? covers.map((c, i) => (
                      <SafeImg key={i} src={c} style={{ width: '100%', aspectRatio: '1', borderRadius: 8 }} />
                    )) : (
                      <div style={{ gridColumn: '1 / -1', height: 64, background: 'var(--bg-deep)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>暂无作品</div>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <Avatar src={u.avatar} size={26} name={u.nickname} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.brandName || u.nickname}</span>
                    <CertBadge level={u.level} />
                    <span className="flex-1" />
                    <Tag variant="gray">{ws.length}件作品</Tag>
                  </div>
                </button>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
