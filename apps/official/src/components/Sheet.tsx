import React from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

/* ---------- Toast 轻提示 ---------- */
interface ToastItem { id: number; text: string; icon?: IconName }
const ToastCtx = React.createContext<(text: string, icon?: IconName) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const show = React.useCallback((text: string, icon?: IconName) => {
    const id = ++idRef.current;
    setItems((p) => [...p, { id, text, icon }]);
    setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', top: '18%', left: 0, right: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {items.map((i) => (
          <div key={i.id} className="fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(30,22,28,.92)', color: '#fff',
            padding: '10px 18px', borderRadius: 99, fontSize: 13.5,
            boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxWidth: '80%',
          }}>
            {i.icon && <Icon name={i.icon} size={16} />}
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- 底部弹层 ---------- */
export function Sheet({ open, onClose, title, children, height }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; height?: string;
}) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'var(--mask)' }}
        onClick={onClose}
        className="fade-in"
      />
      <div
        className="fade-in"
        style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: '#fff', borderRadius: '22px 22px 0 0',
          maxHeight: height || '78%', display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(var(--safe-bottom) + 8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ padding: 4 }}>
            <Icon name="close" size={20} color="var(--text-3)" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 18px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- 分段选择器 ---------- */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', equal }: {
  options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; equal?: boolean;
}) {
  return (
    <div
      className="row"
      style={{
        background: 'var(--bg-deep)', borderRadius: 99, padding: 3, width: equal ? '100%' : 'fit-content',
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: equal ? 1 : undefined,
              padding: size === 'sm' ? '5px 12px' : '7px 16px',
              borderRadius: 99, fontSize: size === 'sm' ? 12.5 : 14,
              fontWeight: active ? 700 : 500,
              color: active ? '#fff' : 'var(--text-2)',
              background: active ? 'var(--brand-grad)' : 'transparent',
              boxShadow: active ? '0 2px 8px rgba(232,92,135,.35)' : 'none',
              transition: 'all .18s ease', whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 计数动画按钮（点赞等） ---------- */
export function CountButton({ icon, activeIcon, count, active, color, onToggle, size = 20, activeColor }: {
  icon: IconName; activeIcon: IconName; count: number; active: boolean;
  color?: string; activeColor?: string; onToggle: () => void; size?: number;
}) {
  const [boom, setBoom] = React.useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); setBoom(true); setTimeout(() => setBoom(false), 350); }}
      className="row"
      style={{ gap: 5, color: active ? (activeColor || 'var(--brand)') : (color || 'var(--text-2)'), fontSize: 13, padding: '4px 6px' }}
    >
      <span className={boom ? 'pop' : ''} style={{ display: 'flex' }}>
        <Icon name={active ? activeIcon : icon} size={size} />
      </span>
      {count > 0 && <span style={{ fontWeight: 600 }}>{count >= 10000 ? (count / 10000).toFixed(1) + 'w' : count}</span>}
    </button>
  );
}
