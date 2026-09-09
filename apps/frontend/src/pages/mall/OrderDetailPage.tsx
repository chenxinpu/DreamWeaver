/* ============================================================================
 * /mall/orders/:id 订单详情 —— 时间轴 / 生产阶段 / 质检 / 物流 / 操作
 * 操作：去支付 · dev-advance(演示推进) · 确认收货 · 取消(direct 未发货) · 退货/换货(定制)
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Sheet, useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../api/types';
import { Loading, ErrorBox, fmtMoney, hideBadImg, imgSafe, relTime } from '../../components/shared/utils';

const ORDER_TEXT: Record<OrderStatus, string> = {
  created: '待支付', paid: '待生产', producing: '生产中', qc: '质检中',
  shipping: '已发货', received: '已收货', completed: '已完成', cancelled: '已取消',
};

export default function MallOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [o, setO] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [paySheet, setPaySheet] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const od = await api.orders.get(id || '0');
      setO(od);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<Order>, key: string, okText: string) => {
    setBusy(key);
    try {
      const updated = await fn();
      setO(updated);
      toast(okText, 'check');
    } catch (e) {
      toast((e as Error).message || '操作失败');
    } finally { setBusy(''); }
  };

  if (loading) return <div className="page no-tab"><OrderNav id={id} /><Loading text="加载订单…" /></div>;
  if (error || !o) {
    return (
      <div className="page no-tab page-bleed">
        <OrderNav id={id} />
        <div className="state-box"><ErrorBox msg={error || '订单不存在'} onRetry={load} /></div>
      </div>
    );
  }

  const { timeline = [], stage, qcReport, logistics, returnReq, amounts, specUsed } = o;
  const inProd = ['paid', 'producing', 'qc'].includes(o.status);
  const canCancel = o.status === 'created';
  const canConfirm = o.status === 'shipping';
  const canReturn = o.kind === 'custom' && o.status === 'received' && (!returnReq || returnReq.state === 'none');

  return (
    <div className="mall-page no-tab page-bleed" style={{ minHeight: '100dvh', background: '#F4F5F7', paddingBottom: 'calc(var(--safe-bottom) + 110px)' }}>
      <OrderNav id={id} />
      {/* 顶部状态卡 */}
      <div style={{ margin: '2px 12px 10px', borderRadius: 16, overflow: 'hidden', color: '#fff', background: 'linear-gradient(120deg,#F27BA0,#E85C87 60%,#C93E6B)', padding: '15px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, opacity: .9 }}>{o.kind === 'custom' ? '私人定制订单' : '现货直购订单'}</span>
          <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 99, padding: '2px 10px', fontSize: 11.5, fontWeight: 700 }}>{ORDER_TEXT[o.status]}</span>
        </div>
        <div style={{ fontSize: 23, fontWeight: 800, marginTop: 10 }}>¥{fmtMoney(amounts?.total ?? 0)}</div>
        <div style={{ fontSize: 11, opacity: .9, marginTop: 4 }}>{o.no} · {relTime(o.createdAt)} 下单</div>
      </div>

      {/* 商品卡 */}
      <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="img-ph" style={{ width: 66, height: 78, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src={imgSafe(o.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.4 }}>{o.productTitle}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
              {o.kind === 'custom' ? '定制规格（按体型调整）' : `直购尺码：${specUsed?.size || 'M'}`}
            </div>
            {o.kind === 'custom' && amounts && (
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>原价 ¥{amounts.price} + 基础费用 ¥{amounts.baseFee}</div>
            )}
          </div>
        </div>
      </div>

      {/* 生产阶段（进度条） */}
      {stage && (
        <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: '12px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="row" style={{ gap: 5, fontSize: 13.5, fontWeight: 800 }}><Icon name="history" size={15} color="var(--brand)" />生产进度 · {stage.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{stage.eta}</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, stage.percent || 0)}%`, height: '100%', background: 'var(--brand-grad)', borderRadius: 99, transition: 'width .5s ease' }} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 6 }}>当前完成 {stage.percent || 0}%</div>
        </div>
      )}

      {/* 状态时间轴 */}
      {timeline?.length > 0 && (
        <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: '14px 16px' }}>
          <div className="row" style={{ gap: 5, fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}><Icon name="flag" size={14} color="var(--brand)" />订单动态</div>
          {timeline.map((t, i) => {
            const last = i === timeline.length - 1;
            return (
              <div key={i} style={{ display: 'flex', gap: 11, position: 'relative', paddingBottom: i === timeline.length - 1 ? 0 : 16 }}>
                {i < timeline.length - 1 && <span style={{ position: 'absolute', left: 6, top: 16, bottom: 0, width: 2, background: last ? 'transparent' : 'var(--bg-deep)' }} />}
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: last ? 'var(--brand-grad)' : '#E5DED8', flexShrink: 0, marginTop: 2, boxShadow: last ? '0 0 0 4px var(--brand-soft)' : 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: last ? 800 : 600 }}>{t.text}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{t.t}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 质检报告 */}
      {qcReport && (
        <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: '12px 14px' }}>
          <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>
            <Icon name="shield" size={15} color={qcReport.pass ? 'var(--success)' : 'var(--danger)'} />
            质检报告 {qcReport.pass ? '· 通过' : '· 未通过'}
          </div>
          {(qcReport.items || []).map((it) => (
            <div key={it.k} className="kv-row"><span className="kv-key">{it.k}</span><span className="kv-val">{it.v}</span></div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 6 }}>质检时间：{qcReport.at}</div>
        </div>
      )}

      {/* 物流 */}
      {logistics && (
        <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: '12px 14px' }}>
          <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>
            <Icon name="truck" size={15} color="var(--info)" />物流信息
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginBottom: 6 }}>{logistics.company} · {logistics.trackingNo}</div>
          {(logistics.traces || []).slice(0, 6).map((tr, i) => (
            <div key={i} className="row" style={{ gap: 7, fontSize: 11.5, color: 'var(--text-2)', padding: '4px 0' }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: i === 0 ? 'var(--success)' : '#D8D2CE', flexShrink: 0 }} />
              <span style={{ color: i === 0 ? 'var(--success)' : undefined, fontWeight: i === 0 ? 700 : 400 }}>{tr.text}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>{tr.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* 售后信息（定制） */}
      {returnReq && returnReq.state !== 'none' && (
        <div className="card" style={{ margin: '0 12px 10px', borderRadius: 14, padding: '12px 14px', border: '1px solid #F3DFB6', background: '#FFFDF6' }}>
          <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, color: '#8A6420', marginBottom: 6 }}>
            <Icon name="wallet" size={15} />售后记录
          </div>
          <div style={{ fontSize: 12, color: '#7A5B10', lineHeight: 1.9 }}>
            {returnReq.state === 'returning' && `退货处理中：退款 ¥${returnReq.refundAmount}（基础费用 ¥${returnReq.baseFeeKept} 不退）`}
            {returnReq.state === 'done' && `已退货：退款 ¥${returnReq.refundAmount} 已原路退回；成衣将进入二手集市${returnReq.resaleListingId ? `（挂单 #${returnReq.resaleListingId}）` : ''}`}
            {returnReq.state === 'exchanged' && `已换货重做：原单关闭${returnReq.newOrderId ? `，新定制单 #${returnReq.newOrderId} 需再付基础费用 ¥${returnReq.baseFeeKept}` : ''}`}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mall-actionbar" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {canCancel && (
          <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => setCancelOpen(true)}>取消订单</button>
        )}
        {canConfirm && (
          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act(() => api.orders.confirmReceived(o.id), 'confirm', '已确认收货')}>确认收货</button>
        )}
        {inProd && (
          <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => act(() => api.orders.devAdvance(o.id), 'adv', '演示：已推进到下一生产节点')}>
            <Icon name="refresh" size={13} />演示推进（dev-advance）
          </button>
        )}
        {canReturn && (
          <>
            <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => navigate(`/mall/orders/${o.id}/return`)}>申请退货</button>
            <button className="btn btn-danger-soft btn-sm" disabled={!!busy} onClick={() => navigate(`/mall/orders/${o.id}/exchange`)}>换货重做</button>
          </>
        )}
        {o.status === 'created' && (
          <button className="btn btn-primary btn-sm" onClick={() => setPaySheet(true)}>去支付 ¥{fmtMoney(amounts?.total ?? 0)}</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/mall/orders')}>返回列表</button>
      </div>

      {/* 支付确认（演示） */}
      <Sheet open={paySheet} onClose={() => setPaySheet(false)} title="订单支付">
        <div style={{ textAlign: 'center', padding: '14px 0 20px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>订单金额</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand-deep)', marginTop: 6 }}>¥{fmtMoney(amounts?.total ?? 0)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>演示环境：模拟支付，余额充足直接成功</div>
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} disabled={busy === 'pay'} onClick={() => act(() => api.orders.pay(o.id), 'pay', '支付成功')}>
            确认支付
          </button>
        </div>
      </Sheet>

      {/* 取消确认 */}
      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="取消订单">
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.9, padding: '6px 0' }}>
          取消后金额将全额原路退回；{o.kind === 'custom' ? '定制订单仅支付前可取消。' : '该订单为现货直购，未发货可全额退。'}
        </div>
        <button className="btn btn-danger btn-block" style={{ margin: '12px 0 18px' }} disabled={!!busy} onClick={async () => {
          setCancelOpen(false);
          await act(() => api.orders.cancel(o.id), 'cancel', '订单已取消，款项已退回');
        }}>
          确认取消
        </button>
      </Sheet>
    </div>
  );
}

function OrderNav({ id }: { id?: string }) {
  const navigate = useNavigate();
  return (
    <div className="mall-topbar" style={{ position: 'static' }}>
      <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
      <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>订单详情 #{id}</span>
      <span style={{ width: 28 }} />
    </div>
  );
}
