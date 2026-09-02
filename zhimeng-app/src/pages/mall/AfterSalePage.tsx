import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { orders } from '../../data/mock';
import type { Order } from '../../data/types';

const TYPES: { id: string; label: string; desc: string; icon: IconName }[] = [
  { id: 'return', label: '退货', desc: '退回商品并退款', icon: 'refresh' },
  { id: 'exchange', label: '换货', desc: '更换尺码或款式', icon: 'retweet' },
  { id: 'refund', label: '退款', desc: '仅退款不退货', icon: 'wallet' },
];

const REASONS = ['面料瑕疵', '尺寸偏差', '工艺缺陷', '七天无理由（仅非定制）'];

export default function AfterSalePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [local] = useLocalState<Order[]>('zm_orders', []);
  const [patches] = useLocalState<Record<string, Partial<Order>>>('zm_order_patches', {});

  const order = useMemo(() => {
    const o = [...local, ...orders].find((x) => String(x.id) === id);
    if (!o) return undefined;
    const p = patches[String(o.id)];
    return p ? { ...o, ...p } : o;
  }, [id, local, patches]);

  const [type, setType] = useState('return');
  const [reasons, setReasons] = useState<string[]>([]);
  const [desc, setDesc] = useState('');

  const submit = () => {
    if (reasons.length === 0) { toast('请选择售后原因'); return; }
    toast('售后申请已提交，平台将24小时内处理', 'check');
    navigate(-1);
  };

  if (!order) {
    return (
      <div className="page no-tab">
        <NavBar back title="申请售后" />
        <EmptyState icon="package" title="订单不存在" desc="该订单可能已被删除" action={<button className="btn btn-primary" onClick={() => navigate('/orders')}>返回订单列表</button>} />
      </div>
    );
  }

  return (
    <div className="page no-tab">
      <NavBar back title="申请售后" />
      <div className="page-body">
        {/* 定制提示 */}
        {order.isCustom && (
          <div className="row" style={{ gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12.5, marginBottom: 14 }}>
            <Icon name="lock" size={15} style={{ marginTop: 1 }} />
            <span>定制商品按需生产，仅支持质量问题售后，不支持七天无理由退货</span>
          </div>
        )}

        {/* 服务类型 */}
        <div style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 10px' }}>服务类型</div>
        <div className="row" style={{ gap: 10 }}>
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 14, textAlign: 'center',
                border: type === t.id ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
                background: type === t.id ? 'var(--brand-soft)' : '#fff',
                transition: 'all .18s ease',
              }}
            >
              <Icon name={t.icon} size={22} color={type === t.id ? 'var(--brand)' : 'var(--text-3)'} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: type === t.id ? 'var(--brand)' : 'var(--text)' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* 原因 */}
        <div style={{ fontSize: 14, fontWeight: 700, margin: '18px 0 10px' }}>售后原因 <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 400 }}>可多选</span></div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => {
            const disabled = order.isCustom && r.startsWith('七天无理由');
            const active = reasons.includes(r);
            return (
              <button
                key={r}
                onClick={() => {
                  if (disabled) { toast('定制商品不支持七天无理由退货'); return; }
                  setReasons((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
                }}
                style={{
                  padding: '8px 14px', borderRadius: 99, fontSize: 13,
                  background: active ? 'var(--brand-soft)' : '#fff',
                  color: active ? 'var(--brand)' : 'var(--text-2)',
                  border: active ? '1.5px solid var(--brand)' : '1.5px solid var(--line)',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* 补充说明 */}
        <div style={{ fontSize: 14, fontWeight: 700, margin: '18px 0 10px' }}>补充说明</div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={200}
          placeholder="请描述具体情况，如尺码偏差多少、瑕疵位置等，方便我们更快处理～"
          style={{ width: '100%', minHeight: 96, borderRadius: 12, border: '1px solid var(--line)', padding: 10, fontSize: 13.5, resize: 'none', outline: 'none', background: '#fff' }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{desc.length}/200</div>

        {/* 图片上传 */}
        <div style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 10px' }}>上传凭证 <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 400 }}>选填</span></div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => toast('图片上传功能开发中')}
            style={{ width: 72, height: 72, borderRadius: 12, border: '1.5px dashed var(--line)', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', gap: 3 }}
          >
            <Icon name="plus" size={22} />
            <span style={{ fontSize: 11 }}>上传图片</span>
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>最多 3 张，支持 jpg/png</span>
        </div>

        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 26 }} onClick={submit}>提交申请</button>
      </div>
    </div>
  );
}
