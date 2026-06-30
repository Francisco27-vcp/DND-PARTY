// src/pages/dm/TabResumen.js
import React, { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const QUICK_LINKS = [
  { path: '/campana', label: 'Campaña', icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/notas', label: 'Notas', icon: '📝' },
  { path: '/manual', label: 'Manual', icon: '📖' },
];

export default function TabResumen({ navigate }) {
  const [characters, setCharacters] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [xpAmount, setXpAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Real-time subscription to all characters
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'characters'), snap => {
      setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingChars(false);
    }, err => { console.error(err); setLoadingChars(false); });
    return () => unsub();
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

  return (
    <div>
      <Section title="Navegación rápida">
        <div style={s.quickNav}>
          {QUICK_LINKS.map(link => (
            <button key={link.path} style={s.quickBtn} onClick={() => navigate(link.path)}>
              <span style={{ fontSize: '20px' }}>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="XP para toda la party">
        <div style={s.box}>
          <div style={s.row}>
            <input type="number" min="0" value={xpAmount} onChange={e => setXpAmount(e.target.value)} style={s.xpInput} placeholder="Cantidad de XP" />
            <button style={s.btnGreen} onClick={() => applyXpToAll(1)} disabled={applying || !xpAmount}>{applying ? '...' : '+ Otorgar a todos'}</button>
            <button style={s.btnRed} onClick={() => applyXpToAll(-1)} disabled={applying || !xpAmount}>{applying ? '...' : '− Quitar a todos'}</button>
            {applied && <span style={s.applied}>✓ Aplicado</span>}
          </div>
          <div style={s.hint}>Se suma o resta a la XP actual de cada personaje (mínimo 0).</div>
        </div>
      </Section>

      <Section title="Inspiración de la party">
        {loadingChars
          ? <div style={s.muted}>Cargando personajes...</div>
          : characters.length === 0
            ? <div style={s.muted}>No hay personajes registrados todavía.</div>
            : <div style={s.inspirationList}>
                {characters.map(char => (
                  <InspirationRow key={char.id} char={char} onToggle={() => toggleInspiration(char.id, char.inspiration)} />
                ))}
              </div>
        }
      </Section>

      <Section title="Resumen de la party">
        {loadingChars
          ? <div style={s.muted}>Cargando personajes...</div>
          : characters.length === 0
            ? <div style={s.muted}>No hay personajes registrados todavía.</div>
            : <div style={s.grid}>
                {characters.map(char => (
                  <PartyCard key={char.id} char={char} onClick={() => navigate(`/personaje/${char.id}`)} />
                ))}
              </div>
        }
      </Section>
    </div>
  );
}

function InspirationRow({ char, onToggle }) {
  return (
    <div style={s.inspRow}>
      <span style={{ fontSize: '20px', minWidth: '26px' }}>{char.icon || '⚔️'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)', fontWeight: '700' }}>{char.name}</div>
        {char.player && <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)', marginTop: '1px' }}>{char.player}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--gold-dim)', letterSpacing: '0.5px' }}>
            {char.hp ?? '—'}<span style={{ color: 'var(--line)' }}>/{char.hpMax ?? '—'}</span>
          </span>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>PG</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: char.inspiration ? 'var(--gold)' : 'var(--gold-dim)' }}>
            {char.inspiration ? '✦ Con inspiración' : '✧ Sin inspiración'}
          </span>
          <button
            onClick={onToggle}
            style={{ background: char.inspiration ? 'rgba(201,168,76,0.15)' : 'rgba(11,9,6,0.5)', border: `1px solid ${char.inspiration ? 'var(--gold-dim)' : 'var(--line)'}`, color: char.inspiration ? 'var(--gold)' : 'var(--parchment-dim)', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            {char.inspiration ? 'Quitar' : 'Dar Inspiración'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{title}</span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line), transparent)' }} />
      </div>
      {children}
    </div>
  );
}

function PartyCard({ char, onClick }) {
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  return (
    <div style={{ ...s.card, borderTopColor: char.accentColor || char.color || '#c9a84c' }} onClick={onClick} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)' }}>{char.name}</div>
          <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)', marginTop: '2px' }}>{char.race} {char.class} · Lv{char.level}</div>
        </div>
        {char.inspiration && <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold)', title: 'Con inspiración' }}>✦</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <MiniStat label="PG" value={`${char.hp ?? '—'}/${char.hpMax ?? '—'}`} />
        <MiniStat label="XP" value={(char.xp || 0).toLocaleString()} />
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '2px', width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a', transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>Condiciones</span>
        <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)' }}>{char.conditions || 'Ninguna'}</span>
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

const s = {
  quickNav: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  box: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  xpInput: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none', width: '160px' },
  btnGreen: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  btnRed: { background: 'rgba(184,100,63,0.12)', border: '1px solid rgba(184,100,63,0.4)', color: 'var(--ember)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  applied: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#7aaa7a', textTransform: 'uppercase' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: 'var(--gold-dim)' },
  muted: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: 'var(--gold-dim)', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '3px solid var(--gold)', cursor: 'pointer', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.2s' },
  inspirationList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  inspRow: { display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--panel)', border: '1px solid var(--line)', padding: '10px 14px', flexWrap: 'wrap' },
};
