/* ============================================================================
 * /mall/home 商城首页（独立网页·手机壳）
 * 顶栏(搜索+标题) / 金刚区(私人定制·二手集市·新品·Banner) / 分类横滑 / 商品瀑布
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Product } from '../../api/types';
import { Loading, ErrorBox } from '../../components/shared/utils';
import { ProductCard, StateNote } from './parts';
import { img, hideBadImg } from '../../components/shared/utils';

const CATS = ['全部', '连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'];

const KK: { icon: IconName; label: string; sub: string; to: string; bg: string; color: string }[] = [
  { icon: 'pen-tool', label: '私人定制', sub: '按体型调版', to: '/mall/category?cat=全部&custom=1', bg: 'linear-gradient(135deg,#F27BA0,#C93E6B)', color: '#fff' },
  { icon: 'cart', label: '二手集市', sub: '退货优选', to: '/mall/resale', bg: 'linear-gradient(135deg,#FFC26B,#F59E0B)', color: '#fff' },
  { icon: 'gift', label: '新品速递', sub: '每周上新', to: '/mall/category?cat=新品', bg: 'linear-gradient(135deg,#6FD1C1,#0EA5A4)', color: '#fff' },
  { icon: 'award', label: '甄选达人', sub: '官方精选', to: '/mall/search?q=小织', bg: 'linear-gradient(135deg,#B39DDB,#7C5CD6)', color: '#fff' },
];

export default function MallHomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [cat, setCat] = React.useState(params.get('cat') || '全部');
  const [list, setList] = React.useState<Product[]>([]);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async (c: string, p: number, append = false) => {
    setError('');
    if (p === 1 && !append) setLoading(true);
    try {
      const res = await api.products.list({ category: c === '全部' || c === '新品' ? undefined : c, page: p, pageSize: 10 });
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
  React.useEffect(() => { setCat(params.get('cat') || '全部'); }, [params]);

  const pickCat = (c: string) => { setCat(c); setList([]); };
  const loadMore = () => { if (!end && !loading) load(cat, page + 1, true); };

  return (
    <div className="mall-page">
      {/* 顶栏 */}
      <div className="mall-topbar">
        <span className="row" style={{ gap: 3, flexShrink: 0 }}>
          <span style={{ width: 24, height: 24, borderRadius: 9, background: 'linear-gradient(120deg,#F27BA0,#E85C87)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800 }}>织</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1F2329' }}>商城</span>
        </span>
        <button onClick={() => navigate('/mall/search')} className="row flex-1" style={{ height: 36, background: '#fff', borderRadius: 99, padding: '0 13px', gap: 6, color: '#9AA0A6', fontSize: 13, boxShadow: '0 1px 3px rgba(20,20,30,.04)' }}>
          <Icon name="search" size={15} />
          <span className="ellipsis">连衣裙 / 私人定制 / 二手好物</span>
        </button>
        <button onClick={() => navigate('/mall/mine')} style={{ color: '#1F2329', padding: 5, position: 'relative' }}>
          <Icon name="user" size={22} />
        </button>
      </div>

      {/* Banner */}
      <div style={{ padding: '2px 12px 0' }}>
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '2.6/1' }}>
          <img src={img('bg-02.jpg')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(232,92,135,.85) 0%, rgba(232,92,135,.35) 60%, rgba(0,0,0,0) 100%)' }} />
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#fff' }}>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>AI 商品详情 · 全链路透明</div>
            <div style={{ fontSize: 11.5, opacity: .92, marginTop: 4 }}>从设计文件 → 打版 → 3D 试穿 → 柔性智造</div>
            <button onClick={() => { setCat('全部'); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('已为你刷新推荐商品'); }} style={{ marginTop: 9, background: 'rgba(255,255,255,.92)', color: 'var(--brand-deep)', borderRadius: 99, padding: '6px 16px', fontSize: 12, fontWeight: 800 }}>
              去逛逛
            </button>
          </div>
        </div>
      </div>

      {/* 金刚区 */}
      <div style={{ padding: '12px 12px 2px' }}>
        <div className="mall-kingkong" style={{ padding: 0, background: 'none' }}>
          {KK.map((k) => (
            <button key={k.label} className="mall-kk" onClick={() => navigate(k.to)} style={{ gap: 5 }}>
              <span className="mall-kk-ico" style={{ background: k.bg, color: k.color, width: 50, height: 50 }}>
                <Icon name={k.icon} size={22} />
              </span>
              <span>{k.label}</span>
              <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: -3 }}>{k.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 分类横滑 */}
      <div className="cat-scroll" style={{ padding: '10px 12px 2px' }}>
        {CATS.map((c) => (
          <button key={c} className={`cat-pill ${cat === c ? 'on' : ''}`} onClick={() => pickCat(c)}>{c}</button>
        ))}
      </div>

      {/* 商品瀑布 */}
      {loading && <Loading text="加载商品中…" />}
      {!loading && error && (
        <div className="state-box">
          <ErrorBox msg={error} onRetry={() => load(cat, 1)} />
        </div>
      )}
      {!loading && !error && list.length === 0 && (
        <StateNote icon="bag" title="该分类下暂无商品" desc="创作者上传材料并通过审核后，商品会自动上架" />
      )}
      {!loading && !error && list.length > 0 && (
        <div className="two-col" style={{ padding: '6px 12px' }}>
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
      {!loading && !error && list.length > 0 && end && (
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', padding: '14px 0 4px' }}>— 已经到底啦 —</div>
      )}
      {!loading && !error && list.length > 0 && !end && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <button onClick={loadMore} style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, padding: 8 }}>加载更多</button>
        </div>
      )}
    </div>
  );
}
