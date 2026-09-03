import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Price, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useCart } from '../../utils/store';
import { workById } from '../../data/mock';
import type { CartItem, Work } from '../../data/types';

/* 圆形勾选 */
function Check({ on, onToggle, size = 20 }: { on: boolean; onToggle: () => void; size?: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: on ? 'none' : '2px solid var(--line)',
        background: on ? 'var(--brand-grad)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: on ? '0 2px 6px rgba(232,92,135,.35)' : 'none',
      }}
      aria-label={on ? '取消选中' : '选中'}
    >
      {on && <Icon name="check" size={size - 8} color="#fff" strokeWidth={3} />}
    </button>
  );
}

/* 缩略图（onError 兜底） */
function Thumb({ src }: { src: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{ width: 74, height: 92, borderRadius: 10, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bag" size={22} color="var(--text-3)" />
      </div>
    );
  }
  return <img src={src} alt="" style={{ width: 74, height: 92, borderRadius: 10, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

export default function CartPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { items, update, remove } = useCart();
  const [manage, setManage] = useState(false);

  const joined = useMemo(
    () => items.map((i) => ({ i, w: workById(i.workId) })).filter((x): x is { i: CartItem; w: Work } => Boolean(x.w)),
    [items],
  );

  const allChecked = joined.length > 0 && joined.every((x) => x.i.checked);
  const selected = joined.filter((x) => x.i.checked);
  const total = selected.reduce((s, x) => s + x.w.price * x.i.qty, 0);

  const toggleAll = () => {
    joined.forEach((x) => update(x.i.workId, { checked: !allChecked }));
  };

  const goCheckout = () => {
    if (selected.length === 0) { toast('请选择商品'); return; }
    navigate('/checkout');
  };

  if (joined.length === 0) {
    return (
      <div className="page no-tab">
        <NavBar back title="购物车" />
        <EmptyState
          icon="bag"
          title="购物车空空如也"
          desc="快去挑选心仪的设计作品吧"
          action={<button className="btn btn-primary" onClick={() => navigate('/mall')}>去逛逛</button>}
        />
      </div>
    );
  }

  return (
    <div className="page no-tab" style={{ paddingBottom: 110 }}>
      <NavBar
        back
        title="购物车"
        right={
          <button onClick={() => setManage((m) => !m)} style={{ fontSize: 14, fontWeight: 600, color: manage ? 'var(--brand)' : 'var(--text-2)', padding: 6 }}>
            {manage ? '完成' : '管理'}
          </button>
        }
      />
      <div className="page-body">
        {joined.map(({ i, w }) => {
          const dec = () => {
            if (i.qty <= 1) { toast('最少1件'); return; }
            update(i.workId, { qty: i.qty - 1 });
          };
          return (
            <div key={i.workId} className="card" style={{ display: 'flex', gap: 10, padding: 12, marginBottom: 10, alignItems: 'center' }}>
              <Check on={!!i.checked} onToggle={() => update(i.workId, { checked: !i.checked })} />
              <div onClick={() => navigate(`/work/${i.workId}`)} style={{ flexShrink: 0 }}>
                <Thumb src={w.cover} />
              </div>
              <div className="flex-1">
                <div className="ellipsis-2" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{w.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{i.color} · {i.size}</div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <Price value={w.price} size={15} />
                  {manage ? (
                    <button
                      onClick={() => { remove(i.workId); toast('已删除'); }}
                      style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="trash" size={15} color="var(--danger)" />
                    </button>
                  ) : (
                    <div className="row" style={{ gap: 2 }}>
                      <button onClick={dec} style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="minus" size={14} />
                      </button>
                      <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{i.qty}</span>
                      <button onClick={() => update(i.workId, { qty: i.qty + 1 })} style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="plus" size={14} color="var(--brand)" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部结算栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 90,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--line)',
        padding: '10px 16px calc(var(--safe-bottom) + 10px)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div className="row" style={{ gap: 8 }}>
          <Check on={allChecked} onToggle={toggleAll} />
          <span style={{ fontSize: 13 }}>全选</span>
        </div>
        <div className="flex-1" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>合计：</span>
          <Price value={total} size={18} />
        </div>
        <button className="btn btn-primary" style={{ height: 40, padding: '0 26px' }} onClick={goCheckout}>
          去结算({selected.length})
        </button>
      </div>
    </div>
  );
}
