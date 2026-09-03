/* =========================================================
 * 作品管理 WorksPage（路由 /design/works）
 * 3D 参数稿 + 2D 画稿 混合管理（Segmented 过滤 / 卡片菜单 / 删除确认）
 * ========================================================= */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';
import { Segmented, Sheet, useToast } from '../../../components/Sheet';
import { EmptyState, Tag } from '../../../components/ui';
import DesignerNav from '../../../components/design/DesignerNav';
import DressCanvas from '../../../components/design/DressCanvas';
import { CATEGORY_LABELS } from '../../../data/design';
import type { SketchWork } from '../../../data/sketchTypes';
import { useDesignWorks } from '../../../utils/designStore';
import type { DesignWork } from '../../../utils/designStore';
import { useSketchWorks } from '../../../utils/sketchStore';

type TabKey = 'all' | 'd3' | 'sketch';
interface Item { kind: 'd3' | 'sketch'; id: number; title: string }
interface MenuState { kind: 'd3' | 'sketch'; id: number; title: string }
interface DelState { kind: 'd3' | 'sketch'; id: number; title: string }

/* ---------- 状态 Tag ---------- */
function StatusTag({ w }: { w: DesignWork }) {
  return w.status === 'synced'
    ? <Tag variant="success" icon="check-circle">已同步</Tag>
    : <Tag variant="gold" icon="clock">草稿</Tag>;
}

/* =========================================================
 * 主页面
 * ========================================================= */
