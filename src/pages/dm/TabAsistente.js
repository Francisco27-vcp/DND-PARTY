// src/pages/dm/TabAsistente.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

function buildSystemPrompt(characters, sessions) {
  const charList = characters.length
    ? characters.map(c =>
        `- ${c.name} (${c.race} ${c.class}${c.subclass ? `/${c.subclass}` : ''}, Lv${c.level}): PG ${c.hp ?? '?'}/${c.hpMax ?? '?'}, CA ${c.ac ?? '?'}, XP ${(c.xp || 0).toLocaleString()}. Jugador: ${c.player || c.ownerEmail || 'desconocido'}. Condiciones: ${c.conditions || 'ninguna'}.`
      ).join('\n')
    : 'Sin personajes registrados.';

  const sessionList = sessions.length
    ? sessions.map(s =>
        `- Sesión "${s.title || 'Sin título'}" (${s.date || 'fecha desconocida'}): ${s.summary || s.highlights || 'Sin resumen.'}`
      ).join('\n')
    : 'Sin sesiones registradas.';

  return `Sos el asistente IA del Dungeon Master de una campaña de D&D 2024 (5th Edition revisada).

PARTY ACTUAL:
${charList}

ÚLTIMAS SESIONES (más recientes primero):
${sessionList}

Podés responder preguntas sobre reglas de D&D 2024, los personajes y la campaña actual, consejos tácticos y narrativos para el DM, monstruos, hechizos y objetos mágicos. Respondé siempre en español. Sé conciso pero completo. Si no sabés algo con certeza, indicalo.`;
}

export default function TabAsistente() {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [charSnap, sesSnap] = await Promise.all([
        getDocs(collection(db, 'characters')),
        getDocs(query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(5))),
      ]);
      setCharacters(charSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSessions(sesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [aiMessages]);

  const sendToAI = async (userMessage) => {
    if (!userMessage.trim() || aiLoading) return;

    const prevMessages = [...aiMessages, { role: 'user', text: userMessage }];
    setAiMessages([...prevMessages, { role: 'ai', text: '' }]);
    setAiInput('');
    setAiLoading(true);

    const apiMessages = prevMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: buildSystemPrompt(characters, sessions),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setAiMessages(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'ai', text: `Error ${res.status}: ${errData.error?.message || errData.error || 'Error desconocido.'}` };
          return u;
        });
        setAiLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              fullText += parsed.delta.text;
              setAiMessages(prev => {
                const u = [...prev];
                u[u.length - 1] = { role: 'ai', text: fullText };
                return u;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
      setAiMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: 'ai', text: 'Error al conectar con el asistente. Verificá tu conexión y la API key.' };
        return u;
      });
    }
    setAiLoading(false);
  };

  return (
    <div style={s.box}>
      <div style={s.hint}>Preguntá sobre reglas de D&D 2024, los personajes o la campaña. El contexto de la party y las últimas sesiones ya está incluido.</div>

      <div style={s.chat} ref={scrollRef}>
        {aiMessages.length === 0 && (
          <div style={s.empty}>¿En qué puedo ayudarte, Dungeon Master?</div>
        )}
        {aiMessages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? s.userMsg : s.aiMsg}>
            <span style={msg.role === 'user' ? s.userLabel : s.aiLabel}>
              {msg.role === 'user' ? 'DM' : '✦ Asistente'}
            </span>
            <p style={s.msgText}>
              {msg.text || (aiLoading && i === aiMessages.length - 1 ? '▌' : '')}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); sendToAI(aiInput); }} style={s.form}>
        <input
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          style={s.input}
          placeholder="Preguntá sobre reglas, estrategias, la campaña..."
          disabled={aiLoading}
        />
        <button type="submit" style={s.sendBtn} disabled={aiLoading || !aiInput.trim()}>
          {aiLoading ? '...' : 'Consultar'}
        </button>
      </form>
    </div>
  );
}

const s = {
  box: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18' },
  chat: { minHeight: '80px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', textAlign: 'center', padding: '24px 0' },
  userMsg: { alignSelf: 'flex-end', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', padding: '10px 14px', maxWidth: '80%' },
  aiMsg: { alignSelf: 'flex-start', background: 'rgba(8,6,12,0.6)', border: '1px solid rgba(201,168,76,0.06)', padding: '10px 14px', maxWidth: '88%' },
  userLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#c9a84c', textTransform: 'uppercase', display: 'block', marginBottom: '5px' },
  aiLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase', display: 'block', marginBottom: '5px' },
  msgText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#f5f0e8', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' },
  form: { display: 'flex', gap: '10px', alignItems: 'stretch', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '14px' },
  input: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px 14px', outline: 'none' },
  sendBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase' },
};
