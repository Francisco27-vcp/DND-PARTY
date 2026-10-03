// src/components/CharacterWizard.js
import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadImage } from '../lib/uploadImage';
import CLASSES_DATA from '../data/classes.json';
import SPECIES_DATA from '../data/species.json';
import BACKGROUNDS_DATA from '../data/backgrounds.json';
import ALL_FEATS from '../data/feats.json';
import ALL_ITEMS from '../data/items.json';
import {
  STAT_KEYS, STAT_ABBR, SKILLS, profBonus,
  computeDefaultSlots, computeCastingInfo, computeClassResourceDefs, mergeClassResources,
  XP_THRESHOLDS, HelpTip, SpellPickerModal,
} from '../pages/CharacterSheet';

const CLASS_MAP = Object.fromEntries(CLASSES_DATA.map(c => [c.id, c]));
const SPECIES_MAP = Object.fromEntries(SPECIES_DATA.map(s => [s.id, s]));
const BG_MAP = Object.fromEntries(BACKGROUNDS_DATA.map(b => [b.id, b]));
const FEATS_MAP = Object.fromEntries(ALL_FEATS.map(f => [f.id, f]));
const SKILLS_MAP = Object.fromEntries(SKILLS.map(s => [s.id, s]));

function normName(n) {
  return (n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
const ITEMS_BY_NAME = Object.fromEntries(ALL_ITEMS.map(i => [normName(i.nombre), i]));
const ARMOR_BY_NAME = Object.fromEntries(ALL_ITEMS.filter(i => i.tipo === 'armor').map(i => [normName(i.nombre), i]));

const DIFFICULTY_COLOR = { 'Fácil': 'var(--green-1)', 'Media': 'var(--gold-1)', 'Compleja': 'var(--ember)' };

const CLASS_PRIORITY = {
  barbaro:    ['fue', 'con', 'des', 'sab', 'car', 'int'],
  guerrero:   ['fue', 'con', 'des', 'sab', 'car', 'int'],
  explorador: ['des', 'sab', 'con', 'fue', 'int', 'car'],
  picaro:     ['des', 'con', 'sab', 'car', 'int', 'fue'],
  monje:      ['des', 'sab', 'con', 'fue', 'int', 'car'],
  bardo:      ['car', 'des', 'con', 'sab', 'int', 'fue'],
  clerigo:    ['sab', 'con', 'car', 'fue', 'des', 'int'],
  druida:     ['sab', 'con', 'des', 'int', 'car', 'fue'],
  hechicero:  ['car', 'con', 'des', 'sab', 'int', 'fue'],
  mago:       ['int', 'con', 'des', 'sab', 'car', 'fue'],
  brujo:      ['car', 'con', 'des', 'sab', 'int', 'fue'],
  paladin:    ['car', 'fue', 'con', 'sab', 'des', 'int'],
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const STANDARD_RECOMMENDED = [15, 14, 13, 12, 10, 8];
const POINT_BUY_RECOMMENDED = [15, 14, 14, 10, 10, 8];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;

const ALIGNMENTS = [
  'Legal Bueno', 'Neutral Bueno', 'Caótico Bueno',
  'Legal Neutral', 'Neutral', 'Caótico Neutral',
  'Legal Malvado', 'Neutral Malvado', 'Caótico Malvado',
];
const ICONS = ['⚔️', '🎵', '🔮', '🏹', '🛡️', '⚡', '🌿', '🔥', '❄️', '☠️', '✨', '🐉'];
const COLORS = ['#c9a84c', '#4a7fa5', '#8b1a1a', '#5a8a5a', '#7a5a9a', '#4a7a7a', '#a57a4a', '#6a4a8a'];

const fmtMod = n => (n >= 0 ? `+${n}` : `${n}`);
const statMod = score => Math.floor(((score || 10) - 10) / 2);

function buildRecommendedAssign(classId, values) {
  const order = CLASS_PRIORITY[classId] || STAT_KEYS;
  const out = {};
  order.forEach((stat, i) => { out[stat] = values[i]; });
  return out;
}

function computeStartingAC(classData, option, desMod, finalStats) {
  const items = classData.equipoInicial[option]?.items || [];
  let base = 10 + desMod;
  let hasArmor = false;
  let shield = false;
  items.forEach(name => {
    const armor = ARMOR_BY_NAME[normName(name)];
    if (armor) {
      hasArmor = true;
      const dm = armor.armorType === 'medium' ? Math.min(desMod, 2) : armor.armorType === 'heavy' ? 0 : desMod;
      base = armor.caBase + dm;
    }
    if (/escudo/i.test(name)) shield = true;
  });
  // Defensa sin armadura: Bárbaro (DES+CON) y Monje (DES+SAB), solo si no llevan armadura.
  if (!hasArmor && finalStats) {
    if (classData.id === 'barbaro') base = 10 + desMod + statMod(finalStats.con);
    if (classData.id === 'monje') base = 10 + desMod + statMod(finalStats.sab);
  }
  return base + (shield ? 2 : 0);
}

function matchInventory(itemNames) {
  const matched = [];
  const unmatched = [];
  itemNames.forEach(name => {
    const item = ITEMS_BY_NAME[normName(name)];
    if (item) matched.push({ itemId: item.id, equipped: item.tipo === 'weapon' || item.tipo === 'armor', quantity: 1 });
    else unmatched.push(name);
  });
  return { matched, unmatched };
}

// ── STEP DEFINITIONS ─────────────────────────────────────────────────────────
const STEP_LABELS = ['Clase', 'Especie', 'Trasfondo', 'Atributos', 'Habilidades', 'Conjuros', 'Detalles', 'Resumen'];

export default function CharacterWizard({ user, isAdmin, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [classId, setClassId] = useState(null);
  const [speciesId, setSpeciesId] = useState(null);
  const [backgroundId, setBackgroundId] = useState(null);
  const [bgAsiMode, setBgAsiMode] = useState('2-1');
  const [bgAsiPlus2, setBgAsiPlus2] = useState(null);
  const [bgAsiPlus1, setBgAsiPlus1] = useState(null);
  const [statMode, setStatMode] = useState('estandar');
  const [standardAssign, setStandardAssign] = useState({ fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 });
  const [pointBuy, setPointBuy] = useState({ fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 });
  const [chosenSkills, setChosenSkills] = useState([]);
  const [equipOption, setEquipOption] = useState('a');
  const [chosenCantrips, setChosenCantrips] = useState([]);
  const [chosenSpells, setChosenSpells] = useState([]);
  const [name, setName] = useState('');
  const [alignment, setAlignment] = useState('Neutral');
  const [portrait, setPortrait] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [ownerEmailOverride, setOwnerEmailOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [error, setError] = useState('');

  const classData = classId ? CLASS_MAP[classId] : null;
  const speciesData = speciesId ? SPECIES_MAP[speciesId] : null;
  const bgData = backgroundId ? BG_MAP[backgroundId] : null;

  const STEPS = classData?.lanzadora ? STEP_LABELS : STEP_LABELS.filter(l => l !== 'Conjuros');
  const stepKey = STEPS[step];

  // ── Background ASI bonus ──
  const bgBonus = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
  if (bgData) {
    if (bgAsiMode === '1-1-1') {
      bgData.atributos.forEach(a => { bgBonus[a] = 1; });
    } else {
      if (bgAsiPlus2) bgBonus[bgAsiPlus2] = 2;
      if (bgAsiPlus1 && bgAsiPlus1 !== bgAsiPlus2) bgBonus[bgAsiPlus1] = 1;
    }
  }

  const baseStats = statMode === 'estandar' ? standardAssign : pointBuy;
  const finalStats = Object.fromEntries(STAT_KEYS.map(k => [k, Math.min(20, (baseStats[k] || 8) + (bgBonus[k] || 0))]));

  const pointsUsed = STAT_KEYS.reduce((sum, k) => sum + (POINT_COST[pointBuy[k]] ?? 0), 0);
  const pointsLeft = POINT_BUY_BUDGET - pointsUsed;

  const canProceed = () => {
    if (stepKey === 'Clase') return !!classId;
    if (stepKey === 'Especie') return !!speciesId;
    if (stepKey === 'Trasfondo') {
      if (!backgroundId) return false;
      if (bgAsiMode === '2-1') return !!bgAsiPlus2 && !!bgAsiPlus1 && bgAsiPlus2 !== bgAsiPlus1;
      return true;
    }
    if (stepKey === 'Atributos') return statMode === 'estandar' ? true : pointsLeft >= 0;
    if (stepKey === 'Habilidades') return classData ? chosenSkills.length === classData.habilidadesElegir : true;
    if (stepKey === 'Detalles') return name.trim().length > 0;
    return true;
  };

  const goTo = (i) => { if (i <= step || visitedMax >= i) setStep(i); };
  const [visitedMax, setVisitedMax] = useState(0);
  const next = () => { const n = Math.min(STEPS.length - 1, step + 1); setStep(n); setVisitedMax(m => Math.max(m, n)); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const backgroundSkillSet = new Set(bgData?.habilidades || []);
  const classSkillOptions = (classData?.habilidadesOpciones || []).filter(s => !backgroundSkillSet.has(s));

  const toggleSkill = (skillId) => {
    setChosenSkills(prev => {
      if (prev.includes(skillId)) return prev.filter(s => s !== skillId);
      if (classData && prev.length >= classData.habilidadesElegir) return prev;
      return [...prev, skillId];
    });
  };

  const applyRecommendedStats = () => {
    if (!classId) return;
    if (statMode === 'estandar') setStandardAssign(buildRecommendedAssign(classId, STANDARD_RECOMMENDED));
    else setPointBuy(buildRecommendedAssign(classId, POINT_BUY_RECOMMENDED));
  };

  const cycleStandard = (stat, dir) => {
    setStandardAssign(prev => {
      const cur = prev[stat];
      const idx = STANDARD_ARRAY.indexOf(cur);
      const nextIdx = (idx + dir + STANDARD_ARRAY.length) % STANDARD_ARRAY.length;
      const nextVal = STANDARD_ARRAY[nextIdx];
      const otherStat = Object.keys(prev).find(k => prev[k] === nextVal);
      return { ...prev, [stat]: nextVal, [otherStat]: cur };
    });
  };

  const incPoint = (stat) => {
    const cur = pointBuy[stat];
    if (cur >= 15) return;
    const delta = POINT_COST[cur + 1] - POINT_COST[cur];
    if (delta > pointsLeft) return;
    setPointBuy(p => ({ ...p, [stat]: cur + 1 }));
  };
  const decPoint = (stat) => {
    if (pointBuy[stat] <= 8) return;
    setPointBuy(p => ({ ...p, [stat]: p[stat] - 1 }));
  };

  const handlePortraitUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPortrait(true);
    try {
      const url = await uploadImage(file, `portraits/characters/${user.uid}_wizard_${Date.now()}`);
      setPortrait(url);
    } catch (err) { console.error('Error subiendo retrato:', err); }
    setUploadingPortrait(false);
  };

  const castingInfo = classData ? computeCastingInfo(classData.nombre, 1, finalStats) : { modo: null, trucosMax: 0, conjurosMax: 0, maxSpellLevel: 0 };

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const conMod = statMod(finalStats.con);
      const desMod = statMod(finalStats.des);
      const hpMax = classData.dadoDeGolpe + conMod;
      const ac = computeStartingAC(classData, equipOption, desMod, finalStats);

      const skillsObj = {};
      (bgData.habilidades || []).forEach(s => { skillsObj[s] = true; });
      chosenSkills.forEach(s => { skillsObj[s] = true; });

      const savingThrowsObj = {};
      (classData.salvacionesCompetentes || []).forEach(s => { savingThrowsObj[s] = true; });

      const classItems = classData.equipoInicial[equipOption]?.items || [];
      const bgItems = bgData.equipo[equipOption]?.items || [];
      const { matched: classMatched, unmatched: classUnmatched } = matchInventory(classItems);
      const { matched: bgMatched, unmatched: bgUnmatched } = matchInventory(equipOption === 'b' ? [] : bgItems);
      const inventoryItems = [...classMatched, ...bgMatched];
      const extraGold = (classData.equipoInicial[equipOption]?.oro || 0) + (equipOption === 'b' ? (bgData.equipo.b?.oro || 0) : (bgData.equipo.a?.oro || 0));
      const unmatchedNote = [...classUnmatched, ...(equipOption === 'b' ? [] : bgUnmatched)];

      const classResourceDefs = computeClassResourceDefs(classData.nombre, 1, finalStats);
      const classResources = mergeClassResources([], classResourceDefs);

      const featData = FEATS_MAP[bgData.dote];
      const feats = [{ id: bgData.dote, nombre: featData?.nombre || bgData.doteNota, nivelObtenido: 1 }];

      const data = {
        name: name.trim(),
        class: classData.nombre,
        subclass: '',
        race: speciesData.nombre,
        background: bgData.nombre,
        level: 1,
        hp: hpMax,
        hpMax,
        ac,
        xp: 0,
        xpNext: XP_THRESHOLDS[2],
        alignment,
        player: user.email.split('@')[0],
        ownerEmail: isAdmin ? (ownerEmailOverride || user.email) : user.email,
        color,
        icon,
        portrait,
        stats: finalStats,
        skills: skillsObj,
        savingThrows: savingThrowsObj,
        speed: `${speciesData.velocidad}m`,
        inventoryItems,
        classResources,
        feats,
        hitDiceUsed: 0,
        hitDiceTotal: 1,
        deathSaves: { successes: 0, failures: 0 },
        hpTemp: 0,
        inspiration: false,
        conditions: '',
        lore: { historia: bgData.descripcion },
        notes: `Dinero inicial: ${extraGold} po.${unmatchedNote.length ? ` Equipo adicional: ${unmatchedNote.join(', ')}.` : ''}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (classData.lanzadora) {
        data.knownCantrips = chosenCantrips;
        data.preparedSpells = chosenSpells;
        data.spellSlots = computeDefaultSlots(1, classData.nombre);
      }
      await addDoc(collection(db, 'characters'), data);
      onCreated();
    } catch (err) {
      console.error('Error creando personaje:', err);
      setError('No se pudo crear el personaje. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lu-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lu-container" style={{ maxWidth: '820px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '10px', letterSpacing: '3px', color: 'var(--gold-1)', textTransform: 'uppercase' }}>
            ✦ Crear Personaje
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {STEPS.map((label, i) => (
            <div key={label} onClick={() => goTo(i)}
              style={{ flex: '1 1 auto', minWidth: '60px', textAlign: 'center', padding: '7px 6px', borderRadius: '8px', cursor: i <= visitedMax ? 'pointer' : 'default', fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase', border: `1px solid ${i === step ? color : i < visitedMax ? `${color}66` : 'rgba(234,199,94,0.15)'}`, background: i === step ? `${color}25` : i <= visitedMax ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)', color: i === step ? color : i <= visitedMax ? 'var(--text-soft)' : 'var(--text-dim)', opacity: i <= visitedMax ? 1 : 0.5 }}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {error && <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(224,80,80,0.1)', border: '1px solid rgba(224,80,80,0.35)', borderRadius: '8px', color: 'var(--ember)', fontSize: '12px', fontFamily: 'var(--font-ui)' }}>{error}</div>}

        {/* ══ STEP: CLASE ══ */}
        {stepKey === 'Clase' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">1. Elegí tu clase</h2>
              <HelpTip text="La clase define tu rol principal: cómo peleás, si usás magia y qué recursos especiales tenés. No hay elección incorrecta." />
              <div className="cs-card-divider" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {CLASSES_DATA.map(c => {
                const sel = classId === c.id;
                return (
                  <button key={c.id} onClick={() => setClassId(c.id)}
                    style={{ textAlign: 'left', padding: '12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${sel ? color : 'rgba(234,199,94,0.2)'}`, background: sel ? `${color}1f` : 'rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-title)', fontSize: '14px', color: sel ? color : 'var(--text-main)' }}>{c.nombre}</span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: DIFFICULTY_COLOR[c.dificultad] }}>{c.dificultad}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>d{c.dadoDeGolpe} · {c.rol}</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)', lineHeight: '1.35' }}>{c.paraQuienEs}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP: ESPECIE ══ */}
        {stepKey === 'Especie' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">2. Elegí tu especie</h2>
              <HelpTip text="La especie es a qué pueblo pertenece tu personaje (elfo, enano, humano...). Te da rasgos especiales fijos, como visión en la oscuridad o resistencias." />
              <div className="cs-card-divider" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {SPECIES_DATA.map(sp => {
                const sel = speciesId === sp.id;
                return (
                  <button key={sp.id} onClick={() => setSpeciesId(sp.id)}
                    style={{ textAlign: 'left', padding: '12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${sel ? color : 'rgba(234,199,94,0.2)'}`, background: sel ? `${color}1f` : 'rgba(0,0,0,0.25)' }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '14px', color: sel ? color : 'var(--text-main)', marginBottom: '4px' }}>{sp.nombre}</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>Tamaño {sp.tamano} · Velocidad {sp.velocidad}m</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)', lineHeight: '1.35', marginBottom: '6px' }}>{sp.paraQuienEs}</div>
                    <ul style={{ margin: 0, paddingLeft: '14px' }}>
                      {sp.rasgos.map(r => (
                        <li key={r.nombre} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>
                          <strong style={{ color: 'var(--text-soft)' }}>{r.nombre}:</strong> {r.descripcion}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP: TRASFONDO ══ */}
        {stepKey === 'Trasfondo' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">3. Elegí tu trasfondo</h2>
              <HelpTip text="El trasfondo es a qué te dedicabas antes de ser aventurero. Te da el aumento de dos o tres atributos, una dote y dos habilidades." />
              <div className="cs-card-divider" />
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '14px', paddingRight: '4px' }}>
              {BACKGROUNDS_DATA.map(bg => {
                const sel = backgroundId === bg.id;
                return (
                  <button key={bg.id} onClick={() => { setBackgroundId(bg.id); setBgAsiPlus2(null); setBgAsiPlus1(null); }}
                    style={{ textAlign: 'left', padding: '10px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${sel ? color : 'rgba(234,199,94,0.2)'}`, background: sel ? `${color}1f` : 'rgba(0,0,0,0.25)' }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '13px', color: sel ? color : 'var(--text-main)', marginBottom: '3px' }}>{bg.nombre}</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)' }}>{bg.atributos.map(a => STAT_ABBR[a]).join('/')}</div>
                  </button>
                );
              })}
            </div>

            {bgData && (
              <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}55`, borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '10px', fontStyle: 'italic' }}>{bgData.descripcion}</div>

                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
                    Aumento de atributos
                    <HelpTip text="Elegí: subir un atributo +2 y otro +1 (de los tres del trasfondo), o subir los tres +1 cada uno." />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {['2-1', '1-1-1'].map(mode => (
                      <button key={mode} onClick={() => setBgAsiMode(mode)}
                        style={{ padding: '6px 12px', borderRadius: '8px', fontFamily: 'var(--font-ui)', fontSize: '11px', cursor: 'pointer', border: `1px solid ${bgAsiMode === mode ? color : 'rgba(234,199,94,0.2)'}`, background: bgAsiMode === mode ? `${color}25` : 'rgba(0,0,0,0.3)', color: bgAsiMode === mode ? color : 'var(--text-dim)' }}>
                        {mode === '2-1' ? '+2 / +1' : '+1 / +1 / +1'}
                      </button>
                    ))}
                  </div>
                  {bgAsiMode === '2-1' ? (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                        +2 a:{' '}
                        <select value={bgAsiPlus2 || ''} onChange={e => setBgAsiPlus2(e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-main)', border: '1px solid rgba(234,199,94,0.25)', borderRadius: '6px', padding: '4px 8px' }}>
                          <option value="">—</option>
                          {bgData.atributos.map(a => <option key={a} value={a}>{STAT_ABBR[a]}</option>)}
                        </select>
                      </label>
                      <label style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                        +1 a:{' '}
                        <select value={bgAsiPlus1 || ''} onChange={e => setBgAsiPlus1(e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-main)', border: '1px solid rgba(234,199,94,0.25)', borderRadius: '6px', padding: '4px 8px' }}>
                          <option value="">—</option>
                          {bgData.atributos.filter(a => a !== bgAsiPlus2).map(a => <option key={a} value={a}>{STAT_ABBR[a]}</option>)}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)' }}>
                      +1 a {bgData.atributos.map(a => STAT_ABBR[a]).join(', ')}.
                    </div>
                  )}
                </div>

                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)', marginBottom: '4px' }}>
                  <strong>Dote de origen:</strong> {FEATS_MAP[bgData.dote]?.nombre || bgData.doteNota}
                  <HelpTip text="Una dote es un talento especial gratis que te da el trasfondo. Ya viene elegida, no hay que decidir nada más acá." />
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)' }}>
                  <strong>Habilidades:</strong> {bgData.habilidades.map(h => SKILLS_MAP[h]?.nombre || h).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP: ATRIBUTOS ══ */}
        {stepKey === 'Atributos' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">4. Asigná tus atributos</h2>
              <HelpTip text="Los atributos definen casi todo lo que tu personaje puede hacer. El modificador (entre paréntesis) es lo que realmente sumás a tus tiradas." />
              <div className="cs-card-divider" />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {['estandar', 'compra'].map(m => (
                <button key={m} onClick={() => setStatMode(m)}
                  style={{ padding: '8px 14px', borderRadius: '8px', fontFamily: 'var(--font-ui)', fontSize: '11px', cursor: 'pointer', border: `1px solid ${statMode === m ? color : 'rgba(234,199,94,0.2)'}`, background: statMode === m ? `${color}25` : 'rgba(0,0,0,0.3)', color: statMode === m ? color : 'var(--text-dim)' }}>
                  {m === 'estandar' ? 'Conjunto estándar' : 'Compra de puntos'}
                </button>
              ))}
              <HelpTip text="Conjunto estándar: repartís los números 15,14,13,12,10,8 entre tus atributos. Compra de puntos: tenés 27 puntos y cada atributo cuesta más cuanto más alto lo subís." />
              <button onClick={applyRecommendedStats} disabled={!classId}
                style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', fontFamily: 'var(--font-title)', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: classId ? 'pointer' : 'not-allowed', border: `1px solid ${color}`, background: `${color}20`, color, opacity: classId ? 1 : 0.4 }}>
                ✦ Recomendado para {classData?.nombre || 'tu clase'}
              </button>
            </div>

            {statMode === 'compra' && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: pointsLeft < 0 ? 'var(--ember)' : 'var(--text-soft)', marginBottom: '10px' }}>
                Puntos disponibles: <strong>{pointsLeft}</strong> / {POINT_BUY_BUDGET}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              {STAT_KEYS.map(stat => {
                const base = baseStats[stat];
                const bonus = bgBonus[stat];
                const total = finalStats[stat];
                return (
                  <div key={stat} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{STAT_ABBR[stat]}</div>
                    {statMode === 'estandar' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '4px 0' }}>
                        <button onClick={() => cycleStandard(stat, -1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px' }}>◀</button>
                        <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--text-main)' }}>{base}</span>
                        <button onClick={() => cycleStandard(stat, 1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px' }}>▶</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '4px 0' }}>
                        <button onClick={() => decPoint(stat)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px' }}>◀</button>
                        <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--text-main)' }}>{base}</span>
                        <button onClick={() => incPoint(stat)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px' }}>▶</button>
                      </div>
                    )}
                    {bonus > 0 && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--green-1)' }}>+{bonus} trasfondo</div>}
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color, marginTop: '2px' }}>{total} ({fmtMod(statMod(total))})</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP: HABILIDADES ══ */}
        {stepKey === 'Habilidades' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">5. Habilidades y equipo</h2>
              <HelpTip text="Las habilidades competentes sumán tu bonificador por competencia a esas pruebas. El equipo inicial define con qué arrancás." />
              <div className="cs-card-divider" />
            </div>
            {classData && (
              <>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '8px' }}>
                  Elegí {classData.habilidadesElegir} habilidades de clase — {chosenSkills.length}/{classData.habilidadesElegir} elegidas
                  {bgData && <span style={{ color: 'var(--text-dim)' }}> (ya tenés {bgData.habilidades.map(h => SKILLS_MAP[h]?.nombre).join(' y ')} por tu trasfondo)</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {classSkillOptions.map(skillId => {
                    const sel = chosenSkills.includes(skillId);
                    const blocked = !sel && chosenSkills.length >= classData.habilidadesElegir;
                    return (
                      <button key={skillId} onClick={() => toggleSkill(skillId)} disabled={blocked}
                        style={{ padding: '7px 12px', borderRadius: '99px', fontFamily: 'var(--font-ui)', fontSize: '11px', cursor: blocked ? 'not-allowed' : 'pointer', border: `1px solid ${sel ? color : 'rgba(234,199,94,0.2)'}`, background: sel ? `${color}25` : 'rgba(0,0,0,0.3)', color: sel ? color : blocked ? 'var(--text-dim)' : 'var(--text-soft)', opacity: blocked ? 0.5 : 1 }}>
                        {SKILLS_MAP[skillId]?.nombre || skillId}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '8px' }}>Equipo inicial</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {['a', 'b'].map(opt => {
                    const sel = equipOption === opt;
                    const classEq = classData.equipoInicial[opt];
                    const bgEq = bgData?.equipo?.[opt];
                    return (
                      <button key={opt} onClick={() => setEquipOption(opt)}
                        style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${sel ? color : 'rgba(234,199,94,0.2)'}`, background: sel ? `${color}1f` : 'rgba(0,0,0,0.25)' }}>
                        <div style={{ fontFamily: 'var(--font-title)', fontSize: '12px', color: sel ? color : 'var(--text-main)', marginBottom: '4px', textTransform: 'uppercase' }}>Opción {opt.toUpperCase()}</div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-soft)', lineHeight: '1.4' }}>
                          {classEq.items.length > 0 ? classEq.items.join(', ') : null}
                          {classEq.oro > 0 && `${classEq.items.length ? ' y ' : ''}${classEq.oro} po`}
                          {bgData && opt === 'a' && bgEq?.items.length > 0 && <><br /><em>+ (trasfondo) {bgEq.items.join(', ')}{bgEq.oro ? ` y ${bgEq.oro} po` : ''}</em></>}
                          {bgData && opt === 'b' && <><br /><em>+ (trasfondo) {bgData.equipo.b.oro} po</em></>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ STEP: CONJUROS ══ */}
        {stepKey === 'Conjuros' && classData?.lanzadora && (
          <SpellPickerModal
            charClass={classData.nombre} accent={color} castingInfo={castingInfo}
            initialCantrips={chosenCantrips} initialSpells={chosenSpells}
            onClose={back}
            onConfirm={(c, sList) => { setChosenCantrips(c); setChosenSpells(sList); next(); }}
          />
        )}

        {/* ══ STEP: DETALLES ══ */}
        {stepKey === 'Detalles' && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">{STEPS.indexOf('Detalles') + 1}. Detalles finales</h2>
              <HelpTip text="El nombre y la foto son lo que todos ven de tu personaje. El alineamiento es solo de referencia narrativa." />
              <div className="cs-card-divider" />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                {portrait
                  ? <img src={portrait} alt="retrato" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '10px', border: `2px solid ${color}` }} />
                  : <div style={{ width: '96px', height: '96px', borderRadius: '10px', border: '1px dashed rgba(234,199,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{icon}</div>}
                <label style={{ display: 'block', marginTop: '6px', fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--gold-1)', cursor: 'pointer' }}>
                  {uploadingPortrait ? 'Subiendo...' : '🖼 Subir foto'}
                  <input type="file" accept="image/*" onChange={handlePortraitUpload} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                  Nombre
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del personaje"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.25)', borderRadius: '8px', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                </label>
                <label style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                  Alineamiento
                  <select value={alignment} onChange={e => setAlignment(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.25)', borderRadius: '8px', color: 'var(--text-main)' }}>
                    {ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </label>
                {isAdmin && (
                  <label style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                    Email del jugador (opcional, por defecto el tuyo)
                    <input value={ownerEmailOverride} onChange={e => setOwnerEmailOverride(e.target.value)} placeholder="jugador@email.com"
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.25)', borderRadius: '8px', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                  </label>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>Icono</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)}
                    style={{ fontSize: '20px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', background: icon === ic ? `${color}30` : 'transparent', border: icon === ic ? `1px solid ${color}` : '1px solid transparent' }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>Color</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {COLORS.map(col => (
                  <button key={col} onClick={() => setColor(col)}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', background: col, cursor: 'pointer', border: color === col ? '2px solid white' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP: RESUMEN ══ */}
        {stepKey === 'Resumen' && classData && speciesData && bgData && (
          <div className="cs-fantasy-card">
            <div className="cs-card-header">
              <h2 className="cs-card-title">{STEPS.length}. Resumen</h2>
              <div className="cs-card-divider" />
            </div>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
              {portrait
                ? <img src={portrait} alt="retrato" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '10px', border: `2px solid ${color}` }} />
                : <div style={{ width: '64px', height: '64px', borderRadius: '10px', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>{icon}</div>}
              <div>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color }}>{name || 'Sin nombre'}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-dim)' }}>{speciesData.nombre} · {classData.nombre} · {bgData.nombre} · Nivel 1</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginBottom: '14px' }}>
              <SummaryTile label="PG" value={`${classData.dadoDeGolpe + statMod(finalStats.con)}`} />
              <SummaryTile label="CA" value={computeStartingAC(classData, equipOption, statMod(finalStats.des), finalStats)} />
              <SummaryTile label="Velocidad" value={`${speciesData.velocidad}m`} />
              <SummaryTile label="Prof." value={fmtMod(profBonus(1))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '6px', marginBottom: '14px' }}>
              {STAT_KEYS.map(stat => (
                <div key={stat} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px 4px' }}>
                  <div style={{ fontFamily: 'var(--font-title)', fontSize: '8px', color: 'var(--text-dim)' }}>{STAT_ABBR[stat]}</div>
                  <div style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--text-main)' }}>{finalStats[stat]}</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color }}>{fmtMod(statMod(finalStats[stat]))}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '6px' }}>
              <strong>Salvaciones:</strong> {classData.salvacionesCompetentes.map(s => STAT_ABBR[s]).join(', ')}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '6px' }}>
              <strong>Habilidades:</strong> {[...new Set([...(bgData.habilidades || []), ...chosenSkills])].map(s => SKILLS_MAP[s]?.nombre || s).join(', ')}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '6px' }}>
              <strong>Dote:</strong> {FEATS_MAP[bgData.dote]?.nombre || bgData.doteNota}
            </div>
            {classData.lanzadora && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginBottom: '6px' }}>
                <strong>Conjuros:</strong> {[...chosenCantrips, ...chosenSpells].length === 0 ? 'ninguno elegido' : [...chosenCantrips, ...chosenSpells].length + ' elegidos'}
              </div>
            )}
            <button onClick={handleCreate} disabled={saving} className="lu-confirm-btn"
              style={{ marginTop: '14px', borderColor: color, color, background: `${color}20` }}>
              {saving ? 'Creando...' : '✦ Crear personaje'}
            </button>
          </div>
        )}

        {/* Navigation (hidden during the embedded spell-picker step, which has its own nav) */}
        {stepKey !== 'Conjuros' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', gap: '8px' }}>
            <button onClick={step > 0 ? back : onClose}
              style={{ background: 'transparent', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '11px', padding: '9px 20px', cursor: 'pointer', borderRadius: '8px' }}>
              {step > 0 ? '← Atrás' : 'Cancelar'}
            </button>
            {stepKey !== 'Resumen' && (
              <button onClick={next} disabled={!canProceed()}
                style={{ background: canProceed() ? `${color}22` : 'rgba(0,0,0,0.2)', border: `1px solid ${canProceed() ? color + '88' : 'rgba(234,199,94,0.15)'}`, color: canProceed() ? color : 'var(--text-dim)', fontFamily: 'var(--font-title)', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 24px', cursor: canProceed() ? 'pointer' : 'not-allowed', borderRadius: '8px' }}>
                Siguiente →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '8px', padding: '8px 4px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)' }}>{value}</div>
    </div>
  );
}
