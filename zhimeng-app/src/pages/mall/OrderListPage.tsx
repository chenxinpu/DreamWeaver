import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Price, EmptyState } from '../../components/ui';
import { Segmented, useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { orders } from '../../data/mock';
import { ORDER_STATUS_TEXT, type Order, type OrderStatus } from '../../data/types';

/* 合并本地订单与 mock 订单（本地在前），支持对任意订单打补丁（状态变更） */
function useOrders() {
  const [local, setLocal] = useLocalState<Order[]>('zm_orders', []);
  const [patches, setPatches] = useLocalState<Record<string, Partial<Order>>>('zm_order_patches', {});
  const all = useMemo(() => {
    const apply = (o: Order): Order => {
      const p = patches[String(o.id)];
      return p ? { ...o, ...p } : o;
    };
    return [...local, ...orders].map(apply);
  }, [local, patches]);
  const patchOrder = (id: number, patch: Partial<Order>) => {
    if (local.some((o) => o.id === id)) {
      setLocal((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    } else {
      setPatches((prev) => ({ ...prev, [String(id)]: { ...(prev[String(id)] || {}), ...patch } }));
    }
  };
  return { all, patchOrder, setLocal };
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  0: 'var(--danger)', 1: 'var(--info)', 2: 'var(--brand)', 3: 'var(--gold)',
  4: 'var(--info)', 5: 'var(--success)', 6: 'var(--success)', 7: 'var(--text-2)',
};

const TABS = [
  { value: 'all', label: '全部' },
  { value: '1', label: '待生产' },
  { value: '2', label: '生产中' },
  { value: '3', label: '质检中' },
  { value: '5', label: '已发货' },
  { value: '7', label: '已完成' },
];

function Thumb({ src }: { src: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return <div style={{ width: 52, height: 64, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bag" size={18} color="var(--text-3)" /></div>;
  }
  return <img src={src} alt="" style={{ width: 52, height: 64, borderRadius: 8, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

export default function OrderListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { all, patchOrder, setLocal } = useOrders();
  const [tab, setTab] = useState('all');

  const filtered = useMemo(
    () => (tab === 'all' ? all : all.filter((o) => String(o.status) === tab)),
    [all, tab],
  );

  const actions = (o: Order): ReactNode[] => {
    const btns: ReactNode[] = [];
    const push = (label: string, onClick: () => void, primary = false) =>
      btns.push(
        <button key={label} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-outline'}`}>
          {label}
        </button>,
      );
    switch (o.status) {
      case 0:
        push('去支付', () => {
          patchOrder(o.id, { status: 2, progress: { stage: '裁剪中', percent: 12, eta: '预计 5 天后完成' } });
          toast('支付成功，订单进入生产');
        }, true);
        push('取消订单', () => {
          setLocal((prev) => prev.filter((l) => l.id !== o.id));
          toast('订单已取消');
        });
        break;
      case 2:
        push('查看进度', () => navigate(`/orders/${o.id}`), true);
        break;
      case 5:
        push('查看物流', () => navigate(`/orders/${o.id}`), true);
        break;
      case 6:
        push('确认收货', () => { patchOrder(o.id, { status: 7 }); toast('已确认收货，订单完成'); }, true);
        push('评价', () => toast('感谢你的评价～'));
        break;
      case 7:
        push('申请售后', () => navigate(`/orders/${o.id}/aftersale`), true);
        break;
      default:
        break;
    }
    return btns;
  };

  return (
    <div className="page no-tab">
      <NavBar back title="我的订单" />
      <div style={{ padding: '4px 16px 8px', overflowX: 'auto' }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="page-body" style={{ paddingTop: 4 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="package" title="暂无相关订单" desc="去商城逛逛心仪的设计吧" action={<button className="btn btn-primary" onClick={() => navigate('/mall')}>去商城</button>} />
        ) : (
          filtered.map((o) => (
            <div key={o.id} className="card" onClick={() => navigate(`/orders/${o.id}`)} style={{ padding: 14, marginBottom: 12, cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>订单号 {o.orderNo}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[o.status] }}>{ORDER_STATUS_TEXT[o.status]}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                {o.items.slice(0, 3).map((it, i) => <Thumb key={i} src={it.cover} />)}
                {o.items.length > 3 && (
                  <div style={{ width: 52, height: 64, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-3)' }}>
                    +{o.items.length - 3}
                  </div>
                )}
                <div className="flex-1" style={{ marginLeft: 4, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{o.items[0]?.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>共 {o.items.length} 种商品{o.isCustom ? ' · 定制' : ''}</div>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                <span>{o.createdAt}</span>
                <span>|</span>
                <span>合计 <Price value={o.amount} size={14} /></span>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                {actions(o)}
              </div>
              {o.status !== 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.id}/aftersale`); }}
                  className="row"
                  style={{ gap: 3, fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}
                >
                  <Icon name="refresh" size={13} />申请售后
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