export default function WorksPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { works, remove } = useDesignWorks();
  const { works: sketchWorks, remove: removeSketch } = useSketchWorks();

  const [tab, setTab] = useState<TabKey>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [del, setDel] = useState<DelState | null>(null);

  const d3Items: Item[] = works.map((w) => ({ kind: 'd3' as const, id: w.id, title: w.title }));
  const skItems: Item[] = sketchWorks.map((w) => ({ kind: 'sketch' as const, id: w.id, title: w.title }));
  const shown = tab === 'all' ? [...d3Items, ...skItems] : tab === 'd3' ? d3Items : skItems;

  const editSketch = (w: SketchWork) => {
    navigate(`/design/canvas/edit?template=${w.templateId}&id=${w.id}`);
  };

  const goItem = (it: Item) => {
    if (it.kind === 'd3') navigate(`/design/works/${it.id}`);
    else {
      const w = sketchWorks.find((x) => x.id === it.id);
      if (w) editSketch(w);
    }
  };

  const confirmDel = () => {
    if (!del) return;
    if (del.kind === 'd3') remove(del.id);
    else removeSketch(del.id);
    toast(`已删除「${del.title}」`);
    setDel(null);
  };

  const menuWork3d = works.find((w) => w.id === menu?.id && menu?.kind === 'd3');
  const menuWork2d = sketchWorks.find((w) => w.id === menu?.id && menu?.kind === 'sketch');

  const MenuAction = ({ icon, label, danger, onClick }: { icon: IconName; label: string; danger?: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="row"
      style={{ width: '100%', gap: 10, padding: '13px 4px', fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--danger)' : 'var(--text)', borderBottom: '1px solid var(--line)' }}
    >
      <Icon name={icon} size={18} color={danger ? 'var(--danger)' : 'var(--brand)'} />{label}
    </button>
  );

  return (
    <div className="page no-tab" style={{ paddingBottom: 150 }}>
      {/* ===== 顶部标题 ===== */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 2px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: .5 }}>我的作品</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
              3D 参数稿 {works.length} 件 · 2D 画稿 {sketchWorks.length} 件
            </div>
          </div>
          <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />新建
          </button>
        </div>
      </div>

      {/* ===== Segmented 过滤 ===== */}
      <div style={{ padding: '14px 16px 4px' }}>
        <Segmented<TabKey>
          options={[
            { value: 'all', label: `全部 ${d3Items.length + skItems.length}` },
            { value: 'd3', label: `3D参数稿 ${d3Items.length}` },
            { value: 'sketch', label: `2D画稿 ${skItems.length}` },
          ]}
          value={tab}
          onChange={(v) => { setTab(v); toast(v === 'all' ? '已显示全部作品' : v === 'd3' ? '已筛选：3D 参数稿' : '已筛选：2D 画稿'); }}
          equal
        />
      </div>

      {/* ===== 列表 ===== */}
      <div style={{ padding: '12px 16px 0' }}>
        {shown.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            {tab === 'sketch' ? (
              <EmptyState
                icon="pen-tool"
                title="还没有 2D 画稿"
                desc="去 2D 画布自由手绘，支持人体模板与区域填色"
                action={<button onClick={() => navigate('/design/canvas')} className="btn btn-primary">去画布创作</button>}
              />
            ) : tab === 'd3' ? (
              <EmptyState
                icon="dress"
                title="还没有 3D 参数稿"
                desc="在参数化建模中完成的设计会自动收入这里"
                action={<button onClick={() => navigate('/design/studio')} className="btn btn-primary">去3D建模</button>}
              />
            ) : (
              <EmptyState
                icon="grid"
                title="还没有作品"
                desc="从 2D 画布或 3D 参数化建模开始你的第一件设计"
                action={
                  <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                    <button onClick={() => navigate('/design/canvas')} className="btn btn-outline">去画布</button>
                    <button onClick={() => navigate('/design/studio')} className="btn btn-primary">去3D建模</button>
                  </div>
                }
              />
            )}
          </div>
        ) : (
          shown.map((it) => (
            it.kind === 'd3'
              ? (() => {
                const w = works.find((x) => x.id === it.id);
                if (!w) return null;
                return (
                  <div key={`d3-${w.id}`} onClick={() => goItem(it)} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex' }}>
                    {/* 缩略：DressCanvas 白底 */}
                    <div style={{ width: 100, flexShrink: 0, background: '#FDFCFA', padding: '10px 8px 0', borderRight: '1px solid var(--line)' }}>
                      <DressCanvas params={w.params} uid={`w3d-${w.id}`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, padding: '12px 4px 12px 12px' }}>
                      <div className="ellipsis" style={{ fontSize: 14.5, fontWeight: 800 }}>{w.title}</div>
                      <div className="row" style={{ gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        {w.aiSource
                          ? <Tag variant="primary" icon="sparkle">{w.aiSource}</Tag>
                          : <Tag variant="line">{CATEGORY_LABELS[w.params.category]}</Tag>}
                        <StatusTag w={w} />
                      </div>
                      <div className="row" style={{ gap: 5, marginTop: 9, fontSize: 10.5, color: 'var(--text-3)' }}>
                        <Icon name="clock" size={12} />
                        <span className="ellipsis">{w.updatedAt}</span>
                      </div>
                    </div>
                    <button
                      aria-label="更多操作"
                      onClick={(e) => { e.stopPropagation(); setMenu({ kind: 'd3', id: w.id, title: w.title }); }}
                      style={{ alignSelf: 'flex-start', padding: 14, color: 'var(--text-3)' }}
                    >
                      <Icon name="more" size={19} />
                    </button>
                  </div>
                );
              })()
              : (() => {
                const w = sketchWorks.find((x) => x.id === it.id);
                if (!w) return null;
                return (
                  <div key={`sk-${w.id}`} onClick={() => goItem(it)} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex' }}>
                    {/* 2D 缩略：图标色块（strokes 渲染在画布模块，这里仅占位） */}
                    <div style={{ width: 100, flexShrink: 0, background: 'linear-gradient(160deg,#FBE9F0,#F6E4EC)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(232,92,135,.2)' }}>
                        <Icon name="pen-tool" size={19} />
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--brand-deep)', fontWeight: 600 }}>2D 画稿</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, padding: '12px 4px 12px 12px' }}>
                      <div className="ellipsis" style={{ fontSize: 14.5, fontWeight: 800 }}>{w.title}</div>
                      <div className="row" style={{ gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        <Tag variant="info" icon="pen-tool">2D 画稿</Tag>
                        {w.techpack && <Tag variant="gold" icon="receipt">已出工艺单</Tag>}
                      </div>
                      <div className="row" style={{ gap: 5, marginTop: 9, fontSize: 10.5, color: 'var(--text-3)' }}>
                        <Icon name="clock" size={12} />
                        <span className="ellipsis">{w.updatedAt}</span>
                      </div>
                    </div>
                    <button
                      aria-label="更多操作"
                      onClick={(e) => { e.stopPropagation(); setMenu({ kind: 'sketch', id: w.id, title: w.title }); }}
                      style={{ alignSelf: 'flex-start', padding: 14, color: 'var(--text-3)' }}
                    >
                      <Icon name="more" size={19} />
                    </button>
                  </div>
                );
              })()
          ))
        )}
        {shown.length > 0 && (
          <div style={{ textAlign: 'center', padding: '18px 0 6px', fontSize: 11.5, color: 'var(--text-3)' }}>
            在 Studio / 画布中保存的设计稿会自动出现在这里
          </div>
        )}
      </div>

      {/* ===== 新建 Sheet ===== */}
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="新建作品">
        <div style={{ paddingBottom: 26 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => { setNewOpen(false); navigate('/design/canvas'); }} className="col" style={{ gap: 10, padding: '24px 10px', borderRadius: 16, border: '1px solid var(--line)', background: '#FBF9FA', alignItems: 'center' }}>
              <span style={{ width: 48, height: 48, borderRadius: 15, background: 'linear-gradient(135deg,#F3B8CB,#E85C87)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.3)' }}>
                <Icon name="pen-tool" size={22} />
              </span>
              <b style={{ fontSize: 14.5 }}>去画布</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>2D 自由手绘 · 模板描画</span>
            </button>
            <button onClick={() => { setNewOpen(false); navigate('/design/studio'); }} className="col" style={{ gap: 10, padding: '24px 10px', borderRadius: 16, border: '1px solid rgba(232,92,135,.35)', background: 'var(--brand-soft)', alignItems: 'center' }}>
              <span style={{ width: 48, height: 48, borderRadius: 15, background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.3)' }}>
                <Icon name="dress" size={22} />
              </span>
              <b style={{ fontSize: 14.5 }}>去3D建模</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>参数化建模 · AI 辅助</span>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5, color: 'var(--text-3)' }}>保存后的作品将统一收录到「我的作品」</div>
        </div>
      </Sheet>

      {/* ===== 卡片菜单 Sheet ===== */}
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.title || ''}>
        <div style={{ paddingBottom: 22 }}>
          {menu?.kind === 'd3' && menuWork3d ? (
            <>
              <MenuAction icon="edit" label="编辑参数" onClick={() => { const m = menu; setMenu(null); navigate(`/design/studio?work=${m.id}`); }} />
              <MenuAction icon="receipt" label="生成工艺单 → 作品详情" onClick={() => { const m = menu; setMenu(null); navigate(`/design/works/${m.id}`); }} />
              <MenuAction icon="trash" label="删除" danger onClick={() => { setDel({ ...menu }); setMenu(null); }} />
            </>
          ) : menu?.kind === 'sketch' && menuWork2d ? (
            <>
              <MenuAction icon="edit" label="继续绘制" onClick={() => { setMenu(null); editSketch(menuWork2d); }} />
              <MenuAction icon="trash" label="删除" danger onClick={() => { setDel({ ...menu }); setMenu(null); }} />
            </>
          ) : null}
        </div>
      </Sheet>

      {/* ===== 删除确认 Sheet ===== */}
      <Sheet open={!!del} onClose={() => setDel(null)} title="删除作品">
        <div style={{ paddingBottom: 24 }}>
          <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <span style={{ width: 58, height: 58, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={26} />
            </span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>确认删除「{del?.title}」？</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>删除后不可恢复，请谨慎操作</div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 20 }}>
            <button onClick={() => setDel(null)} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
            <button onClick={confirmDel} className="btn btn-danger" style={{ flex: 1 }}>确认删除</button>
          </div>
        </div>
      </Sheet>

      <DesignerNav />
    </div>
  );
}
