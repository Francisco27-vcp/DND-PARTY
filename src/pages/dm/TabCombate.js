// src/pages/dm/TabCombate.js
import React, { useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const PARTICIPANT_TYPES = [
  { id: 'pj', label: 'PJ', color: '#c9a84c' },
  { id: 'enemigo', label: 'Enemigo', color: '#8b1a1a' },
];

const DEFAULT_COMBAT = { active: false, round: 1, currentIndex: 0, participants: [] };
const combatRef = () => doc(db, 'combat', 'current');

function sortParticipants(p) {
  return [...(p || [])].sort((a, b) => (b.initiative - a.initiative) || (a.addedAt - b.addedAt));
}

export default function TabCombate() {
  const [combat, setCombat] = useState(DEFAULT_COMBAT);
  const [partName, setPartName] = useState('');
  const [partInitiative, setPartInitiative] = useState('');
  const [partType, setPartType] = useState('pj');

  useEffect(() => {
    const unsub = onSnapshot(combatRef(), snap => {
      setCombat(snap.exists() ? { ...DEFAULT_COMBAT, ...snap.data() } : DEFAULT_COMBAT);
    }, err => console.error(err));
    return unsub;
  }, []);

  const sorted = sortParticipants(combat.participants);

  const addParticipant = async (e) => {
    e.preventDefault();
    const name = partName.trim();
    const initiative = parseInt(partInitiative, 10);
    if (!name || isNaN(initiative)) return;
    const p = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, initiative, type: partType, addedAt: Date.now() };
    await setDoc(combatRef(), { participants: [...(combat.participants || []), p] }, { merge: true });
    setPartName(''); setPartInitiative('');
  };

  const removeParticipant = async (id) => {
    const participants = (combat.participants || []).filter(p => p.id !== id);
    const currentIndex = Math.min(combat.currentIndex || 0, Math.max(0, participants.length - 1));
    await setDoc(combatRef(), { participants, currentIndex }, { merge: true });
  };

  const startCombat = () => sorted.length && setDoc(combatRef(), { active: true, round: 1, currentIndex: 0 }, { merge: true });
  const endCombat = () => setDoc(combatRef(), { active: false, round: 1, currentIndex: 0 }, { merge: true });
  const clearAll = () => setDoc(combatRef(), { participants: [], active: false, round: 1, currentIndex: 0 }, { merge: true });

  const nextTurn = async () => {
    const total = sorted.length;
    if (!total) return;
    let idx = (combat.currentIndex || 0) + 1;
    let round = combat.round || 1;
    if (idx >= total) { idx = 0; round += 1; }
    await setDoc(combatRef(), { currentIndex: idx, round }, { merge: true });
  };

  return (
    <div style={s.box}>
      <div style={s.statusRow}>
        <span style={{ ...s.status, ...(combat.active ? s.statusActive : {}) }}>
          {combat.active ? '⚔ Combate en curso' : '○ Sin combate activo'}
        </span>
        <span style={s.roundBadge}>Ronda {combat.round || 1}</span>
      </div>

      <form onSubmit={addParticipant} style={s.form}>
        <input value={partName} onChange={e => setPartName(e.target.value)} style={s.inputName} placeholder="Nombre del participante" />
        <input type="number" value={partInitiative} onChange={e => setPartInitiative(e.target.value)} style={s.inputNum} placeholder="Iniciativa" />
        <div style={{ display: 'flex', gap: '4px' }}>
          {PARTICIPANT_TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => setPartType(t.id)}
              style={{ ...s.typeBtn, ...(partType === t.id ? { borderColor: t.color, color: t.color, background: `${t.color}1a` } : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="submit" style={s.addBtn}>+ Agregar</button>
      </form>

      {sorted.length === 0
        ? <div style={s.empty}>Sin participantes. Agregá PJs y enemigos para empezar el combate.</div>
        : <div style={s.list}>
            {sorted.map((p, i) => {
              const t = PARTICIPANT_TYPES.find(t => t.id === p.type) || PARTICIPANT_TYPES[0];
              const isCurrent = combat.active && i === (combat.currentIndex || 0);
              return (
                <div key={p.id} className={isCurrent ? 'combat-active' : ''} style={{ ...s.row, ...(isCurrent ? s.rowActive : {}) }}>
                  <span style={s.turnIcon}>{isCurrent ? '▶' : ''}</span>
                  <span style={{ ...s.typeBadge, borderColor: `${t.color}50`, color: t.color }}>{t.label}</span>
                  <span style={s.pName}>{p.name}</span>
                  <span style={s.pInit}>{p.initiative}</span>
                  <button style={s.removeBtn} onClick={() => removeParticipant(p.id)}>✕</button>
                </div>
              );
            })}
          </div>
      }

      <div style={s.controls}>
        {!combat.active
          ? <button style={s.startBtn} onClick={startCombat} disabled={!sorted.length}>▶ Iniciar combate</button>
          : <>
              <button style={s.nextBtn} onClick={nextTurn}>⏭ Siguiente turno</button>
              <button style={s.endBtn} onClick={endCombat}>■ Finalizar combate</button>
            </>
        }
        <button style={s.clearBtn} onClick={clearAll} disabled={combat.active}>🗑 Vaciar lista</button>
      </div>
    </div>
  );
}

const s = {
  box: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' },
  statusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  status: { fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  statusActive: { color: 'var(--ember)' },
  roundBadge: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--gold)', border: '1px solid var(--gold-dim)', padding: '4px 12px', textTransform: 'uppercase' },
  form: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  inputName: { flex: '2 1 160px', background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none' },
  inputNum: { flex: '0 1 100px', background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', width: '100px' },
  typeBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '9px 12px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  addBtn: { background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)', padding: '8px 12px', transition: 'all 0.2s' },
  rowActive: { background: 'rgba(201,164,73,0.1)', borderColor: 'var(--gold-dim)', boxShadow: '0 0 16px rgba(201,164,73,0.25)' },
  turnIcon: { width: '14px', color: 'var(--gold-bright)', fontSize: '11px', flexShrink: 0 },
  typeBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', textTransform: 'uppercase', flexShrink: 0 },
  pName: { flex: 1, fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-bright)' },
  pInit: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--gold)', minWidth: '24px', textAlign: 'right' },
  removeBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontSize: '12px', cursor: 'pointer', padding: '2px 6px' },
  controls: { display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: '12px' },
  startBtn: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  nextBtn: { background: 'transparent', border: '1px solid var(--gold-dim)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  endBtn: { background: 'rgba(184,100,63,0.12)', border: '1px solid rgba(184,100,63,0.4)', color: 'var(--ember)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  clearBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase', marginLeft: 'auto' },
  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: 'var(--gold-dim)', padding: '10px 0' },
};
