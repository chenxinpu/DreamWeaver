/**
 * seed 时向 apps/server/samples/ 写入真实示例文件：
 *  - dress-front-pattern.dxf   连衣裙前片打版（LWPOLYLINE + bulge 圆弧 + 标注）
 *  - shirt-front.dxf           衬衫版片
 *  - dress.obj                 参数化连衣裙网格（几十顶点 + 三角面）
 *  - floral-print.svg          印花
 */

/* ---------------- 通用 DXF 文本拼装 ---------------- */

function dxfHeader(): string {
  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
  ].join('\n');
}

function dxfTables(layers: { name: string; color: number }[]): string {
  const rows: string[] = [];
  for (const l of layers) {
    rows.push('0', 'LAYER', '2', l.name, '70', '0', '62', String(l.color), '6', 'CONTINUOUS');
  }
  return [
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', String(layers.length),
    ...rows,
    '0', 'ENDTAB', '0', 'ENDSEC',
  ].join('\n');
}

/** LWPOLYLINE：pts 为 [x,y,bulge?]；bulge=0 或缺省为直线段 */
function lw(layer: string, pts: [number, number, number?][], closed = true): string {
  const rows: string[] = ['0', 'LWPOLYLINE', '8', layer, '90', String(pts.length), '70', closed ? '1' : '0'];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, bulge] = pts[i];
    rows.push('10', fmt1(x), '20', fmt1(y));
    if (bulge && bulge !== 0) rows.push('42', fmt2(bulge));
  }
  return rows.join('\n');
}

function line(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return ['0', 'LINE', '8', layer, '10', fmt1(x1), '20', fmt1(y1), '11', fmt1(x2), '21', fmt1(y2)].join('\n');
}

function circle(layer: string, cx: number, cy: number, r: number): string {
  return ['0', 'CIRCLE', '8', layer, '10', fmt1(cx), '20', fmt1(cy), '40', fmt2(r)].join('\n');
}

function arc(layer: string, cx: number, cy: number, r: number, a0: number, a1: number): string {
  return ['0', 'ARC', '8', layer, '10', fmt1(cx), '20', fmt1(cy), '40', fmt2(r), '50', fmt2(a0), '51', fmt2(a1)].join('\n');
}

function point(layer: string, x: number, y: number): string {
  return ['0', 'POINT', '8', layer, '10', fmt1(x), '20', fmt1(y)].join('\n');
}

function text(layer: string, x: number, y: number, s: string, h = 22): string {
  return ['0', 'TEXT', '8', layer, '10', fmt1(x), '20', fmt1(y), '40', String(h), '1', s].join('\n');
}

function entitiesBody(ents: string[]): string {
  return ['0', 'SECTION', '2', 'ENTITIES', ...ents, '0', 'ENDSEC'].join('\n');
}

const fmt1 = (n: number) => String(Math.round(n * 10) / 10);
const fmt2 = (n: number) => String(Math.round(n * 10000) / 10000);

/* ---------------- 示例一：连衣裙前片 ---------------- */

export function buildDressFrontDxf(): string {
  const layers = [
    { name: '轮廓线', color: 1 },   // 成衣外轮廓
    { name: '结构线', color: 5 },   // 胸/腰/臀结构线
    { name: '辅助线', color: 8 },   // 布纹/延长线
    { name: '标注', color: 3 },     // 文字/尺寸
  ];
  // 前片轮廓（沿顺时针：CF下摆→侧缝→袖窿→肩→领口→回CF）
  const contour: [number, number, number?][] = [
    [0, 0],            // 前中心·下摆
    [146, 0],          // 下摆角
    [218, 126],        // 侧缝·裙摆外扩
    [258, 330],        // 侧缝·腰位（A 字）
    [264, 448],        // 侧缝·臀位
    [252, 528],        // 侧缝·腋下
    [250, 552, -0.22], // 袖窿下弧（bulge）
    [196, 592, 0.18],  // 袖窿顶
    [150, 612],        // 肩端点
    [96, 636],         // 肩颈点
    [34, 618, -0.28],  // 领口弧（bulge 还原圆弧）
    [0, 600],          // 前领口·前中心
  ];
  const ents: string[] = [
    lw('轮廓线', contour, true),
    // 结构线：胸/腰/臀
    lw('结构线', [[0, 552], [250, 552], [264, 448]], false),
    lw('结构线', [[0, 330], [258, 330]], false),
    lw('结构线', [[0, 448], [264, 448]], false),
    // 省道（腰省）
    lw('结构线', [[72, 330], [64, 452]], false),
    lw('结构线', [[120, 330], [112, 452]], false),
    // 辅助：布纹线 + 对位线
    line('辅助线', 20, 12, 20, 588),
    line('辅助线', 146, -46, 146, 24),
    // 刀口标记
    point('标注', 146, 0), point('标注', 0, 448), point('标注', 150, 612),
    // 文字
    text('标注', 30, 30, '前中心', 20),
    text('标注', 12, 340, '腰围线', 18),
    text('标注', 12, 458, '臀围线', 18),
    text('标注', 40, 560, '胸围线', 18),
    text('标注', 232, 560, '袖窿弧(bulge)', 16),
    text('标注', 96, 640, '连衣裙·前片 1:1', 24),
    text('标注', 60, 588, '肩线', 16),
    circle('标注', 146, 486, 5),
  ];
  return [dxfHeader(), dxfTables(layers), entitiesBody(ents)].join('\n');
}

/* ---------------- 示例二：衬衫前片 ---------------- */

