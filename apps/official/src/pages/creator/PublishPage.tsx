/* ============================================================================
 * /creator/publish 发推文 —— 同橱窗材料：顶部「文字介绍 + 发布新推文」按钮；
 * 点击后展开发布编辑器（关联作品置顶→内容→配图与预览合并→手动话题→3D/打版微调→发布）。
 * 空闲态：介绍 + 「我的推文」列表（近一天 / 近3天 / 近一周）。
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { FeedItem, Material, Work } from '../../api/types';
import { hideBadImg, imgSafe, fmtCount, relTime } from '../../components/shared/utils';
import { useAsync, Field, TagInput, MaterialPickModal, Loading } from './_shared';

const RANGE_TABS = [
  { key: 1, label: '近一天' },
  { key: 3, label: '近 3 天' },
  { key: 7, label: '近一周' },
];

export default function PublishPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const workIdParam = sp.get('workId');

  const { data: worksData, loading: worksLoading } = useAsync(() => api.works.mine(), []);
  const { data: mats } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const works = worksData?.list || [];
  const materialList = mats?.list || [];

  /* 表单 */
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [workId, setWorkId] = React.useState<string>('');
  const [patternIds, setPatternIds] = React.useState<number[]>([]);
  const [modelIds, setModelIds] = React.useState<number[]>([]);
  const [images, setImages] = React.useState<string[]>([]);
  const [pick, setPick] = React.useState<'pattern' | 'model' | null>(null);
  const [publishing, setPublishing] = React.useState(false);

  /* 我的推文（市场认可进度） */
  const [days, setDays] = React.useState<number>(1);
  const [myList, setMyList] = React.useState<FeedItem[]>([]);
  const [myLoading, setMyLoading] = React.useState(false);
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
    try {
      const res = await api.posts.mine({ days: d, page: 1 });
      setMyList(res?.list || []);
      setDays(d);
    } catch (e) {
      toast((e as Error).message || '我的推文加载失败');
    } finally {
      setMyLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { loadMine(days); }, [days, tick, loadMine]);

  const selWork: Work | undefined = works.find((w) => String(w.id) === workId);
  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const imgMats = materialList.filter((m) => ['png', 'jpg'].includes(m.kind));

  const toggleImg = (src: string) =>
    setImages((prev) => (prev.includes(src) ? prev.filter((x) => x !== src) : prev.length < 6 ? [...prev, src] : prev));

  const publish = async () => {
    if (!content.trim()) { toast('请填写推文内容'); return; }
    if (!workId) { toast('请先选择要发布的关联作品'); return; }
    setPublishing(true);
    try {
      const post = await api.posts.create({
        workId: Number(workId),
        content: content.trim(),
        ...(images.length ? { images } : {}),
        tags,
        patternMatIds: patternIds,
        modelMatIds: modelIds,
      });
      void post;
      toast('推文已发布 🎉（可在「我的推文」查看市场认可进度）', 'check');
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
      toast('热度已提升，但阈值变化较快，请再试一次');
    } catch (e) {
      toast((e as Error).message || '模拟失败');
    } finally {
      setPublishing(false);
    }
  };

  /* 右侧（编辑器模式）/ 空闲态可复用的「我的推文」与「提示」 */
  const tweetsUI = (
    <div className="c-card">
      <div className="c-card-hd" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="c-card-title">我的推文</span>
        <div className="c-tabs">
          {RANGE_TABS.map((r) => (
            <button key={r.key} className={`c-tab ${days === r.key ? 'on' : ''}`} onClick={() => { if (days !== r.key) loadMine(r.key); }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {myLoading ? <Loading text="加载我的推文…" /> : null}
      {!myLoading && myList.length === 0 && (
        <div className="c-state" style={{ padding: '24px 10px' }}>
          <div className="ico" style={{ background: '#F7F8FA', color: '#B7BCC6' }}><Icon name="send" size={22} /></div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>该时间段暂无推文</div>
          <div className="c-hint" style={{ fontSize: 11.5, marginTop: 6 }}>发布后实时展示市场认可进度，达标后系统会自动纳入资源池</div>
        </div>
      )}
      {!myLoading && myList.map((p) => <MyPostRow key={p.id} post={p} simulating={publishing} onSimulate={() => simulate(p)} onOpen={() => navigate(`/post/${p.id}`)} />)}
    </div>
  );

  return (
    <div>
      {/* 顶部：文字介绍 + 发布新推文按钮 */}
      <div className="c-card">
        <div className="row" style={{ gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 320, maxWidth: 640 }}>
            <div className="c-card-title" style={{ marginBottom: 6 }}>发布推文</div>
            <div className="c-hint">
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

      {editing ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          {/* ============ 左：发布编辑器 ============ */}
          <div className="c-card flex-1" style={{ minWidth: 440, border: '1.5px solid #E8B9CB' }}>
            <div className="c-card-hd">
              <span className="c-card-title"><Icon name="send" size={15} color="var(--brand)" />发布新推文</span>
              <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setEditing(false)}><Icon name="close" size={13} />关闭</button>
            </div>

            {/* 1. 关联作品（置顶） */}
            <Field label="关联作品" required hint={selWork ? `已选择「${selWork.title}」，会自动带入其打版/3D 素材` : '从「作品」中选择要发布的内容'}>
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

            {/* 2. 推文内容 */}
            <Field label="推文内容" required hint="介绍你的新作品：设计灵感、工艺亮点、上身感受…">
              <textarea className="c-textarea" rows={5} value={content} onChange={(e) => setContent(e.target.value)}
                placeholder={'把作品介绍给粉丝：\n例如：夏日新作打版首秀，泡泡袖连衣裙上身效果超出预期！'} />
            </Field>

            {/* 3. 话题标签（仅手动输入） */}
            <Field label="话题标签" hint="手动输入后按回车添加（最多 8 个）">
              <TagInput value={tags} onChange={setTags} placeholder="输入标签，如：法式 / 泡泡袖" />
            </Field>

            {/* 4. 配图：选择 + 预览合并 */}
            <Field label={`配图（${images.length}/6）`} hint="从图片素材选择真人/上身图；留空时自动用关联作品图 + 所选素材封面">
              {imgMats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
                  {imgMats.map((m: Material) => {
                    const c = m.cover || '';
                    const on = !!c && images.includes(c);
                    return (
                      <div key={m.id} className={`pick-cell ${on ? 'on' : ''}`} onClick={() => c && toggleImg(c)} style={{ cursor: 'pointer' }}>
                        <div className="ph" style={{ aspectRatio: '1' }}><img src={imgSafe(c)} alt="" onError={hideBadImg} loading="lazy" /></div>
                        <span className="ck">{on ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}</span>
                        <span className="cap">{m.title || m.fileName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!imgMats.length && <div style={{ color: '#9AA0AA', fontSize: 12.5, padding: '8px 0' }}>暂无图片素材（png/jpg），可去素材库导入</div>}

              {images.length > 0 && (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {images.map((s) => (
                    <span key={s} className="row" style={{ position: 'relative' }}>
                      <img src={imgSafe(s)} alt="" onError={hideBadImg} style={{ width: 54, height: 66, objectFit: 'cover', borderRadius: 9 }} />
                      <button onClick={() => toggleImg(s)} style={{ position: 'absolute', right: -5, top: -5, width: 18, height: 18, borderRadius: '50%', background: '#E5484D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={11} />
                      </button>
                    </span>
                  ))}
                  <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setImages([])}><Icon name="trash" size={12} />清空</button>
                </div>
              )}
            </Field>

            {/* 5. 3D / 打版素材（随作品带入，可微调） */}
            <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="flex-1" style={{ minWidth: 220 }}>
                <Field label={`3D 素材${modelIds.length ? ` ×${modelIds.length}` : ''}`}>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />调整 3D 图素材</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                </Field>
              </div>
              <div className="flex-1" style={{ minWidth: 220 }}>
                <Field label={`打版素材${patternIds.length ? ` ×${patternIds.length}` : ''}`}>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />调整打版图素材</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                </Field>
              </div>
            </div>

            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="c-btn c-btn-outline c-btn-lg" onClick={() => setEditing(false)} disabled={publishing}>
                <Icon name="close" size={15} />取消
              </button>
              <button className="c-btn c-btn-primary c-btn-lg flex-1" disabled={publishing || !content.trim() || !workId} onClick={publish}>
                <Icon name="send" size={15} />{publishing ? '发布中…' : '发布推文'}
              </button>
            </div>
          </div>

          {/* ============ 右：我的推文 ============ */}
          <div style={{ width: 380, flexShrink: 0 }}>
            {tweetsUI}
          </div>
        </div>
      ) : (
        /* ============ 空闲态：介绍下方直接是「我的推文」 ============ */
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          {tweetsUI}
        </div>
      )}

      {/* ================= 弹层 ================= */}
      {pick === 'pattern' && <MaterialPickModal title="选择打版素材（DXF/SVG）" mats={patternMats} value={patternIds} onChange={setPatternIds} onClose={() => setPick(null)} />}
      {pick === 'model' && <MaterialPickModal title="选择 3D 素材（OBJ/GLB）" mats={modelMats} value={modelIds} onChange={setModelIds} onClose={() => setPick(null)} />}
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
    <div style={{ padding: '12px 2px', borderBottom: '1px solid #F0F1F4' }}>
      <button onClick={onOpen} className="row" style={{ width: '100%', gap: 8, alignItems: 'flex-start', textAlign: 'left' }}>
        <img src={imgSafe(post.images?.[0])} alt="" onError={hideBadImg} style={{ width: 48, height: 60, objectFit: 'cover', borderRadius: 8, background: '#F1F2F5', flexShrink: 0 }} />
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="ellipsis-2" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{post.content}</div>
          <div className="row" style={{ gap: 6, marginTop: 4, fontSize: 10.5, color: '#9AA0AA' }}>
            <span className="row" style={{ gap: 2 }}><Icon name="heart" size={10} color="#E85C87" />{fmtCount(likes)}</span>
            <span className="row" style={{ gap: 2 }}><Icon name="comment" size={10} color="#3B82F6" />{fmtCount(comments)}</span>
            <span>{relTime(post.createdAt)}</span>
          </div>
        </div>
        {qualified ? <span className="c-badge c-badge-green"><Icon name="check-circle" size={10} />已入池</span> : <span className="c-badge c-badge-gray">验证中</span>}
      </button>

      {/* 进度条 */}
      <div style={{ margin: '8px 0 4px', display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
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
