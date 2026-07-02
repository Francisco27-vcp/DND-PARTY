// src/pages/Manual.js — Compendio de reglas v2
import React, { useState, useEffect, useMemo } from 'react';
import spells from '../data/spells.json';
import items  from '../data/items.json';

/* ══════════════════════════ DATOS ESTÁTICOS ══════════════════════════════ */

const QUICK_CARDS = [
  {
    id: 'acciones', cat: '⚔ Combate', title: 'Acciones en tu turno',
    rows: [
      ['🔵 Acción',          'Atacar · Conjuro · Ayudar · Buscar · Correr · Esquivar · Preparar · Usar objeto'],
      ['🟡 Ac. adicional',   'Solo si un rasgo o conjuro la otorga (Cunning Action, conjuros bono, etc.)'],
      ['🟢 Movimiento',      'Toda tu velocidad, dividida como quieras durante el turno'],
      ['⚪ Reacción',        '1 por ronda, fuera de tu turno — Ataque de oportunidad, Shield, Hellish Rebuke…'],
      ['🎯 Ac. de magia',    'Término 2024, distinto de Acción. Ciertos rasgos lo requieren específicamente'],
    ],
  },
  {
    id: 'tiradas', cat: '⚔ Combate', title: 'Tiradas y mecánicas',
    rows: [
      ['Ataque',            '1d20 + mod. característica + bono competencia (si sos competente con el arma)'],
      ['Crítico (20 nat.)', 'Acierto automático + doble dados de daño (los modificadores no se doblan)'],
      ['Pifia (1 nat.)',    'Fallo automático sin importar bonificadores'],
      ['Ventaja',           'Tirás 2d20 y tomás el mayor'],
      ['Desventaja',        'Tirás 2d20 y tomás el menor'],
      ['CD de salvación',   '8 + bono competencia + mod. de aptitud mágica del lanzador'],
    ],
  },
  {
    id: 'condiciones', cat: '🩸 Condiciones', title: 'Condiciones (resumen)',
    rows: [
      ['😱 Asustado',   'Solo UNA de: mover, acción o ac. adicional. No puede acercarse a la fuente del miedo.'],
      ['🔒 Apresado',   'Velocidad 0 · ataques contra él: ventaja · sus ataques: desventaja'],
      ['🚫 Incapacitado', 'No puede hacer acciones ni acciones adicionales'],
      ['💀 Paralizado',  'Incapacitado + sin mov/habla + falla Fue/Des + ataques c/c = crítico automático'],
      ['🤢 Envenenado',  'Desventaja en tiradas de ataque y pruebas de habilidad'],
      ['⬇ Tumbado',     'Velocidad ÷2 para levantarse · c/c contra él: ventaja · a distancia: desventaja'],
      ['🌑 Invisible',   'Sus ataques: ventaja · ataques contra él: desventaja'],
      ['😵 Aturdido',    'Incapacitado + sin mov/habla + falla Fue/Des + ataques contra él: ventaja'],
    ],
  },
  {
    id: 'concentracion', cat: '✨ Magia', title: 'Concentración',
    rows: [
      ['Límite',         '1 conjuro activo a la vez. Al lanzar otro de conc., el anterior termina.'],
      ['Daño recibido',  'Salvación CON: CD = máx(10, daño ÷ 2). Fallo → perdés concentración.'],
      ['Otras causas',   'Quedar incapacitado · morir'],
      ['War Caster',     'Ventaja en salvaciones de CON para mantener concentración'],
      ['Resilient: CON', 'Suma bono de competencia a salvaciones de CON'],
    ],
  },
  {
    id: 'conjuros-mecanica', cat: '✨ Magia', title: 'Mecánicas de conjuros',
    rows: [
      ['Espacios de conjuro', '"Combustible" para lanzar. Se recuperan en descanso largo.'],
      ['Lanzamiento mejorado', 'Con espacio de nivel mayor, muchos conjuros escalan (más daño, objetivos, etc.)'],
      ['Preparados vs. conocidos', 'Paladín/Clérigo preparan cada día. Bardo/Mago conocen permanentemente.'],
      ['Rituales',         'Lanzar sin gastar espacio. Requiere 10 min extra. Solo si tenés el rasgo.'],
    ],
  },
  {
    id: 'descansos', cat: '💤 Descansos', title: 'Descansos',
    rows: [
      ['⏱ Corto (1h+)',    'Gastás Dados de Golpe libremente. Recarga: Recuperación del guerrero, Ki…'],
      ['🌙 Largo (8h+)',   'Recuperás todos los PG + mitad de DG máximos. Recarga espacios de conjuro.'],
      ['PG de cada DG',    '1 Dado de Golpe + mod. CON por dado (mínimo 0 PG)'],
      ['Solo 1 por día',   'Máximo un descanso largo cada 24 horas'],
    ],
  },
  {
    id: 'habilidades', cat: '🎲 Habilidades', title: 'Atributos y habilidades',
    rows: [
      ['💪 FUE', 'Atletismo'],
      ['🤸 DES', 'Acrobacias · Sigilo · Juego de manos'],
      ['❤ CON',  'Sin habilidades propias (afecta PG y salvaciones de concentración)'],
      ['🧠 INT', 'Arcanos · Historia · Investigación · Naturaleza · Religión'],
      ['👁 SAB',  'Trato con animales · Perspicacia · Medicina · Percepción · Supervivencia'],
      ['💬 CAR', 'Engaño · Intimidación · Actuación · Persuasión'],
    ],
  },
  {
    id: 'xp-cr', cat: '⭐ Progresión', title: 'XP por CR (Reto)',
    rows: [
      ['CR 0',    '10 XP — rata, cangrejo'],
      ['CR 1/8',  '25 XP — bandido, kobold'],
      ['CR 1/4',  '50 XP — goblin, esqueleto'],
      ['CR 1/2',  '100 XP — orco, zombi'],
      ['CR 1',    '200 XP — bugbear'],
      ['CR 2',    '450 XP — gnoll, sacerdote'],
      ['CR 3',    '700 XP — vampiro joven, mago'],
      ['CR 5',    '1800 XP — troll, salamandra'],
    ],
  },
  {
    id: 'encuentros', cat: '⭐ Progresión', title: 'Dificultad encuentros (Nv3, 4 PJs)',
    rows: [
      ['🟢 Fácil',        '300 XP — sin riesgo real'],
      ['🟡 Medio',        '600 XP — gasto de recursos probable'],
      ['🔴 Difícil',      '900 XP — riesgo de baja o recursos críticos'],
      ['☠ Mortal',        '1400 XP — riesgo real de muerte de PJ'],
      ['Multiplicadores', '1 ×1 · 2 ×1.5 · 3-6 ×2 · 7-10 ×2.5 · 11-14 ×3 · 15+ ×4'],
    ],
  },
];

