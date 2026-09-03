/* =========================================================
 * 核心创作链路 · 工作台共享件（pipeline/parts.tsx）
 * SheetSvg：把 PatternSheet（pattern.ts）渲染为"制图纸" SVG
 *   - 暖白纸底 + 细网格（每 10 单位浅线）
 *   - path 面料淡色填充 + 深棕描线 / 对折虚线+标签 / 纱向箭头
 *   - 剪口小三角 / 尺寸标注（虚线引线 + 两端箭头 + 「label cm」实时文字）
 *   - 手柄（仅 interactive+selected）：可拖圆圈，data-param 供页面换算增量
 *   - 放码 scale（以折线 x=16 为原点）/ 缝份 1.04 虚线示意 / 标注文字层
 * ========================================================= */
import React from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { SHEET_W, SHEET_H, SHEET_VIEWBOX } from '../../../data/pattern';
import type { Handle, PatternSheet } from '../../../data/pattern';

/* ---------- 制图配色 ---------- */
export const SHEET_PAPER = '#FBF8F3';   // 暖白纸感
export const SHEET_LINE = '#5B4A3F';    // 描线深棕
export const SHEET_DIM = '#C2557F';     // 尺寸线品牌粉
export const SHEET_GRID = '#F1E8DA';
export const SHEET_GRID_H = '#E7D9C4';
export const SHEET_HANDLE_A = '#F27BA0';
export const SHEET_HANDLE_B = '#D44771';

export interface SheetNote { id: number; x: number; y: number; text: string }

interface SheetSvgProps {
  sheet: PatternSheet;
  uid: string;                          // 实例唯一 id（defs 防串号）
  interactive?: boolean;                // 主画布交互模式
  selected?: boolean;                   // 显示手柄（仅选中片）
  grade?: number;                       // 放码系数 0.92/1/1.08/1.16（路径整体缩放）
  seam?: boolean;                       // 缝份 1cm 示意（虚线放大 1.04）
  notes?: SheetNote[];
  fill?: string;                        // 片料淡色（默认暖米）
  dense?: boolean;                      // 缩略模式：隐藏标注/手柄/剪口/文字
  onPointerDown?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (e: RPointerEvent<SVGSVGElement>) => void;
  className?: string;
  style?: CSSProperties;
}

/** 标注文字「label cm」（dim 为 engine 给的引线段） */
function DimText({ label, cm, x, y }: { label: string; cm: number; x: number; y: number }) {
  const txt = `${label} ${cm}cm`;
  const cx = Math.max(8, Math.min(SHEET_W - 8, x));
  const anchor: 'start' | 'middle' | 'end' = cx <= 30 ? 'start' : cx >= SHEET_W - 30 ? 'end' : 'middle';
  const ax = anchor === 'start' ? cx + 2 : anchor === 'end' ? cx - 2 : cx;
  return (
    <text
      x={ax} y={y} textAnchor={anchor}
      fontSize={8.6} fontWeight={700} fill={SHEET_DIM}
      stroke={SHEET_PAPER} strokeWidth={2.6} paintOrder="stroke" style={{ pointerEvents: 'none' }}
    >
      {txt}
    </text>
  );
}

