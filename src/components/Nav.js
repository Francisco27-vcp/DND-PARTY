// src/components/Nav.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const navItems = [
  { path: '/', label: 'Party', icon: '⚔️' },
  { path: '/campana', label: 'Campaña', icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/manual', label: 'Manual', icon: '📖' },
  { path: '/notas', label: 'Notas', icon: '📝' },
  { path: '/perfil', label: 'Perfil', icon: '👤' },
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

  const items = isDM ? [...navItems, { path: '/dm', label: 'Panel DM', icon: '🛠️' }] : navItems;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logo} onClick={() => navigate('/')}>
            <span style={styles.logoGem}>⚔</span>
            <span style={styles.logoText}>DND PARTY</span>
          </div>
          <div style={styles.navLinks}>
            {items.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{ ...styles.navBtn, ...(location.pathname === item.path ? styles.navBtnActive : {}) }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div style={styles.userArea}>
            <span style={styles.userName}>{alias}</span>
            <button style={styles.logoutBtn} onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </nav>

      <nav style={styles.mobileNav}>
        {items.map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            style={{ ...styles.mobileNavBtn, ...(location.pathname === item.path ? styles.mobileNavBtnActive : {}) }}>
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            <span style={{ fontSize: '7px', fontFamily: 'Cinzel,serif', letterSpacing: '0.5px' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

const styles = {
  nav: { background: 'rgba(11,9,6,0.95)', borderBottom: '1px solid var(--line)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 },
  navInner: { maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  logoGem: { fontSize: '18px', color: 'var(--gold)', textShadow: '0 0 12px rgba(201,164,73,0.6)' },
  logoText: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gold-bright)' },
  navLinks: { display: 'flex', gap: '2px', flex: 1, justifyContent: 'center' },
  navBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase', transition: 'all 0.2s' },
  navBtnActive: { color: 'var(--gold-bright)', background: 'rgba(201,164,73,0.08)', borderBottom: '1px solid var(--gold)' },
  userArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--parchment-dim)', letterSpacing: '1px', textTransform: 'uppercase' },
  logoutBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase' },
  mobileNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(11,9,6,0.98)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-around', padding: '6px 0 max(6px, env(safe-area-inset-bottom))', zIndex: 100, backdropFilter: 'blur(10px)' },
  mobileNavBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 8px', cursor: 'pointer', transition: 'color 0.2s' },
  mobileNavBtnActive: { color: 'var(--gold-bright)' },
};

