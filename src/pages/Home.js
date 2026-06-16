// src/pages/Home.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Datos iniciales de los personajes ya creados
const INITIAL_CHARACTERS = [
  {
    id: 'aurelian',
    name: 'Aurelian Lerathel',
    class: 'Paladín',
    subclass: 'Jur. de los Antiguos',
    race: 'Aasimar',
    level: 3,
    hp: 19,
    hpMax: 19,
    ac: 18,
    xp: 1520,
    xpNext: 2700,
    alignment: 'Neutral Bueno',
    player: 'Rakets',
    color: '#c9a84c',
    icon: '⚔️',
    stats: { fue: 18, des: 10, con: 11, int: 13, sab: 10, car: 16 },
  },
  {
    id: 'azrael',
    name: 'Azrael',
    class: 'Bardo',
    subclass: 'Col. del Glamour',
    race: 'Aasimar',
    level: 3,
    hp: 19,
    hpMax: 19,
    ac: 13,
    xp: 0,
    xpNext: 2700,
    alignment: 'Caótico Bueno',
    player: '—',
    color: '#4a7fa5',
    icon: '🎵',
    stats: { fue: 10, des: 14, con: 12, int: 13, sab: 12, car: 16 },
  },
];

export default function Home({ user }) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'characters'));
        if (snap.empty) {
          // First time: seed initial characters
          for (const char of INITIAL_CHARACTERS) {
            await setDoc(doc(db, 'characters', char.id), {
              ...char,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          setCharacters(INITIAL_CHARACTERS);
        } else {
          setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={s.loading}>Cargando party...</div>;

  return (
    <div style={s.page}>
      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroGlow} />
        <div style={s.heroContent}>
          <div style={s.heroLabel}>Campaña Activa</div>
          <h1 style={s.heroTitle}>LA PARTY</h1>
          <p style={s.heroSub}>D&D 5e · Manual del Jugador 2024</p>
        </div>
      </div>

      {/* Characters grid */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Personajes</span>
          <div style={s.sectionLine} />
        </div>

        <div style={s.grid}>
          {characters.map(char => (
            <CharCard key={char.id} char={char} onClick={() => navigate(`/personaje/${char.id}`)} />
          ))}
          <AddCard onClick={() => alert('Próximamente: agregar nuevo personaje')} />
        </div>
      </div>

      {/* Quick stats bar */}
      <div style={s.statsBar}>
        <StatPill label="Miembros" value={characters.length} />
        <StatPill label="Nivel promedio" value={Math.round(characters.reduce((a, c) => a + c.level, 0) / (characters.length || 1))} />
        <StatPill label="Sesiones" value="—" />
        <StatPill label="XP mayor" value={Math.max(...characters.map(c => c.xp || 0))} />
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

function CharCard({ char, onClick }) {
  const xpPct = Math.min(100, Math.round((char.xp / char.xpNext) * 100));
  const hpPct = Math.round((char.hp / char.hpMax) * 100);

  return (
    <div style={{ ...s.card, borderTopColor: char.color }} onClick={onClick} className="fade-in">
      {/* Header */}
      <div style={s.cardHeader}>
        <span style={{ fontSize: '28px' }}>{char.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={s.cardName}>{char.name}</div>
          <div style={s.cardSub}>{char.race} {char.class} · Lv{char.level}</div>
        </div>
        <div style={{ ...s.levelBadge, borderColor: char.color, color: char.color }}>
          {char.level}
        </div>
      </div>

      {/* Divider */}
      <div style={{ ...s.cardDivider, background: `linear-gradient(to right, ${char.color}40, transparent)` }} />

      {/* Stats row */}
      <div style={s.cardStats}>
        <MiniStat label="PG" value={`${char.hp}/${char.hpMax}`} />
        <MiniStat label="CA" value={char.ac} />
        <MiniStat label="CAR" value={`+${Math.floor((char.stats?.car - 10) / 2)}`} />
        <MiniStat label="Jugador" value={char.player} small />
      </div>

      {/* HP bar */}
      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} />
      </div>
      <div style={s.barLabel}><span style={{ color: '#5a4820' }}>PG</span></div>

      {/* XP bar */}
      <div style={{ ...s.barTrack, marginTop: '6px' }}>
        <div style={{ ...s.barFill, width: `${xpPct}%`, background: `${char.color}80` }} />
      </div>
      <div style={s.barLabel}>
        <span style={{ color: '#5a4820' }}>XP</span>
        <span style={{ color: '#5a4820' }}>{char.xp?.toLocaleString()} / {char.xpNext?.toLocaleString()}</span>
      </div>

      {/* Subclass badge */}
      <div style={{ ...s.subclassBadge, borderColor: `${char.color}40`, color: char.color }}>
        {char.subclass}
      </div>

      <div style={s.cardCta}>Ver ficha completa →</div>
    </div>
  );
}

function AddCard({ onClick }) {
  return (
    <div style={s.addCard} onClick={onClick}>
      <div style={s.addIcon}>+</div>
      <div style={s.addText}>Agregar personaje</div>
    </div>
  );
}

function MiniStat({ label, value, small }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: small ? '11px' : '14px', fontWeight: '700', color: '#e8c96a' }}>{value}</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={s.pill}>
      <span style={s.pillVal}>{value}</span>
      <span style={s.pillLabel}>{label}</span>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  hero: {
    position: 'relative',
    padding: '48px 20px 36px',
    textAlign: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroContent: { position: 'relative', zIndex: 1 },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(28px,6vw,48px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '15px', color: '#7a6030', marginTop: '8px' },
  section: { marginBottom: '28px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card: {
    background: 'rgba(15,12,24,0.9)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderTop: '3px solid #c9a84c',
    padding: '18px',
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  cardName: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e8c96a', letterSpacing: '0.5px' },
  cardSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' },
  levelBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardDivider: { height: '1px' },
  cardStats: { display: 'flex', justifyContent: 'space-between' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  barLabel: { display: 'flex', justifyContent: 'space-between', marginTop: '2px' },
  subclassBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '3px 8px', textTransform: 'uppercase', alignSelf: 'flex-start' },
  cardCta: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase', marginTop: '2px' },
  addCard: {
    background: 'rgba(201,168,76,0.03)',
    border: '1px dashed rgba(201,168,76,0.15)',
    padding: '18px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '200px',
  },
  addIcon: { fontFamily: 'Cinzel,serif', fontSize: '28px', color: '#3a2e18' },
  addText: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: '#3a2e18', textTransform: 'uppercase' },
  statsBar: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '16px 0',
    borderTop: '1px solid rgba(201,168,76,0.1)',
    marginTop: '8px',
  },
  pill: {
    background: 'rgba(201,168,76,0.05)',
    border: '1px solid rgba(201,168,76,0.12)',
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  pillVal: { fontFamily: 'Cinzel,serif', fontSize: '16px', fontWeight: '700', color: '#e8c96a' },
  pillLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase' },
};
 
