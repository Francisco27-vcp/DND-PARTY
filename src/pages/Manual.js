// src/pages/Manual.js
import React, { useState } from 'react';

const SECTIONS = [
  {
    id: 'razas', label: '⚔ Razas', color: '#c9a84c',
    topics: [
      { title: 'Aasimar', content: 'Los aasimar son humanos con una chispa de lo divino en su linaje, nacida de la unión de sus antepasados con los ángeles.\n\n**Rasgos:** Resistencia celestial (radiante y necrótico), Visión en la oscuridad 18m, Portador de la luz (truco Luz con Carisma), Manos sanadoras (2d4 PG, 1x desc. largo).\n\n**Revelación celestial (Nv3):** Acción adicional, 1x desc. largo. Elige una manifestación durante 1 minuto:\n• Alas celestiales: velocidad de vuelo igual a velocidad terrestre + daño radiante\n• Sudario necrótico: presencia aterradora + daño necrótico\n• Resplandor interior: emite luz + daño radiante\n\nEl daño extra es siempre igual al bonificador de competencia (1x por turno).' },
      { title: 'Elfo', content: 'Los elfos son un pueblo mágico de gracia sobrenatural que vive mucho más que los humanos.\n\n**Rasgos:** Visión en la oscuridad 18m, Sentidos agudizados (competencia en Percepción), Linaje feérico (ventaja contra hechizado, inmune a dormir mágico), Trance (descanso largo en 4h de meditación), Velocidad 9m.\n\n**Subrazas:** Elfo del bosque (+Des, +Sab, velocidad 10,5m, ocultarse en naturaleza), Alto elfo (+Des, +Int, truco de mago, idioma extra).' },
      { title: 'Enano', content: 'Valientes y resistentes, los enanos son conocidos como guerreros hábiles, mineros y trabajadores de la piedra.\n\n**Rasgos:** Visión en la oscuridad 18m, Resiliencia enana (ventaja en salvaciones contra veneno, resistencia al daño de veneno), Entrenamiento de combate enano, Competencia con herramientas, Velocidad 7,5m (no reducida por armadura).\n\n**Subrazas:** Enano de las colinas (+Sab, +1 PG/nivel, competencia en Percepción), Enano de las montañas (+Fue, competencia con armaduras ligeras y medias).' },
      { title: 'Humano', content: 'Con su capacidad de adaptarse y prosperar en cualquier situación, los humanos son los más extendidos y versátiles de todas las razas.\n\n**Rasgos:** +1 a todas las características, un idioma adicional.\n\n**Variante (opcional con el DM):** En vez de +1 a todo, ganan: +1 a dos características, una dote, una competencia en una habilidad.' },
    ]
  },
  {
    id: 'clases', label: '🗡 Clases', color: '#4a7fa5',
    topics: [
      { title: 'Paladín', content: 'Un guerrero sagrado ligado a un juramento solemne.\n\n**Puntos de golpe:** 1d10 por nivel\n**Armadura:** Todas, incluyendo escudos\n**Armas:** Simples y marciales\n\n**Rasgos principales:**\n• Sentido divino: detecta celestiales, infernales y muertos vivientes\n• Imponer manos: reserva de PG = 5 × nivel\n• Estilo de combate (Nv2)\n• Lanzamiento de conjuros (Nv2): aptitud = Carisma\n• Castigo divino (Nv2): daño extra radiante o necrótico\n• Aura de protección (Nv6): aliados + mod. Carisma a salvaciones\n• Maestría con armas\n• Canalizar divinidad (Nv3): usos según subclase' },
      { title: 'Bardo', content: 'Un artista épico cuyos poderes mágicos surgen de la música y la poesía.\n\n**Puntos de golpe:** 1d8 por nivel\n**Armadura:** Ligera\n**Armas:** Simples, ballestas de mano, espadas largas, rapiers, espadas cortas\n\n**Rasgos principales:**\n• Inspiración bárdica: dado de inspiración (d6 → d8 → d10 → d12)\n• Aprendiz de todo: mitad del bono de competencia en todo lo que no seas competente\n• Pericia (Nv3): duplica bono en 2 habilidades\n• Canción de descanso: aliados recuperan PG adicionales en descansos\n• Contramagia (Nv6)' },
      { title: 'Guerrero', content: 'Un maestro del combate con armas y armaduras.\n\n**Puntos de golpe:** 1d10 por nivel\n**Armadura:** Todas, incluyendo escudos\n**Armas:** Simples y marciales\n\n**Rasgos principales:**\n• Estilo de combate\n• Recuperación (Nv2): recupera usos de Acción de combate en descanso corto\n• Acción de combate: ataque adicional en tu turno\n• Ataque extra (Nv5): dos ataques por turno\n• Resistencia indomable: reutilizar tiradas de salvación fallidas' },
      { title: 'Mago', content: 'Un usuario de magia erudito capaz de manipular las estructuras de la realidad.\n\n**Puntos de golpe:** 1d6 por nivel\n**Armadura:** Ninguna\n**Armas:** Simples\n\n**Rasgos principales:**\n• Libro de conjuros: aprende 6 + Int trucos/conjuros al Nv1\n• Recuperación arcana: recupera espacios en descanso corto\n• Aptitud mágica: Inteligencia\n• Lanzamiento de rituales' },
    ]
  },
  {
    id: 'combate', label: '⚡ Combate', color: '#8b1a1a',
    topics: [
      { title: 'Estructura de un turno', content: 'En tu turno podés hacer:\n\n🔵 **Acción:** Atacar, lanzar un conjuro, Ayudar, Buscar, Correr, Esquivar, Prepararse, Usar objeto\n\n🟡 **Acción adicional:** Solo si un rasgo o conjuro te la otorga\n\n🟢 **Movimiento:** Tu velocidad completa, dividida como quieras\n\n⚪ **Reacción:** Una por ronda, fuera de tu turno (ej: ataque de oportunidad)\n\n**Acción de magia:** Término específico de 2024. Distinto de acción y acción adicional. Algunos rasgos requieren "acción de magia" específicamente.' },
      { title: 'Ataques y tiradas', content: '**Tirada de ataque:** 1d20 + bonificador de ataque\n\nBonificador de ataque = modificador de característica + bonificador de competencia (si sos competente)\n\n**CA:** La defensa del objetivo. Si tu tirada ≥ CA, acertás.\n\n**Crítico:** Con 20 natural, acertás automáticamente y duplicás todos los dados de daño.\n\n**Fallo automático:** Con 1 natural, fallás sin importar los bonificadores.\n\n**Ventaja/Desventaja:** Tirás 2d20 y te quedás con el mayor (ventaja) o el menor (desventaja).' },
      { title: 'Condiciones', content: '**Asustado:** Solo puede hacer UNA de: moverse, acción o acción adicional por turno. No puede acercarse voluntariamente a la fuente del miedo.\n\n**Apresado:** Velocidad 0. Los ataques contra él tienen ventaja. Sus ataques tienen desventaja.\n\n**Incapacitado:** No puede hacer acciones ni acciones adicionales.\n\n**Paralizado:** Incapacitado, no puede moverse ni hablar. Falla salvaciones de Fue y Des. Los ataques contra él tienen ventaja. Los que aciertan a menos de 1,5m son críticos automáticos.\n\n**Envenenado:** Desventaja en tiradas de ataque y pruebas de habilidad.\n\n**Derribado (Tumbado):** Velocidad dividida a la mitad para levantarse. Ataques cuerpo a cuerpo contra él tienen ventaja. Ataques a distancia tienen desventaja.' },
      { title: 'Concentración', content: 'Muchos conjuros requieren **concentración** para mantenerse activos.\n\n**Reglas clave:**\n• Solo podés concentrarte en UN conjuro a la vez. Si lanzás otro de concentración, el anterior termina automáticamente.\n• Si recibís daño mientras te concentrás, tirás salvación de Constitución (CD = 10 o la mitad del daño, lo que sea mayor). Si fallás, perdés la concentración.\n• Acciones que interrumpen la concentración: quedar incapacitado, morir.\n\n**Conjuros de concentración comunes del paladín:** Favor divino, Marca del cazador, Perdición, Golpe apresador, Fuego feérico.' },
    ]
  },
  {
    id: 'conjuros', label: '✨ Conjuros', color: '#5a8a5a',
    topics: [
      { title: 'Cómo funcionan los conjuros', content: '**Espacios de conjuro:** "Combustible" para lanzar conjuros. Se recuperan con descanso largo. Un conjuro de Nv1 puede lanzarse con un espacio de Nv1 o mayor.\n\n**Lanzamiento mejorado:** Al usar un espacio de nivel mayor, muchos conjuros escalan (más daño, más objetivos, etc.).\n\n**Conjuros preparados:** Los paladines y clérigos preparan conjuros cada día. Los bardos y magos los conocen permanentemente.\n\n**Rituales:** Ciertos conjuros pueden lanzarse como ritual (10 min extra, sin gastar espacio).\n\n**CD de salvación:** 8 + bonificador de competencia + modificador de aptitud mágica.' },
      { title: 'Conjuros de Paladín Nv1', content: '**Bendición** (Conc.): Hasta 3 criaturas ganan +1d4 a ataques y salvaciones.\n\n**Castigo abrasador** (Conc.): Daño extra de fuego al acertar + el objetivo no puede volverse invisible.\n\n**Castigo atronador:** Daño extra de trueno + empuja al objetivo 3m.\n\n**Castigo furioso:** Daño extra necrótico + objetivo asustado de vos.\n\n**Curar heridas:** Restaura 2d8 + mod. de aptitud PG con un toque.\n\n**Escudo de fe** (Conc.): +2 CA a una criatura.\n\n**Favor divino** (Conc.): +1d4 daño radiante en cada ataque que acertes.\n\n**Golpe apresador** (Conc.): Daño extra + objetivo apresado si falla Fue.\n\n**Marca del cazador** (Conc.): Marcás un objetivo, +1d6 daño cada vez que lo atacás.' },
      { title: 'Conjuros de Bardo Nv1-2', content: '**Nv0 (Trucos):**\n• Burla viciosa: 1d6 daño psíquico + desventaja en el siguiente ataque\n• Ilusión menor: sonidos o imágenes pequeñas\n\n**Nv1:**\n• Palabra sanadora: 2d4+mod PG a distancia (ac. adicional)\n• Susurros disonantes: 3d6 psíquico + objetivo se aleja\n• Fuego feérico (Conc.): ventaja del grupo contra objetivos iluminados\n• Risa horrenda de Tasha (Conc.): derriba e incapacita\n\n**Nv2:**\n• Sugestión (Conc.): control mágico de una acción razonable\n• Inmovilizar persona (Conc.): paraliza un humanoide → críticos automáticos c/c\n• Imagen múltiple: 3 duplicados que absorben ataques' },
    ]
  },
  {
    id: 'dm', label: '👁 Para el DM', color: '#7a5a9a',
    topics: [
      { title: 'Escalar dificultad', content: '**Umbrales de XP por encuentro (Nv3, grupo de 4):**\n• Fácil: 300 XP\n• Medio: 600 XP\n• Difícil: 900 XP\n• Mortal: 1400 XP\n\n**Multiplicador por cantidad de enemigos:**\n• 1 enemigo: ×1\n• 2 enemigos: ×1.5\n• 3-6 enemigos: ×2\n• 7-10 enemigos: ×2.5\n\n**Tipos de encuentro:**\n• Combate: 1-3 rondas = 3-4 acciones por personaje\n• Social: Tiradas de Persuasión/Engaño/Intimidación\n• Exploración: Percepción, Supervivencia, Investigación' },
      { title: 'NPCs y monstruos', content: '**PV típicos a nivel 3:**\n• Goblin: 7 PG, CA 15, ataque +4, daño 1d6+2\n• Bandido: 11 PG, CA 12, ataque +3, daño 1d6+1\n• Guardia: 11 PG, CA 16, ataque +3, daño 1d6+1\n• Orco: 15 PG, CA 13, ataque +5, daño 1d12+3\n• Cultista: 9 PG, CA 12, ataque +3, daño 1d4+1\n• Esqueleto: 13 PG, CA 13, ataque +4, daño 1d6+2\n\n**NPC memorable = 1 rasgo físico + 1 motivación + 1 peculiaridad de habla**' },
      { title: 'Recompensas y XP', content: '**XP por CR (Challenge Rating):**\n• CR 1/8: 25 XP (rata, goblin)\n• CR 1/4: 50 XP (skeleton, lobo)\n• CR 1/2: 100 XP (orco, zombie)\n• CR 1: 200 XP (guardia de élite)\n• CR 2: 450 XP (sacerdote, gnoll)\n• CR 3: 700 XP (vampiro joven, mago)\n\n**Hitos narrativos sugeridos:**\n• Completar una misión menor: 50-150 XP\n• Completar arco principal: 300-500 XP\n• Decisión importante con consecuencias: 100 XP\n• Roleplay excepcional: 25-50 XP bonus' },
      { title: 'Consejos de narración', content: '**El loop de juego básico:**\n1. El DM describe la situación\n2. Los jugadores declaran sus acciones\n3. El DM determina el resultado\n4. Repetir\n\n**Regla del "Sí, y..." y "Sí, pero...":**\nEn lugar de bloquear ideas de los jugadores, encontrá formas de incorporarlas con consecuencias interesantes.\n\n**Las 3 claves de una sesión memorable:**\n• Un momento de tensión real\n• Un momento de victoria satisfactoria\n• Una revelación o giro inesperado\n\n**Gestión del tiempo:**\nUna sesión típica de 3-4 horas = 1-2 encuentros de combate + 1-2 escenas de exploración/social.' },
    ]
  },
];