export function SheetSvg({
  sheet, uid, interactive = false, selected = false, grade = 1, seam = false,
  notes = [], fill = '#F6ECDD', dense = false,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, className, style,
}: SheetSvgProps) {
  const gradId = `${uid}-hg`;
  const markId = `${uid}-arr`;
  const k = Math.abs(grade || 1);
  const geoTransform = k !== 1
    ? `translate(16 0) scale(${k}) translate(-16 0)`
    : undefined;
  const showDims = !dense && sheet.dims.length > 0;

  /* 两个同坐标手柄（摆量 hem 与 衣长 hemV 常重叠）—— 错开渲染，命中各自 param */
  const handlePos = (h: Handle): { x: number; y: number } => {
    const dup = sheet.handles.filter((o) => Math.abs(o.x - h.x) < 2 && Math.abs(o.y - h.y) < 2);
    if (dup.length < 2) return { x: h.x, y: h.y };
    const idx = dup.indexOf(h);
    return h.dir === 'v'
      ? { x: h.x + 9 + idx * 1, y: h.y + 6 }
      : { x: h.x - 2, y: h.y - 2 - idx * 10 };
  };

  return (
    <svg
      viewBox={SHEET_VIEWBOX}
      className={className}
      style={{ display: 'block', width: '100%', aspectRatio: `${SHEET_W} / ${SHEET_H}`, touchAction: 'none', userSelect: 'none', ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SHEET_HANDLE_A} />
          <stop offset="1" stopColor={SHEET_HANDLE_B} />
        </linearGradient>
        <marker id={markId} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4.6" markerHeight="4.6" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={SHEET_DIM} />
        </marker>
      </defs>

      {/* 纸底 */}
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill={SHEET_PAPER} />
      {/* 细网格：每 10px 浅线、每 50px 略深 */}
      <g stroke={SHEET_GRID} strokeWidth={0.5}>
        {Array.from({ length: Math.floor(SHEET_W / 10) + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={SHEET_H} />
        ))}
        {Array.from({ length: Math.floor(SHEET_H / 10) + 1 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 10} x2={SHEET_W} y2={i * 10} />
        ))}
      </g>
      <g stroke={SHEET_GRID_H} strokeWidth={0.6}>
        {Array.from({ length: Math.floor(SHEET_W / 50) + 1 }).map((_, i) => (
          <line key={`V${i}`} x1={i * 50} y1={0} x2={i * 50} y2={SHEET_H} />
        ))}
        {Array.from({ length: Math.floor(SHEET_H / 50) + 1 }).map((_, i) => (
          <line key={`H${i}`} x1={0} y1={i * 50} x2={SHEET_W} y2={i * 50} />
        ))}
      </g>

      {/* ===== 版片几何组（放码 scale 作用于整体） ===== */}
      <g transform={geoTransform}>
        {/* 缝份示意：1.04 虚线淡色（围绕片身中部） */}
        {seam && (
          <path
            d={sheet.path}
            transform={`translate(${SHEET_W / 2} ${SHEET_H / 2}) scale(1.04) translate(${-SHEET_W / 2} ${-SHEET_H / 2})`}
            fill="none" stroke="#C9A23F" strokeWidth={1} strokeDasharray="3 2.4" opacity={0.75}
          />
        )}
        <path
          d={sheet.path}
          fill={fill} stroke={SHEET_LINE} strokeWidth={1.7} strokeLinejoin="round"
        />
        {/* 对折中线 */}
        {sheet.foldLine && (
          <g>
            <line x1={16} y1={14} x2={16} y2={SHEET_H - 4} stroke={SHEET_LINE} strokeWidth={1.1} strokeDasharray="5 4" opacity={0.75} />
            {!dense && (
              <text x={21} y={13} fontSize={7.6} fill={SHEET_LINE} stroke={SHEET_PAPER} strokeWidth={2.4} paintOrder="stroke">
                对折
              </text>
            )}
          </g>
        )}
        {/* 纱向：双端箭头 + 标签 */}
        {sheet.grain && (() => {
          const nums = (sheet.grain.match(/[\d.]+/g) || []).map((s) => parseFloat(s));
          const x1 = nums[0] ?? 105; const y1 = nums[1] ?? 20;
          const x2 = nums[2] ?? 105; const y2 = nums[3] ?? 200;
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const L = 3.4;
          const head = (cx: number, cy: number, dir: number) => {
            const a = ang + Math.PI * dir;
            return `M ${cx} ${cy} l ${Math.cos(a) * L} ${Math.sin(a) * L} M ${cx} ${cy} l ${Math.cos(a - 2.4) * L} ${Math.sin(a - 2.4) * L}`;
          };
          return (
            <g stroke={SHEET_LINE} strokeWidth={0.9} opacity={0.85}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <path d={`${head(x1, y1, 1)} ${head(x2, y2, 0)}`} fill="none" />
              {!dense && (
                <text x={(x1 + x2) / 2 + 3} y={(y1 + y2) / 2} fontSize={7.6} fill={SHEET_LINE} stroke={SHEET_PAPER} strokeWidth={2.4} paintOrder="stroke" style={{ pointerEvents: 'none' }}>
                  纱向
                </text>
              )}
            </g>
          );
        })()}
        {/* 剪口（小三角） */}
        {!dense && sheet.notches.map((n, i) => (
          <g key={i}>
            <path d={`M ${n.x} ${n.y} l 4.4 -2.6 l 0 5.2 Z`} fill={SHEET_LINE} />
            <line x1={n.x} y1={n.y} x2={n.x - 3} y2={n.y} stroke={SHEET_LINE} strokeWidth={0.8} />
          </g>
        ))}
      </g>

      {/* ===== 尺寸标注（不随放码变化：cm 不变） ===== */}
      {showDims && (
        <g>
          {sheet.dims.map((d, i) => {
            const mx = (d.from.x + d.to.x) / 2;
            const horizontal = Math.abs(d.from.y - d.to.y) < 1;
            const ty = horizontal ? Math.min(d.from.y, d.to.y) - 2 : (d.from.y + d.to.y) / 2 + 3;
            return (
              <g key={i} style={{ pointerEvents: 'none' }}>
                <line
                  x1={d.from.x} y1={d.from.y} x2={d.to.x} y2={d.to.y}
                  stroke={SHEET_DIM} strokeWidth={0.8} strokeDasharray="1.6 3.2"
                  markerStart={`url(#${markId})`} markerEnd={`url(#${markId})`}
                />
                <DimText label={d.label} cm={d.cm} x={mx} y={ty} />
              </g>
            );
          })}
        </g>
      )}

      {/* ===== 手柄（仅主画布 + 选中片；竖向先渲染，确保命中优先为长度手柄） ===== */}
      {interactive && selected && [...sheet.handles]
        .sort((a, b) => (a.dir === 'v' ? 0 : 1) - (b.dir === 'v' ? 0 : 1))
        .map((h, i) => {
        const p = handlePos(h);
        const glyph = h.dir === 'h' ? '↔' : '↕';
        return (
          <g
            key={`${h.id}-${i}`}
            data-handle={h.id}
            data-param={h.param}
            style={{ cursor: 'grab', touchAction: 'none' }}
          >
            <title>{h.hint}</title>
            <circle cx={p.x} cy={p.y} r={9} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={6.2} fill={`url(#${gradId})`} stroke="#fff" strokeWidth={1.6} />
            <text x={p.x} y={p.y + 2.6} textAnchor="middle" fontSize={7.6} fill="#fff" fontWeight={800} style={{ pointerEvents: 'none' }}>
              {glyph}
            </text>
          </g>
        );
      })}

      {/* ===== 标注文字层 ===== */}
      {!dense && notes.map((n, i) => (
        <g key={n.id} style={{ pointerEvents: 'none' }}>
          <circle cx={n.x} cy={n.y} r={1.6} fill={SHEET_LINE} />
          <text x={n.x + 4} y={n.y + 3.4} fontSize={8.2} fill="#8A5A00" stroke={SHEET_PAPER} strokeWidth={2.4} paintOrder="stroke" fontWeight={700}>
            {`${i + 1}. ${n.text || '标注'}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- 版片清单卡片需要的小信息 ---------- */
export const FABRIC_EST: Record<string, string> = {
  dress: '≈2.2m', shirt: '≈1.4m', skirt: '≈1.4m', coat: '≈2.6m', pants: '≈1.6m', suit: '≈1.4m（上衣）+1.1m（裙）',
};

export const TH: React.CSSProperties = {
  padding: '6px 8px', fontSize: 10.5, fontWeight: 800, background: '#FBF0F4', color: '#D44771',
  borderBottom: '1px solid rgba(232,92,135,.28)', textAlign: 'left', whiteSpace: 'nowrap',
};
export const TD: React.CSSProperties = {
  padding: '6px 8px', fontSize: 11, color: '#6B6470', borderBottom: '1px solid #EDE7E2', whiteSpace: 'nowrap',
};
