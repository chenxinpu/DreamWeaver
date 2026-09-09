/* ============================================================================
 * /me/collections 收藏夹 —— 本地快照（商品/推文），支持移除
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { readCollections, toggleCollection } from '../../utils/v2';
import type { CollectionItem } from '../../utils/v2';
import { imgSafe, hideBadImg } from '../../components/shared/utils';

export default function CollectionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = React.useState<CollectionItem[]>(() => readCollections());
  const [mode, setMode] = React.useState<'view' | 'edit'>('view');

  const open = (c: CollectionItem) => {
    if (mode === 'edit') return;
    navigate(c.type === 'product' ? `/mall/product/${c.id}` : `/post/${c.id}`);
  };
  const remove = (c: CollectionItem) => {
    const res = toggleCollection({ type: c.type, id: c.id, title: c.title, cover: c.cover, price: c.price });
    setItems(res.list);
    toast('已取消收藏', undefined);
  };

  const clearAll = () => {
    for (const c of items) toggleCollection({ type: c.type, id: c.id, title: c.title, cover: c.cover });
    setItems([]);
    toast('已清空收藏夹');
  };

  return (
    <div className="page no-tab page-bleed">
      <NavBar
        back
        title={`收藏夹 (${items.length})`}
        right={
          items.length ? (
            <button onClick={() => setMode((m) => (m === 'view' ? 'edit' : 'view'))} style={{ color: mode === 'edit' ? 'var(--danger)' : 'var(--brand)', fontSize: 13, fontWeight: 700, padding: '4px 8px' }}>
              {mode === 'view' ? '管理' : '完成'}
            </button>
          ) : undefined
        }
      />
      <div className="page-body" style={{ paddingTop: 6 }}>
        {items.length === 0 ? (
          <EmptyState
            icon="star"
            title="还没有收藏"
            desc="收藏的商城商品与推文会出现在这里，方便随时回看"
            action={<button className="btn btn-outline btn-sm" onClick={() => navigate('/mall/home')}>去商城逛逛</button>}
          />
        ) : (
          <>
            <div className="two-col">
              {items.map((c) => (
                <div key={`${c.type}-${c.id}`} className="card tap-row" style={{ overflow: 'hidden', position: 'relative', cursor: mode === 'view' ? 'pointer' : 'default' }} onClick={() => open(c)}>
                  <div className="img-ph" style={{ aspectRatio: '1/1.05' }}>
                    <img src={imgSafe(c.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{c.title}</div>
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{c.type === 'product' ? '商品' : '推文'}</span>
                      {mode === 'view' && c.type === 'product' && typeof c.price === 'number' && (
                        <span style={{ color: 'var(--brand-deep)', fontWeight: 800, fontSize: 12.5 }}>¥{c.price}</span>
                      )}
                    </div>
                  </div>
                  {mode === 'edit' && (
                    <button onClick={(e) => { e.stopPropagation(); remove(c); }} style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(229,72,77,.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
                      <Icon name="minus" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {mode === 'edit' && (
              <button className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={clearAll}>
                <Icon name="trash" size={15} />清空收藏夹
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
