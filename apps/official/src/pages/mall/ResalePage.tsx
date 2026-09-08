/* ============================================================================
 * /mall/resale 二手集市 —— active 挂单（原价划线 + 当前标价 + 净得提示）
 * 购买：确认扣费清单（平台佣金 / 卖家净得）→ POST /resale/:id/buy
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { ResaleListing } from '../../api/types';
import { Loading, ErrorBox, fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';
import { StateNote } from './parts';

export default function ResalePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasToken } = useMe();
  const [list, setList] = React.useState<ResaleListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [confirm, setConfirm] = React.useState<ResaleListing | null>(null);
  const [buying, setBuying] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.resale.list({ page: 1, pageSize: 40 });
      setList(res?.list || []);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const buy = async (r: ResaleListing) => {
    if (!user && !hasToken) { toast('请先登录后再购买'); navigate('/login'); return; }
    setBuying(true);
    try {
      await api.resale.buy(r.id);
      setConfirm(null);
      setList((ls) => ls.filter((x) => x.id !== r.id));
      toast('购买成功，已为你创建待支付流程并通知卖家', 'check');
    } catch (e) {
      toast((e as Error).message || '购买失败');
    } finally { setBuying(false); }
  };

  const showFee = (r: ResaleListing) => {
    const rate = r.platformFeeRate || 0.08;
    const fee = r.listPrice * rate;
    const net = r.listPrice - fee;
    return { rate, fee, net };
  };

  return (
    <div className="mall-page no-tab page-bleed" style={{ minHeight: '100dvh', background: '#F4F5F7' }}>
      <div className="mall-topbar" style={{ position: 'static' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>二手集市</span>
        <button onClick={() => navigate('/mall/resale/mine')} style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 700 }}>我的转售</button>
      </div>

      <div className="net-tip" style={{ margin: '10px 12px 0' }}>
        <span className="row" style={{ gap: 5, fontWeight: 800 }}><Icon name="cart" size={14} />什么是二手集市？</span>
        退货的定制成衣会按「原价×75%」自动挂在这里出售；卖家可自降标价吸引买家。成交后平台收取约 8% 仓储物流佣金，其余净得直接退还原买家。
      </div>

      {loading && <Loading text="加载二手好物…" />}
      {!loading && error && <div className="state-box"><ErrorBox msg={error} onRetry={load} /></div>}
      {!loading && !error && list.length === 0 && (
        <StateNote icon="bag" title="暂时没有在售的二手好物" desc="退货的定制成衣会自动上架到这里，先逛逛商城吧" action={<button className="btn btn-outline btn-sm" onClick={() => navigate('/mall/home')}>去商城</button>} />
      )}

      {!loading && !error && list.length > 0 && (
        <div style={{ padding: '10px 12px' }}>
          {list.map((r) => {
            const f = showFee(r);
            return (
              <div key={r.id} className="card" style={{ borderRadius: 14, padding: 11, marginBottom: 10 }}>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div className="img-ph" style={{ width: 92, height: 110, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <img src={imgSafe(r.photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
                    <span style={{ position: 'absolute', left: 5, top: 5, background: 'rgba(255,102,0,.9)', color: '#fff', fontSize: 9.5, borderRadius: 99, padding: '1px 6px' }}>二手优选</span>
                  </div>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="ellipsis-2" style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.4 }}>{r.originalTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{r.sizeLabel}</div>
                    <div className="row" style={{ alignItems: 'baseline', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(r.listPrice)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'line-through' }}>¥{fmtMoney(r.originalPrice ?? Math.round((r.listPrice / 0.75) * 100) / 100)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#B8860B', marginTop: 4, lineHeight: 1.6 }}>
                      卖家净得约 ¥{fmtMoney(f.net)}（已含约 {(f.rate * 100).toFixed(0)}% 平台仓储物流费）
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary btn-block" style={{ marginTop: 9, height: 38 }} onClick={() => setConfirm(r)}>立即购买</button>
              </div>
            );
          })}
        </div>
      )}

      {/* 购买确认 */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 640 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,12,.55)' }} onClick={() => { if (!buying) setConfirm(null); }} />
          <div className="fade-in" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 16px calc(var(--safe-bottom) + 14px)' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 12 }}>确认购买（二手）</div>
            <div className="row" style={{ gap: 10 }}>
              <div className="img-ph" style={{ width: 58, height: 70, borderRadius: 10, overflow: 'hidden' }}>
                <img src={imgSafe(confirm.photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{confirm.originalTitle}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{confirm.sizeLabel}</div>
              </div>
            </div>
            <div className="card" style={{ marginTop: 12, padding: '4px 13px', background: '#F8F9FA', borderRadius: 12 }}>
              {(() => { const f = showFee(confirm); return (
                <>
                  <div className="kv-row"><span className="kv-key">你需支付（标价）</span><span className="kv-val">¥{fmtMoney(confirm.listPrice)}</span></div>
                  <div className="kv-row"><span className="kv-key">平台仓储物流费（{(f.rate * 100).toFixed(0)}%）</span><span className="kv-val">-¥{fmtMoney(f.fee)}</span></div>
                  <div className="kv-row"><span className="kv-key">卖家净得</span><span className="kv-val">¥{fmtMoney(f.net)}</span></div>
                </>
              ); })()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.7 }}>
              二手成衣不支持无理由退货；质量问题请按详情页描述与卖家协商。
            </div>
            <div className="row" style={{ gap: 10, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)} disabled={buying}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1.3 }} onClick={() => buy(confirm)} disabled={buying}>
                {buying ? '处理中…' : `确认支付 ¥${fmtMoney(confirm.listPrice)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
