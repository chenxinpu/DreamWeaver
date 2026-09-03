/* =========================================================
 * 织梦 · 服装设计师 App — 首页 / 项目中心（路由 /design）
 * 品牌区 → 双主入口卡 → 最近项目(3D稿×3 + 2D稿×2 混合)
 * → 模板速建 → AI 灵感工坊 → 本周趋势瀑布流 → 新手 3 步指南
 * ========================================================= */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';
import { Sheet, useToast } from '../../../components/Sheet';
import { SectionHeader, Tag } from '../../../components/ui';
import DesignerNav from '../../../components/design/DesignerNav';
import { CATEGORY_LABELS } from '../../../data/design';
import { useDesignWorks } from '../../../utils/designStore';
import type { DesignWork } from '../../../utils/designStore';
import { useSketchWorks } from '../../../utils/sketchStore';
import type { SketchWork } from '../../../data/sketchTypes';
import { K, isIn, toggleId } from '../../../utils/store';
import { Cover, WORKBENCH, isLight } from './parts';

/* ---------------- 常量与数据 ---------------- */

/** 2D 画稿模板 id → 中文名（画布模块按约定 id 提供模板） */
const TEMPLATE_LABELS: Record<string, string> = {
  'flat-dress': '连衣裙平铺', 'flat-skirt': '半裙平铺', 'flat-shirt': '衬衫平铺',
  'flat-pants': '裤装平铺', 'croquis-front': '人体模板 · 正面', 'croquis-back': '人体模板 · 背面',
};
const templateName = (id: string) => TEMPLATE_LABELS[id] || '画布模板';

/** 模板速建（稳妥方案：统一进画布选模板） */
const QUICK: { label: string; icon: IconName; grad: string; flip?: boolean }[] = [
  { label: '连衣裙', icon: 'dress', grad: 'linear-gradient(135deg,#F27BA0,#D44771)' },
  { label: '半裙', icon: 'skirt', grad: 'linear-gradient(135deg,#E4AE55,#C48A2A)' },
  { label: '衬衫', icon: 'tshirt', grad: 'linear-gradient(135deg,#7FA8D9,#4A78B5)' },
  { label: '裤装', icon: 'pants', grad: 'linear-gradient(135deg,#8FA3B8,#5C7189)' },
  { label: '人模正面', icon: 'user', grad: 'linear-gradient(135deg,#8D7CC0,#5B4791)' },
  { label: '人模背面', icon: 'user', grad: 'linear-gradient(135deg,#6E5AA8,#3C2E5E)', flip: true },
];

/** 本周趋势灵感（瀑布流 10 张） */
const TRENDS: { img: string; tag: string; h: number; likes: number }[] = [
  { img: 'style-01.jpg', tag: '法式碎花', h: 168, likes: 1280 },
  { img: 'dress-01.jpg', tag: '泡泡袖', h: 218, likes: 865 },
  { img: 'style-03.jpg', tag: '复古格纹', h: 150, likes: 1540 },
  { img: 'fabric-02.jpg', tag: '缎面光泽', h: 128, likes: 620 },
  { img: 'style-06.jpg', tag: '温柔针织', h: 190, likes: 998 },
  { img: 'dress-04.jpg', tag: '茶歇裙', h: 150, likes: 1430 },
  { img: 'style-09.jpg', tag: '极简通勤', h: 176, likes: 720 },
  { img: 'fabric-03.jpg', tag: '蕾丝细节', h: 122, likes: 356 },
  { img: 'style-12.jpg', tag: '优雅晚宴', h: 200, likes: 1890 },
  { img: 'dress-08.jpg', tag: '一字肩', h: 142, likes: 540 },
];

/** 新手 3 步指南 */
const STEPS: { no: string; icon: IconName; title: string; desc: string }[] = [
  { no: '01', icon: 'pen-tool', title: '画布起稿', desc: '选人体 / 平铺模板，手绘线条、区域填充上色，草稿自动保存在本地。' },
  { no: '02', icon: 'layers', title: '素材 · 3D 验证', desc: '素材库挑选面料图案；3D 模拟调节 18 类款式元素与版型，虚拟试衣验证。' },
  { no: '03', icon: 'receipt', title: '工艺单上线', desc: '一键生成工艺单并同步至官方 App，接单生产或上架售卖。' },
];

type RecentItem =
  | { kind: 'design'; w: DesignWork }
  | { kind: 'sketch'; w: SketchWork };

