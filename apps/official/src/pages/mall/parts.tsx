/* ============================================================================
 * 商城共享展示件（商品卡 / 尺码表 / 状态徽标等）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Tag } from '../../components/ui';
import type { Product, SpecSizeChartRow } from '../../api/types';
import { fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';

/* ---------------- 双列商品卡（瀑布流） ---------------- */
export function ProductCard({ p, foot }: { p: Product; foot?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <button className="p-card tap-row" onClick={() => navigate(`/mall/product/${p.id}`)} style={{ textAlign: 'left', width: '100%' }}>
      <div className="p-card-img">
        <img src={imgSafe(p.cover || p.images?.[0])} alt={p.title} onError={hideBadImg} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {p.sales > 0 && (
          <span style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,.52)', color: '#fff', fontSize: 10, borderRadius: 99, padding: '2px 7px' }}>
            已售 {p.sales}
          </span>
        )}
      </div>
      <div className="p-card-info">
        <div className="p-card-title ellipsis-2" style={{ minHeight: 35 }}>{p.title}</div>
        <div className="row" style={{ marginTop: 5, gap: 6, alignItems: 'baseline' }}>
          <span style={{ color: 'var(--brand-deep)', fontWeight: 800, fontSize: 16 }}>¥{fmtMoney(p.price)}</span>
          {p.baseFee > 0 && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>定制起</span>}
        </div>
        <div className="row" style={{ marginTop: 4, gap: 4, minWidth: 0 }}>
          <Icon name="user" size={10} color="var(--text-3)" />
          <span className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', flex: 1 }}>{p.creator?.nickname || '织梦创作者'}</span>
          {p.baseFee > 0 && <Tag variant="gold" icon="sparkle">私人定制</Tag>}
        </div>
        {foot}
      </div>
    </button>
  );
}

/* ---------------- 尺码表（成衣规格 / 国际码换算提示） ---------------- */
const SIZE_NOTE: Record<string, string> = {
  XS: '≈ 155/80A', S: '≈ 160/84A', M: '≈ 165/88A', L: '≈ 170/92A', XL: '≈ 175/96A', XXL: '≈ 180/100A',
};

export function SizeChartTable({ rows, showConvert = true }: { rows: SpecSizeChartRow[]; showConvert?: boolean }) {
  if (!rows?.length) return null;
  const keys: (keyof SpecSizeChartRow)[] = ['bust', 'waist', 'hip', 'shoulder', 'sleeve', 'length'];
  const titleMap: Record<string, string> = { bust: '胸围', waist: '腰围', hip: '臀围', shoulder: '肩宽', sleeve: '袖长', length: '衣长' };
  const activeKeys = keys.filter((k) => rows.some((r) => typeof r[k] === 'number'));
  const headers = ['尺码', ...activeKeys.map((k) => titleMap[k] || k)];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ background: 'var(--bg)', padding: '8px 6px', textAlign: 'center', border: '1px solid var(--line)', color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.size}>
              <td style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid var(--line)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {r.size}
                {showConvert && SIZE_NOTE[r.size] && <div style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-3)' }}>{SIZE_NOTE[r.size]}</div>}
              </td>
              {activeKeys.map((k) => (
                <td key={k} style={{ padding: '8px 6px', textAlign: 'center', border: '1px solid var(--line)' }}>
                  {typeof r[k] === 'number' ? `${r[k]}cm` : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showConvert && (
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6 }}>
          尺码已标注对应国际码换算（身高/胸围），单位 cm；定制时可进一步按你的体型调整。
        </div>
      )}
    </div>
  );
}

/* ---------------- 素材统计行（商品 detail 卡片） ---------------- */
export function MatCountLine({ pattern = 0, model = 0 }: { pattern?: number; model?: number }) {
  if (!pattern && !model) return null;
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
      {model > 0 && <span className="row" style={{ gap: 4, color: 'var(--info)' }}><Icon name="layers" size={13} />3D 模型 ×{model}</span>}
      {pattern > 0 && <span className="row" style={{ gap: 4, color: '#9A7A1E' }}><Icon name="pen-tool" size={13} />打版图纸 ×{pattern}</span>}
    </div>
  );
}

/* ---------------- 空/错/载三态小组件（商城复用） ---------------- */
export function StateNote({ icon, title, desc, action }: { icon: 'cart' | 'package' | 'search' | 'wallet' | 'bag'; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '54px 24px', color: 'var(--text-3)' }}>
      <div style={{ width: 76, height: 76, margin: '0 auto 14px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(20,20,30,.05)' }}>
        <Icon name={icon} size={32} color="#C9C2CC" />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>{desc}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/* 图片占位 fallback（渐变底 + 服装 icon） */
export function ImgFallback({ ratio = 1, icon = 'bag' }: { ratio?: number | string; icon?: 'bag' | 'tshirt' | 'image' }) {
  return (
    <div style={{ width: '100%', aspectRatio: String(ratio), background: 'linear-gradient(135deg,#F6D6E0,#E85C87)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)' }}>
      <Icon name={icon} size={34} />
    </div>
  );
}
