/* ============ 织梦·设计 App · 我的作品 ============ */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { StatCell, Tag, EmptyState } from '../../components/ui';
import { useToast, Sheet, Segmented } from '../../components/Sheet';
import DesignTabBar from '../../components/design/DesignTabBar';
import DressCanvas from '../../components/design/DressCanvas';
import { useDesignWorks } from '../../utils/designStore';
import type { DesignWork } from '../../utils/designStore';

type Seg = 'all' | 'draft' | 'synced';
const SEG_OPTS: { value: Seg; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'synced', label: '已同步' },
];

export default function DesignWorksPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { works, update, remove } = useDesignWorks();

  const [seg, setSeg] = React.useState<Seg>('all');
  const [menu, setMenu] = React.useState<DesignWork | null>(null);
  const [confirm, setConfirm] = React.useState<DesignWork | null>(null);

  const syncedCount = works.filter((w) => w.status === 'synced').length;
  const aiCount = works.filter((w) => w.aiSource).length;
  const filtered = works.filter((w) => seg === 'all' || w.status === seg);

  const goEdit = (w: DesignWork) => navigate(`/design/studio?work=${w.id}`);
  const doSync = (w: DesignWork) => {
    update(w.id, { status: 'synced', syncedWorkId: 8000 + w.id });
    setMenu(null);
    toast('已同步，官方App「我的作品集」可见', 'check-circle');
  };
  const askDelete = (w: DesignWork) => {
    setMenu(null);
    setConfirm(w);
  };
  const doDelete = () => {
    if (confirm) {
      remove(confirm.id);
      toast(confirm.status === 'draft' ? '草稿已删除' : '作品已删除', 'trash');
    }
    setConfirm(null);
  };

  const menuActions: { icon: IconName; label: string; desc?: string; danger?: boolean; onClick: () => void }[] = [
    { icon: 'edit', label: '编辑作品', desc: '继续在创作工作台调整参数', onClick: () => { if (menu) goEdit(menu); setMenu(null); } },
  ];
  if (menu?.status === 'draft') {
    menuActions.splice(1, 0, {
      icon: 'upload', label: '同步至官方App', desc: '发布到官方App「我的作品集」', onClick: () => { if (menu) doSync(menu); },
    });
  }
  menuActions.push({ icon: 'trash', label: '删除作品', danger: true, onClick: () => { if (menu) askDelete(menu); } });

  return (
    <>
      <div className="page fade-in" style={{ paddingBottom: 150 }}>
        {/* ---------- 顶部标题 ---------- */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '18px 18px 6px' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: .2 }}>我的作品</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>本地创作 · 随时同步官方App</div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { toast('开始新设计', 'pen-tool'); navigate('/design/studio'); }}
          >
            <Icon name="plus" size={15} />新建设计
          </button>
        </div>

        <div style={{ padding: '6px 16px 0' }}>
          {/* ---------- 统计 ---------- */}
          <div className="card row" style={{ padding: '14px 4px' }}>
            <StatCell label="作品数" value={works.length} color="var(--text)" />
            <StatCell label="已同步" value={syncedCount} color="var(--success)" />
            <StatCell label="AI 生成" value={aiCount} color="var(--brand-deep)" />
          </div>

          {/* ---------- 筛选 ---------- */}
          <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
            <Segmented options={SEG_OPTS} value={seg} onChange={setSeg} equal />
          </div>

          {/* ---------- 作品网格 ---------- */}
          {works.length === 0 ? (
            <EmptyState
              icon="grid"
              title="还没有作品"
              desc="从首页挑一个模板，或直接开始你的第一件设计"
              action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/design/studio')}>
                  <Icon name="pen-tool" size={15} />去创作
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={seg === 'draft' ? 'edit' : 'check-circle'}
              title={seg === 'draft' ? '还没有草稿' : '还没有同步的作品'}
              desc={seg === 'draft' ? '创作中的设计会暂存在这里' : '把草稿同步到官方App，跨端作品集即可见'}
              action={
                seg === 'synced'
                  ? <button className="btn btn-outline btn-sm" onClick={() => setSeg('all')}>查看全部作品</button>
                  : <button className="btn btn-primary btn-sm" onClick={() => navigate('/design/studio')}><Icon name="pen-tool" size={15} />去创作</button>
              }
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              {filtered.map((w) => {
                const synced = w.status === 'synced';
                return (
                  <div key={w.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 8px rgba(40,25,32,.05)' }} onClick={() => goEdit(w)}>
                    {/* 缩略图：参数化服装渲染 */}
                    <div style={{
                      position: 'relative', aspectRatio: '3 / 4',
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(122,92,140,.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(122,92,140,.07) 0 1px, transparent 1px 22px)',
                      backgroundColor: '#FAF7F4',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, padding: '6px 10px 0' }}>
                        <DressCanvas params={w.params} uid={`dw-thumb-${w.id}`} />
                      </div>
                      {/* 状态角标 */}
                      <span style={{ position: 'absolute', left: 8, top: 8 }}>
                        {synced
                          ? <Tag variant="success" icon="check-circle">已同步官方App</Tag>
                          : <Tag variant="gray" icon="edit">草稿</Tag>}
                      </span>
                      {/* 菜单按钮 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenu(w); }}
                        style={{
                          position: 'absolute', right: 8, top: 8, width: 27, height: 27, borderRadius: '50%',
                          background: 'rgba(255,255,255,.92)', boxShadow: '0 2px 8px rgba(40,25,32,.14)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Icon name="more" size={15} color="var(--text-2)" />
                      </button>
                    </div>
                    {/* 底部信息 */}
                    <div style={{ padding: '9px 11px 11px' }}>
                      <div className="ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{w.title}</div>
                      <div className="row" style={{ justifyContent: 'space-between', gap: 6, marginTop: 6 }}>
                        <span className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', flex: 1, minWidth: 0 }}>
                          {w.updatedAt}{w.aiSource ? ` · ${w.aiSource}` : ''}
                        </span>
                        {synced && w.syncedWorkId !== undefined && (
                          <span className="row" style={{ gap: 2, fontSize: 10, color: 'var(--success)', flexShrink: 0 }}>
                            <Icon name="link" size={11} />#{w.syncedWorkId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- 跨端流转入口 ---------- */}
          {works.length > 0 && (
            <button
              className="row"
              onClick={() => navigate('/profile/works')}
              style={{ margin: '20px auto 0', gap: 5, fontSize: 12.5, color: 'var(--text-2)', padding: '8px 14px' }}
            >
              <Icon name="phone" size={14} color="var(--text-3)" />
              进入官方App · 我的作品集
              <Icon name="arrow-right" size={13} color="var(--text-3)" />
            </button>
          )}
        </div>
      </div>

      {/* ---------- 作品操作菜单 ---------- */}
      <Sheet open={!!menu} onClose={() => setMenu(null)} title="作品操作">
        <div style={{ paddingBottom: 8 }}>
          {menu && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              当前：「{menu.title}」· {menu.status === 'draft' ? '草稿，仅本地可见' : '已同步官方App'}
            </div>
          )}
          {menuActions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="row"
              style={{
                width: '100%', gap: 12, padding: '13px 4px', textAlign: 'left',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: a.danger ? 'var(--danger-soft)' : 'var(--bg-deep)',
              }}>
                <Icon name={a.icon} size={17} color={a.danger ? 'var(--danger)' : 'var(--text-2)'} />
              </span>
              <span className="flex-1" style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: a.danger ? 'var(--danger)' : 'var(--text)' }}>{a.label}</span>
                {a.desc && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{a.desc}</span>}
              </span>
              {a.danger && <Icon name="chevron-right" size={15} color="var(--danger)" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* ---------- 删除确认 ---------- */}
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="删除作品">
        <div style={{ textAlign: 'center', padding: '10px 6px 16px' }}>
          <div style={{
            width: 62, height: 62, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--danger-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="trash" size={27} color="var(--danger)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            确认删除「{confirm?.title || ''}」？
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>删除后不可恢复，请谨慎操作</div>
          <div className="row" style={{ gap: 10, marginTop: 20 }}>
            <button className="btn btn-outline flex-1" onClick={() => setConfirm(null)}>取消</button>
            <button className="btn btn-danger flex-1" onClick={doDelete}>
              <Icon name="trash" size={15} />确认删除
            </button>
          </div>
        </div>
      </Sheet>

      <DesignTabBar active="works" />
    </>
  );
}