export function buildShirtFrontDxf(): string {
  const layers = [
    { name: '轮廓线', color: 1 },
    { name: '结构线', color: 5 },
    { name: '辅助线', color: 8 },
    { name: '标注', color: 3 },
  ];
  const contour: [number, number, number?][] = [
    [0, 0],           // 下摆
    [280, 0],
    [290, 60],        // 圆摆
    [288, 210],
    [262, 330],       // 腰
    [266, 470],
    [252, 560, -0.2], // 袖窿
    [212, 640, 0.16],
    [180, 660],       // 肩点
    [126, 684],       // 肩颈
    [48, 668, -0.3],  // 领口
    [0, 650],
  ];
  const ents: string[] = [
    lw('轮廓线', contour, true),
    // 前襟(门襟)线、扣位
    lw('结构线', [[40, 660], [40, 0]], false),
    circle('标注', 40, 96, 6),
    circle('标注', 40, 196, 6),
    circle('标注', 40, 296, 6),
    // 腰/胸线
    lw('结构线', [[0, 330], [262, 330]], false),
    lw('结构线', [[0, 560], [252, 560]], false),
    line('辅助线', 18, 8, 18, 640),
    point('标注', 280, 0),
    point('标注', 180, 660),
    text('标注', 60, 40, '门襟', 20),
    text('标注', 120, 344, '腰围线', 18),
    text('标注', 120, 574, '胸围线', 18),
    text('标注', 30, 692, '衬衫·前片 1:1', 24),
    text('标注', 150, 672, '袖窿(bulge)', 15),
    text('标注', 300, 330, '侧缝', 16),
  ];
  return [dxfHeader(), dxfTables(layers), entitiesBody(ents)].join('\n');
}

/* ---------------- 示例三：参数化连衣裙 OBJ ---------------- */

export function buildDressObj(): string {
  const out: string[] = ['# 织梦示例：参数化生成连衣裙网格（含几十顶点与三角面）', '# 坐标系：y 向上，裙身沿 y 由腰到摆'];
  const rings = 9;      // 层数
  const segs = 10;      // 每层分段（角度步长）
  const positions: number[][] = [];
  const profile: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings; // 0=腰 1=摆
    const r = 24 + t * t * 56;   // A 字外扩
    const y = 130 - t * 118;      // 裙长方向
    profile.push([r, y]);
  }
  // 顶点（由下往上建环）
  const ringStart: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const [r, y] = profile[i];
    ringStart.push(positions.length);
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      positions.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
  }
  // 底部收口（简化：给底环一个中心点做三角扇，方便封底）
  const bottomCenter = positions.length;
  positions.push([0, profile[0][1], 0]);
  const lines: string[] = positions.map((p, i) => `v ${p[0].toFixed(3)} ${p[1].toFixed(3)} ${p[2].toFixed(3)}`).concat(`v 0 0 0`);
  void bottomCenter;
  const faces: string[] = [];
  // 每相邻环之间：2 个三角
  for (let i = 0; i < rings; i++) {
    const a0 = ringStart[i]; const a1 = ringStart[i + 1];
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % segs;
      // quad (a0+k, a0+k2, a1+k2, a1+k) → 两个三角
      faces.push(`f ${a0 + k + 1} ${a0 + k2 + 1} ${a1 + k2 + 1}`);
      faces.push(`f ${a0 + k + 1} ${a1 + k2 + 1} ${a1 + k + 1}`);
    }
  }
  // 封底（最下环）三角扇
  const bottom = ringStart[0];
  for (let k = 0; k < segs; k++) {
    const k2 = (k + 1) % segs;
    faces.push(`f ${bottom + k + 1} ${bottom + k2 + 1} ${bottomCenter + 1}`);
  }
  return out.concat(lines, faces).join('\n');
}

/* ---------------- 示例四：SVG 印花 ---------------- */

export function buildFloralSvg(): string {
  const petals = ['#F2B8C0', '#E88DA6', '#F7D6E0', '#D44771'];
  let flowers = '';
  const centers: [number, number, number, number][] = [
    [90, 70, 34, 0], [200, 46, 26, 1], [312, 92, 38, 2], [392, 60, 28, 3],
    [150, 156, 24, 3], [330, 180, 30, 0], [238, 212, 20, 2], [428, 170, 22, 1],
  ];
  for (const [cx, cy, r, ci] of centers) {
    const col = petals[ci % petals.length];
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * r * 0.8;
      const y = cy + Math.sin(a) * r * 0.8;
      const x2 = cx + Math.cos(a + 0.6) * r;
      const y2 = cy + Math.sin(a + 0.6) * r;
      const x3 = cx + Math.cos(a + 1.05) * r * 0.7;
      const y3 = cy + Math.sin(a + 1.05) * r * 0.7;
      p += `M ${cx} ${cy} Q ${x} ${y} ${x2} ${y2} Q ${x3} ${y3} ${cx} ${cy} `;
    }
    flowers += `<path d="${p}" fill="${col}" opacity="0.9"/>`;
    flowers += `<circle cx="${cx}" cy="${cy}" r="${Math.max(5, r * 0.22)}" fill="#F9E37C"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260" viewBox="0 0 520 260">
<rect width="520" height="260" fill="#FFF9F5"/>
<path d="M0 208 Q 90 150 150 190 T 300 180 T 520 160 L 520 260 L 0 260 Z" fill="#F7E3E8" opacity="0.8"/>
<text x="24" y="34" font-size="13" fill="#D44771" font-family="sans-serif" opacity="0.85">织梦 · 花间集印花 1:1</text>
${flowers}
</svg>`;
}
