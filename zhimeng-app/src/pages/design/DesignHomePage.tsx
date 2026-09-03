/* ============ 织梦·设计 App · 首页（灵感） ============ */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import DesignTabBar from '../../components/design/DesignTabBar';
import { AI_CANDIDATES, CATEGORY_LABELS } from '../../data/design';
import type { CategoryKey } from '../../data/design';
import { me, userById, img } from '../../data/mock';

/* ---------- 品类快捷入口 ---------- */
const CATS: CategoryKey[] = ['dress', 'shirt', 'skirt', 'coat', 'pants', 'suit'];

/* ---------- 热门模板（来自 AI 候选） ---------- */
const TEMPLATES = AI_CANDIDATES.slice(0, 5);

/* ---------- 灵感瀑布流 ---------- */
interface FeedItem {
  id: number; src: string; h: number; title: string;
  tag: string; hot?: boolean; authorId: number; likes: number;
}
const FEED: FeedItem[] = [
  { id: 1, src: img('dress-01.jpg'), h: 224, title: '碎花的浪漫，藏在泡泡袖里', tag: '本周趋势 · 法式泡泡袖', hot: true, authorId: 1, likes: 3421 },
  { id: 2, src: img('style-02.jpg'), h: 252, title: '定制裙买家秀 · 和 3D 预览几乎一致', tag: '真人试穿', authorId: 6, likes: 890 },
  { id: 3, src: img('dress-18.jpg'), h: 238, title: '微醺玫瑰 · 缎面晚宴裙的光泽', tag: '本周趋势 · 缎面光泽', hot: true, authorId: 1, likes: 3980 },
  { id: 4, src: img('skirt-01.jpg'), h: 200, title: '工装半裙的一衣多穿公式', tag: '复古工装', authorId: 5, likes: 1680 },
  { id: 5, src: img('style-09.jpg'), h: 254, title: '设计学徒的第 1 件打版作业', tag: '学徒日常', authorId: 4, likes: 2760 },
  { id: 6, src: img('dress-11.jpg'), h: 232, title: '苔绿 × 本白 · 东方美学配色', tag: '本周趋势 · 东方美学', hot: true, authorId: 8, likes: 5120 },
  { id: 7, src: img('blouse-02.jpg'), h: 208, title: '泡泡纱衬衫 · 自带空气感', tag: '通勤清爽', authorId: 16, likes: 3120 },
  { id: 8, src: img('style-17.jpg'), h: 244, title: '让设计在 3D 里提前上身', tag: '3D 试衣', authorId: 3, likes: 1860 },
  { id: 9, src: img('skirt-02.jpg'), h: 204, title: '真丝课堂：光泽与垂坠怎么选', tag: '面料研究所', authorId: 12, likes: 1980 },
  { id: 10, src: img('dress-07.jpg'), h: 234, title: '午夜蓝丝绒 · 晚宴的主角', tag: '本周趋势 · 晚宴光泽', hot: true, authorId: 13, likes: 1420 },
];

