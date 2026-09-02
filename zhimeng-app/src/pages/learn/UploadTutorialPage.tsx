import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { CertBadge } from '../../components/ui';
import { Segmented, useToast } from '../../components/Sheet';
import { me, img } from '../../data/mock';

const CATS = ['设计基础', '面料知识', '打版技巧', '软件操作', '趋势分析', '品牌运营'];
const COVERS = [img('style-02.jpg'), img('dress-01.jpg'), img('craft-01.jpg'), img('fabric-01.jpg'), img('style-17.jpg')];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};

const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  t.onerror = null;
  t.src = img('style-20.jpg');
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        {required && <span style={{ color: 'var(--brand)' }}>*</span>}{label}
      </div>
      {children}
    </div>
  );
}

export default function UploadTutorialPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<'1' | '2' | '3'>('1');
  const [cover, setCover] = React.useState(COVERS[0]);
  const [desc, setDesc] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [percent, setPercent] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);
  const percentRef = React.useRef(0);

  const locked = me.level < 2;
  const uploadDone = percent >= 100 && !uploading;

  /* 组件卸载时清理定时器 */
  React.useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  /* 模拟上传进度：0 → 100% 后自动完成 */
  const startUpload = () => {
    if (uploading) return;
    percentRef.current = 0;
    setPercent(0);
    setUploading(true);
    timerRef.current = window.setInterval(() => {
      const next = Math.min(100, percentRef.current + 12 + Math.random() * 14);
      percentRef.current = next;
      setPercent(next);
      if (next >= 100) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setUploading(false);
        toast('视频上传完成', 'check');
      }
    }, 220);
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) { toast('标签已存在'); return; }
    if (tags.length >= 5) { toast('最多添加 5 个标签'); return; }
    setTags([...tags, t]);
    setTagInput('');
  };

  const submit = () => {
    if (!title.trim()) { toast('请先填写教程标题'); return; }
    if (!category) { toast('请选择课程分类'); return; }
    if (uploading) { toast('视频正在上传中，请稍候'); return; }
    toast('提交成功，进入审核（≤24小时）', 'check');
    navigate('/learn');
  };

  return (
    <div className="page no-tab" style={{ paddingBottom: 'calc(112px + var(--safe-bottom))' }}>
      <NavBar
        back
        title="上传教程"
        right={
          <button onClick={submit} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 14.5, padding: '6px 10px' }}>提交</button>
        }
      />
      <div className="page-body" style={{ paddingTop: 6 }}>
        {/* ---------- 认证横幅 ---------- */}
        {locked && (
          <div className="row" style={{ gap: 10, background: 'var(--gold-soft)', border: '1px solid #F0DFAE', borderRadius: 14, padding: '11px 13px', marginBottom: 14 }}>
            <Icon name="lock" size={18} color="#9A7A1E" />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7A5B10' }}>需获得「设计师」认证后才能发布教程</div>
              <div className="row" style={{ gap: 6, marginTop: 4, fontSize: 12, color: '#9A7A1E' }}>
                <span>当前等级：</span><CertBadge level={Math.max(me.level, 1)} />
              </div>
            </div>
          </div>
        )}

        {/* ---------- 表单 ---------- */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="教程标题" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="给教程起个响亮的名字，例如：零基础学打版…" style={inputStyle} />
          </Field>

          <Field label="课程分类" required>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '7px 14px', borderRadius: 99, fontSize: 12.5,
                    fontWeight: category === c ? 700 : 500,
                    color: category === c ? '#fff' : 'var(--text-2)',
                    background: category === c ? 'var(--brand-grad)' : 'var(--bg-deep)',
                    boxShadow: category === c ? '0 4px 10px rgba(232,92,135,.3)' : 'none',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="课程难度">
            <Segmented
              equal
              options={[{ value: '1', label: '入门' }, { value: '2', label: '进阶' }, { value: '3', label: '高级' }]}
              value={difficulty}
              onChange={setDifficulty}
            />
          </Field>

          <Field label="视频文件" required>
            <button onClick={startUpload} disabled={uploading} style={{ width: '100%', border: `1.5px dashed ${uploadDone ? 'var(--success)' : 'var(--brand)'}`, borderRadius: 16, background: uploadDone ? 'var(--success-soft)' : 'var(--brand-soft)', padding: '24px 16px', textAlign: 'center' }}>
              {uploadDone ? (
                <>
                  <Icon name="check-circle" size={40} color="var(--success)" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', marginTop: 10 }}>视频上传完成</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>点击可重新上传</div>
                </>
              ) : uploading ? (
                <>
                  <Icon name="upload" size={36} color="var(--brand)" />
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>正在上传… {Math.floor(percent)}%</div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(232,92,135,.18)', marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)', transition: 'width .2s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>请勿关闭页面，上传中…</div>
                </>
              ) : (
                <>
                  <Icon name="upload" size={36} color="var(--brand)" />
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>点击上传视频</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>支持 MP4 / MOV 格式，≤2GB</div>
                </>
              )}
            </button>
          </Field>

          <Field label="封面图">
            <div style={{ display: 'flex', gap: 10 }}>
              {COVERS.map((src) => (
                <button
                  key={src}
                  onClick={() => setCover(src)}
                  style={{ position: 'relative', width: 72, height: 52, borderRadius: 10, overflow: 'hidden', border: cover === src ? '2px solid var(--brand)' : '2px solid transparent', flexShrink: 0 }}
                >
                  <img src={src} alt="" onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {cover === src && (
                    <span style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 99, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={10} color="#fff" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Field>

          <Field label="图文说明">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="介绍这节教程的亮点、适合人群、你将学到什么…"
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
            />
          </Field>

          <Field label="标签">
            <div className="row" style={{ gap: 8 }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="输入标签，如：打版"
                style={inputStyle}
              />
              <button onClick={addTag} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}><Icon name="plus" size={14} />添加</button>
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {tags.map((t) => (
                  <span key={t} className="row" style={{ gap: 5, background: 'var(--brand-soft)', color: 'var(--brand-deep)', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                    #{t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{ display: 'flex', padding: 0 }}>
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>

        {/* ---------- 提交 ---------- */}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-block btn-lg" onClick={submit}>
            <Icon name="send" size={17} />提交审核
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>提交后将在 24 小时内完成审核，请确保内容为原创</div>
        </div>
      </div>
    </div>
  );
}