/* ---------------- 页面 ---------------- */
export default function HomePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { works: designWorks } = useDesignWorks();
  const { works: sketchWorks } = useSketchWorks();

  const [guide, setGuide] = useState(false);
  const [collected, setCollected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of TRENDS) init[t.img] = isIn(K.favs, `trend:${t.img}`);
    return init;
  });

  /** 最近项目：3D 稿前 3 + 2D 稿前 2，按时间粗略交错混合 */
  const recents = useMemo<RecentItem[]>(() => {
    const ds: RecentItem[] = designWorks.slice(0, 3).map((w) => ({ kind: 'design', w }));
    const ss: RecentItem[] = sketchWorks.slice(0, 2).map((w) => ({ kind: 'sketch', w }));
    const out: RecentItem[] = [];
    const n = Math.max(ds.length, ss.length);
    for (let i = 0; i < n; i++) { if (ds[i]) out.push(ds[i]); if (ss[i]) out.push(ss[i]); }
    return out;
  }, [designWorks, sketchWorks]);

  const onRecent = (it: RecentItem) => {
    if (it.kind === 'design') {
      navigate(`/design/works/${(it.w as DesignWork).id}`);
    } else {
      const s = it.w as SketchWork;
      navigate(`/design/canvas/edit?template=${s.templateId}&id=${s.id}`);
    }
  };

  const onTrend = (t: (typeof TRENDS)[number]) => {
    const now = toggleId(K.favs, `trend:${t.img}`);
    setCollected((p) => ({ ...p, [t.img]: now }));
    toast(now ? '已收藏灵感' : '已取消收藏', now ? 'heart-filled' : 'heart');
  };

  const openAi = (mode: 'gen' | 'fusion') => {
    if (mode === 'gen') toast('AI 灵感工作台已就绪', 'sparkle');
    else toast('已打开 AI 工作台 · 草图优化也可在 2D 画布使用', 'image');
    navigate('/design/studio?ai=1');
  };

  /* ---------- 顶栏装饰圆（玫瑰粉 / 深紫氛围） ---------- */
  const decor = (
    <>
      <div style={{ position: 'absolute', top: -46, right: -34, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,92,135,.18), rgba(232,92,135,0) 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 96, left: -52, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,90,168,.13), rgba(110,90,168,0) 70%)', pointerEvents: 'none' }} />
    </>
  );

  return (
    <div className="page" style={{ paddingBottom: 'calc(104px + var(--safe-bottom))' }}>
      {/* ============ 品牌区 ============ */}
      <div style={{ padding: '18px 16px 4px', position: 'relative', overflow: 'hidden' }}>
        {decor}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 14px rgba(232,92,135,.35)' }}>
              <Icon name="dress" size={19} />
            </span>
            <span style={{ lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>织梦 · 设计师</span>
              <span style={{ display: 'block', fontSize: 8.5, letterSpacing: 2.2, color: 'var(--text-3)' }}>DESIGNER STUDIO</span>
            </span>
          </div>
          <button
            onClick={() => setGuide(true)}
            className="row"
            style={{ gap: 5, padding: '7px 12px', borderRadius: 99, background: '#fff', border: '1px solid var(--line)', boxShadow: '0 2px 10px rgba(90,60,100,.06)', fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}
          >
            <Icon name="help-circle" size={14} color="var(--brand)" />新手指南
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: .5 }}>开始今天的创作 ✦</div>
          <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            手绘模板 · 素材库 · 3D 验证 · 工艺单 —— 从灵感草稿到成衣上线，一站完成
          </div>
        </div>

        {/* ============ 双主入口卡 ============ */}
        <div className="row" style={{ gap: 12, marginTop: 16, alignItems: 'stretch' }}>
          {([
            { icon: 'pen-tool' as IconName, grad: 'var(--brand-grad)', title: '2D 画布', desc: '在人体模板上画设计稿', hint: '手绘 · 区域上色 · 标注', to: '/design/canvas' },
            { icon: 'dress' as IconName, grad: WORKBENCH, title: '3D 模拟', desc: '参数化建模 · 试衣验证', hint: '18 类元素 · 面料物理', to: '/design/sim3d' },
          ]).map((e) => (
            <button
              key={e.title}
              onClick={() => navigate(e.to)}
              className="card"
              style={{ flex: 1, padding: '13px 13px 11px', textAlign: 'left', display: 'flex', flexDirection: 'column', minHeight: 150 }}
            >
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ width: 42, height: 42, borderRadius: 13, background: e.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 14px rgba(80,50,110,.2)' }}>
                  <Icon name={e.icon} size={21} />
                </span>
                <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                  <Icon name="arrow-right" size={13} />
                </span>
              </span>
              <span style={{ marginTop: 12, fontSize: 15.5, fontWeight: 800 }}>{e.title}</span>
              <span style={{ marginTop: 3, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{e.desc}</span>
              <span className="flex-1" />
              <span style={{ marginTop: 8, fontSize: 10, color: e.icon === 'dress' ? '#7A66B8' : 'var(--brand-deep)', fontWeight: 700 }}>{e.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============ 最近项目 ============ */}
      <div style={{ padding: '14px 16px 0' }}>
        <SectionHeader
          title="最近项目"
          extra="查看全部"
          onClick={() => navigate('/design/works')}
        />

        {recents.length === 0 ? (
          <div style={{ border: '1.5px dashed var(--line)', borderRadius: 18, padding: '30px 16px 26px', textAlign: 'center', background: 'rgba(255,255,255,.65)' }}>
            <span style={{ width: 52, height: 52, margin: '0 auto', borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
              <Icon name="pen-tool" size={24} />
            </span>
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>还没有作品</div>
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-3)' }}>用画布或 3D 模拟创建第一个作品</div>
            <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm btn-outline" onClick={() => navigate('/design/canvas')}><Icon name="pen-tool" size={14} />去 2D 画布</button>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/design/sim3d')}><Icon name="dress" size={14} />去 3D 模拟</button>
            </div>
          </div>
        ) : (
          recents.map((it) => {
            if (it.kind === 'design') {
              const w = it.w as DesignWork;
              const status = w.status === 'synced' ? '已同步' : '草稿';
              return (
                <button key={`d${w.id}`} onClick={() => onRecent(it)} style={{ width: '100%', textAlign: 'left' }} className="card fade-in">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10 }}>
                    <span style={{ position: 'relative', width: 52, height: 58, borderRadius: 12, background: w.params.color || '#F5EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLight(w.params.color || '#fff') ? 'rgba(74,58,99,.55)' : 'rgba(255,255,255,.92)', flexShrink: 0 }}>
                      <Icon name="dress" size={23} />
                      {w.aiSource && (
                        <span style={{ position: 'absolute', right: 3, bottom: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A23F' }}>
                          <Icon name="sparkle" size={10} />
                        </span>
                      )}
                    </span>
                    <span className="flex-1" style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
                      <span className="row" style={{ gap: 5, marginTop: 6 }}>
                        <Tag variant="primary">3D</Tag>
                        {w.aiSource && <Tag variant="gold">AI</Tag>}
                        <Tag variant={w.status === 'synced' ? 'success' : 'gray'}>{status}</Tag>
                      </span>
                      <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--text-3)' }}>
                        {CATEGORY_LABELS[w.params.category]} · {w.updatedAt}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} color="var(--text-3)" />
                  </span>
                </button>
              );
            }
            const s = it.w as SketchWork;
            return (
              <button key={`s${s.id}`} onClick={() => onRecent(it)} style={{ width: '100%', textAlign: 'left' }} className="card fade-in">
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10 }}>
                  <span style={{ width: 52, height: 58, borderRadius: 12, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flexShrink: 0 }}>
                    <Icon name="pen-tool" size={23} />
                  </span>
                  <span className="flex-1" style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                    <span className="row" style={{ gap: 5, marginTop: 6 }}>
                      <Tag variant="line">画稿</Tag>
                      {s.aiSource && <Tag variant="gold">AI</Tag>}
                    </span>
                    <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--text-3)' }}>
                      {templateName(s.templateId)} · {s.updatedAt}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={16} color="var(--text-3)" />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* ============ 模板速建 ============ */}
      <div style={{ padding: '14px 0 0 16px' }}>
        <SectionHeader title="模板速建" />
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 16px 10px 0', scrollbarWidth: 'none' }}>
          {QUICK.map((q) => (
            <button
              key={q.label}
              onClick={() => { toast('已进入画布，选择模板开始', 'pen-tool'); navigate('/design/canvas'); }}
              style={{ flexShrink: 0, width: 66, textAlign: 'center' }}
            >
              <span style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 18, background: q.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 14px rgba(80,50,110,.16)' }}>
                <span style={{ display: 'flex', transform: q.flip ? 'scaleX(-1)' : undefined }}><Icon name={q.icon} size={24} /></span>
              </span>
              <span style={{ display: 'block', marginTop: 7, fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============ AI 灵感工坊（深色渐变卡） ============ */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ background: WORKBENCH, borderRadius: 22, padding: '17px 16px 13px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <Icon name="sparkle" size={110} style={{ position: 'absolute', right: -18, top: -24, opacity: .07 }} />
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={17} color="#FFD98A" />
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>AI 灵感工坊</span>
            <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: '#FFD98A', border: '1px solid rgba(255,217,138,.55)', borderRadius: 99, padding: '2px 8px', lineHeight: 1.4 }}>BETA</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.6, color: 'rgba(255,255,255,.68)' }}>
            输入一句描述或给一张参考图，AI 先把灵感变成可编辑的 3D 参数稿
          </div>
          {([
            { key: 'gen' as const, icon: 'sparkle' as IconName, grad: 'var(--brand-grad)', title: '文字生成设计', sub: '3D 参数稿 · 一次 5 款候选' },
            { key: 'fusion' as const, icon: 'image' as IconName, grad: 'linear-gradient(135deg,#7FA8D9,#4A78B5)', title: '参考图 / 草图 → 风格融合', sub: '参考图转风格款 · 一键应用' },
          ]).map((a) => (
            <button
              key={a.key}
              onClick={() => openAi(a.key)}
              className="row fade-in"
              style={{ width: '100%', marginTop: 10, padding: '11px 12px', borderRadius: 14, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', textAlign: 'left', gap: 11 }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 11, background: a.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,.18)', flexShrink: 0 }}>
                <Icon name={a.icon} size={18} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{a.title}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 10.5, color: 'rgba(255,255,255,.55)' }}>{a.sub}</span>
              </span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.45)', display: 'flex' }}><Icon name="arrow-right" size={16} /></span>
            </button>
          ))}
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
            AI 用于生成灵感初稿 · 最终请在 2D 画布 / 3D 模拟中精修细节
          </div>
        </div>
      </div>

      {/* ============ 本周趋势灵感瀑布流 ============ */}
      <div style={{ padding: '16px 16px 0' }}>
        <SectionHeader title="本周趋势灵感" extra="来自设计社区" />
        <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
          {[0, 1].map((col) => (
            <div key={col} className="flex-1 col" style={{ gap: 10 }}>
              {TRENDS.map((t, i) => {
                if (i % 2 !== col) return null;
                const fav = !!collected[t.img];
                return (
                  <button
                    key={t.img}
                    onClick={() => onTrend(t)}
                    style={{ width: '100%', textAlign: 'left' }}
                    className="fade-in"
                  >
                    <span className="card" style={{ display: 'block', padding: 5, borderRadius: 16 }}>
                      <span style={{ position: 'relative', display: 'block' }}>
                        <Cover src={`/images/${t.img}`} style={{ width: '100%', height: t.h }} radius={12} icon="dress" />
                        <span
                          style={{
                            position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
                            background: fav ? 'var(--brand-grad)' : 'rgba(255,255,255,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: fav ? '#fff' : 'var(--text-3)', boxShadow: '0 2px 8px rgba(0,0,0,.16)',
                          }}
                        >
                          <Icon name={fav ? 'heart-filled' : 'heart'} size={14} />
                        </span>
                      </span>
                      <span className="row" style={{ padding: '7px 5px 4px', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-deep)' }}># {t.tag}</span>
                        <span className="row" style={{ gap: 3, fontSize: 10, color: 'var(--text-3)' }}>
                          <Icon name="heart" size={11} />{(t.likes / 1000).toFixed(1)}k
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ============ 新手 3 步指南横卡 ============ */}
        <button onClick={() => setGuide(true)} className="card row fade-in" style={{ width: '100%', margin: '14px 0 6px', padding: '13px 14px', gap: 12, textAlign: 'left' }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: WORKBENCH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <Icon name="book" size={19} />
          </span>
          <span className="flex-1" style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>新手 3 步指南</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-3)' }}>画布起稿 → 素材 / 3D 验证 → 工艺单上线</span>
          </span>
          <Icon name="chevron-right" size={17} color="var(--text-3)" />
        </button>
      </div>

      {/* ============ 新手指南 Sheet ============ */}
      <Sheet open={guide} onClose={() => setGuide(false)} title="新手 3 步指南">
        <div style={{ paddingBottom: 22 }}>
          {STEPS.map((s, i) => (
            <div key={s.no} className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '12px 0' }}>
              <span
                style={{
                  width: 44, height: 44, borderRadius: 14, background: i === 2 ? WORKBENCH : 'var(--brand-grad)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 6px 14px rgba(232,92,135,.25)',
                }}
              >
                <Icon name={s.icon} size={20} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-deep)', letterSpacing: .5 }}>STEP {s.no}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{s.title}</span>
                </span>
                <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</span>
              </span>
            </div>
          ))}
          <div style={{ margin: '6px 0 2px', padding: '12px 14px', borderRadius: 14, background: 'var(--brand-soft)', fontSize: 12, color: 'var(--brand-deep)', lineHeight: 1.7 }}>
            💡 小提示：AI 生成的灵感初稿，可以一键「应用到 3D 模拟」继续精修，或回到画布手绘完善细节。
          </div>
        </div>
      </Sheet>

      <DesignerNav />
    </div>
  );
}
