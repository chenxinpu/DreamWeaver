package dreamweaver.common;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.DoubleSupplier;
import java.util.function.IntUnaryOperator;

/** 通用小工具（与既有 Node 实现逐位对齐，保证演示数据一致）。 */
public final class MiscUtil {

    private static final String UNRESERVED = "-_.!~*'()";

    private MiscUtil() {
    }

    /** 保留两位小数 */
    public static double r2(double x) {
        return Math.round((x + 2.220446049250313E-16) * 100) / 100.0;
    }

    /** 简单伪随机（确定性种子，供 seed 使用），等价于 mulberry32。 */
    public static DoubleSupplier mulberry32(int seed) {
        final int[] a = {seed};
        return () -> {
            a[0] = a[0] + 0x6d2b79f5;
            int t = a[0];
            t = (t ^ (t >>> 15)) * (1 | t);
            t = (t + (t ^ (t >>> 7)) * (61 | t)) ^ t;
            return ((t ^ (t >>> 14)) & 0xFFFFFFFFL) / 4294967296.0;
        };
    }

    /** 随机整数 [min,max] */
    public static int randInt(int min, int max, DoubleSupplier rnd) {
        return (int) Math.floor(rnd.getAsDouble() * (max - min + 1)) + min;
    }

    public static int randInt(int min, int max) {
        return (int) Math.floor(Math.random() * (max - min + 1)) + min;
    }

    public static double randDouble(DoubleSupplier rnd) {
        return rnd.getAsDouble();
    }

    /** 从数组中随机取 n 个 */
    public static <T> List<T> pick(List<T> arr, int n, DoubleSupplier rnd) {
        if (arr.size() <= n) return new ArrayList<>(arr);
        List<T> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            out.add(arr.get((int) Math.floor(rnd.getAsDouble() * arr.size())));
        }
        return out;
    }

    /** 分页工具 */
    public static <T> Map<String, Object> paginate(List<T> list, int page, int pageSize) {
        int p = Math.max(1, page);
        int ps = Math.min(100, Math.max(1, pageSize));
        int total = list.size();
        int start = (p - 1) * ps;
        int end = Math.min(total, start + ps);
        List<T> slice = start >= total ? List.of() : new ArrayList<>(list.subList(start, end));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", slice);
        out.put("total", total);
        out.put("page", p);
        out.put("pageSize", ps);
        return out;
    }

    /** 百分比计算（避免除零） */
    public static double pct(double n, double d) {
        if (d == 0) return 0;
        return r2((n / d) * 100);
    }

    /** SVG 内联占位图 data-url（等价于 JS encodeURIComponent） */
    public static String svgDataUrl(String svg) {
        return "data:image/svg+xml;charset=utf-8," + encodeUriComponent(svg);
    }

    /** 与 JavaScript encodeURIComponent 完全一致的百分号编码。 */
    public static String encodeUriComponent(String s) {
        StringBuilder sb = new StringBuilder(s.length() * 2);
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xFF;
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                    || UNRESERVED.indexOf((char) c) >= 0) {
                sb.append((char) c);
            } else {
                sb.append('%');
                String hex = Integer.toHexString(c).toUpperCase();
                if (hex.length() < 2) sb.append('0');
                sb.append(hex);
            }
        }
        return sb.toString();
    }

    /** 安全的整数解析（失败返回默认值） */
    public static Integer toIntOrNull(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        try {
            String s = String.valueOf(v).trim();
            if (s.isEmpty()) return null;
            return (int) Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static int toInt(Object v, int dft) {
        Integer i = toIntOrNull(v);
        return i == null ? dft : i;
    }

    public static double toDouble(Object v, double dft) {
        if (v == null) return dft;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }

    public static String toStr(Object v, String dft) {
        return v == null ? dft : String.valueOf(v);
    }

    public static boolean toBool(Object v, boolean dft) {
        if (v == null) return dft;
        if (v instanceof Boolean b) return b;
        String s = String.valueOf(v);
        return "true".equalsIgnoreCase(s) || "1".equals(s);
    }

    /** 供 seed 使用的整数序列生成 */
    public static List<Integer> range(int fromInclusive, int toExclusive) {
        List<Integer> out = new ArrayList<>();
        for (int i = fromInclusive; i < toExclusive; i++) out.add(i);
        return out;
    }

    public static <T> T withDefault(T v, T dft) {
        return v == null ? dft : v;
    }

    /** 便捷：把 map 中为 null 的键移除（模拟 TS 可选字段缺席） */
    public static Map<String, Object> compact(Map<String, Object> m) {
        m.values().removeIf(java.util.Objects::isNull);
        return m;
    }

    public static IntUnaryOperator clamp(int min, int max) {
        return v -> Math.max(min, Math.min(max, v));
    }

    /**
     * 等价 JavaScript 的 {@code String(number)}（即数字的默认十进制字符串化）。
     *
     * <p>规则（与 JS Number::toString 对齐）：
     *
     * <ul>
     *   <li>整数不带小数点（{@code 84.0 → "84"}），负零同样输出 {@code "0"}；</li>
     *   <li>非整数输出最短往返表示（{@code 1.5 → "1.5"}）；</li>
     *   <li><b>不使用科学计数法</b>：Java 对 {@code |v| ≥ 1e7} 会输出 {@code 1.0E7}，
     *       而 JS 只在 {@code ≥ 1e21} 时才用指数写法，故此处对含指数的结果用
     *       {@link BigDecimal#toPlainString()} 还原为普通十进制；</li>
     *   <li>特例：{@code NaN → "NaN"}、{@code Infinity → "Infinity"}、{@code -Infinity → "-Infinity"}。</li>
     * </ul>
     *
     * <p>用于拼接 explain / notice / timeline 等中文文案，保证与 Node 实现逐字符一致。
     */
    public static String jsNum(double v) {
        if (Double.isNaN(v) || Double.isInfinite(v)) return String.valueOf(v);
        if (v == Math.rint(v) && Math.abs(v) < 1e15) return String.valueOf((long) v);
        String s = Double.toString(v);
        if (s.indexOf('E') < 0 && s.indexOf('e') < 0) return s;
        // Java 对 |v| ≥ 1e7 使用科学计数法，JS 只在 ≥1e21 时才用：转回普通十进制写法
        return new BigDecimal(s).toPlainString();
    }

    /**
     * 等价 JavaScript 的 {@code Date.parse(iso)}：把 ISO-8601（可带 {@code +08:00} 偏移）时间串
     * 解析为 epoch 毫秒。
     *
     * <p>解析失败（null / 空串 / 格式非法）时返回 {@code null}，对应 JS 的 {@code NaN} 语义，
     * 由调用方按原实现各自处理（例如回退到 0 或哨兵值）。
     */
    public static Long parseTs(String iso) {
        if (iso == null || iso.isEmpty()) return null;
        try {
            return java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli();
        } catch (Exception e) {
            return null;
        }
    }
}
