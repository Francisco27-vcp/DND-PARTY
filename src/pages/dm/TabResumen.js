// src/pages/dm/TabResumen.js
import React, { useEffect, useState } from 'react';
import {
  collection, getDocs, onSnapshot, doc, updateDoc,
  writeBatch, serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function TabResumen({ navigate, user }) {
  const [characters, setCharacters]     = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [stats, setStats]               = useState({ sessions: 0, published: 0, npcs: 0, factions: 0, dmNotes: 0 });
  const [lastSession, setLastSession]   = useState(null);
  const [xpAmount, setXpAmount]         = useState('');
  const [applying, setApplying]         = useState(false);
  const [applied, setApplied]           = useState(false);

  // Real-time party characters
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'characters'), snap => {
      setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingChars(false);
    }, err => { console.error(err); setLoadingChars(false); });
    return () => unsub();
  }, []);

  // Campaign stats (one-shot counts)
  useEffect(() => {
    const loadStats = async () => {
      const [sessSnap, npcSnap, facSnap, notesSnap] = await Promise.all([
        getDocs(collection(db, 'sessions')),
        getDocs(collection(db, 'npcs')),
        getDocs(collection(db, 'factions')),
        getDocs(collection(db, 'dm_notes')),
      ]);
      const sessDocs = sessSnap.docs.map(d => d.data());
      const published = sessDocs.filter(s => s.visibleToParty !== false).length;
      setStats({
        sessions: sessDocs.length,
        published,
        npcs: npcSnap.size,
        factions: facSnap.size,
        dmNotes: notesSnap.size,
      });

      // Last session
      const sorted = sessSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      if (sorted.length > 0) setLastSession(sorted[0]);
    };
    loadStats();
  }, []);

  const toggleInspiration = async (charId, current) => {
    try {
      await updateDoc(doc(db, 'characters', charId), { inspiration: !current });
    } catch (err) { console.error(err); }
  };

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
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (err) { console.error(err); }
    setApplying(false);
  };

  const totalXp   = characters.reduce((acc, c) => acc + (c.xp || 0), 0);
  const avgHpPct  = characters.length
    ? Math.round(characters.reduce((a, c) => a + ((c.hp || 0) / (c.hpMax || 1)), 0) / characters.length * 100)
    : 0;
  const inspired  = characters.filter(c => c.inspiration).length;

  return (
    <div>

      {/* ── CAMPAIGN STATS STRIP ── */}
      <div style={s.statsStrip}>
        <StatBig label="Sesiones totales"  value={stats.sessions}   />
        <StatBig label="Publicadas"        value={stats.published}  accent />
        <StatBig label="NPCs"              value={stats.npcs}       />
        <StatBig label="Facciones"         value={stats.factions}   />
        <StatBig label="Notas DM"          value={stats.dmNotes}    />
        <StatBig label="Jugadores"         value={characters.length}/>
      </div>

      {/* ── LAST SESSION ── */}
      {lastSession && (
        <Section title="Última sesión">
          <div style={s.lastSess}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--gold-dim)', letterSpacing: '1px' }}>
                {lastSession.date || '—'}
              </span>
              <span style={{
                fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '2px 8px',
                background: lastSession.visibleToParty !== false ? 'rgba(101,194,96,0.1)' : 'rgba(201,168,76,0.08)',
                border: `1px solid ${lastSession.visibleToParty !== false ? 'rgba(101,194,96,0.3)' : 'rgba(201,168,76,0.2)'}`,
                color: lastSession.visibleToParty !== false ? '#65c260' : 'var(--gold-dim)',
              }}>
                {lastSession.visibleToParty !== false ? '✓ Publicada' : '✎ Borrador'}
              </span>
              {lastSession.xpEarned > 0 && (
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold)' }}>
                  +{lastSession.xpEarned} XP
                </span>
              )}
            </div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '15px', fontWeight: '700', color: 'var(--gold-bright)', marginBottom: '8px' }}>
              {lastSession.title}
            </div>
            {lastSession.summary && (
              <p style={{ fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment-dim)', lineHeight: '1.7', margin: 0 }}>
                {lastSession.summary.length > 200 ? lastSession.summary.slice(0, 200) + '…' : lastSession.summary}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ── PARTY OVERVIEW ── */}
      <Section title="Estado de la party">
        <div style={s.partyMeta}>
          <span style={s.partyMetaChip}>❤ Salud promedio {avgHpPct}%</span>
          <span style={s.partyMetaChip}>✦ Inspirados {inspired}/{characters.length}</span>
          <span style={s.partyMetaChip}>⭐ XP total {totalXp.toLocaleString()}</span>
        </div>
        {loadingChars
          ? <div style={s.muted}>Cargando personajes...</div>
          : characters.length === 0
            ? <div style={s.muted}>No hay personajes registrados todavía.</div>
            : <div style={s.grid}>
                {characters.map(char => (
                  <PartyCard
                    key={char.id}
                    char={char}
                    onClick={() => navigate(`/personaje/${char.id}`)}
                    onToggleInspiration={() => toggleInspiration(char.id, char.inspiration)}
                  />
                ))}
              </div>
        }
      </Section>

      {/* ── XP TOOL ── */}
      <Section title="Aplicar XP a toda la party">
        <div style={s.box}>
          <div style={s.row}>
            <input
              type="number" min="0"
              value={xpAmount}
              onChange={e => setXpAmount(e.target.value)}
              style={s.xpInput}
              placeholder="Cantidad de XP"
            />
            <button style={s.btnGreen} onClick={() => applyXpToAll(1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '+ Otorgar a todos'}
            </button>
            <button style={s.btnRed} onClick={() => applyXpToAll(-1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '− Quitar a todos'}
            </button>
            {applied && <span style={s.appliedLabel}>✓ Aplicado</span>}
          </div>
          <div style={s.hint}>Se suma o resta a la XP actual de cada personaje (mínimo 0).</div>
        </div>
      </Section>

    </div>
  );
}

/* ── SUB-COMPONENTS ── */

function StatBig({ label, value, accent }) {
  return (
    <div style={s.statBig}>
      <div style={{ ...s.statBigVal, color: accent ? '#65c260' : 'var(--gold-bright)' }}>{value}</div>
      <div style={s.statBigLabel}>{label}</div>
    </div>
  );
}

function PartyCard({ char, onClick, onToggleInspiration }) {
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  const hpColor = hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a';

  return (
    <div style={{ ...s.card, borderTopColor: char.accentColor || char.color || '#c9a84c' }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }} onClick={onClick}>
        <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)' }}>{char.name}</div>
          <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)', marginTop: '2px' }}>
            {char.race} {char.class} · Lv{char.level}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <MiniStat label="PG"  value={`${char.hp ?? '—'}/${char.hpMax ?? '—'}`} />
        <MiniStat label="XP"  value={(char.xp || 0).toLocaleString()} />
        <MiniStat label="CA"  value={char.ac ?? '—'} />
      </div>

      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '2px', width: `${hpPct}%`, background: hpColor, transition: 'width 0.3s' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
        <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)' }}>
          {char.conditions || 'Sin condiciones'}
        </span>
        <button
          onClick={onToggleInspiration}
          style={{
            background: char.inspiration ? 'rgba(201,168,76,0.15)' : 'transparent',
            border: `1px solid ${char.inspiration ? 'var(--gold-dim)' : 'var(--line)'}`,
            color: char.inspiration ? 'var(--gold)' : 'var(--gold-dim)',
            fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px',
            padding: '4px 8px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}
        >
          {char.inspiration ? '✦ Inspirado' : '✧ Inspirar'}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--gold-bright)' }}>{value}</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line), transparent)' }} />
      </div>
      {children}
    </div>
  );
}

