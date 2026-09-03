/* ============ 织梦 · 我的主页 ============ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { Avatar, CertBadge, StatCell, Tag } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import { dashboard, me, messages, orders, worksByCreator } from '../../data/mock';
import { useBody, useLocalState, DEFAULT_BODY, recommendSize } from '../../utils/store';
import { fmt, TapStyle } from './_shared';

const GRID: { icon: IconName; label: string; path: string; color: string; bg: string }[] = [
  { icon: 'store', label: '我的作品集', path: '/profile/works', color: '#E85C87', bg: '#FBEDF2' },
  { icon: 'star', label: '我的收藏', path: '/profile/collections', color: '#C9A23F', bg: '#FBF4E2' },
  { icon: 'heart', label: '我的关注', path: '/profile/following', color: '#34A36F', bg: '#E6F5EE' },
  { icon: 'clock', label: '浏览历史', path: '/profile/collections?tab=history', color: '#3B82F6', bg: '#EAF2FE' },
  { icon: 'book', label: '学习进度', path: '/learn', color: '#8B5CF6', bg: '#F1EDF9' },
  { icon: 'message', label: '消息中心', path: '/messages', color: '#F59E0B', bg: '#FEF6E3' },
  { icon: 'settings', label: '设置', path: '/profile/settings', color: '#64748B', bg: '#F1F3F5' },
  { icon: 'help-circle', label: '帮助与反馈', path: '/profile/help', color: '#0EA5A4', bg: '#E6F8F7' },
];

const ORDER_BADGES: { label: string; status: number | null; color: string; bg: string }[] = [
  { label: '待生产', status: 1, color: '#6B6470', bg: '#F1EDE9' },
  { label: '生产中', status: 2, color: '#E85C87', bg: '#FBEDF2' },
  { label: '质检中', status: 3, color: '#9A7A1E', bg: '#FBF4E2' },
  { label: '已发货', status: 5, color: '#3B82F6', bg: '#EAF2FE' },
  { label: '售后', status: null, color: '#E5484D', bg: '#FCEBEC' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [body] = useBody();
  const [readIds] = useLocalState<number[]>('zm_read_msgs', []);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const collected = JSON.stringify(body) !== JSON.stringify(DEFAULT_BODY);
  const myWorks = worksByCreator(me.id);
  const unreadCount = messages.filter((m) => !m.read && !readIds.includes(m.id)).length;
  const currentReturnRate = dashboard.returnTrend[dashboard.returnTrend.length - 1].rate;

  return (
    <div className="page">
      <TapStyle />
      {/* 渐变头部 */}
      <div style={{
        background: 'var(--brand-grad)', padding: '24px 18px 22px', color: '#fff',
        borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
      }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Avatar src={me.avatar} size={72} name={me.nickname} ring />
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>{me.nickname}</span>
              <CertBadge level={me.level} />
            </div>
            <div className="ellipsis-2" style={{ marginTop: 6, fontSize: 12.5, color: 'rgba(255,255,255,.88)', lineHeight: 1.6 }}>
              {me.bio || '这个人很懒，还没写简介～'}
            </div>
            <button
              className="tap"
              onClick={() => toast('资料编辑')}
              style={{
                marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 28, padding: '0 12px', borderRadius: 99,
                background: 'rgba(255,255,255,.24)', color: '#fff', fontSize: 12, fontWeight: 600,
              }}
            >
              <Icon name="edit" size={12} /> 编辑资料
            </button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <StatCell label="粉丝" value={fmt(me.followers)} color="#fff" />
          <StatCell label="关注" value={fmt(me.following)} color="#fff" />
          <StatCell label="作品" value={me.works} color="#fff" />
          <StatCell label="主页访问量" value={fmt(8612)} color="#fff" />
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 14 }}>
        {/* 体型数据卡 */}
        <div className="card tap" style={{ padding: 14 }} onClick={() => navigate('/profile/body')}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ruler" size={16} color="var(--brand)" />
            </span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>体型数据</div>
            <span className="flex-1" />
            <Icon name="chevron-right" size={16} color="var(--text-3)" />
          </div>
          {!collected ? (
            <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
              <div className="flex-1" style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                完成体型采集，解锁 <strong style={{ color: 'var(--brand-deep)' }}>3D体模适配</strong> 与 <strong style={{ color: 'var(--brand-deep)' }}>智能尺码</strong> 推荐，让每件定制都合身～
              </div>
              <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); navigate('/profile/body'); }}>去采集</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>身高 {body.height}cm · 体重 {body.weight}kg</span>
              <Tag variant="success" icon="check">推荐尺码 {recommendSize(body)}</Tag>
              <button
                className="tap"
                onClick={(e) => { e.stopPropagation(); navigate('/profile/body'); }}
                style={{ fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 600, marginLeft: 'auto' }}
              >
                修改
              </button>
            </div>
          )}
        </div>

        {/* 订单入口卡 */}
        <div className="card tap" style={{ marginTop: 12, padding: 14 }} onClick={() => navigate('/orders')}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="package" size={16} color="var(--info)" />
            </span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>我的订单</div>
            <span className="flex-1" />
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>全部订单</span>
            <Icon name="chevron-right" size={16} color="var(--text-3)" />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {ORDER_BADGES.map((b) => {
              const count = b.status === null ? 0 : orders.filter((o) => o.status === b.status).length;
              return (
                <span key={b.label} className="row" style={{ gap: 4, background: b.bg, color: b.color, borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                  {b.label}
                  <span style={{ background: '#fff', borderRadius: 99, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, padding: '0 4px' }}>{count}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* 功能宫格 2×4 */}
        <div className="card" style={{ marginTop: 12, padding: '16px 6px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 16 }}>
            {GRID.map((g) => (
              <button key={g.label} className="tap col" onClick={() => navigate(g.path)} style={{ alignItems: 'center', gap: 7 }}>
                <span style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={g.icon} size={21} color={g.color} />
                  {g.label === '消息中心' && unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 99, background: 'var(--danger)', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontWeight: 700 }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 创作中心（服装设计App）入口 */}
        <button
          onClick={() => navigate('/design')}
          style={{
            width: '100%', marginTop: 12, display: 'block', padding: '14px 16px', borderRadius: 16, textAlign: 'left',
            background: 'linear-gradient(120deg,#2E2638 0%,#4A3A5C 55%,#8A5B9E 130%)', color: '#fff',
            boxShadow: '0 10px 24px rgba(46,38,56,.3)', overflow: 'hidden', position: 'relative',
          }}
        >
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#F27BA0,#D44771)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(0,0,0,.25)', flexShrink: 0 }}>
              <Icon name="pen-tool" size={22} />
            </span>
            <div className="flex-1">
              <div style={{ fontSize: 16, fontWeight: 700 }}>织梦 · 设计创作台</div>
              <div style={{ fontSize: 11.5, opacity: .78, marginTop: 3 }}>参数化设计 · AI 生成 5 款候选 · 3D 试衣 · 一键上架</div>
            </div>
            <Icon name="chevron-right" size={18} color="rgba(255,255,255,.85)" />
          </div>
          <div className="row" style={{ marginTop: 12, gap: 6 }}>
            {['文生图', '草图优化', '风格融合', '一人一版'].map((t) => (
              <span key={t} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)' }}>{t}</span>
            ))}
          </div>
          <span style={{ position: 'absolute', right: -24, top: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
          <span style={{ position: 'absolute', right: 40, bottom: -34, width: 90, height: 90, borderRadius: '50%', background: 'rgba(232,92,135,.18)', pointerEvents: 'none' }} />
        </button>

        {/* 创作者后台卡 */}
        <div className="card tap" style={{ marginTop: 12, overflow: 'hidden' }} onClick={() => navigate('/profile/dashboard')}>
          <div className="row" style={{ padding: '14px 16px 0', gap: 8 }}>
            <Icon name="chart" size={17} color="var(--brand)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>创作者后台</span>
            <span className="flex-1" />
            <span className="row" style={{ fontSize: 12.5, color: 'var(--text-3)', gap: 2 }}>数据概览<Icon name="chevron-right" size={13} /></span>
          </div>
          <div className="row" style={{ padding: '12px 16px 14px', gap: 8 }}>
            <div className="flex-1" style={{ background: 'var(--brand-soft)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>今日成交额</div>
              <div className="price" style={{ fontSize: 19, marginTop: 2 }}>¥{fmt(dashboard.todayAmount)}</div>
            </div>
            {[
              { label: '转化率', value: `${dashboard.conversionRate}%` },
              { label: '排名', value: String(dashboard.rank) },
              { label: '月成交量', value: String(dashboard.monthlyOrders) },
            ].map((s) => (
              <div key={s.label} className="flex-1" style={{ borderRadius: 12, padding: '10px 12px', background: 'var(--bg-deep)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ padding: '10px 16px', background: 'var(--success-soft)', color: 'var(--success)', fontSize: 12.5, gap: 6 }}>
            <Icon name="shield" size={15} />
            <span>退货率预警 {currentReturnRate}%（低于10%门槛，正常 ✓）</span>
            <span className="flex-1" />
            <Icon name="chevron-right" size={13} />
          </div>
        </div>

        {/* 学习进度卡 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="book" size={17} color="var(--brand)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>学习进度</span>
            <span className="flex-1" />
            <CertBadge level={me.level} />
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)' }}>
              <span>「设计认证」课程 · 已完成 12/18 课时</span>
              <span className="price" style={{ fontSize: 13 }}>68%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-deep)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: '68%', height: '100%', borderRadius: 99, background: 'var(--brand-grad)' }} />
            </div>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16, height: 42 }} onClick={() => navigate('/learn')}>去学习</button>
        </div>

        {/* 品牌孵化卡 */}
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="crown" size={17} color="#C9A23F" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>品牌孵化</span>
            <Tag variant="gold" icon="vip">0元入驻</Tag>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 6 }}>入驻品牌，享流量扶持 · 供应链支持 · 官方认证标识</div>
          {[
            { text: '≥20件原创作品', ok: myWorks.length >= 20 },
            { text: '资深设计师认证', ok: me.level >= 3 },
            { text: '营业执照', ok: false },
          ].map((c) => (
            <div key={c.text} className="row" style={{ gap: 8, marginTop: 10, fontSize: 13 }}>
              <Icon name={c.ok ? 'check-circle' : 'close'} size={15} color={c.ok ? 'var(--success)' : 'var(--text-3)'} />
              <span style={{ color: c.ok ? 'var(--text)' : 'var(--text-2)' }}>{c.text}</span>
              <span className="flex-1" />
              {c.ok ? <Tag variant="success">已满足</Tag> : <Tag variant="gray">未满足</Tag>}
            </div>
          ))}
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => toast('已提交申请，平台将7个工作日内审核')}>
            <Icon name="crown" size={15} /> 申请品牌孵化
          </button>
        </div>

        {/* 退出登录 */}
        <button className="btn btn-block tap" style={{ marginTop: 16, color: 'var(--danger)', background: '#fff', border: '1px solid #F3C6CB' }} onClick={() => setLogoutOpen(true)}>
          退出登录
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>织梦 v1.0.0 · 女性设计师成长社区</div>
      </div>

      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title="退出登录">
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          退出后需要重新登录才能继续使用，确定要退出当前账号「{me.nickname}」吗？
        </div>
        <div className="row" style={{ gap: 12, margin: '20px 0 14px' }}>
          <button className="btn flex-1 btn-ghost" onClick={() => setLogoutOpen(false)}>取消</button>
          <button className="btn flex-1 btn-danger" onClick={() => { setLogoutOpen(false); toast('已退出登录', 'check'); }}>退出登录</button>
        </div>
      </Sheet>
    </div>
  );
}
