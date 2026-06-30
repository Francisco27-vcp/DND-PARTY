// src/pages/Timeline.js
import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CATEGORIES = [
  { id: 'evento',  label: 'Evento',  color: '#c9a84c', icon: '⚡' },
  { id: 'combate', label: 'Combate', color: '#8b1a1a', icon: '⚔️' },
  { id: 'lore',    label: 'Lore',    color: '#4a7fa5', icon: '📖' },
  { id: 'npc',     label: 'PNJ',     color: '#5a8a5a', icon: '👤' },
  { id: 'lugar',   label: 'Lugar',   color: '#7a5a9a', icon: '🗺️' },
];

export default function Timeline({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Solo mostrar eventos publicados por el DM
      setEvents(all.filter(e => e.visibleToParty !== false));
      setLoading(false);
    };
    load();
  }, []);

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
        <button style={{ ...s.filterBtn, ...(filter === 'all' ? s.filterActive : {}) }} onClick={() => setFilter('all')}>
          Todos
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            style={{ ...s.filterBtn, ...(filter === c.id ? { ...s.filterActive, borderColor: c.color, color: c.color } : {}) }}
            onClick={() => setFilter(c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
        <div style={s.hint}>Los eventos los publica el DM desde su panel</div>
      </div>

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
                    <div style={s.timelineLeft}>
                      <div style={{ ...s.timelineDot, background: c.color, boxShadow: `0 0 8px ${c.color}60` }}>{c.icon}</div>
                      {i < filtered.length - 1 && <div style={s.timelineLine} />}
                    </div>
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
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '3px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>
        {filter === 'all' ? 'La historia está por escribirse' : `Sin eventos de tipo "${filter}"`}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '0 16px' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: 'var(--gold-bright)', textShadow: '0 0 30px rgba(227,200,120,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', marginTop: '8px' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', alignItems: 'center' },
  filterBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase' },
  filterActive: { background: 'rgba(201,164,73,0.1)', borderColor: 'var(--gold-dim)', color: 'var(--gold)' },
  hint: { marginLeft: 'auto', fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: 'var(--gold-dim)', opacity: 0.6 },
  timeline: { display: 'flex', flexDirection: 'column', gap: '0' },
  timelineItem: { display: 'flex', gap: '16px', paddingBottom: '4px' },
  timelineLeft: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '36px' },
  timelineDot: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 },
  timelineLine: { width: '1px', flex: 1, background: 'var(--line)', margin: '4px 0', minHeight: '20px' },
  timelineCard: { flex: 1, background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  timelineHeader: { display: 'flex', gap: '8px', alignItems: 'center' },
  catBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', padding: '2px 7px', textTransform: 'uppercase' },
  sessionBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', padding: '2px 7px', border: '1px solid var(--line)' },
  timelineTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '600', color: 'var(--gold-bright)' },
  timelineText: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
  timelineMeta: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  loading: { textAlign: 'center', padding: '40px', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '2px', fontSize: '10px' },
};
