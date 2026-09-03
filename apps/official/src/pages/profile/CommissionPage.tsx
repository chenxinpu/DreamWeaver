/* ============ 织梦 · 佣金明细 ============ */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { Tag } from '../../components/ui';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { dashboard } from '../../data/mock';
import { TapStyle } from './_shared';

const ROWS = [
  { no: 'ZM2026090110001', name: '法式碎花泡泡袖连衣裙', rate: '10%', amount: 32.8, time: '09-01' },
  { no: 'ZM2026083000142', name: '微醺玫瑰 · 吊带连衣裙', rate: '8%', amount: 23.9, time: '08-31' },
  { no: 'ZM2026082900217', name: '梨涡浅笑 · 蕾丝拼接连衣裙', rate: '12%', amount: 34.7, time: '08-30' },
  { no: 'ZM2026082800365', name: '法式碎花泡泡袖连衣裙', rate: '10%', amount: 32.8, time: '08-29' },
  { no: 'ZM2026082700421', name: '微醺玫瑰 · 吊带连衣裙', rate: '8%', amount: 23.9, time: '08-28' },
];

const RULES = [
  '前 1000 名入驻创作者专享阶梯佣金',
  '退货率 < 10% 为佣金资格门槛，超标取消当月资格',
  '佣金阶梯：月销量 ≥100 单 8% / ≥300 单 10% / ≥600 单 12%',
  '订单确认收货后佣金进入待结算，T+7 自动结算',
  '可提现金额满 100 元即可申请提现（银行卡 / 支付宝）',
];

export default function CommissionPage() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'bank' | 'alipay'>('bank');

  const { withdrawable, pending, total } = dashboard.commission;

  const submit = () => {
    const v = parseFloat(amount);
    if (isNaN(v) || v < 100) { toast('提现金额至少 100 元'); return; }
    if (v > withdrawable) { toast('超出可提现余额'); return; }
    toast('提现申请已提交，T+7到账', 'check');
    setOpen(false);
    setAmount('');
  };

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="佣金明细" />
      <div className="page-body">
        {/* 三卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="card" style={{ padding: '14px 10px', textAlign: 'center', background: 'linear-gradient(160deg,#FDF6E7,#FFF)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>可提现</div>
            <div className="price" style={{ fontSize: 17, marginTop: 4 }}>¥{withdrawable.toLocaleString('zh-CN')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>实时余额</div>
          </div>
          <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>待结算</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>¥{pending.toLocaleString('zh-CN')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>T+7 到账</div>
          </div>
          <div className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>累计佣金</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>¥{total.toLocaleString('zh-CN')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>历史累计</div>
          </div>
        </div>

        {/* 申请提现 */}
        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={withdrawable < 100} onClick={() => setOpen(true)}>
          <Icon name="wallet" size={17} /> 申请提现
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          可提现余额 {withdrawable >= 100 ? `¥${withdrawable.toLocaleString('zh-CN')}` : '不足 100 元'}
        </div>

        {/* 本月佣金明细 */}
        <div className="card" style={{ marginTop: 16, padding: '6px 16px 12px' }}>
          <div className="row" style={{ padding: '10px 0', gap: 8 }}>
            <Icon name="chart" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>本月佣金明细</span>
            <span className="flex-1" />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {ROWS.length} 笔</span>
          </div>
          {ROWS.map((r, i) => (
            <div key={r.no} className="row" style={{ padding: '11px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none', gap: 8 }}>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.no} · {r.time}</div>
              </div>
              <Tag variant="primary">{r.rate}</Tag>
              <span className="price" style={{ fontSize: 14 }}>¥{r.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* 历史提现记录 */}
        <div className="card" style={{ marginTop: 12, padding: '6px 16px 12px' }}>
          <div className="row" style={{ padding: '10px 0', gap: 8 }}>
            <Icon name="clock" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>历史提现记录</span>
          </div>
          {dashboard.withdrawHistory.map((h, i) => (
            <div key={h.time + h.amount} className="row" style={{ padding: '11px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
              <Icon name="wallet" size={15} color="var(--text-3)" />
              <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 8 }}>{h.time}</span>
              <span className="flex-1" />
              <span style={{ fontSize: 13.5, fontWeight: 600, marginRight: 10 }}>¥{h.amount.toLocaleString('zh-CN')}</span>
              <Tag variant="success" icon="check">{h.status}</Tag>
            </div>
          ))}
        </div>

        {/* 规则说明 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <Icon name="shield" size={16} color="#C9A23F" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>佣金规则</span>
          </div>
          {RULES.map((r) => (
            <div key={r} className="row" style={{ gap: 8, marginTop: 8, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, alignItems: 'flex-start' }}>
              <Icon name="check-circle" size={14} color="var(--success)" style={{ marginTop: 2 }} />
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 提现 Sheet */}
      <Sheet open={open} onClose={() => setOpen(false)} title="申请提现">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>提现金额</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>可提现 ¥{withdrawable.toLocaleString('zh-CN')}</span>
        </div>
        <div className="row" style={{ gap: 8, background: 'var(--bg-deep)', borderRadius: 12, padding: '0 14px', height: 50 }}>
          <span className="price" style={{ fontSize: 20 }}>¥</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="输入提现金额（≥100）"
            style={{ flex: 1, height: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 17, fontWeight: 600 }}
          />
          <button className="tap" style={{ fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 600 }} onClick={() => setAmount(String(withdrawable))}>全部</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>提现方式</div>
          <Segmented
            options={[{ value: 'bank', label: '银行卡' }, { value: 'alipay', label: '支付宝' }]}
            value={method}
            onChange={setMethod}
            equal
          />
        </div>
        <div className="row" style={{ gap: 6, marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
          <Icon name="clock" size={13} /> 提交后预计 T+7 个工作日到账，节假日顺延
        </div>
        <button className="btn btn-primary btn-block" style={{ margin: '18px 0 14px' }} onClick={submit}>提交申请</button>
      </Sheet>
    </div>
  );
}
