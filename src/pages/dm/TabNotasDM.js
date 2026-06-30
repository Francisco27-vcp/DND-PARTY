// src/pages/dm/TabNotasDM.js — Notas privadas del DM
import React, { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

const CATEGORIAS = [
  { id: 'all',      label: 'Todas',      color: 'var(--gold-dim)' },
  { id: 'trama',    label: 'Trama',      color: '#b9a0ff' },
  { id: 'npc',      label: 'NPCs',       color: '#86d4ff' },
  { id: 'secreto',  label: 'Secretos',   color: '#ef7368' },
  { id: 'idea',     label: 'Ideas',      color: '#65c260' },
  { id: 'general',  label: 'General',    color: 'var(--gold-bright)' },
];

const catInfo = (id) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[5];

export default function TabNotasDM({ user }) {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo: '', contenido: '', categoria: 'general' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'dm_notes'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setNotas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const openNew = () => {
    setForm({ titulo: '', contenido: '', categoria: 'general' });
    setEditing(null);
    setFormOpen(true);
    setExpandedId(null);
  };

  const openEdit = (nota) => {
    setForm({ titulo: nota.titulo || '', contenido: nota.contenido || '', categoria: nota.categoria || 'general' });
    setEditing(nota.id);
    setFormOpen(true);
    setExpandedId(null);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() && !form.contenido.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, author: user.email, updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'dm_notes', editing), data);
      } else {
        await addDoc(collection(db, 'dm_notes'), { ...data, createdAt: serverTimestamp() });
      }
      closeForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const del = async (id) => {
    await deleteDoc(doc(db, 'dm_notes', id));
    setDeleteConfirm(null);
    setExpandedId(null);
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtered = filterCat === 'all'
    ? notas
    : notas.filter(n => n.categoria === filterCat);

  const catCounts = CATEGORIAS.slice(1).reduce((acc, c) => {
    acc[c.id] = notas.filter(n => n.categoria === c.id).length;
    return acc;
  }, {});

  return (
    <div>
      {/* WARNING banner */}
      <div style={s.privateBanner}>
        <span style={{ fontSize: '16px' }}>🔒</span>
        <span style={s.privateBannerText}>Estas notas son completamente privadas. Nunca son visibles para la party.</span>
      </div>

      {/* Header */}
      <div style={s.pageHeader}>
        {/* Category filter */}
        <div style={s.catFilter}>
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              style={{ ...s.catBtn, ...(filterCat === cat.id ? { ...s.catBtnActive, color: cat.color, borderColor: cat.color + '60' } : {}) }}
              onClick={() => setFilterCat(cat.id)}
            >
              {cat.label}
              {cat.id !== 'all' && catCounts[cat.id] > 0 && (
                <span style={{ ...s.catCount, background: cat.color + '20', color: cat.color }}>{catCounts[cat.id]}</span>
              )}
            </button>
          ))}
        </div>
        <button style={s.newBtn} onClick={openNew}>+ Nueva nota</button>
      </div>

      {/* Form */}
      {formOpen && (
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editing ? 'Editar nota' : 'Nueva nota privada'}</span>
            <button style={s.closeBtn} onClick={closeForm}>✕</button>
          </div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
              <FL label="Título">
                <input style={s.input} value={form.titulo} onChange={f('titulo')} placeholder="Nombre de la nota..." />
              </FL>
              <FL label="Categoría">
                <select style={s.input} value={form.categoria} onChange={f('categoria')}>
                  {CATEGORIAS.slice(1).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </FL>
            </div>
            <FL label="Contenido">
              <textarea
                style={{ ...s.textarea, minHeight: '180px' }}
                value={form.contenido}
                onChange={f('contenido')}
                placeholder="Tus notas privadas... planes de la trama, secretos que la party descubrirá eventualmente, ideas para próximas sesiones, motivaciones reales de los NPCs..."
                required
              />
            </FL>
            <div style={s.formActions}>
              <button type="button" style={s.cancelBtn} onClick={closeForm}>Cancelar</button>
              <button type="submit" style={s.saveBtn} disabled={saving}>
                {saving ? 'Guardando...' : editing ? '✓ Actualizar nota' : '✦ Guardar nota'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div style={s.empty}>Cargando notas...</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>{notas.length === 0 ? 'No hay notas todavía. El DM tiene sus secretos guardados.' : 'No hay notas en esta categoría.'}</div>
      ) : (
        <div style={s.notasGrid}>
          {filtered.map(nota => {
            const cat = catInfo(nota.categoria);
            const isExpanded = expandedId === nota.id;
            const preview = nota.contenido?.slice(0, 120) + (nota.contenido?.length > 120 ? '...' : '');

            return (
              <div key={nota.id} style={{ ...s.notaCard, borderTopColor: cat.color }}>
                <div style={s.notaHeader}>
                  <span style={{ ...s.catTag, color: cat.color, borderColor: cat.color + '50', background: cat.color + '10' }}>{cat.label}</span>
                  <div style={s.notaActions}>
                    <button style={s.iconBtn} onClick={() => openEdit(nota)} title="Editar">✎</button>
                    <button style={{ ...s.iconBtn, color: 'var(--red-1, #ef7368)' }} onClick={() => setDeleteConfirm(nota.id)} title="Eliminar">✕</button>
                  </div>
                </div>
                <div style={s.notaTitulo} onClick={() => setExpandedId(isExpanded ? null : nota.id)}>
                  {nota.titulo || 'Sin título'}
                </div>
                <div style={s.notaContenido} onClick={() => setExpandedId(isExpanded ? null : nota.id)}>
                  {isExpanded ? nota.contenido : preview}
                </div>
                {nota.contenido?.length > 120 && (
                  <button style={s.expandBtn} onClick={() => setExpandedId(isExpanded ? null : nota.id)}>
                    {isExpanded ? '▲ Cerrar' : '▼ Expandir'}
                  </button>
                )}
                {nota.updatedAt && (
                  <div style={s.notaDate}>
                    {nota.updatedAt.toDate?.()?.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalTitle}>¿Eliminar esta nota?</div>
            <p style={s.modalText}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.deleteConfirmBtn} onClick={() => del(deleteConfirm)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FL({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  privateBanner: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px' },
  privateBannerText: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },

  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' },
  catFilter: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  catBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' },
  catBtnActive: { background: 'rgba(201,168,76,0.08)' },
  catCount: { borderRadius: '10px', padding: '1px 6px', fontFamily: 'Cinzel,serif', fontSize: '9px', fontWeight: '700' },
  newBtn: { background: 'linear-gradient(135deg, var(--gold-bright, #f7dd78), var(--gold-2, #c7a242))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', whiteSpace: 'nowrap' },

  formCard: { background: 'rgba(18,15,10,0.95)', border: '1px solid rgba(201,168,76,0.2)', borderTop: '2px solid var(--gold-2, #c7a242)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '2px', color: 'var(--gold-bright)', textTransform: 'uppercase' },
  closeBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '11px', width: '28px', height: '28px', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  textarea: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6', borderRadius: '4px' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid rgba(201,168,76,0.1)' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  saveBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },

  notasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  notaCard: { background: 'rgba(18,15,10,0.85)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  notaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  catTag: { border: '1px solid', borderRadius: '4px', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', textTransform: 'uppercase' },
  notaActions: { display: 'flex', gap: '6px' },
  iconBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontSize: '13px', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 },
  notaTitulo: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px', cursor: 'pointer' },
  notaContenido: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.6', cursor: 'pointer', whiteSpace: 'pre-wrap' },
  expandBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', padding: '0', textTransform: 'uppercase', alignSelf: 'flex-start' },
  notaDate: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid rgba(201,168,76,0.08)' },

  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', padding: '40px 0', textAlign: 'center' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' },
  modal: { background: 'rgba(18,15,10,0.98)', border: '1px solid rgba(201,168,76,0.3)', borderTop: '2px solid var(--red-1, #ef7368)', padding: '24px', maxWidth: '380px', width: '100%', borderRadius: '12px' },
  modalTitle: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--red-1, #ef7368)', marginBottom: '8px', letterSpacing: '1px' },
  modalText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft)' },
  deleteConfirmBtn: { flex: 1, background: 'rgba(239,115,104,0.12)', border: '1px solid rgba(239,115,104,0.4)', color: 'var(--red-1, #ef7368)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '4px' },
};
