/* ============================================================================
 * /me/body 体型数据
 * - 手动 12 项体型表单 → POST /api/me/body（前端约定；SPEC §4 未列 body 写接口，
 *   若后端未实现则降级为本地保存 + 同步 me.body）
 * - AI 拍照量体：演示步骤页（沿用 V1 文字流程，模拟识别后回填表单）
 * ==========================================================================*/
import React from 'react';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import { api, ApiError } from '../../api/client';
import { useMe } from '../../api/session';
import { BODY_FIELDS, DEFAULT_BODY, readLocalBody, writeLocalBody, bodyToPayload } from '../../utils/store';
import type { BodyMeasurement } from '../../api/types';
import { sleep } from '../../components/shared/utils';

const MEASURE_NOTE = '测量时请保持自然站立、穿着轻薄贴身衣物；数值建议保留一位小数。';

export default function BodyMeasurementPage() {
  const toast = useToast();
  const { user, refresh } = useMe();

  const initial = React.useMemo<BodyMeasurement>(() => {
    const serverBody = user?.body;
    const local = readLocalBody();
    return serverBody && typeof serverBody.height === 'number' ? { ...DEFAULT_BODY, ...serverBody } : local;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = React.useState<BodyMeasurement>(initial);
  const [saving, setSaving] = React.useState(false);
  const [savedLocal, setSavedLocal] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  const set = (k: keyof BodyMeasurement, v: number) => setForm((f) => ({ ...f, [k]: v }));

  /* ---- 保存：优先服务器；后端接口缺失则本地降级 ---- */
  // TODO(后端对齐): SPEC §4 无 body 写入端点 → 前端约定 POST /api/me/body
  //   后端实现同契约后删除降级分支；降级=本地保存 + readLocalBody 同步。
  const save = async () => {
    const bad = BODY_FIELDS.find((bf) => {
      const v = form[bf.key] as number;
      return !v || v < bf.min || v > bf.max;
    });
    if (bad) {
      toast(`请检查「${bad.label}」取值（${bad.min}-${bad.max}${bad.unit}）`);
      return;
    }
    const payload = { ...bodyToPayload(form), source: form.source };
    setSaving(true);
    try {
      await api.users.saveMyBody(payload);
      setSavedLocal(false);
      toast('体型数据已保存到服务器', 'check');
      refresh();
    } catch (e) {
      const err = e as ApiError;
      // 后端未启动 / 接口未实现 → 本地降级保存
      writeLocalBody({ ...form, updatedAt: new Date().toISOString() });
      setSavedLocal(true);
      if (err.code === 'network') {
        toast('后端未启动：体型已保存在本机，联网后会自动同步', undefined);
      } else if (err.code === '404' || /not found|不存在|接口/i.test(err.message)) {
        toast('后端暂无 /me/body 接口：已本地保存（等待契约实现）', undefined);
      } else {
        toast(err.message || '保存失败，已本地保存', undefined);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page no-tab page-bleed">
      <NavBar back title="体型数据" />

      <div className="page-body" style={{ paddingTop: 4 }}>
        {/* 说明卡 */}
        <div style={{ display: 'flex', gap: 10, background: 'linear-gradient(120deg,#FFF3F6,#FDE9EF)', border: '1px solid #F6CFDC', borderRadius: 14, padding: '11px 13px', marginBottom: 14 }}>
          <Icon name="ruler" size={19} color="var(--brand)" />
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, flex: 1 }}>
            你的体型数据仅用于「私人定制」的版型匹配与成衣尺寸推荐，绝不会公开。{MEASURE_NOTE}
          </div>
        </div>

        {/* 来源切换 */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="row" style={{ gap: 6, fontSize: 14, fontWeight: 800 }}>
            体型数据（{form.source === 'ai' ? 'AI 量体' : '手动填写'}）
            {savedLocal && <span style={{ fontSize: 10.5, color: 'var(--gold)', fontWeight: 600 }}>· 已本地保存</span>}
          </span>
          <Segmented
            size="sm"
            options={[{ value: 'a', label: 'AI 拍照量体' }, { value: 'b', label: '手动填写' }]}
            value={form.source === 'ai' ? 'a' : 'b'}
            onChange={(v) => { if (v === 'a') setAiOpen(true); }}
          />
        </div>

        {/* AI 演示入口 */}
        <button onClick={() => setAiOpen(true)} className="row" style={{ width: '100%', gap: 12, background: '#fff', borderRadius: 16, padding: '12px 14px', marginBottom: 14, border: '1px solid var(--line)', textAlign: 'left' }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.3)', color: '#fff' }}>
            <Icon name="scan" size={21} />
          </span>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>AI 拍照量体（演示）</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>拍一张正/侧面照 → AI 自动识别 12 项关键围度 → 一键写入</div>
          </div>
          <Icon name="chevron-right" size={17} color="var(--text-3)" />
        </button>

        {/* 手动表单分组 */}
        <FormGroup title="基础 & 躯干" icon="user">
          {BODY_FIELDS.filter((f) => ['height', 'weight', 'bust', 'underBust', 'waist', 'hip', 'backLength'].includes(f.key)).map((f) => (
            <Field key={f.key} f={f} value={form[f.key] as number} onChange={(v) => set(f.key, v)} />
          ))}
        </FormGroup>
        <FormGroup title="肩臂 & 四肢" icon="pants">
          {BODY_FIELDS.filter((f) => ['shoulderWidth', 'armLength', 'thigh', 'calf', 'neck'].includes(f.key)).map((f) => (
            <Field key={f.key} f={f} value={form[f.key] as number} onChange={(v) => set(f.key, v)} />
          ))}
        </FormGroup>

        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>数据来源：{form.source === 'ai' ? 'AI 自动识别' : '手动录入'} · 最近更新 {form.updatedAt ? new Date(form.updatedAt).toLocaleString('zh-CN') : '—'}</div>

        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
          <Icon name="check-circle" size={17} />{saving ? '保存中…' : '保存体型数据'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 10, lineHeight: 1.7 }}>
          保存后，商城「私人定制」会按此数据自动调整规格并提示不合适的部位。
          {savedLocal && <span style={{ display: 'block', color: 'var(--gold)' }}>当前为本地降级保存（后端 /me/body 接口待接入）。</span>}
        </div>
      </div>

      {/* AI 拍照量体 —— 演示流程 */}
      <AIMeasureSheet open={aiOpen} onClose={() => setAiOpen(false)} onDone={(b) => { setForm(b); setAiOpen(false); toast('AI 量体完成，已写入表单', 'check'); }} />
    </div>
  );
}

function FormGroup({ title, icon, children }: { title: string; icon: 'user' | 'pants'; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '6px 16px 14px', marginBottom: 14 }}>
      <div className="row" style={{ gap: 6, padding: '12px 0 8px', fontSize: 13.5, fontWeight: 800 }}>
        <Icon name={icon} size={15} color="var(--brand)" />{title}
      </div>
      {children}
    </div>
  );
}

