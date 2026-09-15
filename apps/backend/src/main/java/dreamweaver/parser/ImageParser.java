package dreamweaver.parser;

import dreamweaver.entity.MaterialKind;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 图片解析（png/jpg），逐行对应原 TS `apps/server/src/parsers/image.ts`：
 * 收 base64，返回 data-url 存入 cover；手工解析头部得到像素尺寸。大小上限 3MB（原始字节）。
 */
public final class ImageParser {

    private ImageParser() {
    }

    private static final long MAX_IMAGE_BYTES = 3L * 1024 * 1024;

    // /^data:image\/(png|jpe?g);base64,(.+)$/i（JS 的 $ 不允许结尾换行，这里用 \z 对齐）
    private static final Pattern DATA_URL = Pattern.compile(
            "^data:image/(png|jpe?g);base64,(.+)\\z", Pattern.CASE_INSENSITIVE);

    public static ImageResult parseImageDataUrl(String dataUrl) {
        return parseImageDataUrl(dataUrl, null);
    }

    /**
     * hintKind 仅作兼容入参：原实现在 kind 与 data-url 头不一致时以 data-url 头为准。
     */
    public static ImageResult parseImageDataUrl(String dataUrl, MaterialKind hintKind) {
        Matcher m = DATA_URL.matcher(dataUrl == null ? "" : dataUrl);
        if (!m.find()) {
            throw new RuntimeException("仅支持 png / jpg 图片（请提交 data:image/...;base64, 数据）");
        }
        // 注意：原实现是 m[1] === 'png' 的严格比较，'PNG' 也会被判为 jpg
        MaterialKind kind = "png".equals(m.group(1)) ? MaterialKind.PNG : MaterialKind.JPG;
        if (hintKind != null && kind != hintKind) {
            // kind 以 data-url 头为准
        }
        byte[] buf = decodeBase64(m.group(2));
        if (buf.length == 0) {
            throw new RuntimeException("图片内容为空");
        }
        if (buf.length > MAX_IMAGE_BYTES) {
            throw new RuntimeException("图片超过 3MB 大小上限，请压缩后重试");
        }
        int[] dim = readImageSize(buf, kind);

        ImageResult r = new ImageResult();
        r.cover = dataUrl;
        if (dim != null) {
            r.width = (double) dim[0];
            r.height = (double) dim[1];
        }
        r.size = buf.length;
        r.kind = kind;
        r.note = "图片已解析（" + kind.value().toUpperCase(Locale.ROOT) + "，" + buf.length + " 字节）";
        r.parseWarn = dim == null ? "未能读取图片尺寸（头部不标准）" : null;
        return r;
    }

    /** 纯 JS 读取 PNG/JPEG 像素尺寸（失败返回 null）。 */
    static int[] readImageSize(byte[] buf, MaterialKind kind) {
        if (kind == MaterialKind.PNG) {
            // PNG: 8-byte signature + IHDR (length,type) → width(4) height(4)
            if (buf.length >= 24 && readUInt32BE(buf, 12) == 0x49484452L) {
                return new int[]{(int) readUInt32BE(buf, 16), (int) readUInt32BE(buf, 20)};
            }
            return null;
        }
        // JPEG: 扫描 SOF 标记
        int i = 2;
        while (i + 9 < buf.length) {
            if ((buf[i] & 0xFF) != 0xFF) {
                i++;
                continue;
            }
            int marker = buf[i + 1] & 0xFF;
            if (marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC) {
                int h = (int) readUInt16BE(buf, i + 5);
                int w = (int) readUInt16BE(buf, i + 7);
                if (w > 0 && h > 0) return new int[]{w, h};
                return null;
            }
            long segLen = readUInt16BE(buf, i + 2);
            if (segLen < 2) return null;
            i += 2 + (int) segLen;
        }
        return null;
    }

    private static long readUInt32BE(byte[] buf, int off) {
        return ((long) (buf[off] & 0xFF) << 24)
                | ((long) (buf[off + 1] & 0xFF) << 16)
                | ((long) (buf[off + 2] & 0xFF) << 8)
                | (long) (buf[off + 3] & 0xFF);
    }

    private static long readUInt16BE(byte[] buf, int off) {
        return ((long) (buf[off] & 0xFF) << 8) | (long) (buf[off + 1] & 0xFF);
    }

    /** 等价 {@code Buffer.from(b64, 'base64')}（宽容解码：忽略空白与非法字符）。 */
    static byte[] decodeBase64(String b64) {
        String cleaned = b64 == null ? "" : b64.replaceAll("[^A-Za-z0-9+/=]", "");
        StringBuilder sb = new StringBuilder(cleaned);
        int pad = (4 - sb.length() % 4) % 4;
        for (int i = 0; i < pad; i++) sb.append('=');
        try {
            return Base64.getDecoder().decode(sb.toString());
        } catch (IllegalArgumentException e) {
            try {
                return Base64.getMimeDecoder().decode(cleaned);
            } catch (IllegalArgumentException e2) {
                return new byte[0];
            }
        }
    }

    /** 等价 {@code Buffer.from(b64, 'base64').length}。 */
    static long base64ByteLength(String b64) {
        return decodeBase64(b64).length;
    }

    /** 纯 base64 字符串 → data-url（无头时按 kind 猜测）。 */
    public static String rawBase64ToDataUrl(String b64, String kind) {
        String k = "png".equals(kind) ? "png" : "jpeg";
        return "data:image/" + k + ";base64," + b64;
    }
}
