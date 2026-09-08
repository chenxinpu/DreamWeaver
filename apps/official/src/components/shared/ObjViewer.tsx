/* ============================================================================
 * ObjViewer —— 纯 canvas OBJ 网格渲染（无 three 依赖）
 * 输入：{ positions: number[]（x,y,z 扁平）, faces: number[]（扁平索引）}
 * 交互：自转 / 拖拽旋转 / 滚轮缩放 / 双面着色 + 线框开关 / 重置视角
 * 消费者端「查看 3D」弹层与创作者素材库共用。
 * ==========================================================================*/
import React from 'react';
import Icon from '../Icon';

interface ObjViewerProps {
  positions: number[] | number[][];
  faces: number[] | number[][];
  /** 自动旋转（默认开） */
  autoRotate?: boolean;
  /** 初始线框模式 */
  wireframe?: boolean;
  height?: number;
  title?: string;
  className?: string;
}

type Vec3 = [number, number, number];

function normalizeFaces(faces: number[] | number[][]): number[][] {
  const out: number[][] = [];
  if (!faces?.length) return out;
  if (Array.isArray(faces[0])) {
    for (const f of faces as number[][]) out.push(...triangulate(f));
    return out;
  }
  const flat = faces as number[];
  const n = flat.length;
  if (n >= 3 && n % 3 === 0) {
    for (let i = 0; i < n; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]);
    return out;
  }
  // 不确定顶点数：尽力按常见多边形长度（3 或 4）解析
  const quad = n % 4 === 0;
  const stride = quad ? 4 : 3;
  for (let i = 0; i + stride <= n; i += stride) {
    out.push(...triangulate(flat.slice(i, i + stride)));
  }
  return out;
}

function triangulate(poly: number[]): number[][] {
  if (poly.length === 3) return [[poly[0], poly[1], poly[2]]];
  const out: number[][] = [];
  for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
  return out;
}

export default function ObjViewer({ positions, faces, autoRotate = true, wireframe: initWire = false, height = 300, title }: ObjViewerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const stateRef = React.useRef({
    rotX: -0.4, rotY: 0.7, zoom: 1, auto: autoRotate, wire: initWire,
    drag: false as { x: number; y: number } | false,
  });

  const verts = React.useMemo<Vec3[]>(() => {
    if (!positions?.length) return [];
    if (Array.isArray(positions[0])) return (positions as number[][]).map((p) => [Number(p[0] || 0), Number(p[1] || 0), Number(p[2] || 0)] as Vec3);
    const flat = positions as number[];
    const out: Vec3[] = [];
    for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]);
    return out;
  }, [positions]);

  const tris = React.useMemo(() => normalizeFaces(faces), [faces]);

  const [size, setSize] = React.useState(0);
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const setState = (patch: Partial<typeof stateRef.current>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    force();
  };

  React.useEffect(() => {
    if (autoRotate) stateRef.current.auto = true;
  }, [autoRotate]);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (!size) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const render = () => {
      const st = stateRef.current;
      if (st.auto && !st.drag) {
        st.rotY += 0.008;
      }
      draw(ctx, size, height, verts, tris, st.rotX, st.rotY, st.zoom, st.wire);
      raf = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [size, height, verts, tris]);

  if (!verts.length || !tris.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12.5, background: '#101820', borderRadius: 12 }}>
        暂无 3D 网格数据（示例 mesh 可由后端解析 OBJ 生成）
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(180deg,#1b2530,#0e1620)', position: 'relative', userSelect: 'none' }}>
      {title && (
        <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 3, color: 'rgba(255,255,255,.82)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="layers" size={13} color="#7EB6FF" />{title}
        </div>
      )}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, display: 'flex', gap: 6 }}>
        <ViewBtn active={stateRef.current.auto} onClick={() => setState({ auto: !stateRef.current.auto })} title={stateRef.current.auto ? '暂停自转' : '自动旋转'}>
          <Icon name={stateRef.current.auto ? 'pause' : 'play'} size={14} />
        </ViewBtn>
        <ViewBtn active={stateRef.current.wire} onClick={() => setState({ wire: !stateRef.current.wire })} title="线框开关">
          <Icon name="grid" size={14} />
        </ViewBtn>
        <ViewBtn onClick={() => setState({ zoom: Math.min(4, stateRef.current.zoom * 1.25) })} title="放大">
          <Icon name="zoom-in" size={14} />
        </ViewBtn>
        <ViewBtn onClick={() => setState({ zoom: Math.max(0.2, stateRef.current.zoom / 1.25) })} title="缩小">
          <Icon name="zoom-out" size={14} />
        </ViewBtn>
        <ViewBtn onClick={() => setState({ rotX: -0.4, rotY: 0.7, zoom: 1 })} title="重置视角">
          <Icon name="refresh" size={14} />
        </ViewBtn>
      </div>
      <div ref={wrapRef} style={{ height, touchAction: 'none', cursor: 'grab' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          stateRef.current.drag = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const d = stateRef.current.drag;
          if (d) {
            stateRef.current.rotY += (e.clientX - d.x) * 0.008;
            stateRef.current.rotX = Math.max(-1.5, Math.min(1.5, stateRef.current.rotX + (e.clientY - d.y) * 0.008));
            stateRef.current.drag = { x: e.clientX, y: e.clientY };
          }
        }}
        onPointerUp={() => { stateRef.current.drag = false; }}
        onPointerLeave={() => { stateRef.current.drag = false; }}
        onWheel={(e) => {
          e.preventDefault();
          const s = stateRef.current;
          const nz = s.zoom * (e.deltaY < 0 ? 1.12 : 0.9);
          s.zoom = Math.max(0.2, Math.min(6, nz));
          setState({});
        }}
      >
        <canvas ref={canvasRef} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, color: 'rgba(255,255,255,.5)', fontSize: 10.5, zIndex: 2, display: 'flex', gap: 10 }}>
          <span>顶点 {verts.length}</span><span>面 {tris.length}</span>
          <span>{stateRef.current.wire ? '线框' : '着色'}</span>
        </div>
      </div>
    </div>
  );
}

function ViewBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? 'rgba(126,182,255,.3)' : 'rgba(255,255,255,.14)', color: active ? '#9CC5FF' : 'rgba(255,255,255,.9)',
      border: '1px solid rgba(255,255,255,.16)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
    }}>
      {children}
    </button>
  );
}

/* ------------------------------ 渲染内核 ------------------------------ */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, verts: Vec3[], tris: number[][], rx: number, ry: number, zoom: number, wire: boolean) {
  ctx.clearRect(0, 0, w, h);
  if (!verts.length) return;
  const cx = w / 2;
  const cy = h / 2 + 8;
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);

  // 旋转
  const rot: Vec3[] = verts.map(([x, y, z]) => {
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y * cosX - z1 * sinX;
    let z2 = y * sinX + z1 * cosX;
    return [x1, y1, z2];
  });

  // 自动适配尺寸
  let maxR = 1;
  for (const v of rot) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const base = (Math.min(w, h) * 0.42) / (maxR || 1);
  const scale = base * zoom;

  // 每面平均深度（画家算法排序）
  const depthMap = tris
    .map((t, i) => {
      const a = rot[t[0]], b = rot[t[1]], c = rot[t[2]];
      const az = (a[2] + b[2] + c[2]) / 3;
      // 面法线（叉积）用于光照
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      // 光照方向：左上前方
      const diff = Math.abs((nx * 0.6 + ny * -0.25 + nz * 0.75) / nl);
      return { i, a, b, c, az, diff };
    })
    .sort((p, q) => q.az - p.az);

  if (wire) {
    ctx.lineWidth = 1;
    for (const { a, b, c } of depthMap) {
      ctx.strokeStyle = 'rgba(140,200,255,.9)';
      ctx.beginPath();
      ctx.moveTo(cx + a[0] * scale, cy - a[1] * scale);
      ctx.lineTo(cx + b[0] * scale, cy - b[1] * scale);
      ctx.lineTo(cx + c[0] * scale, cy - c[1] * scale);
      ctx.closePath();
      ctx.stroke();
    }
    return;
  }

  for (const { a, b, c, diff } of depthMap) {
    const light = 0.35 + diff * 0.62;
    const r = Math.round(200 * light), g = Math.round(150 + 40 * light), bl = Math.round(226 * light);
    const back = diff < 0.28;
    ctx.fillStyle = back ? `rgba(${r},${g},${bl},.75)` : `rgba(${Math.min(255, r + 10)},${Math.min(255, g + 20)},${bl},.96)`;
    ctx.beginPath();
    ctx.moveTo(cx + a[0] * scale, cy - a[1] * scale);
    ctx.lineTo(cx + b[0] * scale, cy - b[1] * scale);
    ctx.lineTo(cx + c[0] * scale, cy - c[1] * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,150,220,.28)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}
