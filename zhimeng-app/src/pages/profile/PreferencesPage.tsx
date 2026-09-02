/* ============ 织梦 · 偏好与收藏管理 ============ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { EmptyState, Price, SectionHeader } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { STYLE_TAGS, workById } from '../../data/mock';
import { K, useLocalState } from '../../utils/store';
import { SafeImg, TapStyle } from './_shared';
import type { Work } from '../../data/types';

const FOLDER_ICONS: IconName[] = ['star', 'sparkle', 'cart', 'layers'];

export default function PreferencesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [prefs, setPrefs] = useLocalState<string[]>(K.preferences, []);
  const [folders, setFolders] = useLocalState<string[]>('zm_folders', ['默认收藏', '灵感', '想买']);
  const [history, setHistory] = useLocalState<number[]>('zm_history', [101, 104, 117, 103]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const togglePref = (t: string) => {
    setPrefs((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
    toast('偏好已更新，推荐将更懂你', 'check');
  };

  const addFolder = () => {
    const name = folderName.trim();
    if (!name) { toast('请输入收藏夹名称'); return; }
    if (folders.includes(name)) { toast('收藏夹已存在'); return; }
    setFolders([...folders, name]);
    setFolderName('');
    setNewFolderOpen(false);
    toast('收藏夹已创建', 'check');
  };

  const historyWorks = history.map(workById).filter((w): w is Work => !!w);

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="偏好与收藏管理" />
      <div className="page-body">
        {/* 风格偏好 */}
        <div className="card" style={{ padding: 16 }}>
          <SectionHeader title="风格偏好" />
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: -4, marginBottom: 12 }}>选择喜欢的风格，推荐将更懂你～</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STYLE_TAGS.map((t) => {
              const active = prefs.includes(t);
              return (
                <button
                  key={t}
                  className="tap"
                  onClick={() => togglePref(t)}
                  style={{
                    padding: '7px 15px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                    color: active ? '#fff' : 'var(--text-2)',
                    background: active ? 'var(--brand-grad)' : '#F5F2EF',
                    boxShadow: active ? '0 3px 10px rgba(232,92,135,.3)' : 'none',
                    border: active ? 'none' : '1px solid var(--line)',
                  }}
                >
                  {active && <Icon name="check" size={12} style={{ marginRight: 4, verticalAlign: -1 }} />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* 收藏夹管理 */}
        <div className="card" style={{ marginTop: 12, padding: '6px 16px 16px' }}>
          <SectionHeader title="收藏夹管理" extra="新建" onClick={() => setNewFolderOpen(true)} />
          {folders.map((f, i) => (
            <div key={f} className="tap row" style={{ padding: '11px 0', borderBottom: i < folders.length - 1 ? '1px solid var(--line)' : 'none' }} onClick={() => toast(`打开收藏夹「${f}」（模拟）`)}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={FOLDER_ICONS[i % FOLDER_ICONS.length]} size={17} color="var(--brand)" />
              </span>
              <span className="flex-1" style={{ fontSize: 14, fontWeight: 500, marginLeft: 10 }}>{f}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>0 件作品</span>
              <Icon name="chevron-right" size={15} color="var(--text-3)" />
            </div>
          ))}
        </div>

        {/* 浏览历史 */}
        <div className="card" style={{ marginTop: 12, padding: '6px 16px 16px' }}>
          <SectionHeader title="浏览历史" extra="清空" onClick={() => { setHistory([]); toast('浏览历史已清空', 'check'); }} />
          {historyWorks.length === 0 ? (
            <EmptyState icon="clock" title="暂无浏览记录" desc="去广场逛逛，看看喜欢的作品吧" />
          ) : (
            historyWorks.map((w) => (
              <div key={w.id} className="tap row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }} onClick={() => navigate(`/work/${w.id}`)}>
                <SafeImg src={w.cover} alt={w.title} style={{ width: 52, height: 64, borderRadius: 8 }} />
                <div className="flex-1" style={{ marginLeft: 10, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 13.5, fontWeight: 600 }}>{w.title}</div>
                  <div className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{w.category} · {w.styleTags.slice(0, 2).join(' / ')}</div>
                  <Price value={w.price} size={13} />
                </div>
                <Icon name="chevron-right" size={15} color="var(--text-3)" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新建收藏夹 */}
      <Sheet open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="新建收藏夹">
        <input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="输入收藏夹名称（最多10个字）"
          maxLength={10}
          style={{ width: '100%', height: 46, border: '1.5px solid var(--line)', borderRadius: 12, padding: '0 14px', fontSize: 14, outline: 'none', marginTop: 4 }}
        />
        <button className="btn btn-primary btn-block" style={{ margin: '18px 0 14px' }} onClick={addFolder}>创建</button>
      </Sheet>
    </div>
  );
}
