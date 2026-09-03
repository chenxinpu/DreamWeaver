/* ============ 2D 画布（设计稿）类型 ============ */

/** 自由笔触 */
export interface SketchStroke { color: string; width: number; path: string; opacity?: number }
/** 区域填充：color=纯色 / fabric=面料ID / pattern=图案 */
export interface SketchFill { regionId: string; kind: 'color' | 'fabric' | 'pattern'; value: string }
/** 标注（尺寸/文字） */
export interface SketchAnnot { x: number; y: number; text: string; color?: string }

export interface SketchWork {
  id: number;
  title: string;
  templateId: string;
  strokes: SketchStroke[];
  fills: SketchFill[];
  annots: SketchAnnot[];
  updatedAt: string;
  aiSource?: boolean;
  /** 已生成工艺单 */
  techpack?: boolean;
}

/** 人体模板 / 平铺模板（供描画与区域填充） */
export interface SketchRegion { id: string; name: string; d: string }
export interface SketchTemplate {
  id: string;
  name: string;
  kind: 'croquis' | 'flat';
  view: 'front' | 'back' | 'side';
  w: number;
  h: number;
  /** 人体参考（仅 croquis）：由简单 SVG 图形拼合，纯线条 */
  bodyPaths: { d: string; sw?: number }[];
  /** 可填充的服装区域（闭合路径） */
  regions: SketchRegion[];
  /** 一句话用途提示 */
  hint: string;
}
