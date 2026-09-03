/* =========================================================
 * 作品详情 + 工艺单 WorksDetailPage（路由 /design/works/:id）
 * 3D 参数稿：预览 / 参数清单 / 同步码 / 工艺单 Tech Pack（生成式）
 * 2D 画稿 id：识别后提供「去画布继续」占位（工艺单以 3D 稿为主）
 * ========================================================= */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';
import NavBar from '../../../components/NavBar';
import { Sheet, useToast } from '../../../components/Sheet';
import { EmptyState, Tag } from '../../../components/ui';
import DressCanvas from '../../../components/design/DressCanvas';
import {
  APPLICABLE, CATEGORY_LABELS, FABRICS, GROUP_LABELS, LENGTH_LABEL, OPTIONS, PATTERNS,
} from '../../../data/design';
import type { DesignParams, GroupKey } from '../../../data/design';
import { buildTechpack } from '../../../data/techpack';
import type { TechPack } from '../../../data/techpack';
import { useDesignWorks } from '../../../utils/designStore';
import { useSketchWorks } from '../../../utils/sketchStore';
import { DEFAULT_BODY, K, useBody } from '../../../utils/store';
import type { BodyMeasurement } from '../../../data/types';
import { SyncCodeSheet, makeSyncCode } from './parts';

const tpKey = (id: number) => `zm_tp_${id}`;

const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

const optLabel = (g: GroupKey, v: string) => OPTIONS[g]?.find((o) => o.v === v)?.label || '—';
const patternLabel = (v: string) => PATTERNS.find((p) => p.v === v)?.label || v;

/* ---------- 表格基础样式 ---------- */
const TH: React.CSSProperties = {
  padding: '7px 8px', fontSize: 11, fontWeight: 800, background: '#FBF0F4', color: 'var(--brand-deep)',
  borderBottom: '1px solid rgba(232,92,135,.28)', textAlign: 'left', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  padding: '7px 8px', fontSize: 11.5, color: 'var(--text-2)', borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};

/* =========================================================
 * 工艺单（Tech Pack）视图
 * ========================================================= */
