/* ============================================================================
 * /mall/orders/:id/return | /exchange
 * 退货：退原价(price)，扣基础费用；成功后自动建二手挂单 → 跳 /mall/resale/mine
 * 换货重做：旧单 exchanged → 新建 custom 订单（再付一次 baseFee）待支付
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Order } from '../../api/types';
import { Loading, ErrorBox, fmtMoney, imgSafe, hideBadImg } from '../../components/shared/utils';

export default function ReturnExchangePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const mode = location.pathname.endsWith('/exchange') ? 'exchange' : 'return';

  const [o, setO] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ type: 'return' | 'exchange'; order?: Order; newOrder?: Order } | null>(null);

  React.useEffect(() => {
    api.orders.get(id || '0').then((od) => { setO(od); setLoading(false); }).catch((e) => { setError((e as Error).message); setLoading(false); });
  }, [id]);

  const submit = async () => {
    if (!reason.trim()) { toast('请填写售后原因'); return; }
    if (!agree) { toast('请先阅读并同意售后条款'); return; }
    if (!o) return;
    setBusy(true);
    try {
      if (mode === 'return') {
        await api.orders.returnOrder(o.id, reason);
        setDone({ type: 'return' });
        toast('退货成功，款项将原路退回，成衣自动进入二手集市', 'check');
      } else {
        const res = await api.orders.exchange(o.id, reason);
        setDone({ type: 'exchange', order: res.order, newOrder: res.newOrder });
        toast('换货重做单已生成，需再付一次基础费用', 'check');
      }
    } catch (e) {
      toast((e as Error).message || '操作失败');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="page no-tab"><FlowNav mode={mode} /><Loading text="加载订单…" /></div>;
  if (error || !o) {
    return (
      <div className="page no-tab page-bleed">
        <FlowNav mode={mode} />
        <div className="state-box"><ErrorBox msg={error || '订单不存在'} /></div>
      </div>
    );
  }

  const amounts = o.amounts || { price: 0, baseFee: 0, total: 0 };
  const isCustom = o.kind === 'custom';

  /* ---- 完成视图 ---- */
  if (done) {
    if (done.type === 'return') {
      return (
        <div className="mall-page no-tab" style={{ minHeight: '100dvh', padding: '80px 26px', textAlign: 'center' }}>
          <SuccessMark text="退货成功" sub={`退款 ¥${fmtMoney(amounts.price)} 原路退回（基础费用 ¥${fmtMoney(amounts.baseFee)} 不退）`} />
          <div style={{ background: 'linear-gradient(120deg,#FFF7EC,#FDEED6)', borderRadius: 14, padding: '12px', fontSize: 12, color: '#7A5B10', lineHeight: 1.9, marginTop: 20, textAlign: 'left' }}>
            <b>成衣已自动放入「二手集市」</b><br />
            · 默认标价 = 原价 × 75%（¥{fmtMoney(Math.round(amounts.price * 0.75 * 100) / 100)}），可在「我的转售」中降价或取消上架<br />
            · 成交后平台收取约 8% 仓储物流佣金，净得直接退回给你
          </div>
          <div className="row" style={{ gap: 10, marginTop: 26 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/mall/home')}>回商城</button>
            <button className="btn btn-primary" style={{ flex: 1.3 }} onClick={() => navigate('/mall/resale/mine')}>查看我的转售</button>
          </div>
        </div>
      );
    }
    const newOrder = done.newOrder;
    return (
      <div className="mall-page no-tab" style={{ minHeight: '100dvh', padding: '80px 26px', textAlign: 'center' }}>
        <SuccessMark text="换货重做单已生成" sub="原单已关闭；新定制单需再支付一次基础费用即可开工" />
        {newOrder && (
          <div className="card" style={{ textAlign: 'left', marginTop: 22, borderRadius: 16, padding: '12px 14px' }}>
            <div className="kv-row"><span className="kv-key">新订单号</span><span className="kv-val">{newOrder.no}</span></div>
            <div className="kv-row"><span className="kv-key">应付（基础费用）</span><span className="kv-val" style={{ color: '#FF2E4D', fontWeight: 800, fontSize: 15 }}>¥{fmtMoney(newOrder.amounts?.baseFee ?? newOrder.amounts?.total ?? 0)}</span></div>
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 26 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/mall/home')}>稍后再说</button>
          {newOrder && <button className="btn btn-primary" style={{ flex: 1.3 }} onClick={async () => {
            try { await api.orders.pay(newOrder.id); toast('新定制单支付成功', 'check'); navigate(`/mall/orders/${newOrder.id}`); }
            catch (e) { toast((e as Error).message || '支付失败'); }
          }}>立即支付并开工</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="mall-page no-tab page-bleed" style={{ minHeight: '100dvh', background: '#F4F5F7', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <FlowNav mode={mode} />

      {/* 商品摘要 */}
      <div className="card" style={{ margin: '10px 12px 0', borderRadius: 14, padding: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="img-ph" style={{ width: 60, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src={imgSafe(o.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>{o.productTitle}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{o.no}</div>
            <div style={{ fontSize: 11.5, marginTop: 3 }}>
              {isCustom ? '私人定制' : '现货直购'} · {ORDER_DOT(o)}
            </div>
          </div>
        </div>
      </div>

      {/* 条款卡 */}
      <div style={{ margin: '10px 12px 0', background: '#fff', borderRadius: 14, padding: '13px 14px' }}>
        <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>
          <Icon name={mode === 'return' ? 'wallet' : 'retweet'} size={16} color="var(--brand)" />
          {mode === 'return' ? '退货 · 仅退原价' : '换货重做 · 再收基础费用'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.9 }}>
          {mode === 'return' ? (
            <>
              本订单支付：商品原价 <b>¥{fmtMoney(amounts.price)}</b> + 基础费用 <b>¥{fmtMoney(amounts.baseFee)}</b><br />
              退货后仅退还 <b style={{ color: 'var(--success)' }}>¥{fmtMoney(amounts.price)}</b>（原价全额退）；<br />
              基础费用（加工 / 材料 / 人工）¥{fmtMoney(amounts.baseFee)} <b>不予退还</b>。
            </>
          ) : (
            <>
              原定制单已支付 ¥{fmtMoney(amounts.total)}（含原价与基础费用）；换货 = 按原体型与已确认方案重做，<br />
              需<b>再支付一次基础费用 ¥{fmtMoney(amounts.baseFee)}</b>（原价部分不再重复收取）。<br />
              若希望退款原价后再重新定制，可先走「退货」路径再购买。
            </>
          )}
        </div>
      </div>

      {/* 原因 */}
      <div style={{ margin: '10px 12px 0', background: '#fff', borderRadius: 14, padding: '13px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{mode === 'return' ? '退货原因' : '换货原因'} <span style={{ color: 'var(--brand)' }}>*</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(mode === 'return' ? ['尺寸不合身', '做工问题（有质检异议）', '款式与预期不符', '面料触感不喜欢', '其他'] : ['希望更换尺寸重新定制', '希望调整款式细节', '做工瑕疵，重做一件', '其他']).map((r) => (
            <button key={r} onClick={() => setReason(r)} style={{ padding: '7px 13px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, background: reason === r ? 'var(--brand-grad)' : 'var(--bg-deep)', color: reason === r ? '#fff' : 'var(--text-2)' }}>{r}</button>
          ))}
        </div>
        <textarea className="f-input" rows={3} style={{ marginTop: 10, resize: 'none' }} placeholder="补充说明（选填）" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <button className="row" style={{ gap: 6, padding: '14px 16px', fontSize: 12, color: 'var(--text-2)' }} onClick={() => setAgree((a) => !a)}>
        <Icon name={agree ? 'check-circle' : 'check-circle'} size={17} color={agree ? 'var(--brand)' : '#CBC5C0'} />
        我已阅读并同意上述退款 / 换货条款
      </button>

      <div style={{ padding: '0 12px' }}>
        <button className="btn btn-danger btn-block btn-lg" onClick={submit} disabled={busy}>
          {busy ? '处理中…' : mode === 'return' ? `确认退货（退 ¥${fmtMoney(amounts.price)}）` : `确认换货重做（再付 ¥${fmtMoney(amounts.baseFee)}）`}
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>退货处理完成后，系统会自动将该成衣放入二手集市</div>
      </div>
    </div>
  );
}

function SuccessMark({ text, sub }: { text: string; sub: string }) {
  return (
    <>
      <div style={{ width: 88, height: 88, margin: '0 auto 18px', borderRadius: '50%', background: 'linear-gradient(135deg,#4ADE80,#22B26A)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px rgba(34,178,106,.32)' }}>
        <Icon name="check" size={44} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800 }}>{text}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.8 }}>{sub}</div>
    </>
  );
}

function ORDER_DOT(o: Order) {
  return o.specUsed?.size ? `尺码 ${o.specUsed.size}` : '按体型定制';
}

function FlowNav({ mode }: { mode: 'return' | 'exchange' }) {
  const navigate = useNavigate();
  return (
    <div className="mall-topbar" style={{ position: 'static' }}>
      <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
      <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>{mode === 'return' ? '申请退货' : '换货重做'}</span>
      <span style={{ width: 28 }} />
    </div>
  );
}
