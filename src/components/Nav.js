// src/components/Nav.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const navItems = [
  { path: '/',         label: 'Party',    icon: '⚔️' },
  { path: '/campana',  label: 'Campaña',  icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/manual',   label: 'Manual',   icon: '📖' },
  { path: '/notas',    label: 'Notas',    icon: '📝' },
  { path: '/perfil',   label: 'Perfil',   icon: '👤' },
];

export default function Nav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [alias, setAlias] = useState(user.email?.split('@')[0] || '');
  const [isDM, setIsDM] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'profiles', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.alias) setAlias(data.alias);
        setIsDM(data.role === 'Dungeon Master' || data.role === 'Jugador / DM');
      }
    }, (err) => {
      console.error('Error cargando perfil:', err);
    });
    return unsub;
  }, [user.uid]);

  const items = isDM
    ? [...navItems, { path: '/dm', label: 'Panel DM', icon: '🛠️' }]
    : navItems;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      {/* ── Desktop topbar ── */}
      <nav style={S.topbar}>

        {/* Brand */}
        <div style={S.brand} onClick={() => navigate('/')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && navigate('/')}>
          <div style={S.brandMark}>⚔</div>
          <div>
            <div style={S.brandTitle}>DND PARTY</div>
            <div style={S.brandSub}>Rakets Campaign</div>
          </div>
        </div>

        {/* Centre nav */}
        <div style={S.navLinks} className="nav-desktop-links">
          {items.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={active ? 'nav-btn nav-btn-active' : 'nav-btn'}
                style={active ? S.navBtnActive : S.navBtn}
              >
                <span style={{ fontSize: '13px' }}>{item.icon}</span>
                <span>{item.label}</span>
                {active && <span className="nav-active-line" style={S.activeUnderline} />}
              </button>
            );
          })}
        </div>

        {/* Right — profile orb + name + logout */}
        <div style={S.userArea} className="nav-user-area">
          <div style={S.profileOrb} title={alias} />
          <span style={S.userName}>{alias}</span>
          <button style={S.logoutBtn} onClick={handleLogout}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(247,221,120,0.55)'; e.currentTarget.style.color = 'var(--gold-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(234,199,94,0.3)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            Salir
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav style={S.mobileNav} className="nav-mobile">
        {items.map(item => {
          const active = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={active ? { ...S.mobileNavBtn, ...S.mobileNavBtnActive } : S.mobileNavBtn}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{ fontSize: '7px', fontFamily: 'Georgia,serif', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

const S = {
  topbar: {
    position: 'sticky', top: 0, zIndex: 100,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '1.25rem',
    minHeight: '76px',
    padding: '0 1.5rem',
    borderBottom: '1px solid rgba(234,199,94,0.22)',
    background: 'rgba(3,3,2,0.84)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 20px 70px rgba(0,0,0,0.52)',
  },

  /* Brand */
  brand: {
    display: 'flex', alignItems: 'center', gap: '12px',
    cursor: 'pointer', userSelect: 'none',
  },
  brandMark: {
    width: '48px', height: '48px', flexShrink: 0,
    display: 'grid', placeItems: 'center',
    border: '1px solid rgba(247,221,120,0.72)',
    borderRadius: '14px',
    background: 'radial-gradient(circle at top, rgba(247,221,120,0.18), rgba(8,7,5,0.92))',
    boxShadow: '0 0 30px rgba(247,221,120,0.22)',
    fontSize: '1.45rem',
    lineHeight: 1,
  },
  brandTitle: {
    fontFamily: 'Georgia,"Times New Roman",serif',
    fontSize: '0.82rem',
    fontWeight: '400',
    letterSpacing: '0.22em',
    lineHeight: 1,
    color: 'var(--gold-1)',
    textTransform: 'uppercase',
    textShadow: '0 0 20px rgba(247,221,120,0.5)',
    marginBottom: '3px',
  },
  brandSub: {
    fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif',
    fontSize: '0.62rem',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },

  /* Nav links */
  navLinks: {
    display: 'flex', justifyContent: 'center', gap: '2px',
  },
  navBtn: {
    position: 'relative',
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    padding: '1.65rem 0.75rem',
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)',
    fontFamily: 'Georgia,"Times New Roman",serif',
    fontSize: '0.78rem', letterSpacing: '0.13em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'color 160ms ease',
    whiteSpace: 'nowrap',
  },
  navBtnActive: {
    position: 'relative',
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    padding: '1.65rem 0.75rem',
    background: 'transparent', border: 'none',
    color: 'var(--gold-1)',
    fontFamily: 'Georgia,"Times New Roman",serif',
    fontSize: '0.78rem', letterSpacing: '0.13em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'color 160ms ease',
    whiteSpace: 'nowrap',
  },
  activeUnderline: {
    position: 'absolute', left: '0.55rem', right: '0.55rem', bottom: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, var(--green-1), var(--gold-1), transparent)',
    boxShadow: '0 0 12px rgba(120,218,96,0.45)',
    pointerEvents: 'none',
  },

  /* Right area */
  userArea: {
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  profileOrb: {
    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
    background: 'radial-gradient(circle at 45% 35%, var(--green-1), var(--green-3) 45%, rgba(0,0,0,0.95) 75%), radial-gradient(circle, var(--gold-1), transparent)',
    border: '1px solid var(--gold-2)',
    boxShadow: '0 0 14px rgba(120,218,96,0.32)',
  },
  userName: {
    fontFamily: 'Georgia,"Times New Roman",serif',
    fontSize: '0.72rem', letterSpacing: '0.1em',
    color: 'var(--text-soft)',
    textTransform: 'uppercase',
    maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(234,199,94,0.3)',
    color: 'var(--text-muted)',
    fontFamily: 'Georgia,"Times New Roman",serif',
    fontSize: '0.68rem', letterSpacing: '0.1em',
    padding: '5px 13px', cursor: 'pointer',
    textTransform: 'uppercase',
    borderRadius: '6px',
    transition: 'all 160ms ease',
  },

  /* Mobile */
  mobileNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: 'rgba(3,3,2,0.97)',
    borderTop: '1px solid rgba(234,199,94,0.15)',
    display: 'flex', justifyContent: 'space-around',
    padding: 'max(6px, env(safe-area-inset-bottom)) 0',
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  mobileNavBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '5px 8px', cursor: 'pointer', transition: 'color 0.2s',
    minWidth: 0,
  },
  mobileNavBtnActive: {
    color: 'var(--gold-1)',
  },
};