const QUICK_CATS = [...new Set(QUICK_CARDS.map(c => c.cat))];

const SOURCE_META = {
  'Manual del Jugador 2024':          { key: 'jugador',   color: '#4a7fa5', icon: '📖' },
  'Manual del Dungeon Master 2024':   { key: 'dm',        color: '#7a5a9a', icon: '👁' },
  'Manual de Monstruos 2024':         { key: 'monstruos', color: '#8b1a1a', icon: '👹' },
};

const TABS = [
  { id: 'referencia', label: 'Referencia', icon: '⚡' },
  { id: 'jugador',    label: 'Jugador',    icon: '📖' },
  { id: 'dm',         label: 'DM',         icon: '👁' },
  { id: 'monstruos',  label: 'Monstruos',  icon: '👹' },
  { id: 'conjuros',   label: 'Conjuros',   icon: '✨' },
  { id: 'objetos',    label: 'Objetos',    icon: '⚔' },
];

const SCHOOL_COLORS = {
  Abjuración:    '#4a7fa5',
  Conjuración:   '#5a8a5a',
  Adivinación:   '#c9a84c',
  Encantamiento: '#9a6aaa',
  Evocación:     '#8b1a1a',
  Ilusión:       '#5a7a8a',
  Nigromancia:   '#5a3a7a',
  Transmutación: '#7a6a4a',
};

