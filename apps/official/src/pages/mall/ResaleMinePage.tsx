/* ============================================================================
 * /mall/resale/mine 我的转售 —— 改价(≤原挂单价) / 取消上架 / 已售记录 + 入账
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Sheet, useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { ResaleListing } from '../../api/types';
import { Loading, ErrorBox, fmtMoney, hideBadImg, imgSafe, relTime } from '../../components/shared/utils';
import { StateNote } from './parts';

export default function ResaleMinePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = React.useState<ResaleListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [priceItem, setPriceItem] = React.useState<ResaleListing | null>(null);
  const [price, setPrice] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.resale.mine();
      setList(res?.list || []);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const savePrice = async () => {
    if (!priceItem) return;
    const v = Number(price);
    if (!v || v <= 0) { toast('请输入有效标价'); return; }
    if (v > priceItem.listPrice) { toast('标价只能降低，不能高于当前价'); return; }
    setBusy(true);
    try {
      const updated = await api.resale.setPrice(priceItem.id, v);
      setList((ls) => ls.map((x) => (x.id === updated.id ? { ...x, listPrice: v } : x)));
      setPriceItem(null);
      toast('改价成功', 'check');
    } catch (e) {
      toast((e as Error).message || '改价失败');
    } finally { setBusy(false); }
  };

  const cancel = async (r: ResaleListing) => {
    setBusy(true);
    try {
      await api.resale.cancel(r.id);
      setList((ls) => ls.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x)));
      toast('已下架', undefined);
    } catch (e) {
      toast((e as Error).message || '取消失败');
    } finally { setBusy(false); }
  };

  const actives = list.filter((l) => l.status === 'active');
  const sold = list.filter((l) => l.status === 'sold');

  return (
    <div className="mall-page no-tab page-bleed" style={{ minHeight: '100dvh', background: '#F4F5F7' }}>
      <div className="mall-topbar" style={{ position: 'static' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>我的转售</span>
        <button onClick={() => navigate('/mall/resale')} style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 700 }}>去逛逛</button>
      </div>

      {loading && <Loading text="加载中…" />}
      {!loading && error && <div className="state-box"><ErrorBox msg={error} onRetry={load} /></div>}
      {!loading && !error && list.length === 0 && (
        <StateNote icon="cart" title="还没有转售挂单" desc="定制订单退货后会自动生成二手挂单（原价×75%），在这里管理" />
      )}

      {!loading && !error && list.length > 0 && (
        <div style={{ padding: '10px 12px' }}>
          {actives.map((r) => (
            <div key={r.id} className="card" style={{ borderRadius: 14, padding: 11, marginBottom: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <div className="img-ph" style={{ width: 70, height: 84, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={imgSafe(r.photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="ellipsis-2" style={{ fontSize: 13, fontWeight: 800 }}>{r.originalTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.sizeLabel} · 挂单 {relTime(r.createdAt)}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(r.listPrice)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>净得约 ¥{fmtMoney(r.listPrice * (1 - (r.platformFeeRate || 0.08)))}</span>
                  </div>
                </div>
                <span className="st-badge st-ok">在售</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 9 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} disabled={busy} onClick={() => { setPriceItem(r); setPrice(String(r.listPrice)); }}>降价</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={busy} onClick={() => cancel(r)}>下架</button>
              </div>
            </div>
          ))}

          {sold.length > 0 && (
            <>
              <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, padding: '8px 2px' }}>
                <Icon name="wallet" size={15} color="var(--success)" />已售记录 / 入账
              </div>
              {sold.map((r) => (
                <div key={r.id} className="card" style={{ borderRadius: 14, padding: '11px 13px', marginBottom: 8 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="img-ph" style={{ width: 44, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={imgSafe(r.photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{r.originalTitle}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{r.soldAt ? `成交于 ${relTime(r.soldAt)}` : ''}</div>
                      <div style={{ fontSize: 11, marginTop: 2, color: 'var(--success)', fontWeight: 700 }}>
                        净得入账 ¥{fmtMoney(r.netToSeller ?? 0)}（佣金 ¥{fmtMoney(r.feeCharged ?? 0)}）
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {list.filter((l) => l.status === 'cancelled').length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', padding: '4px 2px' }}>
              已下架 {list.filter((l) => l.status === 'cancelled').length} 单（不再展示）
            </div>
          )}
        </div>
      )}

      {/* 降价弹层 */}
      <Sheet open={!!priceItem} onClose={() => setPriceItem(null)} title="调整标价（只降不升）">
        {priceItem && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
              当前标价：<b>¥{fmtMoney(priceItem.listPrice)}</b> · 原价划线：¥{fmtMoney(priceItem.originalPrice ?? Math.round((priceItem.listPrice / 0.75) * 100) / 100)}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#FF2E4D' }}>¥</span>
              <input
                type="number"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px', fontSize: 16, outline: 'none' }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>降价可吸引买家；成交净得会随标价同步变化。</div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={savePrice} disabled={busy}>
              {busy ? '保存中…' : '确认降价'}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
