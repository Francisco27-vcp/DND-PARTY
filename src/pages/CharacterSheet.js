// src/pages/CharacterSheet.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function CharacterSheet({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [char, setChar] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});

  const isAdmin = user.email === 'sociosn5@gmail.com';
  const isOwner = char?.ownerEmail === user.email || isAdmin;

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'characters', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setChar(data);
        setDraft(data);
      }
    };
    load();
  }, [id]);

  const save = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'characters', id), { ...draft, updatedAt: serverTimestamp() });
    setChar(draft);
    setEditing(false);
    setSaving(false);
  };

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const updateStat = (stat, value) => setDraft(d => ({ ...d, stats: { ...d.stats, [stat]: parseInt(value) || 0 } }));

  const handlePortrait = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDraft(d => ({ ...d, portrait: ev.target.result }));
    reader.readAsDataURL(file);
  };

  if (!char) return <div style={s.loading}>Cargando personaje...</div>;

  const xpPct = Math.min(100, Math.round(((draft.xp || 0) / (draft.xpNext || 2700)) * 100));
  const hpPct = Math.min(100, Math.round(((draft.hp || 0) / (draft.hpMax || 1)) * 100));
  const statMod = (val) => { const m = Math.floor((val - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  return (
    <div style={s.page} className="fade-in">

      {/* PORTRAIT COVER */}
      {draft.portrait && (
        <div style={s.coverWrap}>
          <img src={draft.portrait} alt={draft.name} style={s.coverImg} />
          <div style={s.coverOverlay} />
          <div style={s.coverText}>
            <div style={s.coverName}>{draft.name}</div>
            <div style={s.coverSub}>{draft.race} {draft.class} · Lv{draft.level}</div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate('/')}>← Volver</button>
        {isOwner && !editing && <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Editar</button>}
        {editing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={s.cancelBtn} onClick={() => { setEditing(false); setDraft(char); }}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div style={{ ...s.header, borderColor: draft.color || '#c9a84c' }}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: '36px' }}>{draft.icon || '⚔️'}</span>
          <div style={{ flex: 1 }}>
            {editing
              ? <input value={draft.name} onChange={e => update('name', e.target.value)} style={s.inputLarge} />
              : <h1 style={s.charName}>{draft.name}</h1>}
            <div style={s.charSub}>{draft.race} {draft.class} · Lv{draft.level} · {draft.alignment}</div>
            <div style={s.charSubclass}>{draft.subclass}</div>
          </div>
        </div>
        <div style={s.levelCircle}>
          {editing
            ? <input type="number" value={draft.level} onChange={e => update('level', parseInt(e.target.value))} style={{ ...s.inputNum, fontSize: '28px', width: '60px' }} />
            : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '32px', fontWeight: '900', color: draft.color || '#c9a84c' }}>{draft.level}</span>}
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase' }}>Nivel</span>
        </div>
      </div>

      {/* Portrait upload in edit mode */}
      {editing && (
        <div style={s.portraitEditBox}>
          <div style={s.formLabel}>Cambiar ilustración / foto del personaje</div>
          <input type="file" accept="image/*" onChange={handlePortrait} style={s.fileInput} />
        </div>
      )}

      {/* XP BAR */}
      <div style={s.xpSection}>
        <div style={s.xpRow}>
          <span style={s.xpLabel}>Experiencia</span>
          {editing
            ? <input type="number" value={draft.xp} onChange={e => update('xp', parseInt(e.target.value) || 0)} style={s.inputNum} />
            : <span style={s.xpVal}>{(draft.xp || 0).toLocaleString()} XP</span>}
        </div>
        <div style={s.barTrack}><div style={{ ...s.barFill, width: `${xpPct}%`, background: 'linear-gradient(to right, #7a6030, #c9a84c)' }} /></div>
        <div style={{ ...s.xpRow, marginTop: '3px' }}>
          <span style={s.dimLabel}>Lv{(draft.level || 3) + 1} →</span>
          <span style={s.dimLabel}>{(draft.xpNext || 2700).toLocaleString()} XP</span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={s.mainGrid}>

        {/* LEFT */}
        <div style={s.leftCol}>
          <Section title="Características">
            <div style={s.statsGrid}>
              {['fue','des','con','int','sab','car'].map(stat => (
                <div key={stat} style={s.statBlock}>
                  <span style={s.statName}>{stat.toUpperCase()}</span>
                  {editing
                    ? <input type="number" value={draft.stats?.[stat] || 10} onChange={e => updateStat(stat, e.target.value)} style={{ ...s.inputNum, fontSize: '18px', width: '48px', textAlign: 'center' }} />
                    : <span style={s.statScore}>{draft.stats?.[stat] || 10}</span>}
                  <span style={s.statMod}>{statMod(draft.stats?.[stat] || 10)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Combate">
            <div style={s.combatRow}>
              <CombatStat label="CA" value={draft.ac} field="ac" editing={editing} update={update} />
              <CombatStat label="Iniciativa" value={statMod(draft.stats?.des || 10)} />
              <CombatStat label="Velocidad" value="9m" />
              <CombatStat label="Prof." value="+2" />
            </div>
            <div style={s.hpBox}>
              <div style={s.xpRow}>
                <span style={s.xpLabel}>Puntos de Golpe</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editing
                    ? <><input type="number" value={draft.hp} onChange={e => update('hp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '48px' }} />
                       <span style={{ color: '#5a4820' }}>/</span>
                       <input type="number" value={draft.hpMax} onChange={e => update('hpMax', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '48px' }} />
                      </>
                    : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', color: '#c0392b', fontWeight: '700' }}>{draft.hp} <span style={{ color: '#5a4820', fontSize: '13px' }}>/ {draft.hpMax}</span></span>}
                </div>
              </div>
              <div style={s.barTrack}><div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} /></div>
            </div>
          </Section>

          <Section title="Jugador">
            {editing
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={draft.player || ''} onChange={e => update('player', e.target.value)} style={s.inputFull} placeholder="Nombre del jugador" />
                  <input value={draft.ownerEmail || ''} onChange={e => update('ownerEmail', e.target.value)} style={s.inputFull} placeholder="Email del jugador (para permisos de edición)" />
                </div>
              : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '15px', color: '#e8c96a' }}>{draft.player || '—'}</span>}
          </Section>
        </div>

        {/* RIGHT */}
        <div style={s.rightCol}>
          <Section title="Notas del personaje">
            {editing
              ? <textarea value={draft.notes || ''} onChange={e => update('notes', e.target.value)} style={s.textarea} placeholder="Motivaciones, lore personal, backstory..." rows={5} />
              : <p style={s.notesText}>{draft.notes || <span style={{ color: '#3a2e18', fontStyle: 'italic' }}>Sin notas. Editá para agregar.</span>}</p>}
          </Section>

          <Section title="Estado actual">
            <StatusRow label="Condiciones" value={draft.conditions || 'Ninguna'} field="conditions" editing={editing} update={update} />
            <StatusRow label="Concentración" value={draft.concentration || '—'} field="concentration" editing={editing} update={update} />
            <StatusRow label="Inspiración" value={draft.inspiration ? '✦ Activa' : 'No tiene'} field="inspiration" editing={editing} update={update} isToggle />
          </Section>

          <Section title="Equipo e Inventario">
            {editing
              ? <textarea value={draft.inventory || ''} onChange={e => update('inventory', e.target.value)} style={s.textarea} placeholder="Espada larga, armadura de placas..." rows={4} />
              : <p style={s.notesText}>{draft.inventory || <span style={{ color: '#3a2e18', fontStyle: 'italic' }}>Sin inventario registrado.</span>}</p>}
          </Section>
        </div>
      </div>

      {!isOwner && <div style={s.readOnlyBadge}>👁️ Vista de solo lectura — este no es tu personaje</div>}
      <div style={{ height: '80px' }} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={ss.section}>
      <div style={ss.sectionHeader}>
        <span style={ss.sectionTitle}>{title}</span>
        <div style={ss.sectionLine} />
      </div>
      {children}
    </div>
  );
}

function CombatStat({ label, value, field, editing, update }) {
  return (
    <div style={ss.combatStat}>
      <span style={ss.combatLabel}>{label}</span>
      {editing && field
        ? <input type="number" value={value} onChange={e => update(field, parseInt(e.target.value))} style={{ ...ss.inputNum, fontSize: '18px', width: '50px' }} />
        : <span style={ss.combatVal}>{value}</span>}
    </div>
  );
}

function StatusRow({ label, value, field, editing, update, isToggle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: '#7a6030', textTransform: 'uppercase' }}>{label}</span>
      {editing
        ? isToggle
          ? <button onClick={() => update(field, !value)} style={{ background: value ? 'rgba(201,168,76,0.2)' : 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#e8c96a', padding: '3px 10px', fontFamily: 'Cinzel,serif', fontSize: '9px', cursor: 'pointer' }}>{value ? 'Quitar' : 'Dar'}</button>
          : <input value={value} onChange={e => update(field, e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '3px 8px', maxWidth: '160px' }} />
        : <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#c8c4bc' }}>{value}</span>}
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px 20px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  coverWrap: { position: 'relative', height: '280px', overflow: 'hidden', margin: '0 -16px' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' },
  coverOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,6,12,1) 0%, rgba(8,6,12,0.5) 50%, transparent 100%)' },
  coverText: { position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 2 },
  coverName: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(20px,5vw,34px)', fontWeight: '900', color: '#e8c96a', letterSpacing: '2px', textShadow: '0 0 20px rgba(201,168,76,0.5)' },
  coverSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(201,168,76,0.6)', marginTop: '4px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  backBtn: { background: 'transparent', border: 'none', color: '#7a6030', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer', padding: '6px 0' },
  editBtn: { background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  saveBtn: { background: 'rgba(74,138,74,0.15)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', background: 'rgba(15,12,24,0.9)', borderTop: '3px solid', borderLeft: '1px solid rgba(201,168,76,0.15)', borderRight: '1px solid rgba(201,168,76,0.15)', borderBottom: '1px solid rgba(201,168,76,0.15)', marginBottom: '12px' },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 },
  charName: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(18px,4vw,26px)', fontWeight: '900', color: '#e8c96a', letterSpacing: '2px' },
  charSub: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#7a6030', marginTop: '4px' },
  charSubclass: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: '#5a4820', marginTop: '4px', textTransform: 'uppercase' },
  levelCircle: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '8px 16px', border: '1px solid rgba(201,168,76,0.2)', minWidth: '70px' },
  portraitEditBox: { background: 'rgba(15,12,24,0.7)', border: '1px solid rgba(201,168,76,0.12)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  formLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  fileInput: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '6px', cursor: 'pointer' },
  inputLarge: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.3)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', padding: '4px 8px', width: '100%' },
  inputFull: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px', width: '100%' },
  inputNum: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
  textarea: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#c8c4bc', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.6' },
  xpSection: { background: 'rgba(15,12,24,0.7)', border: '1px solid rgba(201,168,76,0.12)', padding: '12px', marginBottom: '12px' },
  xpRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  xpLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  xpVal: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#c9a84c' },
  dimLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', color: '#3a2e18', letterSpacing: '1px' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.4s' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: '12px' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '12px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  statBlock: { background: 'rgba(8,6,12,0.6)', border: '1px solid rgba(201,168,76,0.1)', padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statName: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase' },
  statScore: { fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: '700', color: '#f5f0e8' },
  statMod: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '600', color: '#c9a84c' },
  combatRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '10px' },
  hpBox: { background: 'rgba(8,6,12,0.5)', border: '1px solid rgba(201,168,76,0.1)', padding: '10px' },
  notesText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#9a9080', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  readOnlyBadge: { textAlign: 'center', padding: '10px', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#5a4820', border: '1px solid rgba(201,168,76,0.1)', marginTop: '12px', textTransform: 'uppercase' },
};

const ss = {
  section: { background: 'rgba(15,12,24,0.7)', border: '1px solid rgba(201,168,76,0.12)', padding: '14px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },
  combatStat: { background: 'rgba(8,6,12,0.6)', border: '1px solid rgba(201,168,76,0.1)', padding: '8px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  combatLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' },
  combatVal: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#f5f0e8' },
  inputNum: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
};