const TAB_SRC = {
  jugador:   'Manual del Jugador 2024',
  dm:        'Manual del Dungeon Master 2024',
  monstruos: 'Manual de Monstruos 2024',
};

/* ══════════════════════════ HELPERS ══════════════════════════════════════ */

function scoreChunk(chunk, terms) {
  let score = 0;
  const ch = chunk._ch || '';
  const tx = chunk._tx || '';
  for (const t of terms) {
    if (ch.includes(t)) score += 10;
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = tx.match(new RegExp(esc, 'g'));
    score += Math.min((m || []).length, 6);
  }
  return score;
}

function snippet(text, query, len = 230) {
  const clean = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!query) return clean.slice(0, len) + (clean.length > len ? '…' : '');
  const first = query.split(/\s+/)[0].toLowerCase();
  const idx = clean.toLowerCase().indexOf(first);
  const start = Math.max(0, idx - 50);
  const frag = clean.slice(start, start + len);
  return (start > 0 ? '…' : '') + frag + (start + len < clean.length ? '…' : '');
}

function hlHTML(text, term) {
  if (!term) return text;
  const esc = term.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!esc) return text;
  return text.replace(
    new RegExp(`(${esc})`, 'gi'),
    '<mark style="background:rgba(201,168,76,0.35);color:var(--gold-bright);border-radius:2px;padding:0 2px">$1</mark>',
  );
}

/* ══════════════════════════ SUB-COMPONENTES ══════════════════════════════ */

