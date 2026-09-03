/* ============ 织梦 · 体型数据采集 ============ */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Tag } from '../../components/ui';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { img } from '../../data/mock';
import { useBody, BODY_FIELDS, DEFAULT_BODY } from '../../utils/store';
import { SafeImg, TapStyle, TODAY } from './_shared';
import type { BodyMeasurement } from '../../data/types';

type Tab = 'manual' | 'ai';

const SHOTS = [
  { key: '正面', img: img('style-01.jpg') },
  { key: '侧面', img: img('style-02.jpg') },
  { key: '背面', img: img('style-03.jpg') },
];

function Field({ f, val, err, onChange }: {
  f: (typeof BODY_FIELDS)[number]; val: string; err?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="row" style={{ gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{f.label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{f.unit}</span>
      </div>
      <input
        value={val}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder={`${f.min}-${f.max}`}
        style={{
          width: '100%', height: 38, border: `1.5px solid ${err ? 'var(--danger)' : 'var(--line)'}`,
          borderRadius: 10, padding: '0 10px', fontSize: 14,
          background: err ? 'var(--danger-soft)' : '#fff', outline: 'none',
        }}
      />
      {err && <div style={{ fontSize: 10.5, color: 'var(--danger)', marginTop: 3 }}>{err}</div>}
    </div>
  );
}

export default function BodyMeasurementPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [body, setBody] = useBody();
  const [tab, setTab] = useState<Tab>('manual');

  /* 手动输入 */
  const [values, setValues] = useState<Record<string, string>>(() => {
    const rec: Record<string, string> = {};
    BODY_FIELDS.forEach((f) => { rec[f.key] = String(body[f.key]); });
    return rec;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* AI 拍照 */
  const [shotsDone, setShotsDone] = useState<boolean[]>([false, false, false]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiValues, setAiValues] = useState<Record<string, string>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});

  const allShotsDone = shotsDone.every(Boolean);

  const check = (rec: Record<string, string>) => {
    const errs: Record<string, string> = {};
    BODY_FIELDS.forEach((f) => {
      const v = parseFloat(rec[f.key]);
      if (rec[f.key] === '' || isNaN(v)) errs[f.key] = '请输入数值';
      else if (v < f.min || v > f.max) errs[f.key] = `范围 ${f.min}-${f.max}${f.unit}`;
    });
    return errs;
  };

  const doSave = (rec: Record<string, string>, source: 'manual' | 'ai') => {
    const next: BodyMeasurement = {
      ...body,
      ...(Object.fromEntries(BODY_FIELDS.map((f) => [f.key, parseFloat(rec[f.key])])) as Partial<BodyMeasurement>),
      source,
      updatedAt: TODAY,
    };
    setBody(next);
    toast('体型数据已保存（加密存储）', 'check');
    setTimeout(() => navigate(-1), 400);
  };

  const saveManual = () => {
    const errs = check(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast('请检查输入范围'); return; }
    doSave(values, 'manual');
  };

  const capture = (i: number) => {
    if (shotsDone[i]) { toast('该角度已拍摄'); return; }
    toast('相机已打开（模拟）');
    const next = [...shotsDone];
    next[i] = true;
    setShotsDone(next);
    if (next.every(Boolean)) {
      setProgress(0);
      setScanning(true);
    }
  };

  /* 3 张拍完 → AI 识别动画（约 2 秒）→ 识别完成打开结果 */
  useEffect(() => {
    if (!scanning) return;
    let p = 0;
    const t = setInterval(() => {
      p += 4;
      if (p >= 100) {
        clearInterval(t);
        setProgress(100);
        const rec: Record<string, string> = {};
        BODY_FIELDS.forEach((f) => {
          const base = DEFAULT_BODY[f.key] as number;
          const v = Math.min(f.max, Math.max(f.min, base + Math.round(Math.random() * 6 - 3)));
          rec[f.key] = String(v);
        });
        setAiValues(rec);
        setAiErrors({});
        setAiOpen(true);
        setScanning(false);
      } else {
        setProgress(p);
      }
    }, 80);
    return () => clearInterval(t);
  }, [scanning]);

  const retake = () => {
    setAiOpen(false);
    setShotsDone([false, false, false]);
    setProgress(0);
  };

  const saveAi = () => {
    const errs = check(aiValues);
    setAiErrors(errs);
    if (Object.keys(errs).length > 0) { toast('请检查输入范围'); return; }
    doSave(aiValues, 'ai');
    setAiOpen(false);
  };

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="体型数据" />
      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Segmented options={[{ value: 'manual', label: '手动输入' }, { value: 'ai', label: 'AI拍照量体' }]} value={tab} onChange={setTab} />
        </div>

        {tab === 'manual' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {BODY_FIELDS.map((f) => (
                <Field key={f.key} f={f} val={values[f.key]} err={errors[f.key]} onChange={(v) => { setValues((p) => ({ ...p, [f.key]: v })); setErrors((p) => { const n = { ...p }; delete n[f.key]; return n; }); }} />
              ))}
            </div>
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} onClick={saveManual}>保存体型数据</button>
            <div className="row" style={{ gap: 8, marginTop: 16, padding: 12, background: 'var(--gold-soft)', borderRadius: 12, fontSize: 12, color: '#9A7A1E', lineHeight: 1.6 }}>
              <Icon name="lock" size={16} color="#9A7A1E" style={{ flexShrink: 0 }} />
              <span>数据采用 <strong>AES-256</strong> 加密存储，仅用于版型匹配与尺码推荐，绝不外泄。</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.7 }}>
              按提示依次拍摄三个角度，AI 将自动提取 12 项体型数据（支持多角度拟合）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {SHOTS.map((s, i) => (
                <button
                  key={s.key}
                  className="tap"
                  onClick={() => capture(i)}
                  style={{
                    position: 'relative', border: `1.5px dashed ${shotsDone[i] ? 'var(--success)' : 'var(--line)'}`,
                    borderRadius: 14, overflow: 'hidden', aspectRatio: '3 / 4',
                    background: shotsDone[i] ? 'transparent' : 'var(--bg-deep)',
                  }}
                >
                  {shotsDone[i] ? (
                    <>
                      <SafeImg src={s.img} alt={s.key} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
                      <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={13} />
                      </span>
                    </>
                  ) : (
                    <span className="col" style={{ alignItems: 'center', gap: 8, height: '100%', justifyContent: 'center' }}>
                      <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="camera" size={20} color="var(--brand)" />
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{s.key}</span>
                    </span>
                  )}
                  <span style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, color: shotsDone[i] ? 'var(--success)' : 'var(--text-3)' }}>
                    {shotsDone[i] ? '已拍摄 ✓' : '点击拍摄'}
                  </span>
                </button>
              ))}
            </div>

            {scanning && (
              <div className="card" style={{ marginTop: 14, padding: 18, textAlign: 'center' }}>
                <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
                  <Icon name="scan" size={18} color="var(--brand)" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>AI识别中…</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>正在拟合 12 项体型数据，请稍候</div>
                <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-deep)', marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)', transition: 'width .1s linear' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--brand-deep)', marginTop: 8, fontWeight: 600 }}>{progress}%</div>
              </div>
            )}
            {!allShotsDone && !scanning && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
                还需拍摄 {3 - shotsDone.filter(Boolean).length} 张
              </div>
            )}

            <div className="row" style={{ gap: 8, marginTop: 16, padding: 12, background: 'var(--gold-soft)', borderRadius: 12, fontSize: 12, color: '#9A7A1E', lineHeight: 1.6 }}>
              <Icon name="lock" size={16} color="#9A7A1E" style={{ flexShrink: 0 }} />
              <span>数据采用 <strong>AES-256</strong> 加密存储，仅用于版型匹配与尺码推荐，绝不外泄。</span>
            </div>
          </>
        )}
      </div>

      {/* AI 识别结果 */}
      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="AI量体结果" height="88%">
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <Tag variant="success" icon="check">识别精度 ±3mm</Tag>
          <Tag variant="gray" icon="shield">AES-256 加密</Tag>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12 }}>已自动填充 12 项数据，可手动微调后保存</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {BODY_FIELDS.map((f) => (
            <Field key={f.key} f={f} val={aiValues[f.key] || ''} err={aiErrors[f.key]} onChange={(v) => setAiValues((p) => ({ ...p, [f.key]: v }))} />
          ))}
        </div>
        <div className="row" style={{ gap: 12, margin: '18px 0 14px' }}>
          <button className="btn flex-1 btn-ghost" onClick={retake}>重新拍摄</button>
          <button className="btn flex-1 btn-primary" onClick={saveAi}>确认保存</button>
        </div>
      </Sheet>
    </div>
  );
}
