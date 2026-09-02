import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Price, EmptyState, Tag } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import { useLocalState, useCart } from '../../utils/store';
import { orders, workById } from '../../data/mock';
import type { Order } from '../../data/types';

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

/* ---------- 状态时间轴 8 节点 ---------- */
const NODES: { label: string; icon: IconName }[] = [
  { label: '待支付', icon: 'wallet' },
  { label: '待生产', icon: 'clock' },
  { label: '生产中', icon: 'scissors' },
  { label: '质检中', icon: 'shield' },
  { label: '待发货', icon: 'package' },
  { label: '已发货', icon: 'truck' },
  { label: '已收货', icon: 'check-circle' },
  { label: '已完成', icon: 'star' },
];

/* 各节点时间（mock：按下单时间推算） */
function nodeTimes(order: Order): string[] {
  const base = new Date(order.createdAt.replace(' ', 'T'));
  if (Number.isNaN(base.getTime())) return NODES.map(() => '—');
  const off = [0, 2, 26, 50, 74, 98, 122, 146];
  const p2 = (n: number) => String(n).padStart(2, '0');
  return off.map((h) => {
    const d = new Date(base.getTime() + h * 3600 * 1000);
    return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  });
}

/* 生产环节 */
const STAGES = ['设计稿确认', '面料采购', '裁剪', '缝制', '整烫', '质检'];