function SearchResults({ results, query, loaded }) {
  if (!loaded) {
    return (
      <div style={s.center}>
        <div style={s.loadMsg}>⏳ Cargando índice del manual…</div>
      </div>
    );
  }
  if (!query.trim()) return null;
  if (!results.length) {
    return (
      <div style={s.center}>
        <div style={{ fontSize: '32px', opacity: 0.2, marginBottom: '10px' }}>🔍</div>
        <div style={s.emptyTitle}>Sin resultados para "{query}"</div>
        <div style={s.emptyHint}>Probá: "concentración", "apresado", "goblin", "paladín", "CA"…</div>
      </div>
    );
  }
  return (
    <div>
      <p style={s.resultsHeader}>
        {results.length} resultado{results.length !== 1 ? 's' : ''} — <em>"{query}"</em>
      </p>
      <div style={s.resultGrid}>
        {results.map(chunk => {
          const meta = SOURCE_META[chunk.source] || { color: '#7a7a7a', icon: '📄', key: '?' };
          return (
            <div key={chunk.id} style={{ ...s.resultCard, borderLeftColor: meta.color }}>
              <div style={s.resultTop}>
                <span style={{ ...s.srcBadge, background: meta.color + '1a', color: meta.color, borderColor: meta.color + '55' }}>
                  {meta.icon} {meta.key?.toUpperCase()}
                </span>
                <span style={s.chTitle}>{chunk.chapter_title}</span>
              </div>
              <div
                style={s.resultText}
                dangerouslySetInnerHTML={{ __html: hlHTML(snippet(chunk.text, query), query) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickRef() {
  const [cat, setCat] = useState(null);
  const cards = cat ? QUICK_CARDS.filter(c => c.cat === cat) : QUICK_CARDS;
  return (
    <div>
      <div style={s.pills}>
        {[null, ...QUICK_CATS].map(c => (
          <button
            key={c || '__all'}
            style={{ ...s.pill, ...(cat === c ? s.pillOn : {}) }}
            onClick={() => setCat(c)}
          >
            {c || 'Todas'}
          </button>
        ))}
      </div>
      <div style={s.qGrid}>
        {cards.map(card => (
          <div key={card.id} style={s.qCard}>
            <div style={s.qCat}>{card.cat}</div>
            <div style={s.qTitle}>{card.title}</div>
            <table style={s.qTable}>
              <tbody>
                {card.rows.map(([label, desc], i) => (
                  <tr key={i} style={i % 2 === 0 ? s.qRowEven : {}}>
                    <td style={s.qLabel}>{label}</td>
                    <td style={s.qDesc}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpellsTab({ spellList }) {
  const [q, setQ] = useState('');
  const levels = useMemo(() => [...new Set(spellList.map(sp => sp.nivel))].sort((a, b) => a - b), [spellList]);
  const filtered = useMemo(() => {
    const f = q.toLowerCase();
    if (!f) return spellList;
    return spellList.filter(sp =>
      sp.nombre.toLowerCase().includes(f) ||
      sp.escuela.toLowerCase().includes(f) ||
      (sp.clases || []).some(c => c.toLowerCase().includes(f)) ||
      String(sp.nivel) === f,
    );
  }, [spellList, q]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...s.miniInput, flex: '1 1 160px' }}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Filtrar por nombre, escuela o clase…"
        />
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {levels.map(lv => (
            <button
              key={lv}
              style={{ ...s.pill, ...(q === String(lv) ? s.pillOn : {}) }}
              onClick={() => setQ(q === String(lv) ? '' : String(lv))}
            >
              {lv === 0 ? 'Trucos' : `Nv${lv}`}
            </button>
          ))}
        </div>
      </div>
      <div style={s.spellGrid}>
        {filtered.map(sp => {
          const clr = SCHOOL_COLORS[sp.escuela] || '#888';
          return (
            <div key={sp.id} style={{ ...s.spellCard, borderTopColor: clr }}>
              <div style={s.spellTop}>
                <span style={{ ...s.lvBadge, background: clr + '22', color: clr }}>
                  {sp.nivel === 0 ? 'Truco' : `Nv${sp.nivel}`}
                </span>
                <span style={s.spellName}>{sp.nombre}</span>
                <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                  {sp.concentracion && <span style={s.concBadge}>⧖ CONC</span>}
                  {sp.ritual && <span style={s.ritualBadge}>✦ RITUAL</span>}
                </div>
              </div>
              <div style={{ ...s.spellSchool, color: clr }}>{sp.escuela}</div>
              <div style={s.spellMeta}>
                <span>⚡ {sp.tiempoCasteo}</span>
                <span>📍 {sp.alcance}</span>
                <span>⌛ {sp.duracion}</span>
              </div>
              <div style={s.spellComps}>{sp.componentes}</div>
              <div style={s.spellDesc}>{sp.descripcion}</div>
              {sp.clases?.length > 0 && (
                <div style={s.spellClasses}>
                  {sp.clases.map(c => <span key={c} style={s.classPill}>{c}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemsTab({ itemList }) {
  const [q, setQ] = useState('');
  const types = useMemo(() => [...new Set(itemList.map(it => it.tipo))], [itemList]);
  const filtered = useMemo(() => {
    const f = q.toLowerCase();
    if (!f) return itemList;
    return itemList.filter(it =>
      it.nombre.toLowerCase().includes(f) || it.tipo === f || it.slot === f,
    );
  }, [itemList, q]);

  return (
    <div>
      <div style={s.pills}>
        <button style={{ ...s.pill, ...(q === '' ? s.pillOn : {}) }} onClick={() => setQ('')}>Todos</button>
        {types.map(t => (
          <button
            key={t}
            style={{ ...s.pill, ...(q === t ? s.pillOn : {}) }}
            onClick={() => setQ(q === t ? '' : t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={s.itemGrid}>
        {filtered.map(it => (
          <div key={it.id} style={s.itemCard}>
            <div style={s.itemName}>{it.nombre}</div>
            <div style={s.itemMeta}>{it.tipo} · {it.slot}</div>
            <div style={s.itemDesc}>{it.descripcion}</div>
            {it.stats && (
              <div style={s.chips}>
                {it.stats.daño && <span style={s.chip}>⚔ {it.stats.daño} {it.stats.tipoDaño}</span>}
                {(it.stats.propiedades || []).map((p, i) => <span key={i} style={s.chip}>{p}</span>)}
                {it.stats.atributo && <span style={{ ...s.chip, opacity: 0.7 }}>{it.stats.atributo.toUpperCase()}</span>}
                {it.stats.CA && <span style={s.chip}>CA {it.stats.CA}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionsList({ sections, onSelect, loaded, activeTab }) {
  const meta = Object.values(SOURCE_META).find(m => m.key === activeTab) || {};
  if (!loaded) {
    return <div style={s.center}><div style={s.loadMsg}>⏳ Cargando secciones del manual…</div></div>;
  }
  if (!sections.length) {
    return <div style={s.center}><div style={s.emptyTitle}>Sin contenido disponible</div></div>;
  }
  return (
    <div style={s.secGrid}>
      {sections.map(sec => (
        <button
          key={sec.title}
          style={s.secCard}
          onClick={() => onSelect(sec)}
        >
          <div style={{ ...s.secTitle, color: meta.color || 'var(--gold-bright)' }}>{sec.title}</div>
          <div style={s.secCount}>{sec.chunks.length} bloque{sec.chunks.length !== 1 ? 's' : ''}</div>
          <div style={s.secPreview}>
            {sec.chunks[0].text.replace(/\n+/g, ' ').slice(0, 100)}…
          </div>
        </button>
      ))}
    </div>
  );
}

function SectionDetail({ section, onBack, onChunk, activeTab }) {
  const meta = Object.values(SOURCE_META).find(m => m.key === activeTab) || {};
  return (
    <div>
      <button style={s.back} onClick={onBack}>← Volver al índice</button>
      <h2 style={{ ...s.secDetailTitle, color: meta.color || 'var(--gold-bright)' }}>{section.title}</h2>
      <div style={s.chunkList}>
        {section.chunks.map(chunk => (
          <div key={chunk.id} style={s.chunkCard} onClick={() => onChunk(chunk)}>
            <div style={s.chunkPreview}>
              {chunk.text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 300)}…
            </div>
            <div style={s.chunkMore}>Ver texto completo →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChunkDetail({ chunk, onBack }) {
  const meta = SOURCE_META[chunk.source] || { color: '#888', icon: '📄', key: '?' };
  const lines = chunk.text.replace(/\n{3,}/g, '\n\n').split('\n');
  return (
    <div>
      <button style={s.back} onClick={onBack}>← Volver</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0 20px', flexWrap: 'wrap' }}>
        <span style={{ ...s.srcBadge, background: meta.color + '1a', color: meta.color, borderColor: meta.color + '55' }}>
          {meta.icon} {chunk.source}
        </span>
        <span style={s.chTitle}>{chunk.chapter_title}</span>
      </div>
      <div style={s.chunkBody}>
        {lines.map((line, i) =>
          line.trim()
            ? <p key={i} style={s.chunkLine}>{line}</p>
            : <div key={i} style={{ height: '10px' }} />,
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════ COMPONENTE PRINCIPAL ═════════════════════════ */

export default function Manual() {
  const [chunks, setChunks]   = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [search, setSearch]   = useState('');
  const [dSearch, setDSearch] = useState('');
  const [tab, setTab]         = useState('referencia');
  const [section, setSection] = useState(null);
  const [chunk, setChunk]     = useState(null);

  useEffect(() => {
    import('../data/manuals_chunks.json')
      .then(m => {
        const indexed = m.default.map(c => ({
          ...c,
          _ch: (c.chapter_title || '').toLowerCase(),
          _tx: (c.text || '').toLowerCase().slice(0, 900),
        }));
        setChunks(indexed);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const results = useMemo(() => {
    if (!dSearch.trim()) return [];
    const terms = dSearch.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (!terms.length) return [];
    return chunks
      .map(c => ({ ...c, _sc: scoreChunk(c, terms) }))
      .filter(c => c._sc > 0)
      .sort((a, b) => b._sc - a._sc)
      .slice(0, 30);
  }, [dSearch, chunks]);

  const sections = useMemo(() => {
    const src = TAB_SRC[tab];
    if (!src) return [];
    const grouped = {};
    for (const c of chunks) {
      if (c.source === src) {
        if (!grouped[c.chapter_title]) grouped[c.chapter_title] = [];
        grouped[c.chapter_title].push(c);
      }
    }
    return Object.entries(grouped)
      .map(([title, cks]) => ({ title, chunks: cks }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tab, chunks]);

  const isSearching = dSearch.trim().length > 0;

  function changeTab(id) {
    setTab(id); setSection(null); setChunk(null);
    if (id !== tab) setSearch('');
  }

  function renderContent() {
    if (isSearching)          return <SearchResults results={results} query={dSearch} loaded={loaded} />;
    if (tab === 'referencia') return <QuickRef />;
    if (tab === 'conjuros')   return <SpellsTab spellList={spells} />;
    if (tab === 'objetos')    return <ItemsTab itemList={items} />;
    if (chunk)   return <ChunkDetail chunk={chunk} onBack={() => setChunk(null)} />;
    if (section) return <SectionDetail section={section} onBack={() => setSection(null)} onChunk={setChunk} activeTab={tab} />;
    return <SectionsList sections={sections} onSelect={setSection} loaded={loaded} activeTab={tab} />;
  }

  return (
    <div style={s.page} className="fade-in">
      <header style={s.hero}>
        <div style={s.heroEyebrow}>Compendio de reglas</div>
        <h1 style={s.heroTitle}>MANUAL</h1>
        <p style={s.heroSub}>Manual del Jugador · Manual del DM · Bestiario — 2024</p>
        <div style={s.searchWrap}>
          <span style={s.searchIco}>🔍</span>
          <input style={s.searchInput} value={search}
            placeholder="Buscar en los 3 manuales… (concentración, paladín, goblin…)"
            onChange={e => { setSearch(e.target.value); setSection(null); setChunk(null); }} />
          {search && <button style={s.searchClear} onClick={() => { setSearch(''); setDSearch(''); }}>✕</button>}
        </div>
        {!loaded && <div style={s.loadBar}>Indexando 2253 secciones de manual…</div>}
      </header>

      <nav style={s.tabBar}>
        {TABS.map(t => (
          <button key={t.id}
            style={{ ...s.tab, ...(tab === t.id && !isSearching ? s.tabOn : {}) }}
            onClick={() => changeTab(t.id)}>
            <span style={s.tabIco}>{t.icon}</span>
            <span style={s.tabLbl}>{t.label}</span>
          </button>
        ))}
      </nav>

      <div style={s.body}>{renderContent()}</div>
      <div style={{ height: 80 }} />
    </div>
  );
}

/* ══════════════════════════ ESTILOS ══════════════════════════════════════ */

const s = {
  page: { maxWidth: '1100px', margin: '0 auto', padding: '0 20px' },
  hero: { textAlign: 'center', padding: '40px 20px 28px' },
  heroEyebrow: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,44px)', fontWeight: '900', letterSpacing: '6px', color: 'var(--gold-bright)', textShadow: '0 0 40px rgba(227,200,120,0.3)', margin: '0 0 8px' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', margin: '0 0 24px' },
  searchWrap: { position: 'relative', maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '10px', overflow: 'hidden' },
  searchIco: { padding: '0 12px', fontSize: '16px', flexShrink: 0 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '16px', padding: '14px 8px', outline: 'none' },
  searchClear: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', cursor: 'pointer', padding: '0 16px', fontSize: '14px', flexShrink: 0 },
  loadBar: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', opacity: 0.5, marginTop: '14px', textTransform: 'uppercase' },
  tabBar: { display: 'flex', borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: '28px', overflowX: 'auto', gap: 0 },
  tab: { display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 18px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--gold-dim)', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px', transition: 'color 0.2s' },
  tabOn: { color: 'var(--gold-bright)', borderBottomColor: 'var(--gold-2, #c7a242)' },
  tabIco: { fontSize: '14px' },
  tabLbl: {},
  body: { minHeight: '500px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', textAlign: 'center' },
  loadMsg: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  emptyTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  emptyHint: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', opacity: 0.7 },
  srcBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', padding: '3px 9px', borderRadius: '4px', border: '1px solid', flexShrink: 0 },
  chTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '0.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultsHeader: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--gold-dim)', marginBottom: '16px' },
  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '10px' },
  resultCard: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.1)', borderLeft: '3px solid', borderRadius: '8px', padding: '14px' },
  resultTop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' },
  resultText: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.65' },
  pills: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '18px' },
  pill: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', padding: '5px 13px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', cursor: 'pointer', borderRadius: '20px', transition: 'all 0.15s' },
  pillOn: { background: 'rgba(201,168,76,0.12)', borderColor: 'var(--gold-2)', color: 'var(--gold-bright)' },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' },
  qCard: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '10px', padding: '16px 18px', overflow: 'hidden' },
  qCat: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.6 },
  qTitle: { fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1.5px', color: 'var(--gold-bright)', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase' },
  qTable: { width: '100%', borderCollapse: 'collapse' },
  qRowEven: { background: 'rgba(201,168,76,0.04)' },
  qLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '0.3px', color: 'var(--gold-bright)', padding: '5px 10px 5px 4px', whiteSpace: 'nowrap', verticalAlign: 'top', minWidth: '110px' },
  qDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', padding: '4px 0', lineHeight: '1.55', verticalAlign: 'top' },
  miniInput: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', borderRadius: '6px' },
  spellGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' },
  spellCard: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.12)', borderTop: '3px solid', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  spellTop: { display: 'flex', alignItems: 'center', gap: '8px' },
  lvBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '2px 8px', borderRadius: '4px', flexShrink: 0, textTransform: 'uppercase', fontWeight: '700' },
  spellName: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', color: 'var(--gold-bright)', flex: 1, letterSpacing: '0.5px' },
  concBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '0.5px', color: '#c07a20', background: 'rgba(192,122,32,0.15)', border: '1px solid rgba(192,122,32,0.3)', padding: '2px 5px', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 },
  ritualBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '0.5px', color: '#4a7fa5', background: 'rgba(74,127,165,0.15)', border: '1px solid rgba(74,127,165,0.3)', padding: '2px 5px', borderRadius: '3px', flexShrink: 0 },
  spellSchool: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.85 },
  spellMeta: { display: 'flex', flexWrap: 'wrap', gap: '8px', fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold-dim)', letterSpacing: '0.5px' },
  spellComps: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--text-soft)', fontStyle: 'italic' },
  spellDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.65', flex: 1 },
  spellClasses: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' },
  classPill: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 7px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', borderRadius: '3px' },
  itemGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginTop: '14px' },
  itemCard: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' },
  itemName: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px' },
  itemMeta: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase', opacity: 0.8 },
  itemDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.5' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' },
  chip: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', padding: '2px 8px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', borderRadius: '3px' },
  secGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' },
  secCard: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: '8px', padding: '14px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', display: 'flex', flexDirection: 'column', gap: '4px' },
  secTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '700' },
  secCount: { fontFamily: 'Cinzel,serif', fontSize: '8px', color: 'var(--gold-dim)', letterSpacing: '0.5px' },
  secPreview: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', lineHeight: '1.4', opacity: 0.65, marginTop: '4px' },
  back: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '7px 14px', cursor: 'pointer', borderRadius: '4px', marginBottom: '20px' },
  secDetailTitle: { fontFamily: 'Cinzel,serif', fontSize: '16px', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '18px' },
  chunkList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  chunkCard: { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' },
  chunkPreview: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment-dim)', lineHeight: '1.65', marginBottom: '8px' },
  chunkMore: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-dim)' },
  chunkBody: { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: '8px', padding: '24px 28px' },
  chunkLine: { margin: '0 0 4px', lineHeight: '1.75', fontFamily: 'Crimson Pro,serif', fontSize: '15px', color: 'var(--parchment-dim)' },
};
