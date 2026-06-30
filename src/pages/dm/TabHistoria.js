// src/pages/dm/TabHistoria.js
import React, { useEffect, useState } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

const CATEGORIES = [
  { id: 'evento',  label: 'Evento',  color: '#c9a84c', icon: '⚡' },
  { id: 'combate', label: 'Combate', color: '#ef7368', icon: '⚔️' },
  { id: 'lore',    label: 'Lore',    color: '#86d4ff', icon: '📖' },
  { id: 'npc',     label: 'PNJ',     color: '#65c260', icon: '👤' },
  { id: 'lugar',   label: 'Lugar',   color: '#b9a0ff', icon: '🗺️' },
];

const BLANK = { title: '', description: '', category: 'evento', session: '', visibleToParty: false };

export default function TabHistoria({ user }) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openNew = () => {
    setForm(BLANK);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (ev) => {
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      category: ev.category || 'evento',
      session: ev.session || '',
      visibleToParty: ev.visibleToParty !== false,
    });
    setEditingId(ev.id);
    setShowForm(true);
  };

  const cancel = () => { setShowForm(false); setEditingId(null); setForm(BLANK); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'timeline', editingId), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'timeline'), {
          ...form,
          author: user.email,
          createdAt: serverTimestamp(),
        });
      }
      cancel();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const toggleVisibility = async (ev) => {
    const newVal = ev.visibleToParty === false ? true : false;
    await updateDoc(doc(db, 'timeline', ev.id), { visibleToParty: newVal });
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar este evento de la historia?')) return;
    await deleteDoc(doc(db, 'timeline', id));
  };

  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

  const published = events.filter(e => e.visibleToParty !== false).length;
  const drafts    = events.length - published;

  const filtered = filter === 'all'
    ? events
    : filter === 'published'
      ? events.filter(e => e.visibleToParty !== false)
      : filter === 'draft'
        ? events.filter(e => e.visibleToParty === false)
        : events.filter(e => e.category === filter);

  return (
    <div>

      {/* ── STAT CHIPS ── */}
      <div style={s.statRow}>
        <StatChip label="Total"      value={events.length}  />
        <StatChip label="Publicados" value={published} color="#65c260" onClick={() => setFilter('published')} active={filter === 'published'} />
        <StatChip label="Borradores" value={drafts}    color="var(--gold-dim)" onClick={() => setFilter('draft')} active={filter === 'draft'} />
        <button style={s.newBtn} onClick={openNew}>+ Nuevo evento</button>
      </div>

      {/* ── CATEGORY FILTERS ── */}
      <div style={s.catFilters}>
        <button style={{ ...s.catBtn, ...(filter === 'all' ? s.catActive : {}) }} onClick={() => setFilter('all')}>
          Todos
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            style={{ ...s.catBtn, ...(filter === c.id ? { ...s.catActive, borderColor: c.color, color: c.color } : {}) }}
            onClick={() => setFilter(c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <form onSubmit={save} style={s.form} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editingId ? '✎ Editar evento' : '+ Nuevo evento'}</span>
            <button type="button" onClick={cancel} style={s.cancelBtn}>✕</button>
          </div>

          <div style={s.formGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: 'span 2' }}>
              <label style={s.label}>Título del evento</label>
              <input style={s.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="La batalla en el bosque..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={s.label}>Categoría</label>
              <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={s.label}>Sesión (opcional)</label>
              <input style={s.input} value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} placeholder="S01" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={s.label}>Descripción</label>
            <textarea style={s.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Detalles del evento..." />
          </div>

          <div style={s.visibilityRow}>
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={form.visibleToParty}
                onChange={e => setForm(f => ({ ...f, visibleToParty: e.target.checked }))}
                style={{ accentColor: 'var(--gold)' }}
              />
              <span>Visible para la party</span>
            </label>
            <span style={{ fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: 'var(--gold-dim)' }}>
              {form.visibleToParty ? '👁 Aparecerá en Historia' : '🔒 Solo visible para el DM'}
            </span>
          </div>

          <button type="submit" style={s.saveBtn} disabled={saving}>
            {saving ? 'Guardando...' : editingId ? '✦ Guardar cambios' : '✦ Agregar evento'}
          </button>
        </form>
      )}

      {/* ── EVENT LIST ── */}
      {loading
        ? <div style={s.loading}>Cargando historia...</div>
        : filtered.length === 0
          ? <div style={s.empty}>Sin eventos {filter !== 'all' ? 'con este filtro' : '— creá el primero arriba'}</div>
          : <div style={s.list}>
              {filtered.map((ev) => {
                const c = cat(ev.category);
                const isPublished = ev.visibleToParty !== false;
                const isExpanded  = expandedId === ev.id;
                return (
                  <div
                    key={ev.id}
                    style={{ ...s.evCard, borderLeft: `3px solid ${isPublished ? '#65c260' : '#3a3020'}` }}
                    className="fade-in"
                  >
                    <div style={s.evHeader} onClick={() => setExpandedId(isExpanded ? null : ev.id)}>
                      <div style={{ ...s.evDot, background: c.color }}>{c.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.evTitle}>{ev.title}</div>
                        <div style={s.evMeta}>
                          <span style={{ ...s.catBadge, borderColor: `${c.color}40`, color: c.color }}>{c.label}</span>
                          {ev.session && <span style={s.sessBadge}>{ev.session}</span>}
                          <span style={{
                            fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px',
                            color: isPublished ? '#65c260' : 'var(--gold-dim)',
                          }}>
                            {isPublished ? '● Publicado' : '○ Borrador'}
                          </span>
                        </div>
                      </div>
                      <span style={{ color: 'var(--gold-dim)', fontSize: '12px', flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={s.evBody} className="fade-in">
                        {ev.description && (
                          <p style={s.evDesc}>{ev.description}</p>
                        )}
                        <div style={s.evActions}>
                          <button style={s.actionBtn} onClick={() => openEdit(ev)}>✎ Editar</button>
                          <button
                            style={{ ...s.actionBtn, color: isPublished ? 'var(--gold-dim)' : '#65c260', borderColor: isPublished ? 'var(--line)' : 'rgba(101,194,96,0.3)' }}
                            onClick={() => toggleVisibility(ev)}
                          >
                            {isPublished ? '🔒 Ocultar a party' : '👁 Publicar'}
                          </button>
                          <button style={{ ...s.actionBtn, color: '#ef7368', borderColor: 'rgba(239,115,104,0.3)', marginLeft: 'auto' }} onClick={() => remove(ev.id)}>
                            🗑 Eliminar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      }
    </div>
  );
}

function StatChip({ label, value, color, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 16px', background: active ? 'rgba(201,168,76,0.08)' : 'var(--panel)',
        border: `1px solid ${active ? 'var(--gold-dim)' : 'var(--line)'}`,
        cursor: onClick ? 'pointer' : 'default', minWidth: '80px',
      }}
    >
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: '900', color: color || 'var(--gold-bright)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</span>
    </div>
  );
}

const s = {
  statRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'stretch' },
  newBtn: {
    marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(201,168,76,0.3)',
    color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px',
    padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase',
  },
  catFilters: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' },
  catBtn: {
    background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)',
    fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px',
    padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },
  catActive: { background: 'rgba(201,164,73,0.08)', borderColor: 'var(--gold-dim)', color: 'var(--gold)' },

  // Form
  form: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderTop: '2px solid var(--gold)', padding: '20px', marginBottom: '20px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' },
  cancelBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  input: {
    background: 'var(--panel-raised)', border: '1px solid var(--line)',
    color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px',
    padding: '8px 12px', outline: 'none', width: '100%',
  },
  textarea: {
    background: 'var(--panel-raised)', border: '1px solid var(--line)',
    color: 'var(--parchment-dim)', fontFamily: 'Crimson Pro,serif', fontSize: '14px',
    padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.7',
  },
  visibilityRow: {
    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
    background: 'rgba(201,168,76,0.04)', border: '1px solid var(--line)', padding: '10px 14px',
  },
  checkLabel: {
    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
    fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
    color: 'var(--gold)', textTransform: 'uppercase',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
    border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '11px',
    letterSpacing: '2px', padding: '12px 20px', cursor: 'pointer', textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },

  // List
  list: { display: 'flex', flexDirection: 'column', gap: '6px' },
  evCard: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    overflow: 'hidden',
  },
  evHeader: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', cursor: 'pointer',
  },
  evDot: {
    width: '30px', height: '30px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', flexShrink: 0,
  },
  evTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '600', color: 'var(--gold-bright)', marginBottom: '4px' },
  evMeta: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  catBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', padding: '2px 6px', textTransform: 'uppercase' },
  sessBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', padding: '2px 6px', border: '1px solid var(--line)' },
  evBody: { padding: '0 16px 14px', borderTop: '1px solid var(--line)', paddingTop: '12px' },
  evDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '12px' },
  evActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  actionBtn: {
    background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)',
    fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px',
    padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
  },

  loading: { textAlign: 'center', padding: '40px', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '2px', fontSize: '10px' },
  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', textAlign: 'center', padding: '40px' },
};
