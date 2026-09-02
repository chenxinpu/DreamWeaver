import React from 'react';

export type IconName =
  | 'home' | 'home-filled' | 'trophy' | 'trophy-filled' | 'book' | 'book-filled'
  | 'bag' | 'bag-filled' | 'user' | 'user-filled' | 'search' | 'bell' | 'plus'
  | 'heart' | 'heart-filled' | 'star' | 'star-filled' | 'share' | 'comment'
  | 'arrow-left' | 'arrow-right' | 'chevron-right' | 'chevron-down' | 'close'
  | 'check' | 'check-circle' | 'camera' | 'play' | 'pause' | 'location' | 'clock'
  | 'package' | 'truck' | 'shield' | 'wallet' | 'eye' | 'edit' | 'trash'
  | 'filter' | 'fire' | 'crown' | 'message' | 'settings' | 'help-circle'
  | 'scan' | 'upload' | 'minus' | 'more' | 'cart' | 'send' | 'vip' | 'flag'
  | 'link' | 'retweet' | 'calendar' | 'chart' | 'layers' | 'ruler' | 'sparkle'
  | 'lock' | 'gift' | 'headphones' | 'award' | 'store' | 'refresh' | 'sun' | 'moon'
  | 'coffee' | 'beach' | 'grid' | 'zoom-in' | 'zoom-out' | 'rotate' | 'scissors'
  | 'tshirt' | 'skirt' | 'jacket' | 'pants' | 'dress' | 'hat' | 'copy' | 'phone'
  | 'logout' | 'download' | 'image' | 'receipt' | 'note' | 'history' | 'pen-tool';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></>,
  'home-filled': <><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" fill="currentColor" stroke="none"/></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4"/><path d="M12 14v4m-3 3h6"/></>,
  'trophy-filled': <><path d="M7 3h10v6a5 5 0 0 1-10 0zM6.5 3H3.6A2.6 2.6 0 0 0 6 8.2M17.5 3h2.9a2.6 2.6 0 0 1-2.4 5.2M12 14.5V19m-3.5 2.5h7" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M20 19a2 2 0 0 0-2 2H4a2 2 0 0 1 2-2"/></>,
  'book-filled': <><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM20 19a2 2 0 0 0-2 2H4a2 2 0 0 1 2-2" fill="none" strokeWidth="1.8"/></>,
  bag: <><path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
  'bag-filled': <><path d="M5.5 7h13l.8 14H4.7zM8.8 7V5.6a3.2 3.2 0 0 1 6.4 0V7" fill="none" strokeWidth="1.8" strokeLinejoin="round"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></>,
  'user-filled': <><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6z" fill="currentColor" stroke="none"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  heart: <><path d="M12 20.5s-8-4.9-8-11a4.6 4.6 0 0 1 8-3.1 4.6 4.6 0 0 1 8 3.1c0 6.1-8 11-8 11z"/></>,
  'heart-filled': <><path d="M12 20.5s-8-4.9-8-11a4.6 4.6 0 0 1 8-3.1 4.6 4.6 0 0 1 8 3.1c0 6.1-8 11-8 11z" fill="currentColor"/></>,
  star: <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></>,
  'star-filled': <><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="none"/></>,
  share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 10.8 7.4-3.6m-7.4 6 7.4 3.6"/></>,
  comment: <><path d="M21 12a8 8 0 0 1-8 8H4l2.2-3A8 8 0 1 1 21 12z"/></>,
  'arrow-left': <><path d="M19 12H5m6-7-7 7 7 7"/></>,
  'arrow-right': <><path d="M5 12h14m-6-7 7 7-7 7"/></>,
  'chevron-right': <><path d="m9 6 6 6-6 6"/></>,
  'chevron-down': <><path d="m6 9 6 6 6-6"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7"/></>,
  'check-circle': <><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>,
  play: <><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/></>,
  pause: <><path d="M8 5v14M16 5v14"/></>,
  location: <><path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  package: <><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/></>,
  truck: <><path d="M2 6h12v11H2z"/><path d="M14 10h4l4 4v3h-8z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4.5"/></>,
  wallet: <><path d="M4 7a2 2 0 0 1 2-2h13v14H6a2 2 0 0 1-2-2z"/><path d="M16 11h5v3h-5a1.5 1.5 0 0 1 0-3z"/></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></>,
  edit: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14 6 3 3"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/></>,
  filter: <><path d="M4 5h16l-6 7v6l-4 2v-8z"/></>,
  fire: <><path d="M12 22c4.4 0 7-2.8 7-6.5 0-3-2-5-3.5-6.5C14 7.5 13 5 13 3c-2.5 2-5 5.5-5 9 0 1 .3 2 .8 2.8C8 14 7 13 7 11.5c-2.5 2.5-3.5 5-3.5 7 0 2 3.5 3.5 8.5 3.5z"/></>,
  crown: <><path d="m3 8 4.5 4L12 5l4.5 7L21 8l-1.5 10h-15z"/></>,
  message: <><path d="M21 12a8 8 0 0 1-8 8H4l2.2-3A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.4" strokeLinecap="round"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  'help-circle': <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 1.8M12 16.5h.01" strokeWidth="2.2" strokeLinecap="round"/></>,
  scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 9v6h8V9H8z"/></>,
  upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
  minus: <><path d="M5 12h14"/></>,
  more: <><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></>,
  cart: <><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 12h11L21 8H7"/></>,
  send: <><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></>,
  vip: <><path d="M3 7l3 12 6-9 6 9 3-12"/><path d="M9 7h6"/></>,
  flag: <><path d="M5 21V4m0 1h13l-3 4 3 4H5"/></>,
  link: <><path d="M9 15l6-6"/><path d="M11 6.5 13 4.5a4 4 0 0 1 5.7 5.7l-2 2a4 4 0 0 1-5.7 0"/><path d="M13 17.5l-2 2a4 4 0 0 1-5.7-5.7l2-2a4 4 0 0 1 5.7 0"/></>,
  retweet: <><path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></>,
  ruler: <><path d="M3 8h18l-1 12H4z"/><path d="M7 8v4m4-4v3m4-3v4m4-4v3" strokeWidth="1.5"/></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></>,
  gift: <><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M2.5 9h19v4h-19zM12 9v12M12 9s-5.5 0-5.5-3A2.5 2.5 0 0 1 12 5.5 2.5 2.5 0 0 1 17.5 6c0 3-5.5 3-5.5 3z"/></>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="6" rx="2"/><rect x="16" y="14" width="5" height="6" rx="2"/></>,
  award: <><circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/></>,
  store: <><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M5.5 11.5V20h13v-8.5"/></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></>,
  coffee: <><path d="M4 9h14v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 4c0 1 .8 1 .8 2M11 4c0 1 .8 1 .8 2M15 4c0 1 .8 1 .8 2"/></>,
  beach: <><path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0M7 16c.5-3 1.5-5.5 3.5-8M11 12c2-3 4.5-5 8-5M5 20c2-3 6-4 9-3"/></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>,
  'zoom-in': <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></>,
  'zoom-out': <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/></>,
  rotate: <><path d="M20 11a8 8 0 1 0-2.3 5.6"/><path d="M20 4v4h-4"/></>,
  scissors: <><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.5 20 19M8.2 16.5 20 5"/></>,
  tshirt: <><path d="M8 4 4 7l2.5 4 2-1.5V20h7V9.5l2 1.5L20 7l-4-3a3.2 3.2 0 0 1-8 0z"/></>,
  skirt: <><path d="M12 4c2.8 0 5.5 1.5 7 4.5L15.5 20h-7L5 8.5C6.5 5.5 9.2 4 12 4z"/><path d="M5.2 8.5h13.6"/></>,
  jacket: <><path d="M9 4l-4.5 2L3 12l3 1.5V20h12v-6.5L21 12l-1.5-6L15 4"/><path d="M9 4c0 2 1.5 3 3 3s3-1 3-3M9 20v-5h6v5"/></>,
  pants: <><path d="M6 4h12l-1 16h-3.5L12 13l-1.5 7H7z"/><path d="M6.5 4 8 11M17.5 4 16 11"/></>,
  dress: <><path d="M12 3c1.7 0 2.5 1 2.5 2.5-.8.5-.8 1.5 0 2 .8.6.8 1.6 0 2.5-.8.9-.8 2.2 0 3 1 1 1.8 2.6 1.5 4.5-.4 2.4-1.8 4-4 4s-3.6-1.6-4-4c-.3-1.9.5-3.5 1.5-4.5.8-.8.8-2.1 0-3-.8-.9-.8-1.9 0-2.5.8-.5.8-1.5 0-2C9.5 4 10.3 3 12 3z"/></>,
  hat: <><path d="M4 9a8 8 0 0 1 16 0"/><path d="M3 9h18l-2.5 5h-13z"/><path d="M8 14v2.5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V14"/></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  phone: <><path d="M5 4h4l1.5 4.5-2.5 2a12 12 0 0 0 5.5 5.5l2-2.5L20 15v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4.5-4.5L5 20"/></>,
  receipt: <><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3z"/><path d="M9 9h6M9 13h6"/></>,
  note: <><path d="M5 4h14v12l-5 4H5z"/><path d="M8 9h8M8 13h5"/></>,
  history: <><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4M12 8v4l3 2"/></>,
  'pen-tool': <><path d="M12 19l7-7-3-3-7 7-1 4z"/><path d="m18 13-3-3M10 8a2 2 0 1 0-4 0c0 1 .8 1.5 2 2.5M6 8c0-3 1-5 4-5"/></>,
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 22, color, strokeWidth = 1.8, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
