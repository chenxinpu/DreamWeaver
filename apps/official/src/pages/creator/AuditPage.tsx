/* ============================================================================
 * /creator/audit 审核演示（auditor / admin 专属）
 * 后端无全量橱窗接口（GET /creator/window 只返回本人）——但窗口详情对审核员开放。
 * 演示实现：通过 /dev/info 获取窗口总数后，逐个 GET /creator/window/:id 枚举全平台橱窗，
 * 筛出 status=submitted 的待审队列，对任意一条执行强制审核（通过→生成商品；驳回→回草稿）。
 * 若队列为空：提示先以创作者 id=1 提交一条橱窗材料再切回审核员演示。
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { User, WindowMaterial } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { Modal, WindowBadge, CState, Loading, fmtDT } from './_shared';

export default function AuditPage() {
  const toast = useToast();
  const { user } = useMe();
  const [scanning, setScanning] = React.useState(false);
  const [queue, setQueue] = React.useState<WindowMaterial[]>([]);
  const [creators, setCreators] = React.useState<User[]>([]);
  const [action, setAction] = React.useState<{ w: WindowMaterial; pass: boolean } | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ at: string; w: WindowMaterial; pass: boolean; product?: { id: number; title: string } | null }[]>([]);

  const nicknameOf = (id?: number) => creators.find((c) => c.id === id)?.nickname || `创作者 #${id ?? '?'}`;

  const scan = React.useCallback(async (silent?: boolean) => {
    setScanning(!silent);
    try {
      const [info, users] = await Promise.all([
        api.dev.info(),
        api.admin.userList().catch(() => null),
      ]);
      if (users?.list) setCreators(users.list);
      const total = info?.entities?.windows ?? 0;
      const all: WindowMaterial[] = [];
      // 窗口 id 自增且无删除，1..total 即全量；分小块并行获取
      const CHUNK = 8;
      for (let i = 1; i <= total; i += CHUNK) {
        const ids: number[] = [];
        for (let k = i; k < Math.min(i + CHUNK, total + 1); k++) ids.push(k);
        const rs = await Promise.all(ids.map((id) => api.window.get(id).catch(() => null)));
        for (const r of rs) if (r) all.push(r);
      }
      setQueue(all.filter((w) => w.status === 'submitted'));
      if (!silent) toast(`已扫描 ${total} 个橱窗，其中待审核 ${all.filter((w) => w.status === 'submitted').length} 条`);
    } catch (e) {
      toast((e as Error).message || '扫描失败');
    } finally {
      setScanning(false);
    }
  }, [toast]);

  React.useEffect(() => { scan(); }, [scan]);

  const runForce = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const r = await api.admin.windowForce(action.w.id, action.pass, action.pass ? undefined : note || undefined);
      const text = action.pass
        ? `已通过 #${action.w.id}「${action.w.productName}」→ 商品 #${r.product?.id}「${r.product?.title}」已生成上架`
        : `已驳回 #${action.w.id}「${action.w.productName}」，创作者将收到通知补齐材料`;
      toast(text, 'check');
      setDone((d) => [{ at: new Date().toISOString(), w: action.w, pass: action.pass, product: r.product }, ...d]);
      setAction(null);
      setNote('');
      scan(true);
    } catch (e) {
      toast((e as Error).message || '强制审核失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="c-card">
        <div className="c-card-hd">
          <span className="c-card-title">平台审核 · 审核演示</span>
          <div className="row" style={{ gap: 8 }}>
            <span className="c-pill">{user?.nickname}（{user?.role === 'auditor' ? '审核员' : '管理员'}）</span>
            <button className="c-btn c-btn-sm c-btn-outline" onClick={() => scan()} disabled={scanning}>
              <Icon name="refresh" size={13} />{scanning ? '扫描中…' : '重新扫描'}
            </button>
          </div>
        </div>
        <div className="c-notice info">
          <Icon name="shield" size={15} />
          <span>
            演示说明：后端暂无「全量橱窗列表」接口（GET /creator/window 只返回本人材料），但窗口详情对审核员开放。
            本页通过窗口总数枚举全平台橱窗并筛出 <b>submitted</b> 待审队列；对任意一条可执行
            <b>强制审核</b>：通过 → AI 生成商品并上架；驳回 → 状态回草稿并通知创作者。
          </span>
        </div>
        <div className="c-notice warn" style={{ marginTop: 8 }}>
          <Icon name="clock" size={14} />
          <span>若无待审窗口：先以创作者「小织 #1」在橱窗页提交一条材料（保存并提交审核），再切回审核员刷新。</span>
        </div>
      </div>

      {/* 待审队列 */}
      {scanning && <div className="c-card" style={{ marginTop: 12 }}><Loading text="正在扫描全平台橱窗…" /></div>}
      {!scanning && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <div className="c-card-hd">
            <span className="c-card-title">待审核队列</span>
            <span className="c-pill">{queue.length} 条 submitted</span>
          </div>
          {!queue.length && (
            <CState icon="shield" title="暂无待审橱窗材料"
              desc="系统每日 00:05 会自动审核；日常通过创作者提交后这里会即时出现待办。也可按上方提示先让创作者提交一条来演示。" />
          )}
          {queue.map((w) => (
            <div key={w.id} className="audit-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0 }}>
                {(w as { work?: { cover?: string } }).work?.cover
                  ? <img src={imgSafe((w.work as { cover: string }).cover)} onError={hideBadImg} alt="" style={{ width: 74, height: 96, objectFit: 'cover', borderRadius: 10 }} />
                  : <div style={{ width: 74, height: 96, borderRadius: 10, background: '#F1F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B7BCC6' }}><Icon name="tshirt" size={22} /></div>}
              </div>
              <div className="flex-1" style={{ minWidth: 320 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }}>#{w.id} {w.productName}</b>
                  <WindowBadge status={w.status} />
                  <span className="c-badge c-badge-gray">{w.category}</span>
                </div>
                <div className="c-hint" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.8 }}>
                  创作者：{nicknameOf(w.creatorId)} · 更新 {fmtDT(w.updatedAt || w.createdAt)} ·
                  图 {w.photos?.length || 0} · 面料 {w.partsFabric?.length || 0} · 尺码 {w.spec?.sizeChart?.length || 0} 档 ·
                  3D {w.modelMatIds?.length || 0} · 打版 {w.patternMatIds?.length || 0} ·
                  价格 ¥{w.price || 0} · 基础费 ¥{w.baseFee || 0}
                </div>
                {w.partsFabric?.length > 0 && (
                  <div className="c-chips" style={{ marginTop: 5 }}>
                    {w.partsFabric.map((p, i) => <span key={i} className="c-pill">{p.part} · {p.fabric}</span>)}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#A8AEB8', marginTop: 4 }}>
                  作品「{(w.work as { title?: string } | undefined)?.title || w.productName}」
                  {(w.spec?.sizeChart || []).map((r) => r.size).join(' / ')} 各码段均已录入
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button className="c-btn c-btn-success c-btn-sm" onClick={() => { setAction({ w, pass: true }); setNote(''); }}><Icon name="check" size={13} />通过并上架</button>
                <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { setAction({ w, pass: false }); setNote(''); }}><Icon name="close" size={13} />驳回</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 最近处理 */}
      {done.length > 0 && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <div className="c-card-hd"><span className="c-card-title">本次会话处理记录</span><span className="c-pill">{done.length} 条</span></div>
          {done.map((d, i) => (
            <div key={i} className="audit-row">
              <span className={`c-badge ${d.pass ? 'c-badge-green' : 'c-badge-red'}`}>{d.pass ? '通过' : '驳回'}</span>
              <span className="flex-1" style={{ fontSize: 12.5 }}>
                #{d.w.id}「{d.w.productName}」
                {d.pass && d.product ? <> → 商品 #{d.product.id}「{d.product.title}」已上架</> : ' → 已通知创作者补材料'}
              </span>
              <span style={{ fontSize: 10.5, color: '#A8AEB8' }}>{fmtDT(d.at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 审核操作弹窗 */}
      {action && (
        <Modal narrow onClose={() => setAction(null)} title={action.pass ? `通过 #${action.w.id}？` : `驳回 #${action.w.id}？`} icon="shield"
          foot={<>
            <button className="c-btn c-btn-outline" onClick={() => setAction(null)}>取消</button>
            <button className={`c-btn ${action.pass ? 'c-btn-success' : 'c-btn-danger'}`} disabled={busy} onClick={runForce}>
              {busy ? '提交中…' : action.pass ? '确认通过' : '确认驳回'}
            </button>
          </>}
        >
          {action.pass ? (
            <div className="c-hint">
              <b>「{action.w.productName}」材料</b>将标记为 approved，系统按规则自动生成<b> AI 商品详情页并上架商城</b>（覆盖演示的种子商品逻辑），随后通知创作者。
            </div>
          ) : (
            <>
              <div className="c-hint" style={{ marginBottom: 8 }}>驳回后状态将回到草稿（draft），创作者收到通知补齐材料。可填写审核意见：</div>
              <textarea className="c-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：实拍图过曝，请补充自然光下的正面/背面穿搭图（选填）" />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