/* ── STYLES ── */
const s = {
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '1px',
    background: 'var(--line)',
    border: '1px solid var(--line)',
    marginBottom: '32px',
    overflow: 'hidden',
  },
  statBig: {
    background: 'var(--panel)',
    padding: '16px 12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  statBigVal: {
    fontFamily: 'Cinzel,serif', fontSize: '28px', fontWeight: '900', lineHeight: 1,
  },
  statBigLabel: {
    fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px',
    color: 'var(--gold-dim)', textTransform: 'uppercase', textAlign: 'center',
  },
  lastSess: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderLeft: '3px solid var(--gold)', padding: '16px 20px',
  },
  partyMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  partyMetaChip: {
    fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px',
    color: 'var(--gold-dim)', textTransform: 'uppercase',
    background: 'var(--panel)', border: '1px solid var(--line)',
    padding: '5px 10px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderTop: '3px solid var(--gold)', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  box: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderTop: '2px solid var(--gold)', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  xpInput: {
    background: 'var(--panel-raised)', border: '1px solid var(--line)',
    color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif',
    fontSize: '15px', padding: '10px 14px', outline: 'none', width: '160px',
  },
  btnGreen: {
    background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)',
    color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px',
    letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase',
  },
  btnRed: {
    background: 'rgba(184,100,63,0.12)', border: '1px solid rgba(184,100,63,0.4)',
    color: 'var(--ember)', fontFamily: 'Cinzel,serif', fontSize: '10px',
    letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase',
  },
  appliedLabel: {
    fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px',
    color: '#7aaa7a', textTransform: 'uppercase',
  },
  hint: {
    fontFamily: 'Crimson Pro,serif', fontStyle: 'italic',
    fontSize: '12px', color: 'var(--gold-dim)',
  },
  muted: {
    fontFamily: 'Crimson Pro,serif', fontStyle: 'italic',
    fontSize: '13px', color: 'var(--gold-dim)', padding: '10px 0',
  },
};
