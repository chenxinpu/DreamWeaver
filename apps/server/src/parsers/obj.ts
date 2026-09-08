/**
 * OBJ 解析器（纯 TS）：支持 v / vt(忽略语义) / vn / f（v、v//vn、v/vt/vn 索引形态）。
 * 输出 {vertices, faces, mesh:{positions:number[], faces:number[], normals?:number[]}}
 * faces 编码：每面 = [顶点数, i0, i1, ...]（i 为 positions 中的 3 元组下标，0 基）。
 * 坐标保持文件原样（z 轴向上与否由前端查看器决定，本解析器不改换坐标系）。
 */

export interface ObjParseResult {
  vertices: number;
  faces: number;
  mesh: { positions: number[]; faces: number[]; normals?: number[] };
  note?: string;
  parseWarn?: string;
}

function idxTo0(v: number, len: number): number {
  // obj 下标 1 基；负数 = 相对当前末尾
  return v > 0 ? v - 1 : len + v;
}

export function parseObj(text: string): ObjParseResult {
  const positions: number[] = [];
  const posCount: number[] = [];
  const faceNormals: { n: [number, number, number]; i: number }[] = [];
  const facesFlat: number[] = [];
  let vertexCount = 0;
  let faceCount = 0;
  const warns: string[] = [];

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (!line || line.startsWith('#') || line.startsWith('#')) continue;
    const sp = line.split(/\s+/);
    const tag = sp[0];
    if (tag === 'v' && sp.length >= 4) {
      positions.push(Number(sp[1]) || 0, Number(sp[2]) || 0, Number(sp[3]) || 0);
      posCount.push(positions.length / 3 - 1);
      vertexCount++;
    } else if (tag === 'vn' || tag === 'vt') {
      // 本步不做逐顶点法线/UV 精确建模，若 f 引用 vn 用平均法线替代
    } else if (tag === 'f' && sp.length >= 4) {
      const idxs: number[] = [];
      for (let k = 1; k < sp.length; k++) {
        const parts = sp[k].split('/');
        const vRaw = parseInt(parts[0], 10);
        if (Number.isNaN(vRaw)) continue;
        const v0 = idxTo0(vRaw, posCount.length);
        if (v0 < 0 || v0 >= posCount.length) { warns.push(`第${ln + 1}行面索引越界`); continue; }
        idxs.push(v0);
      }
      if (idxs.length >= 3) {
        facesFlat.push(idxs.length, ...idxs);
        // 记录平均法线（面法线）
        const a = idxs[0]; const b = idxs[1]; const c = idxs[2];
        const ax = positions[a * 3]; const ay = positions[a * 3 + 1]; const az = positions[a * 3 + 2];
        const bx = positions[b * 3]; const by = positions[b * 3 + 1]; const bz = positions[b * 3 + 2];
        const cx = positions[c * 3]; const cy = positions[c * 3 + 1]; const cz = positions[c * 3 + 2];
        const ux = bx - ax; const uy = by - ay; const uz = bz - az;
        const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
        const n = [
          uy * vz - uz * vy,
          uz * vx - ux * vz,
          ux * vy - uy * vx,
        ] as [number, number, number];
        faceNormals.push({ n, i: faceCount });
        faceCount++;
      }
    }
  }

  // 顶点法线：按面累加平均
  let normals: number[] | undefined;
  if (faceNormals.length > 0 && vertexCount > 0) {
    const acc = new Float64Array(vertexCount * 3);
    const cnt = new Int32Array(vertexCount);
    for (const fn of faceNormals) {
      // 遍历该面的所有顶点（每个面都以其第一个三角法线近似，简单演示足够）
      let idx = fn.i; // fn.i 为该面的 facesFlat 起始位置——需要还原
    }
    // 上面占位逻辑不易直接定位，改为在生成 facesFlat 时同步累计
    normals = computeNormals(positions, facesFlat, vertexCount);
  }

  if (vertexCount === 0 || faceCount === 0) {
    warns.push('OBJ 未解析到 v/f 记录');
  }

  return {
    vertices: vertexCount,
    faces: faceCount,
    mesh: {
      positions,
      faces: facesFlat,
      ...(normals ? { normals } : {}),
    },
    note: `OBJ 解析：${vertexCount} 顶点 / ${faceCount} 面（面=每面顶点数+索引平铺，法线按面平均）。`,
    parseWarn: warns.length ? warns.join('；') : undefined,
  };
}

/** 依据 faces 编码计算每顶点平均法线 */
function computeNormals(positions: number[], facesFlat: number[], vCount: number): number[] {
  const acc: number[] = new Array(vCount * 3).fill(0);
  let f = 0;
  while (f < facesFlat.length) {
    const n = facesFlat[f];
    const idxs = facesFlat.slice(f + 1, f + 1 + n);
    f += 1 + n;
    if (n < 3) continue;
    const a = idxs[0]; const b = idxs[1]; const c = idxs[2];
    const ax = positions[a * 3]; const ay = positions[a * 3 + 1]; const az = positions[a * 3 + 2];
    const bx = positions[b * 3]; const by = positions[b * 3 + 1]; const bz = positions[b * 3 + 2];
    const cx = positions[c * 3]; const cy = positions[c * 3 + 1]; const cz = positions[c * 3 + 2];
    const ux = bx - ax; const uy = by - ay; const uz = bz - az;
    const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const iv of idxs) {
      acc[iv * 3] += nx; acc[iv * 3 + 1] += ny; acc[iv * 3 + 2] += nz;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < vCount; i++) {
    let nx = acc[i * 3]; let ny = acc[i * 3 + 1]; let nz = acc[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    out.push(nx, ny, nz);
  }
  return out;
}
