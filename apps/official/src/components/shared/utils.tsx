/* ============================================================================
 * 织梦 · 共享工具（consumer / mall / creator 复用）
 * ==========================================================================*/
import React from 'react';

/** 静态图片：public/images 下的资源路径（保留 /images 目录内容不变） */
export const img = (name: string) => `/images/${name}`;

/** 数字缩写：12800 → 1.3w */
export function fmtCount(n?: number | null): string {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return '0';
  if (v >= 10000) {
    const k = v / 10000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}w`;
  }
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(v).toString();
}

/** 金额：千分位（整数不带小数；非整保留 2 位） */
export function fmtMoney(n?: number | null): string {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return '0';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** 图片加载失败时隐藏（露出 .img-ph 占位底色） */
export function hideBadImg(e: React.SyntheticEvent<HTMLImageElement>) {
  const t = e.currentTarget;
  t.style.opacity = '0';
  t.removeAttribute('src');
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 相对时间：ISO 或 YYYY-MM-DD → 刚刚/x分钟前/x天前 */
export function relTime(input?: string): string {
  if (!input) return '';
  const t = new Date(input.includes('T') ? input : `${input.replace(' ', 'T')}+08:00`);
  if (Number.isNaN(t.getTime())) return input;
  const diff = Date.now() - t.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  if (diff < 86400_000 * 7) return `${Math.floor(diff / 86400_000)}天前`;
  const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  if (!input.includes('T')) return d;
  return `${d} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** 图片 src 归一化：相对文件名 → /images/{name}，绝对/斜杠原样返回 */
export function imgSafe(src?: string) {
  if (!src) return '';
  return /^https?:\/\//.test(src) || src.startsWith('/') ? src : img(src);
}

/** 加载/错误/空 三态（各业务页统一复用） */
export function Loading({ text = '加载中…', compact }: { text?: string; compact?: boolean }) {
  return (
    <div style={{
      padding: compact ? '18px 0' : '52px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <span style={{
        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
        border: '2px solid var(--brand-soft)', borderTopColor: 'var(--brand)',
        animation: 'zmSpin .8s linear infinite',
      }} />
      {text}
    </div>
  );
}

export function ErrorBox({ msg, onRetry, children }: { msg?: string; onRetry?: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '44px 26px', textAlign: 'center' }}>
      <div style={{
        width: 66, height: 66, margin: '0 auto 14px', borderRadius: '50%',
        background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 800, fontSize: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>!</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>{msg || '加载失败，请稍后再试'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6 }}>
        {children || '请确认后端服务已启动（apps/server @ :8787），或检查网络连接。'}
      </div>
      {onRetry && (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={onRetry}>重新加载</button>
      )}
    </div>
  );
}
