// src/pages/DMPanel.js — DM Command Center
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

import TabResumen   from './dm/TabResumen';
import TabSesiones  from './dm/TabSesiones';
import TabHistoria  from './dm/TabHistoria';
import TabMundo     from './dm/TabMundo';
import TabNotasDM   from './dm/TabNotasDM';
import TabCombate   from './dm/TabCombate';
import TabAsistente from './dm/TabAsistente';

const TABS = [
  { id: 'resumen',   label: 'Resumen',      icon: '👁' },
  { id: 'sesiones',  label: 'Sesiones',     icon: '📜' },
  { id: 'historia',  label: 'Historia',     icon: '🗺' },
  { id: 'mundo',     label: 'Mundo',        icon: '🌍' },
  { id: 'notas',     label: 'Notas DM',     icon: '🔒' },
  { id: 'combate',   label: 'Combate',      icon: '⚔' },
  { id: 'asistente', label: 'Asistente IA', icon: '✦' },
];

export default function DMPanel({ user }) {
  const navigate = useNavigate();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isDM, setIsDM] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  useEffect(() => {
    const loadRole = async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', user.uid));
        const role = snap.exists() ? snap.data().role : null;
        setIsDM(role === 'Dungeon Master' || role === 'Jugador / DM');
      } catch (err) {
        console.error('Error verificando permisos de DM:', err);
      }
      setRoleLoaded(true);
    };
    loadRole();
  }, [user.uid]);

  if (!roleLoaded) {
    return <div style={s.loading}>Verificando permisos...</div>;
  }

  if (!isDM) {
    return (
      <div style={s.deniedWrap} className="fade-in">
        <div style={s.deniedGem}>🔒</div>
        <div style={s.deniedTitle}>Acceso restringido</div>
        <p style={s.deniedText}>Esta sección es solo para Dungeon Masters.</p>
        <button style={s.deniedBtn} onClick={() => navigate('/perfil')}>Ir a tu perfil</button>
      </div>
    );
  }

  return (
    <div style={s.page} className="fade-in">
      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.eyebrow}>Solo para el ojo que todo ve</div>
          <h1 style={s.title}>PANEL DEL DM</h1>
        </div>
        <div style={s.headerRight}>
          <button style={s.partyViewBtn} onClick={() => navigate('/')}>
            Ver vista de party →
          </button>
        </div>
      </header>

      {/* ── TABS ── */}
      <nav style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{ ...s.tabBtn, ...(activeTab === tab.id ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={s.tabIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <div style={s.content}>
        {activeTab === 'resumen'   && <TabResumen   navigate={navigate} user={user} />}
        {activeTab === 'sesiones'  && <TabSesiones  user={user} />}
        {activeTab === 'historia'  && <TabHistoria  user={user} />}
        {activeTab === 'mundo'     && <TabMundo />}
        {activeTab === 'notas'     && <TabNotasDM   user={user} />}
        {activeTab === 'combate'   && <TabCombate />}
        {activeTab === 'asistente' && <TabAsistente />}
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { maxWidth: '1300px', margin: '0 auto', padding: '0 20px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '3px', fontSize: '11px' },

  // Header
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '32px 0 20px', borderBottom: '1px solid rgba(201,168,76,0.15)' },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  headerRight: {},
  eyebrow: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  title: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(22px,4vw,36px)', fontWeight: '900', letterSpacing: '6px', color: 'var(--gold-bright)', textShadow: '0 0 30px rgba(227,200,120,0.25)', margin: 0 },
  partyViewBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },

  // Tabs
  tabBar: { display: 'flex', gap: '0', borderBottom: '1px solid rgba(201,168,76,0.12)', marginTop: '20px', overflowX: 'auto' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 20px', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--gold-dim)', whiteSpace: 'nowrap', transition: 'color 0.2s', marginBottom: '-1px' },
  tabActive: { color: 'var(--gold-bright)', borderBottomColor: 'var(--gold-2, #c7a242)' },
  tabIcon: { fontSize: '14px' },

  content: { paddingTop: '28px', minHeight: '500px' },

  // Access denied
  deniedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px', gap: '6px' },
  deniedGem: { fontSize: '32px', marginBottom: '8px', opacity: 0.6 },
  deniedTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: 'var(--red-1, #ef7368)', letterSpacing: '2px', textTransform: 'uppercase' },
  deniedText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft)', maxWidth: '380px', lineHeight: '1.6', margin: '8px 0 16px' },
  deniedBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--text-soft)', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px 20px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
};
