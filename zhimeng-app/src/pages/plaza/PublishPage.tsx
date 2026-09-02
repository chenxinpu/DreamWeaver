import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { Price } from '../../components/ui';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import { img, me, STYLE_TAGS, worksByCreator } from '../../data/mock';
import { hideImg } from './parts';

/* 模拟相册图片 */
const ALBUM_IMAGES = [
  'style-01.jpg', 'style-02.jpg', 'style-03.jpg', 'style-04.jpg', 'style-05.jpg',
  'style-06.jpg', 'style-07.jpg', 'style-08.jpg', 'style-09.jpg', 'style-10.jpg',
  'dress-04.jpg', 'knit-01.jpg', 'fabric-01.jpg',
].map(img);

/* ============ 发布推文 ============ */
export default function PublishPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [content, setContent] = React.useState('');
  const [type, setType] = React.useState<'image' | 'video'>('image');
  const [images, setImages] = React.useState<string[]>([]);
  const [albumOpen, setAlbumOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [linkedIds, setLinkedIds] = React.useState<number[]>([]);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const myWorks = worksByCreator(me.id);

  const toggleImage = (src: string) => {
    if (images.includes(src)) { setImages(images.filter((x) => x !== src)); return; }
    if (images.length >= 9) { toast('最多选择9张图片'); return; }
    setImages([...images, src]);
  };

  const addTag = (raw: string) => {
    const v = raw.trim().replace(/^#/, '');
    if (!v) return;
    if (tags.includes(v)) { toast('标签已存在'); return; }
    if (tags.length >= 5) { toast('最多添加5个标签'); return; }
    setTags([...tags, v]);
    setTagInput('');
  };

  const toggleLinked = (wid: number) => {
    if (linkedIds.includes(wid)) { setLinkedIds(linkedIds.filter((x) => x !== wid)); return; }
    if (linkedIds.length >= 3) { toast('最多关联3个作品哦'); return; }
    setLinkedIds([...linkedIds, wid]);
  };

  const submit = () => {
    if (!content.trim()) { toast('写点什么再发布吧'); return; }
    toast('发布成功，已进入审核（≤2小时）', 'check');
    navigate('/plaza');
  };

  return (
    <div className="page no-tab">
      <NavBar
        back
        title="发布推文"
        right={
          <button onClick={submit} style={{ height: 30, padding: '0 16px', borderRadius: 99, background: 'var(--brand-grad)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 3px 8px rgba(232,92,135,.35)' }}>
            发布
          </button>
        }
      />

      <div className="page-body">
        {/* 内容类型切换 */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>内容类型</span>
          <Segmented options={[{ value: 'image', label: '图文' }, { value: 'video', label: '视频' }]} value={type} onChange={setType} size="sm" />
        </div>

        {/* 正文 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>正文</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你的穿搭灵感…"
            style={{ width: '100%', minHeight: 130, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 15, lineHeight: 1.7 }}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'right' }}>{content.length}/500</div>
        </div>

        {/* 图片 / 视频 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{type === 'image' ? '添加图片' : '上传视频'}</div>
          {type === 'video' ? (
            <button onClick={() => toast('视频上传功能开发中～')} className="col" style={{ width: '100%', height: 140, borderRadius: 14, border: '1.5px dashed var(--line)', background: '#FAF8F6', color: 'var(--text-3)', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="camera" size={30} />
              <span style={{ fontSize: 13 }}>上传视频（MP4，时长 ≤ 3 分钟）</span>
            </button>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {images.map((src) => (
                  <div key={src} className="img-ph" style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setPreview(src)} onError={hideImg} />
                    <button onClick={() => toggleImage(src)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 9 && (
                  <button onClick={() => setAlbumOpen(true)} className="col" style={{ aspectRatio: '1', borderRadius: 10, border: '1.5px dashed var(--line)', background: '#FAF8F6', color: 'var(--text-3)', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Icon name="plus" size={24} />
                    <span style={{ fontSize: 11 }}>{images.length}/9</span>
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>点击图片可预览，最多添加 9 张</div>
            </>
          )}
        </div>

        {/* 关联作品 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>关联作品</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>最多 3 个 · {linkedIds.length}/3</span>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {myWorks.map((w) => {
              const sel = linkedIds.includes(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggleLinked(w.id)}
                  className="row"
                  style={{ gap: 10, padding: 10, borderRadius: 12, border: `1.5px solid ${sel ? 'var(--brand)' : 'var(--line)'}`, background: sel ? 'var(--brand-soft)' : '#fff', textAlign: 'left', transition: 'all .15s ease' }}
                >
                  <div className="img-ph" style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                    <img src={w.cover} alt={w.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideImg} />
                  </div>
                  <div className="flex-1 col" style={{ minWidth: 0 }}>
                    <span className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</span>
                    <div className="row" style={{ gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{w.category}</span>
                      <Price value={w.price} size={13} />
                    </div>
                  </div>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${sel ? 'var(--brand)' : 'var(--line)'}`, background: sel ? 'var(--brand-grad)' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {sel && <Icon name="check" size={13} strokeWidth={2.6} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 标签 */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            标签 <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>{tags.length}/5</span>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {tags.map((t) => (
                <span key={t} className="row" style={{ gap: 4, background: 'var(--brand-soft)', color: 'var(--brand-deep)', borderRadius: 99, padding: '5px 10px', fontSize: 12.5, fontWeight: 600 }}>
                  #{t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{ display: 'flex', padding: 1 }}>
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="输入标签，回车添加"
              style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 99, border: '1px solid var(--line)', padding: '0 14px', fontSize: 13, background: '#fff', outline: 'none' }}
            />
            <button onClick={() => addTag(tagInput)} style={{ height: 36, padding: '0 16px', borderRadius: 99, background: 'var(--brand-grad)', color: '#fff', fontSize: 13, fontWeight: 600 }}>添加</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '12px 0 8px' }}>热门标签</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STYLE_TAGS.map((s) => {
              const on = tags.includes(s);
              return (
                <button key={s} onClick={() => (on ? setTags(tags.filter((x) => x !== s)) : addTag(s))} className={`tag ${on ? 'tag-primary' : 'tag-line'}`}>{s}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 相册选择 Sheet */}
      <Sheet open={albumOpen} onClose={() => setAlbumOpen(false)} title="选择图片" height="62%">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingBottom: 16 }}>
          {ALBUM_IMAGES.map((src) => {
            const sel = images.includes(src);
            return (
              <button key={src} onClick={() => toggleImage(src)} className="img-ph" style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideImg} />
                {sel && (
                  <span style={{ position: 'absolute', inset: 0, background: 'rgba(232,92,135,.22)', border: '2px solid var(--brand)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={13} strokeWidth={2.6} />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* 图片预览 Sheet */}
      <Sheet open={!!preview} onClose={() => setPreview(null)} title="图片预览" height="72%">
        {preview && <img src={preview} alt="" style={{ width: '100%', borderRadius: 12 }} />}
      </Sheet>
    </div>
  );
}
