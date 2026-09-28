import React, { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LiveMapCanvas from '../components/LiveMapCanvas';
import '../styles/LiveSession.css';

export default function Projector() {
  const [live, setLive] = useState(null);
  const [combat, setCombat] = useState(null);
  const [latestEvent, setLatestEvent] = useState(null);
  const [connection, setConnection] = useState('connecting');

  useEffect(() => onSnapshot(
    doc(db, 'live_sessions', 'main'),
    { includeMetadataChanges: true },
    snap => {
      setLive(snap.exists() ? snap.data() : null);
      setConnection(snap.metadata.fromCache ? 'offline' : 'online');
    },
    error => {
      console.error('Se perdió la conexión con la mesa:', error);
      setConnection('error');
    },
  ), []);

  useEffect(() => onSnapshot(doc(db, 'combat', 'current'), snap => {
    setCombat(snap.exists() ? snap.data() : null);
  }), []);

  useEffect(() => onSnapshot(
    query(collection(db, 'combat_events'), orderBy('createdAt', 'desc'), limit(1)),
    snap => setLatestEvent(snap.docs.map(item => item.data()).find(event => event.encounterId) || null),
  ), []);

  const participants = [...(combat?.participants || [])].sort(
    (a, b) => (b.initiative - a.initiative) || (a.addedAt - b.addedAt),
  );
  const activeIndex = combat?.currentIndex || 0;

  return (
    <main className="projector-page">
      <header className="projector-header">
        <div>
          <div className="projector-kicker">{live?.active ? 'Sesión en vivo' : 'Mesa preparada'}</div>
          <h1 className="projector-title">{live?.title || live?.mapSnapshot?.title || 'Rakets Party'}</h1>
          {connection !== 'online' && <div className="projector-kicker">{connection === 'offline' ? 'Reconectando…' : connection === 'error' ? 'Conexión interrumpida' : 'Conectando…'}</div>}
        </div>
        <div className="projector-message">{combat?.active && latestEvent?.encounterId === combat?.encounterId ? latestEvent.text : live?.message || 'Esperando indicaciones del Dungeon Master…'}</div>
      </header>

      <section className="projector-map">
        {live?.active ? <LiveMapCanvas map={live?.mapSnapshot || null} /> : <LiveMapCanvas map={null} />}
      </section>

      {live?.active && live?.showCombat && combat?.active && (
        <footer className="projector-combat">
          <span className="projector-round">Ronda {combat.round || 1}</span>
          {participants.map((participant, index) => (
            <span key={participant.id || `${participant.name}-${index}`} className={`projector-turn${index === activeIndex ? ' projector-turn--active' : ''}`}>
              {index === activeIndex ? '◆ ' : ''}{participant.name} · {participant.initiative ?? '—'}
            </span>
          ))}
        </footer>
      )}
    </main>
  );
}