function TechPackCard({ tp, params, styleNo, updatedAt, hasBody, onExport }: {
  tp: TechPack; params: DesignParams; styleNo: string; updatedAt: string; hasBody: boolean; onExport: () => void;
}) {
  return (
    <div className="card fade-in" style={{ padding: 14, marginTop: 12, border: '1px solid rgba(201,162,63,.35)', overflow: 'hidden' }}>
      {/* 头部：款号 + 导出 */}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--gold-soft)', color: '#9A7A1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="receipt" size={16} />
          </span>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>工艺单 Tech Pack</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>可直接对接织梦柔性工厂排产</div>
          </div>
        </div>
        <button onClick={onExport} className="btn btn-outline btn-sm">
          <Icon name="download" size={13} />导出
        </button>
      </div>

      {/* 款式信息头：款式图 + 款号 + 日期 */}
      <div className="row" style={{ marginTop: 12, padding: 10, background: 'var(--bg)', borderRadius: 12, gap: 10, alignItems: 'stretch' }}>
        <div style={{ width: 64, height: 100, flexShrink: 0, background: '#fff', borderRadius: 8, padding: '6px 4px 0', overflow: 'hidden' }}>
          <DressCanvas params={params} uid={`tp-${styleNo}`} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="ellipsis" style={{ fontSize: 16, fontWeight: 800 }}>{tp.title}</div>
          <div className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{tp.categoryLabel} · {tp.styleSummary}</div>
          <div className="row" style={{ gap: 12, marginTop: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>款号</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-deep)', letterSpacing: .5 }}>{styleNo}</span>
            <span className="row" style={{ gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
              <Icon name="calendar" size={12} />{updatedAt}
            </span>
          </div>
        </div>
      </div>

      {/* 1. BOM */}
      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <Icon name="layers" size={14} color="var(--brand)" /><b style={{ fontSize: 13 }}>物料清单 BOM</b>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
            <thead>
              <tr>
                <th style={TH}>物料</th><th style={TH}>规格</th><th style={TH}>用量</th>
              </tr>
            </thead>
            <tbody>
              {tp.bom.map((b, i) => (
                <tr key={`${b.name}-${i}`}>
                  <td style={TD}><b style={{ color: 'var(--text)' }}>{b.name}</b></td>
                  <td style={TD}>{b.spec}</td>
                  <td style={TD}>{b.qty || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. 尺寸表 */}
      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <Icon name="ruler" size={14} color="var(--brand)" /><b style={{ fontSize: 13 }}>尺寸表（cm）</b>
          {hasBody ? <Tag variant="success" icon="user-filled">一人一版</Tag> : <Tag variant="gray">基础码</Tag>}
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
            <thead>
              <tr>
                <th style={TH}>码数</th><th style={TH}>胸围</th><th style={TH}>腰围</th><th style={TH}>臀围</th><th style={TH}>备注</th>
              </tr>
            </thead>
            <tbody>
              {tp.sizes.map((s) => (
                <tr key={s.label} style={s.label === 'M' ? { background: '#FDF9EF' } : undefined}>
                  <td style={{ ...TD, fontWeight: 800, color: s.label === 'M' ? '#9A7A1E' : 'var(--text)' }}>{s.label}</td>
                  <td style={TD}>{s.bust}</td>
                  <td style={TD}>{s.waist}</td>
                  <td style={TD}>{s.hip}</td>
                  <td style={{ ...TD, color: '#9A7A1E' }}>{s.remark || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
          {hasBody ? '基准码 M 已按你的体型生成「一人一版」，工厂按此放码。' : '当前为基础码，建议先在官方App录入体型，生成一人一版基准尺寸。'}
        </div>
      </div>

      {/* 3. 规格 */}
      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <Icon name="note" size={14} color="var(--brand)" /><b style={{ fontSize: 13 }}>规格说明</b>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {tp.spec.map((s) => (
            <div key={s.label} className="row" style={{ justifyContent: 'space-between', gap: 8, padding: '7px 10px', background: 'var(--bg)', borderRadius: 8, fontSize: 11.5 }}>
              <span style={{ color: 'var(--text-3)' }}>{s.label}</span>
              <span style={{ fontWeight: 700, textAlign: 'right' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 工艺步骤 */}
      <div style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <Icon name="scissors" size={14} color="var(--brand)" /><b style={{ fontSize: 13 }}>工艺步骤</b>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '4px 12px' }}>
          {tp.process.map((p, i) => (
            <div key={i} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: i < tp.process.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ lineHeight: 1.6 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 备注 + 底部 */}
      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--gold-soft)', fontSize: 11.5, color: '#8A5A00', lineHeight: 1.8 }}>
        <Icon name="note" size={12} /> {tp.note}
      </div>
      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 10.5, color: 'var(--text-3)' }}>
        工艺单可直接对接织梦柔性工厂排产 · 支持修改参数后重新生成
      </div>
    </div>
  );
}

/* =========================================================
 * 主页面
 * ========================================================= */
export default function WorksDetailPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const idNum = Number(id);
  const { works, update, remove } = useDesignWorks();
  const { works: sketchWorks } = useSketchWorks();
  const [body] = useBody();

  const work = works.find((w) => w.id === idNum);
  const sketch = !work ? sketchWorks.find((s) => s.id === idNum) : undefined;

  const [showModel, setShowModel] = useState(true);
  const [tpOn, setTpOn] = useState<boolean>(() => {
    try { return localStorage.getItem(tpKey(idNum)) === '1'; } catch { return false; }
  });
  const [paramsOpen, setParamsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const hasBody = hasBodyData(body);
  const tp = useMemo<TechPack | null>(() => (
    work ? buildTechpack(work.title, work.params, hasBody ? body : null) : null
  ), [work, body, hasBody]);

  const generateTp = () => {
    if (!work) return;
    setTpOn(true);
    try { localStorage.setItem(tpKey(work.id), '1'); } catch { /* ignore */ }
    toast('工艺单已生成，可导出对接柔性工厂', 'check');
  };

  const exportTp = () => toast('工艺单已导出 PDF（模拟）', 'download');

  const doDelete = () => {
    if (!work) return;
    remove(work.id);
    setDelOpen(false);
    toast(`已删除「${work.title}」`);
    navigate('/design/works');
  };

  const syncDone = () => {
    if (!work) return;
    update(work.id, { status: 'synced' });
    setSyncOpen(false);
    toast('已确认导入 · 作品状态更新为已同步', 'check');
  };

  const ActionRow = ({ icon, label, danger, onClick, primary }: { icon: IconName; label: string; danger?: boolean; onClick: () => void; primary?: boolean }) => (
    <button
      onClick={onClick}
      className="row"
      style={{
        flex: 1, gap: 5, padding: '11px 0', borderRadius: 11, justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
        color: danger ? 'var(--danger)' : primary ? '#fff' : 'var(--text-2)',
        background: danger ? 'var(--danger-soft)' : primary ? 'var(--brand-grad)' : 'var(--bg)',
        boxShadow: primary ? '0 4px 12px rgba(232,92,135,.3)' : 'none',
        minWidth: 0,
      }}
    >
      <Icon name={icon} size={14} />{label}
    </button>
  );

  /* ============ 2D 画稿占位 ============ */
  if (sketch) {
    return (
      <div className="page no-tab" style={{ paddingBottom: 110 }}>
        <NavBar back backTo="/design/works" title={sketch.title} />
        <div className="page-body" style={{ paddingTop: 8 }}>
          <div className="card" style={{ padding: '36px 22px', textAlign: 'center' }}>
            <span style={{ width: 74, height: 74, margin: '0 auto 16px', borderRadius: 22, background: 'linear-gradient(160deg,#FBE9F0,#F4DFE9)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pen-tool" size={34} />
            </span>
            <div style={{ fontSize: 16.5, fontWeight: 800 }}>{sketch.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.8 }}>
              这是一件 <b>2D 画稿</b>（模板 {sketch.templateId}）<br />2D 笔触渲染在画布模块中完成
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 6, margin: '12px 0 2px' }}>
              <Tag variant="info" icon="pen-tool">2D 画稿</Tag>
              <Tag variant="gray" icon="clock">{sketch.updatedAt}</Tag>
            </div>
            <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'var(--brand-soft)', fontSize: 11.5, color: 'var(--brand-deep)', lineHeight: 1.7 }}>
              工艺单（Tech Pack）以 3D 参数稿为主；2D 画稿可先在画布中完成，再转 3D 参数化建模。
            </div>
          </div>
        </div>
        {/* 底部操作栏 */}
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 60, background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--line)', padding: '10px 16px calc(var(--safe-bottom) + 10px)' }}>
          <button onClick={() => navigate(`/design/canvas/edit?template=${sketch.templateId}&id=${sketch.id}`)} className="btn btn-primary btn-block">
            <Icon name="pen-tool" size={16} />去画布继续绘制
          </button>
        </div>
      </div>
    );
  }

  /* ============ 未找到 ============ */
  if (!work) {
    return (
      <div className="page no-tab" style={{ paddingBottom: 60 }}>
        <NavBar back backTo="/design/works" title="作品详情" />
        <div className="page-body">
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            <EmptyState
              icon="help-circle"
              title="未找到该作品"
              desc="作品可能已被删除，返回作品列表看看吧"
              action={<button onClick={() => navigate('/design/works')} className="btn btn-primary">返回我的作品</button>}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ============ 3D 参数稿详情 ============ */
  const fab = FABRICS.find((f) => f.id === work.params.fabric) || FABRICS[0];
  const groups = APPLICABLE[work.params.category];
  const code = makeSyncCode(work.title, work.params);
  const styleNo = `DM-${String(work.id).padStart(4, '0')}`;

  const menuItems: { icon: IconName; label: string; onClick: () => void; danger?: boolean }[] = [
    { icon: 'edit', label: '编辑参数', onClick: () => { setMenuOpen(false); navigate(`/design/studio?work=${work.id}`); } },
    { icon: 'receipt', label: tpOn ? '查看工艺单' : '生成工艺单', onClick: () => { setMenuOpen(false); if (!tpOn) generateTp(); else toast('工艺单已生成，可导出对接工厂', 'receipt'); } },
    { icon: 'send', label: '同步至官方App', onClick: () => { setMenuOpen(false); setSyncOpen(true); } },
    { icon: 'trash', label: '删除作品', danger: true, onClick: () => { setMenuOpen(false); setDelOpen(true); } },
  ];

  return (
    <div className="page no-tab" style={{ paddingBottom: 92 }}>
      {/* ===== 顶部 NavBar ===== */}
      <NavBar
        back
        backTo="/design/works"
        title={work.title}
        right={
          <button aria-label="更多操作" onClick={() => setMenuOpen(true)} style={{ padding: 6 }}>
            <Icon name="more" size={21} color="var(--text-2)" />
          </button>
        }
      />

      <div className="page-body" style={{ paddingTop: 6 }}>
        {/* ===== 预览区 ===== */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px 0' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="dress" size={15} />
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>款式预览</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>参数化 3D 渲染</div>
              </div>
            </div>
            <button
              onClick={() => { setShowModel(!showModel); toast(showModel ? '已隐藏虚拟人台' : '已显示虚拟人台'); }}
              className="row"
              style={{ gap: 6, padding: '5px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: showModel ? '#fff' : 'var(--text-2)', background: showModel ? 'var(--brand-grad)' : 'var(--bg-deep)', boxShadow: showModel ? '0 3px 10px rgba(232,92,135,.3)' : 'none' }}
            >
              <Icon name="user" size={13} />{showModel ? '虚拟人台 开' : '虚拟人台 关'}
            </button>
          </div>

          <div style={{ height: 330, padding: '14px 40px 8px', background: 'linear-gradient(178deg,#F4EEF6 0%, #FBF9FA 60%, #FFFFFF 100%)' }}>
            <DressCanvas
              params={work.params}
              body={hasBody ? { height: body.height, bust: body.bust, waist: body.waist, hip: body.hip } : null}
              showModel={showModel}
              uid={`det-${work.id}`}
            />
          </div>

          {/* 规格摘要条 */}
          <div className="row" style={{ gap: 0, borderTop: '1px solid var(--line)', background: '#FDFCFA' }}>
            {[
              { label: '品类', value: CATEGORY_LABELS[work.params.category] },
              { label: '面料', value: fab.name },
              { label: '长度', value: `${work.params.lengthCm}cm` },
            ].map((c) => (
              <div key={c.label} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRight: '1px solid var(--line)' }}>
                <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 800 }}>{c.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
            <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px' }}>
              <div className="row" style={{ justifyContent: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: work.params.color, border: '1px solid rgba(0,0,0,.12)', display: 'inline-block' }} />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{work.params.color}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>主色</div>
            </div>
          </div>

          <div className="row" style={{ gap: 6, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
            {work.aiSource && <Tag variant="primary" icon="sparkle">{work.aiSource}</Tag>}
            <Tag variant="line">{CATEGORY_LABELS[work.params.category]}</Tag>
            <Tag variant="gray" icon="clock">{work.updatedAt}</Tag>
            {work.status === 'synced'
              ? <Tag variant="success" icon="check-circle">已同步官方App</Tag>
              : <Tag variant="gold" icon="clock">草稿</Tag>}
          </div>
        </div>

        {/* ===== 工艺单（生成后出现） ===== */}
        {tpOn && tp && (
          <TechPackCard
            tp={tp}
            params={work.params}
            styleNo={styleNo}
            updatedAt={work.updatedAt}
            hasBody={hasBody}
            onExport={exportTp}
          />
        )}

        {/* ===== 完整参数清单（折叠） ===== */}
        <div className="card" style={{ marginTop: 12, overflow: 'hidden' }}>
          <button className="row" style={{ width: '100%', justifyContent: 'space-between', padding: '13px 14px' }} onClick={() => setParamsOpen(!paramsOpen)}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--bg-deep)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="note" size={16} />
              </span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>完整参数清单</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{groups.length} 类款式元素 · {fab.name} · {patternLabel(work.params.pattern)}</div>
              </div>
            </div>
            <Icon name={paramsOpen ? 'chevron-down' : 'chevron-right'} size={18} color="var(--text-3)" />
          </button>

          {paramsOpen && (
            <div style={{ padding: '2px 14px 12px' }}>
              {/* 面料/配色一览 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '9px 10px' }}>
                  <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 800 }}>{fab.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{fab.weight}</div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '9px 10px' }}>
                  <div className="row" style={{ gap: 5 }}>
                    <span style={{ width: 13, height: 13, borderRadius: 4, background: work.params.color, border: '1px solid rgba(0,0,0,.12)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>主色</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{work.params.color}</div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '9px 10px' }}>
                  <div className="row" style={{ gap: 5 }}>
                    <span style={{ width: 13, height: 13, borderRadius: 4, background: work.params.accent, border: '1px solid rgba(0,0,0,.12)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>图案/辅色</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{patternLabel(work.params.pattern)}</div>
                </div>
              </div>

              {/* APPLICABLE 组 label: value */}
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                {groups.map((g, i) => {
                  const isLen = g === 'length';
                  const value: ReactNode = isLen
                    ? <>{work.params.lengthCm}cm <span style={{ color: 'var(--text-3)' }}>· {LENGTH_LABEL(work.params.category, work.params.lengthCm)}</span></>
                    : optLabel(g, String(work.params[g]));
                  return (
                    <div key={g} className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: i % 2 === 0 ? '#fff' : '#FDFBF8', borderBottom: i < groups.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{GROUP_LABELS[g]}</span>
                      <span className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700, maxWidth: '62%' }}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ===== 操作按钮行 ===== */}
        {!tpOn && (
          <div style={{ marginTop: 12 }}>
            <div style={{ padding: '11px 13px', borderRadius: 12, background: 'var(--gold-soft)', fontSize: 11.5, color: '#8A5A00', lineHeight: 1.8, marginBottom: 10 }}>
              <Icon name="receipt" size={12} /> 生成工艺单后，可查看 BOM / 尺寸表 / 工艺步骤，并导出对接织梦柔性工厂排产。
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <ActionRow icon="edit" label="编辑参数" onClick={() => navigate(`/design/studio?work=${work.id}`)} />
          <ActionRow icon="receipt" label={tpOn ? '查看工艺单' : '生成工艺单'} primary onClick={() => { if (!tpOn) generateTp(); else exportTp(); }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <ActionRow icon="send" label="同步至官方App" onClick={() => setSyncOpen(true)} />
          <ActionRow icon="trash" label="删除" danger onClick={() => setDelOpen(true)} />
        </div>
      </div>

      {/* ===== 底部固定操作栏 ===== */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430,
        zIndex: 60, background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--line)', padding: '10px 16px calc(var(--safe-bottom) + 10px)',
      }}>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => navigate(`/design/studio?work=${work.id}`)} className="btn btn-outline" style={{ flex: 1, fontSize: 13.5 }}>
            <Icon name="edit" size={15} />编辑
          </button>
          <button onClick={() => { if (!tpOn) generateTp(); else exportTp(); }} className="btn btn-primary" style={{ flex: 1.25, fontSize: 13.5 }}>
            <Icon name="receipt" size={15} />{tpOn ? '导出工艺单' : '生成工艺单'}
          </button>
          <button onClick={() => setSyncOpen(true)} className="btn" style={{ flex: 1, fontSize: 13.5, background: 'var(--gold)', color: '#fff' }}>
            <Icon name="send" size={14} />同步官方
          </button>
        </div>
      </div>

      {/* ===== 右上菜单 ===== */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={work.title}>
        <div style={{ paddingBottom: 22 }}>
          {menuItems.map((m) => (
            <button key={m.label} onClick={m.onClick} className="row" style={{
              width: '100%', gap: 10, padding: '13px 4px', fontSize: 14.5, fontWeight: 600,
              color: m.danger ? 'var(--danger)' : 'var(--text)', borderBottom: '1px solid var(--line)',
            }}>
              <Icon name={m.icon} size={18} color={m.danger ? 'var(--danger)' : 'var(--brand)'} />{m.label}
            </button>
          ))}
        </div>
      </Sheet>

      {/* ===== 同步码 Sheet ===== */}
      <SyncCodeSheet open={syncOpen} onClose={() => setSyncOpen(false)} code={code} designTitle={work.title} onImportDone={syncDone} />

      {/* ===== 删除确认 ===== */}
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="删除作品">
        <div style={{ paddingBottom: 24 }}>
          <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <span style={{ width: 58, height: 58, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={26} />
            </span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>确认删除「{work.title}」？</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6 }}>删除后不可恢复，请谨慎操作</div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 20 }}>
            <button onClick={() => setDelOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
            <button onClick={doDelete} className="btn btn-danger" style={{ flex: 1 }}>确认删除</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
