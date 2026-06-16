// src/pages/Timeline.js
import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CATEGORIES = [
  { id: 'evento', label: 'Evento', color: '#c9a84c', icon: '⚡' },
  { id: 'combate', label: 'Combate', color: '#8b1a1a', icon: '⚔️' },
  { id: 'lore', label: 'Lore', color: '#4a7fa5', icon: '📖' },
  { id: 'npc', label: 'PNJ', color: '#5a8a5a', icon: '👤' },
  { id: 'lugar', label: 'Lugar', color: '#7a5a9a', icon: '🗺️' },
];

export default function Timeline({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', category: 'evento', session: '' });

  const load = async () => {
    const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'timeline'), {
      ...form,
      author: user.email,
      createdAt: serverTimestamp(),
    });
    setForm({ title: '', description: '', category: 'evento', session: '' });
    setAdding(false);
    load();
  };

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);
  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroLabel}>Lore de la Campaña</div>
        <h1 style={s.heroTitle}>HISTORIA</h1>
        <p style={s.heroSub}>Eventos, lugares y personajes del mundo</p>
      </div>

      {/* FILTERS */}
      <div style={s.filters}>
        <button style={{ ...s.filterBtn, ...(filter === 'all' ? s.filterActive : {}) }} onClick={() => setFilter('all')}>Todos</button>
        {CATEGORIES.map(c => (
          <button key={c.id} style={{ ...s.filterBtn, ...(filter === c.id ? { ...s.filterActive, borderColor: c.color, color: c.color } : {}) }} onClick={() => setFilter(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
        <button style={{ ...s.filterBtn, marginLeft: 'auto', borderColor: 'rgba(201,168,76,0.3)', color: '#c9a84c' }} onClick={() => setAdding(!adding)}>
          {adding ? '✕' : '+ Evento'}
        </button>
      </div>

      {/* ADD FORM */}
      {adding && (
        <form onSubmit={submit} style={s.form} className="fade-in">
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
            <textarea style={s.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Detalles del evento..." />
          </div>
          <button type="submit" style={s.submitBtn}>✦ Agregar a la historia</button>
        </form>
      )}

      {/* TIMELINE */}
      {loading
        ? <div style={s.loading}>Cargando historia...</div>
        : filtered.length === 0
          ? <Empty filter={filter} />
          : <div style={s.timeline}>
              {filtered.map((ev, i) => {
                const c = cat(ev.category);
                return (
                  <div key={ev.id} style={s.timelineItem} className="fade-in">
                    {/* Line */}
                    <div style={s.timelineLeft}>
                      <div style={{ ...s.timelineDot, background: c.color, boxShadow: `0 0 8px ${c.color}60` }}>{c.icon}</div>
                      {i < filtered.length - 1 && <div style={s.timelineLine} />}
                    </div>
                    {/* Content */}
                    <div style={s.timelineCard}>
                      <div style={s.timelineHeader}>
                        <span style={{ ...s.catBadge, borderColor: `${c.color}40`, color: c.color }}>{c.label}</span>
                        {ev.session && <span style={s.sessionBadge}>{ev.session}</span>}
                      </div>
                      <div style={s.timelineTitle}>{ev.title}</div>
                      {ev.description && <p style={s.timelineText}>{ev.description}</p>}
                      <div style={s.timelineMeta}>por {ev.author?.split('@')[0]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
      }
      <div style={{ height: '80px' }} />
    </div>
  );
}

function Empty({ filter }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }}>🗺️</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '3px', color: '#3a2e18', textTransform: 'uppercase' }}>
        {filter === 'all' ? 'La historia está por escribirse' : `Sin eventos de tipo "${filter}"`}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '0 16px' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '8px' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center' },
  filterBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.12)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  filterActive: { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.4)', color: '#c9a84c' },
  form: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', borderTop: '2px solid #c9a84c', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%' },
  textarea: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#c8c4bc', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.7' },
  submitBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase', alignSelf: 'flex-start' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '0' },
  timelineItem: { display: 'flex', gap: '16px', paddingBottom: '4px' },
  timelineLeft: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '36px' },
  timelineDot: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 },
  timelineLine: { width: '1px', flex: 1, background: 'rgba(201,168,76,0.12)', margin: '4px 0', minHeight: '20px' },
  timelineCard: { flex: 1, background: 'rgba(15,12,24,0.8)', border: '1px solid rgba(201,168,76,0.1)', padding: '14px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  timelineHeader: { display: 'flex', gap: '8px', alignItems: 'center' },
  catBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', padding: '2px 7px', textTransform: 'uppercase' },
  sessionBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', padding: '2px 7px', border: '1px solid rgba(201,168,76,0.1)' },
  timelineTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '600', color: '#e8c96a' },
  timelineText: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#8a8070', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  timelineMeta: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#3a2e18', textTransform: 'uppercase' },
  loading: { textAlign: 'center', padding: '40px', fontFamily: 'Cinzel,serif', color: '#5a4820', letterSpacing: '2px', fontSize: '10px' },
};
 
