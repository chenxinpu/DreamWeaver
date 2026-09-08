/* ============================================================================
 * UploadBox —— 文件选择 + 拖拽 + 类型过滤 + 读取为 text / base64
 * 供创作者素材库导入与 mall 用户上传复用。
 * ==========================================================================*/
import React from 'react';
import Icon from '../Icon';
import { useToast } from '../Sheet';
import { fmtCount } from './utils';

export interface PickedFile {
  name: string;
  ext: string;
  kind: string;       // dxf/svg/obj/png/jpg/…
  size: number;
  text?: string;      // 文本类文件内容
  base64?: string;    // 图片等二进制 → data url
}

export const EXT_KIND: Record<string, string> = {
  dxf: 'dxf', svg: 'svg', obj: 'obj', glb: 'glb', zprj: 'zprj',
  png: 'png', jpg: 'jpg', jpeg: 'jpg', ai: 'ai', pdf: 'pdf', txt: 'svg',
};
export const KIND_LABEL: Record<string, string> = {
  dxf: 'DXF 打版图', svg: 'SVG 图案', obj: 'OBJ 3D 模型', glb: 'GLB 3D 场景',
  png: 'PNG 图片', jpg: '图片', zprj: 'CLO 工程包(zprj)', ai: 'Illustrator(ai)', pdf: 'PDF',
};

/** 读取文件；text 类返回文本，图片类返回 base64 data url，其他仅元数据 */
export function readPickedFile(file: File): Promise<PickedFile> {
  const name = file.name || 'untitled';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  const kind = EXT_KIND[ext] || (file.type.startsWith('image/') ? 'png' : 'raw');
  const base: PickedFile = { name, ext, kind, size: file.size };
  const TEXT_EXTS = new Set(['dxf', 'svg', 'obj', 'ai', 'txt', 'zprj']);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (TEXT_EXTS.has(ext) || kind === 'obj') {
        base.text = String(reader.result || '');
      } else if (kind === 'png' || kind === 'jpg') {
        base.base64 = String(reader.result || '');
      }
      resolve(base);
    };
    reader.onerror = () => resolve(base);
    if (TEXT_EXTS.has(ext) || kind === 'obj') reader.readAsText(file, 'utf-8');
    else if (kind === 'png' || kind === 'jpg') reader.readAsDataURL(file);
    else resolve(base);
  });
}

interface UploadBoxProps {
  acceptKinds?: string[];     // 允许的素材种类（默认全部）
  multiple?: boolean;
  compact?: boolean;
  title?: string;
  hint?: string;
  onFiles: (files: PickedFile[]) => void;
  buttonText?: string;
}

const ACCEPT_ATTR = '.dxf,.svg,.obj,.glb,.png,.jpg,.jpeg,.zprj,.ai,.pdf';

export default function UploadBox({ acceptKinds, multiple, compact, title, hint, onFiles, buttonText }: UploadBoxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [dragging, setDragging] = React.useState(false);
  const dragCount = React.useRef(0);

  const allowed = React.useMemo(() => {
    if (!acceptKinds?.length) return null;
    const set = new Set(acceptKinds);
    return (k: string) => set.has(k);
  }, [acceptKinds]);

  const handle = React.useCallback(async (list: FileList | null) => {
    if (!list?.length) return;
    const picked: PickedFile[] = [];
    for (const f of Array.from(list)) {
      const p = await readPickedFile(f);
      if (allowed && !allowed(p.kind) && !['raw'].includes(p.kind)) {
        toast(`不支持的文件类型：.${p.ext || '未知'}`);
        continue;
      }
      picked.push(p);
    }
    if (picked.length) onFiles(multiple ? picked : [picked[0]]);
  }, [allowed, multiple, onFiles, toast]);

  const allowedText = acceptKinds?.length
    ? acceptKinds.map((k) => (KIND_LABEL[k] || k.toUpperCase())).join(' / ')
    : 'DXF · SVG · OBJ · 图片…';

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); dragCount.current += 1; setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); dragCount.current -= 1; if (dragCount.current <= 0) setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dragCount.current = 0;
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        style={{
          border: `1.6px dashed ${dragging ? 'var(--brand)' : 'var(--line-strong, #E2DAD4)'}`,
          borderRadius: 16,
          background: dragging ? 'var(--brand-soft)' : 'var(--bg)',
          padding: compact ? '18px 14px' : '30px 18px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all .18s ease',
        }}
      >
        <div style={{
          width: compact ? 40 : 52, height: compact ? 40 : 52, margin: '0 auto 10px', borderRadius: '50%',
          background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 18px rgba(232,92,135,.3)',
        }}>
          <Icon name="upload" size={compact ? 19 : 24} color="#fff" />
        </div>
        <div style={{ fontSize: compact ? 13 : 14.5, fontWeight: 700 }}>{title || '点击选择文件，或将文件拖拽到此处'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6 }}>
          支持：{allowedText}
        </div>
        {buttonText && (
          <span className="btn btn-outline btn-sm" style={{ marginTop: 12, pointerEvents: 'none' }}>{buttonText}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={ACCEPT_ATTR}
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

/** 文件信息行（展示已选文件） */
export function FileMetaRow({ f, onRemove }: { f: PickedFile; onRemove?: () => void }) {
  return (
    <div className="row" style={{ gap: 10, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px' }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--brand-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-deep)',
      }}>
        <Icon name={f.kind === 'obj' ? 'layers' : f.kind === 'dxf' ? 'pen-tool' : 'image'} size={17} />
      </span>
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
          {KIND_LABEL[f.kind] || f.kind?.toUpperCase()} · {fmtCount(f.size)}B{f.ext ? ` · .${f.ext}` : ''}
        </div>
      </div>
      {onRemove && (
        <button onClick={onRemove} style={{ color: 'var(--text-3)', padding: 4 }}>
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
