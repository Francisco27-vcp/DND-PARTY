// src/pages/dm/TabResumen.js
import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
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

  const loadCharacters = useCallback(async () => {
    setLoadingChars(true);
    try {
      const snap = await getDocs(collection(db, 'characters'));
      setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoadingChars(false);
  }, []);

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{title}</span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' }} />
      </div>
      {children}
    </div>
  );
}

function PartyCard({ char, onClick }) {
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  return (
    <div style={{ ...s.card, borderTopColor: char.color || '#c9a84c' }} onClick={onClick} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a' }}>{char.name}</div>
          <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' }}>{char.race} {char.class} · Lv{char.level}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <MiniStat label="PG" value={`${char.hp ?? '—'}/${char.hpMax ?? '—'}`} />
        <MiniStat label="XP" value={(char.xp || 0).toLocaleString()} />
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '2px', width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a', transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '8px' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase' }}>Condiciones</span>
        <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#9a9080' }}>{char.conditions || 'Ninguna'}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e8c96a' }}>{value}</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

const s = {
  quickNav: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  box: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  xpInput: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none', width: '160px' },
  btnGreen: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  btnRed: { background: 'rgba(139,26,26,0.12)', border: '1px solid rgba(139,26,26,0.4)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  applied: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#7aaa7a', textTransform: 'uppercase' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18' },
  muted: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #c9a84c', cursor: 'pointer', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.2s' },
};
