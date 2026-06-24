// src/pages/dm/TabFacciones.js
import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const REP_LEVELS = [
  { id: 'enemigo',   label: 'Enemigo',   color: '#e07070' },
  { id: 'hostil',    label: 'Hostil',    color: '#d08040' },
  { id: 'neutral',   label: 'Neutral',   color: '#9a9080' },
  { id: 'amistoso',  label: 'Amistoso',  color: '#c9a84c' },
  { id: 'aliado',    label: 'Aliado',    color: '#7aaa7a' },
];

const EMPTY = {
  name: '', description: '', objectives: '', alignment: '',
  reputationLevel: 'neutral', visibleToPlayers: false,
};

export default function TabFacciones() {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'factions'));
      setFactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew    = () => { setForm(EMPTY); setModal({ type: 'form', item: null }); };
  const openEdit   = (f) => { setForm({ ...EMPTY, ...f }); setModal({ type: 'form', item: f }); };
  const openDetail = (f) => { setDelConfirm(false); setModal({ type: 'detail', item: f }); };
  const close = () => setModal(null);
  const setF = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = modal.item?.id || `fac_${Date.now()}`;
      const extra = modal.item ? {} : { createdAt: serverTimestamp() };
      await setDoc(doc(db, 'factions', id), { ...form, updatedAt: serverTimestamp(), ...extra }, { merge: true });
      await load(); close();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async () => {
    try { await deleteDoc(doc(db, 'factions', modal.item.id)); await load(); close(); }
    catch (err) { console.error(err); }
  };

  const filtered = factions.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));

  const repInfo = (id) => REP_LEVELS.find(r => r.id === id) || REP_LEVELS[2];

  return (
    <div>
      <div style={s.topBar}>
        <input value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} placeholder="Buscar facción..." />
        <button style={s.btnNew} onClick={openNew}>+ Nueva Facción</button>
      </div>

      {loading
        ? <div style={s.muted}>Cargando facciones...</div>
        : filtered.length === 0
          ? <div style={s.muted}>{factions.length === 0 ? 'Sin facciones. Creá la primera.' : 'Sin resultados.'}</div>
          : <div style={s.grid}>
              {filtered.map(f => {
                const rep = repInfo(f.reputationLevel);
                return (
                  <div key={f.id} style={{ ...s.card, borderTopColor: rep.color }} onClick={() => openDetail(f)}>
                    <div style={s.cardTop}>
                      <span style={s.facName}>{f.name}</span>
                      {f.visibleToPlayers && <span style={s.visiBadge}>Visible</span>}
                    </div>
                    {f.alignment && <div style={s.facMeta}>{f.alignment}</div>}
                    <div style={{ ...s.repBadge, color: rep.color, borderColor: `${rep.color}40` }}>
                      {rep.label}
                    </div>
                    {f.description && <div style={s.facDesc}>{f.description.slice(0, 80)}{f.description.length > 80 ? '…' : ''}</div>}
                  </div>
                );
              })}
            </div>
      }

      {/* DETAIL */}
      {modal?.type === 'detail' && (() => {
        const rep = repInfo(modal.item.reputationLevel);
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
              {modal.item.alignment && <DField label="Alineamiento" value={modal.item.alignment} />}
              <DField label="Reputación con la party" value={<span style={{ color: rep.color }}>{rep.label}</span>} />
              <DField label="Visible para jugadores" value={modal.item.visibleToPlayers ? 'Sí' : 'No'} />
            </div>
            {modal.item.description && <DBlock label="Descripción"  value={modal.item.description} />}
            {modal.item.objectives  && <DBlock label="Objetivos"    value={modal.item.objectives}  />}
          </Overlay>
        );
      })()}

      {/* FORM */}
      {modal?.type === 'form' && (
        <Overlay onClose={close}>
          <h2 style={s.mTitle}>{modal.item ? 'Editar Facción' : 'Nueva Facción'}</h2>

          <div style={s.fGrid}>
            <FField label="Nombre *"      value={form.name}      onChange={setF('name')} />
            <FField label="Alineamiento"  value={form.alignment} onChange={setF('alignment')} />
          </div>
          <FField label="Descripción" value={form.description} onChange={setF('description')} multi />
          <FField label="Objetivos"   value={form.objectives}  onChange={setF('objectives')}  multi />

          <div style={{ marginBottom: '14px' }}>
            <div style={s.flabel}>Reputación con la party</div>
            <div style={s.repRow}>
              {REP_LEVELS.map(r => (
                <button key={r.id} type="button" onClick={() => setF('reputationLevel')(r.id)}
                  style={{ ...s.repBtn, ...(form.reputationLevel === r.id ? { borderColor: r.color, color: r.color, background: `${r.color}18` } : {}) }}>
                  {r.label}
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
  searchInput: { flex: '1 1 160px', background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none' },
  btnNew: { background: 'transparent', border: '1px solid var(--gold-dim)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  muted: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: 'var(--gold-dim)', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '3px solid var(--gold)', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' },
  facName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)' },
  visiBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: '#7aaa7a', border: '1px solid rgba(74,138,74,0.4)', padding: '2px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  facMeta: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)' },
  repBadge: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', border: '1px solid', padding: '3px 10px', alignSelf: 'flex-start' },
  facDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', lineHeight: '1.5' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  modal: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '3px solid var(--gold)', width: '100%', maxWidth: '560px', position: 'relative', marginTop: '20px' },
  closeBtn: { position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontSize: '16px', cursor: 'pointer' },
  mBody: { padding: '28px' },
  mHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  mTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '1px', margin: '0 0 20px 0' },
  dGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 20px', marginBottom: '16px' },
  dLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '3px' },
  dVal: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-bright)' },
  dText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment)', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  fGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 16px' },
  flabel: { display: 'block', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '5px' },
  finput: { width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  repRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' },
  repBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  toggle: { display: 'flex', alignItems: 'center', fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment-dim)', cursor: 'pointer', marginBottom: '16px' },
  fActions: { display: 'flex', gap: '10px', borderTop: '1px solid var(--line)', paddingTop: '16px' },
  btn: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase', border: '1px solid' },
  btnGold: { background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))', borderColor: 'transparent', color: '#1a1206' },
  btnRed: { background: 'rgba(184,100,63,0.1)', borderColor: 'rgba(184,100,63,0.4)', color: 'var(--ember)' },
  btnGhost: { background: 'transparent', borderColor: 'var(--line)', color: 'var(--parchment-dim)' },
};
