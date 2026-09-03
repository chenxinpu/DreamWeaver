/* =========================================================
 * 3D 模拟中心 SimHubPage（路由 /design/sim3d）
 * 设计验证工作流入口：参数化建模 → 3D 试衣 → 工艺单
 * ========================================================= */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';
import { Sheet, useToast } from '../../../components/Sheet';
import { EmptyState, Tag } from '../../../components/ui';
import DesignerNav from '../../../components/design/DesignerNav';
import DressCanvas from '../../../components/design/DressCanvas';
import { CATEGORY_LABELS } from '../../../data/design';
import { useDesignWorks } from '../../../utils/designStore';
import { BODY_FIELDS, DEFAULT_BODY, K, recommendSize, useBody } from '../../../utils/store';
import type { BodyMeasurement } from '../../../data/types';

/* ---------- 体型是否已采集（localStorage zm_body 存在且非默认值） ---------- */
const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

/* ---------- 3 步流程 ---------- */
const STEPS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'scissors', title: '参数化建模', desc: '18类元素实时建模' },
  { icon: 'dress', title: '3D 试衣', desc: '体型 · 场景确认' },
  { icon: 'receipt', title: '生成工艺单', desc: '对接柔性工厂排产' },
];

/* =========================================================
 * 体型录入 Sheet（demo：BODY_FIELDS 12 项快速表单）
 * ========================================================= */
function BodySheet({ open, onClose, body, onSave }: {
  open: boolean; onClose: () => void; body: BodyMeasurement; onSave: (b: BodyMeasurement) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    BODY_FIELDS.forEach((f) => { o[f.key] = String(body[f.key]); });
    return o;
  });

  /* 每次打开 Sheet 时用当前体型重填表单（保存后再次打开不为旧值） */
  useEffect(() => {
    if (!open) return;
    const o: Record<string, string> = {};
    BODY_FIELDS.forEach((f) => { o[f.key] = String(body[f.key]); });
    setForm(o);
  }, [open, body]);

  const save = () => {
    const out: Record<string, number | string> = { ...body };
    for (const f of BODY_FIELDS) {
      const v = Number(form[f.key]);
      if (!Number.isFinite(v) || form[f.key].trim() === '') { toast('请完整填写 12 项体型数据'); return; }
      out[f.key] = Math.min(f.max, Math.max(f.min, v));
    }
    out.source = 'manual';
    out.updatedAt = new Date().toISOString().slice(0, 10);
    onSave(out as unknown as BodyMeasurement);
  };

  return (
    <Sheet open={open} onClose={onClose} title="录入体型" height="88%">
      <div style={{ paddingBottom: 26 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.8, marginBottom: 14 }}>
          体型与官方App同构（12 项），保存后 3D 试衣将按你的身材实时生成「一人一版」。
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {BODY_FIELDS.map((f) => (
            <label key={f.key} className="col" style={{ gap: 4 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                {f.label}<span style={{ color: 'var(--text-3)', marginLeft: 2 }}>{f.unit}</span>
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={form[f.key]}
                min={f.min} max={f.max}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)',
                  background: '#FBF9FA', fontSize: 14, outline: 'none',
                }}
              />
            </label>
          ))}
        </div>

        <button onClick={save} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }}>
          <Icon name="check-circle" size={18} />保存体型
        </button>

        <div className="row" style={{ gap: 6, justifyContent: 'center', marginTop: 12 }}>
          <Icon name="phone" size={12} color="var(--text-3)" />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>也可在官方App「我的 → 体型管理」采集后自动跨端同步</span>
        </div>
      </div>
    </Sheet>
  );
}

/* =========================================================
 * 主页面
 * ========================================================= */
