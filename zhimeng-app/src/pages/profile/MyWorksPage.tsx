/* ============ 织梦 · 我的作品集 ============ */
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { EmptyState, StatCell } from '../../components/ui';
import NavBar from '../../components/NavBar';
import { useToast } from '../../components/Sheet';
import { me, worksByCreator } from '../../data/mock';
import { fmt, TapStyle, WorkCard } from './_shared';
import type { Work } from '../../data/types';

/** 小 KPI 条（写死合理演示值） */
const KPI = [
  { conv: 2.1, click: 7.9, rank: 87, ret: 5.6 },
  { conv: 1.8, click: 6.2, rank: 132, ret: 4.9 },
  { conv: 1.2, click: 4.5, rank: 205, ret: 2.8 },
];

export default function MyWorksPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const myWorks: Work[] = worksByCreator(me.id);
  const totalSales = myWorks.reduce((s, w) => s + w.sales, 0);
  const totalCollects = myWorks.reduce((s, w) => s + w.collects, 0);

  return (
    <div className="page no-tab" style={{ paddingBottom: 110 }}>
      <TapStyle />
      <NavBar back title="我的作品集" />
      <div className="page-body">
        {/* 顶部统计 */}
        <div className="card" style={{ padding: '14px 8px' }}>
          <div className="row">
            <StatCell label="作品数" value={myWorks.length} />
            <StatCell label="总销量" value={fmt(totalSales)} />
            <StatCell label="总收藏" value={fmt(totalCollects)} />
          </div>
        </div>

        {myWorks.length === 0 ? (
          <EmptyState icon="store" title="还没有作品" desc="发布你的第一件原创设计，开启创作者之旅" action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/plaza/publish')}>发布作品</button>
          } />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {myWorks.map((w, i) => {
              const k = KPI[i % KPI.length];
              return (
                <WorkCard
                  key={w.id}
                  work={w}
                  onClick={() => toast(`「${w.title}」详情（模拟）`)}
                  foot={
                    <>
                      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--text-3)' }}>
                        <span>转化 {k.conv}%</span>
                        <span>点击 {k.click}%</span>
                        <span>排名 {k.rank}</span>
                        <span>退货 {k.ret}%</span>
                      </div>
                      <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, 30 + i * 25)}%`, height: '100%', borderRadius: 99, background: 'var(--brand-grad)' }} />
                      </div>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 底部发布栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 60,
        padding: '10px 16px calc(var(--safe-bottom) + 10px)', background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid var(--line)',
      }}>
        <button className="btn btn-primary btn-block" onClick={() => navigate('/plaza/publish')}>
          <Icon name="upload" size={16} /> 发布作品
        </button>
      </div>
    </div>
  );
}
