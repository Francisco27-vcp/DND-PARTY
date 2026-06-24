// src/pages/dm/TabAsistente.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ReactMarkdown from 'react-markdown';
import './TabAsistente.css';

// ─── context builder (unchanged) ──────────────────────────────────────────────
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

// ─── ReactMarkdown custom components ──────────────────────────────────────────
const mdComponents = {
  h2:     ({ children }) => <h2     style={md.h}>{children}</h2>,
  h3:     ({ children }) => <h3     style={md.h}>{children}</h3>,
  strong: ({ children }) => <strong style={md.strong}>{children}</strong>,
  p:      ({ children }) => <p      style={md.p}>{children}</p>,
  ul:     ({ children }) => <ul     className="ai-ul">{children}</ul>,
  li:     ({ children }) => <li     className="ai-li">{children}</li>,
};

const md = {
  h:      { fontFamily: "'Cinzel', serif",      color: '#e3c878', fontWeight: 600, fontSize: '14px',   margin: '10px 0 4px', letterSpacing: '0.04em' },
  strong: {                                      color: '#e3c878', fontWeight: 600 },
  p:      { fontFamily: "'Crimson Pro', serif",  color: '#e9ddc2', fontSize: '14.5px', lineHeight: '1.65', marginBottom: '10px', marginTop: 0 },
};

// ─── ThinkingDots ──────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <span className="ta-dots">
      <span className="ta-dot ta-d1" />
      <span className="ta-dot ta-d2" />
      <span className="ta-dot ta-d3" />
    </span>
  );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function TabAsistente() {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions]     = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput]       = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
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

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let fullText  = '';

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
    <div style={s.console}>
      <p style={s.hint}>
        Preguntá sobre reglas de D&D&nbsp;2024, los personajes o la campaña. El contexto de la party y las últimas sesiones ya está incluido.
      </p>

      <div className="ta-thread" style={s.thread} ref={scrollRef}>
        {aiMessages.length === 0 && (
          <div style={s.empty}>¿En qué puedo ayudarte, Dungeon Master?</div>
        )}

        {aiMessages.map((msg, i) => {
          const isLast = i === aiMessages.length - 1;

          if (msg.role === 'user') {
            return (
              <div key={i} style={s.userRow}>
                <div style={s.userBubble}>
                  <span style={s.userLabel}>DM</span>
                  <p style={s.userText}>{msg.text}</p>
                </div>
                <div style={s.sealDM}>
                  <span style={s.sealDMText}>DM</span>
                </div>
              </div>
            );
          }

          return (
            <div key={i} style={s.aiRow}>
              <div style={s.runeAvatar}>
                <div className="ta-pulse" />
              </div>
              <div style={s.aiScroll}>
                <span style={s.aiLabel}>✦ Asistente</span>
                {aiLoading && isLast && !msg.text ? (
                  <div style={s.thinking}>
                    <em style={s.thinkingText}>consultando el manual</em>
                    <ThinkingDots />
                  </div>
                ) : (
                  <div style={s.aiContent}>
                    <ReactMarkdown components={mdComponents}>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={e => { e.preventDefault(); sendToAI(aiInput); }} style={s.footer}>
        <input
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          className="ta-input"
          style={s.input}
          placeholder="Preguntá sobre reglas, estrategias, la campaña..."
          disabled={aiLoading}
        />
        <button
          type="submit"
          className="ta-btn"
          style={s.sendBtn}
          disabled={aiLoading || !aiInput.trim()}
        >
          <span style={s.sendIcon}>→</span> Consultar
        </button>
      </form>
    </div>
  );
}

// ─── palette (kept as JS constants for clarity) ────────────────────────────────
const s = {
  console: {
    background: '#0b0906',
    border: '1px solid #332a1c',
    borderTop: '2px solid #c9a449',
    display: 'flex',
    flexDirection: 'column',
  },
  hint: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: 'italic',
    fontSize: '12px',
    color: '#6e5a2c',
    margin: 0,
    padding: '10px 18px',
    borderBottom: '1px solid #332a1c',
  },
  thread: {
    minHeight: '120px',
    maxHeight: '460px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '20px 18px',
    scrollbarColor: '#332a1c #0b0906',
    scrollbarWidth: 'thin',
  },
  empty: {
    fontFamily: "'Cinzel', serif",
    fontSize: '13px',
    color: '#6e5a2c',
    textAlign: 'center',
    padding: '40px 0',
    letterSpacing: '0.08em',
  },
  // ── user message ──
  userRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  userBubble: {
    maxWidth: '78%',
    background: 'linear-gradient(135deg, #1c1610 0%, #15110a 100%)',
    border: '1px solid #7a4530',
    borderRadius: '4px 12px 12px 12px',
    padding: '10px 14px',
  },
  userLabel: {
    fontFamily: "'Cinzel', serif",
    fontSize: '10px',
    letterSpacing: '0.14em',
    color: '#b8643f',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '5px',
  },
  userText: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '14.5px',
    color: '#e9ddc2',
    lineHeight: '1.65',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  sealDM: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 40% 35%, #b8643f, #7a4530)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
    boxShadow: '0 1px 6px rgba(184,100,63,0.4)',
  },
  sealDMText: {
    fontFamily: "'Cinzel', serif",
    fontSize: '9px',
    fontWeight: 700,
    color: '#e9ddc2',
    letterSpacing: '0.05em',
  },
  // ── AI message ──
  aiRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  runeAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#1c1610',
    border: '1px solid #6e5a2c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  aiScroll: {
    flex: 1,
    maxWidth: '88%',
    background: '#1c1610',
    borderLeft: '2px solid #c9a449',
    borderTop: '1px solid #332a1c',
    borderRight: '1px solid #332a1c',
    borderBottom: '1px solid #332a1c',
    borderRadius: '2px 10px 10px 10px',
    padding: '10px 14px',
  },
  aiLabel: {
    fontFamily: "'Cinzel', serif",
    fontSize: '10px',
    letterSpacing: '0.14em',
    color: '#e3c878',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '8px',
  },
  aiContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  thinking: {
    display: 'flex',
    alignItems: 'center',
  },
  thinkingText: {
    fontFamily: "'Crimson Pro', serif",
    fontStyle: 'italic',
    fontSize: '14px',
    color: '#a99d80',
  },
  // ── footer ──
  footer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'stretch',
    borderTop: '1px solid #332a1c',
    padding: '14px 18px',
    background: '#0b0906',
  },
  input: {
    flex: 1,
    background: '#15110a',
    border: '1px solid #332a1c',
    borderRadius: '4px',
    color: '#e9ddc2',
    fontFamily: "'Crimson Pro', serif",
    fontSize: '14px',
    padding: '10px 14px',
    outline: 'none',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #e3c878, #c9a449)',
    border: 'none',
    borderRadius: '4px',
    color: '#1a1206',
    fontFamily: "'Cinzel', serif",
    fontSize: '11.5px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    padding: '10px 20px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  sendIcon: {
    fontSize: '14px',
    lineHeight: 1,
  },
};
