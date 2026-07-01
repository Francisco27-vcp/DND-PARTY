// src/pages/dm/TabCombate.js
import React, { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const DEFAULT_COMBAT = { active: false, round: 1, currentIndex: 0, participants: [] };
const combatRef = () => doc(db, 'combat', 'current');

function sortParticipants(p) {
  return [...(p || [])].sort((a, b) => (b.initiative - a.initiative) || (a.addedAt - b.addedAt));
}

// ── StatBlock expandable ───────────────────────────────────────────────────────
function StatBlock({ data }) {
  const fields = [
    data.race       && ['Raza',       data.race],
    data.role       && ['Rol',        data.role],
    data.ac         && ['CA',         data.ac],
    data.motivation && ['Motivacion', data.motivation],
    data.faction    && ['Faccion',    data.faction],
    data.secret     && ['Secreto',    data.secret],
  ].filter(Boolean);
  if (!fields.length) return null;
  return (
    <div style={sb.wrap}>
      {fields.map(([k, v]) => (
        <div key={k} style={sb.field}>
          <span style={sb.key}>{k}</span>
          <span style={sb.val}>{v}</span>
        </div>
      ))}
    </div>
  );
}
const sb = {
  wrap:  { display: 'flex', flexWrap: 'wrap', gap: '6px 20px', padding: '10px 14px 10px 38px', background: 'rgba(0,0,0,0.35)', borderTop: '1px solid var(--line)' },
  field: { display: 'flex', gap: '6px', alignItems: 'baseline' },
  key:   { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  val:   { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)' },
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function TabCombate() {
  const [combat, setCombat]         = useState(DEFAULT_COMBAT);
  const [npcs, setNpcs]             = useState([]);
  const [characters, setCharacters] = useState([]);

  // Add form
  const [addMode, setAddMode]           = useState('manual'); // 'manual' | 'db'
  const [partName, setPartName]         = useState('');
  const [partInitiative, setPartInitiative] = useState('');
  const [partHpMax, setPartHpMax]       = useState('');
  const [dbSearch, setDbSearch]         = useState('');
  const [selectedSource, setSelectedSource] = useState(null); // { type, data }

  // Inline HP input
  const [inlineInput, setInlineInput]   = useState(null); // { id, type:'damage'|'heal', value }

  // Expanded statblock row
  const [expandedId, setExpandedId]     = useState(null);

  // Local status edits (written on blur)
  const [statusEdits, setStatusEdits]   = useState({});

  // ── Firestore listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(combatRef(), snap => {
      setCombat(snap.exists() ? { ...DEFAULT_COMBAT, ...snap.data() } : DEFAULT_COMBAT);
    }, err => console.error(err));
    return unsub;
  }, []);

  const loadDB = useCallback(async () => {
    try {
      const [npcSnap, charSnap] = await Promise.all([
        getDocs(collection(db, 'npcs')),
        getDocs(collection(db, 'characters')),
      ]);
      setNpcs(npcSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCharacters(charSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadDB(); }, [loadDB]);

  const sorted    = sortParticipants(combat.participants);
  const total     = sorted.length;
  const curIdx    = combat.currentIndex || 0;
  const nextIdx   = total > 1 ? (curIdx + 1) % total : -1;

  // ── Add participant ────────────────────────────────────────────────────────
  const addParticipant = async (e) => {
    e.preventDefault();
    const initiative = parseInt(partInitiative, 10);
    if (isNaN(initiative)) return;

    let p;
    if (addMode === 'manual') {
      const name = partName.trim();
      if (!name) return;
      const hpMax = parseInt(partHpMax, 10) || 0;
      p = { name, hpMax, hpCurrent: hpMax, sourceType: 'manual' };
    } else {
      if (!selectedSource) return;
      const src = selectedSource.data;
      const hpMax = selectedSource.type === 'character'
        ? (parseInt(src.hpMax, 10) || parseInt(src.hp, 10) || 0)
        : 0;
      const statblock = selectedSource.type === 'npc'
        ? { race: src.race, role: src.role, motivation: src.motivation, faction: src.faction, secret: src.secret }
        : { race: src.race, role: `${src.class || ''}${src.subclass ? '/' + src.subclass : ''} Lv${src.level || 1}`, ac: src.ac };
      p = { name: src.name, hpMax, hpCurrent: hpMax, sourceType: selectedSource.type, sourceId: src.id, statblock };
    }

    const full = {
      ...p,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      initiative,
      addedAt: Date.now(),
      status: '',
    };
    await setDoc(combatRef(), { participants: [...(combat.participants || []), full] }, { merge: true });
    setPartName(''); setPartInitiative(''); setPartHpMax('');
    setSelectedSource(null); setDbSearch('');
  };

  // ── Remove ─────────────────────────────────────────────────────────────────
  const removeParticipant = async (id) => {
    const participants = (combat.participants || []).filter(p => p.id !== id);
    const ci = Math.min(curIdx, Math.max(0, participants.length - 1));
    await setDoc(combatRef(), { participants, currentIndex: ci }, { merge: true });
  };

  // ── HP change ─────────────────────────────────────────────────────────────
  const applyHP = async (id, type, amount) => {
    const n = parseInt(amount, 10);
    if (isNaN(n) || n <= 0) { setInlineInput(null); return; }
    const participants = (combat.participants || []).map(p => {
      if (p.id !== id) return p;
      const delta     = type === 'damage' ? -n : n;
      const hpCurrent = Math.min(p.hpMax || 0, Math.max(0, (p.hpCurrent ?? p.hpMax ?? 0) + delta));
      return { ...p, hpCurrent };
    });
    await setDoc(combatRef(), { participants }, { merge: true });
    setInlineInput(null);
  };

  // ── Status ────────────────────────────────────────────────────────────────
  const commitStatus = async (id) => {
    if (statusEdits[id] === undefined) return;
    const participants = (combat.participants || []).map(p => p.id === id ? { ...p, status: statusEdits[id] } : p);
    await setDoc(combatRef(), { participants }, { merge: true });
    setStatusEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ── Combat controls ────────────────────────────────────────────────────────
  const startCombat = () => sorted.length && setDoc(combatRef(), { active: true, round: 1, currentIndex: 0 }, { merge: true });
  const endCombat   = () => setDoc(combatRef(), { active: false, round: 1, currentIndex: 0 }, { merge: true });
  const clearAll    = () => setDoc(combatRef(), { ...DEFAULT_COMBAT, participants: [] });

  const nextTurn = async () => {
    if (!total) return;
    let idx   = curIdx + 1;
    let round = combat.round || 1;
    if (idx >= total) { idx = 0; round += 1; }
    await setDoc(combatRef(), { currentIndex: idx, round }, { merge: true });
  };

  // ── DB search ─────────────────────────────────────────────────────────────
  const q = dbSearch.trim().toLowerCase();
  const dbResults = q.length > 0 && !selectedSource
    ? [
        ...characters.filter(c => c.name?.toLowerCase().includes(q)).map(c => ({ type: 'character', data: c })),
        ...npcs.filter(n => n.name?.toLowerCase().includes(q)).map(n => ({ type: 'npc', data: n })),
      ].slice(0, 8)
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.box}>

      {/* ── Header ── */}
      <div style={s.headerRow}>
        <span style={{ ...s.statusLabel, ...(combat.active ? s.statusActive : {}) }}>
          {combat.active ? '⚔ Combate en curso' : '○ Sin combate activo'}
        </span>
        <span style={s.roundBadge}>Ronda {combat.round || 1}</span>
      </div>

      {/* ── Add form ── */}
      <div style={s.addPanel}>
        <div style={s.modeRow}>
          {[['manual', 'Manual'], ['db', 'Desde base de datos']].map(([m, l]) => (
            <button key={m} type="button"
              style={{ ...s.modeBtn, ...(addMode === m ? s.modeBtnActive : {}) }}
              onClick={() => { setAddMode(m); setSelectedSource(null); setDbSearch(''); }}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={addParticipant} style={s.form}>
          {addMode === 'manual' ? (
            <>
              <input value={partName} onChange={e => setPartName(e.target.value)}
                style={{ ...s.inp, flex: '2 1 140px' }} placeholder="Nombre" />
              <input type="number" value={partHpMax} onChange={e => setPartHpMax(e.target.value)}
                style={{ ...s.inp, flex: '0 1 80px' }} placeholder="PG max" />
            </>
          ) : (
            <div style={{ flex: '2 1 220px', position: 'relative' }}>
              <input
                value={selectedSource ? selectedSource.data.name : dbSearch}
                onChange={e => { setDbSearch(e.target.value); setSelectedSource(null); }}
                style={{ ...s.inp, width: '100%', boxSizing: 'border-box' }}
                placeholder="Buscar PJ o NPC..."
              />
              {dbResults.length > 0 && (
                <div style={s.dropdown}>
                  {dbResults.map(r => (
                    <div key={r.data.id} style={s.dropItem}
                      onClick={() => { setSelectedSource(r); setDbSearch(''); }}>
                      <span style={{ ...s.dropBadge, color: r.type === 'character' ? '#c9a84c' : '#86d4ff' }}>
                        {r.type === 'character' ? 'PJ' : 'NPC'}
                      </span>
                      <span style={s.dropName}>{r.data.name}</span>
                      <span style={s.dropMeta}>
                        {r.type === 'character'
                          ? `${r.data.class || ''} Lv${r.data.level || 1}`
                          : [r.data.race, r.data.role].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <input type="number" value={partInitiative} onChange={e => setPartInitiative(e.target.value)}
            style={{ ...s.inp, flex: '0 1 90px' }} placeholder="Iniciativa" />
          <button type="submit" style={s.addBtn}>+ Agregar</button>
        </form>
      </div>

      {/* ── Participant list ── */}
      {sorted.length === 0
        ? <div style={s.empty}>Sin participantes. Agregá PJs y enemigos para empezar.</div>
        : (
          <div style={s.list}>
            {/* Column headers */}
            <div style={s.colHeader}>
              <span style={{ width: '18px' }} />
              <span style={{ flex: 1 }}>Nombre</span>
              <span style={{ width: '28px', textAlign: 'center' }}>Info</span>
              <span style={{ width: '48px', textAlign: 'center' }}>Init</span>
              <span style={{ width: '90px', textAlign: 'center' }}>PG</span>
              <span style={{ width: '130px', textAlign: 'center' }}>Daño / Cur</span>
              <span style={{ flex: '0 1 120px' }}>Estado</span>
              <span style={{ width: '24px' }} />
            </div>

            {sorted.map((p, i) => {
              const isCurrent  = combat.active && i === curIdx;
              const isNext     = combat.active && i === nextIdx;
              const hpPct      = p.hpMax > 0 ? Math.max(0, (p.hpCurrent ?? p.hpMax) / p.hpMax) : null;
              const hpColor    = hpPct === null ? 'var(--gold-dim)'
                               : hpPct > 0.5   ? '#65c260'
                               : hpPct > 0.25  ? '#f7dd78'
                               :                  '#ef7368';
              const hasInfo    = !!p.statblock;
              const isExpanded = expandedId === p.id;
              const isDmgOpen  = inlineInput?.id === p.id && inlineInput.type === 'damage';
              const isHealOpen = inlineInput?.id === p.id && inlineInput.type === 'heal';
              const statusVal  = statusEdits[p.id] !== undefined ? statusEdits[p.id] : (p.status || '');

              return (
                <div key={p.id}>
                  <div style={{
                    ...s.row,
                    ...(isCurrent ? s.rowCurrent : isNext ? s.rowNext : {}),
                  }}>
                    {/* Turn icon */}
                    <span style={s.turnIcon}>
                      {isCurrent ? '▶' : isNext ? '◌' : ''}
                    </span>

                    {/* Name */}
                    <span style={s.pName}>{p.name}</span>

                    {/* Info button */}
                    <button
                      style={{ ...s.infoBtn, opacity: hasInfo ? 1 : 0.2, cursor: hasInfo ? 'pointer' : 'default' }}
                      onClick={() => hasInfo && setExpandedId(isExpanded ? null : p.id)}
                    >?</button>

                    {/* Initiative */}
                    <span style={s.pInit}>{p.initiative}</span>

                    {/* HP */}
                    <div style={s.hpCell}>
                      {p.hpMax > 0 ? (
                        <>
                          <span style={{ ...s.hpText, color: hpColor }}>
                            {p.hpCurrent ?? p.hpMax}/{p.hpMax}
                          </span>
                          <div style={s.hpBarBg}>
                            <div style={{ ...s.hpBar, width: `${(hpPct || 0) * 100}%`, background: hpColor }} />
                          </div>
                        </>
                      ) : <span style={s.hpNone}>—</span>}
                    </div>

                    {/* Damage / Heal */}
                    <div style={s.actionCell}>
                      {isDmgOpen ? (
                        <form onSubmit={e => { e.preventDefault(); applyHP(p.id, 'damage', inlineInput.value); }}
                          style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <input autoFocus type="number" min="1"
                            value={inlineInput.value}
                            onChange={e => setInlineInput(v => ({ ...v, value: e.target.value }))}
                            style={s.hpInput} placeholder="dmg" />
                          <button type="submit" style={{ ...s.hpApply, color: '#ef7368' }}>✓</button>
                          <button type="button" style={s.hpCancel} onClick={() => setInlineInput(null)}>✕</button>
                        </form>
                      ) : isHealOpen ? (
                        <form onSubmit={e => { e.preventDefault(); applyHP(p.id, 'heal', inlineInput.value); }}
                          style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <input autoFocus type="number" min="1"
                            value={inlineInput.value}
                            onChange={e => setInlineInput(v => ({ ...v, value: e.target.value }))}
                            style={s.hpInput} placeholder="cur" />
                          <button type="submit" style={{ ...s.hpApply, color: '#65c260' }}>✓</button>
                          <button type="button" style={s.hpCancel} onClick={() => setInlineInput(null)}>✕</button>
                        </form>
                      ) : (
                        <>
                          <button style={s.dmgBtn}
                            onClick={() => setInlineInput({ id: p.id, type: 'damage', value: '' })}>
                            Daño
                          </button>
                          <button style={s.healBtn}
                            onClick={() => setInlineInput({ id: p.id, type: 'heal', value: '' })}>
                            Cur
                          </button>
                        </>
                      )}
                    </div>

                    {/* Status */}
                    <input
                      value={statusVal}
                      onChange={e => setStatusEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                      onBlur={() => commitStatus(p.id)}
                      onKeyDown={e => e.key === 'Enter' && commitStatus(p.id)}
                      style={s.statusInput}
                      placeholder="estado..."
                    />

                    {/* Remove */}
                    <button style={s.removeBtn} onClick={() => removeParticipant(p.id)}>✕</button>
                  </div>

                  {/* Statblock panel */}
                  {isExpanded && p.statblock && <StatBlock data={p.statblock} />}
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Controls ── */}
      <div style={s.controls}>
        {!combat.active
          ? <button style={s.startBtn} onClick={startCombat} disabled={!sorted.length}>
              ▶ Iniciar combate
            </button>
          : <>
              <button style={s.nextBtn} onClick={nextTurn}>⏭ Siguiente turno</button>
              <button style={s.endBtn}  onClick={endCombat}>■ Finalizar combate</button>
            </>
        }
        <button style={s.clearBtn} onClick={clearAll} disabled={combat.active}>🗑 Vaciar lista</button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  box: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)',
    padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px',
  },

  // Header
  headerRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  statusLabel: { fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  statusActive:{ color: 'var(--ember)' },
  roundBadge:  { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--gold)', border: '1px solid var(--gold-dim)', padding: '4px 12px', textTransform: 'uppercase' },

  // Add panel
  addPanel:    { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  modeRow:     { display: 'flex', gap: '6px' },
  modeBtn:     { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  modeBtnActive:{ background: 'rgba(201,168,76,0.1)', borderColor: 'var(--gold-dim)', color: 'var(--gold)' },
  form:        { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' },
  inp:         { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none' },
  addBtn:      { background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },

  // Dropdown
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1510', border: '1px solid var(--gold-dim)', maxHeight: '220px', overflowY: 'auto' },
  dropItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)', transition: 'background 0.15s' },
  dropBadge:{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', border: '1px solid currentColor', padding: '2px 6px', flexShrink: 0 },
  dropName: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment)', flex: 1 },
  dropMeta: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: 'var(--gold-dim)' },

  // Column headers
  colHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px 6px', borderBottom: '1px solid var(--line)', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },

  // Rows
  list:       { display: 'flex', flexDirection: 'column', gap: '2px' },
  row:        { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid var(--line)', background: 'rgba(11,9,6,0.5)', transition: 'all 0.2s' },
  rowCurrent: { background: 'rgba(74,138,74,0.13)', borderColor: '#4a8a4a80', boxShadow: '0 0 12px rgba(74,138,74,0.2)' },
  rowNext:    { background: 'rgba(247,221,120,0.07)', borderColor: 'rgba(247,221,120,0.3)' },
  turnIcon:   { width: '18px', fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold-bright)', flexShrink: 0, textAlign: 'center' },
  pName:      { flex: 1, fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // Info button
  infoBtn: { width: '22px', height: '22px', background: 'rgba(201,168,76,0.1)', border: '1px solid var(--gold-dim)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', fontWeight: '700', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },

  // Initiative
  pInit: { width: '48px', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--gold)', textAlign: 'center', flexShrink: 0 },

  // HP
  hpCell:  { width: '90px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' },
  hpText:  { fontFamily: 'Cinzel,serif', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' },
  hpBarBg: { width: '80px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' },
  hpBar:   { height: '100%', borderRadius: '2px', transition: 'width 0.3s, background 0.3s' },
  hpNone:  { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--gold-dim)' },

  // Damage / Heal
  actionCell: { width: '130px', flexShrink: 0, display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' },
  dmgBtn:     { background: 'rgba(239,115,104,0.12)', border: '1px solid rgba(239,115,104,0.35)', color: '#ef7368', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase' },
  healBtn:    { background: 'rgba(101,194,96,0.12)',  border: '1px solid rgba(101,194,96,0.35)',  color: '#65c260', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase' },
  hpInput:    { width: '52px', background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '4px 6px', outline: 'none' },
  hpApply:    { background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '2px 4px' },
  hpCancel:   { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontSize: '11px', cursor: 'pointer', padding: '2px 4px' },

  // Status
  statusInput: { flex: '0 1 120px', background: 'transparent', border: '1px solid transparent', borderBottom: '1px solid var(--line)', color: 'var(--parchment-dim)', fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', padding: '3px 6px', outline: 'none', minWidth: 0 },

  // Remove
  removeBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontSize: '11px', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 },

  // Controls
  controls: { display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: '12px' },
  startBtn: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  nextBtn:  { background: 'transparent', border: '1px solid var(--gold-dim)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  endBtn:   { background: 'rgba(184,100,63,0.12)', border: '1px solid rgba(184,100,63,0.4)', color: 'var(--ember)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  clearBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase', marginLeft: 'auto' },
  empty:    { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: 'var(--gold-dim)', padding: '10px 0' },
};
