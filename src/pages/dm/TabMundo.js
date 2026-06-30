// src/pages/dm/TabMundo.js — NPCs, Facciones y Ubicaciones integrados
import React, { useEffect, useState, useCallback } from 'react';
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

const SUBTABS = [
  { id: 'npcs',        label: 'NPCs',        icon: '🎭' },
  { id: 'facciones',   label: 'Facciones',   icon: '⚑' },
  { id: 'ubicaciones', label: 'Ubicaciones', icon: '🗺' },
];

// ─── NPC tipos ───────────────────────────────────────────
const NPC_TIPOS = [
  { id: 'antagonista',    label: 'Antagonista',     color: '#ef7368', bg: 'rgba(239,115,104,0.1)' },
  { id: 'aliado',         label: 'Aliado',          color: '#65c260', bg: 'rgba(101,194,96,0.1)' },
  { id: 'party_temporal', label: 'Miembro temporal', color: '#f7dd78', bg: 'rgba(247,221,120,0.1)' },
  { id: 'situacional',    label: 'Situacional',     color: '#86d4ff', bg: 'rgba(134,212,255,0.1)' },
  { id: 'neutro',         label: 'Neutro',          color: '#9d9275', bg: 'rgba(157,146,117,0.1)' },
];

const tipoInfo = (id) => NPC_TIPOS.find(t => t.id === id) || NPC_TIPOS[4];

const EMPTY_NPC = {
  name: '', tipo: 'neutro', race: '', role: '',
  physicalDescription: '', motivation: '', secret: '',
  currentLocation: '', faction: '', partyRelation: '',
  visibleToPlayers: false,
};

// ─── FACCIONES ────────────────────────────────────────────
const EMPTY_FAC = {
  name: '', description: '', alignment: '',
  goals: '', knownMembers: '', partyRelation: '',
  reputation: 0, visibleToPlayers: false,
};

// ─── UBICACIONES ─────────────────────────────────────────
const EMPTY_UBI = {
  name: '', type: '', description: '',
  knownTo: '', secrets: '', connectedTo: '',
  visibleToPlayers: false,
};

