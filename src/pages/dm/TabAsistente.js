// src/pages/dm/TabAsistente.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, query, orderBy, limit,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ReactMarkdown from 'react-markdown';
import './TabAsistente.css';

// ─── system prompt for chat mode ──────────────────────────────────────────────
function buildChatPrompt(characters, sessions) {
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

Podés responder preguntas sobre reglas de D&D 2024, los personajes y la campaña actual, consejos tácticos y narrativos para el DM, monstruos, hechizos y objetos mágicos. Respondé siempre en español. Sé conciso pero completo.`;
}

// ─── system prompt for generate mode ──────────────────────────────────────────
const GENERATE_PROMPT = `Sos el asistente de un DM de D&D 5e. A partir de la descripción de una sesión, extraé datos estructurados.

REGLAS CRÍTICAS DE FORMATO:
- Respondé ÚNICAMENTE con JSON válido en UNA SOLA LÍNEA CONTINUA.
- NUNCA uses saltos de línea dentro de los valores de string.
- NUNCA uses comillas dobles dentro de los valores. Si el texto contiene diálogos o citas, parafraseá en tercera persona, nunca copies las comillas literalmente.
- Sin bloques de código markdown, sin texto antes o después del JSON.

Formato (todo en una línea):
{"session":{"title":"string","date":"string o vacío","xpEarned":0,"summary":"string sin saltos de línea","highlights":"momento1, momento2, momento3"},"npcs":[{"name":"string","tipo":"antagonista|aliado|party_temporal|situacional|neutro","race":"string","role":"string","motivation":"string","visibleToPlayers":false}],"timeline":[{"title":"string","category":"evento|combate|lore|npc|lugar","description":"string sin saltos de línea","visibleToParty":false}]}

Reglas de contenido:
- Extraé SOLO lo mencionado explícitamente. No inventes datos.
- NPCs: solo personajes con nombre propio. Si no hay, npcs:[].
- Timeline: máximo 4 eventos. Si no hay nada notable, timeline:[].
- xpEarned: número, 0 si no se menciona.
- Todos los strings en español, sin saltos de línea literales.
- Nunca copies diálogos textuales del input. Si hay frases entre comillas, descríbelas en tercera persona.`;

// ─── MD components ─────────────────────────────────────────────────────────────
const mdComponents = {
  h2:     ({ children }) => <h2     style={md.h}>{children}</h2>,
  h3:     ({ children }) => <h3     style={md.h}>{children}</h3>,
  strong: ({ children }) => <strong style={md.strong}>{children}</strong>,
  p:      ({ children }) => <p      style={md.p}>{children}</p>,
  ul:     ({ children }) => <ul     className="ai-ul">{children}</ul>,
  li:     ({ children }) => <li     className="ai-li">{children}</li>,
};
const md = {
  h:      { fontFamily: "'Cinzel', serif", color: '#e3c878', fontWeight: 600, fontSize: '14px', margin: '10px 0 4px', letterSpacing: '0.04em' },
  strong: { color: '#e3c878', fontWeight: 600 },
  p:      { fontFamily: "'Crimson Pro', serif", color: '#e9ddc2', fontSize: '14.5px', lineHeight: '1.65', marginBottom: '10px', marginTop: 0 },
};

function ThinkingDots() {
  return (
    <span className="ta-dots">
      <span className="ta-dot ta-d1" />
      <span className="ta-dot ta-d2" />
      <span className="ta-dot ta-d3" />
    </span>
  );
}

// ─── NPC tipo colors ───────────────────────────────────────────────────────────
const TIPO_COLOR = {
  antagonista:   '#ef7368',
  aliado:        '#65c260',
  party_temporal:'#f7dd78',
  situacional:   '#86d4ff',
  neutro:        '#9d9275',
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function TabAsistente({ user }) {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions]     = useState([]);
  const [mode, setMode]             = useState('chat'); // 'chat' | 'generar'

  // Chat state — persisted in localStorage
  const [aiMessages, setAiMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('dm_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [aiInput, setAiInput]       = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const scrollRef = useRef(null);

  // Persist messages on every change
  useEffect(() => {
    try { localStorage.setItem('dm_chat_history', JSON.stringify(aiMessages)); } catch {}
  }, [aiMessages]);

  // Generate state
  const [genInput, setGenInput]     = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [generated, setGenerated]   = useState(null);   // { session, npcs, timeline }
  const [genError, setGenError]     = useState('');
  const [selections, setSelections] = useState({ session: true, npcs: [], timeline: [] });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

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

  // ── CHAT ──────────────────────────────────────────────────────────────────────
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
          systemPrompt: buildChatPrompt(characters, sessions),
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
      let buffer = '', fullText = '';

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
        u[u.length - 1] = { role: 'ai', text: 'Error al conectar con el asistente.' };
        return u;
      });
    }
    setAiLoading(false);
  };

  // ── GENERATE ──────────────────────────────────────────────────────────────────
  const generateSession = async () => {
    if (!genInput.trim() || genLoading) return;
    setGenLoading(true);
    setGenError('');
    setGenerated(null);
    setSaved(false);

    // Sanitize input: replace any quote characters with apostrophes so the AI
    // won't accidentally reproduce them as unescaped quotes inside JSON string values.
    const safeInput = genInput
      .replace(/[""«»]/g, "'")
      .replace(/"/g, "'");

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: safeInput }],
          systemPrompt: GENERATE_PROMPT,
          skipRAG: true,
          maxTokens: 2048,
        }),
      });

      if (!res.ok) {
        setGenError(`Error ${res.status} al contactar la IA.`);
        setGenLoading(false);
        return;
      }

      // Collect full streamed response
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', fullText = '';

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
            }
          } catch {}
        }
      }

      // Parse JSON from response — multi-strategy robust handling
      try {
        // 1. Strip markdown fences and normalize typographic quotes
        let clean = fullText
          .replace(/```json\s*/gi, ‘’).replace(/```\s*/g, ‘’).trim()
          .replace(/[“”]/g, ‘”’).replace(/[‘’]/g, “’”);

        // 2. Extract the outermost JSON block
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) {
          setGenError(‘La IA no devolvió JSON válido. Intentá con una descripción más corta o simple.’);
          setGenLoading(false);
          return;
        }

        let jsonStr = match[0];
        let data;

        // Strategy A: parse as-is (handles pretty-printed JSON fine)
        try {
          data = JSON.parse(jsonStr);
        } catch {
          // Strategy B: state-machine with lookahead heuristic.
          // Handles:
          //   1. Unescaped newlines/tabs inside strings → replace with space
          //   2. Unescaped double quotes inside strings → escape as \”
          //      Heuristic: a “ that closes a string must be followed (after
          //      optional whitespace) by , : } ] or end-of-input. If the next
          //      non-whitespace char is anything else, the “ is embedded and
          //      gets escaped instead.
          let fixed = ‘’;
          let inStr = false;
          let esc = false;
          for (let i = 0; i < jsonStr.length; i++) {
            const ch = jsonStr[i];
            if (esc) { fixed += ch; esc = false; continue; }
            if (ch === ‘\\’) { esc = true; fixed += ch; continue; }
            // Control chars: handle based on context
            if (ch === ‘\n’ || ch === ‘\r’ || ch === ‘\t’) {
              fixed += inStr ? ‘ ‘ : ch; continue;
            }
            if (ch === ‘”’) {
              if (!inStr) {
                inStr = true; fixed += ch; continue;
              }
              // Inside a string: check if this “ is a valid terminator or embedded.
              let j = i + 1;
              while (j < jsonStr.length && (jsonStr[j] === ‘ ‘ || jsonStr[j] === ‘\t’)) j++;
              const nxt = jsonStr[j];
              const isTerminator = !nxt || nxt === ‘,’ || nxt === ‘:’ || nxt === ‘}’ || nxt === ‘]’ || nxt === ‘\n’ || nxt === ‘\r’;
              if (isTerminator) {
                inStr = false; fixed += ch;
              } else {
                fixed += ‘\\”’; // escape the embedded quote
              }
              continue;
            }
            fixed += ch;
          }
          data = JSON.parse(fixed);
        }

        setGenerated(data);
        setSelections({
          session: true,
          npcs: (data.npcs || []).map((_, i) => i),
          timeline: (data.timeline || []).map((_, i) => i),
        });
      } catch (parseErr) {
        console.error(‘Parse error:’, parseErr, ‘\nRaw response:’, fullText);
        setGenError(`Error al interpretar la respuesta (${parseErr.message}). Intentá de nuevo.`);
      }
    } catch (err) {
      console.error(err);
      setGenError('Error de conexión con la IA. Verificá tu conexión e intentá de nuevo.');
    }
    setGenLoading(false);
  };

  const toggleNpc = (i) => setSelections(s => ({
    ...s, npcs: s.npcs.includes(i) ? s.npcs.filter(x => x !== i) : [...s.npcs, i],
  }));

  const toggleEvent = (i) => setSelections(s => ({
    ...s, timeline: s.timeline.includes(i) ? s.timeline.filter(x => x !== i) : [...s.timeline, i],
  }));

  const saveAll = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const email = user?.email || 'dm';
      const batch = [];

      if (selections.session && generated.session) {
        batch.push(addDoc(collection(db, 'sessions'), {
          ...generated.session,
          visibleToParty: false,
          author: email,
          createdAt: serverTimestamp(),
        }));
      }

      for (const i of selections.npcs) {
        const npc = generated.npcs[i];
        if (npc) batch.push(addDoc(collection(db, 'npcs'), {
          ...npc,
          author: email,
          createdAt: serverTimestamp(),
        }));
      }

      for (const i of selections.timeline) {
        const ev = generated.timeline[i];
        if (ev) batch.push(addDoc(collection(db, 'timeline'), {
          ...ev,
          author: email,
          createdAt: serverTimestamp(),
        }));
      }

      await Promise.all(batch);
      setSaved(true);
      setGenerated(null);
      setGenInput('');
      loadData();
    } catch (err) {
      console.error(err);
      setGenError('Error al guardar en Firestore.');
    }
    setSaving(false);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>

      {/* ── MODE TOGGLE ── */}
      <div style={s.modeBar}>
        <button
          style={{ ...s.modeBtn, ...(mode === 'chat' ? s.modeBtnActive : {}) }}
          onClick={() => setMode('chat')}
        >
          💬 Chat libre
        </button>
        <button
          style={{ ...s.modeBtn, ...(mode === 'generar' ? s.modeBtnActive : {}) }}
          onClick={() => setMode('generar')}
        >
          ✦ Generar sesión
        </button>
        <span style={s.modeHint}>
          {mode === 'chat'
            ? 'Preguntá sobre reglas, estrategias o la campaña'
            : 'Describí la sesión y la IA genera los datos estructurados'}
        </span>
        {mode === 'chat' && aiMessages.length > 0 && (
          <button
            style={s.clearBtn}
            onClick={() => { setAiMessages([]); localStorage.removeItem('dm_chat_history'); }}
          >
            🗑 Limpiar
          </button>
        )}
      </div>

      {/* ══════════════ CHAT MODE ══════════════ */}
      {mode === 'chat' && (
        <div style={s.console}>
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
                    <div style={s.sealDM}><span style={s.sealDMText}>DM</span></div>
                  </div>
                );
              }
              return (
                <div key={i} style={s.aiRow}>
                  <div style={s.runeAvatar}><div className="ta-pulse" /></div>
                  <div style={s.aiScroll}>
                    <span style={s.aiLabel}>✦ Asistente</span>
                    {aiLoading && isLast && !msg.text
                      ? <div style={s.thinking}><em style={s.thinkingText}>consultando el manual</em><ThinkingDots /></div>
                      : <div style={s.aiContent}><ReactMarkdown components={mdComponents}>{msg.text}</ReactMarkdown></div>
                    }
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={e => { e.preventDefault(); sendToAI(aiInput); }} style={s.footer}>
            <input
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              className="ta-input" style={s.input}
              placeholder="Preguntá sobre reglas, estrategias, la campaña..."
              disabled={aiLoading}
            />
            <button type="submit" className="ta-btn" style={s.sendBtn} disabled={aiLoading || !aiInput.trim()}>
              <span style={s.sendIcon}>→</span> Consultar
            </button>
          </form>
        </div>
      )}

      {/* ══════════════ GENERATE MODE ══════════════ */}
      {mode === 'generar' && (
        <div style={s.genWrap}>

          {/* Input area */}
          <div style={s.genInputArea}>
            <label style={s.genLabel}>Describí lo que pasó en la sesión</label>
            <textarea
              style={s.genTextarea}
              value={genInput}
              onChange={e => setGenInput(e.target.value)}
              placeholder={`Ej: "En la sesión de hoy la party llegó a la ciudad de Valdemar. Combatieron contra un grupo de mercenarios liderados por Kara Voss (antagonista, humana). Aurelian sacó un golpe crítico que dejó KO a Kara. Ganaron 400 XP. También conocieron a Silas, un informante neutral que les dará info del mapa. El evento principal fue la Emboscada en el Mercado."`}
              rows={5}
              disabled={genLoading}
            />
            <button
              style={{ ...s.genBtn, opacity: genLoading || !genInput.trim() ? 0.5 : 1 }}
              onClick={generateSession}
              disabled={genLoading || !genInput.trim()}
            >
              {genLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <em style={{ fontStyle: 'italic', fontFamily: 'Crimson Pro,serif', fontSize: '13px' }}>generando</em>
                  <ThinkingDots />
                </span>
              ) : '✦ Generar desde descripción'}
            </button>
            {genError && <div style={s.genError}>{genError}</div>}
          </div>

          {/* Saved banner */}
          {saved && (
            <div style={s.savedBanner} className="fade-in">
              ✓ Guardado. Los ítems están en Sesiones, Mundo e Historia como borradores — publicálos cuando estés listo.
            </div>
          )}

          {/* Preview */}
          {generated && (
            <div style={s.preview} className="fade-in">
              <div style={s.previewTitle}>Vista previa — seleccioná qué guardar</div>

              {/* Session */}
              {generated.session && (
                <PreviewCard
                  icon="📜"
                  label="Sesión"
                  color="var(--gold)"
                  checked={selections.session}
                  onToggle={() => setSelections(s => ({ ...s, session: !s.session }))}
                >
                  <div style={s.prevField}><span style={s.prevKey}>Título</span><span style={s.prevVal}>{generated.session.title}</span></div>
                  {generated.session.date && <div style={s.prevField}><span style={s.prevKey}>Fecha</span><span style={s.prevVal}>{generated.session.date}</span></div>}
                  {generated.session.xpEarned > 0 && <div style={s.prevField}><span style={s.prevKey}>XP</span><span style={{ ...s.prevVal, color: 'var(--gold)' }}>+{generated.session.xpEarned}</span></div>}
                  <div style={s.prevField}><span style={s.prevKey}>Resumen</span><span style={s.prevVal}>{generated.session.summary}</span></div>
                  {generated.session.highlights && <div style={s.prevField}><span style={s.prevKey}>Destacados</span><span style={s.prevVal}>{generated.session.highlights}</span></div>}
                  <div style={s.prevHint}>Se guardará como borrador — publicala desde la tab Sesiones</div>
                </PreviewCard>
              )}

              {/* NPCs */}
              {(generated.npcs || []).length > 0 && (
                <div>
                  <div style={s.prevSectionLabel}>NPCs detectados</div>
                  {generated.npcs.map((npc, i) => (
                    <PreviewCard
                      key={i}
                      icon="👤"
                      label={npc.name}
                      color={TIPO_COLOR[npc.tipo] || 'var(--gold-dim)'}
                      checked={selections.npcs.includes(i)}
                      onToggle={() => toggleNpc(i)}
                    >
                      <div style={s.prevField}><span style={s.prevKey}>Tipo</span><span style={{ ...s.prevVal, color: TIPO_COLOR[npc.tipo] || 'var(--gold-dim)', textTransform: 'capitalize' }}>{npc.tipo?.replace('_', ' ')}</span></div>
                      {npc.race && <div style={s.prevField}><span style={s.prevKey}>Raza</span><span style={s.prevVal}>{npc.race}</span></div>}
                      {npc.role && <div style={s.prevField}><span style={s.prevKey}>Rol</span><span style={s.prevVal}>{npc.role}</span></div>}
                      {npc.motivation && <div style={s.prevField}><span style={s.prevKey}>Motivación</span><span style={s.prevVal}>{npc.motivation}</span></div>}
                      <div style={s.prevHint}>Se guardará como oculto a la party</div>
                    </PreviewCard>
                  ))}
                </div>
              )}

              {/* Timeline */}
              {(generated.timeline || []).length > 0 && (
                <div>
                  <div style={s.prevSectionLabel}>Eventos de historia</div>
                  {generated.timeline.map((ev, i) => (
                    <PreviewCard
                      key={i}
                      icon="⚡"
                      label={ev.title}
                      color="#c9a84c"
                      checked={selections.timeline.includes(i)}
                      onToggle={() => toggleEvent(i)}
                    >
                      <div style={s.prevField}><span style={s.prevKey}>Categoría</span><span style={s.prevVal}>{ev.category}</span></div>
                      {ev.description && <div style={s.prevField}><span style={s.prevKey}>Descripción</span><span style={s.prevVal}>{ev.description}</span></div>}
                      <div style={s.prevHint}>Se guardará como borrador — publicalo desde Historia</div>
                    </PreviewCard>
                  ))}
                </div>
              )}

              {/* Save button */}
              <button
                style={{ ...s.saveAllBtn, opacity: saving ? 0.6 : 1 }}
                onClick={saveAll}
                disabled={saving || (!selections.session && selections.npcs.length === 0 && selections.timeline.length === 0)}
              >
                {saving ? 'Guardando...' : `✦ Guardar seleccionados en campaña`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PreviewCard ───────────────────────────────────────────────────────────────
function PreviewCard({ icon, label, color, checked, onToggle, children }) {
  return (
    <div style={{
      background: 'var(--panel)', border: `1px solid var(--line)`,
      borderLeft: `3px solid ${checked ? color : 'var(--line)'}`,
      padding: '14px 16px', marginBottom: '8px', opacity: checked ? 1 : 0.5,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <input
          type="checkbox" checked={checked} onChange={onToggle}
          style={{ accentColor: 'var(--gold)', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: checked ? color : 'var(--gold-dim)' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────
const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0' },

  // Mode bar
  modeBar: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap',
  },
  modeBtn: {
    background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)',
    fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px',
    padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase',
  },
  modeBtnActive: {
    background: 'rgba(201,168,76,0.1)', borderColor: 'var(--gold-dim)', color: 'var(--gold)',
  },
  modeHint: {
    fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px',
    color: 'var(--gold-dim)', marginLeft: '8px',
  },
  clearBtn: {
    marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(239,115,104,0.3)',
    color: 'rgba(239,115,104,0.7)', fontFamily: 'Cinzel,serif', fontSize: '9px',
    letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },

  // ── Chat ──
  console: {
    background: '#0b0906', border: '1px solid #332a1c', borderTop: '2px solid #c9a449',
    display: 'flex', flexDirection: 'column',
  },
  thread: {
    minHeight: '120px', maxHeight: '460px', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '20px',
    padding: '20px 18px', scrollbarColor: '#332a1c #0b0906', scrollbarWidth: 'thin',
  },
  empty: {
    fontFamily: "'Cinzel', serif", fontSize: '13px', color: '#6e5a2c',
    textAlign: 'center', padding: '40px 0', letterSpacing: '0.08em',
  },
  userRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '10px' },
  userBubble: {
    maxWidth: '78%', background: 'linear-gradient(135deg, #1c1610 0%, #15110a 100%)',
    border: '1px solid #7a4530', borderRadius: '4px 12px 12px 12px', padding: '10px 14px',
  },
  userLabel: { fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '0.14em', color: '#b8643f', textTransform: 'uppercase', display: 'block', marginBottom: '5px' },
  userText: { fontFamily: "'Crimson Pro', serif", fontSize: '14.5px', color: '#e9ddc2', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' },
  sealDM: { width: '34px', height: '34px', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #b8643f, #7a4530)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', boxShadow: '0 1px 6px rgba(184,100,63,0.4)' },
  sealDMText: { fontFamily: "'Cinzel', serif", fontSize: '9px', fontWeight: 700, color: '#e9ddc2', letterSpacing: '0.05em' },
  aiRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  runeAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: '#1c1610', border: '1px solid #6e5a2c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' },
  aiScroll: { flex: 1, maxWidth: '88%', background: '#1c1610', borderLeft: '2px solid #c9a449', borderTop: '1px solid #332a1c', borderRight: '1px solid #332a1c', borderBottom: '1px solid #332a1c', borderRadius: '2px 10px 10px 10px', padding: '10px 14px' },
  aiLabel: { fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '0.14em', color: '#e3c878', textTransform: 'uppercase', display: 'block', marginBottom: '8px' },
  aiContent: { display: 'flex', flexDirection: 'column', gap: '2px' },
  thinking: { display: 'flex', alignItems: 'center' },
  thinkingText: { fontFamily: "'Crimson Pro', serif", fontStyle: 'italic', fontSize: '14px', color: '#a99d80' },
  footer: { display: 'flex', gap: '10px', alignItems: 'stretch', borderTop: '1px solid #332a1c', padding: '14px 18px', background: '#0b0906' },
  input: { flex: 1, background: '#15110a', border: '1px solid #332a1c', borderRadius: '4px', color: '#e9ddc2', fontFamily: "'Crimson Pro', serif", fontSize: '14px', padding: '10px 14px', outline: 'none' },
  sendBtn: { background: 'linear-gradient(135deg, #e3c878, #c9a449)', border: 'none', borderRadius: '4px', color: '#1a1206', fontFamily: "'Cinzel', serif", fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.1em', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' },
  sendIcon: { fontSize: '14px', lineHeight: 1 },

  // ── Generate ──
  genWrap: { display: 'flex', flexDirection: 'column', gap: '20px' },
  genInputArea: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  genLabel: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' },
  genTextarea: {
    background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)',
    fontFamily: 'Crimson Pro,serif', fontSize: '14px', lineHeight: '1.7',
    padding: '12px', resize: 'vertical', outline: 'none', width: '100%',
  },
  genBtn: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
    border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '11px',
    letterSpacing: '2px', padding: '12px 24px', cursor: 'pointer', textTransform: 'uppercase',
    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px',
  },
  genError: {
    fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#ef7368',
    padding: '8px 12px', background: 'rgba(239,115,104,0.08)', border: '1px solid rgba(239,115,104,0.3)',
  },
  savedBanner: {
    fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#65c260',
    textTransform: 'uppercase', padding: '14px 18px',
    background: 'rgba(101,194,96,0.08)', border: '1px solid rgba(101,194,96,0.3)',
  },

  // Preview
  preview: { display: 'flex', flexDirection: 'column', gap: '8px' },
  previewTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  prevSectionLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginTop: '12px', marginBottom: '6px' },
  prevField: { display: 'flex', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' },
  prevKey: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', minWidth: '70px', paddingTop: '2px', flexShrink: 0 },
  prevVal: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.5', flex: 1 },
  prevHint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '11px', color: 'var(--gold-dim)', marginTop: '6px', opacity: 0.7 },

  saveAllBtn: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
    border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '11px',
    letterSpacing: '2px', padding: '14px 28px', cursor: 'pointer', textTransform: 'uppercase',
    marginTop: '12px', alignSelf: 'flex-start',
  },
};
