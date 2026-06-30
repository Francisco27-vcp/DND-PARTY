// src/pages/dm/TabSesiones.js — Gestión de sesiones (solo DM)
import React, { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

const EMPTY = {
  title: '', date: '', xpEarned: 0,
  summary: '', highlights: '', dmNotes: '',
  visibleToParty: false,
};

export default function TabSesiones({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // session id being edited
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeSection, setActiveSection] = useState('party'); // 'party' | 'dm'

  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const openNew = () => {
    setForm({ ...EMPTY, date: new Date().toISOString().split('T')[0] });
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (sess) => {
    setForm({
      title: sess.title || '',
      date: sess.date || '',
      xpEarned: sess.xpEarned || sess.xp || 0,
      summary: sess.summary || '',
      highlights: sess.highlights || '',
      dmNotes: sess.dmNotes || '',
      visibleToParty: sess.visibleToParty ?? true,
    });
    setEditing(sess.id);
    setFormOpen(true);
    setExpanded(null);
  };

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({ ...EMPTY }); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        xpEarned: parseInt(form.xpEarned) || 0,
        xp: parseInt(form.xpEarned) || 0,
        author: user.email,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, 'sessions', editing), data);
      } else {
        await addDoc(collection(db, 'sessions'), { ...data, createdAt: serverTimestamp() });
      }
      closeForm();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const toggleVisibility = async (sess) => {
    await updateDoc(doc(db, 'sessions', sess.id), {
      visibleToParty: !sess.visibleToParty,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteSess = async (id) => {
    await deleteDoc(doc(db, 'sessions', id));
    setDeleteConfirm(null);
    setExpanded(null);
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const publishedCount = sessions.filter(s => s.visibleToParty !== false).length;
  const draftCount = sessions.filter(s => s.visibleToParty === false).length;

  return (
    <div>
      {/* HEADER ROW */}
      <div style={s.pageHeader}>
        <div style={s.headerStats}>
          <StatChip label="Total" value={sessions.length} />
          <StatChip label="Publicadas" value={publishedCount} color="green" />
          <StatChip label="Borradores" value={draftCount} color="dim" />
        </div>
        <button style={s.newBtn} onClick={openNew}>+ Nueva sesión</button>
      </div>

      {/* FORM */}
      {formOpen && (
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <span style={s.formTitle}>{editing ? 'Editar sesión' : 'Nueva sesión'}</span>
            <button style={s.closeBtn} onClick={closeForm}>✕</button>
          </div>

          <form onSubmit={save}>
            <div style={s.formGrid3}>
              <div style={{ gridColumn: 'span 2' }}>
                <FL label="Título">
                  <input style={s.input} value={form.title} onChange={f('title')} placeholder="El Ataque al Castillo..." required />
                </FL>
              </div>
              <FL label="Fecha">
                <input type="date" style={s.input} value={form.date} onChange={f('date')} />
              </FL>
              <FL label="XP ganada">
                <input type="number" min="0" style={s.input} value={form.xpEarned} onChange={f('xpEarned')} placeholder="500" />
              </FL>
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={s.visToggleLabel}>
                  <input type="checkbox" checked={form.visibleToParty} onChange={e => setForm(p => ({ ...p, visibleToParty: e.target.checked }))} style={{ marginRight: '8px' }} />
                  <span>Visible para la party ahora</span>
                </label>
                <span style={s.visHint}>{form.visibleToParty ? '✓ La party puede ver esta sesión' : '— Borrador, solo visible para el DM'}</span>
              </div>
            </div>

            {/* Section switcher */}
            <div style={s.sectionTabs}>
              <button type="button" style={{ ...s.sectionTab, ...(activeSection === 'party' ? s.sectionTabActive : {}) }} onClick={() => setActiveSection('party')}>
                📜 Para la party
              </button>
              <button type="button" style={{ ...s.sectionTab, ...(activeSection === 'dm' ? s.sectionTabActive : {}) }} onClick={() => setActiveSection('dm')}>
                🔒 Notas del DM (privadas)
              </button>
            </div>

            {activeSection === 'party' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FL label="Resumen (visible para la party)">
                  <textarea style={s.textarea} rows={4} value={form.summary} onChange={f('summary')} placeholder="Qué pasó en esta sesión..." />
                </FL>
                <FL label="Momentos destacados (visible para la party)">
                  <textarea style={s.textarea} rows={3} value={form.highlights} onChange={f('highlights')} placeholder="El crítico de Aurelian, la trampa que evitó Azrael..." />
                </FL>
              </div>
            )}

            {activeSection === 'dm' && (
              <FL label="Notas privadas del DM (nunca visibles para la party)">
                <textarea style={{ ...s.textarea, borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.03)' }} rows={8} value={form.dmNotes} onChange={f('dmNotes')} placeholder="Planes secretos, motivaciones ocultas de los NPCs, ganchos para la próxima sesión, info que la party no debe saber todavía..." />
              </FL>
            )}

            <div style={s.formActions}>
              <button type="button" style={s.cancelBtn} onClick={closeForm}>Cancelar</button>
              <button type="submit" style={s.saveBtn} disabled={saving}>
                {saving ? 'Guardando...' : editing ? '✓ Guardar cambios' : '✦ Crear sesión'}
              </button>
              {!form.visibleToParty && (
                <button type="submit" style={s.publishBtn} disabled={saving} onClick={() => setForm(p => ({ ...p, visibleToParty: true }))}>
                  ↑ Guardar y publicar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* SESSIONS LIST */}
      {loading ? (
        <div style={s.empty}>Cargando sesiones...</div>
      ) : sessions.length === 0 ? (
        <div style={s.empty}>No hay sesiones todavía. Creá la primera.</div>
      ) : (
        <div style={s.list}>
          {sessions.map((sess, idx) => {
            const isExpanded = expanded === sess.id;
            const isPublished = sess.visibleToParty !== false;
            const sessionNum = sessions.length - idx;

            return (
              <div key={sess.id} style={{ ...s.sessCard, ...(isPublished ? s.sessCardPublished : s.sessCardDraft) }}>
                {/* Card header */}
                <div style={s.sessHeader} onClick={() => setExpanded(isExpanded ? null : sess.id)}>
                  <div style={s.sessLeft}>
                    <span style={isPublished ? s.numBadgePublished : s.numBadgeDraft}>
                      {sessionNum}
                    </span>
                    <div>
                      <div style={s.sessTitle}>{sess.title}</div>
                      <div style={s.sessMeta}>
                        {sess.date && <span>{sess.date}</span>}
                        {(sess.xpEarned || sess.xp) > 0 && <span>+{sess.xpEarned || sess.xp} XP</span>}
                        {sess.dmNotes && <span style={s.privateTag}>🔒 Notas privadas</span>}
                      </div>
                    </div>
                  </div>
                  <div style={s.sessRight}>
                    <span style={isPublished ? s.statusPublished : s.statusDraft}>
                      {isPublished ? '✓ Publicada' : '— Borrador'}
                    </span>
                    <span style={s.chevron}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={s.sessBody} className="fade-in">
                    {sess.summary && (
                      <div style={s.sessParagraph}>
                        <div style={s.sessLabel}>Resumen (party)</div>
                        <p style={s.sessText}>{sess.summary}</p>
                      </div>
                    )}
                    {sess.highlights && (
                      <div style={s.sessParagraph}>
                        <div style={s.sessLabel}>Momentos destacados (party)</div>
                        <p style={s.sessText}>{sess.highlights}</p>
                      </div>
                    )}
                    {sess.dmNotes && (
                      <div style={{ ...s.sessParagraph, ...s.dmNoteBox }}>
                        <div style={{ ...s.sessLabel, color: 'var(--gold-2, #c7a242)' }}>🔒 Notas privadas del DM</div>
                        <p style={s.sessText}>{sess.dmNotes}</p>
                      </div>
                    )}
                    <div style={s.sessActions}>
                      <button style={s.editBtn} onClick={() => openEdit(sess)}>✎ Editar</button>
                      <button
                        style={isPublished ? s.unpublishBtn : s.publishBtnInline}
                        onClick={() => toggleVisibility(sess)}
                      >
                        {isPublished ? '↓ Ocultar de party' : '↑ Publicar para party'}
                      </button>
                      <button style={s.deleteBtn} onClick={() => setDeleteConfirm(sess.id)}>✕ Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalTitle}>¿Eliminar esta sesión?</div>
            <p style={s.modalText}>Esta acción no se puede deshacer. La sesión desaparecerá de la vista de la party también.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.deleteConfirmBtn} onClick={() => deleteSess(deleteConfirm)}>Eliminar</button>
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

function StatChip({ label, value, color }) {
  const colors = {
    green: { bg: 'rgba(101,194,96,0.1)', border: 'rgba(101,194,96,0.3)', text: 'var(--green-2, #65c260)' },
    dim: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'var(--text-muted)' },
  };
  const c = colors[color] || { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.25)', text: 'var(--gold-bright)' };
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', color: c.text, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginTop: '2px' }}>{label}</span>
    </div>
  );
}

const s = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  headerStats: { display: 'flex', gap: '10px' },
  newBtn: { background: 'linear-gradient(135deg, var(--gold-bright, #f7dd78), var(--gold-2, #c7a242))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px' },

  // Form
  formCard: { background: 'rgba(18,15,10,0.95)', border: '1px solid rgba(201,168,76,0.25)', borderTop: '2px solid var(--gold-2, #c7a242)', borderRadius: '12px', padding: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', letterSpacing: '2px', color: 'var(--gold-bright)', textTransform: 'uppercase' },
  closeBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '11px', width: '28px', height: '28px', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main, #f4ecd2)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  textarea: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--text-main, #f4ecd2)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6', borderRadius: '4px' },
  visToggleLabel: { display: 'flex', alignItems: 'center', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', color: 'var(--gold-bright)', cursor: 'pointer' },
  visHint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: 'var(--gold-dim)' },
  sectionTabs: { display: 'flex', gap: '8px', marginTop: '8px', marginBottom: '12px' },
  sectionTab: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', transition: 'all 0.2s' },
  sectionTabActive: { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.4)', color: 'var(--gold-bright)' },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid rgba(201,168,76,0.1)' },
  cancelBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  saveBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  publishBtn: { background: 'rgba(101,194,96,0.12)', border: '1px solid rgba(101,194,96,0.4)', color: 'var(--green-2, #65c260)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '9px 18px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },

  // List
  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', padding: '40px 0', textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sessCard: { border: '1px solid', borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s' },
  sessCardPublished: { borderColor: 'rgba(101,194,96,0.25)', background: 'rgba(101,194,96,0.03)' },
  sessCardDraft: { borderColor: 'rgba(201,168,76,0.15)', background: 'rgba(18,15,10,0.6)' },
  sessHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' },
  sessLeft: { display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 },
  numBadgePublished: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(101,194,96,0.15)', border: '1px solid rgba(101,194,96,0.4)', color: 'var(--green-2, #65c260)', fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numBadgeDraft: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sessTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px' },
  sessMeta: { display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' },
  sessMetaItem: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  privateTag: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '0.5px', color: 'rgba(199,162,66,0.5)' },
  sessRight: { display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 },
  statusPublished: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--green-2, #65c260)', textTransform: 'uppercase' },
  statusDraft: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  chevron: { fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold-dim)' },

  // Expanded body
  sessBody: { padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(201,168,76,0.1)' },
  sessParagraph: { paddingTop: '12px' },
  sessLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '6px' },
  sessText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft, #d4c9a7)', lineHeight: '1.7' },
  dmNoteBox: { background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '6px', padding: '12px 14px' },
  sessActions: { display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(201,168,76,0.08)', flexWrap: 'wrap' },
  editBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  publishBtnInline: { background: 'rgba(101,194,96,0.1)', border: '1px solid rgba(101,194,96,0.35)', color: 'var(--green-2, #65c260)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  unpublishBtn: { background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  deleteBtn: { background: 'rgba(239,115,104,0.08)', border: '1px solid rgba(239,115,104,0.25)', color: 'var(--red-1, #ef7368)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', marginLeft: 'auto' },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' },
  modal: { background: 'rgba(18,15,10,0.98)', border: '1px solid rgba(201,168,76,0.3)', borderTop: '2px solid var(--red-1, #ef7368)', padding: '24px', maxWidth: '400px', width: '100%', borderRadius: '12px' },
  modalTitle: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--red-1, #ef7368)', marginBottom: '8px', letterSpacing: '1px' },
  modalText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft)', lineHeight: '1.6' },
  deleteConfirmBtn: { flex: 1, background: 'rgba(239,115,104,0.12)', border: '1px solid rgba(239,115,104,0.4)', color: 'var(--red-1, #ef7368)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '4px' },
};
