/* ============================================================================
 * /search 全局搜索 —— 商品（/mall/products kw） + 达人（/admin/users 本地过滤）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, CertBadge } from '../../components/ui';
import { Segmented, useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Product, User } from '../../api/types';
import { Loading, ErrorBox, imgSafe } from '../../components/shared/utils';
import { ProductCard } from '../mall/parts';

const HOT = ['连衣裙', '衬衫', '半裙', '羊毛大衣', '私人定制', '打版教程', '小织'];

export default function SearchPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [kw, setKw] = React.useState('');
  const [searched, setSearched] = React.useState('');
  const [tab, setTab] = React.useState<'product' | 'talent'>('product');
  const [products, setProducts] = React.useState<Product[]>([]);
  const [talents, setTalents] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const doSearch = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setSearched(q);
    setLoading(true);
    setError('');
    try {
      if (tab === 'product') {
        const res = await api.products.list({ kw: q, page: 1, pageSize: 40 });
        setProducts(res?.list || []);
      } else {
        const users = await api.admin.users('creator');
        const list = (users || []).filter((u) => u.nickname.includes(q) || (u.bio || '').includes(q));
        setTalents(list);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onSwitchTab = (v: string) => {
    setTab(v as 'product' | 'talent');
    if (searched) doSearch(searched);
  };

  return (
    <div className="page no-tab page-bleed" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      {/* 顶部搜索条 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', padding: '8px 12px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4 }}><Icon name="arrow-left" size={21} /></button>
        <div className="row flex-1" style={{ background: '#fff', borderRadius: 99, height: 40, padding: '0 14px', gap: 8, boxShadow: '0 1px 3px rgba(40,25,32,.06)' }}>
          <Icon name="search" size={16} color="var(--text-3)" />
          <input
            autoFocus
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(kw); }}
            placeholder="搜索商品 / 达人"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14 }}
          />
          {kw && <button onClick={() => { setKw(''); setSearched(''); }} style={{ padding: 2 }}><Icon name="close" size={15} color="var(--text-3)" /></button>}
        </div>
        <button onClick={() => doSearch(kw)} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 14, padding: 4 }}>搜索</button>
      </div>

      {/* 初次：热门搜索 */}
      {!searched && !loading && (
        <div style={{ padding: '4px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 10 }}>热门搜索</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOT.map((h) => (
              <button key={h} onClick={() => { setKw(h); doSearch(h); }} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 99, padding: '7px 14px', fontSize: 12.5, color: 'var(--text-2)' }}>
                {h}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 26, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.9 }}>
            试试搜索“碎花连衣裙”“小织”等关键词；达人结果会展示创作者账号。
          </div>
        </div>
      )}

      {/* Tab + 结果 */}
      {searched && (
        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Segmented
              options={[
                { value: 'product', label: `商品 ${products.length ? products.length : ''}` },
                { value: 'talent', label: `达人 ${talents.length ? talents.length : ''}` },
              ]}
              value={tab}
              onChange={(v) => onSwitchTab(String(v))}
            />
          </div>
          {loading && <Loading text="搜索中…" />}
          {!loading && error && <ErrorBox msg={error} onRetry={() => doSearch(searched)} />}
          {!loading && !error && tab === 'product' && (
            products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
                <Icon name="search" size={36} />
                <div style={{ marginTop: 12, fontSize: 13.5 }}>没有找到相关商品</div>
                <div style={{ fontSize: 11.5, marginTop: 6 }}>换个关键词，或看看热门搜索</div>
              </div>
            ) : (
              <div className="two-col" style={{ paddingBottom: 20 }}>
                {products.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            )
          )}
          {!loading && !error && tab === 'talent' && (
            talents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
                <Icon name="user" size={36} />
                <div style={{ marginTop: 12, fontSize: 13.5 }}>没有找到相关达人</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
                {talents.map((u, i) => (
                  <div key={u.id} className="row" style={{ gap: 11, padding: '12px 14px', borderBottom: i < talents.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <Avatar src={imgSafe(u.avatar)} name={u.nickname} size={44} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{u.nickname}</span>
                        <CertBadge level={u.level || 0} />
                      </div>
                      <div className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{u.bio || '这位创作者还没有简介'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>{u.followers} 粉丝</div>
                    </div>
                    <button onClick={() => toast('达人主页即将上线，先去她的作品逛逛吧')} style={{ flexShrink: 0, color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, padding: '6px 4px' }}>去看看</button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
