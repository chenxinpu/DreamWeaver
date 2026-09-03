/* ============ 织梦 · 我的作品集（含设计App联动） ============ */
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { EmptyState, StatCell, Tag } from '../../components/ui';
import NavBar from '../../components/NavBar';
import { useToast } from '../../components/Sheet';
import { me, worksByCreator } from '../../data/mock';
import { fmt, TapStyle, WorkCard } from './_shared';
import type { Work } from '../../data/types';
import { useDesignWorks } from '../../utils/designStore';
import DressCanvas from '../../components/design/DressCanvas';
import { openDesigner } from '../../utils/designerLink';
import { Sheet } from '../../components/Sheet';
import { useState } from 'react';
import type { DesignParams } from '../../data/design';

/** 小 KPI 条（写死合理演示值） */
const KPI = [
  { conv: 2.1, click: 7.9, rank: 87, ret: 5.6 },
  { conv: 1.8, click: 6.2, rank: 132, ret: 4.9 },
  { conv: 1.2, click: 4.5, rank: 205, ret: 2.8 },
];

export default function MyWorksPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const myWorks: Work[] = worksByCreator(me.id);
  const totalSales = myWorks.reduce((s, w) => s + w.sales, 0);
  const totalCollects = myWorks.reduce((s, w) => s + w.collects, 0);
  const { works: designWorks, save: saveDesign, update: updateDesign } = useDesignWorks();
  const syncedDesign = designWorks.filter((w) => w.status === 'synced');
  const [importOpen, setImportOpen] = useState(false);
  const [code, setCode] = useState('');

  const doImport = () => {
    try {
      const raw = decodeURIComponent(code.trim());
      const obj = JSON.parse(raw);
      if (obj.app !== 'dreamweaver-design' || !obj.params || !obj.params.category) throw new Error('bad');
      const pid = saveDesign(String(obj.title || '导入的设计稿'), obj.params as DesignParams, { aiSource: '设计App导入' });
      updateDesign(pid, { status: 'synced', syncedWorkId: 9000 + pid });
      setImportOpen(false); setCode('');
      toast('导入成功，已加入你的作品集', 'check');
    } catch {
      toast('同步码无效，请从设计师App重新复制');
    }
  };

  return (
    <div className="page no-tab" style={{ paddingBottom: 118 }}>
      <TapStyle />
      <NavBar back title="我的作品集" />
      <div className="page-body">
        {/* 设计App创作入口 */}
        <button
          onClick={() => openDesigner()}
          style={{
            width: '100%', display: 'block', padding: '13px 15px', borderRadius: 14, textAlign: 'left',
            background: 'linear-gradient(120deg,#2E2638 0%,#4A3A5C 60%,#6E4A7E 100%)', color: '#fff',
            boxShadow: '0 8px 20px rgba(46,38,56,.28)', marginBottom: 12,
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pen-tool" size={18} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>去「织梦·设计师App」创作新作品</div>
                <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2 }}>2D画布 · 素材库 · 3D模拟 · 工艺单（独立App，新窗口）</div>
              </div>
            </div>
            <Icon name="chevron-right" size={18} color="rgba(255,255,255,.8)" />
          </div>
        </button>

        {/* 顶部统计 */}
        <div className="card" style={{ padding: '14px 8px' }}>
          <div className="row">
            <StatCell label="作品数" value={myWorks.length + syncedDesign.length} />
            <StatCell label="总销量" value={fmt(totalSales)} />
            <StatCell label="总收藏" value={fmt(totalCollects)} />
          </div>
        </div>

        {/* 来自设计App的作品 */}
        {syncedDesign.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="pen-tool" size={15} color="var(--brand)" />来自设计App
              </div>
              <Tag variant="success" icon="check-circle">已同步</Tag>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {syncedDesign.map((w) => (
                <button
                  key={w.id}
                  onClick={() => openDesigner('/design/works')}
                  style={{ flexShrink: 0, width: 128, textAlign: 'left' }}
                >
                  <div style={{ width: 128, height: 168, borderRadius: 12, overflow: 'hidden', background: '#F0EBE6', border: '1px solid var(--line)' }}>
                    <DressCanvas params={w.params} uid={`mw-${w.id}`} style={{ width: 128, height: 168 }} />
                  </div>
                  <div className="ellipsis" style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{w.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{w.updatedAt}{w.aiSource ? ` · ${w.aiSource}` : ''}</div>
                </button>
              ))}
              <button
                onClick={() => openDesigner('/design/canvas')}
                style={{ flexShrink: 0, width: 128, height: 168, borderRadius: 12, border: '1.5px dashed var(--brand)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--brand-deep)', fontSize: 12.5, fontWeight: 600, background: 'var(--brand-soft)' }}
              >
                <Icon name="plus" size={22} />画布起稿
              </button>
            </div>
          </div>
        )}

        {/* 手打版/旧作品 */}
        {myWorks.length === 0 && syncedDesign.length === 0 ? (
          <EmptyState icon="store" title="还没有作品" desc="用设计App创作或直接发布你的作品，开启创作者之旅" action={
            <button className="btn btn-primary btn-sm" onClick={() => openDesigner()}>去设计师App创作</button>
          } />
        ) : myWorks.length > 0 ? (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 700, margin: '14px 0 8px' }}>我的作品</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {myWorks.map((w, i) => {
                const k = KPI[i % KPI.length];
                return (
                  <WorkCard
                    key={w.id}
                    work={w}
                    onClick={() => toast(`「${w.title}」详情（模拟）`)}
                    foot={
                      <>
                        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--text-3)' }}>
                          <span>转化 {k.conv}%</span>
                          <span>点击 {k.click}%</span>
                          <span>排名 {k.rank}</span>
                          <span>退货 {k.ret}%</span>
                        </div>
                        <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, 30 + i * 25)}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)' }} />
                        </div>
                      </>
                    }
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* 底部发布栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 60,
        padding: '10px 16px calc(var(--safe-bottom) + 10px)', background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid var(--line)',
      }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline flex-1" onClick={() => openDesigner('/design/canvas')}>
            <Icon name="pen-tool" size={15} /> 去设计师App
          </button>
          <button className="btn btn-ghost flex-1" style={{ color: 'var(--brand-deep)' }} onClick={() => setImportOpen(true)}>
            <Icon name="download" size={15} /> 导入设计稿
          </button>
          <button className="btn btn-primary flex-1" onClick={() => navigate('/plaza/publish')}>
            <Icon name="upload" size={16} /> 发布
          </button>
        </div>
        {/* 导入设计稿（从设计师App复制同步码） */}
        <Sheet open={importOpen} onClose={() => setImportOpen(false)} title="导入设计稿">
          <div style={{ paddingBottom: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              从<strong>织梦 · 设计师App</strong>的「作品详情 → 同步至官方App」复制同步码，粘贴到下方即可导入。
              <span style={{ color: 'var(--text-3)' }}>（正式版将自动云端同步）</span>
            </p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="粘贴同步码…"
              rows={5}
              style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid var(--line)', resize: 'vertical', fontSize: 11, fontFamily: 'monospace', background: 'var(--bg)' }}
            />
            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={doImport}>导入</button>
          </div>
        </Sheet>
      </div>
    </div>
  );
}
