/* ============================================================================
 * /creator/pool 资源池 —— 规则卡 + 立即评估 + 入池作品卡（达标明细 + 下游状态/CTA）
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { PoolEntry } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { useAsync, CState, WindowBadge, fmtDT, Loading } from './_shared';

export default function PoolPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useMe();
  const [sp] = useSearchParams();
  const poolIdParam = sp.get('poolId');

  const { data, loading, error, reload } = useAsync(() => api.pool.creatorPool(), []);
  const entries = data?.list || [];
  const meta = data?.meta;

  const [evaling, setEvaling] = React.useState(false);
  const [flash, setFlash] = React.useState<PoolEntry[]>([]);

  React.useEffect(() => {
    if (poolIdParam) {
      const el = document.getElementById(`pool-${poolIdParam}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [poolIdParam, entries]);

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
      <div className="c-card">
        <div className="c-card-hd">
          <span className="c-card-title">资源池 · 市场认可作品</span>
          {meta?.lastEval && <span className="c-pill"><Icon name="clock" size={11} />上次运行 {fmtDT(meta.lastEval)}</span>}
        </div>
        <div className="c-notice brand">
          <Icon name="megaphone" size={16} />
          <span>
            {meta?.engine || '当日全平台推文点赞升序取 P60，点赞超过 P60 或评论数 ≥10 即自动纳入本池'}
            {(meta?.rule || []).length > 0 && (
              <span style={{ display: 'block', marginTop: 4, opacity: .85 }}>规则：{meta?.rule?.join('；')}</span>
            )}
          </span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="c-btn c-btn-primary" disabled={evaling} onClick={evalNow}>
            <Icon name="refresh" size={14} />{evaling ? '评估中…' : '立即评估（引擎按今日 P60 重跑）'}
          </button>
          <span className="c-hint">评估后新增的条目会即时出现在下方；入池作品会自动收到「准备橱窗材料」通知。</span>
        </div>
      </div>

      {/* 新增闪烁提示 */}
      {flash.length > 0 && (
        <div className="c-card" style={{ marginTop: 12, borderColor: '#E8B9CB' }}>
          <div className="c-card-hd"><span className="c-card-title">本次新增 {flash.length} 条</span>
            <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setFlash([])}>收起</button>
          </div>
          <div style={{ fontSize: 12, color: '#6B7180', lineHeight: 2 }}>
            {flash.map((f) => `post#${f.postId}（${(f.reason || '').split(' / ').join('、')}）`).join('；')}
          </div>
        </div>
      )}

      {/* 列表 */}
      <div style={{ marginTop: 12 }}>
        {loading && <div className="c-card"><Loading /></div>}
        {!loading && error && (
          <div className="c-card"><CState danger icon="grid" title="资源池加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重新加载</button>} /></div>
        )}
        {!loading && !entries.length && (
          <div className="c-card">
            <CState icon="grid" title="资源池暂时为空" desc="发布推文并让它获得超过当日 P60 的点赞，或 ≥10 条评论，即可自动入池。也可点上方「立即评估」试跑引擎。" />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 12 }}>
          {entries.map((e: PoolEntry) => {
            const workTitle = e.work?.title || e.post?.content?.slice(0, 40) || `推文 #${e.postId}`;
            const cover = e.work?.cover || (e.post as { images?: string[] } | null)?.images?.[0] || '';
            const hasWork = !!e.workId;
            const windowed = !!e.windowStatus;
            const producted = !!e.productId;
            return (
              <div key={e.id} className="c-card" id={`pool-${e.id}`} style={{ padding: 14 }}>
                <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0 }}>
                    {cover ? (
                      <img src={imgSafe(cover)} alt="" onError={hideBadImg} style={{ width: 92, height: 118, objectFit: 'cover', borderRadius: 12 }} />
                    ) : (
                      <div style={{ width: 92, height: 118, borderRadius: 12, background: 'linear-gradient(140deg,#FBE4EC,#F6C9D8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C96' }}>
                        <Icon name="grid" size={28} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 13.5 }} className="ellipsis">{workTitle}</b>
                      {e.work?.category && <span className="c-badge c-badge-brand">{e.work.category}</span>}
                    </div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <span className={`c-badge ${reasonTone(e.reason || '')}`}><Icon name="award" size={11} />{e.reason || '达标'}</span>
                      <span className="c-pill">入池 {fmtDT(e.qualifiedAt)}</span>
                    </div>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 6 }}>
                      <MiniStat label="达标点赞" val={`${e.likeAtQualify ?? '—'}`} extra={`P60 ${e.likeP60 ?? '—'}`} icon="heart" />
                      <MiniStat label="达标评论" val={`${e.commentAtQualify ?? '—'}`} extra="≥10 即入池" icon="comment" />
                    </div>
                    {!hasWork && (
                      <div className="c-notice warn" style={{ marginTop: 8, fontSize: 11.5 }}>
                        <Icon name="bell" size={13} />该推文未关联作品：请先到「作品组织」创建作品，再回来上橱窗。
                      </div>
                    )}
                  </div>
                </div>

                {/* 下游状态 & 动作 */}
                <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', background: '#F7F8FA', borderRadius: 10, padding: '9px 11px' }}>
                  {!hasWork ? (
                    <button className="c-btn c-btn-sm c-btn-primary" onClick={() => navigate('/creator/works')}><Icon name="tshirt" size={12} />去组织作品</button>
                  ) : windowed ? (
                    <>
                      <span className="row" style={{ gap: 5, fontSize: 12 }}>
                        橱窗<WindowBadge status={e.windowStatus} />
                      </span>
                      {producted ? (
                        <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate(`/creator/products`)}><Icon name="bag" size={12} />查看商品</button>
                      ) : (
                        <button className="c-btn c-btn-sm c-btn-primary" onClick={() => navigate(`/creator/window?workId=${e.workId}`)}>
                          {e.windowStatus === 'rejected' ? <><Icon name="edit" size={12} />去补材料</> : e.windowStatus === 'submitted' ? <><Icon name="clock" size={12} />查看审核中</> : <><Icon name="store" size={12} />去上橱窗</>}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="row" style={{ gap: 5, fontSize: 12 }}>尚未上橱窗</span>
                      <button className="c-btn c-btn-sm c-btn-primary" onClick={() => navigate(`/creator/window?workId=${e.workId}`)}><Icon name="store" size={12} />去上橱窗</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!loading && entries.length > 0 && (
          <div className="c-hint" style={{ marginTop: 10, textAlign: 'center' }}>
            达标即入池 → 准备真人穿搭图 / 规格表 / 3D 与打版文件上橱窗 → 审核通过自动上架商城（材料变更需重新审核）
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, val, extra, icon }: { label: string; val: string; extra: string; icon: 'heart' | 'comment' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--creator-line)', borderRadius: 9, padding: '6px 9px' }}>
      <div className="row" style={{ gap: 4, fontSize: 10.5, color: '#9AA0AA' }}>
        <Icon name={icon} size={10} color={icon === 'heart' ? '#E85C87' : '#3B82F6'} />{label}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 2 }}>
        <b style={{ fontSize: 14 }}>{val}</b>
        <span style={{ fontSize: 10, color: '#A8AEB8' }}>{extra}</span>
      </div>
    </div>
  );
}
