/* ============================================================================
 * /me 我的 · 个人主页（抖音风）
 * 封面渐变大卡(头像/昵称/认证/简介/关注·粉丝·获赞·收藏) + 作品/喜欢/收藏三格
 * + 创作者入口卡 + 功能宫格；数据来自 /api/me 与 /api/works/mine
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { Avatar, CertBadge, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useDrawer } from '../../components/SideDrawer';
import { useMe } from '../../api/session';
import { api } from '../../api/client';
import type { Work } from '../../api/types';
import { fmtCount, imgSafe, ErrorBox, hideBadImg } from '../../components/shared/utils';
import { readCollections } from '../../utils/v2';
import type { CollectionItem } from '../../utils/v2';

type Tab = 'works' | 'likes' | 'collections';

const GRID: { icon: IconName; label: string; path: string; color: string; bg: string }[] = [
  { icon: 'store', label: '商城', path: '/mall/home', color: '#E85C87', bg: '#FBEDF2' },
  { icon: 'cart', label: '二手集市', path: '/mall/resale', color: '#3B82F6', bg: '#EAF2FE' },
  { icon: 'receipt', label: '我的订单', path: '/mall/orders', color: '#34A36F', bg: '#E6F5EE' },
  { icon: 'ruler', label: '体型数据', path: '/me/body', color: '#7C5CD6', bg: '#F0EBFC' },
  { icon: 'sparkle', label: '偏好', path: '/me/preferences', color: '#C9A23F', bg: '#FBF4E2' },
  { icon: 'star', label: '收藏夹', path: '/me/collections', color: '#F59E0B', bg: '#FDF3E3' },
  { icon: 'book', label: '学习中心', path: '/learn', color: '#0EA5A4', bg: '#E6F7F7' },
  { icon: 'bell', label: '消息通知', path: '/messages', color: '#E5484D', bg: '#FCEBEC' },
  { icon: 'settings', label: '设置', path: '/me/settings', color: '#6B6470', bg: '#F1EDE9' },
  { icon: 'help-circle', label: '帮助', path: '/me/help', color: '#8A5A00', bg: '#F9EFD8' },
];

export default function MePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const drawer = useDrawer();
  const { user, loading } = useMe();

  const [tab, setTab] = React.useState<Tab>('works');
  const [works, setWorks] = React.useState<Work[]>([]);
  const [worksErr, setWorksErr] = React.useState('');
  const [colls, setColls] = React.useState<CollectionItem[]>(() => readCollections());

  React.useEffect(() => {
    setColls(readCollections());
  }, []);

  React.useEffect(() => {
    let stop = false;
    if (user?.role === 'creator') {
      api.works.mine().then((res) => { if (!stop) setWorks(res?.list || []); }).catch((e) => { if (!stop) setWorksErr((e as Error).message); });
    } else {
      setWorks([]);
    }
    return () => { stop = true; };
  }, [user?.id, user?.role]);

  const likesGot = (user as { stats?: { likesGot?: number } } | null)?.stats?.likesGot;
  const collectedCount = (user as { stats?: { collected?: number } } | null)?.stats?.collected;

  const openItem = (c: CollectionItem) => {
    navigate(c.type === 'product' ? `/mall/product/${c.id}` : `/post/${c.id}`);
  };

  return (
    <div className="page no-tab" style={{ paddingBottom: 'calc(var(--safe-bottom) + 26px)' }}>
      {/* ======= 封面大卡 ======= */}
      <div style={{ position: 'relative', padding: '14px 16px 20px', color: '#fff', borderRadius: '0 0 30px 30px', overflow: 'hidden', background: 'linear-gradient(135deg,#F589AC 0%,#E85C87 55%,#C93E6B 100%)' }}>
        <span style={{ position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.09)' }} />
        <span style={{ position: 'absolute', bottom: -48, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
        {/* 顶部操作行 */}
        <div className="row" style={{ justifyContent: 'space-between', position: 'relative' }}>
          <span className="row" style={{ gap: 5, fontSize: 15, fontWeight: 800 }}>
            <span style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(255,255,255,.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>织</span>
            我的主页
          </span>
          <button onClick={drawer.open} style={{ color: '#fff', padding: 5 }} aria-label="侧边栏"><Icon name="menu" size={22} /></button>
        </div>

        <div className="row" style={{ gap: 14, position: 'relative', marginTop: 6 }}>
          <Avatar src={user?.avatar ? imgSafe(user.avatar) : undefined} name={user?.nickname} size={78} ring style={{ boxShadow: '0 6px 18px rgba(0,0,0,.25)' }} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
            {user ? (
              <>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 21, fontWeight: 800 }}>{user.nickname}</span>
                  <CertBadge level={user.level || 0} />
                </div>
                <div className="ellipsis" style={{ fontSize: 12, opacity: .92, marginTop: 5, maxWidth: 240 }}>{user.bio || '这个人很懒，还没有写简介'}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
                  <Stat n={user.following} label="关注" />
                  <Stat n={user.followers} label="粉丝" />
                  <Stat n={likesGot} label="获赞" />
                  <Stat n={collectedCount} label="收藏" />
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{loading ? '加载中…' : '未登录'}</div>
                <div style={{ fontSize: 12, opacity: .9, marginTop: 6 }}>登录后查看主页、订单与定制</div>
                <button onClick={() => navigate('/login')} style={{ marginTop: 10, background: '#fff', color: 'var(--brand-deep)', borderRadius: 99, padding: '6px 18px', fontSize: 12.5, fontWeight: 700 }}>
                  立即登录
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======= 创作者入口卡 ======= */}
      <div style={{ margin: '14px 12px 0' }}>
        {user?.role === 'creator' ? (
          <button onClick={() => navigate('/creator')} className="row" style={{ width: '100%', gap: 12, textAlign: 'left', padding: '13px 15px', borderRadius: 18, background: 'linear-gradient(120deg,#2F2733,#4A3A50)', color: '#fff', boxShadow: '0 8px 20px rgba(70,45,80,.25)' }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#F27BA0,#E85C87)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.4)' }}>
              <Icon name="pen-tool" size={21} />
            </span>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>创作者平台</div>
              <div style={{ fontSize: 11.5, opacity: .75, marginTop: 2 }}>素材库 · 发布推文 · 橱窗审核 · 变现看板（桌面端）</div>
            </div>
            <Icon name="arrow-right" size={18} />
          </button>
        ) : (
          <button onClick={() => { toast('开通创作者后即可上传素材、发布推文并参与橱窗变现'); navigate('/creator'); }} className="row" style={{ width: '100%', gap: 12, textAlign: 'left', padding: '13px 15px', borderRadius: 18, background: '#fff', border: '1px solid var(--line)', boxShadow: '0 4px 14px rgba(40,25,32,.06)' }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.32)' }}>
              <Icon name="crown" size={21} color="#fff" />
            </span>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>开通创作者 · 让设计被看见</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>导入 DXF/OBJ → 发推文 → 达标入池 → 橱窗变现</div>
            </div>
            <Icon name="chevron-right" size={17} color="var(--text-3)" />
          </button>
        )}
      </div>

      {/* ======= 作品/喜欢/收藏 三格 ======= */}
      <div style={{ margin: '14px 12px 0' }}>
        <div style={{ display: 'flex', borderRadius: 99, background: 'var(--bg-deep)', padding: 3 }}>
          {(['works', 'likes', 'collections'] as Tab[]).map((t) => {
            const label = t === 'works' ? '作品' : t === 'likes' ? '喜欢' : '收藏';
            const num = t === 'works' ? (user?.role === 'creator' ? works.length : undefined)
              : t === 'collections' ? colls.length : undefined;
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 99, fontSize: 13.5, fontWeight: active ? 700 : 500, background: active ? '#fff' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)', boxShadow: active ? '0 2px 8px rgba(0,0,0,.08)' : 'none', transition: 'all .18s ease' }}>
                {label}{typeof num === 'number' ? ` ${num}` : ''}
              </button>
            );
          })}
        </div>

        {/* 作品 */}
        {tab === 'works' && (
          <div style={{ marginTop: 12 }}>
            {user?.role !== 'creator' ? (
              <EmptyState icon="tshirt" title="还没有作品" desc="开通创作者后，从素材库导入设计文件 → 组织作品 → 发推文展示" />
            ) : worksErr ? (
              <ErrorBox msg={worksErr} onRetry={() => {}}>请先启动后端后刷新 /api/works/mine</ErrorBox>
            ) : works.length === 0 ? (
              <EmptyState icon="tshirt" title="还没有作品" desc="素材库导入设计结果文件后，可在创作者平台 → 作品组织里创建作品" />
            ) : (
              <div className="two-col">
                {works.map((w) => (
                  <button key={w.id} onClick={() => navigate('/creator')} className="card tap-row" style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <div className="img-ph" style={{ aspectRatio: '3/3.4' }}>
                      <img src={imgSafe(w.cover || w.mediaImages?.[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
                    </div>
                    <div style={{ padding: '7px 9px 9px' }}>
                      <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{w.title}</div>
                      <div className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{w.category} · 素材 {w.patternMatIds?.length + w.modelMatIds?.length || 0} 个</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 喜欢 */}
        {tab === 'likes' && (
          <div style={{ marginTop: 12 }}>
            <EmptyState icon="heart" title="还没有喜欢的作品" desc="在信息流或商城点「红心」后，喜欢的作品会出现在这里（V2 演示占位）" />
          </div>
        )}

        {/* 收藏 */}
        {tab === 'collections' && (
          <div style={{ marginTop: 12 }}>
            {colls.length === 0 ? (
              <EmptyState icon="star" title="收藏夹空空如也" desc="在商品详情页点收藏，随时回来看看" action={<button className="btn btn-outline btn-sm" onClick={() => navigate('/mall/home')}>去逛商城</button>} />
            ) : (
              <div className="two-col">
                {colls.map((c) => (
                  <button key={`${c.type}-${c.id}`} onClick={() => openItem(c)} className="card tap-row" style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <div className="img-ph" style={{ aspectRatio: '1/1' }}>
                      <img src={imgSafe(c.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
                    </div>
                    <div style={{ padding: '7px 9px 9px' }}>
                      <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{c.title}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{c.type === 'product' ? '商品' : '推文'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======= 功能宫格（5 列 x 2 行） ======= */}
      <div style={{ margin: '18px 12px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, background: '#fff', borderRadius: 18, padding: '14px 8px', boxShadow: '0 2px 10px rgba(40,25,32,.04)' }}>
          {GRID.map((g) => (
            <button key={g.label} onClick={() => navigate(g.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '7px 0' }}>
              <span style={{ width: 40, height: 40, borderRadius: 13, background: g.bg, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={g.icon} size={19} />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-2)' }}>{g.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n?: number | null; label: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 16, fontWeight: 800 }}>{typeof n === 'number' ? fmtCount(n) : '—'}</span>
      <span style={{ fontSize: 10.5, opacity: .85 }}>{label}</span>
    </span>
  );
}
