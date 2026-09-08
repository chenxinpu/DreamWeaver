/* ============================================================================
 * /mall/search 商城搜索
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api } from '../../api/client';
import type { Product } from '../../api/types';
import { Loading, ErrorBox } from '../../components/shared/utils';
import { ProductCard, StateNote } from './parts';

const HOT = ['连衣裙', '衬衫', '半裙', '外套', '私人定制', '真丝'];

export default function MallSearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kw, setKw] = React.useState(params.get('q') || '');
  const [searched, setSearched] = React.useState(params.get('q') || '');
  const [list, setList] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const doSearch = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setSearched(q);
    setLoading(true);
    setError('');
    try {
      const res = await api.products.list({ kw: q, page: 1, pageSize: 40 });
      setList(res?.list || []);
    } catch (e) {
      setError((e as Error).message);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const q = params.get('q');
    if (q) doSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="mall-page no-tab page-bleed">
      <div className="mall-topbar">
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={21} /></button>
        <div className="row flex-1" style={{ height: 36, background: '#fff', borderRadius: 99, padding: '0 13px', gap: 6, boxShadow: '0 1px 3px rgba(20,20,30,.04)' }}>
          <Icon name="search" size={15} color="#9AA0A6" />
          <input
            autoFocus
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(kw); }}
            placeholder="搜索商城商品"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5 }}
          />
          {kw && <button onClick={() => { setKw(''); setSearched(''); setList([]); }} style={{ padding: 2 }}><Icon name="close" size={15} color="#9AA0A6" /></button>}
        </div>
        <button onClick={() => doSearch(kw)} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 14, padding: 4 }}>搜索</button>
      </div>

      {!searched && !loading && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 10 }}>热门搜索</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOT.map((h) => (
              <button key={h} onClick={() => { setKw(h); doSearch(h); }} className="cat-pill">{h}</button>
            ))}
          </div>
        </div>
      )}

      {searched && (
        <div style={{ padding: '4px 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 2px' }}>
            “{searched}” 找到 {list.length} 件商品
          </div>
          {loading && <Loading text="搜索中…" />}
          {!loading && error && <ErrorBox msg={error} onRetry={() => doSearch(searched)} />}
          {!loading && !error && list.length === 0 && <StateNote icon="search" title="没有找到相关商品" desc="换个关键词试试吧" />}
          {!loading && !error && list.length > 0 && (
            <div className="two-col" style={{ paddingBottom: 20 }}>
              {list.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
