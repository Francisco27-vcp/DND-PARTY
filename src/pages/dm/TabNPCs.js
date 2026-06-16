// src/pages/dm/TabNPCs.js
import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const EMPTY = {
  name: '', physicalDescription: '', race: '', role: '',
  faction: '', currentLocation: '', motivation: '', secret: '',
  partyRelation: '', visibleToPlayers: false,
};

export default function TabNPCs() {
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFaction, setFilterFaction] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [modal, setModal] = useState(null); // { type: 'detail'|'form', item }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'npcs'));
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew  = () => { setForm(EMPTY); setModal({ type: 'form', item: null }); };
  const openEdit = (n) => { setForm({ ...EMPTY, ...n }); setModal({ type: 'form', item: n }); };
  const openDetail = (n) => { setDelConfirm(false); setModal({ type: 'detail', item: n }); };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = modal.item?.id || `npc_${Date.now()}`;
      const extra = modal.item ? {} : { createdAt: serverTimestamp() };
      await setDoc(doc(db, 'npcs', id), { ...form, updatedAt: serverTimestamp(), ...extra }, { merge: true });
      await load();
      close();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async () => {
    try {
      await deleteDoc(doc(db, 'npcs', modal.item.id));
      await load();
      close();
    } catch (err) { console.error(err); }
  };

  const filtered = npcs.filter(n =>
    n.name?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterFaction  || n.faction?.toLowerCase().includes(filterFaction.toLowerCase())) &&
    (!filterLocation || n.currentLocation?.toLowerCase().includes(filterLocation.toLowerCase()))
  );

  const setF = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={s.topBar}>
        <input value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} placeholder="Buscar NPC..." />
        <input value={filterFaction} onChange={e => setFilterFaction(e.target.value)} style={{ ...s.searchInput, maxWidth: '150px' }} placeholder="Facción..." />
        <input value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ ...s.searchInput, maxWidth: '150px' }} placeholder="Ubicación..." />
        <button style={s.btnNew} onClick={openNew}>+ Nuevo NPC</button>
      </div>

      {loading
        ? <div style={s.muted}>Cargando NPCs...</div>
        : filtered.length === 0
          ? <div style={s.muted}>{npcs.length === 0 ? 'Sin NPCs todavía. Creá el primero.' : 'Sin resultados para ese filtro.'}</div>
          : <div style={s.grid}>
              {filtered.map(n => (
                <div key={n.id} style={s.card} onClick={() => openDetail(n)}>
                  <div style={s.cardTop}>
                    <span style={s.npcName}>{n.name}</span>
                    {n.visibleToPlayers && <span style={s.visiBadge}>Visible</span>}
                  </div>
                  {(n.race || n.role) && <div style={s.npcMeta}>{[n.race, n.role].filter(Boolean).join(' · ')}</div>}
                  {n.faction        && <div style={s.npcTag}>⚑ {n.faction}</div>}
                  {n.currentLocation && <div style={s.npcTag}>📍 {n.currentLocation}</div>}
                </div>
              ))}
            </div>
      }

      {/* DETAIL */}
      {modal?.type === 'detail' && (
        <Overlay onClose={close}>
          <div style={s.mHead}>
            <h2 style={s.mTitle}>{modal.item.name}</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Btn onClick={() => openEdit(modal.item)}>Editar</Btn>
              {delConfirm
                ? <><Btn red onClick={del}>¿Confirmar?</Btn><Btn onClick={() => setDelConfirm(false)}>✕</Btn></>
                : <Btn red onClick={() => setDelConfirm(true)}>Eliminar</Btn>
              }
            </div>
          </div>

          <div style={s.dGrid}>
            {modal.item.race            && <DField label="Raza"              value={modal.item.race} />}
            {modal.item.role            && <DField label="Rol"               value={modal.item.role} />}
            {modal.item.faction         && <DField label="Facción"           value={modal.item.faction} />}
            {modal.item.currentLocation && <DField label="Ubicación actual"  value={modal.item.currentLocation} />}
            <DField label="Visible para jugadores" value={modal.item.visibleToPlayers ? 'Sí' : 'No'} />
          </div>
          {modal.item.physicalDescription && <DBlock label="Descripción física"       value={modal.item.physicalDescription} />}
          {modal.item.partyRelation       && <DBlock label="Relación con la party"    value={modal.item.partyRelation} />}

          {(modal.item.motivation || modal.item.secret) && (
            <div style={s.dmBox}>
              <div style={s.dmLabel}>🔒 Solo DM</div>
              {modal.item.motivation && <DBlock label="Motivación" value={modal.item.motivation} dm />}
              {modal.item.secret     && <DBlock label="Secreto"    value={modal.item.secret}     dm />}
            </div>
          )}
        </Overlay>
      )}

      {/* FORM */}
      {modal?.type === 'form' && (
        <Overlay onClose={close}>
          <h2 style={s.mTitle}>{modal.item ? 'Editar NPC' : 'Nuevo NPC'}</h2>

          <div style={s.fGrid}>
            <FField label="Nombre *"        value={form.name}            onChange={setF('name')} />
            <FField label="Raza"            value={form.race}            onChange={setF('race')} />
            <FField label="Rol"             value={form.role}            onChange={setF('role')} />
            <FField label="Facción"         value={form.faction}         onChange={setF('faction')} />
            <FField label="Ubicación actual" value={form.currentLocation} onChange={setF('currentLocation')} />
          </div>
          <FField label="Descripción física"    value={form.physicalDescription} onChange={setF('physicalDescription')} multi />
          <FField label="Relación con la party" value={form.partyRelation}       onChange={setF('partyRelation')}       multi />

          <div style={s.dmSection}>
            <div style={s.dmSLabel}>🔒 Solo DM — nunca visible para jugadores</div>
            <FField label="Motivación" value={form.motivation} onChange={setF('motivation')} multi />
            <FField label="Secreto"    value={form.secret}     onChange={setF('secret')}     multi />
          </div>

          <label style={s.toggle}>
            <input type="checkbox" checked={form.visibleToPlayers} onChange={e => setF('visibleToPlayers')(e.target.checked)} style={{ marginRight: '8px' }} />
            Visible para jugadores
          </label>

          <div style={s.fActions}>
            <Btn gold onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
            <Btn onClick={close}>Cancelar</Btn>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* ─── Shared sub-components ─── */

function Overlay({ onClose, children }) {
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
        <div style={s.mBody}>{children}</div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, gold, red }) {
  const extra = gold ? s.btnGold : red ? s.btnRed : s.btnGhost;
  return <button style={{ ...s.btn, ...extra }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function DField({ label, value }) {
  return (
    <div>
      <div style={s.dLabel}>{label}</div>
      <div style={s.dVal}>{value}</div>
    </div>
  );
}
function DBlock({ label, value, dm }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ ...s.dLabel, ...(dm ? { color: '#8b4040' } : {}) }}>{label}</div>
      <div style={s.dText}>{value}</div>
    </div>
  );
}
function FField({ label, value, onChange, multi }) {
  const style = multi ? s.textarea : s.finput;
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={s.flabel}>{label}</label>
      {multi
        ? <textarea value={value} onChange={e => onChange(e.target.value)} style={style} rows={3} />
        : <input    value={value} onChange={e => onChange(e.target.value)} style={style} />
      }
    </div>
  );
}

