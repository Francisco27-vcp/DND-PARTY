// src/pages/dm/TabAsistente.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection, getDocs, query, orderBy, limit,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ReactMarkdown from 'react-markdown';
import { jsonrepair } from 'jsonrepair';
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
const GENERATE_PROMPT = `Sos el asistente de un DM de D&D 5e. Extraé datos estructurados de la descripción de sesión.

FORMATO: Respondé ÚNICAMENTE con JSON válido en UNA SOLA LÍNEA CONTINUA. Sin markdown, sin texto extra.

{"session":{"title":"string","date":"","xpEarned":0,"summary":"string","highlights":"item1, item2, item3"},"npcs":[{"name":"string","tipo":"antagonista|aliado|party_temporal|situacional|neutro","race":"string","role":"string","motivation":"string","visibleToPlayers":false}],"timeline":[{"title":"string","category":"evento|combate|lore|npc|lugar","description":"string","visibleToParty":false}]}

LÍMITES ESTRICTOS (es crítico respetar esto para no superar el largo máximo):
- summary: máximo 25 palabras.
- highlights: máximo 3 frases cortas separadas por coma.
- npcs: máximo 2 personajes con nombre propio. Si no hay, [].
- timeline: máximo 2 eventos. Si no hay, [].
- Cada description de timeline: máximo 15 palabras.
- motivation: máximo 8 palabras.
- NUNCA uses comillas dobles dentro de los valores. Parafraseá los diálogos en tercera persona.
- xpEarned: número, 0 si no se menciona.`;

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

      // Parse JSON — jsonrepair handles truncated output, unescaped quotes, etc.
      try {
        const clean = fullText
          .replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
          .replace(/[""]/g, '"').replace(/['']/g, "'");

        if (!clean.includes('{')) {
          setGenError('La IA no devolvió JSON válido. Intentá de nuevo.');
          setGenLoading(false);
          return;
        }

        const data = JSON.parse(jsonrepair(clean));
        setGenerated(data);
        setSelections({
          session: true,
          npcs: (data.npcs || []).map((_, i) => i),
          timeline: (data.timeline || []).map((_, i) => i),
        });
      } catch (parseErr) {
        console.error('Parse error:', parseErr, '\nRaw response:', fullText);
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
          cre