/* ============================================================================
 * /c/publish 创作者中心 · 发布（移动版）
 * 关联作品(必选)→内容→话题标签(仅手动)→配图(图片素材点选+已选预览一体，无图自动带作品图)
 * →3D/打版素材微调(可选)→发布推文；下方「我的推文」近一天/3天/一周 tabs（达标进度/入池徽标/
 * 演示模拟热度），发布后自动刷新
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { FeedItem, Material, Work } from '../../api/types';
import { hideBadImg, imgSafe, fmtCount, relTime } from '../../components/shared/utils';
import { MaterialBadge } from '../../components/shared/MaterialBadge';
import { useAsync, Field, TagInput, MaterialPickModal, Loading } from './bits';
import { MEmpty } from './bits';

const RANGES = [
  { key: 1, label: '近一天' },
  { key: 3, label: '近 3 天' },
  { key: 7, label: '近一周' },
];

export default function MPublishPage() {
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
  const [workId, setWorkId] = React.useState('');
  const [patternIds, setPatternIds] = React.useState<number[]>([]);
  const [modelIds, setModelIds] = React.useState<number[]>([]);
  const [images, setImages] = React.useState<string[]>([]);
  const [pick, setPick] = React.useState<'pattern' | 'model' | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const [days, setDays] = React.useState(1);
  const [myList, setMyList] = React.useState<FeedItem[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);
  const [myErr, setMyErr] = React.useState('');
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (workIdParam && !workId) {
      setEditing(true);
      setWorkId(workIdParam);
      const w = works.find((x) => String(x.id) === workIdParam);
      if (w) {
        setPatternIds((ids) => (ids.length ? ids : [...w.patternMatIds]));
        setModelIds((ids) => (ids.length ? ids : [...w.modelMatIds]));
      }
    }
  }, [workIdParam, workId, works]);

  const loadMine = React.useCallback(async (d: number) => {
    setMyLoading(true);
    setMyErr('');
    try {
      const res = await api.posts.mine({ days: d, page: 1 });
      setMyList(res?.list || []);
      setDays(d);
    } catch (e) {
      setMyErr((e as Error).message || '我的推文加载失败');
    } finally {
      setMyLoading(false);
    }
  }, []);

  React.useEffect(() => { loadMine(days); }, [days, tick, loadMine]);

  const selWork: Work | undefined = works.find((w) => String(w.id) === workId);
  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const imgMats = materialList.filter((m) => ['png', 'jpg'].includes(m.kind));

  const toggleImg = (src: string) =>
    setImages((prev) => (prev.includes(src) ? prev.filter((x) => x !== src) : prev.length < 6 ? [...prev, src] : prev));

  const publish = async () => {
    if (!content.trim()) { toast('请填写推文内容'); return; }
    if (!workId) { toast('请先在上方选择要发布的关联作品'); return; }
    setPublishing(true);
    try {
      await api.posts.create({
        workId: Number(workId),
        content: content.trim(),
        ...(images.length ? { images } : {}),
        tags,
        patternMatIds: patternIds,
        modelMatIds: modelIds,
      });
      toast('推文已发布 🎉（可在下方「我的推文」查看市场认可进度）', 'check');
      setContent('');
      setImages([]);
      setTags([]);
      setTick((t) => t + 1);
      setEditing(false);
    } catch (e) {
      toast((e as Error).message || '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  /** 演示加速器：提到 P60 之上 → 引擎自动评估 → 自动入池（仅演示） */
  const simulate = async (post: FeedItem) => {
    setPublishing(true);
    try {
      let cur = post;
      if (!cur.market) cur = await api.posts.get(post.id);
      const m = cur.market || { p60: 0, likes: 0, comments: 0 };
      for (let i = 0; i < 5; i++) {
        const target = Math.max((m.p60 || 0) + 15, (m.likes || 0) + 10);
        const res = await api.dev.surgeLikes(cur.id, target);
        cur = await api.posts.get(cur.id);
        if (res.qualified || cur.market?.qualified) {
          toast('🎉 已达标自动纳入资源池', 'check');
          setTick((t) => t + 1);
          return;
        }
        m.p60 = cur.market?.p60 ?? m.p60;
        m.likes = cur.market?.likes ?? m.likes;
      }
      toast('热度已提升，但当日 P60 变化较快，请再试一次');
    } catch (e) {
      toast((e as Error).message || '模拟失败');
    } finally {
      setPublishing(false);
    }
  };

  const chosenPattern = materialList.filter((m) => patternIds.includes(m.id));
  const chosenModel = materialList.filter((m) => modelIds.includes(m.id));

  return (
    <div>
      {/* ===== 顶部：推文文字介绍 + 发布新推文按钮（同橱窗材料） ===== */}
      <div className="mc-card">
        <div className="row" style={{ gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row" style={{ gap: 6, fontSize: 17, fontWeight: 800 }}>
              <Icon name="send" size={18} color="var(--brand)" />发布推文
            </div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.9, color: '#6B7180' }}>
              发布关联「作品」的推文给粉丝；市场认可<b>达标后，系统会自动将作品纳入资源池</b>，并提醒你继续准备上橱窗。
            </div>
          </div>
          {!editing && (
            <button className="c-btn c-btn-primary" onClick={() => { setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <Icon name="plus" size={15} />发布新推文
            </button>
          )}
        </div>
      </div>

      {editing && (
      <>
      {/* ===== 发布编辑区 ===== */}
      <div className="mc-card" style={{ marginTop: 10, border: '1px solid #E8B9CB' }}>
        <div className="mc-hd" style={{ marginBottom: 10 }}>
          <div className="mc-hd-title"><Icon name="send" size={15} color="var(--brand)" />发布新推文</div>
          <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditing(false)}><Icon name="close" size={13} />关闭</button>
        </div>

        <div className="mc-form">
          <Field label="关联作品" required hint={selWork ? `已选择「${selWork.title}」，自动带入其打版 / 3D 素材` : '从「作品」中选择要发布的内容'}>
            {worksLoading ? <Loading compact /> : (
              <select className="c-select" value={workId} onChange={(e) => {
                setWorkId(e.target.value);
                const w = works.find((x) => String(x.id) === e.target.value);
                if (w) { setPatternIds([...w.patternMatIds]); setModelIds([...w.modelMatIds]); }
              }}>
                <option value="">请选择要发布的作品…</option>
                {works.map((w) => <option key={w.id} value={String(w.id)}>{w.title}（{w.category}）</option>)}
              </select>
            )}
          </Field>

          <Field label="推文内容" required hint="介绍你的新作品：设计灵感、工艺亮点、上身感受…">
            <textarea className="c-textarea" rows={4} value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="把作品介绍给粉丝：例如夏日新作打版首秀，泡泡袖连衣裙上身效果超出预期！" />
          </Field>

          <Field label="话题标签" hint="手动输入后按回车添加（最多 8 个），发布时不带推荐标签">
            <TagInput value={tags} onChange={setTags} placeholder="输入标签，如：法式 / 泡泡袖" />
          </Field>

          {/* 配图：图片素材点选 + 已选预览一体 */}
          <Field label={`配图（${images.length}/6）`} hint="留空时自动带关联作品图 + 所选素材封面">
            {imgMats.length > 0 && (
              <div className="mc-pick-grid">
                {imgMats.map((m: Material) => {
                  const c = m.cover || '';
                  const on = !!c && images.includes(c);
                  return (
                    <div key={m.id} className={`mc-pick-cell ${on ? 'on' : ''}`} onClick={() => c && toggleImg(c)}>
                      {c ? <img src={imgSafe(c)} alt="" onError={hideBadImg} loading="lazy" /> : <div className="ph"><Icon name="image" size={18} color="#B7BCC6" /></div>}
                      <span className="ck">{on ? <Icon name="check" size={11} /> : <Icon name="plus" size={11} />}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {!imgMats.length && <div style={{ color: '#9AA0AA', fontSize: 12, padding: '6px 0' }}>暂无图片素材（png/jpg），可去素材库导入</div>}

            {images.length > 0 && (
              <div className="mc-note info" style={{ marginTop: 8 }}>
                <Icon name="image" size={14} />
                <span style={{ flex: 1 }}>已选 {images.length} 张：</span>
                <span className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {images.map((s) => (
                    <span key={s} style={{ position: 'relative' }}>
                      <img src={imgSafe(s)} alt="" onError={hideBadImg} style={{ width: 34, height: 42, objectFit: 'cover', borderRadius: 8 }} />
                      <button onClick={() => toggleImg(s)} style={{ position: 'absolute', right: -4, top: -4, width: 15, height: 15, borderRadius: '50%', background: '#E5484D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={9} />
                      </button>
                    </span>
                  ))}
                  <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setImages([])}><Icon name="trash" size={11} />清空</button>
                </span>
              </div>
            )}
          </Field>

          {/* 3D / 打版素材微调 */}
          <div className="row" style={{ gap: 8 }}>
            <Field label={`3D 素材${modelIds.length ? ` ×${modelIds.length}` : ''}`} inline>
              <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setPick('model')}><Icon name="layers" size={13} color="#3B82F6" />调整</button>
            </Field>
            <Field label={`打版素材${patternIds.length ? ` ×${patternIds.length}` : ''}`} inline>
              <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setPick('pattern')}><Icon name="pen-tool" size={13} color="#B4547A" />调整</button>
            </Field>
          </div>
          {(chosenModel.length > 0 || chosenPattern.length > 0) && (
            <div className="c-chips" style={{ marginBottom: 10 }}>
              {[...chosenModel, ...chosenPattern].slice(0, 10).map((m) => (
                <span key={m.id} className="c-chip"><MaterialBadge kind={m.kind} /><span className="ellipsis" style={{ maxWidth: 110 }}>{m.title || m.fileName}</span></span>
              ))}
            </div>
          )}
        </div>

        <button className="c-btn c-btn-primary" style={{ width: '100%', height: 44, borderRadius: 12, fontSize: 14.5 }} disabled={publishing || !content.trim() || !workId} onClick={publish}>
          <Icon name="send" size={16} />{publishing ? '发布中…' : '发布推文'}
        </button>
      </div>
      </>
      )}

      {/* ===== 我的推文 ===== */}
      <div className="mc-card" style={{ marginTop: 10 }}>
        <div className="mc-hd" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          <div className="mc-hd-title" style={{ flex: 1 }}>我的推文</div>
          <div className="mc-tabs">
            {RANGES.map((r) => (
              <button key={r.key} className={`mc-tab ${days === r.key ? 'on' : ''}`} onClick={() => { if (days !== r.key) loadMine(r.key); }}>{r.label}</button>
            ))}
          </div>
        </div>

        {myLoading && <Loading text="加载我的推文…" />}
        {!myLoading && myErr && (
          <MEmpty icon="send" title="我的推文加载失败" desc={myErr}
            action={<button className="c-btn c-btn-outline" onClick={() => loadMine(days)}><Icon name="refresh" size={13} />重试</button>} />
        )}
        {!myLoading && !myErr && myList.length === 0 && (
          <MEmpty icon="send" title="该时间段暂无推文"
            desc="发布后实时展示市场认可进度，达标后系统会自动纳入资源池" />
        )}

        {!myLoading && !myErr && myList.map((p) => (
          <MyPostRow key={p.id} post={p} simulating={publishing} onSimulate={() => simulate(p)} onOpen={() => navigate(`/post/${p.id}`)} />
        ))}

        <div className="mc-note brand" style={{ marginTop: 8 }}>
          <Icon name="megaphone" size={14} />
          <span>作品达标后系统会自动纳入资源池并通知你 → 资源池「去上橱窗」。</span>
        </div>
      </div>

      {/* 素材微调弹层 */}
      {pick === 'pattern' && <MaterialPickModal title="选择打版素材（DXF/SVG）" mats={patternMats} value={patternIds} onChange={setPatternIds} onClose={() => setPick(null)} preview={false} />}
      {pick === 'model' && <MaterialPickModal title="选择 3D 素材（OBJ/GLB）" mats={modelMats} value={modelIds} onChange={setModelIds} onClose={() => setPick(null)} preview={false} />}
    </div>
  );
}

/* ------------------------- 单条推文的市场认可进度 ------------------------- */
function MyPostRow({ post, simulating, onSimulate, onOpen }: {
  post: FeedItem; simulating?: boolean; onSimulate: () => void; onOpen: () => void;
}) {
  const m = post.market;
  const p60 = m?.p60 ?? 0;
  const commentTarget = m?.commentTarget ?? 10;
  const qualified = !!m?.qualified;
  const likes = m?.likes ?? post.likes ?? 0;
  const comments = m?.comments ?? post.commentCount ?? 0;
  const likePct = Math.min(100, p60 > 0 ? Math.round((likes / p60) * 100) : likes > 0 ? 100 : 0);
  const commentPct = Math.min(100, Math.round((comments / commentTarget) * 100));
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid #F0F1F4' }}>
      <button onClick={onOpen} className="row" style={{ width: '100%', gap: 9, alignItems: 'flex-start', textAlign: 'left' }}>
        <img src={imgSafe(post.images?.[0])} alt="" onError={hideBadImg} style={{ width: 46, height: 58, objectFit: 'cover', borderRadius: 8, background: '#F1F2F5', flexShrink: 0 }} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="ellipsis-2" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{post.content}</div>
          <div className="row" style={{ gap: 8, marginTop: 4, fontSize: 10.5, color: '#9AA0AA' }}>
            <span className="row" style={{ gap: 2 }}><Icon name="heart" size={10} color="#E85C87" />{fmtCount(likes)}</span>
            <span className="row" style={{ gap: 2 }}><Icon name="comment" size={10} color="#3B82F6" />{fmtCount(comments)}</span>
            <span>{relTime(post.createdAt)}</span>
          </div>
        </div>
        {qualified
          ? <span className="c-badge c-badge-green"><Icon name="check-circle" size={10} />已入池</span>
          : <span className="c-badge c-badge-gray">验证中</span>}
      </button>

      {/* 进度条 */}
      <div style={{ margin: '8px 0 4px', display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 10.5, color: '#6B7180' }}>
            <span>点赞热度</span><b>{likes}/{p60 || '-'}</b>
          </div>
          <div className="c-progress"><i style={{ width: `${likePct}%` }} /></div>
        </div>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 10.5, color: '#6B7180' }}>
            <span>评论</span><b>{comments}/{commentTarget}</b>
          </div>
          <div className="c-progress"><i style={{ width: `${commentPct}%`, background: '#3B82F6' }} /></div>
        </div>
      </div>
      {!qualified && (
        <button className="c-btn c-btn-outline c-btn-sm" style={{ width: '100%' }} disabled={simulating} onClick={onSimulate}>
          <Icon name="fire" size={12} />{simulating ? '模拟中…' : '演示：模拟互动热度 → 自动入池'}
        </button>
      )}
    </div>
  );
}
