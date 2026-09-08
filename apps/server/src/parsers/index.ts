/**
 * 解析器总入口：按 kind 分派。返回入库 Material 需要的解析字段 + 友好中文提示。
 */
import type { MaterialKind } from '../types';
import { fail } from '../utils/resp';
import { parseDxf, dxfMaterialSummary } from './dxf';
import { parseObj } from './obj';
import { parseSvgText, svgShapeCount } from './svg';
import { parseImageDataUrl } from './image';
import { parseMetaOnly } from './meta';

export interface ParsePayload {
  kind: MaterialKind;
  ext: string;
  fileName: string;
  /** 文本型(kind=dxf/obj/svg/ai/pdf...)的原始文本；或任意 kind 的 base64 / data-url */
  text?: string;
  /** 二进制 base64（无 data url 头时配合 kind 使用） */
  base64?: string;
}

export interface ParsedMaterialFields {
  layerNames?: string[];
  entityCount?: number;
  patternSvg?: string;
  objPreview?: { vertices: number; faces: number; mesh?: { positions: number[]; faces: number[]; normals?: number[] } | null };
  cover?: string;
  width?: number;
  height?: number;
  note?: string;
  parseWarn?: string;
  size: number;
  kind: MaterialKind;
  ext: string;
}

export const TEXT_KINDS: MaterialKind[] = ['dxf', 'svg', 'obj', 'ai', 'pdf'];

export function importHelpText(): { formats: { kind: MaterialKind; ext: string; desc: string; demo: string }[] } {
  return {
    formats: [
      { kind: 'dxf', ext: '.dxf', desc: '服装 CAD 打版图（DXF R12 子集：LINE/LWPOLYLINE含圆弧bulge/CIRCLE/ARC/POINT/TEXT/LAYER）', demo: 'dress-front-pattern.dxf' },
      { kind: 'obj', ext: '.obj', desc: '3D 网格（CLO/建模软件导出，支持 v/vt/vn/f）', demo: 'dress.obj' },
      { kind: 'svg', ext: '.svg', desc: '印花/矢量图形，直接内嵌展示', demo: 'floral-print.svg' },
      { kind: 'png', ext: '.png', desc: '真人大片/细节图（≤3MB，base64）', demo: '-' },
      { kind: 'jpg', ext: '.jpg', desc: '真人大片/细节图（≤3MB，base64）', demo: '-' },
      { kind: 'glb', ext: '.glb', desc: 'GLB 3D 模型（仅元数据入库）', demo: '-' },
      { kind: 'zprj', ext: '.zprj', desc: 'CLO 3D 项目包（仅元数据入库）', demo: '-' },
      { kind: 'ai', ext: '.ai', desc: 'Illustrator 矢量（仅元数据入库）', demo: '-' },
      { kind: 'pdf', ext: '.pdf', desc: 'PDF 打版图（仅元数据入库）', demo: '-' },
    ],
  };
}

export function parseByKind(p: ParsePayload): ParsedMaterialFields {
  const ext = p.ext.toLowerCase();
  const kind = p.kind;
  const fileName = p.fileName || `untitled.${ext}`;

  // 图片
  if (kind === 'png' || kind === 'jpg') {
    let dataUrl: string | null = null;
    if (p.text && p.text.startsWith('data:image/')) dataUrl = p.text;
    else if (p.base64) dataUrl = `data:image/${kind === 'png' ? 'png' : 'jpeg'};base64,${p.base64}`;
    else if (p.text) dataUrl = `data:image/${kind === 'png' ? 'png' : 'jpeg'};base64,${p.text}`;
    if (!dataUrl) fail('IMAGE_MISSING', '图片导入需要提供 base64 内容');
    const img = parseImageDataUrl(dataUrl);
    return {
      kind,
      ext,
      cover: img.cover,
      width: img.width,
      height: img.height,
      size: img.size,
      note: img.note,
      parseWarn: img.parseWarn,
    };
  }

  // 纯元数据格式
  if (kind === 'glb' || kind === 'zprj' || kind === 'ai' || kind === 'pdf') {
    const meta = parseMetaOnly(ext, fileName, (p.base64 ? Buffer.from(p.base64, 'base64').length : 0) || (p.text ? Buffer.byteLength(p.text, 'utf8') : 0));
    return {
      kind, ext,
      cover: meta.cover,
      width: meta.width,
      height: meta.height,
      note: meta.note,
      parseWarn: meta.parseWarn,
      size: meta.parseWarn ? 0 : 0,
    };
  }

  // 文本型（dxf/obj/svg；ai/pdf 在上面已拦截，若 ext 是 ai/pdf 却 kind=svg 走文本）
  if (!p.text && !p.base64) fail('CONTENT_MISSING', '请提供文件内容（文本内容或 base64）');
  const text = p.text ?? Buffer.from(p.base64!, 'base64').toString('utf8');
  const size = Buffer.byteLength(text, 'utf8');

  if (kind === 'dxf') {
    const r = parseDxf(text, { title: fileName.replace(/\.dxf$/i, '') });
    const s = dxfMaterialSummary(r);
    return { kind, ext, ...s, size, note: r.note };
  }
  if (kind === 'svg') {
    const r = parseSvgText(text);
    return {
      kind, ext,
      patternSvg: r.patternSvg,
      width: r.width,
      height: r.height,
      entityCount: svgShapeCount(r.patternSvg),
      layerNames: ['SVG'],
      size,
      note: r.note,
      parseWarn: r.parseWarn,
    };
  }
  if (kind === 'obj') {
    const r = parseObj(text);
    return {
      kind, ext,
      objPreview: { vertices: r.vertices, faces: r.faces, mesh: r.mesh },
      size,
      note: r.note,
      parseWarn: r.parseWarn,
      width: undefined, height: undefined,
    };
  }
  throw new Error(`暂不支持 kind=${kind}（支持 dxf/obj/svg/png/jpg/glb/zprj/ai/pdf）`);
}

/** 文本/二进制内容判型（前端若不传 kind 时的兜底） */
export function guessKindByExt(fileName: string): MaterialKind {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const map: Record<string, MaterialKind> = {
    dxf: 'dxf', obj: 'obj', svg: 'svg', png: 'png', jpg: 'jpg', jpeg: 'jpg',
    glb: 'glb', zprj: 'zprj', ai: 'ai', pdf: 'pdf',
  };
  return map[ext] || 'pdf';
}
