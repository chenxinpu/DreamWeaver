/* ============================================================================
 * /mall/checkout 结算 —— 支持购物车勾选批量(direct) 与 商品页「立即购买」直结
 * 支付为模拟：逐件 POST /api/orders（kind=direct）+ POST /pay
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import { useCart } from '../../utils/v2';
import type { CartItem } from '../../utils/v2';
import type { Order } from '../../api/types';
import { fmtMoney, hideBadImg, imgSafe, Loading } from '../../components/shared/utils';
import { StateNote } from './parts';
import { useLocalState } from '../../utils/store';
import { readLocalBody, recommendSize } from '../../utils/store';

interface DirectBuy { productId: number; title: string; cover: string; price: number; size?: string; at: number }

export default function MallCheckoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const directMode = params.get('direct') === '1';
  const { user, hasToken } = useMe();
  const cart = useCart();
  const [addr, setAddr] = useLocalState('zm_addr', { name: '', phone: '', region: '', detail: '' });
  const [agree, setAgree] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [done, setDone] = React.useState<Order[] | null>(null);
  const [errMsg, setErrMsg] = React.useState('');

  const direct: DirectBuy | null = React.useMemo(() => {
    if (!directMode) return null;
    try { return JSON.parse(localStorage.getItem('zm_direct_buy') || 'null') as DirectBuy | null; } catch { return null; }
  }, [directMode]);

  const items: (CartItem & { kind: 'direct' | 'custom' })[] = directMode
    ? (direct ? [{ productId: direct.productId, title: direct.title, cover: direct.cover, price: direct.price, baseFee: 0, size: direct.size || '均码', qty: 1, checked: true, isCustom: false, key: `d-${direct.productId}` } as CartItem & { kind: 'direct' }] : [])
    : cart.checkedItems.map((i) => ({ ...i, kind: 'direct' as const }));

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const pay = async () => {
    if (!user && !hasToken) { toast('请先登录'); navigate('/login'); return; }
    if (!items.length) { toast('没有待结算商品'); return; }
    if (!addr.name || !addr.phone || !addr.region) { toast('请先填写收货地址'); return; }
    if (!agree) { toast('请先阅读并同意购买协议'); return; }
    setPaying(true);
    setErrMsg('');
    const success: Order[] = [];
    try {
      for (const it of items) {
        for (let q = 0; q < it.qty; q++) {
          const created = await api.orders.create({ productId: it.productId, kind: 'direct', size: it.size || 'M' });
          const paid = await api.orders.pay(created.id);
          success.push(paid);
        }
      }
      if (directMode) { try { localStorage.removeItem('zm_direct_buy'); } catch { /* */ } }
      else cart.clear();
      setDone(success);
      toast(`支付成功，共 ${success.length} 个订单`, 'check');
    } catch (e) {
      setErrMsg((e as Error).message || '支付失败');
      toast('部分订单可能创建失败，请查看我的订单', undefined);
    } finally {
      setPaying(false);
    }
  };

  if (done) {
    return (
      <div className="mall-page no-tab" style={{ minHeight: '100dvh', textAlign: 'center', padding: '70px 24px' }}>
        <div style={{ width: 84, height: 84, margin: '0 auto 18px', borderRadius: '50%', background: 'linear-gradient(135deg,#4ADE80,#22B26A)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 26px rgba(34,178,106,.3)' }}>
          <Icon name="check" size={42} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>支付成功</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8 }}>
          已为你创建 {done.length} 个现货订单，工厂将按顺序排产
        </div>
        <div className="row" style={{ gap: 10, marginTop: 26 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/mall/home')}>继续逛逛</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(done.length === 1 ? `/mall/orders/${done[0].id}` : '/mall/orders')}>查看订单</button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mall-page no-tab" style={{ minHeight: '100dvh' }}>
        <CheckNav />
        <StateNote icon="cart" title="没有可结算的商品" desc="先挑选商品加入购物车，或从商品页立即购买" action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/mall/home')}>去逛逛</button>} />
      </div>
    );
  }

  const bodyHint = `下单后可使用体型推荐尺码：${recommendSize(user?.body || readLocalBody())}`;

  return (
    <div className="mall-page no-tab" style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--safe-bottom) + 100px)' }}>
      <div className="mall-topbar" style={{ position: 'static' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>确认订单</span>
        <span style={{ width: 28 }} />
      </div>

      {/* 地址占位 */}
      <div style={{ margin: '10px 12px 0', background: '#fff', borderRadius: 14, padding: '12px 13px' }}>
        <div className="row" style={{ gap: 6, marginBottom: 8 }}>
          <Icon name="location" size={16} color="var(--brand)" />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>收货地址</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="f-input" placeholder="收货人姓名" value={addr.name} onChange={(e) => setAddr((a) => ({ ...a, name: e.target.value }))} />
          <input className="f-input" placeholder="手机号" value={addr.phone} onChange={(e) => setAddr((a) => ({ ...a, phone: e.target.value }))} />
        </div>
        <input className="f-input" style={{ marginTop: 8 }} placeholder="省市区（如：浙江省 杭州市 西湖区）" value={addr.region} onChange={(e) => setAddr((a) => ({ ...a, region: e.target.value }))} />
        <input className="f-input" style={{ marginTop: 8 }} placeholder="详细地址（街道/小区/门牌号）" value={addr.detail} onChange={(e) => setAddr((a) => ({ ...a, detail: e.target.value }))} />
      </div>

      {/* 体型确认提示 */}
      <div style={{ margin: '10px 12px 0', background: 'linear-gradient(120deg,#F2F9FF,#E8F4FE)', borderRadius: 14, padding: '11px 13px', fontSize: 12, color: '#2E6EA6', lineHeight: 1.7 }}>
        <span className="row" style={{ gap: 6, fontWeight: 700 }}><Icon name="scan" size={15} />体型与尺码确认</span>
        {bodyHint}；如需按体型定制请在商品页选择「私人定制」。
      </div>

      {/* 商品清单 */}
      <div style={{ margin: '10px 12px 0', background: '#fff', borderRadius: 14, padding: '4px 13px' }}>
        {items.map((it) => (
          <div key={it.key} className="row" style={{ gap: 10, padding: '10px 0', borderBottom: '1px solid var(--mall-line)' }}>
            <div className="img-ph" style={{ width: 56, height: 66, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <img src={imgSafe(it.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{it.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>现货直购 · {it.size || '均码'} × {it.qty}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(it.price * it.qty)}</span>
          </div>
        ))}
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>应付总额</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(total)}</span>
        </div>
      </div>

      {/* 协议 */}
      <button className="row" style={{ gap: 6, padding: '14px 16px', fontSize: 12, color: 'var(--text-2)' }} onClick={() => setAgree((a) => !a)}>
        <Icon name={agree ? 'check-circle' : 'check-circle'} size={17} color={agree ? 'var(--brand)' : '#CBC5C0'} />
        我已阅读并同意《现货购买协议》《售后与退换政策》（现货不支持无理由退定制，质量问题按质检报告处理）
      </button>

      {errMsg && <div style={{ margin: '0 14px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 12, padding: '10px 12px', fontSize: 12 }}>{errMsg}</div>}

      {/* 底部支付条 */}
      <div className="mall-actionbar">
        <div style={{ flex: 1, fontSize: 12.5 }}>
          应付 <span style={{ fontSize: 19, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(total)}</span>
        </div>
        <button className="btn btn-primary btn-lg" style={{ flex: 1.2 }} onClick={pay} disabled={paying}>
          {paying ? <><Loading compact text="支付中" /></> : '提交订单并支付'}
        </button>
      </div>
    </div>
  );
}

function CheckNav() {
  const navigate = useNavigate();
  return (
    <div className="mall-topbar" style={{ position: 'static' }}>
      <button onClick={() => navigate(-1)} style={{ padding: 4 }}><Icon name="arrow-left" size={20} /></button>
      <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>确认订单</span>
      <span style={{ width: 28 }} />
    </div>
  );
}
