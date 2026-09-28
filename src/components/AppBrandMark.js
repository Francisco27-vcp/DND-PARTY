import React from 'react';

export default function AppBrandMark({ className = '', style }) {
  return (
    <div className={`app-brand-mark ${className}`.trim()} style={style} aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M24 4 39 11v12c0 9-5.8 15.9-15 21C14.8 38.9 9 32 9 23V11l15-7Z" />
        <path d="m24 12 9 5-2.4 13.2L24 36l-6.6-5.8L15 17l9-5Z" />
        <path d="m17.2 17.2 13.6 13.6M30.8 17.2 17.2 30.8M24 12v24M15 17h18M17.4 30.7h13.2" />
        <circle cx="24" cy="24" r="2.1" />
      </svg>
    </div>
  );
}
