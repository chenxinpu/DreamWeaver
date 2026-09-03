/* ============ 织梦·设计 App · 设计学院（内嵌学习） ============ */
import React from 'react';
import Icon from '../../components/Icon';
import { Avatar, Tag } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import DesignTabBar from '../../components/design/DesignTabBar';
import { userById, img } from '../../data/mock';

/* ---------- 分类 ---------- */
type CatKey = 'basic' | 'ai' | 'fabric' | 'tryon';
const CATS: { v: CatKey | 'all'; label: string }[] = [
  { v: 'all', label: '全部' },
  { v: 'basic', label: '参数化基础' },
  { v: 'ai', label: 'AI 玩法' },
  { v: 'fabric', label: '面料与图案' },
  { v: 'tryon', label: '3D 试衣' },
];
const CAT_LABEL: Record<CatKey, string> = { basic: '参数化基础', ai: 'AI 玩法', fabric: '面料与图案', tryon: '3D 试衣' };

/* ---------- 教程（mock） ---------- */
interface Tutorial {
  id: number; title: string; cat: CatKey; cover: string; insId: number;
  plays: string; durMin: number;
}
const TUTORIALS: Tutorial[] = [
  { id: 1, title: '5 分钟看懂参数化设计：把灵感变成参数', cat: 'basic', cover: img('style-17.jpg'), insId: 1, plays: '12.6w', durMin: 9 },
  { id: 2, title: '连衣裙参数化打版：领型 × 袖型 × 腰线', cat: 'basic', cover: img('craft-01.jpg'), insId: 3, plays: '8.4w', durMin: 12 },
  { id: 3, title: '一句话生成 5 款设计稿：AI 灵感全解析', cat: 'ai', cover: img('style-09.jpg'), insId: 1, plays: '5.1w', durMin: 8 },
  { id: 4, title: 'AI 风格迁移：一键变身法式 / 学院 / 晚宴', cat: 'ai', cover: img('style-03.jpg'), insId: 9, plays: '2.2w', durMin: 7 },
  { id: 5, title: '面料性格学：垂坠感 / 光泽 / 弹性怎么调', cat: 'fabric', cover: img('fabric-01.jpg'), insId: 12, plays: '6.8w', durMin: 10 },
  { id: 6, title: '碎花与格纹：印花图案的 4 种玩法', cat: 'fabric', cover: img('dress-01.jpg'), insId: 15, plays: '4.5w', durMin: 8 },
  { id: 7, title: '3D 试衣间：让设计在你身上提前上身', cat: 'tryon', cover: img('style-21.jpg'), insId: 2, plays: '3.6w', durMin: 11 },
  { id: 8, title: '一键同步发布：作品如何进入官方App', cat: 'basic', cover: img('style-13.jpg'), insId: 5, plays: '1.6w', durMin: 6 },
];

/* ---------- 新手引导 3 步 ---------- */
const GUIDE_STEPS = [
  { no: 1, label: '选择品类', desc: '连衣裙到裤装' },
  { no: 2, label: '调节参数', desc: '领型袖型版型' },
  { no: 3, label: 'AI 辅助', desc: '同步发布官方App' },
];

/* ---------- 灵感库配色 ---------- */
interface Palette { name: string; mood: string; colors: string[]; desc: string }
const PALETTES: Palette[] = [
  { name: '法式温柔', mood: '约会 · 假日', colors: ['#F5EFE6', '#E8A0B0', '#C2544E'], desc: '奶油白 × 蜜桃粉 × 砖红' },
  { name: '通勤知性', mood: '职场 · 面试', colors: ['#D8CFC2', '#B58F6A', '#4A4A52'], desc: '燕麦 × 驼色 × 炭灰' },
  { name: '复古学院', mood: '校园 · 减龄', colors: ['#F3EFE8', '#2A3B5C', '#7E2E3A'], desc: '本白 × 藏青 × 酒红' },
  { name: '晚宴光泽', mood: '派对 · 年会', colors: ['#D9C6A5', '#2B2B30', '#5A6650'], desc: '香槟 × 曜黑 × 墨绿' },
];

const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  t.onerror = null;
  t.src = img('style-20.jpg');
};

