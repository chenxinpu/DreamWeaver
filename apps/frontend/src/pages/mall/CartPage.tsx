/* ============================================================================
 * /mall/cart 购物车（本地会话，localStorage：zm_cart_v2）
 * ==========================================================================*/
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { useCart } from '../../utils/v2';
import { fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';
import { StateNote } from './parts';

export default function MallCartPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const cart = useCart();

  const goCheckout = () => {
    if (!cart.checkedItems.length) { toast('请先勾选要结算的商品'); return; }
    navigate('/mall/checkout');
  };

  return (
    <div className="mall-page" style={{ paddingBottom: 'calc(var(--tab-h) + var(--safe-bottom) + 30px)', background: '#F4F5F7', minHeight: '100dvh' }}>
      <div className="mall-topbar" style={{ position: 'static' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center', color: '#1F2329' }}>购物车（{cart.count}）</span>
        <span style={{ width: 28 }} />
      </div>

      {cart.items.length === 0 ? (
        <StateNote
          icon="cart"
          title="购物车还是空的"
          desc="去挑选喜欢的商品，支持直接购买与私人定制"
          action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/mall/home')}>去逛逛</button>}
        />
      ) : (
        <>
          <div style={{ padding: '10px 12px 0' }}>
            {cart.items.map((it) => (
              <div key={it.key} className="card" style={{ display: 'flex', gap: 10, padding: 10, marginBottom: 10, borderRadius: 14, position: 'relative' }}>
                {/* 勾选 */}
                <button onClick={() => cart.toggle(it.key)} style={{ alignSelf: 'center', color: it.checked ? 'var(--brand)' : '#C9C2CC', padding: 4 }} aria-label="选择">
                  <Icon name={it.checked ? 'check-circle' : 'check-circle'} size={22} color={it.checked ? undefined : '#D8D2CE'} style={!it.checked ? { opacity: .35 } : undefined} />
                </button>
                <div className="img-ph" style={{ width: 78, height: 92, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }} onClick={() => navigate(`/mall/product/${it.productId}`)}>
                  <img src={imgSafe(it.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} />
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="ellipsis-2" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }} onClick={() => navigate(`/mall/product/${it.productId}`)}>{it.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                    {it.isCustom ? '私人定制' : '现货直购'}{it.size ? ` · ${it.size}` : ''}
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ color: '#FF2E4D', fontWeight: 800, fontSize: 16 }}>¥{fmtMoney(it.price)}</span>
                    <div className="row" style={{ gap: 4 }}>
                      <button onClick={() => cart.patch(it.key, { qty: Math.max(1, it.qty - 1) })} style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--bg-deep)', color: 'var(--text-2)' }}><Icon name="minus" size={13} /></button>
                      <span style={{ width: 26, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{it.qty}</span>
                      <button onClick={() => cart.patch(it.key, { qty: it.qty + 1 })} style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}><Icon name="plus" size={13} /></button>
                    </div>
                  </div>
                </div>
                <button onClick={() => { cart.remove(it.key); toast('已移除'); }} style={{ position: 'absolute', right: 6, top: 6, color: 'var(--text-3)', padding: 4 }} aria-label="删除">
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
          {/* 结算条（tab 之上） */}
          <div style={{ position: 'fixed', bottom: 'calc(var(--tab-h) + var(--safe-bottom))', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 80, background: '#fff', borderTop: '1px solid var(--mall-line)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>已选 {cart.checkedItems.length} 件</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                合计 <span style={{ color: '#FF2E4D', fontSize: 18 }}>¥{fmtMoney(cart.total)}</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ height: 44, padding: '0 34px' }} onClick={goCheckout}>去结算</button>
          </div>
        </>
      )}
    </div>
  );
}
