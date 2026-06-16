// src/pages/DMPanel.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import TabResumen from './dm/TabResumen';
import TabCombate from './dm/TabCombate';
import TabNPCs from './dm/TabNPCs';
import TabFacciones from './dm/TabFacciones';
import TabUbicaciones from './dm/TabUbicaciones';
import TabAsistente from './dm/TabAsistente';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'combate', label: 'Combate' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'facciones', label: 'Facciones' },
  { id: 'ubicaciones', label: 'Ubicaciones' },
  { id: 'asistente', label: 'Asistente IA' },
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
        <p style={s.deniedText}>Esta sección es solo para Dungeon Masters. Si creés que esto es un error, actualizá tu rol en tu perfil.</p>
        <button style={s.deniedBtn} onClick={() => navigate('/perfil')}>Ir a tu perfil</button>
      </div>
    );
  }

  return (
    <div style={s.page} className="fade-in">
      <div style={s.hero}>
        <div style={s.heroLabel}>Solo para el ojo que todo ve</div>
        <h1 style={s.heroTitle}>PANEL DEL DM</h1>
      </div>

      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={{ ...s.tabBtn, ...(activeTab === tab.id ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={s.tabContent}>
        {activeTab === 'resumen'     && <TabResumen navigate={navigate} />}
        {activeTab === 'combate'     && <TabCombate />}
        {activeTab === 'npcs'        && <TabNPCs />}
        {activeTab === 'facciones'   && <TabFacciones />}
        {activeTab === 'ubicaciones' && <TabUbicaciones />}
        {activeTab === 'asistente'   && <TabAsistente />}
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  hero: { textAlign: 'center', padding: '40px 20px 20px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)', margin: 0 },
  deniedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px', gap: '6px' },
  deniedGem: { fontSize: '32px', marginBottom: '8px', opacity: 0.6 },
  deniedTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#e07070', letterSpacing: '2px', textTransform: 'uppercase' },
  deniedText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#8a8070', maxWidth: '380px', lineHeight: '1.6', margin: '8px 0 16px' },
  deniedBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px 20px', cursor: 'pointer', textTransform: 'uppercase' },
  tabBar: { display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.2)', marginBottom: '28px', overflowX: 'auto', marginTop: '28px' },
  tabBtn: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px 18px', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#5a4820', whiteSpace: 'nowrap', transition: 'color 0.2s' },
  tabActive: { color: '#e8c96a', borderBottomColor: '#c9a84c' },
  tabContent: { minHeight: '400px' },
};