export default function Manual() {
  const [activeSection, setActiveSection] = useState('razas');
  const [activeTopic, setActiveTopic] = useState(null);
  const [search, setSearch] = useState('');

  const currentSection = SECTIONS.find(s => s.id === activeSection);

  const filteredTopics = search.trim()
    ? SECTIONS.flatMap(s => s.topics.map(t => ({ ...t, sectionLabel: s.label, sectionColor: s.color })))
        .filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase()))
    : currentSection?.topics || [];

  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <div key={i} style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1px', color: 'var(--gold)', textTransform: 'uppercase', margin: '10px 0 4px' }}>{line.replace(/\*\*/g, '')}</div>;
      }
      if (line.startsWith('• ')) {
        return <div key={i} style={{ paddingLeft: '12px', marginBottom: '3px', color: 'var(--parchment-dim)', fontSize: '14px', lineHeight: '1.6' }}>• {line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</div>;
      }
      if (line === '') return <div key={i} style={{ height: '6px' }} />;
      return <div key={i} style={{ marginBottom: '3px', color: 'var(--parchment-dim)', fontSize: '14px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold-bright)">$1</strong>') }} />;
    });
  };

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroLabel}>Referencia de Reglas</div>
        <h1 style={s.heroTitle}>MANUAL</h1>
        <p style={s.heroSub}>Manual del Jugador 2024 · Consulta rápida</p>
      </div>

      {/* SEARCH */}
      <div style={s.searchWrap}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveTopic(null); }}
          style={s.searchInput}
          placeholder="🔍  Buscar en el manual... (ej: concentración, asustado, paladín)"
        />
      </div>

      {!search && (
        <div style={s.tabs}>
          {SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => { setActiveSection(sec.id); setActiveTopic(null); }}
              style={{ ...s.tab, ...(activeSection === sec.id ? { ...s.tabActive, borderColor: sec.color, color: sec.color } : {}) }}>
              {sec.label}
            </button>
          ))}
        </div>
      )}

      <div style={s.layout}>
        {/* TOPIC LIST */}
        <div style={s.topicList}>
          {search && filteredTopics.length === 0 && (
            <div style={{ fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', color: 'var(--gold-dim)', padding: '20px', textAlign: 'center' }}>Sin resultados para "{search}"</div>
          )}
          {filteredTopics.map((topic, i) => (
            <button key={i} onClick={() => setActiveTopic(topic)}
              style={{ ...s.topicBtn, ...(activeTopic?.title === topic.title ? s.topicBtnActive : {}) }}>
              <div style={s.topicTitle}>{topic.title}</div>
              {topic.sectionLabel && <div style={{ fontSize: '10px', color: topic.sectionColor, fontFamily: 'Cinzel,serif', letterSpacing: '1px', marginTop: '2px', opacity: 0.85 }}>{topic.sectionLabel}</div>}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={s.content}>
          {activeTopic
            ? <>
                <div style={s.contentTitle}>{activeTopic.title}</div>
                <div style={s.contentDivider} />
                <div style={s.contentBody}>{renderContent(activeTopic.content)}</div>
              </>
            : <div style={s.contentEmpty}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📖</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>Seleccioná un tema</div>
              </div>
          }
        </div>
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: 'var(--gold-bright)', textShadow: '0 0 30px rgba(227,200,120,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'var(--gold-dim)', marginTop: '8px' },
  searchWrap: { marginBottom: '16px' },
  searchInput: { width: '100%', background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '12px 16px', outline: 'none' },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  tab: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  tabActive: { background: 'rgba(201,164,73,0.08)' },
  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '12px', alignItems: 'start' },
  topicList: { display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '70px' },
  topicBtn: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '10px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' },
  topicBtnActive: { background: 'rgba(201,164,73,0.1)', borderColor: 'var(--gold-dim)' },
  topicTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '600', color: 'var(--gold-bright)', letterSpacing: '0.5px' },
  content: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '20px', minHeight: '400px' },
  contentTitle: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '1px' },
  contentDivider: { height: '1px', background: 'linear-gradient(to right, var(--gold-dim), transparent)', margin: '12px 0' },
  contentBody: { lineHeight: '1.7' },
  contentEmpty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' },
  '@media (max-width: 600px)': { layout: { gridTemplateColumns: '1fr' } },
};
