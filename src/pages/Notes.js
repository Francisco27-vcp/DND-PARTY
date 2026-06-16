// src/pages/Notes.js
import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Notes({ user }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const username = user.email?.split('@')[0];

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return unsub;
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    await addDoc(collection(db, 'notes'), {
      text: text.trim(),
      author: username,
      email: user.email,
      createdAt: serverTimestamp(),
    });
    setText('');
    setSending(false);
  };

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroLabel}>Party Chat</div>
        <h1 style={s.heroTitle}>NOTAS</h1>
        <p style={s.heroSub}>Mensajes, estrategias y recuerdos de la party</p>
      </div>

      {/* Messages */}
      <div style={s.feed}>
        {notes.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}>📝</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: '#3a2e18', textTransform: 'uppercase' }}>Sin notas todavía</div>
          </div>
        )}
        {notes.map(note => {
          const isMe = note.email === user.email;
          return (
            <div key={note.id} style={{ ...s.bubble, alignSelf: isMe ? 'flex-end' : 'flex-start' }} className="fade-in">
              {!isMe && <div style={s.bubbleAuthor}>{note.author}</div>}
              <div style={{ ...s.bubbleText, background: isMe ? 'rgba(201,168,76,0.12)' : 'rgba(74,127,165,0.1)', borderColor: isMe ? 'rgba(201,168,76,0.25)' : 'rgba(74,127,165,0.2)' }}>
                {note.text}
              </div>
              {note.createdAt && (
                <div style={s.bubbleTime}>
                  {note.createdAt.toDate?.()?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) || ''}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={s.inputBar}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          style={s.input}
          placeholder="Escribí una nota para la party..."
          disabled={sending}
        />
        <button type="submit" style={s.sendBtn} disabled={sending || !text.trim()}>
          {sending ? '...' : '✦'}
        </button>
      </form>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { maxWidth: '700px', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  hero: { textAlign: 'center', padding: '32px 20px 20px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(24px,5vw,36px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#7a6030', marginTop: '6px' },
  feed: { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0 20px', overflowY: 'auto' },
  empty: { textAlign: 'center', padding: '60px 20px', margin: 'auto' },
  bubble: { maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '3px' },
  bubbleAuthor: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase', paddingLeft: '4px' },
  bubbleText: { border: '1px solid', padding: '10px 14px', fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#c8c4bc', lineHeight: '1.6', borderRadius: '2px' },
  bubbleTime: { fontFamily: 'Cinzel,serif', fontSize: '8px', color: '#3a2e18', letterSpacing: '1px', paddingLeft: '4px' },
  inputBar: {
    display: 'flex',
    gap: '8px',
    position: 'sticky',
    bottom: '60px',
    background: 'rgba(8,6,12,0.95)',
    padding: '12px 0',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid rgba(201,168,76,0.1)',
  },
  input: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none' },
  sendBtn: { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '16px', width: '44px', cursor: 'pointer', flexShrink: 0 },
};