const s = {
  topBar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' },
  searchInput: { flex: '1 1 120px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none' },
  btnNew: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  muted: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '2px solid #c9a84c', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' },
  npcName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a' },
  visiBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: '#7aaa7a', border: '1px solid rgba(74,138,74,0.4)', padding: '2px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  npcMeta: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#9a8070' },
  npcTag: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  modal: { background: 'rgba(10,8,18,0.99)', border: '1px solid rgba(201,168,76,0.3)', borderTop: '3px solid #c9a84c', width: '100%', maxWidth: '620px', position: 'relative', marginTop: '20px' },
  closeBtn: { position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: '#5a4820', fontSize: '16px', cursor: 'pointer' },
  mBody: { padding: '28px' },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  mTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#e8c96a', letterSpacing: '1px', margin: '0 0 20px 0' },
  dGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 20px', marginBottom: '16px' },
  dLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '3px' },
  dVal: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#e8c96a' },
  dText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#f5f0e8', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  dmBox: { background: 'rgba(80,20,20,0.2)', border: '1px solid rgba(139,26,26,0.3)', borderLeft: '3px solid rgba(139,26,26,0.7)', padding: '14px', marginTop: '16px' },
  dmLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#8b4040', textTransform: 'uppercase', marginBottom: '12px' },
  fGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' },
  flabel: { display: 'block', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#7a6030', textTransform: 'uppercase', marginBottom: '5px' },
  finput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  dmSection: { background: 'rgba(80,20,20,0.12)', border: '1px solid rgba(139,26,26,0.2)', borderLeft: '3px solid rgba(139,26,26,0.5)', padding: '14px', marginBottom: '14px' },
  dmSLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#8b4040', textTransform: 'uppercase', marginBottom: '12px' },
  toggle: { display: 'flex', alignItems: 'center', fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#9a9080', cursor: 'pointer', marginBottom: '16px' },
  fActions: { display: 'flex', gap: '10px', borderTop: '1px solid rgba(201,168,76,0.1)', paddingTop: '16px' },
  btn: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', border: '1px solid' },
  btnGold: { background: 'rgba(201,168,76,0.12)', borderColor: 'rgba(201,168,76,0.35)', color: '#e8c96a' },
  btnRed: { background: 'rgba(139,26,26,0.1)', borderColor: 'rgba(139,26,26,0.4)', color: '#e07070' },
  btnGhost: { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#5a4820' },
};
