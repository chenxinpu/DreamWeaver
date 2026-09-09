/* ============================================================================
 * /c/pool 创作者中心 · 资源池（移动版）
 * 规则一句话 + 「立即评估」按钮（api.dev.evalPool）+ 上次执行；
 * 入池条目列表：作品标题/封面/达标原因/达标值/入池时间 + 下游状态与 CTA
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { PoolEntry } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { useAsync, WindowBadge, fmtDT, Loading } from './bits';
import { MEmpty, MCardHd } from './bits';

export default function MPoolPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useMe();
  const { data, loading, error, reload } = useAsync(() => api.pool.creatorPool(), []);
  const entries = data?.list || [];
  const meta = data?.meta;

  const [evaling, setEvaling] = React.useState(false);
  const [flash, setFlash] = React.useState<PoolEntry[]>([]);

  const evalNow = async () => {
    setEvaling(true);
    try {
      const r = await api.dev.evalPool();
      const mine = (r.added || []).filter((e) => e.creatorId === user?.id);
      toast(`引擎评估完成：共评估 ${r.evaluated ?? '—'} 篇，其中新增入池 ${mine.length} 条`, mine.length > 0 ? 'check' : undefined);
      setFlash(mine);
      reload();
    } catch (e) {
      toast((e as Error).message || '评估失败');
    } finally {
      setEvaling(false);
    }
  };

  const reasonTone = (r: string) => (r.includes('评论') ? 'c-badge-blue' : r.includes('点赞') ? 'c-badge-brand' : 'c-badge-gold');

  return (
    <div>
      {/* 规则 + 操作 */}
      <div className="mc-card">
        <MCardHd icon="grid" title="资源池 · 市场认可作品"
          right={meta?.lastEval ? <span className="c-pill"><Icon name="clock" size={11} />上次 {fmtDT(meta.lastEval)}</span> : undefined} />
        <div className="mc-note brand">
          <Icon name="megaphone" size={15} />
          <span>
            {meta?.engine || '当日全平台推文点赞升序取 P60，点赞超过 P60 或评论数 ≥10 即自动纳入本池'}
            {(meta?.rule || []).length > 0 && <span style={{ display: 'block', marginTop: 3, opacity: .85 }}>规则：{meta?.rule?.join('；')}</span>}
          </span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="c-btn c-btn-primary" style={{ height: 40, flex: 1, borderRadius: 12 }} disabled={evaling} onClick={evalNow}>
            <Icon name="refresh" size={14} />{evaling ? '评估中…' : '立即评估（引擎按今日 P60 重跑）'}
          </button>
        </div>
        <div className="mc-sub" style={{ marginTop: 6 }}>评估后新增条目即时出现在下方；入池作品会自动收到「准备橱窗材料」通知。</div>
      </div>

      {/* 本次新增闪烁 */}
      {flash.length > 0 && (
        <div className="mc-card" style={{ marginTop: 10, borderColor: '#E8B9CB' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="mc-hd-title" style={{ fontSize: 13.5 }}>🎉 本次新增 {flash.length} 条</div>
            <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setFlash([])}>收起</button>
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7180', lineHeight: 1.9, marginTop: 4 }}>
            {flash.map((f) => `post#${f.postId}（${(f.reason || '').split(' / ').join('、')}）`).join('；')}
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading && <div className="mc-card" style={{ marginTop: 10 }}><Loading /></div>}
      {!loading && error && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="grid" title="资源池加载失败" desc={error}
            action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重新加载</button>} />
        </div>
      )}
      {!loading && !error && !entries.length && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="grid" title="资源池暂时为空"
            desc="发布推文并让它获得超过当日 P60 的点赞，或 ≥10 条评论，即可自动入池。也可点上方「立即评估」试跑引擎。" />
        </div>
      )}

      {entries.map((e: PoolEntry) => {
        const workTitle = e.work?.title || e.post?.content?.slice(0, 40) || `推文 #${e.postId}`;
        const cover = e.work?.cover || (e.post as { images?: string[] } | null)?.images?.[0] || '';
        const hasWork = !!e.workId;
        const windowed = !!e.windowStatus;
        const producted = !!e.productId;
        return (
          <div key={e.id} className="mc-card" style={{ marginTop: 10, padding: 12 }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              {cover ? (
                <img src={imgSafe(cover)} alt="" onError={hideBadImg} style={{ width: 62, height: 78, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 62, height: 78, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(140deg,#FBE4EC,#F6C9D8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C96' }}>
                  <Icon name="grid" size={26} />
                </div>
              )}
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }} className="ellipsis">{workTitle}</b>
                  {e.work?.category && <span className="c-badge c-badge-brand">{e.work.category}</span>}
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                  <span className={`c-badge ${reasonTone(e.reason || '')}`}><Icon name="award" size={11} />{e.reason || '达标'}</span>
                  <span className="c-pill">入池 {fmtDT(e.qualifiedAt)}</span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="row" style={{ gap: 3, fontSize: 11, color: '#6B7180' }}>
                    <Icon name="heart" size={11} color="#E85C87" />达标点赞 <b>{e.likeAtQualify ?? '—'}</b> / P60 {e.likeP60 ?? '—'}
                  </span>
                  <span className="row" style={{ gap: 3, fontSize: 11, color: '#6B7180' }}>
                    <Icon name="comment" size={11} color="#3B82F6" />评论 <b>{e.commentAtQualify ?? '—'}</b>
                  </span>
                </div>
                {!hasWork && (
                  <div className="mc-note warn" style={{ marginTop: 6, fontSize: 11 }}><Icon name="bell" size={13} />该推文未关联作品：请先到「作品」创建作品，再回来上橱窗。</div>
                )}
              </div>
            </div>

            {/* 下游状态 & CTA */}
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', background: '#F7F8FA', borderRadius: 10, padding: '8px 10px' }}>
              {!hasWork ? (
                <button className="c-btn c-btn-sm c-btn-primary" onClick={() => navigate('/c/works')}><Icon name="tshirt" size={12} />去组织作品</button>
              ) : windowed ? (
                <>
                  <span className="row" style={{ gap: 5, fontSize: 12 }}>橱窗<WindowBadge status={e.windowStatus} /></span>
                  {producted ? (
                    <button className="c-btn c-btn-sm c-btn-soft" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/mall/product/${e.productId}`)}><Icon name="bag" size={12} />查看商品</button>
                  ) : (
                    <button className="c-btn c-btn-sm c-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/c/window?workId=${e.workId}`)}>
                      {e.windowStatus === 'rejected' ? <><Icon name="edit" size={12} />去补材料</> : e.windowStatus === 'submitted' ? <><Icon name="clock" size={12} />查看审核中</> : <><Icon name="store" size={12} />去上橱窗</>}
                    </button>
                  )}
                </>
              ) : producted ? (
                <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate(`/mall/product/${e.productId}`)}><Icon name="bag" size={12} />查看商品</button>
              ) : (
                <>
                  <span className="row" style={{ gap: 5, fontSize: 12 }}>尚未上橱窗</span>
                  <button className="c-btn c-btn-sm c-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/c/window?workId=${e.workId}`)}><Icon name="store" size={12} />去上橱窗</button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {!loading && entries.length > 0 && (
        <div className="mc-sub" style={{ textAlign: 'center', marginTop: 10 }}>达标即入池 → 上橱窗（真人穿搭图/规格表/3D 与打版）→ 审核通过自动上架商城</div>
      )}
    </div>
  );
}