const fmtCnt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w` : String(n));
const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget;
  t.onerror = null;
  t.src = img('style-20.jpg');
};

export default function DesignHomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [favs, setFavs] = React.useState<number[]>([]);

  const goStudio = (qs = '') => navigate(`/design/studio${qs}`);
  const pickCat = (c: CategoryKey) => {
    toast(`开始设计：${CATEGORY_LABELS[c]}`, 'pen-tool');
    goStudio(`?cat=${c}`);
  };
  const goAI = (c?: (typeof AI_CANDIDATES)[number]) => {
    if (c) {
      toast(`已就绪「${c.title}」，正在打开 AI 创作`, 'sparkle');
      goStudio(`?ai=1&candidate=${c.id}`);
    } else {
      toast('AI 创作模式已开启', 'sparkle');
      goStudio('?ai=1');
    }
  };
  const toggleFav = (id: number) => {
    const has = favs.includes(id);
    setFavs(has ? favs.filter((x) => x !== id) : [...favs, id]);
    toast(has ? '已取消收藏' : '灵感已收藏，可在灵感册回看', has ? undefined : 'heart');
  };

  return (
    <>
      <div className="page fade-in" style={{ paddingBottom: 150 }}>
        {/* ---------- 品牌区 + 头像 ---------- */}
        <div className="row" style={{ justifyContent: 'space-between', padding: '18px 18px 0' }}>
          <div className="row" style={{ gap: 9 }}>
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: 'var(--brand-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 14px rgba(232,92,135,.35)',
            }}>
              <Icon name="pen-tool" size={18} color="#fff" />
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: .3 }}>织梦 · 设计</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>参数化创作 · AI 辅助 · 3D 试衣</div>
            </div>
          </div>
          <button onClick={() => toast(`@${me.nickname} · 设计账号建设中`)} style={{ borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <Avatar src={me.avatar} size={40} ring name={me.nickname} />
          </button>
        </div>

        {/* ---------- 主标题 ---------- */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>今天想设计什么？</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>把灵感落成参数，一键变成能穿的设计 ✨</div>
        </div>

        {/* ---------- Hero：创建新设计 ---------- */}
        <div
          onClick={() => { toast('进入创作工作台', 'pen-tool'); goStudio(); }}
          style={{
            position: 'relative', margin: '18px 16px 0', padding: '20px 18px 16px',
            borderRadius: 22, overflow: 'hidden', cursor: 'pointer',
            background: 'linear-gradient(135deg,#F78FB0 0%,#E85C87 52%,#C93E6B 100%)',
            boxShadow: '0 14px 30px rgba(232,92,135,.4)',
          }}
        >
          {/* 装饰 */}
          <span style={{
            position: 'absolute', right: -16, top: -26, width: 118, height: 118, borderRadius: '50%',
            background: 'rgba(255,255,255,.13)',
          }} />
          <Icon name="dress" size={108} color="rgba(255,255,255,.16)" style={{ position: 'absolute', right: -14, bottom: -26, transform: 'rotate(-12deg)' }} />
          <Icon name="sparkle" size={22} color="rgba(255,255,255,.5)" style={{ position: 'absolute', right: 84, top: 16, transform: 'rotate(8deg)' }} />

          <div className="row" style={{ gap: 10, position: 'relative' }}>
            <span style={{
              width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="plus" size={19} color="#fff" />
            </span>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 19, fontWeight: 800 }}>创建新设计</div>
              <div style={{ fontSize: 11.5, opacity: .88, marginTop: 2 }}>参数化 · AI 辅助 · 3D 试衣 一步到位</div>
            </div>
          </div>

          {/* 品类快捷 chips */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 15, position: 'relative' }}>
            {CATS.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); pickCat(c); }}
                style={{
                  padding: '5.5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  color: '#fff', background: 'rgba(255,255,255,.2)',
                  border: '1px solid rgba(255,255,255,.34)',
                  transition: 'all .15s',
                }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- AI 创作入口 ---------- */}
        <button
          onClick={() => goAI()}
          className="row"
          style={{
            width: 'calc(100% - 32px)', margin: '14px 16px 0', padding: '13px 15px', gap: 12, textAlign: 'left',
            borderRadius: 18, color: '#fff',
            background: 'linear-gradient(120deg,#2E2638 0%,#4A3A5C 55%,#6B4A86 100%)',
            boxShadow: '0 10px 22px rgba(46,38,56,.3)',
          }}
        >
          <span style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--brand-grad)', boxShadow: '0 4px 12px rgba(232,92,135,.45)',
          }}>
            <Icon name="sparkle" size={19} />
          </span>
          <span className="flex-1" style={{ minWidth: 0 }}>
            <span className="row" style={{ fontSize: 14.5, fontWeight: 800, gap: 6, display: 'flex' }}>
              AI 灵感生成
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: 'rgba(255,255,255,.16)' }}>Beta</span>
            </span>
            <span style={{ display: 'block', fontSize: 11.5, opacity: .72, marginTop: 2 }}>输入一句话，5 款设计稿即刻呈现</span>
          </span>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="arrow-right" size={14} />
          </span>
        </button>

        {/* ---------- 热门模板 ---------- */}
        <div style={{ marginTop: 24, paddingLeft: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', paddingRight: 16 }}>
            <div className="row" style={{ gap: 7 }}>
              <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
              <span style={{ fontSize: 16, fontWeight: 800 }}>热门模板</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{TEMPLATES.length} 款 · 一键套用</span>
          </div>
          <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '12px 16px 4px 0' }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => goAI(t)}
                style={{ width: 150, flexShrink: 0, textAlign: 'left', background: '#fff', borderRadius: 16, padding: 8, boxShadow: '0 2px 8px rgba(40,25,32,.06)' }}
              >
                <div style={{ position: 'relative', height: 104, borderRadius: 11, overflow: 'hidden', background: 'var(--bg-deep)' }}>
                  <img src={t.preview} alt={t.title} loading="lazy" onError={onImgErr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{
                    position: 'absolute', left: 6, top: 6, fontSize: 9.5, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 99, color: '#fff', background: 'rgba(46,38,56,.55)',
                  }}>
                    {CATEGORY_LABELS[t.category]}
                  </span>
                </div>
                <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700, marginTop: 7 }}>{t.title}</div>
                <div className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{t.tagline}</div>
                <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <span className="row" style={{ gap: 4 }}>
                    {[t.color, t.accent].map((c) => (
                      <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(0,0,0,.08)', background: c }} />
                    ))}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand-deep)', background: 'var(--brand-soft)', padding: '3px 9px', borderRadius: 99 }}>
                    一键套用
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ---------- 灵感推荐流 ---------- */}
        <div style={{ marginTop: 22, padding: '0 16px' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 7 }}>
              <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
              <span style={{ fontSize: 16, fontWeight: 800 }}>灵感推荐流</span>
            </div>
            <span className="row" style={{ gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
              <Icon name="fire" size={12} color="var(--brand)" />来自设计师们的日常
            </span>
          </div>

          <div style={{ columnCount: 2, columnGap: 10, marginTop: 12 }}>
            {FEED.map((f) => {
              const author = userById(f.authorId);
              const fav = favs.includes(f.id);
              return (
                <div
                  key={f.id}
                  onClick={() => toggleFav(f.id)}
                  style={{ breakInside: 'avoid', marginBottom: 12, cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: 'var(--bg-deep)' }}>
                    <img src={f.src} alt={f.title} loading="lazy" onError={onImgErr} style={{ width: '100%', height: f.h, objectFit: 'cover' }} />
                    <span style={{
                      position: 'absolute', left: 7, top: 7, maxWidth: '88%',
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: f.hot ? '#fff' : 'var(--brand-deep)',
                      background: f.hot ? 'linear-gradient(135deg,#E85C87,#C93E6B)' : 'rgba(255,255,255,.92)',
                    }}>
                      {f.tag}
                    </span>
                  </div>
                  <div style={{ padding: '8px 2px 0' }}>
                    <div className="ellipsis-2" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>{f.title}</div>
                    <div className="row" style={{ justifyContent: 'space-between', marginTop: 7 }}>
                      <span className="row" style={{ gap: 5, minWidth: 0, flex: 1 }}>
                        <Avatar src={author.avatar} size={17} name={author.nickname} />
                        <span className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-2)' }}>@{author.nickname}</span>
                      </span>
                      <span className="row" style={{ gap: 3, fontSize: 10.5, fontWeight: 600, color: fav ? 'var(--brand)' : 'var(--text-3)', flexShrink: 0 }}>
                        <Icon name={fav ? 'heart-filled' : 'heart'} size={13} color={fav ? 'var(--brand)' : undefined} />
                        {fmtCnt(f.likes + (fav ? 1 : 0))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DesignTabBar active="home" />
    </>
  );
}
