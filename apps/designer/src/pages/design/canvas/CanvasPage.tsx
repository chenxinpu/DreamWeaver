/* ============ 设计画布 · 模板选择 / 草稿列表（/design/canvas） ============ */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { Sheet, Segmented, useToast } from '../../../components/Sheet';
import { EmptyState } from '../../../components/ui';
import DesignerNav from '../../../components/design/DesignerNav';
import { DRAFT_KEY, KIND_LABEL, TEMPLATES, VIEW_LABEL, templateById } from '../../../data/sketchTemplates';
import type { SketchWork } from '../../../data/sketchTypes';
import { useSketchWorks } from '../../../utils/sketchStore';
import { MiniTemplate, TemplatePreview } from './parts';

type TabKey = 'person' | 'flat' | 'draft';

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: 'person', label: '人体模板' },
  { value: 'flat', label: '平铺模板' },
  { value: 'draft', label: '我的草稿' },
];

function readDraftInfo(): { title: string; templateId?: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { title?: string; templateId?: string };
    if (!d.title && !d.templateId) return null;
    return { title: d.title || '未命名草稿', templateId: d.templateId };
  } catch { return null; }
}

export default function CanvasPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { works, remove, save } = useSketchWorks();
  const [tab, setTab] = React.useState<TabKey>('person');
  const [draft] = React.useState(readDraftInfo);
  const [moreWork, setMoreWork] = React.useState<SketchWork | null>(null);

  const goEdit = (templateId: string, id?: number) => {
    const q = id != null ? `?template=${templateId}&id=${id}` : `?template=${templateId}`;
    navigate(`/design/canvas/edit${q}`);
  };

  const templateList = TEMPLATES.filter((t) => (tab === 'person' ? t.kind === 'croquis' : t.kind === 'flat'));

  return (
    <div className="page" style={{ paddingBottom: 'calc(var(--tab-h) + var(--safe-bottom) + 96px)' }}>
      {/* 顶部标题 */}
      <div style={{ padding: '20px 16px 6px' }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 15, background: 'var(--brand-grad)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px rgba(232,92,135,.35)',
          }}>
            <Icon name="pen-tool" size={23} />
          </div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>设计画布</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 1 }}>选择人体模板或平铺模板开始绘制</div>
          </div>
        </div>
      </div>

      {/* 分段 */}
      <div style={{ padding: '14px 16px 4px' }}>
        <Segmented options={TAB_OPTIONS} value={tab} onChange={(v) => setTab(v)} equal />
      </div>

      {/* 未完成草稿续画横幅 */}
      {draft && (
        <button
          onClick={() => navigate('/design/canvas/edit')}
          className="row fade-in"
          style={{
            margin: '10px 16px 0', padding: '10px 12px', borderRadius: 14,
            background: 'var(--brand-soft)', color: 'var(--brand-deep)', gap: 8, width: 'calc(100% - 32px)',
          }}
        >
          <Icon name="clock" size={16} />
          <span className="flex-1 ellipsis" style={{ fontSize: 13, textAlign: 'left' }}>
            发现未完成的草稿「{draft.title}」
            {draft.templateId && templateById(draft.templateId) ? `（${templateById(draft.templateId)!.name}）` : ''} → 继续绘制
          </span>
          <Icon name="chevron-right" size={15} />
        </button>
      )}

      {/* 模板 / 草稿内容 */}
      <div style={{ padding: '12px 16px 8px' }}>
        {tab !== 'draft' ? (
          <div className="col" style={{ gap: 12 }}>
            {templateList.map((t) => (
              <button key={t.id} onClick={() => goEdit(t.id)} className="card row fade-in" style={{
                padding: 12, gap: 14, textAlign: 'left', width: '100%', alignItems: 'center',
                border: '1px solid transparent', transition: 'border .15s',
              }}>
                <div style={{
                  width: 88, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                  background: '#fff', border: '1px solid var(--line)',
                  display: 'flex', justifyContent: 'center', padding: '4px 0',
                }}>
                  <MiniTemplate template={t} width={70} />
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <span className="tag tag-primary">{KIND_LABEL[t.kind]}</span>
                    <span className="tag tag-gray">{VIEW_LABEL[t.view]}</span>
                    <span className="tag tag-line">{t.regions.length} 个填充区</span>
                  </div>
                  <div className="ellipsis-2 text-3" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>{t.hint}</div>
                </div>
                <Icon name="chevron-right" size={18} color="var(--text-3)" />
              </button>
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="pen-tool"
              title="还没有草稿，选个模板开始吧"
              desc="人体模板上直接描服装，或从平铺模板开始填色"
              action={
                <button className="btn btn-primary btn-sm" onClick={() => setTab('person')} style={{ height: 38, padding: '0 22px' }}>
                  <Icon name="plus" size={16} /> 选择模板
                </button>
              }
            />
          </div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {works.map((w) => {
              const tp = templateById(w.templateId);
              return (
                <button key={w.id} onClick={() => goEdit(w.templateId, w.id)} className="card row fade-in" style={{
                  padding: 10, gap: 12, textAlign: 'left', width: '100%',
                }}>
                  <div style={{
                    borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                    background: '#fff', border: '1px solid var(--line)', padding: '3px 2px',
                  }}>
                    <TemplatePreview work={w} width={64} />
                  </div>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 14.5, fontWeight: 700 }}>{w.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                      {tp ? tp.name : '未知模板'} · {w.strokes.length} 笔触 · {w.fills.length} 填充
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>更新于 {w.updatedAt}</div>
                  </div>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setMoreWork(w); }}
                    style={{ padding: 6, color: 'var(--text-3)', display: 'flex' }}
                  >
                    <Icon name="more" size={20} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 草稿 · 更多操作 */}
      <Sheet open={!!moreWork} onClose={() => setMoreWork(null)} title="草稿操作">
        <div className="col" style={{ paddingBottom: 8 }}>
          {moreWork && (
            <div className="row" style={{ gap: 10, padding: '2px 2px 12px' }}>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)', padding: 3 }}>
                <TemplatePreview work={moreWork} width={48} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis bold" style={{ fontSize: 14 }}>{moreWork.title}</div>
                <div className="text-3" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {templateById(moreWork.templateId)?.name || '未知模板'}
                </div>
              </div>
            </div>
          )}
          <MenuRow icon="copy" label="另存为新稿" desc="复制当前内容生成一份新草稿" onClick={() => {
            if (!moreWork) return;
            save({
              title: `${moreWork.title} 副本`,
              templateId: moreWork.templateId,
              strokes: moreWork.strokes,
              fills: moreWork.fills,
              annots: moreWork.annots,
            });
            setMoreWork(null);
            toast('已另存为新稿', 'check');
          }} />
          <MenuRow icon="trash" label="删除草稿" danger onClick={() => {
            if (!moreWork) return;
            remove(moreWork.id);
            setMoreWork(null);
            toast('草稿已删除', 'check');
          }} />
        </div>
      </Sheet>

      <DesignerNav />
    </div>
  );
}

function MenuRow({ icon, label, desc, danger, onClick }: {
  icon: 'copy' | 'trash'; label: string; desc?: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="row" style={{
      width: '100%', gap: 12, padding: '13px 4px', borderTop: '1px solid var(--line)',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? 'var(--danger-soft)' : 'var(--bg-deep)', color: danger ? 'var(--danger)' : 'var(--text-2)',
      }}>
        <Icon name={icon} size={19} />
      </span>
      <span style={{ textAlign: 'left', flex: 1 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--danger)' : 'var(--text)' }}>{label}</span>
        {desc && <span className="text-3" style={{ display: 'block', fontSize: 11.5 }}>{desc}</span>}
      </span>
    </button>
  );
}
