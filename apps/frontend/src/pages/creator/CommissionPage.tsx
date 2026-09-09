/* ============================================================================
 * /creator/commission 佣金 —— 规则逐条卡片（2%-10%）+ 可提现/待结算/已结算 +
 * 提现弹窗（校验 ≤ 可提现）+ 资金流水表 + 提现历史
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { CommissionRule, LedgerEvent } from '../../api/types';
import { fmtMoney } from '../../components/shared/utils';
import { useAsync, CState, Modal, Loading, fmtDT } from './_shared';

const LEDGER_TXT: Record<string, { label: string; icon: IconName; color: string }> = {
  commission_settle: { label: '佣金结算', icon: 'chart', color: '#34A36F' },
  withdraw: { label: '提现', icon: 'wallet', color: '#8B919C' },
  refund: { label: '退款', icon: 'refresh', color: '#E5484D' },
  resale: { label: '二手集市', icon: 'cart', color: '#3B82F6' },
  custom: { label: '定制', icon: 'sparkle', color: '#C9A23F' },
};
const ruleKindTxt = (r: CommissionRule) => (r.kind === 'level' ? '上浮' : r.kind === 'penalty' ? '下浮' : '规则');

export default function CommissionPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.creator.commission(), []);
  const [wdOpen, setWdOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const withdrawable = Math.max(0, Number(data?.withdrawable ?? 0));
  const pending = Number(data?.pending ?? 0);
  const settled = Number(data?.settled ?? 0);
  const estimatedTotal = Number(data?.estimatedTotal ?? settled + pending);

  const doWithdraw = async () => {
    const v = Number(amount);
    if (!v || v <= 0) { toast('请输入提现金额'); return; }
    if (v > withdrawable) { toast(`最多可提现 ¥${fmtMoney(withdrawable)}`); return; }
    setBusy(true);
    try {
      const r = await api.creator.withdraw(v);
      toast(`提现成功 ¥${fmtMoney(r.amount)}，余额 ¥${fmtMoney(r.balance)}`, 'check');
      setWdOpen(false);
      setAmount('');
      reload();
    } catch (e) {
      toast((e as Error).message || '提现失败');
    } finally {
      setBusy(false);
    }
  };

  const cards: { icon: IconName; label: string; value: string; sub: string; cls?: string; btn?: boolean }[] = [
    { icon: 'wallet', label: '可提现', value: `¥${fmtMoney(withdrawable)}`, sub: data?.withdrawable != null && data.withdrawable < 0 ? '含历史负数（演示数据）' : '已结算未提取', btn: withdrawable > 0 },
    { icon: 'clock', label: '待结算', value: `¥${fmtMoney(pending)}`, sub: '收货 T+7 自动结算' },
    { icon: 'chart', label: '已结算', value: `¥${fmtMoney(settled)}`, sub: `预估合计 ¥${fmtMoney(estimatedTotal)}` },
  ];

  const rules = data?.rules || [];
  const ledger = data?.ledger || [];
  const withdrawHistory = data?.withdrawHistory || [];

  return (
    <div>
      {/* 规则说明 */}
      <div className="c-card">
        <div className="c-card-hd">
          <span className="c-card-title">佣金规则（2% ~ 10%）</span>
          <span className="c-pill">基础 6% · KPI 浮动</span>
        </div>
        {data?.rateExplain && <div className="c-notice brand" style={{ marginBottom: 12 }}><Icon name="megaphone" size={15} /><span>{data.rateExplain}</span></div>}
        <div className="c-grid c-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
          {rules.map((r) => {
            const up = r.kind === 'level';
            return (
              <div key={r.id} style={{ border: '1px solid var(--creator-line)', borderRadius: 12, padding: '12px 14px', background: up ? '#FBF4E2' : '#FBEDF2' }}>
                <div className="row" style={{ gap: 6, justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 13 }}>{r.name}</b>
                  <span className={`c-badge ${up ? 'c-badge-gold' : 'c-badge-brand'}`}>{ruleKindTxt(r)}</span>
                </div>
                <div className="c-hint" style={{ marginTop: 6, fontSize: 11.5 }}>{r.desc}</div>
                <div style={{ fontSize: 10.5, color: '#9AA0AA', marginTop: 6 }}>触发条件：{r.when}</div>
              </div>
            );
          })}
          {!rules.length && <CState icon="wallet" title="暂无规则" />}
        </div>
      </div>

      {/* 三卡 */}
      <div className="kpi-row" style={{ marginTop: 12 }}>
        {cards.map((c) => (
          <div className="bi-card" key={c.label}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: 'var(--creator-text-2)' }}>{c.label}</span>
              <Icon name={c.icon} size={17} color="var(--brand)" />
            </div>
            <div className="kpi-num" style={{ marginTop: 7 }}>{c.value}</div>
            <div className="kpi-sub">{c.sub}</div>
            {c.btn && (
              <button className="c-btn c-btn-primary c-btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={() => setWdOpen(true)}>
                <Icon name="wallet" size={13} />去提现
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 流水 + 提现历史 */}
      {loading && <div className="c-card" style={{ marginTop: 12 }}><Loading text="加载佣金数据…" /></div>}
      {!loading && error && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <CState danger icon="wallet" title="佣金数据加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重试</button>} />
        </div>
      )}
      {!loading && data && (
        <div className="kpi-row" style={{ marginTop: 12, gridTemplateColumns: '1.7fr 1fr' }}>
          <div className="c-card">
            <div className="c-card-hd"><span className="c-card-title">资金流水</span><button className="c-btn c-btn-sm c-btn-outline" onClick={reload}><Icon name="refresh" size={12} />刷新</button></div>
            {!ledger.length ? <CState icon="wallet" title="暂无流水" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="c-table" style={{ minWidth: 620 }}>
                  <thead><tr><th>时间</th><th>类型</th><th>金额</th><th>余额</th><th>单号</th></tr></thead>
                  <tbody>
                    {ledger.map((l: LedgerEvent) => {
                      const meta = LEDGER_TXT[l.kind] || { label: l.kind, icon: 'receipt', color: '#8B919C' };
                      const out = l.amount < 0;
                      return (
                        <tr key={l.id}>
                          <td style={{ color: '#8B919C', fontSize: 11.5 }}>{fmtDT(l.createdAt)}</td>
                          <td><span className="row" style={{ gap: 5 }}><Icon name={meta.icon} size={12} color={meta.color} />{meta.label}</span></td>
                          <td style={{ fontWeight: 800, color: out ? '#3A3F48' : '#237A54' }}>{out ? '' : '+'}¥{fmtMoney(l.amount)}</td>
                          <td style={{ color: '#8B919C' }}>¥{fmtMoney(l.balance)}</td>
                          <td style={{ fontSize: 11, color: '#A8AEB8' }}>{l.refNo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="c-card">
            <div className="c-card-hd"><span className="c-card-title">提现历史</span><span className="c-pill">{withdrawHistory.length} 笔</span></div>
            {!withdrawHistory.length ? <CState icon="wallet" title="暂无提现记录" desc="结算到可提现后即可提取" /> : (
              <div>
                {withdrawHistory.map((l) => (
                  <div key={l.id} className="audit-row">
                    <span style={{ width: 32, height: 32, borderRadius: 10, background: '#F1F2F5', color: '#6B7180', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="wallet" size={15} />
                    </span>
                    <span className="flex-1" style={{ fontSize: 12.5 }}>
                      <div><b>¥{fmtMoney(Math.abs(l.amount))}</b> · 余额 ¥{fmtMoney(l.balance)}</div>
                      <div style={{ fontSize: 10.5, color: '#A8AEB8' }}>{fmtDT(l.createdAt)} · {l.refNo}</div>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 提现弹窗 */}
      {wdOpen && (
        <Modal narrow onClose={() => setWdOpen(false)} title="提现到账户" icon="wallet"
          foot={<>
            <button className="c-btn c-btn-outline" onClick={() => setWdOpen(false)}>取消</button>
            <button className="c-btn c-btn-primary" disabled={busy} onClick={doWithdraw}>{busy ? '处理中…' : '确认提现'}</button>
          </>}
        >
          <div className="c-hint" style={{ marginBottom: 12 }}>可提现余额 <b style={{ color: 'var(--brand-deep)' }}>¥{fmtMoney(withdrawable)}</b>（已结算 − 已提现）。演示环境即时到账。</div>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontWeight: 800 }}>¥</span>
            <input className="c-input" type="number" min={0} max={withdrawable} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`最多 ¥${fmtMoney(withdrawable)}`} />
            <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setAmount(String(withdrawable))}>全部</button>
          </div>
          <div style={{ fontSize: 11, color: '#9AA0AA', marginTop: 10 }}>
            提现后写入资金流水（LedgerEvent）并生成单号；可提现额随结算自动更新。
          </div>
        </Modal>
      )}
    </div>
  );
}
