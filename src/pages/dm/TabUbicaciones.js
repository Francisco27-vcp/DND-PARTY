// src/pages/dm/TabUbicaciones.js
import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const TIPOS = ['Ciudad', 'Mazmorra', 'Camino', 'Bosque', 'Otro'];
const ESTADOS = [
  { id: 'sin explorar', label: 'Sin explorar', color: '#9a9080' },
  { id: 'explorado',    label: 'Explorado',    color: '#c9a84c' },
  { id: 'completado',   label: 'Completado',   color: '#7aaa7a' },
];

const EMPTY = {
  name: '', type: 'Ciudad', description: '', status: 'sin explorar',
  npcsPresent: '', visibleToPlayers: false,
};

export default function TabUbicaciones() {
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'locations'));
      setLocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew    = () => { setForm(EMPTY); setModal({ type: 'form', item: null }); };
  const openEdit   = (l) => { setForm({ ...EMPTY, ...l }); setModal({ type: 'form', item: l }); };
  const openDetail = (l) => { setDelConfirm(false); setModal({ type: 'detail', item: l }); };
  const close = () => setModal(null);
  const setF = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = modal.item?.id || `loc_${Date.now()}`;
      const extra = modal.item ? {} : { createdAt: serverTimestamp() };
      await setDoc(doc(db, 'locations', id), { ...form, updatedAt: serverTimestamp(), ...extra }, { merge: true });
      await load(); close();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async () => {
    try { await deleteDoc(doc(db, 'locations', modal.item.id)); await load(); close(); }
    catch (err) { console.error(err); }
  };

  const statusInfo = (id) => ESTADOS.find(e => e.id === id) || ESTADOS[0];

  const filtered = locs.filter(l =>
    l.name?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterType || l.type?.toLowerCase() === filterType.toLowerCase())
  );

  return (
    <div>
      <div style={s.topBar}>
        <input value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} placeholder="Buscar ubicación..." />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={s.select}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button style={s.btnNew} onClick={openNew}>+ Nueva Ubicación</button>
      </div>

      {loading
        ? <div style={s.muted}>Cargando ubicaciones...</div>
        : filtered.length === 0
          ? <div style={s.muted}>{locs.length === 0 ? 'Sin ubicaciones. Creá la primera.' : 'Sin resultados.'}</div>
          : <div style={s.grid}>
              {filtered.map(l => {
                const st = statusInfo(l.status);
                return (
                  <div key={l.id} style={{ ...s.card, borderTopColor: st.color }} onClick={() => openDetail(l)}>
                    <div style={s.cardTop}>
                      <span style={s.locName}>{l.name}</span>
                      {l.visibleToPlayers && <span style={s.visiBadge}>Visible</span>}
                    </div>
                    <div style={s.locMeta}>
                      {l.type && <span style={s.typeTag}>{l.type}</span>}
                      <span style={{ ...s.statusTag, color: st.color, borderColor: `${st.color}40` }}>{st.label}</span>
                    </div>
                    {l.description && <div style={s.locDesc}>{l.description.slice(0, 80)}{l.description.length > 80 ? '…' : ''}</div>}
                  </div>
                );
              })}
            </div>
      }

      {/* DETAIL */}
      {modal?.type === 'detail' && (() => {
        const st = statusInfo(modal.item.status);
        return (
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
              {modal.item.type && <DField label="Tipo" value={modal.item.type} />}
              <DField label="Estado" value={<span style={{ color: st.color }}>{st.label}</span>} />
              <DField label="Visible para jugadores" value={modal.item.visibleToPlayers ? 'Sí' : 'No'} />
            </div>
            {modal.item.description  && <DBlock label="Descripción"     value={modal.item.description} />}
            {modal.item.npcsPresent  && <DBlock label="NPCs presentes"  value={modal.item.npcsPresent} />}
          </Overlay>
        );
      })()}

      {/* FORM */}
      {modal?.type === 'form' && (
        <Overlay onClose={close}>
          <h2 style={s.mTitle}>{modal.item ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>

          <div style={s.fGrid}>
            <FField label="Nombre *" value={form.name} onChange={setF('name')} />
            <div style={{ marginBottom: '12px' }}>
              <label style={s.flabel}>Tipo</label>
              <select value={form.type} onChange={e => setF('type')(e.target.value)} style={s.fselect}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <FField label="Descripción"    value={form.description} onChange={setF('description')} multi />
          <FField label="NPCs presentes" value={form.npcsPresent} onChange={setF('npcsPresent')} multi />

          <div style={{ marginBottom: '14px' }}>
            <div style={s.flabel}>Estado</div>
            <div style={s.stRow}>
              {ESTADOS.map(e => (
                <button key={e.id} type="button" onClick={() => setF('status')(e.id)}
                  style={{ ...s.stBtn, ...(form.status === e.id ? { borderColor: e.color, color: e.color, background: `${e.color}18` } : {}) }}>
                  {e.label}
                </button>
              ))}
            </div>
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
function DBlock({ label, value }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={s.dLabel}>{label}</div>
      <div style={s.dText}>{value}</div>
    </div>
  );
}
function FField({ label, value, onChange, multi }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={s.flabel}>{label}</label>
      {multi
        ? <textarea value={value} onChange={e => onChange(e.target.value)} style={s.textarea} rows={3} />
        : <input    value={value} onChange={e => onChange(e.target.value)} style={s.finput} />
      }
    </div>
  );
}

const s = {
  topBar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' },
  searchInput: { flex: '1 1 160px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none' },
  select: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '9px 12px', outline: 'none', cursor: 'pointer' },
  btnNew: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  muted: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #c9a84c', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' },
  locName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a' },
  visiBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: '#7aaa7a', border: '1px solid rgba(74,138,74,0.4)', padding: '2px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  locMeta: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  typeTag: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#7a6030', textTransform: 'uppercase' },
  statusTag: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', border: '1px solid', padding: '2px 8px' },
  locDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#9a8070', lineHeight: '1.5' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  modal: { background: 'rgba(10,8,18,0.99)', border: '1px solid rgba(201,168,76,0.3)', borderTop: '3px solid #c9a84c', width: '100%', maxWidth: '560px', position: 'relative', marginTop: '20px' },
  closeBtn: { position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: '#5a4820', fontSize: '16px', cursor: 'pointer' },
  mBody: { padding: '28px' },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  mTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#e8c96a', letterSpacing: '1px', margin: '0 0 20px 0' },
  dGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 20px', marginBottom: '16px' },
  dLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '3px' },
  dVal: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#e8c96a' },
  dText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#f5f0e8', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  fGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' },
  flabel: { display: 'block', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#7a6030', textTransform: 'uppercase', marginBottom: '5px' },
  finput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' },
  fselect: { width: '100%', background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  stRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' },
  stBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  toggle: { display: 'flex', alignItems: 'center', fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#9a9080', cursor: 'pointer', marginBottom: '16px' },
  fActions: { display: 'flex', gap: '10px', borderTop: '1px solid rgba(201,168,76,0.1)', paddingTop: '16px' },
  btn: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', border: '1px solid' },
  btnGold: { background: 'rgba(201,168,76,0.12)', borderColor: 'rgba(201,168,76,0.35)', color: '#e8c96a' },
  btnRed: { background: 'rgba(139,26,26,0.1)', borderColor: 'rgba(139,26,26,0.4)', color: '#e07070' },
  btnGhost: { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#5a4820' },
};
