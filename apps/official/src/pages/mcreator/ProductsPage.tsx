/* ============================================================================
 * /c/products 创作者中心 · 商品管理（移动版）
 * 状态 tabs（全部/在售/已下架/未上架）；行卡：封面/标题/价格+基础费/状态徽章/浏览量/销量/
 * 佣金率（展开 api.creator.commissionRate，2%-10% 与 breaks）；上/下架；查看 → /mall/product/:id；
 * AI 详情 / 文案编辑提示使用桌面版商品管理（材料变更请走橱窗重新审核）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { CommissionRate, Product } from '../../api/types';
import { fmtCount, fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';
import { useAsync, ProductBadge, fmtDT, Loading } from './bits';
import { MEmpty, MCardHd } from './bits';

const TABS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'onSale', label: '在售' },
  { key: 'offShelf', label: '已下架' },
  { key: 'draft', label: '未上架' },
];

export default function MProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.products.myAll({ pageSize: 200 }), []);
  const products = data?.list || [];
  const counts = data?.counts || {};

  const [tab, setTab] = React.useState('all');
  const [rateOpen, setRateOpen] = React.useState<Record<number, boolean>>({});
  const [rates, setRates] = React.useState<Record<number, CommissionRate>>({});
  const [shelfing, setShelfing] = React.useState<number | null>(null);

  const loadRate = async (p: Product) => {
    if (rates[p.id]) return;
    try {
      const r = await api.creator.commissionRate(p.id);
      setRates((m) => ({ ...m, [p.id]: r }));
    } catch { /* ignore */ }
  };
  const toggleRate = (p: Product) => {
    const next = !rateOpen[p.id];
    setRateOpen((m) => ({ ...m, [p.id]: next }));
    if (next) loadRate(p);
  };

  const toggleShelf = async (p: Product) => {
    setShelfing(p.id);
    try {
      const on = p.status === 'onSale';
      await api.products.shelf(p.id, !on);
      toast(on ? '已下架（可重新上架）' : '已上架商城 🎉', 'check');
      reload();
    } catch (e) {
      toast((e as Error).message || '操作失败');
    } finally {
      setShelfing(null);
    }
  };

  const visible = products.filter((p) => tab === 'all' || p.status === tab);
  const countOf = (k: string) => (k === 'all' ? products.length : counts[k] ?? 0);

  return (
    <div>
      {/* 顶部说明 */}
      <div className="mc-card">
        <MCardHd icon="bag" title="商品管理" />
        <div className="mc-sub">
          橱窗材料审核通过后由 AI 自动生成商品详情并上架商城。手机端可上下架与查看佣金；
          <b>AI 详情 / 文案编辑</b>（intro/故事/章节/生产商）与<b>材料变更</b>（换图/版型/规格/价格）请用桌面版「商品管理 / 橱窗材料」。
        </div>
        <div className="mc-tabs" style={{ marginTop: 10 }}>
          {TABS.map((t) => (
            <button key={t.key} className={`mc-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="n">{countOf(t.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="mc-card" style={{ marginTop: 10 }}><Loading /></div>}
      {!loading && error && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="bag" title="商品加载失败" desc={error}
            action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重试</button>} />
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="bag" title={tab === 'all' ? '还没有商品' : '该状态下暂无商品'}
            desc={tab === 'all' ? '去「资源池」或「橱窗材料」提交材料，审核通过后 AI 会自动生成商品上架' : '可在橱窗页通过审核后再回来查看'}
            action={tab === 'all' ? <button className="c-btn c-btn-primary" onClick={() => navigate('/c/window')}><Icon name="store" size={14} />去提交橱窗材料</button> : undefined} />
        </div>
      )}

      {!loading && visible.map((p) => (
        <div className="mc-card" key={p.id} style={{ marginTop: 10, padding: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <img src={imgSafe(p.cover || p.images?.[0])} alt="" onError={hideBadImg} onClick={() => navigate(`/mall/product/${p.id}`)}
              style={{ width: 62, height: 80, objectFit: 'cover', borderRadius: 10, cursor: 'pointer', flexShrink: 0, background: '#F1F2F5' }} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }} className="ellipsis">#{p.id} {p.title}</b>
                <ProductBadge status={p.status} />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 5, flexWrap: 'wrap', fontSize: 12.5 }}>
                <span style={{ fontWeight: 800, color: '#E5484D', fontSize: 15 }}>¥{fmtMoney(p.price)}</span>
                {p.baseFee > 0 && <span className="c-pill">定制基础费 ¥{fmtMoney(p.baseFee)}</span>}
              </div>
              {(p.styleTags || []).slice(0, 4).map((t) => <span key={t} className="c-pill" style={{ margin: '5px 4px 0 0' }}>#{t}</span>)}
              <div className="row" style={{ gap: 12, marginTop: 6, fontSize: 11.5, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 3 }}><Icon name="eye" size={12} color="#8B919C" />浏览 {fmtCount(p.views)}</span>
                <span className="row" style={{ gap: 3 }}><Icon name="bag" size={12} color="#8B919C" />销量 {fmtCount(p.sales)}</span>
                <button className="row" style={{ gap: 3 }} onClick={() => toggleRate(p)}>
                  <Icon name="chart" size={12} color="var(--brand)" />
                  佣金率 {rates[p.id]?.rate ?? '…'}% <Icon name={rateOpen[p.id] ? 'chevron-down' : 'chevron-right'} size={12} color="#9AA0AA" />
                </button>
              </div>
              <div className="mc-tagline" style={{ marginTop: 4 }}>上架 {fmtDT(p.createdAt)} · {p.creator?.nickname || ''}</div>
            </div>
          </div>

          {/* 佣金率明细 */}
          {rateOpen[p.id] && (
            <div style={{ marginTop: 9, background: '#F7F8FA', borderRadius: 10, padding: '9px 11px', fontSize: 11.8 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                <b>佣金率 = {rates[p.id]?.rate ?? '—'}%（区间 2%-10%）</b>
                <span className="c-pill">基础 6%</span>
              </div>
              {(rates[p.id]?.breaks || []).map((b, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '2.5px 0' }}>
                  <span style={{ color: '#6B7180' }}>{b.name}</span>
                  <b style={{ color: b.delta >= 6 ? '#1F2329' : b.delta > 0 ? '#237A54' : '#B03A3F' }}>{b.delta > 0 ? `+${b.delta}` : b.delta}%</b>
                </div>
              ))}
              {(rates[p.id]?.reasons || []).map((r, i) => <div key={`r${i}`} style={{ color: '#8B919C', padding: '2px 0' }}>· {r}</div>)}
              {!rates[p.id] && <div className="c-hint">加载中…</div>}
            </div>
          )}

          <div className="row" style={{ gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
            <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate(`/mall/product/${p.id}`)}><Icon name="eye" size={13} />查看详情</button>
            <button className={`c-btn c-btn-sm ${p.status === 'onSale' ? 'c-btn-danger' : 'c-btn-success'}`} disabled={shelfing === p.id} onClick={() => toggleShelf(p)}>
              {p.status === 'onSale' ? <><Icon name="minus" size={13} />下架</> : <><Icon name="check" size={13} />上架</>}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
