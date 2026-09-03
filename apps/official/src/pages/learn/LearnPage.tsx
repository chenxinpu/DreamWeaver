import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Avatar, Tag, SectionHeader, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { courses, me, userById, img } from '../../data/mock';
import type { Course } from '../../data/types';

const DEFAULT_PROGRESS: Record<number, number> = { 201: 1620, 202: 576 };
const CATS = ['全部', '设计基础', '面料知识', '打版技巧', '软件操作', '趋势分析', '品牌运营'];
const LEVEL_TAG = {
  1: { label: '入门', variant: 'success' },
  2: { label: '进阶', variant: 'info' },
  3: { label: '高级', variant: 'gold' },
} as const;

const fmtCount = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w` : String(n));
const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m}分钟`;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
};
const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  t.onerror = null;
  t.src = img('style-20.jpg');
};

export default function LearnPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [learningIds] = useLocalState<number[]>('zm_learning_courses', [201, 202]);
  const [progress] = useLocalState<Record<number, number>>('zm_watch_progress', DEFAULT_PROGRESS);
  const [kw, setKw] = React.useState('');
  const [cat, setCat] = React.useState('全部');

  const goCourse = (id: number) => navigate(`/learn/course/${id}`);
  const goUpload = () => {
    if (me.level < 2) toast('完成「进阶」课程并获得「设计师」认证后即可上传教程');
    navigate('/learn/upload');
  };

  const learningList = learningIds
    .map((id) => courses.find((c) => c.id === id))
    .filter((c): c is Course => !!c);
  const first = learningList[0];

  const doneCount = courses.filter((c) => c.certified || (progress[c.id] ?? 0) >= c.duration).length;
  const totalCount = courses.length;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;
  const ringC = 2 * Math.PI * 34;

  const recommended = courses.filter(
    (c) =>
      !c.isUserUploaded &&
      (cat === '全部' || c.category === cat) &&
      (!kw || c.title.includes(kw) || c.category.includes(kw) || c.desc.includes(kw)),
  );
  const hotCourses = courses.filter((c) => c.isUserUploaded).sort((a, b) => b.playCount - a.playCount);

  const onSearchEnter = () => {
    if (!kw.trim()) return;
    toast(recommended.length > 0 ? `为你找到 ${recommended.length} 门相关课程` : '没有找到相关课程，换个关键词试试');
  };

  return (
    <div className="page">
      <NavBar
        title="学习中心"
        right={
          <button onClick={goUpload} className="row" style={{ gap: 4, color: 'var(--brand)', fontWeight: 600, fontSize: 13.5, padding: '4px 8px' }}>
            <Icon name="upload" size={17} />上传
          </button>
        }
      />
      <div className="page-body" style={{ paddingTop: 4 }}>
        {/* ---------- 我的学习卡片 ---------- */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg,#F589AC 0%,#E85C87 55%,#C93E6B 100%)',
            padding: 18,
            color: '#fff',
            boxShadow: '0 10px 24px rgba(232,92,135,.32)',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.85 }}>当前等级</div>
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <span
                  className="row"
                  style={{
                    gap: 5,
                    background: 'linear-gradient(135deg,#FFE9B8,#F2CE7F)',
                    color: '#7A5B10',
                    borderRadius: 99,
                    padding: '4px 11px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    boxShadow: '0 3px 8px rgba(0,0,0,.15)',
                  }}
                >
                  <Icon name="award" size={13} />设计学徒
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 4, background: 'rgba(255,255,255,.18)', borderRadius: 99, padding: '3px 9px', fontSize: 10.5, fontWeight: 600 }}>
                  <Icon name="check-circle" size={12} color="#FFE9B8" />设计学徒 · 已获得
                </span>
                <span className="row" style={{ gap: 4, border: '1px solid rgba(255,255,255,.42)', borderRadius: 99, padding: '3px 9px', fontSize: 10.5, fontWeight: 600 }}>
                  <Icon name="clock" size={12} />设计师 · 进行中
                </span>
              </div>
            </div>
            {/* 进度环形图 */}
            <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
              <svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={42} cy={42} r={34} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={7} />
                <circle
                  cx={42} cy={42} r={34} fill="none" stroke="url(#zmRingGrad)" strokeWidth={7} strokeLinecap="round"
                  strokeDasharray={ringC} strokeDashoffset={ringC * (1 - pct)}
                  style={{ transition: 'stroke-dashoffset .6s ease' }}
                />
                <defs>
                  <linearGradient id="zmRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFE9B8" />
                    <stop offset="100%" stopColor="#FFC978" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{doneCount}</div>
                <div style={{ fontSize: 9.5, opacity: 0.9, marginTop: 1 }}>/ {totalCount} 已完成</div>
              </div>
            </div>
          </div>
          {first && (
            <button
              onClick={() => goCourse(first.id)}
              className="row"
              style={{ width: '100%', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.2)', textAlign: 'left' }}
            >
              <img src={first.cover} alt={first.title} onError={onImgErr} style={{ width: 64, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, opacity: 0.85 }}>继续学习</div>
                <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{first.title}</div>
                <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.28)', marginTop: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round(((progress[first.id] ?? 0) / first.duration) * 100))}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: '#FFE3AC',
                      transition: 'width .4s ease',
                    }}
                  />
                </div>
              </div>
              <span className="row" style={{ flexShrink: 0, gap: 3, background: '#fff', color: 'var(--brand-deep)', borderRadius: 99, padding: '7px 13px', fontSize: 12, fontWeight: 700 }}>
                继续学习<Icon name="arrow-right" size={13} />
              </span>
            </button>
          )}
        </div>

        {/* ---------- 上传教程入口 ---------- */}
        <button className="card row" onClick={goUpload} style={{ width: '100%', marginTop: 14, padding: '13px 14px', gap: 12, textAlign: 'left' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.3)' }}>
            <Icon name="upload" size={19} color="#fff" />
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>成为UP主，分享你的设计教程</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
              {me.level < 2 ? '完成「进阶」课程并获得「设计师」认证后解锁' : '你的教程将展示给所有学习者'}
            </div>
          </div>
          <Icon name="chevron-right" size={16} color="var(--text-3)" />
        </button>

        {/* ---------- 搜索栏 ---------- */}
        <div className="row" style={{ marginTop: 14, background: '#fff', borderRadius: 99, height: 42, padding: '0 16px', gap: 8, boxShadow: '0 1px 2px rgba(40,25,32,.04)' }}>
          <Icon name="search" size={17} color="var(--text-3)" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchEnter(); }}
            placeholder="搜索课程"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5 }}
          />
          {kw && (
            <button onClick={() => setKw('')} style={{ display: 'flex', padding: 2 }}>
              <Icon name="close" size={15} color="var(--text-3)" />
            </button>
          )}
        </div>

        {/* ---------- 分类导航 ---------- */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 2px 2px' }}>
          {CATS.map((c) => {
            const active = c === cat;
            return (
              <button
                key={c}
                onClick={() => { setCat(c); if (c !== '全部') toast(`已为你筛选「${c}」课程`); }}
                style={{
                  flexShrink: 0, padding: '7px 15px', borderRadius: 99, fontSize: 12.5,
                  fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text-2)',
                  background: active ? 'var(--brand-grad)' : '#fff',
                  boxShadow: active ? '0 4px 12px rgba(232,92,135,.35)' : '0 1px 2px rgba(40,25,32,.04)',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* ---------- 推荐课程 ---------- */}
        <div style={{ marginTop: 16 }}>
          <SectionHeader title="推荐课程" extra={cat !== '全部' || kw ? `共 ${recommended.length} 门` : undefined} />
          {recommended.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 2px 10px' }}>
              {recommended.map((c) => {
                const ins = userById(c.instructorId);
                const lv = LEVEL_TAG[c.level];
                return (
                  <button key={c.id} onClick={() => goCourse(c.id)} style={{ width: 152, flexShrink: 0, textAlign: 'left' }}>
                    <div style={{ position: 'relative', width: '100%', height: 96, borderRadius: 14, overflow: 'hidden' }}>
                      <img src={c.cover} alt={c.title} onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(30,15,22,.45))' }} />
                      <span className="row" style={{ position: 'absolute', left: 8, top: 8, gap: 4, background: 'rgba(255,255,255,.92)', borderRadius: 99, padding: '2.5px 7px', fontSize: 10.5, fontWeight: 600, color: 'var(--brand-deep)' }}>
                        <Icon name="play" size={10} />视频
                      </span>
                    </div>
                    <div className="ellipsis-2" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8, lineHeight: 1.35, minHeight: 37 }}>{c.title}</div>
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <Avatar src={ins.avatar} size={16} name={ins.nickname} />
                      <span className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)', flex: 1 }}>{ins.nickname}</span>
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 7 }}>
                      <Tag variant={lv.variant}>{lv.label}</Tag>
                      <span className="row" style={{ gap: 3, fontSize: 10.5, color: 'var(--text-3)' }}>
                        <Icon name="eye" size={11} />{fmtCount(c.learners)}人学过
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="book" title="没有找到相关课程" desc="换个关键词或分类试试吧" />
          )}
        </div>

        {/* ---------- 我的学习进度 ---------- */}
        <div style={{ marginTop: 18 }}>
          <SectionHeader title="我的学习进度" extra={`${learningList.length} 门进行中`} />
          {learningList.length > 0 ? (
            <div className="card" style={{ padding: '2px 14px' }}>
              {learningList.map((c, i) => {
                const p = Math.min(100, Math.round(((progress[c.id] ?? 0) / c.duration) * 100));
                return (
                  <button key={c.id} onClick={() => goCourse(c.id)} className="row" style={{ width: '100%', gap: 12, padding: '12px 0', borderBottom: i < learningList.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left' }}>
                    <img src={c.cover} alt={c.title} onError={onImgErr} style={{ width: 66, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{c.title}</div>
                      <div className="row" style={{ gap: 6, marginTop: 5 }}>
                        <Tag variant={LEVEL_TAG[c.level].variant}>{LEVEL_TAG[c.level].label}</Tag>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDuration(c.duration)}</span>
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 7 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div style={{ width: `${p}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)', transition: 'width .4s ease' }} />
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--text-3)', width: 34, textAlign: 'right' }}>{p}%</span>
                      </div>
                    </div>
                    <Icon name="chevron-right" size={15} color="var(--text-3)" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="book" title="还没有进行中的课程" desc="去推荐课程里挑一门开始吧" />
          )}
        </div>

        {/* ---------- 热门教程 ---------- */}
        <div style={{ marginTop: 18 }}>
          <SectionHeader
            title="热门教程"
            extra={
              <span className="row" style={{ gap: 3 }}>
                <Icon name="fire" size={12} color="var(--brand)" />UP主专享
              </span>
            }
          />
          {hotCourses.length > 0 ? (
            <div className="card" style={{ padding: '2px 14px' }}>
              {hotCourses.map((c, i) => {
                const ins = userById(c.instructorId);
                return (
                  <button key={c.id} onClick={() => goCourse(c.id)} className="row" style={{ width: '100%', gap: 12, padding: '12px 0', borderBottom: i < hotCourses.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left' }}>
                    <div style={{ position: 'relative', width: 96, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                      <img src={c.cover} alt={c.title} onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span className="row" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '3px 6px', background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55))', color: '#fff', fontSize: 9.5, gap: 3 }}>
                        <Icon name="play" size={9} />{fmtCount(c.playCount)}
                      </span>
                    </div>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="ellipsis-2" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{c.title}</div>
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <Avatar src={ins.avatar} size={16} name={ins.nickname} />
                        <span className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)', flex: 1 }}>{ins.nickname}</span>
                        <Tag variant="gold" icon="upload">UP主上传</Tag>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