function Thumb({ src, size = 48 }: { src: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return <div style={{ width: size, height: size * 1.2, borderRadius: 8, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bag" size={18} color="var(--text-3)" /></div>;
  }
  return <img src={src} alt="" style={{ width: size, height: size * 1.2, borderRadius: 8, objectFit: 'cover' }} onError={() => setErr(true)} />;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { all, patchOrder, setLocal } = useOrders();
  const { add } = useCart();

  const order = useMemo(() => all.find((o) => String(o.id) === id), [all, id]);

  const [qcImg, setQcImg] = useState<string | null>(null);
  const logiRef = useRef<HTMLDivElement>(null);

  /* 进度条动画 */
  const pct = order?.progress?.percent ?? 0;
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    setBarW(0);
    const t = window.setTimeout(() => setBarW(pct), 80);
    return () => window.clearTimeout(t);
  }, [pct, id]);

  const copy = (text: string, msg: string) => {
    try { navigator.clipboard?.writeText(text); } catch { /* ignore */ }
    toast(msg);
  };

  if (!order) {
    return (
      <div className="page no-tab">
        <NavBar back title="订单详情" />
        <EmptyState icon="package" title="订单不存在" desc="该订单可能已被删除" action={<button className="btn btn-primary" onClick={() => navigate('/orders')}>返回订单列表</button>} />
      </div>
    );
  }

  const times = nodeTimes(order);
  const stageIdx = Math.max(0, STAGES.findIndex((s) => (order.progress?.stage || '').includes(s)));
  const hasBottomBar = order.status !== 1 && order.status !== 3 && order.status !== 4;

  return (
    <div className="page no-tab" style={{ paddingBottom: hasBottomBar ? 110 : 24 }}>
      <NavBar
        back
        title="订单详情"
        right={<button onClick={() => toast('更多功能开发中')} style={{ padding: 6 }}><Icon name="more" size={20} /></button>}
      />
      <div className="page-body">
        {/* 状态时间轴 */}
        <div className="card" style={{ padding: '16px 16px 4px', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>订单状态</div>
          <div style={{ marginTop: 10 }}>
            {NODES.map((n, i) => {
              const done = i < order.status;
              const cur = i === order.status;
              return (
                <div key={n.label} className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="col" style={{ alignItems: 'center', width: 44, flexShrink: 0 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? 'var(--success)' : cur ? 'var(--brand-grad)' : '#F1EDE9',
                      color: '#fff', boxShadow: cur ? '0 0 0 4px var(--brand-soft)' : 'none', transition: 'all .3s ease',
                    }}>
                      {done ? <Icon name="check" size={14} strokeWidth={3} /> : <Icon name={n.icon} size={13} color={cur ? '#fff' : 'var(--text-3)'} />}
                    </div>
                    {i < NODES.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 22, background: i < order.status ? 'var(--success)' : 'var(--line)' }} />}
                  </div>
                  <div style={{ flex: 1, padding: '0 0 18px' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: cur ? 700 : 600, color: cur ? 'var(--brand)' : done ? 'var(--text)' : 'var(--text-3)' }}>{n.label}</span>
                      {cur && <Tag variant="primary">当前</Tag>}
                      {done && <Icon name="check-circle" size={15} color="var(--success)" />}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{i <= order.status ? times[i] : '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 生产进度 */}
        {(order.status === 1 || order.status === 2 || order.status === 3) && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>生产进度</div>
              <Tag variant="primary" icon="scissors">{order.progress?.stage || '生产中'}</Tag>
            </div>
            <div className="row" style={{ gap: 14, margin: '14px 0 12px' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
              <div className="flex-1">
                <div style={{ height: 10, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: 'var(--brand-grad)', width: `${barW}%`, transition: 'width 1s cubic-bezier(.22,1,.36,1)' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{order.progress?.eta || '—'} · C2M 柔性产线按单生产</div>
              </div>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {STAGES.map((s, i) => (
                <span key={s} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {i < STAGES.length - 1 && (
                    <span style={{
                      position: 'absolute', top: 7, left: 'calc(50% + 8px)', right: 'calc(-50% + 8px)', height: 2,
                      background: i < stageIdx ? 'var(--brand)' : 'var(--line)', borderRadius: 1,
                    }} />
                  )}
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%', position: 'relative', zIndex: 1,
                    background: i < stageIdx ? 'var(--brand-soft)' : i === stageIdx ? 'var(--brand-grad)' : '#F1EDE9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: i === stageIdx ? '0 0 0 3px var(--brand-soft)' : 'none',
                  }}>
                    {i < stageIdx && <Icon name="check" size={9} color="var(--brand)" strokeWidth={3.5} />}
                  </span>
                  <span style={{
                    fontSize: 10, whiteSpace: 'nowrap', color: i === stageIdx ? 'var(--brand)' : i < stageIdx ? 'var(--text-2)' : 'var(--text-3)',
                    fontWeight: i === stageIdx ? 700 : 400,
                  }}>{s}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 质检报告 */}
        {order.status >= 3 && order.qc && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>质检报告</div>
              {order.qc.pass ? <Tag variant="success" icon="check-circle">质检通过</Tag> : <Tag variant="danger">未通过</Tag>}
            </div>
            <div style={{ marginTop: 6 }}>
              {([
                ['面料检测', order.qc.fabric],
                ['工艺检测', order.qc.craft],
                ['尺寸偏差', order.qc.sizeDeviation],
              ] as const).map(([label, text]) => (
                <div key={label} className="row" style={{ gap: 8, padding: '7px 0' }}>
                  <Icon name="check-circle" size={17} color="var(--success)" />
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1 }}><span style={{ fontWeight: 600 }}>{label}：</span>{text}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              {order.qc.images.map((s, i) => (
                <button key={i} onClick={() => setQcImg(s)} style={{ borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={s} alt="" style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>点击查看大图</span>
            </div>
          </div>
        )}

        {/* 物流信息 */}
        {order.status >= 5 && order.logistics && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }} ref={logiRef}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>物流信息</div>
              <Tag variant="gray" icon="truck">{order.logistics.company}</Tag>
            </div>
            <div className="row" style={{ gap: 8, margin: '10px 0 4px', background: 'var(--bg-deep)', borderRadius: 10, padding: '9px 12px' }}>
              <span style={{ fontSize: 13, flex: 1 }}>运单号 <span style={{ fontWeight: 700 }}>{order.logistics.trackingNo}</span></span>
              <button onClick={() => copy(order.logistics!.trackingNo, '运单号已复制')} className="row" style={{ gap: 3, fontSize: 12, color: 'var(--brand)' }}>
                <Icon name="link" size={13} />复制
              </button>
            </div>
            <div style={{ marginTop: 6 }}>
              {order.logistics.traces.map((t, i) => (
                <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div className="col" style={{ alignItems: 'center', width: 10, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--brand)' : 'var(--line)', marginTop: 5 }} />
                    {i < order.logistics!.traces.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: 'var(--line)' }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400 }}>{t.text}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 订单信息 */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>订单信息</div>
          <div style={{ marginTop: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>订单号</span>
              <button className="row" style={{ gap: 5, fontSize: 12.5 }} onClick={() => copy(order.orderNo, '订单号已复制')}>
                <span className="ellipsis" style={{ maxWidth: 170 }}>{order.orderNo}</span>
                <Icon name="link" size={13} color="var(--brand)" />
              </button>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>下单时间</span>
              <span style={{ fontSize: 12.5 }}>{order.createdAt}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>收货信息</span>
              <span style={{ fontSize: 12.5, textAlign: 'right', maxWidth: 240 }}>
                {order.address.name} {order.address.phone}<br />{order.address.region} {order.address.detail}
              </span>
            </div>
          </div>
          <div className="divider" style={{ margin: '8px 0' }} />
          {order.items.map((it) => (
            <div key={it.workId} className="row" style={{ gap: 10, padding: '7px 0' }}>
              <Thumb src={it.cover} size={44} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{it.color} · {it.size} · ×{it.qty}</div>
              </div>
              <Price value={it.price} size={13.5} />
            </div>
          ))}
        </div>

        {/* 售后保障 */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>售后保障</div>
          {order.isCustom ? (
            <div className="row" style={{ gap: 6, marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12.5 }}>
              <Icon name="lock" size={14} style={{ marginTop: 1 }} />
              定制商品不支持无理由退货，仅质量问题可申请售后
            </div>
          ) : (
            <div className="row" style={{ gap: 6, marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--success-soft)', color: 'var(--success)', fontSize: 12.5 }}>
              <Icon name="shield" size={14} style={{ marginTop: 1 }} />
              支持七天无理由退货（不影响二次销售）
            </div>
          )}
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/orders/${order.id}/aftersale`)}>申请售后</button>
        </div>
      </div>

      {/* 质检图片大图 */}
      <Sheet open={!!qcImg} onClose={() => setQcImg(null)} title="质检图片">
        {qcImg && <img src={qcImg} alt="" style={{ width: '100%', borderRadius: 12 }} />}
      </Sheet>

      {/* 底部操作栏 */}
      {hasBottomBar && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, zIndex: 90,
          background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--line)',
          padding: '10px 16px calc(var(--safe-bottom) + 10px)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {order.status === 0 && (
            <>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>应付 <Price value={order.amount} size={20} /></span>
              <div className="flex-1" />
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setLocal((prev) => prev.filter((l) => l.id !== order.id));
                  toast('订单已取消');
                  navigate('/orders');
                }}
              >取消订单</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  patchOrder(order.id, { status: 2, progress: { stage: '裁剪中', percent: 12, eta: '预计 5 天后完成' } });
                  toast('支付成功，订单进入生产');
                  navigate('/orders');
                }}
              >立即支付</button>
            </>
          )}
          {order.status === 2 && (
            <>
              <div className="flex-1" />
              <button className="btn btn-sm btn-primary" onClick={() => toast('已通知工厂，将加快生产进度')}>催一催</button>
            </>
          )}
          {order.status === 5 && (
            <>
              <div className="flex-1" />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  if (order.logistics && logiRef.current) logiRef.current.scrollIntoView({ behavior: 'smooth' });
                  else toast('暂无物流信息');
                }}
              >查看物流</button>
            </>
          )}
          {order.status === 6 && (
            <>
              <div className="flex-1" />
              <button className="btn btn-sm btn-outline" onClick={() => toast('感谢你的评价～')}>评价</button>
              <button className="btn btn-sm btn-primary" onClick={() => { patchOrder(order.id, { status: 7 }); toast('已确认收货，订单完成'); }}>确认收货</button>
            </>
          )}
          {order.status === 7 && (
            <>
              <div className="flex-1" />
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  const it = order.items[0];
                  const w = workById(it.workId);
                  if (w) { add({ workId: w.id, qty: 1, color: it.color, size: it.size }); toast('已加入购物车'); }
                }}
              >再次购买</button>
              <button className="btn btn-sm btn-primary" onClick={() => navigate(`/orders/${order.id}/aftersale`)}>申请售后</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