export default function SimHubPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [body, setBody] = useBody();
  const { works } = useDesignWorks();
  const [bodyOpen, setBodyOpen] = useState(false);

  const collected = hasBodyData(body);
  const recent = works.slice(0, 3);

  const stats: { label: string; value: string }[] = [
    { label: '身高', value: `${body.height}cm` },
    { label: '胸围', value: `${body.bust}cm` },
    { label: '腰围', value: `${body.waist}cm` },
    { label: '臀围', value: `${body.hip}cm` },
  ];

  return (
    <div className="page no-tab" style={{ paddingBottom: 150 }}>
      {/* ===== 顶部标题 ===== */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 16px 2px' }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{
            width: 42, height: 42, borderRadius: 13, background: 'var(--brand-grad)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 18px rgba(232,92,135,.35)',
          }}>
            <Icon name="dress" size={21} />
          </span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: .5 }}>3D 模拟</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>设计验证：参数化建模 → 试衣确认 → 工艺单</div>
          </div>
        </div>
      </div>

      {/* ===== 流程引导 3 步 ===== */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 16, padding: '14px 6px 12px', boxShadow: '0 1px 2px rgba(40,25,32,.04)', border: '1px solid rgba(232,92,135,.1)' }}>
        <div className="row" style={{ justifyContent: 'space-between', padding: '0 10px 12px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>验证流程</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>三步完成「设计 → 可生产」</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="row" style={{ flex: 1, gap: 4 }}>
              <div className="col" style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i === 0 ? 'var(--brand-grad)' : i === 1 ? 'linear-gradient(135deg,#F5DFB8,#C9A23F)' : 'linear-gradient(135deg,#DCE8DF,#5F8A6E)',
                  color: '#fff', boxShadow: '0 4px 10px rgba(120,80,100,.18)',
                }}>
                  <Icon name={s.icon} size={14} />
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.title}</span>
                <span className="ellipsis" style={{ fontSize: 9, color: 'var(--text-3)', maxWidth: '100%' }}>{s.desc}</span>
              </div>
              {i < STEPS.length - 1 && (
                <Icon name="chevron-right" size={14} color="var(--text-3)" style={{ flexShrink: 0, marginBottom: 22, opacity: .6 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== 两大工具卡 ===== */}
      <div style={{ margin: '14px 16px 0' }}>
        {/* 参数化建模 */}
        <div className="card" style={{ padding: 16, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,92,135,.16), transparent 70%)' }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="scissors" size={19} />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>参数化建模</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>Studio · 沉浸式工作台</div>
              </div>
            </div>
            <Tag variant="primary">核心工具</Tag>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.8, margin: '12px 0 6px' }}>
            18 类款式元素（领型/袖型/版型/褶皱…）实时驱动 3D 服装几何；内置 AI 工具箱：<b>文生图</b>·<b>草图优化</b>·<b>风格融合</b>·<b>一人一版</b>。
          </div>
          <div className="row" style={{ gap: 6, margin: '8px 0 12px', flexWrap: 'wrap' }}>
            {['18类款式元素', 'AI 文生图', '一人一版', '撤销/重做'].map((t) => (
              <span key={t} style={{ fontSize: 10.5, color: 'var(--text-2)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 99 }}>{t}</span>
            ))}
          </div>
          <button onClick={() => navigate('/design/studio')} className="btn btn-primary btn-block btn-lg">
            <Icon name="pen-tool" size={18} />开始建模
          </button>
        </div>

        {/* 3D 试衣间 */}
        <div className="card" style={{ padding: 16, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,162,63,.18), transparent 70%)' }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gold-soft)', color: '#9A7A1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="dress" size={19} />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>3D 试衣间</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>Tryon · 动态虚拟试衣</div>
              </div>
            </div>
            <Tag variant="gold">验证工具</Tag>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.8, margin: '12px 0 6px' }}>
            按<b>你的体型</b>生成的虚拟人台实时试穿；6 大场景（工作室/街拍/夜景…）+ 转身/摆裙/行走动态展示，面料垂坠光泽实时微调。
          </div>
          <div className="row" style={{ gap: 6, margin: '8px 0 12px', flexWrap: 'wrap' }}>
            {['体型虚拟人台', '6 大场景', '动态展示', '快捷换装'].map((t) => (
              <span key={t} style={{ fontSize: 10.5, color: 'var(--text-2)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 99 }}>{t}</span>
            ))}
          </div>
          <button onClick={() => navigate('/design/tryon')} className="btn btn-outline btn-block btn-lg">
            <Icon name="dress" size={17} />去试衣
          </button>
        </div>
      </div>

      {/* ===== 体型状态卡 ===== */}
      <div className="card" style={{ margin: '0 16px', padding: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: collected ? 'var(--success-soft)' : 'var(--brand-soft)',
              color: collected ? 'var(--success)' : 'var(--brand)',
            }}>
              <Icon name={collected ? 'user-filled' : 'user'} size={17} />
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                {collected ? '体型已采集' : '体型未采集'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                {collected ? '与官方App同构 · 一人一版就绪' : '录入后可生成一人一版虚拟人台'}
              </div>
            </div>
          </div>
          {collected && <Tag variant="success" icon="check-circle">推荐码 {recommendSize(body)}</Tag>}
        </div>

        {collected ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'var(--bg)', borderRadius: 12, padding: '9px 2px', marginTop: 12 }}>
              {stats.map((c) => (
                <div key={c.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.value}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                <Icon name="ruler" size={12} /> 已按 H{body.height}/B{body.bust}/W{body.waist} 生成专属版型
              </div>
              <button
                onClick={() => navigate('/design/tryon')}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', padding: '4px 10px', background: 'var(--brand-soft)', borderRadius: 99 }}
              >
                去试衣
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setBodyOpen(true)} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <Icon name="ruler" size={16} />录入体型（与官方App同构）
          </button>
        )}
      </div>

      {/* ===== 最近 3D 稿 ===== */}
      <div style={{ margin: '16px 16px 0' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>最近 3D 稿</span>
            {works.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>共 {works.length} 件</span>}
          </div>
          <button onClick={() => navigate('/design/works')} className="row" style={{ fontSize: 12.5, color: 'var(--text-3)', gap: 2 }}>
            全部作品<Icon name="chevron-right" size={13} />
          </button>
        </div>

        {recent.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 2px 8px' }}>
            {recent.map((w) => (
              <button
                key={w.id}
                onClick={() => navigate(`/design/works/${w.id}`)}
                style={{
                  flexShrink: 0, width: 128, borderRadius: 14, overflow: 'hidden', textAlign: 'left', padding: 0,
                  background: '#fff', border: '1px solid var(--line)', boxShadow: '0 1px 3px rgba(40,25,32,.05)',
                  transition: 'all .18s',
                }}
              >
                <div style={{ height: 176, padding: '12px 8px 0', background: '#FDFCFA' }}>
                  <DressCanvas params={w.params} uid={`sim-${w.id}`} />
                </div>
                <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--line)' }}>
                  <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{w.title}</div>
                  <div className="row" style={{ gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', flex: 1 }}>{CATEGORY_LABELS[w.params.category]}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: w.params.color, border: '1px solid rgba(0,0,0,.1)' }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            <EmptyState
              icon="dress"
              title="还没有 3D 参数稿"
              desc="去参数化建模，创作你的第一款参数化设计"
              action={<button onClick={() => navigate('/design/studio')} className="btn btn-primary">去开始建模</button>}
            />
          </div>
        )}
      </div>

      {/* ===== 体型 Sheet ===== */}
      <BodySheet open={bodyOpen} onClose={() => setBodyOpen(false)} body={body} onSave={(b) => {
        setBody(b);
        setBodyOpen(false);
        toast('体型已保存，3D 试衣将按你的体型生成一人一版', 'check');
      }} />

      <DesignerNav />
    </div>
  );
}
