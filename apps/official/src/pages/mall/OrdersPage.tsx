/* ============================================================================
 * /mall/orders 我的订单（状态筛选：全部 / 待收货 / 生产中 / 售后）
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../api/types';
import { Loading, ErrorBox, fmtMoney, hideBadImg, imgSafe, relTime } from '../../components/shared/utils';
import { StateNote } from './parts';

const ORDER_TEXT: Record<OrderStatus, string> = {
  created: '待支付', paid: '待生产', producing: '生产中', qc: '质检中',
  shipping: '已发货', received: '已收货', completed: '已完成', cancelled: '已取消',
};

function filterGroup(status: OrderStatus, group: string): boolean {
  if (group === '全部') return true;
  if (group === '生产中') return ['paid', 'producing', 'qc', 'created'].includes(status);
  if (group === '已发货') return status === 'shipping';
  if (group === '售后') return ['received', 'completed', 'cancelled'].includes(status);
  return true;
}

const GROUPS = ['全部', '生产中', '已发货', '售后'];

export default function MallOrdersPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qf = params.get('filter');
  const [group, setGroup] = React.useState(qf === 'producing' ? '生产中' : qf === 'shipping' ? '已发货' : qf === 'aftersale' ? '售后' : '全部');
  const [list, setList] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.orders.mine({ page: 1, pageSize: 50 });
      setList(res?.list || []);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const show = list.filter((o) => filterGroup(o.status, group));

  return (
    <div className="mall-page no-tab" style={{ minHeight: '100dvh', background: '#F4F5F7', paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
      <div className="mall-topbar" style={{ position: 'static' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 4, color: '#1F2329' }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 16.5, fontWeight: 800, flex: 1, textAlign: 'center' }}>我的订单</span>
        <span style={{ width: 28 }} />
      </div>

      <div className="mall-order-filter">
        {GROUPS.map((g) => (
          <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>

      {loading && <Loading text="加载订单…" />}
      {!loading && error && (
        <div className="state-box"><ErrorBox msg={error} onRetry={load}>订单数据来自后端 /api/orders/mine</ErrorBox></div>
      )}
      {!loading && !error && list.length === 0 && (
        <StateNote icon="package" title="还没有订单" desc="下单后这里会显示生产、发货与售后进度" action={<button className="btn btn-outline btn-sm" onClick={() => navigate('/mall/home')}>去逛逛</button>} />
      )}
      {!loading && !error && show.length === 0 && list.length > 0 && (
        <StateNote icon="package" title={`「${group}」暂无订单`} desc="切换其他筛选看看" />
      )}
      {!loading && !error && (
        <div style={{ padding: '2px 12px' }}>
          {show.map((o) => (
            <button key={o.id} className="card tap-row" style={{ width: '100%', textAlign: 'left', borderRadius: 14, padding: '11px 13px', marginBottom: 10 }} onClick={() => navigate(`/mall/orders/${o.id}`)}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 9 }}>
                <span className="row" style={{ gap: 5, fontSize: 11.5, color: 'var(--text-3)' }}>
                  <Icon name="receipt" size={13} />{o.no}
                  {o.kind === 'custom' && <span className="st-badge st-brand" style={{ marginLeft: 4 }}>私人定制</span>}
                </span>
                <span className="st-badge st-hot" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}>{ORDER_TEXT[o.status] || o.status}</span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div className="img-ph" style={{ width: 62, height: 74, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={imgSafe(o.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="ellipsis-2" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>{o.productTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{relTime(o.createdAt)}{o.specUsed?.size ? ` · ${o.specUsed.size}` : ''}</div>
                  {o.stage && <div className="row" style={{ gap: 6, marginTop: 7 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--brand-deep)', fontWeight: 700, flexShrink: 0 }}>{o.stage.name}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                      <div style={{ width: `${o.stage.percent || 0}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)' }} />
                    </div>
                  </div>}
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#FF2E4D' }}>¥{fmtMoney(o.amounts?.total ?? 0)}</div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--text-3)" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