export default function TabMundo() {
  const [sub, setSub] = useState('npcs');
  return (
    <div>
      <div style={s.subtabBar}>
        {SUBTABS.map(t => (
          <button key={t.id} style={{ ...s.subtab, ...(sub === t.id ? s.subtabActive : {}) }} onClick={() => setSub(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: '20px' }}>
        {sub === 'npcs'        && <NPCsSection />}
        {sub === 'facciones'   && <FaccionesSection />}
        {sub === 'ubicaciones' && <UbicacionesSection />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NPCS
// ═══════════════════════════════════════════════════════════
function NPCsSection() {
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_NPC });
  const [saving, setSaving] = useState(false);
  const [detailNpc, setDetailNpc] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'npcs'), snap => {
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const openNew  = () => { setForm({ ...EMPTY_NPC }); setEditing(null); setFormOpen(true); setDetailNpc(null); };
  const openEdit = (n) => { setForm({ ...EMPTY_NPC, ...n }); setEditing(n.id); setFormOpen(true); setDetailNpc(null); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = editing || `npc_${Date.now()}`;
      await setDoc(doc(db, 'npcs', id), {
        ...form,
        updatedAt: serverTimestamp(),
        ...(editing ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      closeForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async (id) => {
    await deleteDoc(doc(db, 'npcs', id));
    setDetailNpc(null);
  };

  const toggleVisible = async (npc) => {
    await setDoc(doc(db, 'npcs', npc.id), { visibleToPlayers: !npc.visibleToPlayers }, { merge: true });
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const filtered = npcs.filter(n => {
    const matchSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
    const matchTipo = !filterTipo || n.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const byTipo = NPC_TIPOS.map(t => ({ ...t, count: npcs.filter(n => n.tipo === t.id).length }));

  return (
    <div>
      {/* Stats strip */}
      <div style={s.statsStrip}>
        {byTipo.map(t => (
          <div key={t.id} style={{ ...s.tipoChip, background: t.bg, borderColor: t.color + '50', color: t.color, cursor: 'pointer', opacity: filterTipo && filterTipo !== t.id ? 0.4 : 1 }}
            onClick={() => setFilterTipo(filterTipo === t.id ? '' : t.id)}>
            <span style={{ fontWeight: '700', fontSize: '16px' }}>{t.count}</span>
            <span style={{ fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: 'Cinzel,serif' }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input style={s.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar NPC..." />
        <button style={s.newBtn} onClick={openNew}>+ Nuevo NPC</button>
      </div>

      {/* Form */}
      {formOpen && (
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editing ? 'Editar NPC' : 'Nuevo NPC'}</span>
            <button style={s.closeBtn} onClick={closeForm}>✕</button>
          </div>
          <div style={s.formGrid}>
            <FL label="Nombre"><input style={s.input} value={form.name} onChange={f('name')} placeholder="Nombre del NPC" /></FL>
            <FL label="Tipo">
              <select style={s.input} value={form.tipo} onChange={f('tipo')}>
                {NPC_TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </FL>
            <FL label="Raza / Especie"><input style={s.input} value={form.race} onChange={f('race')} placeholder="Humano, Elfo..." /></FL>
            <FL label="Rol / Ocupación"><input style={s.input} value={form.role} onChange={f('role')} placeholder="Posadero, Guardia, Mago..." /></FL>
            <FL label="Facción"><input style={s.input} value={form.faction} onChange={f('faction')} placeholder="Nombre de la facción" /></FL>
            <FL label="Ubicación actual"><input style={s.input} value={form.currentLocation} onChange={f('currentLocation')} placeholder="Ciudad, mazmorra..." /></FL>
            <div style={{ gridColumn: 'span 2' }}>
              <FL label="Descripción física"><textarea style={s.textarea} rows={2} value={form.physicalDescription} onChange={f('physicalDescription')} placeholder="Apariencia, edad, rasgos distintivos..." /></FL>
            </div>
            <FL label="Motivación (DM)"><textarea style={s.textarea} rows={2} value={form.motivation} onChange={f('motivation')} placeholder="Qué quiere realmente este NPC..." /></FL>
            <FL label="Secreto (DM)"><textarea style={s.textarea} rows={2} value={form.secret} onChange={f('secret')} placeholder="Lo que la party no sabe todavía..." /></FL>
            <div style={{ gridColumn: 'span 2' }}>
              <FL label="Relación con la party"><textarea style={s.textarea} rows={2} value={form.partyRelation} onChange={f('partyRelation')} placeholder="Cómo interactuaron, qué sienten mutuamente..." /></FL>
            </div>
          </div>
          {form.tipo === 'party_temporal' && (
            <div style={s.partyTemporalBox}>
              <span style={{ fontSize: '14px' }}>⚔</span>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold-bright)', letterSpacing: '1px' }}>Miembro temporal de la party — este NPC se une al grupo. Se mostrará en la vista de jugadores si lo publicás.</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '12px' }}>
            <label style={s.checkLabel}>
              <input type="checkbox" checked={form.visibleToPlayers} onChange={f('visibleToPlayers')} />
              Visible para la party
            </label>
          </div>
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={closeForm}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? '...' : editing ? '✓ Guardar' : '✦ Crear NPC'}</button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={s.empty}>Cargando NPCs...</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>{npcs.length === 0 ? 'No hay NPCs todavía.' : 'Sin resultados.'}</div>
      ) : (
        <div style={s.npcGrid}>
          {filtered.map(npc => {
            const tipo = tipoInfo(npc.tipo);
            return (
              <div key={npc.id} style={{ ...s.npcCard, borderTopColor: tipo.color }} onClick={() => setDetailNpc(detailNpc?.id === npc.id ? null : npc)}>
                <div style={s.npcCardHeader}>
                  <div style={{ ...s.tipoBadge, background: tipo.bg, color: tipo.color, borderColor: tipo.color + '50' }}>{tipo.label}</div>
                  {npc.visibleToPlayers && <span style={s.visibleDot} title="Visible para la party">👁</span>}
                </div>
                <div style={s.npcName}>{npc.name}</div>
                <div style={s.npcSub}>{[npc.race, npc.role].filter(Boolean).join(' · ')}</div>
                {npc.currentLocation && <div style={s.npcLoc}>📍 {npc.currentLocation}</div>}
                {npc.faction && <div style={s.npcFac}>⚑ {npc.faction}</div>}

                {detailNpc?.id === npc.id && (
                  <div style={s.npcDetail} className="fade-in" onClick={e => e.stopPropagation()}>
                    {npc.physicalDescription && <DetailRow label="Descripción" value={npc.physicalDescription} />}
                    {npc.motivation && <DetailRow label="Motivación (DM)" value={npc.motivation} private />}
                    {npc.secret && <DetailRow label="Secreto (DM)" value={npc.secret} private />}
                    {npc.partyRelation && <DetailRow label="Relación con party" value={npc.partyRelation} />}
                    <div style={s.npcActions}>
                      <button style={s.editBtnSm} onClick={() => openEdit(npc)}>✎ Editar</button>
                      <button style={npc.visibleToPlayers ? s.unpublishBtnSm : s.publishBtnSm} onClick={() => toggleVisible(npc)}>
                        {npc.visibleToPlayers ? '↓ Ocultar' : '↑ Mostrar a party'}
                      </button>
                      <button style={s.deleteBtnSm} onClick={() => del(npc.id)}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, private: isPrivate }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: isPrivate ? 'rgba(199,162,66,0.5)' : 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>
        {isPrivate ? '🔒 ' : ''}{label}
      </div>
      <p style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.5', margin: 0 }}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FACCIONES
// ═══════════════════════════════════════════════════════════
function FaccionesSection() {
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FAC });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'factions'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const openNew  = () => { setForm({ ...EMPTY_FAC }); setEditing(null); setFormOpen(true); };
  const openEdit = (item) => { setForm({ ...EMPTY_FAC, ...item }); setEditing(item.id); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = editing || `fac_${Date.now()}`;
      await setDoc(doc(db, 'factions', id), { ...form, updatedAt: serverTimestamp(), ...(editing ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      closeForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async (id) => { await deleteDoc(doc(db, 'factions', id)); };

  const repColors = (r) => r > 60 ? '#65c260' : r > 30 ? '#c7a242' : '#ef7368';

  return (
    <div>
      <div style={s.toolbar}>
        <span style={s.count}>{items.length} facciones</span>
        <button style={s.newBtn} onClick={openNew}>+ Nueva facción</button>
      </div>
      {formOpen && (
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editing ? 'Editar facción' : 'Nueva facción'}</span>
            <button style={s.closeBtn} onClick={closeForm}>✕</button>
          </div>
          <div style={s.formGrid}>
            <FL label="Nombre"><input style={s.input} value={form.name} onChange={f('name')} /></FL>
            <FL label="Alineamiento"><input style={s.input} value={form.alignment} onChange={f('alignment')} placeholder="Legal Bueno, Caótico..." /></FL>
            <div style={{ gridColumn: 'span 2' }}>
              <FL label="Descripción"><textarea style={s.textarea} rows={2} value={form.description} onChange={f('description')} /></FL>
            </div>
            <FL label="Objetivos"><textarea style={s.textarea} rows={2} value={form.goals} onChange={f('goals')} /></FL>
            <FL label="Miembros conocidos"><textarea style={s.textarea} rows={2} value={form.knownMembers} onChange={f('knownMembers')} /></FL>
            <FL label="Relación con la party"><textarea style={s.textarea} rows={2} value={form.partyRelation} onChange={f('partyRelation')} /></FL>
            <FL label="Reputación (0-100)"><input type="number" min="0" max="100" style={s.input} value={form.reputation} onChange={f('reputation')} /></FL>
          </div>
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={closeForm}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? '...' : editing ? '✓ Guardar' : '✦ Crear'}</button>
          </div>
        </div>
      )}
      <div style={s.itemList}>
        {items.map(item => (
          <div key={item.id} style={s.itemRow}>
            <div style={{ flex: 1 }}>
              <div style={s.itemName}>{item.name}</div>
              {item.alignment && <div style={s.itemSub}>{item.alignment}</div>}
              {item.description && <p style={s.itemDesc}>{item.description}</p>}
              {item.reputation !== undefined && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', width: '200px' }}>
                    <div style={{ height: '100%', width: `${item.reputation}%`, background: repColors(item.reputation), borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: repColors(item.reputation), marginTop: '3px' }}>Reputación: {item.reputation}/100</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button style={s.editBtnSm} onClick={() => openEdit(item)}>✎</button>
              <button style={s.deleteBtnSm} onClick={() => del(item.id)}>✕</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={s.empty}>No hay facciones todavía.</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// UBICACIONES
// ═══════════════════════════════════════════════════════════
function UbicacionesSection() {
  const [items, setItems] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_UBI });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'locations'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  const openNew  = () => { setForm({ ...EMPTY_UBI }); setEditing(null); setFormOpen(true); };
  const openEdit = (item) => { setForm({ ...EMPTY_UBI, ...item }); setEditing(item.id); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const id = editing || `loc_${Date.now()}`;
      await setDoc(doc(db, 'locations', id), { ...form, updatedAt: serverTimestamp(), ...(editing ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      closeForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async (id) => { await deleteDoc(doc(db, 'locations', id)); };

  return (
    <div>
      <div style={s.toolbar}>
        <span style={s.count}>{items.length} ubicaciones</span>
        <button style={s.newBtn} onClick={openNew}>+ Nueva ubicación</button>
      </div>
      {formOpen && (
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editing ? 'Editar ubicación' : 'Nueva ubicación'}</span>
            <button style={s.closeBtn} onClick={closeForm}>✕</button>
          </div>
          <div style={s.formGrid}>
            <FL label="Nombre"><input style={s.input} value={form.name} onChange={f('name')} placeholder="El Castillo Sombra..." /></FL>
            <FL label="Tipo"><input style={s.input} value={form.type} onChange={f('type')} placeholder="Mazmorra, ciudad, bosque..." /></FL>
            <div style={{ gridColumn: 'span 2' }}>
              <FL label="Descripción"><textarea style={s.textarea} rows={3} value={form.description} onChange={f('description')} /></FL>
            </div>
            <FL label="Conocida por"><input style={s.input} value={form.knownTo} onChange={f('knownTo')} placeholder="La party, los habitantes..." /></FL>
            <FL label="Conectada con"><input style={s.input} value={form.connectedTo} onChange={f('connectedTo')} placeholder="Otras ubicaciones..." /></FL>
            <div style={{ gridColumn: 'span 2' }}>
              <FL label="Secretos (DM)"><textarea style={s.textarea} rows={2} value={form.secrets} onChange={f('secrets')} placeholder="Lo que la party no descubrió todavía..." /></FL>
            </div>
          </div>
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={closeForm}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? '...' : editing ? '✓ Guardar' : '✦ Crear'}</button>
          </div>
        </div>
      )}
      <div style={s.itemList}>
        {items.map(item => (
          <div key={item.id} style={s.itemRow}>
            <div style={{ flex: 1 }}>
              <div style={s.itemName}>{item.name} {item.type && <span style={s.itemType}>{item.type}</span>}</div>
              {item.description && <p style={s.itemDesc}>{item.description}</p>}
              {item.secrets && <p style={{ ...s.itemDesc, color: 'rgba(199,162,66,0.5)', fontStyle: 'italic' }}>🔒 {item.secrets}</p>}
              {item.connectedTo && <div style={s.itemSub}>↔ {item.connectedTo}</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button style={s.editBtnSm} onClick={() => openEdit(item)}>✎</button>
              <button style={s.deleteBtnSm} onClick={() => del(item.id)}>✕</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={s.empty}>No hay ubicaciones todavía.</div>}
      </div>
    </div>
  );
}

// Shared field label
function FL({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  // Subtabs
  subtabBar: { display: 'flex', gap: '8px', marginBottom: '4px' },
  subtab: { display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', transition: 'all 0.2s' },
  subtabActive: { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.4)', color: 'var(--gold-bright)' },

  // NPC stats
  statsStrip: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  tipoChip: { display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid', borderRadius: '8px', padding: '8px 14px', minWidth: '80px', gap: '2px', transition: 'opacity 0.2s' },

  // Toolbar
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' },
  search: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 14px', outline: 'none', borderRadius: '6px', flex: 1, maxWidth: '300px' },
  count: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  newBtn: { background: 'linear-gradient(135deg, var(--gold-bright, #f7dd78), var(--gold-2, #c7a242))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', whiteSpace: 'nowrap' },

  // Form
  formCard: { background: 'rgba(18,15,10,0.95)', border: '1px solid rgba(201,168,76,0.2)', borderTop: '2px solid var(--gold-2, #c7a242)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '2px', color: 'var(--gold-bright)', textTransform: 'uppercase' },
  closeBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '11px', width: '28px', height: '28px', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  textarea: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.5', borderRadius: '4px' },
  partyTemporalBox: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(247,221,120,0.06)', border: '1px solid rgba(247,221,120,0.2)', borderRadius: '6px', padding: '10px 14px' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', color: 'var(--gold-bright)', cursor: 'pointer' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid rgba(201,168,76,0.1)' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  saveBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },

  // NPC grid
  npcGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  npcCard: { background: 'rgba(18,15,10,0.8)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid', borderRadius: '8px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'border-color 0.2s' },
  npcCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tipoBadge: { border: '1px solid', borderRadius: '4px', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', textTransform: 'uppercase' },
  visibleDot: { fontSize: '12px', opacity: 0.7 },
  npcName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px', marginTop: '4px' },
  npcSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--text-soft)' },
  npcLoc: { fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold-dim)', letterSpacing: '0.5px' },
  npcFac: { fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold-dim)', letterSpacing: '0.5px' },
  npcDetail: { marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(201,168,76,0.1)' },
  npcActions: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' },
  editBtnSm: { background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  publishBtnSm: { background: 'rgba(101,194,96,0.1)', border: '1px solid rgba(101,194,96,0.3)', color: 'var(--green-2, #65c260)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  unpublishBtnSm: { background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  deleteBtnSm: { background: 'rgba(239,115,104,0.08)', border: '1px solid rgba(239,115,104,0.25)', color: 'var(--red-1, #ef7368)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', marginLeft: 'auto' },

  // Item list (facciones / ubicaciones)
  itemList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  itemRow: { display: 'flex', gap: '16px', alignItems: 'flex-start', background: 'rgba(18,15,10,0.8)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '8px', padding: '14px 16px' },
  itemName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' },
  itemType: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '3px', padding: '2px 6px' },
  itemSub: { fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold-dim)', letterSpacing: '0.5px', marginTop: '4px' },
  itemDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.5', margin: '6px 0 0' },

  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', padding: '40px 0', textAlign: 'center' },
};
