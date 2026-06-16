// src/pages/Campaign.js
import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Campaign({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', summary: '', highlights: '', xpEarned: '' });

  const load = async () => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'sessions'), {
      ...form,
      xpEarned: parseInt(form.xpEarned) || 0,
      author: user.email,
      createdAt: serverTimestamp(),
    });
    setForm({ title: '', date: '', summary: '', highlights: '', xpEarned: '' });
    setAdding(false);
    load();
  };

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroLabel}>Registro Oficial</div>
        <h1 style={s.heroTitle}>CAMPAÑA</h1>
        <p style={s.heroSub}>Historia de la party · Sesión por sesión</p>
      </div>

      <div style={s.toolbar}>
        <div style={s.count}>{sessions.length} sesiones registradas</div>
        <button style={s.addBtn} onClick={() => setAdding(!adding)}>
          {adding ? '✕ Cancelar' : '+ Nueva sesión'}
        </button>
      </div>

      {/* ADD FORM */}
      {adding && (
        <form onSubmit={submit} style={s.form} className="fade-in">
          <div style={s.formTitle}>Nueva Sesión</div>
          <div style={s.formGrid}>
            <Field label="Título" required>
              <input style={s.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="El ataque al castillo..." required />
            </Field>
            <Field label="Fecha">
              <input type="date" style={s.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="XP ganada" style={{ gridColumn: 'span 1' }}>
              <input type="number" style={s.input} value={form.xpEarned} onChange={e => setForm(f => ({ ...f, xpEarned: e.target.value }))} placeholder="250" />
            </Field>
          </div>
          <Field label="Resumen de la sesión">
            <textarea style={s.textarea} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Qué pasó en esta sesión..." rows={4} />
          </Field>
          <Field label="Momentos destacados">
            <textarea style={s.textarea} value={form.highlights} onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))} placeholder="El golpe crítico de Aurelian, la canción de Azrael que paralizó al guardia..." rows={3} />
          </Field>
          <button type="submit" style={s.submitBtn}>✦ Guardar sesión</button>
        </form>
      )}

      {/* SESSIONS LIST */}
      {loading
        ? <div style={s.loading}>Cargando sesiones...</div>
        : sessions.length === 0
          ? <Empty />
          : <div style={s.list}>
              {sessions.map((sess, i) => (
                <SessionCard key={sess.id} sess={sess} number={sessions.length - i} />
              ))}
            </div>
      }
      <div style={{ height: '80px' }} />
    </div>
  );
}

function SessionCard({ sess, number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={s.card} className="fade-in">
      <div style={s.cardHeader} onClick={() => setOpen(!open)}>
        <div style={s.cardNum}>S{String(number).padStart(2, '0')}</div>
        <div style={{ flex: 1 }}>
          <div style={s.cardTitle}>{sess.title}</div>
          <div style={s.cardMeta}>
            {sess.date && <span>{sess.date}</span>}
            {sess.xpEarned > 0 && <span style={{ color: '#c9a84c' }}>+{sess.xpEarned} XP</span>}
            <span style={{ color: '#3a2e18' }}>por {sess.author?.split('@')[0]}</span>
          </div>
        </div>
        <div style={{ color: '#5a4820', fontSize: '16px' }}>{open ? '▲' : '▼'}</div>
      </div>
      {open && (
        <div style={s.cardBody} className="fade-in">
          {sess.summary && (
            <div style={s.cardSection}>
              <div style={s.cardSectionLabel}>Resumen</div>
              <p style={s.cardText}>{sess.summary}</p>
            </div>
          )}
          {sess.highlights && (
            <div style={s.cardSection}>
              <div style={s.cardSectionLabel}>✦ Momentos destacados</div>
              <p style={{ ...s.cardText, color: '#c9a84c' }}>{sess.highlights}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
      <label style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }}>📜</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '3px', color: '#3a2e18', textTransform: 'uppercase' }}>Ninguna sesión registrada aún</div>
      <div style={{ fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#2a2018', marginTop: '8px' }}>La historia está por escribirse</div>
    </div>
  );
}

const s = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '0 16px' },
  hero: { textAlign: 'center', padding: '40px 20px 24px', position: 'relative' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '8px' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  count: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase' },
  addBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  form: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', borderTop: '2px solid #c9a84c', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '3px', color: '#c9a84c', textTransform: 'uppercase' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%' },
  textarea: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#c8c4bc', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.7' },
  submitBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px', cursor: 'pointer', textTransform: 'uppercase', alignSelf: 'flex-start' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { background: 'rgba(15,12,24,0.85)', border: '1px solid rgba(201,168,76,0.12)', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', cursor: 'pointer' },
  cardNum: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', color: '#7a6030', letterSpacing: '1px', minWidth: '32px' },
  cardTitle: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '600', color: '#e8c96a' },
  cardMeta: { display: 'flex', gap: '12px', marginTop: '3px', fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#5a4820' },
  cardBody: { padding: '0 16px 16px', borderTop: '1px solid rgba(201,168,76,0.08)', display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '14px' },
  cardSection: { display: 'flex', flexDirection: 'column', gap: '6px' },
  cardSectionLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  cardText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#9a9080', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  loading: { textAlign: 'center', padding: '40px', fontFamily: 'Cinzel,serif', color: '#5a4820', letterSpacing: '2px', fontSize: '10px' },
};
