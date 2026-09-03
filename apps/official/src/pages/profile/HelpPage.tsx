/* ============ 织梦 · 帮助与反馈 ============ */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { TapStyle } from './_shared';

const FAQS = [
  { q: '定制衣物能退货吗？', a: '定制款按需生产，非质量问题不支持 7 天无理由退货；若尺码偏差超过 5mm 或存在工艺缺陷，可在订单详情申请售后免费重做。' },
  { q: '如何采集体型数据？', a: '进入「我的 → 体型数据」，可手动输入 12 项数据，或用 AI 拍照量体（正面/侧面/背面各一张）。数据经 AES-256 加密存储，仅用于版型匹配与尺码推荐。' },
  { q: '佣金怎么结算？', a: '订单确认收货后，佣金进入待结算，T+7 自动结算到可提现余额；满 100 元即可申请提现至银行卡或支付宝。' },
  { q: '怎么获得认证？', a: '完成学习中心指定课程并通过认证考试，即可获得「设计学徒」起步认证；作品与互动数据提升后，等级会逐步升级。' },
  { q: '作品如何上榜？', a: '榜单评分由投票、收藏、销量、互动四项加权计算，保持作品更新、及时回复粉丝更容易上榜；退货率过高会降低权重。' },
  { q: '工厂生产周期？', a: '常规款 5-8 天，定制款 7-15 天。订单页可实时查看生产进度、质检报告与预计完成时间。' },
];

const FEED_TYPES = ['功能建议', '问题反馈', '投诉建议', '其他'];

export default function HelpPage() {
  const toast = useToast();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedType, setFeedType] = useState(FEED_TYPES[0]);
  const [feedText, setFeedText] = useState('');

  const submit = () => {
    if (!feedText.trim()) { toast('请填写反馈内容'); return; }
    toast('感谢反馈', 'check');
    setFeedOpen(false);
    setFeedText('');
  };

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="帮助与反馈" />
      <div className="page-body">
        {/* 搜索 */}
        <div className="row" style={{ gap: 8, background: '#fff', borderRadius: 99, padding: '0 16px', height: 44, border: '1px solid var(--line)' }}>
          <Icon name="search" size={17} color="var(--text-3)" />
          <input
            placeholder="搜索帮助问题，如：退货、佣金、认证"
            style={{ flex: 1, height: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5 }}
          />
        </div>

        {/* FAQ 手风琴 */}
        <div className="card" style={{ marginTop: 12, padding: '6px 16px 14px' }}>
          <div className="row" style={{ padding: '10px 0', gap: 8 }}>
            <Icon name="help-circle" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>常见问题</span>
          </div>
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <div key={f.q} style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                <button className="tap row" style={{ width: '100%', padding: '13px 0', gap: 10, textAlign: 'left' }} onClick={() => setOpenIdx(open ? null : i)}>
                  <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 600 }}>{f.q}</span>
                  <Icon name="chevron-down" size={16} color="var(--text-3)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                </button>
                {open && (
                  <div className="fade-in" style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.8, background: 'var(--bg)', borderRadius: 10, padding: 10, marginBottom: 4 }}>
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 客服入口 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <Icon name="headphones" size={16} color="var(--brand)" />
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>客服与反馈</span>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <button className="btn flex-1 btn-outline" onClick={() => toast('客服连接中…')}>
              <Icon name="headphones" size={16} /> 在线客服
            </button>
            <button className="btn flex-1 btn-primary" onClick={() => setFeedOpen(true)}>
              <Icon name="edit" size={15} /> 意见反馈
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>客服时间 9:00 - 21:00（工作日），高峰期排队预计 5 分钟内接入</div>
        </div>
      </div>

      {/* 意见反馈 */}
      <Sheet open={feedOpen} onClose={() => setFeedOpen(false)} title="意见反馈">
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>反馈类型</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FEED_TYPES.map((t) => (
            <button
              key={t}
              className="tap"
              onClick={() => setFeedType(t)}
              style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
                color: feedType === t ? '#fff' : 'var(--text-2)',
                background: feedType === t ? 'var(--brand-grad)' : '#F5F2EF',
                border: feedType === t ? 'none' : '1px solid var(--line)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '16px 0 8px' }}>反馈内容</div>
        <textarea
          value={feedText}
          onChange={(e) => setFeedText(e.target.value)}
          placeholder="请描述你遇到的问题或建议（必填）"
          rows={4}
          style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: 12, fontSize: 13.5, outline: 'none', resize: 'none', lineHeight: 1.6 }}
        />
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>当前类型：{feedType} · 提交后 1-3 个工作日回复</div>
        <button className="btn btn-primary btn-block" style={{ margin: '16px 0 14px' }} onClick={submit}>提交反馈</button>
      </Sheet>
    </div>
  );
}
