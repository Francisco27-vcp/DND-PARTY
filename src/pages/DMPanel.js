// src/pages/DMPanel.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const QUICK_LINKS = [
  { path: '/campana', label: 'Campaña', icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/notas', label: 'Notas', icon: '📝' },
  { path: '/manual', label: 'Manual', icon: '📖' },
];

export default function DMPanel({ user }) {
  const navigate = useNavigate();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isDM, setIsDM] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [xpAmount, setXpAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

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

  const loadCharacters = async () => {
    setLoadingChars(true);
    try {
      const snap = await getDocs(collection(db, 'characters'));
      setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error cargando personajes:', err);
    }
    setLoadingChars(false);
  };

  useEffect(() => {
    if (roleLoaded && isDM) loadCharacters();
  }, [roleLoaded, isDM]);

  const applyXpToAll = async (sign) => {
    const amount = parseInt(xpAmount, 10);
    if (!amount) return;
    setApplying(true);
    try {
      const batch = writeBatch(db);
      characters.forEach(char => {
        const newXp = Math.max(0, (char.xp || 0) + sign * amount);
        batch.update(doc(db, 'characters', char.id), { xp: newXp, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      await loadCharacters();
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (err) {
      console.error('Error aplicando XP a la party:', err);
    }
    setApplying(false);
  };

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
        <p style={s.heroSub}>Control total de la party</p>
      </div>

      {/* QUICK NAV */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Navegación rápida</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.quickNav}>
          {QUICK_LINKS.map(link => (
            <button key={link.path} style={s.quickBtn} onClick={() => navigate(link.path)}>
              <span style={{ fontSize: '20px' }}>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* XP BULK CONTROL */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>XP para toda la party</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.xpBox}>
          <div style={s.xpControl}>
            <input
              type="number"
              min="0"
              value={xpAmount}
              onChange={e => setXpAmount(e.target.value)}
              style={s.xpInput}
              placeholder="Cantidad de XP"
            />
            <button style={s.xpBtnPlus} onClick={() => applyXpToAll(1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '+ Otorgar a todos'}
            </button>
            <button style={s.xpBtnMinus} onClick={() => applyXpToAll(-1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '− Quitar a todos'}
            </button>
            {applied && <span style={s.xpApplied}>✓ Aplicado</span>}
          </div>
          <div style={s.hint}>Se suma o resta a la XP actual de cada personaje de la party (mínimo 0).</div>
        </div>
      </div>

      {/* PARTY SUMMARY */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Resumen de la party</span>
          <div style={s.sectionLine} />
        </div>
        {loadingChars
          ? <div style={s.loadingInline}>Cargando personajes...</div>
          : characters.length === 0
            ? <div style={s.empty}>No hay personajes registrados todavía.</div>
            : <div style={s.grid}>
                {characters.map(char => (
                  <PartyCard key={char.id} char={char} onClick={() => navigate(`/personaje/${char.id}`)} />
                ))}
              </div>
        }
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

function PartyCard({ char, onClick }) {
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  return (
    <div style={{ ...s.card, borderTopColor: char.color || '#c9a84c' }} onClick={onClick} className="fade-in">
      <div style={s.cardHeader}>
        <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
        <div style={{ flex: 1 }}>
          <div style={s.cardName}>{char.name}</div>
          <div style={s.cardSub}>{char.race} {char.class} · Lv{char.level}</div>
        </div>
      </div>
      <div style={s.cardStats}>
        <MiniStat label="PG" value={`${char.hp ?? '—'}/${char.hpMax ?? '—'}`} />
        <MiniStat label="XP" value={(char.xp || 0).toLocaleString()} />
      </div>
      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} />
      </div>
      <div style={s.condRow}>
        <span style={s.condLabel}>Condiciones</span>
        <span style={s.condVal}>{char.conditions || 'Ninguna'}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={s.miniVal}>{value}</div>
      <div style={s.miniLabel}>{label}</div>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  loadingInline: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '8px' },

  deniedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px', gap: '6px' },
  deniedGem: { fontSize: '32px', marginBottom: '8px', opacity: 0.6 },
  deniedTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#e07070', letterSpacing: '2px', textTransform: 'uppercase' },
  deniedText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#8a8070', maxWidth: '380px', lineHeight: '1.6', margin: '8px 0 16px' },
  deniedBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px 20px', cursor: 'pointer', textTransform: 'uppercase' },

  section: { marginBottom: '28px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },

  quickNav: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },

  xpBox: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  xpControl: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  xpInput: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none', width: '160px' },
  xpBtnPlus: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  xpBtnMinus: { background: 'rgba(139,26,26,0.12)', border: '1px solid rgba(139,26,26,0.4)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  xpApplied: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#7aaa7a', textTransform: 'uppercase' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18' },

  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #c9a84c', cursor: 'pointer', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.2s' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  cardName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a', letterSpacing: '0.5px' },
  cardSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' },
  cardStats: { display: 'flex', justifyContent: 'space-around' },
  miniVal: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e8c96a' },
  miniLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  condRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '8px' },
  condLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase' },
  condVal: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#9a9080', textAlign: 'right' },
};