export default function DesignLearnPage() {
  const toast = useToast();
  const [cat, setCat] = React.useState<CatKey | 'all'>('all');

  const list = TUTORIALS.filter((t) => cat === 'all' || t.cat === cat);

  const pickCat = (v: CatKey | 'all', label: string) => {
    setCat(v);
    if (v !== 'all') toast(`已为你筛选「${label}」教程`);
  };
  const play = (t: Tutorial) => toast(`「${t.title}」视频播放（演示）`, 'play');
  const copyPalette = (p: Palette) => {
    try {
      if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(p.colors.join(', '));
    } catch { /* 剪贴板不可用时仅 toast */ }
    toast(`「${p.name}」配色已复制到剪贴板`, 'copy');
  };

  return (
    <>
      <div className="page fade-in" style={{ paddingBottom: 150 }}>
        {/* ---------- 顶部标题 ---------- */}
        <div style={{ padding: '20px 18px 2px' }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(120deg,#2E2638,#5B3A72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <Icon name="book" size={16} />
            </span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: .2 }}>设计学院</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>
            从 0 到 1 玩转参数化设计 · {TUTORIALS.length} 节精选小课
          </div>
        </div>

        {/* ---------- 分类 chips ---------- */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 16px 2px' }}>
          {CATS.map((c) => {
            const active = c.v === cat;
            return (
              <button
                key={c.v}
                onClick={() => pickCat(c.v, c.label)}
                style={{
                  flexShrink: 0, padding: '7px 15px', borderRadius: 99, fontSize: 12.5, whiteSpace: 'nowrap',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--text-2)',
                  background: active ? 'var(--brand-grad)' : '#fff',
                  boxShadow: active ? '0 4px 12px rgba(232,92,135,.35)' : '0 1px 2px rgba(40,25,32,.04)',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* ---------- 教程列表 ---------- */}
        <div style={{ marginTop: 14, padding: '0 16px' }}>
          <div className="card" style={{ padding: '2px 14px' }}>
            {list.map((t, i) => {
              const ins = userById(t.insId);
              return (
                <button
                  key={t.id}
                  onClick={() => play(t)}
                  className="row"
                  style={{ width: '100%', gap: 12, padding: '12px 0', borderBottom: i < list.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left' }}
                >
                  <div style={{ position: 'relative', width: 100, height: 68, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-deep)' }}>
                    <img src={t.cover} alt={t.title} loading="lazy" onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,18,30,.12)' }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(46,38,56,.55)', color: '#fff', backdropFilter: 'blur(2px)',
                      }}>
                        <Icon name="play" size={13} />
                      </span>
                    </span>
                    <span style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0, padding: '3px 6px',
                      background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(20,10,20,.6))', color: '#fff',
                      fontSize: 9.5, display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <Icon name="eye" size={9} />{t.plays}
                    </span>
                  </div>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="ellipsis-2" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{t.title}</div>
                    <div className="row" style={{ gap: 6, marginTop: 7 }}>
                      <Avatar src={ins.avatar} size={16} name={ins.nickname} />
                      <span className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)', flex: 1 }}>{ins.nickname} · {CAT_LABEL[t.cat]}</span>
                      <Tag variant="line" icon="clock">{t.durMin}分钟</Tag>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- 工具指南卡：3 步新手引导 ---------- */}
        <div style={{ padding: '0 16px', marginTop: 22 }}>
          <div className="row" style={{ gap: 7, marginBottom: 10 }}>
            <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>工具指南</span>
          </div>
          <button
            onClick={() => toast('新手引导（演示）：跟着 3 步完成第一件设计', 'pen-tool')}
            style={{
              width: '100%', textAlign: 'left', padding: '16px', borderRadius: 18, color: '#fff',
              background: 'linear-gradient(120deg,#2E2638 0%,#4A3A5C 55%,#6B4A86 100%)',
              boxShadow: '0 10px 22px rgba(46,38,56,.28)',
            }}
          >
            <div className="row" style={{ gap: 9 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--brand-grad)', boxShadow: '0 4px 12px rgba(232,92,135,.4)',
              }}>
                <Icon name="pen-tool" size={17} />
              </span>
              <span className="flex-1" style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>新手 3 步上手</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: .75, marginTop: 2 }}>3 分钟，完成你的第一件参数化设计</span>
              </span>
              <Icon name="chevron-right" size={17} color="rgba(255,255,255,.8)" />
            </div>
            <div className="row" style={{ gap: 0, marginTop: 15 }}>
              {GUIDE_STEPS.map((s, i) => (
                <React.Fragment key={s.no}>
                  {i > 0 && (
                    <span style={{ flex: 1, height: 1.5, background: 'rgba(255,255,255,.2)', margin: '0 8px 26px' }} />
                  )}
                  <span style={{ width: 86, flexShrink: 0, textAlign: 'center' }}>
                    <span style={{
                      width: 26, height: 26, margin: '0 auto 6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === 2 ? 'var(--brand-grad)' : 'rgba(255,255,255,.16)',
                      border: '1px solid rgba(255,255,255,.4)', fontSize: 12, fontWeight: 800,
                    }}>
                      {s.no}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700 }}>{s.label}</span>
                    <span style={{ display: 'block', fontSize: 9.5, opacity: .68, marginTop: 1 }}>{s.desc}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </button>
        </div>

        {/* ---------- 灵感库：配色方案 ---------- */}
        <div style={{ padding: '0 16px', marginTop: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="row" style={{ gap: 7 }}>
              <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
              <span style={{ fontSize: 16, fontWeight: 800 }}>灵感库 · 配色方案</span>
            </div>
            <span className="row" style={{ gap: 3, fontSize: 11, color: 'var(--text-3)' }}>
              <Icon name="copy" size={12} />点击即复制
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PALETTES.map((p) => (
              <button
                key={p.name}
                onClick={() => copyPalette(p)}
                style={{
                  textAlign: 'left', padding: '12px', borderRadius: 16, background: '#fff',
                  boxShadow: '0 2px 8px rgba(40,25,32,.05)',
                }}
              >
                <div className="row" style={{ gap: 6 }}>
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', background: c,
                        border: '1px solid rgba(0,0,0,.08)', boxShadow: 'inset 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,.15)',
                      }}
                    />
                  ))}
                  <Icon name="copy" size={14} color="var(--text-3)" style={{ marginLeft: 'auto' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 9 }}>{p.name}</div>
                <div className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {p.desc} · {p.mood}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <DesignTabBar active="learn" />
    </>
  );
}
