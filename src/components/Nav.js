// src/components/Nav.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const navItems = [
  { path: '/', label: 'Party', icon: '⚔️' },
  { path: '/campana', label: 'Campaña', icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/notas', label: 'Notas', icon: '📝' },
];

export default function Nav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      {/* DESKTOP NAV */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logo} onClick={() => navigate('/')}>
            <span style={styles.logoGem}>✦</span>
            <span style={styles.logoText}>RAKETS PARTY</span>
          </div>
          <div style={styles.navLinks}>
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  ...styles.navBtn,
                  ...(location.pathname === item.path ? styles.navBtnActive : {})
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div style={styles.userArea}>
            <span style={styles.userName}>{user.email?.split('@')[0]}</span>
            <button style={styles.logoutBtn} onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAV */}
      <nav style={styles.mobileNav}>
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              ...styles.mobileNavBtn,
              ...(location.pathname === item.path ? styles.mobileNavBtnActive : {})
            }}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            <span style={{ fontSize: '9px', fontFamily: 'Cinzel,serif', letterSpacing: '1px' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

const styles = {
  nav: {
    background: 'rgba(8,6,12,0.95)',
    borderBottom: '1px solid rgba(201,168,76,0.15)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'none',
  },
  navInner: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  logoGem: {
    fontSize: '18px',
    color: '#c9a84c',
    textShadow: '0 0 12px rgba(201,168,76,0.6)',
  },
  logoText: {
    fontFamily: 'Cinzel,serif',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '3px',
    color: '#e8c96a',
  },
  navLinks: {
    display: 'flex',
    gap: '4px',
    flex: 1,
    justifyContent: 'center',
  },
  navBtn: {
    background: 'transparent',
    border: 'none',
    color: '#7a6030',
    fontFamily: 'Cinzel,serif',
    fontSize: '11px',
    letterSpacing: '1.5px',
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '2px',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
  },
  navBtnActive: {
    color: '#e8c96a',
    background: 'rgba(201,168,76,0.08)',
    borderBottom: '1px solid #c9a84c',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userName: {
    fontFamily: 'Cinzel,serif',
    fontSize: '10px',
    color: '#7a6030',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(201,168,76,0.2)',
    color: '#7a6030',
    fontFamily: 'Cinzel,serif',
    fontSize: '9px',
    letterSpacing: '1px',
    padding: '4px 10px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  mobileNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(8,6,12,0.98)',
    borderTop: '1px solid rgba(201,168,76,0.15)',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
    zIndex: 100,
    backdropFilter: 'blur(10px)',
  },
  mobileNavBtn: {
    background: 'transparent',
    border: 'none',
    color: '#5a4820',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '4px 16px',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  mobileNavBtnActive: {
    color: '#e8c96a',
  },
};
