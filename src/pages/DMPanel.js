// src/pages/DMPanel.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot, writeBatch, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

const QUICK_LINKS = [
  { path: '/campana', label: 'Campaña', icon: '📜' },
  { path: '/historia', label: 'Historia', icon: '🗺️' },
  { path: '/notas', label: 'Notas', icon: '📝' },
  { path: '/manual', label: 'Manual', icon: '📖' },
];

const PARTICIPANT_TYPES = [
  { id: 'pj', label: 'PJ', color: '#c9a84c' },
  { id: 'enemigo', label: 'Enemigo', color: '#8b1a1a' },
];

const DEFAULT_COMBAT = { active: false, round: 1, currentIndex: 0, participants: [] };

const combatRef = () => doc(db, 'combat', 'current');

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

function sortParticipants(participants) {
  return [...(participants || [])].sort((a, b) => (b.initiative - a.initiative) || (a.addedAt - b.addedAt));
}

export default function DMPanel({ user }) {
  const navigate = useNavigate();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isDM, setIsDM] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [xpAmount, setXpAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [combat, setCombat] = useState(DEFAULT_COMBAT);
  const [partName, setPartName] = useState('');
  const [partInitiative, setPartInitiative] = useState('');
  const [partType, setPartType] = useState('pj');
  const [sessions, setSessions] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef(null);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', user.uid));
        const role = snap.exists() ? snap.data().role : null;
        setIsDM(role === 'Dungeon Master' || role === 'Jugador / DM');
      } catch (err) {
        console.error('Error verificando permisos de DM:', err);
      }
      setRoleLoaded(true);
    };
    loadRole();
  }, [user.uid]);

  const loadCharacters = useCallback(async () => {
    setLoadingChars(true);
    try {
      const snap = await getDocs(collection(db, 'characters'));
      setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error cargando personajes:', err);
    }
    setLoadingChars(false);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error cargando sesiones:', err);
    }
  }, []);

  useEffect(() => {
    if (roleLoaded && isDM) {
      loadCharacters();
      loadSessions();
    }
  }, [roleLoaded, isDM, loadCharacters, loadSessions]);

  useEffect(() => {
    if (!roleLoaded || !isDM) return;
    const unsub = onSnapshot(combatRef(), (snap) => {
      setCombat(snap.exists() ? { ...DEFAULT_COMBAT, ...snap.data() } : DEFAULT_COMBAT);
    }, (err) => {
      console.error('Error sincronizando el combate:', err);
    });
    return unsub;
  }, [roleLoaded, isDM]);

  const sortedParticipants = sortParticipants(combat.participants);

  const addParticipant = async (e) => {
    e.preventDefault();
    const name = partName.trim();
    const initiative = parseInt(partInitiative, 10);
    if (!name || isNaN(initiative)) return;
    const newParticipant = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, initiative, type: partType, addedAt: Date.now() };
    const participants = [...(combat.participants || []), newParticipant];
    await setDoc(combatRef(), { participants }, { merge: true });
    setPartName('');
    setPartInitiative('');
  };

  const removeParticipant = async (id) => {
    const participants = (combat.participants || []).filter(p => p.id !== id);
    const newIndex = Math.min(combat.currentIndex || 0, Math.max(0, participants.length - 1));
    await setDoc(combatRef(), { participants, currentIndex: newIndex }, { merge: true });
  };

  const startCombat = async () => {
    if (!sortedParticipants.length) return;
    await setDoc(combatRef(), { active: true, round: 1, currentIndex: 0 }, { merge: true });
  };

  const nextTurn = async () => {
    const total = sortedParticipants.length;
    if (!total) return;
    let newIndex = (combat.currentIndex || 0) + 1;
    let newRound = combat.round || 1;
    if (newIndex >= total) {
      newIndex = 0;
      newRound += 1;
    }
    await setDoc(combatRef(), { currentIndex: newIndex, round: newRound }, { merge: true });
  };

  const endCombat = async () => {
    await setDoc(combatRef(), { active: false, round: 1, currentIndex: 0 }, { merge: true });
  };

  const clearParticipants = async () => {
    await setDoc(combatRef(), { participants: [], active: false, round: 1, currentIndex: 0 }, { merge: true });
  };

  const applyXpToAll = async (sign) => {
    const amount = parseInt(xpAmount, 10);
    if (!amount) return;
    setApplying(true);
    try {
      const batch = writeBatch(db);
      characters.forEach(char => {
        const newXp = Math.max(0, (char.xp || 0) + sign * amount);
        batch.update(doc(db, 'characters', char.id), { xp: newXp, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      await loadCharacters();
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (err) {
      console.error('Error aplicando XP a la party:', err);
    }
    setApplying(false);
  };

  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
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
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'ai', text: `Error ${res.status}: ${errData.error?.message || errData.error || 'Error desconocido.'}` };
          return updated;
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
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'ai', text: fullText };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Error llamando a la IA:', err);
      setAiMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: 'Error al conectar con el asistente. Verificá tu conexión y la API key.' };
        return updated;
      });
    }
    setAiLoading(false);
  };

  if (!roleLoaded) {
    return <div style={s.loading}>Verificando permisos...</div>;
  }

  if (!isDM) {
    return (
      <div style={s.deniedWrap} className="fade-in">
        <div style={s.deniedGem}>🔒</div>
        <div style={s.deniedTitle}>Acceso restringido</div>
        <p style={s.deniedText}>Esta sección es solo para Dungeon Masters. Si creés que esto es un error, actualizá tu rol en tu perfil.</p>
        <button style={s.deniedBtn} onClick={() => navigate('/perfil')}>Ir a tu perfil</button>
      </div>
    );
  }

  return (
    <div style={s.page} className="fade-in">

      <div style={s.hero}>
        <div style={s.heroLabel}>Solo para el ojo que todo ve</div>
        <h1 style={s.heroTitle}>PANEL DEL DM</h1>
        <p style={s.heroSub}>Control total de la party</p>
      </div>

      {/* QUICK NAV */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Navegación rápida</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.quickNav}>
          {QUICK_LINKS.map(link => (
            <button key={link.path} style={s.quickBtn} onClick={() => navigate(link.path)}>
              <span style={{ fontSize: '20px' }}>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* INITIATIVE TRACKER */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Tracker de Iniciativa</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.combatBox}>

          <div style={s.combatStatusRow}>
            <span style={{ ...s.combatStatus, ...(combat.active ? s.combatStatusActive : {}) }}>
              {combat.active ? '⚔ Combate en curso' : '○ Sin combate activo'}
            </span>
            <span style={s.roundBadge}>Ronda {combat.round || 1}</span>
          </div>

          {/* ADD PARTICIPANT */}
          <form onSubmit={addParticipant} style={s.combatForm}>
            <input
              value={partName}
              onChange={e => setPartName(e.target.value)}
              style={s.combatInputName}
              placeholder="Nombre del participante"
            />
            <input
              type="number"
              value={partInitiative}
              onChange={e => setPartInitiative(e.target.value)}
              style={s.combatInputNum}
              placeholder="Iniciativa"
            />
            <div style={s.typeToggle}>
              {PARTICIPANT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPartType(t.id)}
                  style={{ ...s.typeBtn, ...(partType === t.id ? { borderColor: t.color, color: t.color, background: `${t.color}1a` } : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button type="submit" style={s.combatAddBtn}>+ Agregar</button>
          </form>

          {/* PARTICIPANT LIST */}
          {sortedParticipants.length === 0
            ? <div style={s.empty}>Sin participantes todavía. Agregá PJs y enemigos para empezar el combate.</div>
            : <div style={s.combatList}>
                {sortedParticipants.map((p, i) => {
                  const typeInfo = PARTICIPANT_TYPES.find(t => t.id === p.type) || PARTICIPANT_TYPES[0];
                  const isCurrent = combat.active && i === (combat.currentIndex || 0);
                  return (
                    <div key={p.id} style={{ ...s.combatRow, ...(isCurrent ? s.combatRowActive : {}) }}>
                      <span style={s.combatTurnIcon}>{isCurrent ? '▶' : ''}</span>
                      <span style={{ ...s.combatTypeBadge, borderColor: `${typeInfo.color}50`, color: typeInfo.color }}>{typeInfo.label}</span>
                      <span style={s.combatName}>{p.name}</span>
                      <span style={s.combatInit}>{p.initiative}</span>
                      <button style={s.combatRemoveBtn} onClick={() => removeParticipant(p.id)} title="Quitar">✕</button>
                    </div>
                  );
                })}
              </div>
          }

          {/* CONTROLS */}
          <div style={s.combatControls}>
            {!combat.active
              ? <button style={s.combatStartBtn} onClick={startCombat} disabled={!sortedParticipants.length}>▶ Iniciar combate</button>
              : <>
                  <button style={s.combatNextBtn} onClick={nextTurn}>⏭ Siguiente turno</button>
                  <button style={s.combatEndBtn} onClick={endCombat}>■ Finalizar combate</button>
                </>
            }
            <button style={s.combatClearBtn} onClick={clearParticipants} disabled={combat.active}>🗑 Vaciar lista</button>
          </div>
        </div>
      </div>

      {/* XP BULK CONTROL */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>XP para toda la party</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.xpBox}>
          <div style={s.xpControl}>
            <input
              type="number"
              min="0"
              value={xpAmount}
              onChange={e => setXpAmount(e.target.value)}
              style={s.xpInput}
              placeholder="Cantidad de XP"
            />
            <button style={s.xpBtnPlus} onClick={() => applyXpToAll(1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '+ Otorgar a todos'}
            </button>
            <button style={s.xpBtnMinus} onClick={() => applyXpToAll(-1)} disabled={applying || !xpAmount}>
              {applying ? '...' : '− Quitar a todos'}
            </button>
            {applied && <span style={s.xpApplied}>✓ Aplicado</span>}
          </div>
          <div style={s.hint}>Se suma o resta a la XP actual de cada personaje de la party (mínimo 0).</div>
        </div>
      </div>

      {/* PARTY SUMMARY */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Resumen de la party</span>
          <div style={s.sectionLine} />
        </div>
        {loadingChars
          ? <div style={s.loadingInline}>Cargando personajes...</div>
          : characters.length === 0
            ? <div style={s.empty}>No hay personajes registrados todavía.</div>
            : <div style={s.grid}>
                {characters.map(char => (
                  <PartyCard key={char.id} char={char} onClick={() => navigate(`/personaje/${char.id}`)} />
                ))}
              </div>
        }
      </div>

      {/* ASISTENTE IA */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Asistente IA del DM</span>
          <div style={s.sectionLine} />
        </div>
        <div style={s.aiBox}>
          <div style={s.hint}>Preguntá sobre reglas de D&D 2024, los personajes o la campaña. El contexto de la party y las últimas sesiones ya está incluido.</div>
          <div style={s.aiChat} ref={aiScrollRef}>
            {aiMessages.length === 0 && (
              <div style={s.aiEmpty}>¿En qué puedo ayudarte, Dungeon Master?</div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? s.aiUserMsg : s.aiAssistantMsg}>
                <span style={msg.role === 'user' ? s.aiUserLabel : s.aiAssistantLabel}>
                  {msg.role === 'user' ? 'DM' : '✦ Asistente'}
                </span>
                <p style={s.aiMsgText}>
                  {msg.text || (aiLoading && i === aiMessages.length - 1 ? '▌' : '')}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); sendToAI(aiInput); }} style={s.aiForm}>
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              style={s.aiInput}
              placeholder="Preguntá sobre reglas, estrategias, la campaña..."
              disabled={aiLoading}
            />
            <button type="submit" style={s.aiSendBtn} disabled={aiLoading || !aiInput.trim()}>
              {aiLoading ? '...' : 'Consultar'}
            </button>
          </form>
        </div>
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

function PartyCard({ char, onClick }) {
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  return (
    <div style={{ ...s.card, borderTopColor: char.color || '#c9a84c' }} onClick={onClick} className="fade-in">
      <div style={s.cardHeader}>
        <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
        <div style={{ flex: 1 }}>
          <div style={s.cardName}>{char.name}</div>
          <div style={s.cardSub}>{char.race} {char.class} · Lv{char.level}</div>
        </div>
      </div>
      <div style={s.cardStats}>
        <MiniStat label="PG" value={`${char.hp ?? '—'}/${char.hpMax ?? '—'}`} />
        <MiniStat label="XP" value={(char.xp || 0).toLocaleString()} />
      </div>
      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} />
      </div>
      <div style={s.condRow}>
        <span style={s.condLabel}>Condiciones</span>
        <span style={s.condVal}>{char.conditions || 'Ninguna'}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={s.miniVal}>{value}</div>
      <div style={s.miniLabel}>{label}</div>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  loadingInline: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '8px' },

  deniedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px', gap: '6px' },
  deniedGem: { fontSize: '32px', marginBottom: '8px', opacity: 0.6 },
  deniedTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: '#e07070', letterSpacing: '2px', textTransform: 'uppercase' },
  deniedText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#8a8070', maxWidth: '380px', lineHeight: '1.6', margin: '8px 0 16px' },
  deniedBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px 20px', cursor: 'pointer', textTransform: 'uppercase' },

  section: { marginBottom: '28px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },

  quickNav: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },

  combatBox: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' },
  combatStatusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  combatStatus: { fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase' },
  combatStatusActive: { color: '#e07070' },
  roundBadge: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', padding: '4px 12px', textTransform: 'uppercase' },
  combatForm: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  combatInputName: { flex: '2 1 160px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none' },
  combatInputNum: { flex: '0 1 100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '9px 12px', outline: 'none', width: '100px' },
  typeToggle: { display: 'flex', gap: '4px' },
  typeBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '9px 12px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  combatAddBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '9px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  combatList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  combatRow: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(8,6,12,0.5)', border: '1px solid rgba(201,168,76,0.08)', padding: '8px 12px', transition: 'all 0.2s' },
  combatRowActive: { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.5)', boxShadow: '0 0 12px rgba(201,168,76,0.15)' },
  combatTurnIcon: { width: '14px', color: '#e8c96a', fontSize: '11px', flexShrink: 0 },
  combatTypeBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', textTransform: 'uppercase', flexShrink: 0 },
  combatName: { flex: 1, fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#e8c96a' },
  combatInit: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#c9a84c', minWidth: '24px', textAlign: 'right' },
  combatRemoveBtn: { background: 'transparent', border: 'none', color: '#5a4820', fontSize: '12px', cursor: 'pointer', padding: '2px 6px' },
  combatControls: { display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '12px' },
  combatStartBtn: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  combatNextBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  combatEndBtn: { background: 'rgba(139,26,26,0.12)', border: '1px solid rgba(139,26,26,0.4)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  combatClearBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase', marginLeft: 'auto' },
  xpBox: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  xpControl: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  xpInput: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none', width: '160px' },
  xpBtnPlus: { background: 'rgba(74,138,74,0.12)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  xpBtnMinus: { background: 'rgba(139,26,26,0.12)', border: '1px solid rgba(139,26,26,0.4)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase' },
  xpApplied: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: '#7aaa7a', textTransform: 'uppercase' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18' },

  empty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', padding: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #c9a84c', cursor: 'pointer', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.2s' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  cardName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a', letterSpacing: '0.5px' },
  cardSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' },
  cardStats: { display: 'flex', justifyContent: 'space-around' },
  miniVal: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e8c96a' },
  miniLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  condRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '8px' },
  condLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase' },
  condVal: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#9a9080', textAlign: 'right' },

  aiBox: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '2px solid #c9a84c', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' },
  aiChat: { minHeight: '80px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  aiEmpty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820', textAlign: 'center', padding: '24px 0' },
  aiUserMsg: { alignSelf: 'flex-end', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', padding: '10px 14px', maxWidth: '80%' },
  aiAssistantMsg: { alignSelf: 'flex-start', background: 'rgba(8,6,12,0.6)', border: '1px solid rgba(201,168,76,0.06)', padding: '10px 14px', maxWidth: '88%' },
  aiUserLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#c9a84c', textTransform: 'uppercase', display: 'block', marginBottom: '5px' },
  aiAssistantLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: '#5a4820', textTransform: 'uppercase', display: 'block', marginBottom: '5px' },
  aiMsgText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#f5f0e8', lineHeight: '1.65', margin: 0, whiteSpace: 'pre-wrap' },
  aiForm: { display: 'flex', gap: '10px', alignItems: 'stretch', borderTop: '1px solid rgba(201,168,76,0.08)', paddingTop: '14px' },
  aiInput: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px 14px', outline: 'none' },
  aiSendBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase' },
};
