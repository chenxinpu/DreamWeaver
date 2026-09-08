/**
 * 占位解析：glb / zprj / ai / pdf 等主流软件结果文件——仅元数据 + 按 ext 的封面占位 + parseWarn。
 */
import { svgDataUrl } from '../utils/misc';
import type { MaterialKind } from '../types';

export interface MetaParseResult {
  cover: string;             // 内联 SVG 占位（含格式标签），前端可直接 <img>
  note?: string;
  parseWarn: string;
  width?: number;
  height?: number;
}

const EXT_NAME: Record<string, string> = {
  glb: 'GLB 3D 模型', zprj: 'CLO 项目包', ai: 'Adobe Illustrator', pdf: 'PDF 打版文件',
};

const EXT_ICON: Record<string, string> = {
  glb: '🧊', zprj: '🧵', ai: '✒️', pdf: '📄',
};

export function parseMetaOnly(ext: string, fileName: string, bytes: number): MetaParseResult {
  const name = EXT_NAME[ext] || ext.toUpperCase();
  const icon = EXT_ICON[ext] || '📦';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">` +
    `<rect width="320" height="240" fill="#F6F1F0"/>` +
    `<text x="160" y="92" text-anchor="middle" font-size="52">${icon}</text>` +
    `<text x="160" y="132" text-anchor="middle" font-size="16" fill="#D44771" font-weight="600">${name}</text>` +
    `<text x="160" y="158" text-anchor="middle" font-size="12" fill="#9B9398">${esc(fileName)}</text>` +
    `<text x="160" y="180" text-anchor="middle" font-size="11" fill="#B4ABB1">仅元数据入库 · ${(bytes / 1024).toFixed(1)} KB</text>` +
    `</svg>`;
  return {
    cover: svgDataUrl(svg),
    width: 320,
    height: 240,
    parseWarn: '该格式暂以元数据入库：已保存文件名/大小/来源，后续可在素材库查看来源信息。',
    note: `${name} · 仅元数据`,
  };
}

export function metaKindFromExt(ext: string): MaterialKind {
  if (ext === 'glb' || ext === 'zprj' || ext === 'ai' || ext === 'pdf') return ext as MaterialKind;
  return 'glb';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
