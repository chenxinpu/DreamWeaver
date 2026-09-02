import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Price, EmptyState, Tag } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import { useCart, useBody, recommendSize, useLocalState } from '../../utils/store';
import { workById } from '../../data/mock';
import type { CartItem, Order, Work } from '../../data/types';

/* 内置收货地址 */
const ADDRESSES = [
  { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 西湖区', detail: '文三路 100 号 织梦公寓 2 幢 502' },
  { name: '陈小姐', phone: '138****5621', region: '浙江省 杭州市 余杭区', detail: '文一西路 969 号 梦想小镇 3 幢 801' },
];

/* 优惠券 */
const COUPONS = [
  { id: 0, label: '不使用优惠券', need: 0, off: 0 },
  { id: 1, label: '新人专享 · 满300减30', need: 300, off: 30 },
  { id: 2, label: '设计师节 · 满500减80', need: 500, off: 80 },
];

const PAYS: { id: string; label: string; icon: IconName }[] = [
  { id: 'wechat', label: '微信支付', icon: 'wallet' },
  { id: 'alipay', label: '支付宝', icon: 'shield' },
  { id: 'card', label: '银行卡', icon: 'store' },
];

/* 圆形勾选 */
function Check({ on, onToggle, label, size = 20 }: { on: boolean; onToggle: () => void; label?: string; size?: number }) {
  return (
    <button onClick={onToggle} className="row" style={{ gap: 8, alignItems: 'center' }}>
      <span style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: on ? 'none' : '2px solid var(--line)',
        background: on ? 'var(--brand-grad)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {on && <Icon name="check" size={size - 8} color="#fff" strokeWidth={3} />}
      </span>
      {label && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>}
    </button>
  );
}

function Thumb({ src }: { src: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return <div style={{ width: 56, height: 70, borderRadius: 10, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bag" size={20} color="var(--text-3)" /></div>;
  }
  return <img src={src} alt="" style={{ width: 56, height: 70, borderRadius: 10, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

const p2 = (n: number) => String(n).padStart(2, '0');

export default function CheckoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { items, remove } = useCart();
  const [body] = useBody();
  const size = recommendSize(body);

  const selected = useMemo(
    () => items.filter((i) => i.checked).map((i) => ({ i, w: workById(i.workId)! })).filter((x): x is { i: CartItem; w: Work } => Boolean(x.w)),
    [items],
  );

  const [addrIdx, setAddrIdx] = useState(0);
  const [addrSheet, setAddrSheet] = useState(false);
  const [couponId, setCouponId] = useState(0);
  const [couponSheet, setCouponSheet] = useState(false);
  const [pay, setPay] = useState('wechat');
  const [agree, setAgree] = useState(false);

  const hasCustom = selected.some((x) => x.w.isCustom);
  const goods = selected.reduce((s, x) => s + x.w.price * x.i.qty, 0);
  const coupon = goods >= COUPONS[couponId].need ? COUPONS[couponId] : COUPONS[0];
  const payable = Math.max(0, goods - coupon.off);

  const [localOrders, setLocalOrders] = useLocalState<Order[]>('zm_orders', []);

  const submit = () => {
    if (selected.length === 0) return;
    if (hasCustom && !agree) { toast('请先阅读并同意定制条款'); return; }
    const now = new Date();
    const days = Math.max(...selected.map((x) => x.w.productionDays));
    const eta = new Date(now.getTime() + days * 864e5);
    const id = Math.max(4000, ...localOrders.map((o) => o.id)) + 1;
    const order: Order = {
      id,
      orderNo: `ZM${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}${String(Math.floor(Math.random() * 9000) + 1000)}`,
      status: 2,
      amount: payable,
      createdAt: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
      items: selected.map((x) => ({
        workId: x.w.id, title: x.w.title, cover: x.w.cover,
        color: x.i.color, size: x.i.size, qty: x.i.qty, price: x.w.price,
      })),
      address: ADDRESSES[addrIdx],
      progress: { stage: '裁剪中', percent: 12, eta: `预计 ${p2(eta.getMonth() + 1)}-${p2(eta.getDate())} 完成` },
      isCustom: hasCustom,
    };
    setLocalOrders((prev) => [order, ...prev]);
    selected.forEach((x) => remove(x.w.id));
    toast('支付成功', 'check');
    navigate('/orders');
  };

  if (selected.length === 0) {
    return (
      <div className="page no-tab">
        <NavBar back title="确认订单" />
        <EmptyState
          icon="bag"
          title="没有待结算的商品"
          desc="请先在购物车勾选商品，再来下单吧"
          action={<button className="btn btn-primary" onClick={() => navigate('/mall')}>返回商城</button>}
        />
      </div>
    );
  }

  return (
    <div className="page no-tab" style={{ paddingBottom: 110 }}>
      <NavBar back title="确认订单" />
      <div className="page-body">
        {/* 收货地址 */}
        <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="location" size={20} color="var(--brand)" />
          </div>
          <div className="flex-1">
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{ADDRESSES[addrIdx].name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{ADDRESSES[addrIdx].phone}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{ADDRESSES[addrIdx].region} {ADDRESSES[addrIdx].detail}</div>
          </div>
          <button onClick={() => setAddrSheet(true)} className="row" style={{ fontSize: 13, color: 'var(--brand)', gap: 2, flexShrink: 0 }}>
            更换<Icon name="chevron-right" size={14} />
          </button>
        </div>

        {/* 商品清单 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>商品清单 <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>共 {selected.reduce((s, x) => s + x.i.qty, 0)} 件</span></div>
          {selected.map(({ i, w }) => (
            <div key={i.workId} className="row" style={{ gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <Thumb src={w.cover} />
              <div className="flex-1">
                <div className="ellipsis-2" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{w.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{i.color} · {i.size} · ×{i.qty}</div>
                <div style={{ marginTop: 4 }}><Price value={w.price} size={14} /></div>
              </div>
            </div>
          ))}
        </div>

        {/* 体型确认 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>体型确认</div>
            <button onClick={() => navigate('/profile/body')} className="row" style={{ fontSize: 12.5, color: 'var(--text-3)', gap: 2 }}>
              修改<Icon name="edit" size={13} />
            </button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <Tag variant="primary" icon="ruler">智能推荐尺码 {size}</Tag>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8 }}>
            身高 {body.height}cm · 体重 {body.weight}kg · 胸围 {body.bust} · 腰围 {body.waist} · 臀围 {body.hip}
          </div>
          {hasCustom && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'var(--danger-soft)' }}>
              <div className="row" style={{ gap: 6, color: 'var(--danger)', fontSize: 12.5, fontWeight: 600 }}>
                <Icon name="lock" size={14} />
                定制商品按需生产，一经打版不支持无理由退货
              </div>
              <div style={{ marginTop: 10 }}>
                <Check on={agree} onToggle={() => setAgree((a) => !a)} label="我已阅读并同意定制条款" />
              </div>
            </div>
          )}
        </div>

        {/* 优惠券 */}
        <div className="card" style={{ padding: '0 14px', marginBottom: 12 }}>
          <button onClick={() => setCouponSheet(true)} className="row" style={{ width: '100%', padding: '13px 0', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14 }}>优惠券</span>
            <span className="row" style={{ gap: 6 }}>
              {coupon.off > 0 ? <span style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>-¥{coupon.off}</span> : <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>请选择</span>}
              <Icon name="chevron-right" size={15} color="var(--text-3)" />
            </span>
          </button>
        </div>

        {/* 支付方式 */}
        <div className="card" style={{ padding: '0 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, padding: '13px 0 4px' }}>支付方式</div>
          {PAYS.map((p) => (
            <button key={p.id} onClick={() => setPay(p.id)} className="row" style={{ width: '100%', padding: '12px 0', gap: 10, borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={p.icon} size={18} color={pay === p.id ? 'var(--brand)' : 'var(--text-2)'} />
              </span>
              <span className="flex-1" style={{ fontSize: 14, textAlign: 'left' }}>{p.label}</span>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', border: pay === p.id ? '6px solid var(--brand)' : '2px solid var(--line)',
                background: '#fff', boxSizing: 'border-box', flexShrink: 0,
              }} />
            </button>
          ))}
        </div>

        {/* 金额明细 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', padding: '3px 0' }}>
            <span>商品金额</span><span>¥{goods}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', padding: '3px 0' }}>
            <span>优惠券</span><span style={{ color: 'var(--danger)' }}>-¥{coupon.off}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', padding: '3px 0' }}>
            <span>运费</span><span style={{ color: 'var(--success)' }}>免运费</span>
          </div>
        </div>
      </div>

      {/* 提交栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 90,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--line)',
        padding: '12px 16px calc(var(--safe-bottom) + 12px)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>应付总额</div>
          <Price value={payable} size={20} />
        </div>
        <button className="btn btn-primary btn-lg" style={{ flex: 1, height: 48 }} onClick={submit}>提交订单</button>
      </div>

      {/* 地址选择 Sheet */}
      <Sheet open={addrSheet} onClose={() => setAddrSheet(false)} title="选择收货地址">
        {ADDRESSES.map((a, i) => (
          <button
            key={i}
            onClick={() => { setAddrIdx(i); setAddrSheet(false); toast('已更换收货地址'); }}
            className="row"
            style={{ width: '100%', gap: 10, padding: '13px 0', borderBottom: '1px solid var(--line)', textAlign: 'left' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: addrIdx === i ? 'var(--brand-soft)' : 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="location" size={17} color={addrIdx === i ? 'var(--brand)' : 'var(--text-3)'} />
            </div>
            <div className="flex-1">
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{a.phone}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{a.region} {a.detail}</div>
            </div>
            {addrIdx === i && <Icon name="check-circle" size={20} color="var(--brand)" />}
          </button>
        ))}
      </Sheet>

      {/* 优惠券 Sheet */}
      <Sheet open={couponSheet} onClose={() => setCouponSheet(false)} title="选择优惠券">
        {COUPONS.map((c) => {
          const disabled = c.need > 0 && goods < c.need;
          return (
            <button
              key={c.id}
              onClick={() => {
                if (disabled) { toast('未满足使用门槛'); return; }
                setCouponId(c.id);
                setCouponSheet(false);
                if (c.off > 0) toast(`已使用「${c.label}」`);
              }}
              className="row"
              style={{ width: '100%', gap: 10, padding: '13px 0', borderBottom: '1px solid var(--line)', opacity: disabled ? 0.45 : 1, textAlign: 'left' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gold-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="gift" size={20} color="var(--gold)" />
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{c.off > 0 ? `立减 ¥${c.off}` : '不享受优惠'}</div>
              </div>
              {disabled ? (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>未满足</span>
              ) : (
                <Icon name="check-circle" size={20} color={couponId === c.id ? 'var(--brand)' : 'var(--line)'} />
              )}
            </button>
          );
        })}
      </Sheet>
    </div>
  );
}
