/* ============================================================================
 * /creator/publish 发推文 —— 内容 + 关联作品 + 素材 + 配图 → 发布；
 * 右侧实时「市场认可进度卡」（P60 / 评论10 达标即入池，发布后自动拉取）
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { FeedItem, Material, Work } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { useAsync, Field, TagInput, Modal, MaterialPickModal, Loading } from './_shared';

const QUICK_TAGS = ['法式', '碎花', '通勤', '泡泡袖', '缎面', '新中式', '复古', '极简', '设计手记', '打版'];

export default function PublishPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const workIdParam = sp.get('workId');

  const { data: worksData, loading: worksLoading } = useAsync(() => api.works.mine(), []);
  const { data: mats } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const works = worksData?.list || [];
  const materialList = mats?.list || [];

  const [content, setContent] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [workId, setWorkId] = React.useState<string>('');
  const [patternIds, setPatternIds] = React.useState<number[]>([]);
  const [modelIds, setModelIds] = React.useState<number[]>([]);
  const [images, setImages] = React.useState<string[]>([]);
  const [pick, setPick] = React.useState<'pattern' | 'model' | 'image' | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState<FeedItem | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // 深层链接 ?workId= → 自动选中作品
  React.useEffect(() => {
    if (workIdParam && !workId) {
      setWorkId(workIdParam);
      const w = works.find((x) => String(x.id) === workIdParam);
      if (w) {
        setPatternIds((ids) => (ids.length ? ids : [...w.patternMatIds]));
        setModelIds((ids) => (ids.length ? ids : [...w.modelMatIds]));
      }
    }
  }, [workIdParam, workId, works]);

  const selWork: Work | undefined = works.find((w) => String(w.id) === workId);
  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const imgMats = materialList.filter((m) => ['png', 'jpg'].includes(m.kind));

  const publish = async () => {
    if (!content.trim()) { toast('请填写推文内容'); return; }
    setPublishing(true);
    try {
      const post = await api.posts.create({
        ...(workId ? { workId: Number(workId) } : {}),
        content: content.trim(),
        ...(images.length ? { images } : {}),
        tags,
        patternMatIds: patternIds,
        modelMatIds: modelIds,
      });
      setPublished(post as unknown as FeedItem);
      toast('推文已发布 🎉', 'check');
      // 发布后立即拉取一次市场进度（增量评估结果）
      api.posts.get(post.id).then((d) => setPublished(d)).catch(() => {});
    } catch (e) {
      toast((e as Error).message || '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const refreshMarket = async () => {
    if (!published) return;
    setRefreshTick((t) => t + 1);
    try {
      const d = await api.posts.get(published.id);
      setPublished(d);
      toast('进度已刷新（引擎实时增量评估）', 'check');
    } catch (e) {
      toast((e as Error).message || '刷新失败');
    }
  };

  /** 演示加速器：把热度提到 P60 之上 → 引擎自动评估 → 自动入资源池 + 通知（仅演示，语义同真实互动） */
  const simulateHeat = async () => {
    if (!published) return;
    setPublishing(true);
    try {
      // 多次尝试：每次用最新 P60 打超过 15 个赞的裕量，直到引擎判定达标
      let cur = published;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!cur.market) {
          cur = await api.posts.get(published.id);
          setPublished(cur);
        }
        const m = cur.market || { p60: 0, likes: 0, comments: 0 };
        const target = Math.max((m.p60 || 0) + 15, (m.likes || 0) + 10);
        const res = await api.dev.surgeLikes(cur.id, target);
        cur = await api.posts.get(cur.id);
        setPublished(cur);
        if (res.qualified || cur.market?.qualified) {
          toast(`🎉 已达标自动纳入资源池：赞 ${cur.market?.likes ?? res.likesNow} > P60 ${cur.market?.p60 ?? res.p60}`, 'check');
          return;
        }
      }
      toast('热度已提升，但当日 P60 变化较快，请再试一次', undefined);
    } catch (e) {
      toast((e as Error).message || '模拟失败');
    } finally {
      setPublishing(false);
    }
  };

  const previewImages = images.length ? images : selWork ? selWork.mediaImages : [];

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      {/* ================= 左：编辑区 ================= */}
      <div className="c-card flex-1" style={{ minWidth: 430 }}>
        <div className="c-card-hd">
          <span className="c-card-title">发布新推文</span>
          <span className="c-pill">3D 图 + 打版图 展示设计过程</span>
        </div>
        <Field label="推文内容" required hint="可以带 #话题#，用于验证市场偏好">
          <textarea className="c-textarea" rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="介绍你的新作品：设计灵感、工艺亮点、上身感受…\n\n例如：#法式 #碎花 夏日新作打版首秀，泡泡袖连衣裙上身效果超出预期！" />
        </Field>
        <Field label="话题标签">
          <TagInput value={tags} onChange={setTags} suggest={QUICK_TAGS} />
        </Field>

        <div className="form-grid">
          <Field label="关联作品" hint={selWork ? `${selWork.title}（自动带入其打版/3D 素材）` : '不关联也可仅用素材发布'}>
            {worksLoading ? <Loading compact /> : (
              <select className="c-select" value={workId} onChange={(e) => {
                setWorkId(e.target.value);
                const w = works.find((x) => String(x.id) === e.target.value);
                if (w) { setPatternIds([...w.patternMatIds]); setModelIds([...w.modelMatIds]); }
              }}>
                <option value="">不关联作品</option>
                {works.map((w) => <option key={w.id} value={String(w.id)}>{w.title}</option>)}
              </select>
            )}
          </Field>
          <Field label="图片配图" hint="留空将自动使用作品图 + 素材封面">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setPick('image')}><Icon name="image" size={12} />{images.length ? `已选 ${images.length} 张` : '选配图'}</button>
              {images.length > 0 && <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setImages([])}><Icon name="close" size={12} />清空</button>}
            </div>
          </Field>
        </div>

        {/* 素材引用（自动覆盖预览） */}
        <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="flex-1" style={{ minWidth: 220 }}>
            <Field label={`3D 素材${modelIds.length ? ` ×${modelIds.length}` : ''}`}>
              <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />选择 3D 图素材</span>
                <Icon name="chevron-right" size={14} color="#C0C4CC" />
              </button>
            </Field>
          </div>
          <div className="flex-1" style={{ minWidth: 220 }}>
            <Field label={`打版素材${patternIds.length ? ` ×${patternIds.length}` : ''}`}>
              <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />选择打版图素材</span>
                <Icon name="chevron-right" size={14} color="#C0C4CC" />
              </button>
            </Field>
          </div>
        </div>

        {/* 配图预览（最终 images 会被后端自动补素材封面） */}
        {previewImages.length > 0 && (
          <Field label="配图预览">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 7 }}>
              {previewImages.slice(0, 9).map((s) => (
                <div key={s} style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: '#F1F2F5' }}>
                  <img src={imgSafe(s)} alt="" onError={hideBadImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            {!images.length && <div style={{ fontSize: 11, color: '#9AA0AA', marginTop: 6 }}>未手动配图：将自动使用作品图与所选素材封面（约 1-6 张）</div>}
          </Field>
        )}

        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <button className="c-btn c-btn-primary c-btn-lg flex-1" disabled={publishing || !content.trim()} onClick={publish}>
            <Icon name="send" size={15} />{publishing ? '发布中…' : '发布推文'}
          </button>
        </div>
      </div>

      {/* ================= 右：市场认可进度卡 ================= */}
      <div style={{ width: 350, flexShrink: 0 }}>
        <div className="c-card">
          <div className="c-card-hd">
            <span className="c-card-title">市场认可进度</span>
            <span className="c-pill">实时增量评估</span>
          </div>
          <div className="c-notice brand">
            <Icon name="megaphone" size={15} />
            <span><b>入池规则：</b>点赞超过当日平台推文 P60（≈前 40% 热度），<b>或</b> 评论数 ≥10，系统<b>自动将作品纳入资源池</b>并通知你准备橱窗材料。</span>
          </div>

          {!published ? (
            <div style={{ marginTop: 12 }}>
              <div className="c-state" style={{ padding: '26px 10px' }}>
                <div className="ico" style={{ width: 50, height: 50, background: '#F7F8FA', color: '#B7BCC6' }}>
                  <Icon name="send" size={22} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>发布后在这里跟踪进度</div>
                <div className="c-hint" style={{ fontSize: 11.5, marginTop: 6 }}>点赞/评论一旦变化，引擎即对你的推文做增量评估（可点刷新）。</div>
              </div>
            </div>
          ) : (
            <MarketCard post={published} refreshing={refreshTick > 0} onRefresh={refreshMarket} onGoPool={() => navigate('/creator/pool')} onSimulate={simulateHeat} simulating={publishing} />
          )}
        </div>

        <div className="c-card" style={{ marginTop: 12 }}>
          <div className="c-card-title" style={{ marginBottom: 10 }}>发布小贴士</div>
          <ul style={{ fontSize: 11.5, color: '#6B7180', lineHeight: 2.1, paddingLeft: 16 }}>
            <li>关联作品后，点赞/评论会同时带动作品热度</li>
            <li>入池后 → 资源池 → 「去上橱窗」准备真人穿搭图与规格</li>
            <li>橱窗材料审核通过即自动上架商城并生成 AI 详情页</li>
          </ul>
        </div>
      </div>

      {/* ================= 弹层 ================= */}
      {pick === 'pattern' && <MaterialPickModal title="选择打版素材" mats={patternMats} value={patternIds} onChange={setPatternIds} onClose={() => setPick(null)} />}
      {pick === 'model' && <MaterialPickModal title="选择 3D 素材" mats={modelMats} value={modelIds} onChange={setModelIds} onClose={() => setPick(null)} />}
      {pick === 'image' && (
        <Modal narrow onClose={() => setPick(null)} title="选择配图（图片素材）" icon="image">
          <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
            {imgMats.map((m: Material) => {
              const on = images.includes(m.cover || '');
              return (
                <div key={m.id} className={`pick-cell ${on ? 'on' : ''}`} onClick={() => {
                  const c = m.cover || '';
                  setImages((prev) => (on ? prev.filter((x) => x !== c) : prev.length < 6 ? [...prev, c] : prev));
                }}>
                  <div className="ph"><img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy" /></div>
                  <span className="ck">{on ? <Icon name="check" size={12} /> : null}</span>
                  <span className="cap">{m.title}</span>
                </div>
              );
            })}
            {!imgMats.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9AA0AA', fontSize: 12.5, padding: 20 }}>暂无图片素材（png/jpg），可去素材库导入</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------- 市场认可进度卡 ------------------------- */
export function MarketCard({ post, refreshing, onRefresh, onGoPool, onOpen, onSimulate, simulating }: {
  post: FeedItem;
  refreshing?: boolean;
  onRefresh?: () => void;
  onGoPool?: () => void;
  onOpen?: () => void;
  onSimulate?: () => void;
  simulating?: boolean;
}) {
  const m = post.market;
  const p60 = m?.p60 ?? 0;
  const commentTarget = m?.commentTarget ?? 10;
  const qualified = !!m?.qualified;
  const likePct = Math.min(100, p60 > 0 ? Math.round(((m?.likes ?? 0) / p60) * 100) : (m?.likes ?? 0) > 0 ? 100 : 0);
  const commentPct = Math.min(100, Math.round(((m?.comments ?? 0) / commentTarget) * 100));
  const reasons: string[] = [];
  if ((m?.likes ?? 0) > p60) reasons.push(`点赞 ${m?.likes} > P60 ${p60}`);
  if ((m?.comments ?? 0) >= commentTarget) reasons.push(`评论 ${m?.comments} ≥ ${commentTarget}`);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>{post.workId ? `作品推文 #${post.id}` : `推文 #${post.id}`}</b>
        {onRefresh && (
          <button className="c-btn c-btn-sm c-btn-outline" onClick={onRefresh} disabled={refreshing}>
            <Icon name="refresh" size={12} />{refreshing ? '刷新中…' : '刷新'}
          </button>
        )}
      </div>
      <div className="ellipsis" style={{ fontSize: 12, color: '#6B7180', marginBottom: 12 }}>{post.content}</div>

      {qualified ? (
        <div className="c-notice ok" style={{ marginBottom: 12 }}>
          <Icon name="check-circle" size={16} />
          <span><b>已自动纳入资源池 🎉</b><br />{m?.p60Note}，已达标：{reasons.join('；')}</span>
        </div>
      ) : (
        <div className="c-notice info" style={{ marginBottom: 12 }}>
          <Icon name="clock" size={15} />
          <span>尚未达标：{m?.p60Note || `P60=${p60}`}。评论达 {m?.comments ?? 0}/{commentTarget}。引擎会随点赞/评论实时增量评估。</span>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
          <span className="row" style={{ gap: 4 }}><Icon name="heart" size={12} color="#E85C87" />点赞热度</span>
          <b>{m?.likes ?? 0} <span style={{ color: '#9AA0AA', fontWeight: 500 }}>/ {p60}（P60）</span></b>
        </div>
        <div className="c-progress"><i style={{ width: `${likePct}%` }} /></div>
      </div>
      <div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
          <span className="row" style={{ gap: 4 }}><Icon name="comment" size={12} color="#3B82F6" />讨论热度</span>
          <b>{m?.comments ?? 0} <span style={{ color: '#9AA0AA', fontWeight: 500 }}>/ {commentTarget} 条评论</span></b>
        </div>
        <div className="c-progress"><i style={{ width: `${commentPct}%` }} /></div>
      </div>

      {qualified && onGoPool && (
        <button className="c-btn c-btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={onGoPool}>
          <Icon name="grid" size={14} />去资源池查看 / 上橱窗
        </button>
      )}
      {onOpen && <div style={{ fontSize: 11, color: '#9AA0AA', marginTop: 8 }}>点击推文可查看完整动态（{post.likes} 赞 · {post.commentCount} 评论）</div>}
      {!qualified && (
        <div style={{ fontSize: 11, color: '#A8AEB8', marginTop: 12, lineHeight: 1.8 }}>
          到消费者首页为它点赞/评论即可让引擎评估 → 达标自动入池。
          {refreshing && ' 正在刷新…'}
        </div>
      )}
      {!qualified && onSimulate && (
        <button className="c-btn c-btn-outline" style={{ width: '100%', marginTop: 10 }} onClick={onSimulate} disabled={simulating}>
          <Icon name="fire" size={13} />{simulating ? '模拟中…' : '演示：模拟互动热度 → 自动入池'}
        </button>
      )}
    </div>
  );
}