function Field({ f, value, onChange }: { f: (typeof BODY_FIELDS)[number]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #F1E9E4', gap: 10 }}>
      <div>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{f.label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginLeft: 6 }}>{f.min}-{f.max}{f.unit}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <input
          type="number"
          value={value === 0 ? '' : value}
          placeholder="—"
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 78, textAlign: 'right', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px', fontSize: 14, outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)', width: 30 }}>{f.unit}</span>
      </div>
    </div>
  );
}

/* ================= AI 拍照量体 · 演示步骤 ================= */
const AI_STEPS = ['上传照片', '关键点识别', '生成报告'];
function AIMeasureSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (b: BodyMeasurement) => void }) {
  const toast = useToast();
  const [step, setStep] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) { setStep(0); setRunning(false); }
  }, [open]);

  const startRecognize = async () => {
    setRunning(true);
    setStep(1);
    await sleep(900);
    setStep(2);
    await sleep(1100);
    setRunning(false);
  };

  const applyResult = () => {
    const ai: BodyMeasurement = {
      height: 166, weight: 51, bust: 85, underBust: 73, waist: 63, hip: 91,
      shoulderWidth: 38.5, armLength: 55, thigh: 51, calf: 33.5, neck: 32.5, backLength: 39,
      source: 'ai', updatedAt: new Date().toISOString(),
    };
    writeLocalBody(ai);
    onDone(ai);
    toast('AI 估算结果可手动微调后保存', 'check');
  };

  return (
    <Sheet open={open} onClose={onClose} title="AI 拍照量体（演示）" height="88%">
      <div style={{ margin: '4px 0 14px', display: 'flex', alignItems: 'center' }}>
        {AI_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="step-line" style={{ background: step >= i ? 'var(--brand)' : 'var(--bg-deep)' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="step-dot" style={{ background: step >= i ? 'var(--brand-grad)' : 'var(--bg-deep)', color: step >= i ? '#fff' : 'var(--text-3)', boxShadow: step >= i ? '0 4px 10px rgba(232,92,135,.3)' : 'none' }}>
                {step > i ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <span className="step-label" style={{ color: step >= i ? 'var(--brand-deep)' : 'var(--text-3)' }}>{s}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <div style={{ paddingBottom: 14 }}>
          <div onClick={() => fileRef.current?.click()} style={{ border: '1.6px dashed var(--brand)', borderRadius: 18, background: 'var(--brand-soft)', padding: '36px 18px', textAlign: 'center', cursor: 'pointer' }}>
            <Icon name="camera" size={40} color="var(--brand)" />
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--brand-deep)', marginTop: 10 }}>拍摄/上传正侧面照（演示）</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.7 }}>建议紧身衣物、自然站立，双手微张<br />照片仅在本机处理，用于演示识别流程</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={() => startRecognize()} />
        </div>
      )}

      {step === 1 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: 88, height: 88, margin: '0 auto 18px', position: 'relative' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--brand-soft)', borderTopColor: 'var(--brand)', animation: 'zmSpin 1s linear infinite', display: 'block' }} />
            <span style={{ position: 'absolute', inset: 22, background: 'var(--brand)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="scan" size={22} color="#fff" />
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>AI 正在识别关键点…</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>肩点 / 胸高点 / 腰线 / 髋线 / 颈点…（演示动画）</div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="row" style={{ gap: 10, background: 'var(--success-soft)', borderRadius: 14, padding: '11px 13px', fontSize: 12.5, color: 'var(--success)', fontWeight: 600, marginBottom: 12 }}>
            <Icon name="check-circle" size={17} />识别完成，共估算 12 项关键围度
          </div>
          <div className="card" style={{ padding: '10px 14px' }}>
            {[
              ['身高', '166.0 cm'], ['体重', '51.0 kg'], ['胸围', '85.0 cm'], ['腰围', '63.0 cm'], ['臀围', '91.0 cm'],
              ['肩宽', '38.5 cm'], ['臂长', '55.0 cm'], ['下胸围', '73.0 cm'], ['大腿围', '51.0 cm'], ['小腿围', '33.5 cm'], ['颈围', '32.5 cm'], ['背长', '39.0 cm'],
            ].map(([k, v]) => (
              <div key={k} className="kv-row"><span className="kv-key">{k}</span><span className="kv-val">{v}</span></div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, margin: '10px 2px 0' }}>
            提示：AI 估算存在 ±2cm 误差，正式定制前建议对照软尺微调保存。
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={applyResult} disabled={running}>
            <Icon name="check" size={17} />一键写入体型表单
          </button>
        </div>
      )}
    </Sheet>
  );
}
