package dreamweaver.parser;

import dreamweaver.entity.ObjMesh;
import java.util.ArrayList;
import java.util.List;

/**
 * OBJ 解析器（纯 Java 标准库），逐行对应原 TS `apps/server/src/parsers/obj.ts`：
 * 支持 v / vt(忽略语义) / vn / f（v、v//vn、v/vt/vn 索引形态）。
 *
 * <p>输出 {vertices, faces, mesh:{positions:number[], faces:number[], normals?:number[]}}；
 * faces 编码：每面 = [顶点数, i0, i1, ...]（i 为 positions 中的 3 元组下标，0 基）。
 * 坐标保持文件原样（z 轴向上与否由前端查看器决定，本解析器不改换坐标系）。
 */
public final class ObjParser {

    private ObjParser() {
    }

    /** obj 下标 1 基；负数 = 相对当前末尾。 */
    private static double idxTo0(double v, int len) {
        return v > 0 ? v - 1 : len + v;
    }

    public static ObjResult parse(String text) {
        List<Double> positions = new ArrayList<>();
        List<Integer> facesFlat = new ArrayList<>();
        int vertexCount = 0;
        int faceCount = 0;
        List<String> warns = new ArrayList<>();

        String[] lines = text.split("\\r?\\n", -1);
        for (int ln = 0; ln < lines.length; ln++) {
            String line = lines[ln].trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            String[] sp = line.split("\\s+");
            String tag = sp[0];
            if ("v".equals(tag) && sp.length >= 4) {
                positions.add(orZero(Parsers.jsNumber(sp[1])));
                positions.add(orZero(Parsers.jsNumber(sp[2])));
                positions.add(orZero(Parsers.jsNumber(sp[3])));
                // 原实现 posCount.push(positions.length / 3 - 1)，posCount.length 恒等于顶点数
                vertexCount++;
            } else if ("vn".equals(tag) || "vt".equals(tag)) {
                // 本步不做逐顶点法线/UV 精确建模，若 f 引用 vn 用平均法线替代
            } else if ("f".equals(tag) && sp.length >= 4) {
                List<Integer> idxs = new ArrayList<>();
                for (int k = 1; k < sp.length; k++) {
                    String[] parts = sp[k].split("/", -1);
                    double vRaw = Parsers.jsParseInt(parts[0]);
                    if (Double.isNaN(vRaw)) continue;
                    double v0 = idxTo0(vRaw, vertexCount);
                    if (!(v0 >= 0 && v0 < vertexCount)) {
                        warns.add("第" + (ln + 1) + "行面索引越界");
                        continue;
                    }
                    idxs.add((int) v0);
                }
                if (idxs.size() >= 3) {
                    facesFlat.add(idxs.size());
                    facesFlat.addAll(idxs);
                    faceCount++;
                }
            }
        }

        // 顶点法线：按面累加平均
        // （原 TS 里 faceNormals 只用于 faceNormals.length > 0 判空，与 faceCount > 0 恒等价）
        List<Double> normals = null;
        if (faceCount > 0 && vertexCount > 0) {
            normals = computeNormals(positions, facesFlat, vertexCount);
        }

        if (vertexCount == 0 || faceCount == 0) {
            warns.add("OBJ 未解析到 v/f 记录");
        }

        ObjResult r = new ObjResult();
        r.vertices = vertexCount;
        r.faces = faceCount;
        ObjMesh mesh = new ObjMesh();
        mesh.positions = positions;
        mesh.faces = facesFlat;
        mesh.normals = normals;      // 为空时由 NON_NULL 省略（等价 TS 的条件展开）
        r.mesh = mesh;
        r.note = "OBJ 解析：" + vertexCount + " 顶点 / " + faceCount + " 面（面=每面顶点数+索引平铺，法线按面平均）。";
        r.parseWarn = warns.isEmpty() ? null : String.join("；", warns);
        return r;
    }

    /** 等价 JS {@code Number(x) || 0}（NaN 与 ±0 都归 0）。 */
    private static double orZero(double v) {
        return (Double.isNaN(v) || v == 0d) ? 0d : v;
    }

    /** 依据 faces 编码计算每顶点平均法线。 */
    static List<Double> computeNormals(List<Double> positions, List<Integer> facesFlat, int vCount) {
        double[] acc = new double[vCount * 3];
        int f = 0;
        while (f < facesFlat.size()) {
            int n = facesFlat.get(f);
            List<Integer> idxs = new ArrayList<>();
            for (int t = f + 1; t < f + 1 + n && t < facesFlat.size(); t++) idxs.add(facesFlat.get(t));
            f += 1 + n;
            if (n < 3) continue;
            int a = idxs.get(0);
            int b = idxs.get(1);
            int c = idxs.get(2);
            double ax = positions.get(a * 3);
            double ay = positions.get(a * 3 + 1);
            double az = positions.get(a * 3 + 2);
            double bx = positions.get(b * 3);
            double by = positions.get(b * 3 + 1);
            double bz = positions.get(b * 3 + 2);
            double cx = positions.get(c * 3);
            double cy = positions.get(c * 3 + 1);
            double cz = positions.get(c * 3 + 2);
            double ux = bx - ax;
            double uy = by - ay;
            double uz = bz - az;
            double vx = cx - ax;
            double vy = cy - ay;
            double vz = cz - az;
            double nx = uy * vz - uz * vy;
            double ny = uz * vx - ux * vz;
            double nz = ux * vy - uy * vx;
            double len = Parsers.jsHypot(nx, ny, nz);
            if (!(len > 0)) len = 1;
            nx /= len;
            ny /= len;
            nz /= len;
            for (int iv : idxs) {
                acc[iv * 3] += nx;
                acc[iv * 3 + 1] += ny;
                acc[iv * 3 + 2] += nz;
            }
        }
        List<Double> out = new ArrayList<>(vCount * 3);
        for (int i = 0; i < vCount; i++) {
            double nx = acc[i * 3];
            double ny = acc[i * 3 + 1];
            double nz = acc[i * 3 + 2];
            double len = Parsers.jsHypot(nx, ny, nz);
            if (!(len > 0)) len = 1;
            nx /= len;
            ny /= len;
            nz /= len;
            out.add(nx);
            out.add(ny);
            out.add(nz);
        }
        return out;
    }
}
