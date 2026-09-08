/**
 * 图片解析（png/jpg）：收 base64，返回 data-url 存入 cover；手工解析头部得到像素尺寸。
 * 大小上限 3MB（原始字节）。
 */
import { fail } from '../utils/resp';

export interface ImageParseResult {
  cover: string;          // data:image/...;base64,...
  width?: number;
  height?: number;
  size: number;
  kind: 'png' | 'jpg';
  note?: string;
  parseWarn?: string;
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export function parseImageDataUrl(dataUrl: string, hintKind?: 'png' | 'jpg'): ImageParseResult {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) fail('IMAGE_FORMAT', '仅支持 png / jpg 图片（请提交 data:image/...;base64, 数据）');
  const kind = (m![1] === 'png' ? 'png' : 'jpg') as 'png' | 'jpg';
  if (hintKind && kind !== hintKind) { /* kind 以 data-url 头为准 */ }
  const buf = Buffer.from(m![2], 'base64');
  if (buf.length === 0) fail('IMAGE_EMPTY', '图片内容为空');
  if (buf.length > MAX_IMAGE_BYTES) fail('IMAGE_TOO_LARGE', '图片超过 3MB 大小上限，请压缩后重试');
  const dim = readImageSize(buf, kind);
  return {
    cover: dataUrl,
    ...(dim ? { width: dim.w, height: dim.h } : {}),
    size: buf.length,
    kind,
    note: `图片已解析（${kind.toUpperCase()}，${buf.length} 字节）`,
    parseWarn: dim ? undefined : '未能读取图片尺寸（头部不标准）',
  };
}

/** 纯 JS 读取 PNG/JPEG 像素尺寸 */
function readImageSize(buf: Buffer, kind: 'png' | 'jpg'): { w: number; h: number } | null {
  if (kind === 'png') {
    // PNG: 8-byte signature + IHDR (length,type) → width(4) height(4)
    if (buf.length >= 24 && buf.readUInt32BE(12) === 0x49484452) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    return null;
  }
  // JPEG: 扫描 SOF 标记
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && h > 0) return { w, h };
      return null;
    }
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) return null;
    i += 2 + segLen;
  }
  return null;
}

/** 纯 base64 字符串 → data-url（无头时按 kind 猜测） */
export function rawBase64ToDataUrl(b64: string, kind: 'png' | 'jpg' | 'jpeg'): string {
  const k = kind === 'png' ? 'png' : 'jpeg';
  return `data:image/${k};base64,${b64}`;
}
