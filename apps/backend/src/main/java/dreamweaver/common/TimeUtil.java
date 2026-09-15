package dreamweaver.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/** 时间工具：业务日期统一为东八区（+08:00）。 */
public final class TimeUtil {

    public static final ZoneOffset TZ = ZoneOffset.ofHours(8);
    public static final long DAY_MS = 86_400_000L;

    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter COMPACT_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private TimeUtil() {
    }

    /** epoch ms → 'YYYY-MM-DDTHH:mm:ss+08:00' */
    public static String fmtTs(long ts) {
        return Instant.ofEpochMilli(ts).atOffset(TZ).format(TS_FMT);
    }

    /** epoch ms → dateKey(YYYY-MM-DD 东八区) */
    public static String dateKeyOf(long ts) {
        return Instant.ofEpochMilli(ts).atOffset(TZ).toLocalDate().format(DATE_FMT);
    }

    public static String dateKeyNow() {
        return dateKeyOf(System.currentTimeMillis());
    }

    public static String nowIso() {
        return fmtTs(System.currentTimeMillis());
    }

    /** dateKey(东八区某日) 对应的真实毫秒起点 */
    public static long startOfDayKey(String key) {
        return LocalDate.parse(key).atStartOfDay().toInstant(TZ).toEpochMilli();
    }

    public static long addDays(long ts, int n) {
        return ts + (long) n * DAY_MS;
    }

    /** 距今 n 天（正=过去）的真实时刻 */
    public static long daysAgo(int n, int hour, int minute) {
        return startOfDayKey(dateKeyOf(System.currentTimeMillis())) - (long) n * DAY_MS
                + (long) hour * 3_600_000L + (long) minute * 60_000L;
    }

    public static long daysAgo(int n) {
        return daysAgo(n, 10, 0);
    }

    public static long hoursAgo(double h) {
        return System.currentTimeMillis() - (long) (h * 3_600_000L);
    }

    public static long minutesAgo(double m) {
        return System.currentTimeMillis() - (long) (m * 60_000L);
    }

    /** 下一个东八区 hour:minute 时刻距现在的毫秒数 */
    public static long nextDailyRunDelay(int hour, int minute) {
        long now = System.currentTimeMillis();
        long target = startOfDayKey(dateKeyOf(now)) + (long) hour * 3_600_000L + (long) minute * 60_000L;
        long diff = target - now;
        if (diff <= 0) diff += DAY_MS;
        return diff;
    }

    /** ISO 与 dateKey 互换 */
    public static String dateKeyOfIso(String iso) {
        return iso.substring(0, Math.min(10, iso.length()));
    }

    /** 生成订单号 ZM + 时间戳 + 随机 */
    public static String genOrderNo() {
        String ts = Instant.now().atOffset(TZ).format(COMPACT_FMT);
        int rnd = ThreadLocalRandom.current().nextInt(1000, 10000);
        return "ZM" + ts + rnd;
    }
}
