import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

interface NavBarProps {
  title?: React.ReactNode;
  back?: boolean;
  backTo?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  transparent?: boolean;
  onBack?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function NavBar({ title, back, backTo, right, left, transparent, onBack, style, className }: NavBarProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (backTo) navigate(backTo);
    else navigate(-1);
  };
  return (
    <div
      className={className}
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 'var(--nav-h)',
        display: 'flex', alignItems: 'center',
        padding: '0 8px',
        background: transparent ? 'transparent' : 'rgba(255,255,255,.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      <div style={{ width: 72, display: 'flex', alignItems: 'center' }}>
        {back ? (
          <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', padding: 6, borderRadius: 99 }}>
            <Icon name="arrow-left" size={22} />
          </button>
        ) : left}
      </div>
      <div className="flex-1" style={{ textAlign: 'center', fontSize: 16.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ width: 72, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>{right}</div>
    </div>
  );
}
