/* ============================================================================
 * /me/help 帮助中心
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';

const FAQ: { q: string; a: string }[] = [
  { q: '什么是「资源池」？', a: '当你的推文当天点赞超过全平台推文点赞的 P60 分位，或评论数达到 10 条，系统会自动将你的作品纳入资源池，并提醒你准备橱窗材料，审核通过后由 AI 生成商品详情页上架商城。' },
  { q: '「私人定制」的费用怎么算？', a: '定制订单 = 商品原价 + 基础费用（加工/材料/人工）。若规格不合适可 AI 交互调整后再确认；退货只退原价（基础费用不退），换货重做需再付一次基础费用。' },
  { q: '退货后商品去哪了？', a: '定制退货会按原价×75% 自动放入商城「二手集市」上架（可自降标价），成交后平台收取少量仓储物流佣金，剩余净得直接退还到你账户。' },
  { q: '创作者如何赚钱？', a: '橱窗商品成交后可获得 2%~10% 的佣金：基础 6%，依据转化率、退货率与资源池样式重复度浮动；可在创作者平台「佣金」查看与提现。' },
  { q: '体型数据安全吗？', a: '体型数据仅用于定制版型匹配与尺码推荐，不会对外公开；可随时在「我的 → 体型数据」修改或重新量体。' },
];

const ENTRIES: { icon: IconName; title: string; desc: string; to: string }[] = [
  { icon: 'headphones', title: '在线客服', desc: '工作日 9:00-21:00 在线', to: '' },
  { icon: 'message', title: '意见反馈', desc: '你的建议对我们很重要', to: '' },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [openIdx, setOpenIdx] = React.useState(0);

  return (
    <div className="page no-tab page-bleed">
      <NavBar back title="帮助中心" />
      <div className="page-body" style={{ paddingTop: 6 }}>
        {/* 客服入口 */}
        <div className="card" style={{ padding: '4px 14px', marginBottom: 14 }}>
          {ENTRIES.map((e, i) => (
            <button key={e.title} onClick={() => toast('演示环境：请在创作者平台或商城订单中联系对应客服')} className="row" style={{ width: '100%', gap: 12, padding: '12px 0', borderBottom: i < ENTRIES.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left' }}>
              <span style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={e.icon} size={18} />
              </span>
              <span className="flex-1" style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{e.desc}</span>
              <Icon name="chevron-right" size={15} color="var(--text-3)" />
            </button>
          ))}
        </div>

        {/* FAQ 折叠 */}
        <div className="card" style={{ padding: '6px 16px 12px' }}>
          <div className="f-label" style={{ paddingTop: 8 }}><Icon name="help-circle" size={16} color="var(--brand)" />常见问题</div>
          {FAQ.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <button className="row" style={{ width: '100%', justifyContent: 'space-between', padding: '13px 0', gap: 10 }} onClick={() => setOpenIdx(open ? -1 : i)}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1, textAlign: 'left' }}>{f.q}</span>
                  <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} color="var(--text-3)" />
                </button>
                {open && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.85, padding: '0 0 13px' }}>{f.a}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-outline btn-block" onClick={() => navigate('/learn')}>
            <Icon name="book" size={15} />去学习中心了解更多
          </button>
        </div>
      </div>
    </div>
  );
}
