/* ============================================================================
 * PatternSvg —— 打版图（DXF→SVG / SVG）内联展示
 *  - 平移（拖拽）/ 缩放（滚轮 + 按钮）
 *  - 图层图例（按 <g data-layer> 或按颜色提取，开关）
 *  - 尺寸标注显示开关（缩放比例尺）
 * ==========================================================================*/
import React from 'react';
import Icon from '../Icon';
import { useToast } from '../Sheet';

interface PatternSvgProps {
  /** 后端生成的 patternSvg 字符串 */
  svg: string;
  title?: string;
  height?: number;
  /** 显式图层（名称+颜色）；缺省时从 svg 内自动提取 */
  layers?: { name: string; color: string }[];
  filename?: string;
}

/** 从 svg 文本中粗提取图层颜色（stroke / fill 主色） */
function detectLayers(svg: string): { name: string; color: string }[] {
  const colors = new Map<string, string>();
  const re = /(?:data-layer|class|id)="([^"]*)".*?(?:stroke|fill)="?(#[0-9a-fA-F]{3,8}|(?:rgb?\([^)]*\)))?/g;
  let m: RegExpExecArray | null;
  let fallback = 0;
  while ((m = re.exec(svg)) && fallback < 200) {
    fallback++;
    const name = m[1] || `图层${colors.size + 1}`;
    const color = m[2] || `#${Math.floor(0x9aa0aa + Math.random() * 0x304040).toString(16).padStart(6, '0')}`;
    if (!colors.has(name) && colors.size < 12) colors.set(name, color);
  }
  if (!colors.size) {
    // 退而求其次：找 stroke/fill 颜色序列
    const cre = /(?:stroke|fill)="(#[0-9a-fA-F]{3,8})"/g;
    const seen: string[] = [];
    let i = 0;
    while ((m = cre.exec(svg)) && seen.length < 8 && i < 400) { i++; const c = m[1]; if (!seen.includes(c)) { seen.push(c); colors.set(`图层${seen.length}`, c); } }
  }
  return Array.from(colors.entries()).map(([name, color]) => ({ name, color }));
}

export default function PatternSvg({ svg, title, height = 360, layers: propLayers, filename }: PatternSvgProps) {
  const toast = useToast();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [showDims, setShowDims] = React.useState(true);
  const [showLegend, setShowLegend] = React.useState(true);
  const layers = React.useMemo(() => propLayers || detectLayers(svg || ''), [svg, propLayers]);
  const safe = svg?.trim() || '';

  if (!safe) {
    return (
      <div style={{ height: 160, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
        暂无打版图数据（.dxf / .svg 素材可解析出 patternSvg）
      </div>
    );
  }

  const zoomBy = (f: number) => setScale((s) => Math.max(0.2, Math.min(8, s * f)));

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: '#fff' }}>
      {/* 工具栏 */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div className="row" style={{ gap: 6, minWidth: 0 }}>
          <Icon name="pen-tool" size={15} color="var(--brand-deep)" />
          <span className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{title || '打版图预览'}</span>
          {filename && <span className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)' }}>{filename}</span>}
        </div>
        <div className="row" style={{ gap: 4 }}>
          <ToolBtn title="缩小" onClick={() => zoomBy(0.8)}><Icon name="zoom-out" size={13} /></ToolBtn>
          <span style={{ fontSize: 11, color: 'var(--text-2)', width: 34, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <ToolBtn title="放大" onClick={() => zoomBy(1.25)}><Icon name="zoom-in" size={13} /></ToolBtn>
          <ToolBtn title="适应窗口" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}><Icon name="refresh" size={13} /></ToolBtn>
          <ToolBtn title="图例开关" active={showLegend} onClick={() => setShowLegend((v) => !v)}><Icon name="layers" size={13} /></ToolBtn>
          <ToolBtn title="尺寸标注开关" active={showDims} onClick={() => { setShowDims((v) => !v); toast(showDims ? '已隐藏尺寸标注' : '已显示尺寸标注'); }}><Icon name="ruler" size={13} /></ToolBtn>
        </div>
      </div>

      {/* 画布 */}
      <div
        ref={wrapRef}
        style={{ height, overflow: 'hidden', position: 'relative', background: '#FBFBFB', cursor: 'grab', touchAction: 'none' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const d = dragRef.current;
          setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerLeave={() => { dragRef.current = null; }}
        onWheel={(e) => {
          e.preventDefault();
          zoomBy(e.deltaY < 0 ? 1.15 : 0.87);
        }}
      >
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
          transformOrigin: 'center center', width: 480, maxWidth: 'none',
          background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.08)', padding: 6,
        }}>
          <div dangerouslySetInnerHTML={{ __html: safe }} />
        </div>

        {/* 尺寸标注条 */}
        {showDims && (
          <div style={{ position: 'absolute', left: 14, bottom: 12, zIndex: 2 }}>
            <div style={{ background: 'rgba(30,22,28,.72)', color: '#fff', borderRadius: 10, padding: '7px 11px', fontSize: 10.5, lineHeight: 1.6 }}>
              <div className="row" style={{ gap: 6 }}>
                <Icon name="ruler" size={12} />
                <span>比例尺 1:{Math.max(1, Math.round(scale * 100))}</span>
              </div>
              <div style={{ marginTop: 6, height: 6, width: 88, background: 'linear-gradient(90deg,#fff 0 8px,#2b2b2b 8px 16px,#fff 16px 24px,#2b2b2b 24px 32px,#fff 32px 40px,#2b2b2b 40px 48px,#fff 48px 56px,#2b2b2b 56px 64px,#fff 64px 72px,#2b2b2b 72px 80px,#fff 80px 88px)' }} />
              <div style={{ marginTop: 2 }}>成衣结构线以 DXF 1:1 为准</div>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', right: 10, bottom: 10, color: 'rgba(0,0,0,.35)', fontSize: 10, zIndex: 2, display: 'flex', gap: 8 }}>
          <span>拖拽平移</span><span>滚轮缩放</span>
        </div>
      </div>

      {/* 图层图例 */}
      {showLegend && layers.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 8, background: '#fff' }}>
          {layers.map((l, i) => (
            <span key={`${l.name}-${i}`} className="row" style={{ gap: 5, fontSize: 11, color: 'var(--text-2)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
              {l.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: active ? 'var(--brand-deep)' : 'var(--text-2)', background: active ? 'var(--brand-soft)' : 'transparent',
    }}>
      {children}
    </button>
  );
}
