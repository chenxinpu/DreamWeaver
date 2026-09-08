import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Avatar, Tag, SectionHeader, CertBadge } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { courses, userById, img } from '../../data/courses';

const DEFAULT_PROGRESS: Record<number, number> = { 201: 1620, 202: 576 };
const LEVEL_TAG = {
  1: { label: '入门', variant: 'success' },
  2: { label: '进阶', variant: 'info' },
  3: { label: '高级', variant: 'gold' },
} as const;
const SPEEDS = [0.5, 1, 1.5, 2];
const PRACTICE: Record<string, string> = {
  '设计基础': '设计一件连衣裙并上传到作品集',
  '面料知识': '挑选3种适合春夏的天然面料，并说明选择理由',
  '打版技巧': '独立完成一件上衣的纸样打版并拍照记录',
  '软件操作': '用设计软件完成一件成衣的虚拟试穿与渲染',
  '趋势分析': '分析本周榜单TOP3作品的爆款共性',
  '品牌运营': '为你的账号制定一周内容发布计划',
};

const fmtCount = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w` : String(n));
const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m}分钟`;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
};
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  t.onerror = null;
  t.src = img('style-20.jpg');
};

/* ---------- 笔记区（按课程独立挂载，key 保证切换课程时重新初始化） ---------- */
function NoteCard({ courseId }: { courseId: number }) {
  const toast = useToast();
  const [note, setNote] = useLocalState<string>(`zm_note_${courseId}`, '');
  const [draft, setDraft] = React.useState(note);
  const save = () => {
    setNote(draft);
    toast('笔记已保存', 'check');
  };
  return (
    <div className="card" style={{ marginTop: 16, padding: 16 }}>
      <SectionHeader title="我的笔记" extra={note ? '已保存' : undefined} />
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="记录本节课的重点、灵感与疑问…"
        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.6, resize: 'none', outline: 'none', background: 'var(--bg)' }}
      />
      <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={save}>
        <Icon name="edit" size={13} />保存笔记
      </button>
      {note && (
        <div style={{ marginTop: 12, background: 'var(--gold-soft)', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.65, color: '#7A5B10', whiteSpace: 'pre-wrap' }}>
          <div className="row" style={{ gap: 4, fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
            <Icon name="star" size={12} color="#C9A23F" />已保存的笔记
          </div>
          {note}
        </div>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const course = courses.find((c) => c.id === Number(id)) || courses[0];
  const instructor = userById(course.instructorId);

  const [progress, setProgress] = useLocalState<Record<number, number>>('zm_watch_progress', DEFAULT_PROGRESS);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [speedOpen, setSpeedOpen] = React.useState(false);
  const [currentSec, setCurrentSec] = React.useState(() => Math.min(progress[course.id] ?? 0, course.duration));
  const playerRef = React.useRef<HTMLDivElement>(null);
  const secRef = React.useRef(currentSec);

  /* 各章节起始秒数 */
  const starts = React.useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (const o of course.outline) { arr.push(acc); acc += o.duration; }
    return arr;
  }, [course]);

  const currentIndex = React.useMemo(() => {
    let i = course.outline.length - 1;
    for (let k = 0; k < course.outline.length; k++) {
      if (currentSec < starts[k] + course.outline[k].duration) { i = k; break; }
    }
    return i;
  }, [currentSec, starts, course]);

  /* 播放节拍：每秒按倍速前进；到结尾自动停表并提示 */
  const finished = currentSec >= course.duration;
  const isPlaying = playing && !finished;
  React.useEffect(() => {
    if (!isPlaying) return;
    const t = window.setInterval(() => {
      const next = Math.min(secRef.current + speed, course.duration);
      const crossed = secRef.current < course.duration && next >= course.duration;
      secRef.current = next;
      setCurrentSec(next);
      if (crossed) toast('恭喜，本课程已学完！', 'check');
    }, 1000);
    return () => window.clearInterval(t);
  }, [isPlaying, speed, course.duration, toast]);

  /* 学习进度按 courseId 持续持久化（离开页面时已保存） */
  React.useEffect(() => {
    secRef.current = currentSec;
    setProgress((p) => ({ ...p, [course.id]: Math.floor(currentSec) }));
  }, [currentSec, course.id, setProgress]);

  const started = playing || currentSec > 0;
  const pct = course.duration > 0 ? Math.min(100, (currentSec / course.duration) * 100) : 0;

  const startLearn = () => {
    if (currentSec >= course.duration) setCurrentSec(0);
    setPlaying(true);
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const togglePlay = () => {
    if (currentSec >= course.duration) setCurrentSec(0);
    setPlaying((p) => !p);
  };
  const playChapter = (i: number) => {
    setCurrentSec(starts[i]);
    setPlaying(true);
    toast(`开始播放：${course.outline[i].title}`);
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setCurrentSec(Math.round(ratio * course.duration));
  };
  const saveProgress = () => {
    setProgress((p) => ({ ...p, [course.id]: Math.floor(currentSec) }));
    toast('学习进度已保存', 'check');
  };

  return (
    <div className="page no-tab" style={{ paddingBottom: 'calc(104px + var(--safe-bottom))' }}>
      <style>{`
        @keyframes zmPulse { 0% { transform: scale(1); opacity: .9; } 70% { transform: scale(2.3); opacity: 0; } 100% { transform: scale(2.3); opacity: 0; } }
        .zm-dot { position: relative; width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; flex-shrink: 0; }
        .zm-dot::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #4ADE80; animation: zmPulse 1.4s ease-out infinite; }
      `}</style>

      {/* ---------- 封面大图 + 透明导航 ---------- */}
      <div style={{ position: 'relative', height: 230 }}>
        <img src={course.cover} alt={course.title} onError={onImgErr} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(30,15,22,.5) 0%, rgba(30,15,22,.1) 45%, rgba(30,15,22,.72) 100%)' }} />
        <NavBar transparent back title={course.title} style={{ position: 'absolute', top: 0, left: 0, right: 0, color: '#fff', background: 'transparent' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8 }}>
            <Tag variant={LEVEL_TAG[course.level].variant}>{LEVEL_TAG[course.level].label}</Tag>
            <Tag variant="line" icon="clock">{fmtDuration(course.duration)}</Tag>
          </div>
          <span className="row" style={{ gap: 4, color: '#fff', fontSize: 11.5, background: 'rgba(0,0,0,.35)', borderRadius: 99, padding: '3px 9px' }}>
            <Icon name="eye" size={12} />{fmtCount(course.learners)}人学过
          </span>
        </div>
      </div>

      <div className="page-body">
        {/* ---------- 课程信息卡 ---------- */}
        <div className="card" style={{ marginTop: -30, padding: 16, position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>{course.title}</div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <Avatar src={instructor.avatar} size={40} name={instructor.nickname} ring />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{instructor.nickname}</span>
                <CertBadge level={instructor.level} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>课程讲师 · {instructor.bio || '资深服装人'}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Tag variant={LEVEL_TAG[course.level].variant}>{LEVEL_TAG[course.level].label}</Tag>
            <Tag variant="primary">{course.category}</Tag>
            <Tag variant="gray" icon="clock">{fmtDuration(course.duration)}</Tag>
            <Tag variant="gray" icon="eye">{fmtCount(course.learners)} 人学过</Tag>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginTop: 12 }}>{course.desc}</div>
        </div>

        {/* ---------- 视频播放器（模拟） ---------- */}
        <div style={{ marginTop: 16 }} ref={playerRef}>
          <SectionHeader title="课程视频" extra={<span style={{ fontSize: 11, color: 'var(--text-3)' }}>{finished ? '已学完' : isPlaying ? '播放中' : '已暂停'}</span>} />
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '16 / 9' }}>
            <img src={course.cover} alt="" onError={onImgErr} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.2), rgba(0,0,0,.66))' }} />
            {!started ? (
              <button onClick={() => setPlaying(true)} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#fff' }}>
                <span style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,.25)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', border: '1.5px solid rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={26} style={{ marginLeft: 3 }} />
                </span>
                <span style={{ fontSize: 12, opacity: 0.92 }}>点击开始学习</span>
              </button>
            ) : (
              <>
                <div className="row" style={{ position: 'absolute', top: 12, left: 12, color: '#fff', fontSize: 11 }}>
                  <span className="row" style={{ gap: 6, background: 'rgba(0,0,0,.45)', borderRadius: 99, padding: '4px 10px' }}>
                    <span className="zm-dot" />{finished ? '已学完' : isPlaying ? '播放中' : '已暂停'} · 第 {currentIndex + 1}/{course.outline.length} 节
                  </span>
                </div>
                <button onClick={togglePlay} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={isPlaying ? 'pause' : 'play'} size={22} style={isPlaying ? {} : { marginLeft: 2 }} />
                  </span>
                </button>
                <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
                  <div onClick={seek} style={{ height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#FF9DB9,#FF5E8D)', transition: 'width .2s linear' }} />
                    </div>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 4, color: '#fff', fontSize: 11.5 }}>
                    <span className="row" style={{ gap: 10 }}>
                      <button onClick={togglePlay} className="row" style={{ gap: 4, color: '#fff', padding: 4 }}>
                        <Icon name={isPlaying ? 'pause' : 'play'} size={13} />{isPlaying ? '暂停' : '播放'}
                      </button>
                      <span style={{ opacity: 0.9 }}>{fmtTime(currentSec)} / {fmtTime(course.duration)}</span>
                    </span>
                    <span className="row" style={{ gap: 10 }}>
                      <button onClick={() => setSpeedOpen(true)} className="row" style={{ gap: 3, color: '#fff', padding: 4 }}>
                        <Icon name="rotate" size={13} />{speed}x
                      </button>
                      <button onClick={saveProgress} className="row" style={{ gap: 3, color: '#fff', padding: 4 }}>
                        <Icon name="check-circle" size={13} />保存进度
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---------- 课程大纲 ---------- */}
        <div className="card" style={{ marginTop: 16, padding: '6px 14px 12px' }}>
          <SectionHeader title="课程大纲" extra={`已学 ${course.outline.filter((o) => o.done).length}/${course.outline.length} 节`} />
          {course.outline.map((o, i) => {
            const isCur = i === currentIndex;
            const isDone = !!o.done;
            return (
              <button key={i} onClick={() => playChapter(i)} className="row" style={{ width: '100%', gap: 12, padding: '11px 10px', borderRadius: 12, background: isCur ? 'var(--brand-soft)' : 'transparent', textAlign: 'left' }}>
                <span style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isCur ? 'var(--brand)' : 'var(--bg-deep)', color: isCur ? '#fff' : 'var(--text-2)' }}>{i + 1}</span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: isCur ? 700 : 500, color: isCur ? 'var(--brand-deep)' : 'var(--text)' }}>{o.title}</span>
                    {isDone && <Tag variant="success" icon="check">已学</Tag>}
                    {isCur && <Tag variant="primary" icon="play">播放中</Tag>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>第{i + 1}节 · {fmtDuration(o.duration)}</div>
                </div>
                <Icon name="chevron-right" size={14} color={isCur ? 'var(--brand)' : 'var(--text-3)'} />
              </button>
            );
          })}
        </div>

        {/* ---------- 实操练习 ---------- */}
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <SectionHeader title="实操练习" />
          <div style={{ border: '1.5px dashed var(--brand)', background: 'var(--brand-soft)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, margin: '0 auto 10px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(232,92,135,.2)' }}>
              <Icon name="scissors" size={22} color="var(--brand)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{PRACTICE[course.category] || '设计一件作品并上传到作品集'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>完成练习可积累积分，助力你的设计认证升级</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 14, height: 38, padding: '0 26px' }} onClick={() => toast('已完成练习，积分+10', 'check')}>去完成</button>
          </div>
        </div>

        {/* ---------- 笔记区 ---------- */}
        <NoteCard key={course.id} courseId={course.id} />

        {/* ---------- 相关推荐 ---------- */}
        <div style={{ marginTop: 18 }}>
          <SectionHeader title="相关推荐" />
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 2px 10px' }}>
            {courses.filter((c) => c.id !== course.id).slice(0, 8).map((c) => (
              <button key={c.id} onClick={() => navigate(`/learn/course/${c.id}`)} style={{ width: 140, flexShrink: 0, textAlign: 'left' }}>
                <div style={{ width: '100%', height: 88, borderRadius: 12, overflow: 'hidden' }}>
                  <img src={c.cover} alt={c.title} onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{c.title}</div>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <Tag variant={LEVEL_TAG[c.level].variant}>{LEVEL_TAG[c.level].label}</Tag>
                  <span className="row" style={{ gap: 3, fontSize: 10.5, color: 'var(--text-3)' }}>
                    <Icon name="eye" size={11} />{fmtCount(c.learners)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- 倍速选择 ---------- */}
      <Sheet open={speedOpen} onClose={() => setSpeedOpen(false)} title="播放倍速">
        {SPEEDS.map((s) => {
          const active = s === speed;
          return (
            <button
              key={s}
              className="row"
              onClick={() => { setSpeed(s); setSpeedOpen(false); toast(`已切换至 ${s}x 倍速`); }}
              style={{ width: '100%', justifyContent: 'space-between', padding: '14px 2px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: active ? 700 : 500, color: active ? 'var(--brand-deep)' : 'var(--text)' }}
            >
              <span>{s}x{s === 1 && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>常用</span>}</span>
              {active && <Icon name="check" size={18} color="var(--brand)" />}
            </button>
          );
        })}
      </Sheet>

      {/* ---------- 底部固定栏 ---------- */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 90, padding: '10px 16px calc(var(--safe-bottom) + 10px)', background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary btn-block" onClick={startLearn}>
          <Icon name="play" size={16} />{currentSec > 0 ? '继续学习' : '开始学习'}
        </button>
      </div>
    </div>
  );
}
