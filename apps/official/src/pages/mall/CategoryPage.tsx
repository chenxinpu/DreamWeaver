/* ============================================================================
 * /mall/category 商城分类页 —— 左侧品类导航 + 右侧商品双列
 * ?cat=新品 → sort=newest；cat=品类名过滤
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { api } from '../../api/client';
import type { Product } from '../../api/types';
import { Loading, ErrorBox } from '../../components/shared/utils';
import { ProductCard, StateNote } from './parts';

const RAIL: { key: string; label: string; icon: IconName; sort?: string }[] = [
  { key: '推荐', label: '推荐', icon: 'sparkle' },
  { key: '新品', label: '新品', icon: 'gift', sort: 'new' },
  { key: '连衣裙', label: '连衣裙', icon: 'dress' },
  { key: '衬衫', label: '衬衫', icon: 'tshirt' },
  { key: '半裙', label: '半裙', icon: 'skirt' },
  { key: '外套', label: '外套', icon: 'jacket' },
  { key: '裤装', label: '裤装', icon: 'pants' },
  { key: '套装', label: '套装', icon: 'layers' },
];

export default function MallCategoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const init = params.get('cat') || '推荐';
  const [cat, setCat] = React.useState<string>(init);
  const [list, setList] = React.useState<Product[]>([]);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => { setCat(params.get('cat') || '推荐'); }, [params]);

  const load = React.useCallback(async (c: string, p: number, append = false) => {
    const isNew = c === '新品';
    setError('');
    if (p === 1 && !append) setLoading(true);
    try {
      const res = await api.products.list({
        category: isNew || c === '推荐' ? undefined : c,
        sort: isNew ? 'new' : c === '推荐' ? undefined : undefined,
        page: p, pageSize: 10,
      });
      const arr = res?.list || [];
      setList((prev) => (append ? [...prev, ...arr] : arr));
      setPage(p);
      setEnd(!arr.length || arr.length < 10);
    } catch (e) {
      setError((e as Error).message);
      if (!append) setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(cat, 1); }, [cat, load]);

  const pick = (c: string) => { setCat(c); setList([]); };

  return (
    <div className="mall-page no-tab" style={{ paddingBottom: 'calc(var(--safe-bottom) + 96px)' }}>
      <div className="mall-topbar">
        <span style={{ fontSize: 16.5, fontWeight: 800, color: '#1F2329', flexShrink: 0 }}>分类</span>
        <button onClick={() => navigate('/mall/search')} className="row flex-1" style={{ height: 36, background: '#fff', borderRadius: 99, padding: '0 13px', gap: 6, color: '#9AA0A6', fontSize: 13, boxShadow: '0 1px 3px rgba(20,20,30,.04)' }}>
          <Icon name="search" size={15} />
          <span className="ellipsis">搜索商品</span>
        </button>
      </div>

      <div style={{ display: 'flex', minHeight: '68vh' }}>
        {/* 左侧品类栏 */}
        <div style={{ width: 92, flexShrink: 0, background: '#fff', borderRight: '1px solid var(--mall-line)', padding: '6px 0' }}>
          {RAIL.map((r) => {
            const on = cat === r.key;
            return (
              <button key={r.key} onClick={() => pick(r.key)} style={{
                width: '100%', padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontSize: 11.5, fontWeight: on ? 800 : 500, color: on ? 'var(--brand-deep)' : 'var(--text-2)',
                background: on ? 'var(--brand-soft)' : 'transparent', borderLeft: on ? '3px solid var(--brand)' : '3px solid transparent',
              }}>
                <Icon name={r.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-3)'} />
                {r.label}
              </button>
            );
          })}
        </div>

        {/* 右侧商品 */}
        <div className="flex-1" style={{ minWidth: 0, padding: '8px 8px 20px' }}>
          {loading && <Loading text="加载商品…" />}
          {!loading && error && <ErrorBox msg={error} onRetry={() => load(cat, 1)} />}
          {!loading && !error && list.length === 0 && <StateNote icon="bag" title="暂无该类目商品" />}
          {!loading && !error && list.length > 0 && (
            <div className="two-col">
              {list.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
          {!loading && !error && list.length > 0 && end && (
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', padding: '12px 0' }}>没有更多了</div>
          )}
          {!loading && !error && list.length > 0 && !end && (
            <button onClick={() => load(cat, page + 1, true)} style={{ width: '100%', textAlign: 'center', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, padding: 12 }}>加载更多</button>
          )}
        </div>
      </div>
    </div>
  );
}
