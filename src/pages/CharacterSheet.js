// src/pages/CharacterSheet.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';
import ALL_ITEMS from '../data/items.json';
import ALL_SPELLS from '../data/spells.json';
import GameIcon from '../components/GameIcon';
import ICONS from '../data/gameicons';
import '../styles/CharacterSheet.css';

// Per-class color theme
function classTheme(cls) {
  const k = (cls || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (k.includes('palad') || k.includes('druida') || k.includes('druid') || k.includes('explorador') || k.includes('ranger'))
    return { primary: 'var(--green-1)', secondary: 'var(--green-2)', glow: 'rgba(117,220,95,0.33)', hpColor: 'var(--green-2)' };
  if (k.includes('mago') || k.includes('wizard') || k.includes('hechicero') || k.includes('sorce'))
    return { primary: 'var(--purple-1)', secondary: '#9080cc', glow: 'rgba(185,160,255,0.28)', hpColor: 'var(--purple-1)' };
  if (k.includes('clerigo') || k.includes('cleric'))
    return { primary: 'var(--blue-1)', secondary: '#5aaad0', glow: 'rgba(134,212,255,0.28)', hpColor: 'var(--blue-1)' };
  return { primary: 'var(--gold-1)', secondary: 'var(--gold-2)', glow: 'rgba(247,221,120,0.22)', hpColor: 'var(--green-2)' };
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const ITEMS_MAP = Object.fromEntries(ALL_ITEMS.map(i => [i.id, i]));
const TYPE_LABEL = { weapon: 'Arma', armor: 'Armadura', potion: 'Poción', magic: 'Objeto Mágico' };
const TYPE_COLOR = { weapon: 'var(--ember)', armor: 'var(--gold)', potion: '#6aaa6a', magic: '#a07ad0' };
const TYPE_ICON  = { weapon: '⚔️', armor: '🛡️', potion: '⚗️', magic: '✨' };

const STAT_KEYS = ['fue', 'des', 'con', 'int', 'sab', 'car'];
const STAT_ABBR = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };
const STAT_ICON_KEYS = { fue: 'strength', des: 'dexterity', con: 'constitution', int: 'intelligence', sab: 'wisdom', car: 'charisma' };
const SLOT_ICON_KEYS = { mainhand: 'broadsword', offhand: 'shield', chest: 'armor', head: 'helmet', cloak: 'cloak', hands: 'strength', feet: 'boots', neck: 'lore', ring1: 'ring', ring2: 'ring' };
const TYPE_ICON_KEY  = { weapon: 'broadsword', armor: 'armor', potion: 'potion', magic: 'magic' };

const SKILLS = [
  { id: 'atletismo',       nombre: 'Atletismo',          stat: 'fue' },
  { id: 'acrobacias',      nombre: 'Acrobacias',         stat: 'des' },
  { id: 'juego_de_manos',  nombre: 'Juego de Manos',     stat: 'des' },
  { id: 'sigilo',          nombre: 'Sigilo',             stat: 'des' },
  { id: 'arcanos',         nombre: 'Arcanos',            stat: 'int' },
  { id: 'historia',        nombre: 'Historia',           stat: 'int' },
  { id: 'investigacion',   nombre: 'Investigación',      stat: 'int' },
  { id: 'naturaleza',      nombre: 'Naturaleza',         stat: 'int' },
  { id: 'religion',        nombre: 'Religión',           stat: 'int' },
  { id: 'perspicacia',     nombre: 'Perspicacia',        stat: 'sab' },
  { id: 'medicina',        nombre: 'Medicina',           stat: 'sab' },
  { id: 'percepcion',      nombre: 'Percepción',         stat: 'sab' },
  { id: 'supervivencia',   nombre: 'Supervivencia',      stat: 'sab' },
  { id: 'trato_animales',  nombre: 'T. con Animales',    stat: 'sab' },
  { id: 'engano',          nombre: 'Engaño',             stat: 'car' },
  { id: 'intimidacion',    nombre: 'Intimidación',       stat: 'car' },
  { id: 'interpretacion',  nombre: 'Interpretación',     stat: 'car' },
  { id: 'persuasion',      nombre: 'Persuasión',         stat: 'car' },
];

// Educational data for Modo Aprender (descriptions per skill/save)
const LEARN_DATA = {
  atletismo:       { nombre: 'Atletismo',            stat: 'fue', tipo: 'skill', descripcion: 'Mide tu fuerza física, resistencia corporal y capacidad atlética en situaciones extremas.', cuandoUsarla: 'Trepar paredes o acantilados, nadar contra corrientes, saltar abismos, empujar obstáculos pesados o resistir una llave en un forcejeo.' },
  acrobacias:      { nombre: 'Acrobacias',           stat: 'des', tipo: 'skill', descripcion: 'Controla tu cuerpo con precisión, equilibrio y agilidad para movimientos difíciles o peligrosos.', cuandoUsarla: 'Mantener el equilibrio en superficies inestables, realizar volteretas, caer sin daño o escapar de una inmovilización.' },
  juego_de_manos:  { nombre: 'Juego de Manos',       stat: 'des', tipo: 'skill', descripcion: 'Habilidad con los dedos para actos sutiles, trucos de magia, robo de bolsillos o manipulación discreta de objetos.', cuandoUsarla: 'Robar un objeto de alguien sin que lo note, plantar algo en la bolsa de otra persona, o manejar herramientas de ladrón.' },
  sigilo:          { nombre: 'Sigilo',               stat: 'des', tipo: 'skill', descripcion: 'Tu capacidad de moverte, ocultarte y actuar sin ser detectado por enemigos o testigos.', cuandoUsarla: 'Escabullirte en las sombras, tender una emboscada, seguir a alguien sin que te vea o escapar de una zona vigilada.' },
  arcanos:         { nombre: 'Arcanos',              stat: 'int', tipo: 'skill', descripcion: 'Conocimiento sobre magia, hechizos, planos de existencia, criaturas mágicas y artefactos.', cuandoUsarla: 'Identificar un conjuro que estás viendo, reconocer una criatura mágica, recordar lore sobre un artefacto o entender una inscripción arcana.' },
  historia:        { nombre: 'Historia',             stat: 'int', tipo: 'skill', descripcion: 'Tu conocimiento sobre eventos pasados, civilizaciones, guerras, dinastías y leyendas del mundo.', cuandoUsarla: 'Recordar quién fundó una ciudad, qué sucedió en una batalla histórica, el origen de una familia noble o el legado de un héroe antiguo.' },
  investigacion:   { nombre: 'Investigación',        stat: 'int', tipo: 'skill', descripcion: 'Capacidad de deducir, analizar pistas, buscar información oculta y conectar datos para llegar a conclusiones.', cuandoUsarla: 'Buscar pistas en una escena del crimen, descifrar un mensaje codificado, encontrar una entrada secreta o analizar evidencia para resolver un misterio.' },
  naturaleza:      { nombre: 'Naturaleza',           stat: 'int', tipo: 'skill', descripcion: 'Conocimiento sobre el mundo natural: plantas, animales, clima, geografía y ciclos de la naturaleza.', cuandoUsarla: 'Identificar una planta venenosa, predecir el clima, saber qué animales habitan una zona o encontrar recursos naturales en el bosque.' },
  religion:        { nombre: 'Religión',             stat: 'int', tipo: 'skill', descripcion: 'Conocimiento de dioses, cultos, ritos sagrados, planos celestiales e infernales y doctrina religiosa.', cuandoUsarla: 'Reconocer el símbolo de un dios, recordar un ritual religioso, identificar a qué deidad pertenece un templo o entender una maldición divina.' },
  perspicacia:     { nombre: 'Perspicacia',          stat: 'sab', tipo: 'skill', descripcion: 'Percibir las intenciones, emociones y honestidad de las personas a través de señales sutiles del lenguaje corporal.', cuandoUsarla: 'Detectar si alguien miente, intuir si una persona tiene motivos ocultos, leer el estado emocional de un PNJ o sentir si un trato es una trampa.' },
  medicina:        { nombre: 'Medicina',             stat: 'sab', tipo: 'skill', descripcion: 'Conocimiento práctico del cuerpo: diagnóstico de enfermedades, atención de heridas y estabilización de moribundos.', cuandoUsarla: 'Estabilizar a un aliado con 0 HP, diagnosticar una enfermedad, identificar un veneno por sus síntomas o aplicar primeros auxilios.' },
  percepcion:      { nombre: 'Percepción',           stat: 'sab', tipo: 'skill', descripcion: 'Agudeza de tus sentidos para notar detalles del entorno que otros podrían pasar por alto.', cuandoUsarla: 'Detectar una emboscada, notar una puerta secreta, escuchar pasos al otro lado de la pared, ver algo brillando en la oscuridad o sentir que te siguen.' },
  supervivencia:   { nombre: 'Supervivencia',        stat: 'sab', tipo: 'skill', descripcion: 'Habilidades para subsistir en el exterior: rastrear, cazar, orientarse y evitar peligros naturales.', cuandoUsarla: 'Seguir las huellas de una criatura, encontrar comida en el bosque, orientarte sin mapa, montar un campamento seguro o predecir una tormenta.' },
  trato_animales:  { nombre: 'T. con Animales',      stat: 'sab', tipo: 'skill', descripcion: 'Capacidad de calmar, domesticar y comunicarte con animales, entendiendo su naturaleza y comportamiento.', cuandoUsarla: 'Calmar un caballo asustado, montar una criatura salvaje, ganarte la confianza de un animal herido o hacer que un perro guardián no te ataque.' },
  engano:          { nombre: 'Engaño',               stat: 'car', tipo: 'skill', descripcion: 'Habilidad para mentir, disimular, actuar un papel o manipular la percepción de otros.', cuandoUsarla: 'Hacerte pasar por otra persona, vender una mentira convincente, ocultar un objeto bajo inspección, fingir emociones o negociar con información falsa.' },
  intimidacion:    { nombre: 'Intimidación',         stat: 'car', tipo: 'skill', descripcion: 'Influir en otros a través del miedo, amenazas directas o una presencia imponente.', cuandoUsarla: 'Hacer que un guardia se aparte, interrogar a un prisionero, disuadir a un matón de atacarte o demostrar que no es conveniente cruzarse contigo.' },
  interpretacion:  { nombre: 'Interpretación',       stat: 'car', tipo: 'skill', descripcion: 'Capacidad artística para entretener, actuar, tocar instrumentos o contar historias de manera convincente y memorable.', cuandoUsarla: 'Actuar en una obra de teatro, ganarte el favor del público con una canción, tocar en una taberna para conseguir monedas o contar una historia cautivadora.' },
  persuasion:      { nombre: 'Persuasión',           stat: 'car', tipo: 'skill', descripcion: 'Influir en otros de manera positiva con argumentos, encanto y buenas intenciones.', cuandoUsarla: 'Convencer al guardia de dejarte pasar, negociar un precio mejor, ganarte la confianza de un PNJ desconfiado o mediar en un conflicto.' },
  save_fue:        { nombre: 'Salvación de Fuerza',      stat: 'fue', tipo: 'save', descripcion: 'Resistir efectos físicos que intentan mover, derribar o atrapar tu cuerpo contra tu voluntad.', cuandoUsarla: 'Un hechizo intenta empujarte, debes resistir ser arrastrado por una trampa, o un efecto mágico quiere inmovilizarte.' },
  save_des:        { nombre: 'Salvación de Destreza',    stat: 'des', tipo: 'save', descripcion: 'Esquivar efectos de área, trampas y ataques que requieren agilidad para evitar daño.', cuandoUsarla: 'Evitar la explosión de una Bola de Fuego, esquivar una trampa de flechas, o apartarte a tiempo de un área de daño mágico.' },
  save_con:        { nombre: 'Salvación de Constitución',stat: 'con', tipo: 'save', descripcion: 'Resistir venenos, enfermedades, fatiga extrema y efectos que afectan la vitalidad del cuerpo.', cuandoUsarla: 'Resistir el efecto de un veneno, mantener la Concentración en un conjuro bajo daño, soportar condiciones extremas o resistir una enfermedad mágica.' },
  save_int:        { nombre: 'Salvación de Inteligencia',stat: 'int', tipo: 'save', descripcion: 'Resistir ilusiones, ataques mentales e influencias que afectan el razonamiento y la percepción.', cuandoUsarla: 'Resistir una ilusión que engaña la mente, protegerte de hechizos que alteran tus recuerdos o repeler un ataque de daño psíquico.' },
  save_sab:        { nombre: 'Salvación de Sabiduría',   stat: 'sab', tipo: 'save', descripcion: 'Resistir hechizos que afectan la voluntad, emociones o la conexión con la realidad y el libre albedrío.', cuandoUsarla: 'No caer bajo el efecto de Miedo, resistir un hechizo de Control Mental, no ser Encantado por un PNJ o resistir el pánico de una criatura.' },
  save_car:        { nombre: 'Salvación de Carisma',     stat: 'car', tipo: 'save', descripcion: 'Mantener tu identidad y esencia frente a efectos que alteran tu alma o te destierran a otro plano.', cuandoUsarla: 'Resistir el exilio a otro plano, mantener tu identidad ante un hechizo de posesión o resistir efectos que intentan borrar tu voluntad.' },
};

const profBonus = (level) => Math.ceil((level || 1) / 4) + 1;

const SLOT_INFO = {
  mainhand: { label: 'Mano Principal', icon: '⚔️' },
  offhand:  { label: 'Mano Secundaria', icon: '🛡️' },
  chest:    { label: 'Armadura',        icon: '🦺' },
  head:     { label: 'Casco',           icon: '⛑️' },
  cloak:    { label: 'Capa',            icon: '🧣' },
  hands:    { label: 'Guantes',         icon: '🧤' },
  feet:     { label: 'Botas',           icon: '👢' },
  neck:     { label: 'Amuleto',         icon: '📿' },
  ring1:    { label: 'Anillo 1',        icon: '💍' },
  ring2:    { label: 'Anillo 2',        icon: '💍' },
};

// ── SPELL DATA ────────────────────────────────────────────────────────────────

const SPELLS_MAP = Object.fromEntries(ALL_SPELLS.map(s => [s.id, s]));

// Normalize class name (Spanish, with or without accents) → canonical key or null
function normalizeClass(raw) {
  const cls = (raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (cls.includes('palad'))                                 return 'paladin';
  if (cls.includes('mago') || cls.includes('wizard'))       return 'mago';
  if (cls.includes('hechicero') || cls.includes('sorce'))   return 'hechicero';
  if (cls.includes('bardo') || cls.includes('bard'))        return 'bardo';
  if (cls.includes('clerigo') || cls.includes('cleric'))    return 'clerigo';
  if (cls.includes('druida') || cls.includes('druid'))      return 'druida';
  if (cls.includes('explorador') || cls.includes('ranger')) return 'explorador';
  return null; // Guerrero, Bárbaro, Monje, Pícaro, Brujo, etc. — sin conjuros nativos
}

const HALF_CASTER_SLOTS = {
  1:  { 1: 2 },  2:  { 1: 2 },  3:  { 1: 3 },  4:  { 1: 3 },
  5:  { 1: 4, 2: 2 },  6:  { 1: 4, 2: 2 },  7:  { 1: 4, 2: 3 },  8:  { 1: 4, 2: 3 },
  9:  { 1: 4, 2: 3, 3: 2 },  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 }, 14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 }, 16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

const FULL_CASTER_SLOTS = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

const CLASS_SLOT_TABLES = {
  paladin:    HALF_CASTER_SLOTS,
  explorador: HALF_CASTER_SLOTS,
  mago:       FULL_CASTER_SLOTS,
  hechicero:  FULL_CASTER_SLOTS,
  bardo:      FULL_CASTER_SLOTS,
  clerigo:    FULL_CASTER_SLOTS,
  druida:     FULL_CASTER_SLOTS,
};

function computeDefaultSlots(level, charClass) {
  const key = normalizeClass(charClass);
  if (!key || !CLASS_SLOT_TABLES[key]) return {};
  const table = CLASS_SLOT_TABLES[key][Math.min(20, Math.max(1, level || 1))] || {};
  const result = {};
  Object.entries(table).forEach(([lvl, total]) => { result[lvl] = { total, used: 0 }; });
  return result;
}

function getTargetSlot(itemId, currentInventory, extraMap = {}) {
  const item = ITEMS_MAP[itemId] || extraMap[itemId];
  if (!item?.slot) return null;
  const taken = new Set(currentInventory.filter(i => i.equipped && i.equippedSlot).map(i => i.equippedSlot));
  if (item.slot === 'mainhand') return !taken.has('mainhand') ? 'mainhand' : !taken.has('offhand') ? 'offhand' : 'mainhand';
  if (item.slot === 'shield') return 'offhand';
  if (item.slot === 'ring') return !taken.has('ring1') ? 'ring1' : !taken.has('ring2') ? 'ring2' : 'ring1';
  return item.slot;
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function CharacterSheet({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [char, setChar]         = useState(null);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [draft, setDraft]       = useState({});
  const [userRole, setUserRole] = useState('');
  const [activeTab, setActiveTab] = useState('ficha');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cs_viewMode') || 'ficha');
  const [itemSearch, setItemSearch] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [initRoll, setInitRoll] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const portraitRef = useRef(null);

  const isAdmin = userRole === 'Dungeon Master' || userRole === 'Jugador / DM';
  const isOwner = char?.ownerEmail === user.email || isAdmin;
  const canToggleInspiration = userRole === 'Dungeon Master' || userRole === 'Jugador / DM';

  // ── EFFECTS ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'characters', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setChar(data);
        setDraft(data);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', user.uid));
        if (snap.exists()) setUserRole(snap.data().role || '');
      } catch (err) {
        console.error('Error cargando rol:', err);
      }
    };
    loadRole();
  }, [user.uid]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  // ── HANDLERS ─────────────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'characters', id), { ...draft, updatedAt: serverTimestamp() });
    setChar(draft);
    setEditing(false);
    setSaving(false);
  };

  const update     = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const updateStat = (stat, value)  => setDraft(d => ({ ...d, stats: { ...d.stats, [stat]: parseInt(value) || 0 } }));
  const updateLore = (key, value)   => setDraft(d => ({ ...d, lore: { ...d.lore, [key]: value } }));

  const handlePortrait = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, `portraits/characters/${id}_${Date.now()}`);
      setDraft(d => ({ ...d, portrait: url }));
    } catch (err) {
      console.error('Error subiendo imagen:', err);
    }
    setSaving(false);
  };

  const toggleInspiration = async () => {
    if (!canToggleInspiration) return;
    const newVal = !draft.inspiration;
    setDraft(d => ({ ...d, inspiration: newVal }));
    await updateDoc(doc(db, 'characters', id), { inspiration: newVal });
  };

  const updateDeathSave = (type, index) => {
    const current = draft.deathSaves?.[type] || 0;
    const newVal  = Math.min(3, current > index ? index : index + 1);
    const newDS   = { ...(draft.deathSaves || {}), [type]: newVal };
    setDraft(d => ({ ...d, deathSaves: newDS }));
    updateDoc(doc(db, 'characters', id), { deathSaves: newDS });
  };

  const rollInitiative = () => {
    const nat    = Math.ceil(Math.random() * 20);
    const desMod = Math.floor(((draft.stats?.des || 10) - 10) / 2);
    setInitRoll({ nat, total: nat + desMod });
    setTimeout(() => setInitRoll(null), 4000);
  };

  const toggleSkill = (skillId) => {
    if (!editing) return;
    update('skills', { ...draft.skills, [skillId]: !(draft.skills?.[skillId]) });
  };
  const toggleSave = (stat) => {
    if (!editing) return;
    update('savingThrows', { ...draft.savingThrows, [stat]: !(draft.savingThrows?.[stat]) });
  };

  // ── INVENTORY ─────────────────────────────────────────────────────────────

  const inventoryItems  = draft.inventoryItems  || [];
  const customItemsData = draft.customItems     || [];
  const customItemsMap  = Object.fromEntries(customItemsData.map(i => [i.id, i]));
  const itemLookup      = (itemId) => ITEMS_MAP[itemId] || customItemsMap[itemId] || null;

  const recomputeAC = (items, stats) => {
    const desMod = Math.floor(((stats?.des || 10) - 10) / 2);
    const equippedItems = items.filter(i => i.equipped).map(i => itemLookup(i.itemId)).filter(Boolean);
    const armor = equippedItems.find(i => i.tipo === 'armor');
    let base = 10 + desMod;
    if (armor) {
      if (armor.stats.armorType === 'light')       base = armor.stats.caBase + desMod;
      else if (armor.stats.armorType === 'medium') base = armor.stats.caBase + Math.min(desMod, 2);
      else                                         base = armor.stats.caBase;
    }
    const magicBonus = equippedItems.reduce((sum, i) => sum + (i.stats?.caBonus || 0), 0);
    return base + magicBonus;
  };

  const createCustomItem = (itemData) => {
    const newCustomItems = [...customItemsData, itemData];
    setDraft(d => ({ ...d, customItems: newCustomItems }));
    updateDoc(doc(db, 'characters', id), { customItems: newCustomItems });
  };

  const applyInventoryUpdate = (newItems) => {
    const newAC = recomputeAC(newItems, draft.stats);
    setDraft(d => ({ ...d, inventoryItems: newItems, ac: newAC }));
    updateDoc(doc(db, 'characters', id), { inventoryItems: newItems, ac: newAC });
  };

  const addToInventory    = (itemId) => {
    if (inventoryItems.find(i => i.itemId === itemId)) return;
    applyInventoryUpdate([...inventoryItems, { itemId, equipped: false, quantity: 1 }]);
  };
  const removeFromInventory = (itemId) => applyInventoryUpdate(inventoryItems.filter(i => i.itemId !== itemId));

  const toggleEquipped = (itemId) => {
    const item = itemLookup(itemId);
    const currentlyEquipped = inventoryItems.find(i => i.itemId === itemId)?.equipped;
    let newItems;
    if (currentlyEquipped) {
      newItems = inventoryItems.map(i =>
        i.itemId === itemId ? { ...i, equipped: false, equippedSlot: null } : i
      );
    } else {
      const targetSlot = getTargetSlot(itemId, inventoryItems, customItemsMap);
      newItems = inventoryItems.map(i => {
        if (i.itemId === itemId) return { ...i, equipped: true, equippedSlot: targetSlot };
        if (targetSlot && i.equippedSlot === targetSlot) return { ...i, equipped: false, equippedSlot: null };
        if (!targetSlot && item?.tipo === 'armor' && itemLookup(i.itemId)?.tipo === 'armor') return { ...i, equipped: false, equippedSlot: null };
        return i;
      });
    }
    applyInventoryUpdate(newItems);
  };

  const changeQuantity = (itemId, delta) => {
    const newItems = inventoryItems.map(i =>
      i.itemId === itemId ? { ...i, quantity: Math.max(1, (i.quantity || 1) + delta) } : i
    );
    setDraft(d => ({ ...d, inventoryItems: newItems }));
    updateDoc(doc(db, 'characters', id), { inventoryItems: newItems });
  };

  const unequipSlot = (slotId) => {
    const newItems = inventoryItems.map(i =>
      i.equippedSlot === slotId ? { ...i, equipped: false, equippedSlot: null } : i
    );
    applyInventoryUpdate(newItems);
  };

  // ── SPELLS ───────────────────────────────────────────────────────────────────

  const spellSlots    = draft.spellSlots    || computeDefaultSlots(draft.level, draft.class);
  const preparedSpells = draft.preparedSpells || [];
  const carMod        = Math.floor(((draft.stats?.car || 10) - 10) / 2);
  const maxPrepared   = Math.max(1, carMod + (draft.level || 1));

  const updateSpellSlot = (level, newUsed) => {
    const slot = spellSlots[level];
    if (!slot) return;
    const clamped  = Math.max(0, Math.min(slot.total, newUsed));
    const newSlots = { ...spellSlots, [level]: { ...slot, used: clamped } };
    setDraft(d => ({ ...d, spellSlots: newSlots }));
    updateDoc(doc(db, 'characters', id), { spellSlots: newSlots });
  };

  const longRest = () => {
    const newSlots = {};
    Object.entries(spellSlots).forEach(([lvl, data]) => { newSlots[lvl] = { ...data, used: 0 }; });
    const updates = { spellSlots: newSlots, activeConcentration: null };
    setDraft(d => ({ ...d, ...updates }));
    updateDoc(doc(db, 'characters', id), updates);
  };

  const togglePreparedSpell = (spellId) => {
    const isPrepared = preparedSpells.includes(spellId);
    const next = isPrepared
      ? preparedSpells.filter(sid => sid !== spellId)
      : [...preparedSpells, spellId];
    if (!isPrepared && next.length > maxPrepared) return;
    setDraft(d => ({ ...d, preparedSpells: next }));
    updateDoc(doc(db, 'characters', id), { preparedSpells: next });
  };

  const castSpell = (spellId) => {
    const spell = SPELLS_MAP[spellId];
    if (!spell || !spell.nivel || spell.esHabilidad) return;
    const usable = Object.entries(spellSlots)
      .map(([lvl, data]) => ({ lvl: parseInt(lvl), data }))
      .filter(({ lvl, data }) => lvl >= spell.nivel && data.total - data.used > 0)
      .sort((a, b) => a.lvl - b.lvl);
    if (!usable.length) return;
    const { lvl, data } = usable[0];
    const newSlots  = { ...spellSlots, [lvl]: { ...data, used: data.used + 1 } };
    const updates   = { spellSlots: newSlots };
    if (spell.concentracion) updates.activeConcentration = spellId;
    setDraft(d => ({ ...d, ...updates }));
    updateDoc(doc(db, 'characters', id), updates);
  };

  // ── DERIVED VALUES ────────────────────────────────────────────────────────

  if (!char) return <div style={s.loading}>Cargando personaje...</div>;

  const statMod    = (val) => { const m = Math.floor((val - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };
  const prof       = profBonus(draft.level);
  const hpPct      = Math.min(100, Math.round(((draft.hp || 0) / (draft.hpMax || 1)) * 100));
  const xpPct      = Math.min(100, Math.round(((draft.xp || 0) / (draft.xpNext || 2700)) * 100));
  const passivePerc = 10 + Math.floor(((draft.stats?.sab || 10) - 10) / 2) + (draft.skills?.percepcion ? prof : 0);

  const skillVal = (skill) => Math.floor(((draft.stats?.[skill.stat] || 10) - 10) / 2) + (draft.skills?.[skill.id] ? prof : 0);
  const saveVal  = (stat)  => Math.floor(((draft.stats?.[stat]      || 10) - 10) / 2) + (draft.savingThrows?.[stat] ? prof : 0);

  const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);

  const theme = classTheme(draft.class);
  const accent1 = draft.accentColor || theme.primary;
  const accentGlow = theme.glow;

  const setViewModePersist = (m) => { setViewMode(m); localStorage.setItem('cs_viewMode', m); };

  // equipped weapon + armor for the resources panel
  const equippedWeaponItem = inventoryItems.find(i => i.equipped && i.equippedSlot === 'mainhand');
  const equippedArmorItem  = inventoryItems.find(i => i.equipped && (i.equippedSlot === 'chest'));
  const weaponData = equippedWeaponItem ? (ITEMS_MAP[equippedWeaponItem.itemId] || (draft.customItems || []).find(c => c.id === equippedWeaponItem.itemId)) : null;
  const armorData  = equippedArmorItem  ? (ITEMS_MAP[equippedArmorItem.itemId]  || (draft.customItems || []).find(c => c.id === equippedArmorItem.itemId))  : null;

  const TABS = [
    { id: 'ficha',      label: 'Ficha',      iconKey: 'shield' },
    { id: 'inventario', label: 'Inventario', iconKey: 'inventory', badge: inventoryItems.length || null },
    { id: 'conjuros',   label: 'Conjuros',   iconKey: 'spell',     badge: preparedSpells.length || null },
    { id: 'lore',       label: 'Lore',       iconKey: 'lore' },
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...s.page, background: 'linear-gradient(180deg, #0d1a0d 0%, #050504 300px) var(--bg-main)', fontFamily: 'var(--font-ui)' }} className="fade-in">

      {/* ── FULLSCREEN MODAL ── */}
      {showModal && draft.portrait && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setShowModal(false)}>
          <img src={draft.portrait} alt={draft.name} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── ACTION BAR ── */}
      <div className="cs-action-bar">
        <button style={s.backBtn} onClick={() => navigate('/')}>← Volver</button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {editing && (
            <>
              <label style={{ ...s.editBtn, cursor: 'pointer' }}>
                🖼 Retrato
                <input type="file" accept="image/*" onChange={handlePortrait} style={{ display: 'none' }} />
              </label>
              <label style={{ ...s.editBtn, cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Color
                <input type="color" value={draft.accentColor || '#f7dd78'}
                  onChange={e => { update('accentColor', e.target.value); updateDoc(doc(db, 'characters', id), { accentColor: e.target.value }); }}
                  style={{ width: '24px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
              </label>
            </>
          )}
          {isOwner && !editing && <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Editar</button>}
          {editing && <>
            <button style={s.cancelBtn} onClick={() => { setEditing(false); setDraft(char); }}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </>}
        </div>
      </div>

      {/* ── HERO SECTION ── */}
      <div className="cs-hero" style={{ '--cs-glow': accentGlow }}>

        {/* Portrait */}
        <div className="cs-portrait" onClick={() => draft.portrait && setShowModal(true)}
          style={{ cursor: draft.portrait ? 'zoom-in' : 'default' }}>
          {draft.portrait
            ? <img src={draft.portrait} alt={draft.name} />
            : <span style={{ fontSize: '64px', opacity: 0.12, zIndex: 3, position: 'relative' }}>⚔️</span>}
        </div>

        {/* Right column: identity + tiles */}
        <div className="cs-hero-right">
          <div className="cs-hero-identity">
            <p className="cs-eyebrow">{draft.race} · {draft.alignment || 'Personaje'}</p>
            {editing
              ? <input value={draft.name} onChange={e => update('name', e.target.value)} style={{ ...s.inputLarge, fontFamily: 'var(--font-title)', fontSize: '28px' }} />
              : <h1 className="cs-hero-name">{draft.name}</h1>}
            <div className="cs-pills">
              {[draft.class, draft.subclass].filter(Boolean).map((pill, i) => (
                <span key={i} className="cs-pill">{pill}</span>
              ))}
            </div>
            <div className="cs-level-xp-row">
              <div className="cs-level-badge">
                {editing
                  ? <input type="number" value={draft.level} onChange={e => update('level', parseInt(e.target.value))}
                      style={{ ...s.inputNum, width: '44px', fontSize: '22px', border: 'none', background: 'transparent', color: 'var(--gold-1)' }} />
                  : <strong>{draft.level}</strong>}
                <span>Nivel</span>
              </div>
              <div className="cs-xp-block">
                <div className="cs-xp-meta">
                  <span>
                    XP: {editing
                      ? <input type="number" value={draft.xp} onChange={e => update('xp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '60px', fontSize: '11px', display: 'inline' }} />
                      : <strong>{(draft.xp || 0).toLocaleString()}</strong>}
                  </span>
                  <span>→ {(draft.xpNext || 2700).toLocaleString()} XP</span>
                </div>
                <div className="cs-xp-bar">
                  <div className="cs-xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 8 Status Tiles */}
          <div className="cs-status-grid">
          {/* PV */}
          <StatusTile
            icon={<GameIcon author={ICONS.heart.author} name={ICONS.heart.name} size={18} color="a6ee81" />}
            label="Puntos de Golpe" isHP
            value={editing
              ? <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <input type="number" value={draft.hp} onChange={e => update('hp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '38px', fontSize: '14px' }} />
                  <span style={{ color: 'var(--text-dim)' }}>/</span>
                  <input type="number" value={draft.hpMax} onChange={e => update('hpMax', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '38px', fontSize: '14px' }} />
                </span>
              : `${draft.hp ?? '—'} / ${draft.hpMax ?? '—'}`}
            bar={hpPct}
          />
          {/* CA */}
          <StatusTile
            icon={<GameIcon author={ICONS.shield.author} name={ICONS.shield.name} size={18} />}
            label="Clase Armadura"
            value={editing ? <input type="text" value={draft.ac ?? ''} onChange={e => update('ac', e.target.value)} style={{ ...s.inputNum, width: '44px' }} /> : draft.ac ?? '—'} />
          {/* Iniciativa */}
          <StatusTile
            icon={<GameIcon author={ICONS.initiative.author} name={ICONS.initiative.name} size={18} />}
            label="Iniciativa" clickable onClick={rollInitiative}
            value={initRoll
              ? <span>{fmtMod(initRoll.total)}<span style={{ fontSize: '9px', color: 'var(--text-dim)', display: 'block' }}>d20={initRoll.nat}</span></span>
              : statMod(draft.stats?.des || 10)} />
          {/* Velocidad */}
          <StatusTile
            icon={<GameIcon author={ICONS.speed.author} name={ICONS.speed.name} size={18} />}
            label="Velocidad"
            value={editing ? <input type="text" value={draft.speed || ''} onChange={e => update('speed', e.target.value)} style={{ ...s.inputNum, width: '48px' }} /> : draft.speed || '9m'} />
          {/* Proficiencia */}
          <StatusTile
            icon={<GameIcon author={ICONS.proficiency.author} name={ICONS.proficiency.name} size={18} />}
            label="Proficiencia" value={`+${prof}`}
            highlight accent={accent1} />
          {/* Inspiración */}
          <StatusTile
            icon={<GameIcon author={ICONS.inspiration.author} name={ICONS.inspiration.name} size={18} />}
            label="Inspiración"
            value={draft.inspiration ? 'Activa' : 'Sin'}
            highlight={draft.inspiration} accent={accent1}
            onClick={canToggleInspiration ? toggleInspiration : undefined}
            clickable={canToggleInspiration} />
          {/* Percepción Pasiva */}
          <StatusTile
            icon={<GameIcon author={ICONS.perception.author} name={ICONS.perception.name} size={18} />}
            label="Percepción" value={passivePerc} />
          {/* Condiciones */}
          <StatusTile
            icon={<GameIcon author={ICONS.conditions.author} name={ICONS.conditions.name} size={18} />}
            label="Condiciones"
            value={editing ? <input value={draft.conditions || ''} onChange={e => update('conditions', e.target.value)} style={{ ...s.inputNum, width: '80px', fontSize: '10px' }} /> : (draft.conditions || 'Ninguna')} />
          </div>
        </div>{/* end cs-hero-right */}
      </div>{/* end cs-hero */}

      {/* ── NAV ROW: tabs + mode switcher ── */}
      <div className="cs-nav-row">
        <div className="cs-tab-bar">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const ico = ICONS[tab.iconKey];
            return (
              <button key={tab.id}
                className={`cs-tab${isActive ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}>
                {ico && <GameIcon author={ico.author} name={ico.name} size={14} color={isActive ? 'f7dd78' : '9d9275'} />}
                {tab.label}
                {tab.badge != null && <span className="cs-tab-badge" style={{ background: `${accent1}25`, color: accent1 }}>{tab.badge}</span>}
              </button>
            );
          })}
        </div>
        <div className="cs-mode-bar">
          {['aprender', 'jugar', 'ficha'].map(m => (
            <button key={m}
              className={`cs-mode-btn${viewMode === m ? ' active' : ''}`}
              onClick={() => setViewModePersist(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── APRENDER MODE ── */}
      {viewMode === 'aprender' && (
        <LearnMode
          draft={draft} prof={prof} accent={accent1} accentGlow={accentGlow}
          skillVal={skillVal} saveVal={saveVal} fmtMod={fmtMod}
          isMobile={isMobile}
        />
      )}

      {/* ══════════════════════════════════════════════════
          FICHA TAB
      ══════════════════════════════════════════════════ */}
      {viewMode !== 'aprender' && activeTab === 'ficha' && (
        <div className="cs-ficha-grid">

          {/* COL 1: Características */}
          <Section title="Características" iconEl={<GameIcon author={ICONS.sword.author} name={ICONS.sword.name} size={16} color="c7a242" />}>
            <div className="cs-stat-grid">
              {STAT_KEYS.map(stat => (
                <div key={stat} className="cs-stat-card">
                  {ICONS[STAT_ICON_KEYS[stat]] && <GameIcon author={ICONS[STAT_ICON_KEYS[stat]].author} name={ICONS[STAT_ICON_KEYS[stat]].name} size={16} color="c7a242" />}
                  <span className="cs-stat-abbr">{STAT_ABBR[stat]}</span>
                  {editing
                    ? <input type="number" value={draft.stats?.[stat] || 10} onChange={e => updateStat(stat, e.target.value)}
                        style={{ ...s.inputNum, fontSize: '20px', width: '52px' }} />
                    : <span className="cs-stat-score">{draft.stats?.[stat] || 10}</span>}
                  <span className="cs-stat-mod">{statMod(draft.stats?.[stat] || 10)}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* COL 2: Tiradas de Salvación */}
          <Section title="Salvaciones" iconEl={<GameIcon author={ICONS.shield.author} name={ICONS.shield.name} size={16} color="c7a242" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {STAT_KEYS.map(stat => {
                const active = draft.savingThrows?.[stat] || false;
                const val    = saveVal(stat);
                return (
                  <div key={stat} style={fs.row}>
                    <Pip active={active} accent={accent1} editing={editing} onClick={() => toggleSave(stat)} />
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', width: '28px' }}>{STAT_ABBR[stat]}</span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', flex: 1 }}>Salvación</span>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '13px', fontWeight: '700', color: active ? accent1 : 'var(--text-main)', minWidth: '28px', textAlign: 'right' }}>{fmtMod(val)}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* COL 3: Habilidades */}
          <Section title="Habilidades" iconEl={<GameIcon author={ICONS.perception.author} name={ICONS.perception.name} size={16} color="c7a242" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {SKILLS.map(skill => {
                const active = draft.skills?.[skill.id] || false;
                const val    = skillVal(skill);
                return (
                  <div key={skill.id} style={fs.row}>
                    <Pip active={active} accent={accent1} editing={editing} onClick={() => toggleSkill(skill.id)} />
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.nombre}</span>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '7px', color: 'var(--text-dim)', marginRight: '4px', flexShrink: 0 }}>{STAT_ABBR[skill.stat]}</span>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '12px', fontWeight: '700', color: active ? accent1 : 'var(--text-main)', minWidth: '24px', textAlign: 'right', flexShrink: 0 }}>{fmtMod(val)}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ROW 2 COL 1: Combate */}
          <Section title="Combate" iconEl={<GameIcon author={ICONS.broadsword.author} name={ICONS.broadsword.name} size={16} color="c7a242" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
              {[
                { label: 'CA', val: editing ? <input type="text" value={draft.ac ?? ''} onChange={e => update('ac', e.target.value)} style={{ ...s.inputNum, width: '46px' }} /> : draft.ac },
                { label: 'Iniciativa', val: statMod(draft.stats?.des || 10), click: rollInitiative },
                { label: 'Velocidad',  val: editing ? <input type="text" value={draft.speed || ''} onChange={e => update('speed', e.target.value)} style={{ ...s.inputNum, width: '50px' }} /> : (draft.speed || '9m') },
                { label: 'Prof.',      val: `+${prof}`, highlight: true },
              ].map((item, i) => (
                <div key={i} onClick={item.click}
                  style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${item.highlight ? accent1 + '55' : 'rgba(234,199,94,0.15)'}`, padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: item.click ? 'pointer' : 'default', borderRadius: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-title)', fontSize: '8px', letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: '700', color: item.highlight ? accent1 : 'var(--text-main)', lineHeight: 1 }}>{item.val}</span>
                </div>
              ))}
            </div>
            {/* HP temp + death saves */}
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(234,199,94,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>HP Temp</span>
                {editing
                  ? <input type="number" value={draft.hpTemp || 0} onChange={e => update('hpTemp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '56px' }} />
                  : <span style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: '700', color: 'var(--green-1)' }}>{draft.hpTemp || 0}</span>}
              </div>
              {/* Concentración */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Concentración</span>
                {draft.activeConcentration
                  ? <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: accent1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✦ {SPELLS_MAP[draft.activeConcentration]?.nombre || '—'}
                      {isOwner && <button onClick={() => { setDraft(d => ({ ...d, activeConcentration: null })); updateDoc(doc(db, 'characters', id), { activeConcentration: null }); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--ember)', cursor: 'pointer', fontSize: '11px' }}>✕</button>}
                    </span>
                  : <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-dim)' }}>{draft.concentration || '—'}</span>}
              </div>
            </div>
            {(draft.hp || 0) === 0 && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(234,199,94,0.12)' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '8px', letterSpacing: '2px', color: 'var(--red-1)', textTransform: 'uppercase', marginBottom: '8px' }}>Tiradas de Muerte</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {[{ type: 'successes', label: 'Éxitos', color: 'var(--green-2)' }, { type: 'failures', label: 'Fallos', color: 'var(--red-1)' }].map(({ type, label, color }) => (
                    <div key={type}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color, marginBottom: '6px' }}>{label}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[0, 1, 2].map(i => <div key={i} onClick={() => updateDeathSave(type, i)} style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${color}`, background: (draft.deathSaves?.[type] || 0) > i ? color : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ROW 2 COL 2-3: Recursos + Equipo Activado */}
          <div style={{ gridColumn: isMobile ? '1' : 'span 2', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>

            {/* Recursos */}
            <Section title="Recursos" iconEl={<GameIcon author={ICONS.dice.author} name={ICONS.dice.name} size={16} color="a6ee81" />}>
              {/* Dados de Golpe */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Dados de Golpe</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {Array.from({ length: draft.level || 1 }, (_, i) => (
                    <div key={i} style={{ width: '13px', height: '13px', borderRadius: '3px', border: `1px solid ${accent1}88`, background: i < (draft.level || 1) ? `${accent1}30` : 'transparent', transform: 'rotate(45deg)' }} />
                  ))}
                  <span style={{ fontFamily: 'var(--font-title)', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>d{normalizeClass(draft.class) === 'paladin' ? '10' : normalizeClass(draft.class) === 'mago' ? '6' : '8'}</span>
                </div>
              </div>
              {/* Espacios de Conjuro */}
              {Object.entries(spellSlots).filter(([, d]) => d.total > 0).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([lvl, data]) => {
                const avail = data.total - data.used;
                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '8px', letterSpacing: '1px', color: 'var(--text-dim)', width: '38px', textTransform: 'uppercase' }}>Nv.{lvl}</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {Array.from({ length: data.total }, (_, i) => {
                        const filled = i < avail;
                        return (
                          <div key={i} onClick={isOwner ? (filled ? () => updateSpellSlot(lvl, data.used + 1) : () => updateSpellSlot(lvl, data.used - 1)) : undefined}
                            style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${filled ? accent1 : accent1 + '33'}`, background: filled ? accent1 : 'transparent', cursor: isOwner ? 'pointer' : 'default', transition: 'all 0.15s', boxShadow: filled ? `0 0 6px ${accentGlow}` : 'none' }} />
                        );
                      })}
                    </div>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '9px', color: 'var(--text-dim)' }}>{avail}/{data.total}</span>
                  </div>
                );
              })}
              {Object.keys(spellSlots).length === 0 && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' }}>Sin conjuros</span>}

              {/* Notas de estado */}
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(234,199,94,0.12)' }}>
                <StatusRow label="Notas sesión" value={draft.sessionNotes || '—'} field="sessionNotes" editing={editing} update={update} />
              </div>
            </Section>

            {/* Equipo Activado + Jugador + Notas */}
            <Section title="Equipo Activado" iconEl={<GameIcon author={ICONS.armor.author} name={ICONS.armor.name} size={16} color="c7a242" />}>
              {weaponData
                ? <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${accent1}33`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '12px', color: accent1, marginBottom: '2px' }}>{weaponData.nombre}</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--red-1)' }}>{weaponData.stats?.daño || '—'} {weaponData.stats?.tipoDaño || ''}</div>
                  </div>
                : <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '8px' }}>Sin arma equipada</div>}
              {armorData
                ? <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${accent1}33`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-title)', fontSize: '12px', color: 'var(--gold-2)', marginBottom: '2px' }}>{armorData.nombre}</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)' }}>CA {armorData.stats?.caBase || '—'}</div>
                  </div>
                : <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '12px' }}>Sin armadura equipada</div>}

              {/* Jugador */}
              <div style={{ borderTop: '1px solid rgba(234,199,94,0.12)', paddingTop: '10px', marginBottom: '8px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Jugador</div>
                {editing
                  ? <>
                      <input value={draft.player || ''} onChange={e => update('player', e.target.value)} style={{ ...s.inputFull, marginBottom: '6px' }} placeholder="Nombre" />
                      <input value={draft.ownerEmail || ''} onChange={e => update('ownerEmail', e.target.value)} style={s.inputFull} placeholder="Email" />
                    </>
                  : <span style={{ fontFamily: 'var(--font-title)', fontSize: '14px', color: 'var(--gold-1)' }}>{draft.player || '—'}</span>}
              </div>

              {/* Notas */}
              <div style={{ borderTop: '1px solid rgba(234,199,94,0.12)', paddingTop: '10px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Notas</div>
                {editing
                  ? <textarea value={draft.notes || ''} onChange={e => update('notes', e.target.value)} style={s.textarea} placeholder="Motivaciones, lore..." rows={3} />
                  : <p style={{ ...s.notesText, fontFamily: 'var(--font-ui)', fontSize: '13px' }}>{draft.notes || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Sin notas.</span>}</p>}
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          INVENTARIO TAB (sin cambios)
      ══════════════════════════════════════════════════ */}
      {viewMode !== 'aprender' && activeTab === 'inventario' && (
        <InventoryTab
          inventoryItems={inventoryItems}
          itemSearch={itemSearch}
          setItemSearch={setItemSearch}
          addToInventory={addToInventory}
          removeFromInventory={removeFromInventory}
          toggleEquipped={toggleEquipped}
          changeQuantity={changeQuantity}
          isOwner={isOwner}
          unequipSlot={unequipSlot}
          portrait={draft.portrait}
          isMobile={isMobile}
          accent={accent1}
          customItems={customItemsData}
          createCustomItem={createCustomItem}
        />
      )}

      {/* ══════════════════════════════════════════════════
          CONJUROS TAB
      ══════════════════════════════════════════════════ */}
      {viewMode !== 'aprender' && activeTab === 'conjuros' && (
        <SpellsTab
          spellSlots={spellSlots}
          preparedSpells={preparedSpells}
          maxPrepared={maxPrepared}
          isOwner={isOwner}
          accent={accent1}
          charClass={draft.class}
          charLevel={draft.level}
          charStats={draft.stats}
          isMobile={isMobile}
          updateSpellSlot={updateSpellSlot}
          longRest={longRest}
          togglePrepared={togglePreparedSpell}
          castSpell={castSpell}
          activeConcentration={draft.activeConcentration}
        />
      )}

      {/* ══════════════════════════════════════════════════
          LORE TAB
      ══════════════════════════════════════════════════ */}
      {viewMode !== 'aprender' && activeTab === 'lore' && (
        <LoreTab lore={draft.lore} editing={editing} isOwner={isOwner} updateLore={updateLore} accent={accent1} />
      )}

      {!isOwner && <div style={s.readOnlyBadge}>👁️ Vista de solo lectura — este no es tu personaje</div>}
      <div style={{ height: '80px' }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Item icon (emoji fallback → GameIcon) ────────────────────────────────────
function ItemIcon({ item, size = 20 }) {
  if (!item) return null;
  if (item.emoji) return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{item.emoji}</span>;
  const key = TYPE_ICON_KEY[item.tipo];
  const ico = key && ICONS[key];
  if (ico) return <GameIcon author={ico.author} name={ico.name} size={size} color="c7a242" />;
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>✦</span>;
}

// ── Proficiency pip ──────────────────────────────────────────────────────────
function Pip({ active, accent, editing, onClick }) {
  return (
    <div
      onClick={editing ? onClick : undefined}
      style={{
        width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0,
        border: `1px solid ${active ? (accent || 'var(--gold)') : 'var(--gold-dim)'}`,
        background: active ? (accent || 'var(--gold)') : 'transparent',
        cursor: editing ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, iconEl, children }) {
  return (
    <div className="cs-fantasy-card">
      <div className="cs-card-header">
        {iconEl}
        <h2 className="cs-card-title">{title}</h2>
        <div className="cs-card-divider" />
      </div>
      {children}
    </div>
  );
}

// ── Status tile ───────────────────────────────────────────────────────────────
function StatusTile({ icon, label, value, highlight, isHP, accent, bar, onClick, clickable }) {
  const isHighlightActive = highlight && accent;
  const valueColor = isHighlightActive && !isHP ? accent : undefined;
  return (
    <div onClick={onClick} className={`cs-status-tile${isHP ? ' cs-hp' : ''}${clickable ? ' cs-clickable' : ''}`}
      style={{ cursor: clickable ? 'pointer' : 'default' }}>
      {icon && <span className="cs-status-icon">{icon}</span>}
      <span className="cs-status-label">{label}</span>
      <span className="cs-status-value" style={valueColor ? { color: valueColor, textShadow: 'var(--glow-gold)' } : undefined}>{value}</span>
      {bar !== undefined && (
        <div className="cs-mini-bar">
          <span style={{ width: `${bar}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Combat stat box ───────────────────────────────────────────────────────────
function CombatStat({ label, value, field, editing, update }) {
  return (
    <div style={ss.combatStat}>
      <span style={ss.combatLabel}>{label}</span>
      {editing && field
        ? <input type="text" value={value ?? ''} onChange={e => update(field, e.target.value)}
            style={{ ...ss.inputNum, fontSize: '16px', width: '50px' }} />
        : <span style={ss.combatVal}>{value}</span>}
    </div>
  );
}

// ── Status row ────────────────────────────────────────────────────────────────
function StatusRow({ label, value, field, editing, update }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>{label}</span>
      {editing
        ? <input value={value} onChange={e => update(field, e.target.value)}
            style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '3px 8px', maxWidth: '160px' }} />
        : <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment)' }}>{value}</span>}
    </div>
  );
}

// ── Learn mode ────────────────────────────────────────────────────────────────
function LearnMode({ draft, prof, accent, skillVal, saveVal, fmtMod, isMobile }) {
  const [selectedId, setSelectedId] = useState('atletismo');
  const [rollResult, setRollResult] = useState(null);
  const [rollHistory, setRollHistory] = useState([]);

  const getVal = (item) => {
    if (item.tipo === 'skill') {
      const skill = SKILLS.find(s => s.id === item.id);
      return skill ? skillVal(skill) : 0;
    }
    return saveVal(item.stat);
  };

  const isProficient = (item) => {
    if (item.tipo === 'skill') return !!(draft.skills?.[item.id]);
    return !!(draft.savingThrows?.[item.stat]);
  };

  const selected = LEARN_DATA[selectedId] || LEARN_DATA.atletismo;
  const selectedItem = { id: selectedId, stat: selected.stat, tipo: selected.tipo };

  const rollDice = (mode) => {
    const a = Math.ceil(Math.random() * 20);
    const b = Math.ceil(Math.random() * 20);
    let nat;
    if (mode === 'ventaja')     nat = Math.max(a, b);
    else if (mode === 'desventaja') nat = Math.min(a, b);
    else                        nat = a;
    const modifier = getVal(selectedItem);
    const total    = nat + modifier;
    const isCrit   = nat === 20;
    const isPifia  = nat === 1;
    const resultColor = isCrit ? 'var(--green-1)' : isPifia ? 'var(--red-1)' : total > 15 ? 'var(--green-1)' : total > 8 ? 'var(--gold-1)' : 'var(--red-1)';
    const label       = isCrit ? '¡Crítico!' : isPifia ? '¡Pifia!' : total > 15 ? '¡Excelente resultado!' : total > 8 ? 'Resultado moderado' : 'Resultado bajo';
    const result = { nat, a, b, modifier, total, mode, resultColor, label, isCrit, isPifia };
    setRollResult(result);
    setRollHistory(prev => [result, ...prev].slice(0, 3));
  };

  const selectItem = (id) => { setSelectedId(id); setRollResult(null); };

  const desMod   = Math.floor(((draft.stats?.des || 10) - 10) / 2);
  const initiative = desMod;
  const hp       = draft.hp ?? '—';
  const hpMax    = draft.hpMax ?? '—';
  const ac       = draft.ac ?? '—';
  const inspiration = draft.inspiration ? 'Activa' : 'Sin';

  return (
    <div className="cs-learn-grid">

      {/* ── LEFT: Skill + Save list ─────────────────────── */}
      <div className="cs-fantasy-card">
        <div className="cs-card-header">
          <GameIcon author={ICONS.perception.author} name={ICONS.perception.name} size={16} color="c7a242" />
          <h2 className="cs-card-title">Habilidades y Salvaciones</h2>
          <div className="cs-card-divider" />
        </div>

        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', textTransform: 'uppercase', padding: '0 2px 6px', borderBottom: '1px solid rgba(234,199,94,0.1)', marginBottom: '4px' }}>
          Habilidades
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '8px' }}>
          {SKILLS.map(skill => {
            const item = { id: skill.id, stat: skill.stat, tipo: 'skill' };
            const val  = getVal(item);
            const hasProficiency = isProficient(item);
            const isSel = selectedId === skill.id;
            return (
              <div key={skill.id} onClick={() => selectItem(skill.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', background: isSel ? `${accent}18` : 'transparent', border: `1px solid ${isSel ? accent + '44' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0, border: `1px solid ${hasProficiency ? accent : 'var(--text-dim)'}`, background: hasProficiency ? accent : 'transparent' }} />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: isSel ? accent : 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.nombre}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '7px', color: 'var(--text-dim)', flexShrink: 0 }}>{STAT_ABBR[skill.stat]}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '12px', fontWeight: '700', color: isSel ? accent : (hasProficiency ? accent : 'var(--text-main)'), minWidth: '24px', textAlign: 'right', flexShrink: 0 }}>{fmtMod(val)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', textTransform: 'uppercase', padding: '0 2px 6px', borderBottom: '1px solid rgba(234,199,94,0.1)', marginBottom: '4px' }}>
          Tiradas de Salvación
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {STAT_KEYS.map(stat => {
            const itemId = `save_${stat}`;
            const item   = { id: itemId, stat, tipo: 'save' };
            const val    = getVal(item);
            const hasProficiency = isProficient(item);
            const isSel  = selectedId === itemId;
            return (
              <div key={itemId} onClick={() => selectItem(itemId)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', background: isSel ? `${accent}18` : 'transparent', border: `1px solid ${isSel ? accent + '44' : 'transparent'}`, transition: 'all 0.15s' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '3px', flexShrink: 0, border: `1px solid ${hasProficiency ? accent : 'var(--text-dim)'}`, background: hasProficiency ? accent : 'transparent' }} />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: isSel ? accent : 'var(--text-soft)', flex: 1 }}>Salvación</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '7px', color: 'var(--text-dim)', flexShrink: 0 }}>{STAT_ABBR[stat]}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '12px', fontWeight: '700', color: isSel ? accent : (hasProficiency ? accent : 'var(--text-main)'), minWidth: '24px', textAlign: 'right', flexShrink: 0 }}>{fmtMod(val)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: Explanation + dice roller ──────────── */}
      <div className="cs-fantasy-card" style={{ border: '1px solid var(--border-gold-strong)' }}>
        <div className="cs-card-header">
          <GameIcon author={ICONS.dice.author} name={ICONS.dice.name} size={16} color="c7a242" />
          <h2 className="cs-card-title">✦ {selected.nombre}</h2>
          <div className="cs-card-divider" />
        </div>

        {/* Selected skill header card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: `1px solid ${accent}33` }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
              {selected.tipo === 'skill' ? 'Habilidad seleccionada' : 'Tirada de Salvación'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '16px', color: accent }}>{selected.nombre}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>{STAT_ABBR[selected.stat]}</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '2.4rem', fontWeight: '700', color: accent, lineHeight: 1 }}>
            {fmtMod(getVal(selectedItem))}
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '5px' }}>¿Para qué sirve?</div>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.6', margin: '0 0 1rem' }}>{selected.descripcion}</p>

        <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '5px' }}>¿Cuándo la uso?</div>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.6', margin: '0 0 1.2rem' }}>{selected.cuandoUsarla}</p>

        <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '8px' }}>¿Cómo se hace la tirada?</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.45)', border: `1px solid ${accent}33`, borderRadius: '10px', marginBottom: '1.2rem' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.7rem', color: 'var(--text-main)' }}>1d20</span>
          <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--text-dim)' }}>+</span>
          <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.7rem', fontWeight: '700', color: accent }}>
            {fmtMod(getVal(selectedItem))}
          </span>
          {isProficient(selectedItem) && (
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--green-1)', background: 'rgba(166,238,129,0.1)', border: '1px solid rgba(166,238,129,0.3)', padding: '2px 8px', borderRadius: '99px', marginLeft: '4px' }}>+ Prof. incluída</span>
          )}
        </div>

        <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '8px' }}>Haz una tirada</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[
            { mode: 'normal',      label: 'Normal' },
            { mode: 'ventaja',     label: 'Ventaja' },
            { mode: 'desventaja',  label: 'Desventaja' },
          ].map(({ mode, label }) => (
            <button key={mode} onClick={() => rollDice(mode)}
              style={{ background: mode === 'normal' ? `${accent}22` : 'rgba(0,0,0,0.4)', border: `1px solid ${mode === 'normal' ? accent + '88' : 'rgba(234,199,94,0.25)'}`, color: mode === 'normal' ? accent : 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '500', padding: '7px 14px', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Roll result */}
        {rollResult && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.4)', border: `2px solid ${rollResult.resultColor}44`, borderRadius: '12px', marginBottom: '0.8rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '2.8rem', fontWeight: '700', color: rollResult.resultColor, lineHeight: 1 }}>{rollResult.nat}</span>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--text-dim)' }}>+</span>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', fontWeight: '600', color: 'var(--text-main)' }}>{rollResult.modifier}</span>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', color: 'var(--text-dim)' }}>=</span>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '3rem', fontWeight: '700', color: rollResult.resultColor, lineHeight: 1 }}>{rollResult.total}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: rollResult.resultColor, fontWeight: '600', marginBottom: '4px' }}>{rollResult.label}</div>
            {rollResult.mode !== 'normal' && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-dim)' }}>
                Dados: {rollResult.a} / {rollResult.b} → {rollResult.mode === 'ventaja' ? 'se usa el mayor' : 'se usa el menor'}
              </div>
            )}
          </div>
        )}

        {/* Roll history */}
        {rollHistory.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>Últimas tiradas</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {rollHistory.map((r, i) => (
                <div key={i} style={{ flex: 1, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${r.resultColor}33`, borderRadius: '8px', textAlign: 'center', opacity: 1 - i * 0.28 }}>
                  <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: '700', color: r.resultColor }}>{r.total}</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-dim)' }}>d20={r.nat}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Combat stat cards + turn actions ─────── */}
      <div className="cs-fantasy-card">
        <div className="cs-card-header">
          <GameIcon author={ICONS.shield.author} name={ICONS.shield.name} size={16} color="c7a242" />
          <h2 className="cs-card-title">✦ Entiende tus stats</h2>
          <div className="cs-card-divider" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.2rem' }}>
          {[
            { label: 'CA',          value: ac,                    desc: 'Clase de Armadura. Lo difícil que eres de golpear.' },
            { label: 'Iniciativa',  value: fmtMod(initiative),   desc: 'Orden de acción en combate. Basado en tu DES.' },
            { label: 'Inspiración', value: inspiration,           desc: 'Otorgada por el DM. Ventaja en una tirada clave.' },
            { label: 'Prof.',       value: `+${prof}`,           desc: 'Bono de Proficiencia. Suma a habilidades entrenadas.' },
            { label: 'PG',          value: `${hp}/${hpMax}`,     desc: 'Puntos de Golpe. A 0 quedás inconsciente.' },
            { label: 'Concentración', value: draft.activeConcentration ? '● Activa' : '—', desc: 'Solo un conjuro de conc. activo a la vez.' },
          ].map(({ label, value, desc }) => (
            <div key={label} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(234,199,94,0.18)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-2)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: '700', color: 'var(--green-1)', lineHeight: 1 }}>{value}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.4', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-title)', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '10px' }}>¿Qué puedo hacer en mi turno?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {[
            { icon: ICONS.speed,      label: 'Moverte',            desc: 'Hasta tu velocidad sin gastar acción.' },
            { icon: ICONS.sword,      label: 'Acción',             desc: 'Atacar, conjurar, ayudar, esquivar...' },
            { icon: ICONS.initiative, label: 'Acción adicional',   desc: 'Solo si una habilidad te la permite.' },
            { icon: ICONS.perception, label: 'Interacción',        desc: 'Abrir puerta, sacar objeto del inventario.' },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '10px', textAlign: 'center' }}>
              <GameIcon author={icon.author} name={icon.name} size={20} color="c7a242" />
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '8px', letterSpacing: '1px', color: accent, textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.3' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Lore tab ──────────────────────────────────────────────────────────────────
function LoreTab({ lore, editing, isOwner, updateLore, accent }) {
  const fields = [
    { key: 'rasgos',   label: 'Rasgos de Personalidad', placeholder: 'Maneras de hablar, hábitos, peculiaridades...', rows: 3 },
    { key: 'ideal',    label: 'Ideal',                  placeholder: 'Lo que el personaje valora profundamente...' },
    { key: 'defecto',  label: 'Defecto',                placeholder: 'La debilidad o vicio del personaje...' },
    { key: 'meta',     label: 'Meta',                   placeholder: 'El objetivo a largo plazo del personaje...' },
    { key: 'historia', label: 'Trasfondo Narrativo',    placeholder: 'Historia del personaje antes de la campaña...', rows: 6 },
    { key: 'vinculos', label: 'Vínculos Actuales',      placeholder: 'Relaciones y lazos forjados durante la aventura...', rows: 4 },
  ];
  const canEdit = editing && isOwner;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
      {fields.map(f => (
        <Section key={f.key} title={f.label} iconEl={<GameIcon author={ICONS.lore.author} name={ICONS.lore.name} size={16} color="c7a242" />}>
          {canEdit
            ? f.rows
              ? <textarea value={lore?.[f.key] || ''} onChange={e => updateLore(f.key, e.target.value)}
                  style={sl.textarea} placeholder={f.placeholder} rows={f.rows} />
              : <input value={lore?.[f.key] || ''} onChange={e => updateLore(f.key, e.target.value)}
                  style={sl.input} placeholder={f.placeholder} />
            : <p style={{ ...sl.loreTxt, color: lore?.[f.key] ? 'var(--parchment-dim)' : 'var(--gold-dim)', fontStyle: lore?.[f.key] ? 'normal' : 'italic' }}>
                {lore?.[f.key] || f.placeholder}
              </p>}
        </Section>
      ))}
    </div>
  );
}

// ── Inventory tab (unchanged) ─────────────────────────────────────────────────
function InventoryTab({ inventoryItems, itemSearch, setItemSearch, addToInventory, removeFromInventory, toggleEquipped, changeQuantity, isOwner, unequipSlot, portrait, isMobile, accent, customItems, createCustomItem }) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const customMap = Object.fromEntries((customItems || []).map(i => [i.id, i]));
  const getItem = (itemId) => ITEMS_MAP[itemId] || customMap[itemId] || null;

  const allSearchable = [
    ...ALL_ITEMS,
    ...(customItems || []).map(i => ({ ...i, isCustom: true })),
  ];
  const searchResults = itemSearch.length > 1
    ? allSearchable.filter(item =>
        !inventoryItems.find(i => i.itemId === item.id) &&
        (item.nombre.toLowerCase().includes(itemSearch.toLowerCase()) ||
         (TYPE_LABEL[item.tipo] || 'Personalizado').toLowerCase().includes(itemSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  const equippedItems   = inventoryItems.filter(i => i.equipped);
  const unequippedItems = inventoryItems.filter(i => !i.equipped);
  const equippedWeapons = equippedItems
    .map(i => ({ inv: i, item: getItem(i.itemId) }))
    .filter(({ item }) => item?.tipo === 'weapon');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      <EquipmentSlots inventoryItems={inventoryItems} unequipSlot={unequipSlot} portrait={portrait} isMobile={isMobile} accent={accent} customItems={customItems} />
      {isOwner && (
        <div style={iv.searchWrap}>
          <div style={iv.sectionLabel}>Agregar objeto al inventario</div>
          <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} style={iv.searchInput}
            placeholder="Buscar por nombre o tipo (arma, armadura, poción, objeto mágico)..." />
          {searchResults.length > 0 && (
            <div style={iv.searchResults}>
              {searchResults.map(item => (
                <div key={item.id} style={iv.searchResult}>
                  <span style={{ minWidth: '24px', display: 'flex', alignItems: 'center' }}><ItemIcon item={item} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={iv.resultName}>{item.nombre}</span>
                      <span style={{ ...iv.typeBadge, borderColor: TYPE_COLOR[item.tipo] || '#a07ad0', color: TYPE_COLOR[item.tipo] || '#a07ad0' }}>{TYPE_LABEL[item.tipo] || 'Personalizado'}</span>
                      {item.isCustom && <span style={{ ...iv.typeBadge, borderColor: 'var(--gold-dim)', color: 'var(--gold-dim)' }}>✦ Custom</span>}
                    </div>
                    <div style={iv.resultDesc}>{item.descripcion}</div>
                  </div>
                  <button style={iv.addBtn} onClick={() => { addToInventory(item.id); setItemSearch(''); }}>+ Agregar</button>
                </div>
              ))}
            </div>
          )}
          <button style={{ ...iv.addBtn, marginTop: '8px', color: 'var(--gold-dim)', borderColor: 'var(--line)', fontSize: '8px' }}
            onClick={() => setShowCustomModal(true)}>
            ✦ Crear item personalizado
          </button>
        </div>
      )}

      {equippedWeapons.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Ataques</span><div style={iv.sectionLine} /></div>
          <div style={iv.attackTable}>
            <div style={iv.attackHeader}><span>Arma</span><span>Daño</span><span>Tipo</span><span>Propiedades</span></div>
            {equippedWeapons.map(({ inv, item }) => (
              <div key={inv.itemId} style={iv.attackRow}>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--parchment)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GameIcon author={ICONS.broadsword.author} name={ICONS.broadsword.name} size={14} color="c7a242" />
                  {item.nombre}
                </span>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--ember)' }}>{item.stats?.daño || '—'}</span>
                <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)' }}>{item.stats?.tipoDaño || '—'}</span>
                <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)' }}>{item.stats?.propiedades?.join(', ') || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {equippedItems.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Equipado</span><div style={iv.sectionLine} /></div>
          {equippedItems.map(inv => (
            <ItemRow key={inv.itemId} inv={inv} isOwner={isOwner} getItem={getItem}
              toggleEquipped={toggleEquipped} removeFromInventory={removeFromInventory} changeQuantity={changeQuantity} />
          ))}
        </div>
      )}

      {unequippedItems.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Mochila</span><div style={iv.sectionLine} /></div>
          {unequippedItems.map(inv => (
            <ItemRow key={inv.itemId} inv={inv} isOwner={isOwner} getItem={getItem}
              toggleEquipped={toggleEquipped} removeFromInventory={removeFromInventory} changeQuantity={changeQuantity} />
          ))}
        </div>
      )}

      {inventoryItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', border: '1px solid var(--line)', background: 'var(--panel)' }}>
          Inventario vacío · Usá el buscador para agregar objetos
        </div>
      )}

      {showCustomModal && (
        <CustomItemModal onClose={() => setShowCustomModal(false)} onSave={item => { createCustomItem(item); addToInventory(item.id); setShowCustomModal(false); }} />
      )}
    </div>
  );
}

function ItemRow({ inv, isOwner, toggleEquipped, removeFromInventory, changeQuantity, getItem }) {
  const item = getItem ? getItem(inv.itemId) : ITEMS_MAP[inv.itemId];
  if (!item) return null;
  const statsText = item.tipo === 'weapon'
    ? `${item.stats?.daño || '—'} ${item.stats?.tipoDaño || ''}`
    : item.tipo === 'armor'
    ? `CA ${item.stats?.caBase}${item.stats?.armorType !== 'heavy' ? ' + DES' : ''}`
    : item.stats?.efecto || '';
  const typeColor = TYPE_COLOR[item.tipo] || '#a07ad0';
  const typeLabel = TYPE_LABEL[item.tipo] || 'Personalizado';
  return (
    <div style={{ ...iv.itemRow, background: inv.equipped ? 'rgba(199,162,66,0.06)' : 'rgba(5,5,4,0.5)' }}>
      <span style={{ minWidth: '28px', display: 'flex', alignItems: 'center', paddingTop: '2px' }}><ItemIcon item={item} size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={iv.itemName}>{item.nombre}</span>
          <span style={{ ...iv.typeBadge, borderColor: typeColor, color: typeColor }}>{typeLabel}</span>
          {item.isCustom && <span style={{ ...iv.typeBadge, borderColor: 'var(--gold-dim)', color: 'var(--gold-dim)' }}>✦ Custom</span>}
          {inv.equipped && <span style={iv.equippedBadge}>✓ Equipado</span>}
          {item.tipo === 'potion' && (inv.quantity || 1) > 1 && <span style={iv.equippedBadge}>×{inv.quantity}</span>}
        </div>
        <div style={iv.itemStats}>{statsText}</div>
        {item.descripcion && <div style={iv.itemDesc}>{item.descripcion}</div>}
      </div>
      {isOwner && (
        <div style={iv.itemActions}>
          {item.tipo === 'potion'
            ? <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button style={iv.qtyBtn} onClick={() => changeQuantity(inv.itemId, -1)}>−</button>
                <span style={iv.qtyVal}>{inv.quantity || 1}</span>
                <button style={iv.qtyBtn} onClick={() => changeQuantity(inv.itemId, 1)}>+</button>
              </div>
            : <button style={{ ...iv.actionBtn, borderColor: inv.equipped ? 'var(--gold-dim)' : 'var(--line)', color: inv.equipped ? 'var(--gold)' : 'var(--parchment-dim)' }}
                onClick={() => toggleEquipped(inv.itemId)}>
                {inv.equipped ? 'Desequipar' : 'Equipar'}
              </button>}
          <button style={{ ...iv.actionBtn, color: 'var(--ember-dim)', borderColor: 'transparent', marginTop: '4px' }}
            onClick={() => removeFromInventory(inv.itemId)}>
            ✕ Quitar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Equipment slot box ────────────────────────────────────────────────────────
function SlotBox({ slotId, item, side, isMobile, showTooltip, onSlotAction, onMobileUnequip, accent }) {
  const [hovered, setHovered] = useState(false);
  const info = SLOT_INFO[slotId];
  const showTip = isMobile ? showTooltip : (hovered && !!item);
  const accentColor = accent || 'var(--gold)';

  const statsText = !item?.itemData ? ''
    : item.itemData.tipo === 'weapon' ? `${item.itemData.stats?.daño || '—'} ${item.itemData.stats?.tipoDaño || ''}`
    : item.itemData.tipo === 'armor'  ? `CA ${item.itemData.stats?.caBase}`
    : item.itemData.stats?.efecto     ? item.itemData.stats.efecto.substring(0, 70) + '…'
    : '';

  const tipPos = {
    right: { left: '58px', top: '-2px' },
    left:  { right: '58px', top: '-2px' },
    up:    { bottom: '58px', left: '50%', transform: 'translateX(-50%)' },
  }[side] || { left: '58px', top: '-2px' };

  // resolve icon: equipped item emoji → item type GameIcon → slot GameIcon
  const slotIconKey = SLOT_ICON_KEYS[slotId];
  const itemType    = item?.itemData?.tipo;
  const typeIconKey = TYPE_ICON_KEY[itemType];
  const resolvedIconEl = item
    ? (item.itemData?.emoji
        ? <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.itemData.emoji}</span>
        : (typeIconKey && ICONS[typeIconKey]
            ? <GameIcon author={ICONS[typeIconKey].author} name={ICONS[typeIconKey].name} size={22} color={accentColor.replace('var(--gold)', 'c7a242').replace('#', '')} />
            : <span style={{ fontSize: '20px' }}>{info.icon}</span>))
    : (slotIconKey && ICONS[slotIconKey]
        ? <GameIcon author={ICONS[slotIconKey].author} name={ICONS[slotIconKey].name} size={18} color="4a4030" />
        : <span style={{ fontSize: '16px', opacity: 0.22 }}>{info.icon}</span>);

  return (
    <div
      style={{ width: '52px', height: '52px', position: 'relative', border: `1px solid ${item ? accentColor + '80' : 'var(--border-gold)'}`, background: item ? `${accentColor}12` : 'var(--bg-panel)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: item ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s', opacity: item ? 1 : 0.5, ...(hovered && item && !isMobile ? { borderColor: accentColor, background: `${accentColor}22` } : {}) }}
      onClick={onSlotAction}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {resolvedIconEl}
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '6px', color: item ? accentColor : 'rgba(255,255,255,0.15)', letterSpacing: '0.3px', maxWidth: '48px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: '2px' }}>
        {item ? item.itemData?.nombre : info.label}
      </span>

      {showTip && item && (
        <div style={{ position: 'absolute', ...tipPos, zIndex: 200, width: '190px', background: '#0e0b08', border: `1px solid ${accentColor}66`, padding: '10px 12px', pointerEvents: isMobile ? 'auto' : 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.85)' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: accentColor, marginBottom: '3px' }}>{item.itemData?.nombre}</div>
          {item.itemData?.isCustom && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: accentColor, marginBottom: '4px' }}>✦ CUSTOM</div>}
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: TYPE_COLOR[item.itemData?.tipo] || '#a07ad0', textTransform: 'uppercase', marginBottom: '6px' }}>{TYPE_LABEL[item.itemData?.tipo] || 'Personalizado'}</div>
          {statsText && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ember)', marginBottom: '4px' }}>{statsText}</div>}
          {item.itemData?.descripcion && <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', lineHeight: 1.4 }}>{item.itemData.descripcion}</div>}
          {isMobile && (
            <button onClick={e => { e.stopPropagation(); onMobileUnequip(); }}
              style={{ marginTop: '8px', background: 'rgba(139,26,26,0.2)', border: '1px solid rgba(139,26,26,0.5)', color: 'var(--ember)', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '5px 8px', cursor: 'pointer', width: '100%', textTransform: 'uppercase' }}>
              ✕ Desequipar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Equipment slots panel (D&D 5e — 10 slots) ─────────────────────────────────
function EquipmentSlots({ inventoryItems, unequipSlot, portrait, isMobile, accent, customItems }) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const customMap = Object.fromEntries((customItems || []).map(i => [i.id, i]));
  const getItemData = (itemId) => ITEMS_MAP[itemId] || customMap[itemId] || null;

  const slotMap = {};
  inventoryItems.filter(i => i.equipped && i.equippedSlot).forEach(i => {
    slotMap[i.equippedSlot] = { ...i, itemData: getItemData(i.itemId) };
  });

  const LEFT  = ['mainhand', 'offhand', 'chest', 'head', 'neck'];
  const RIGHT = ['cloak', 'hands', 'feet', 'ring1', 'ring2'];

  const mkSlot = (slotId, side) => (
    <SlotBox
      key={slotId}
      slotId={slotId}
      item={slotMap[slotId]}
      side={side}
      isMobile={isMobile}
      accent={accent}
      showTooltip={activeTooltip === slotId}
      onSlotAction={() => {
        if (!slotMap[slotId]) return;
        if (isMobile) setActiveTooltip(activeTooltip === slotId ? null : slotId);
        else unequipSlot(slotId);
      }}
      onMobileUnequip={() => { unequipSlot(slotId); setActiveTooltip(null); }}
    />
  );

  if (isMobile) {
    return (
      <div style={eq.wrap}>
        <div style={eq.label}>Equipo</div>
        {portrait && (
          <div style={{ width: '100%', height: '150px', background: 'var(--void)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <img src={portrait} alt="" style={{ maxWidth: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', justifyItems: 'center' }}>
          {LEFT.map((s, i) => <React.Fragment key={s}>{mkSlot(s, 'right')}{mkSlot(RIGHT[i], 'left')}</React.Fragment>)}
        </div>
      </div>
    );
  }

  return (
    <div style={eq.wrap}>
      <div style={eq.label}>Equipo — D&amp;D 5e</div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 52px', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          {LEFT.map(s => mkSlot(s, 'right'))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {portrait
            ? <img src={portrait} alt="" style={{ maxHeight: '280px', maxWidth: '200px', width: '100%', objectFit: 'contain', background: 'var(--void)', display: 'block' }} />
            : <div style={{ width: '120px', height: '264px', background: '#060504', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.18 }}>
                <span style={{ fontSize: '48px' }}>⚔️</span>
              </div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          {RIGHT.map(s => mkSlot(s, 'left'))}
        </div>
      </div>
    </div>
  );
}

// ── Custom item creation modal ────────────────────────────────────────────────
const CUSTOM_TIPOS = [
  { id: 'weapon', label: 'Arma' }, { id: 'armor', label: 'Armadura' },
  { id: 'potion', label: 'Poción' }, { id: 'magic', label: 'Objeto Mágico' },
  { id: 'custom', label: 'Personalizado' },
];
const CUSTOM_SLOTS = [
  { id: '', label: 'Mochila (sin slot)' }, { id: 'mainhand', label: 'Mano Principal' },
  { id: 'offhand', label: 'Mano Secundaria' }, { id: 'chest', label: 'Armadura' },
  { id: 'head', label: 'Casco' }, { id: 'cloak', label: 'Capa' },
  { id: 'hands', label: 'Guantes' }, { id: 'feet', label: 'Botas' },
  { id: 'neck', label: 'Amuleto' }, { id: 'ring', label: 'Anillo' },
];

function CustomItemModal({ onSave, onClose }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo]     = useState('custom');
  const [emoji, setEmoji]   = useState('');
  const [desc, setDesc]     = useState('');
  const [basedOn, setBasedOn] = useState('');
  const [slot, setSlot]     = useState('');
  const [daño, setDaño]     = useState('1d6');
  const [tipoDaño, setTipoDaño] = useState('contundente');
  const [bonoAtaque, setBonoAtaque] = useState(0);
  const [propiedades, setPropiedades] = useState('');
  const [caBase, setCaBase] = useState(12);
  const [armorType, setArmorType] = useState('light');
  const [efecto, setEfecto] = useState('');
  const [caBonus, setCaBonus] = useState(0);

  useEffect(() => {
    if (!basedOn) return;
    const base = ITEMS_MAP[basedOn];
    if (!base) return;
    setTipo(base.tipo);
    setDesc(base.descripcion || '');
    setSlot(base.slot || '');
    if (base.tipo === 'weapon') { setDaño(base.stats.daño || '1d6'); setTipoDaño(base.stats.tipoDaño || ''); setPropiedades(base.stats.propiedades?.join(', ') || ''); }
    else if (base.tipo === 'armor') { setCaBase(base.stats.caBase || 10); setArmorType(base.stats.armorType || 'light'); }
    else { setEfecto(base.stats.efecto || ''); setCaBonus(base.stats.caBonus || 0); }
  }, [basedOn]);

  const buildStats = () => {
    if (tipo === 'weapon') return { daño, tipoDaño, propiedades: propiedades.split(',').map(s => s.trim()).filter(Boolean), atributo: 'fue', bonoAtaque: parseInt(bonoAtaque) || 0 };
    if (tipo === 'armor') return { caBase: parseInt(caBase) || 10, armorType, desventajaFurtividad: false };
    return { efecto, caBonus: parseInt(caBonus) || 0 };
  };

  const handleSave = () => {
    if (!nombre.trim()) return;
    onSave({ id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, nombre: nombre.trim(), tipo, emoji: (emoji || '').slice(0, 2), descripcion: desc, slot: slot || null, stats: buildStats(), isCustom: true });
  };

  const inp = { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '7px 10px', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px', marginTop: '10px' };
  const sel = { ...inp, cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2.5px', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '16px' }}>✦ Crear Item Personalizado</div>

        <label style={lbl}>Nombre *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} placeholder="Ej: Nube Sagrada" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={lbl}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={sel}>
              {CUSTOM_TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Emoji / Ícono</label>
            <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} style={{ ...inp, fontSize: '20px', textAlign: 'center' }} placeholder="⚔️" />
          </div>
        </div>

        <label style={lbl}>Basado en (opcional)</label>
        <select value={basedOn} onChange={e => setBasedOn(e.target.value)} style={sel}>
          <option value="">— Ninguno —</option>
          {ALL_ITEMS.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>

        <label style={lbl}>Descripción</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} rows={2} placeholder="Descripción del objeto..." />

        {tipo === 'weapon' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><label style={lbl}>Daño</label><input value={daño} onChange={e => setDaño(e.target.value)} style={inp} placeholder="1d6" /></div>
            <div><label style={lbl}>Tipo de daño</label><input value={tipoDaño} onChange={e => setTipoDaño(e.target.value)} style={inp} placeholder="cortante" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
            <div><label style={lbl}>Bono ataque</label><input type="number" value={bonoAtaque} onChange={e => setBonoAtaque(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Propiedades (coma separadas)</label><input value={propiedades} onChange={e => setPropiedades(e.target.value)} style={inp} placeholder="versátil, arrojadiza..." /></div>
          </div>
        </>}
        {tipo === 'armor' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
            <div><label style={lbl}>CA Base</label><input type="number" value={caBase} onChange={e => setCaBase(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Tipo</label>
              <select value={armorType} onChange={e => setArmorType(e.target.value)} style={sel}>
                <option value="light">Ligera</option><option value="medium">Media</option><option value="heavy">Pesada</option>
              </select>
            </div>
          </div>
        </>}
        {(tipo === 'potion' || tipo === 'magic' || tipo === 'custom') && <>
          <label style={lbl}>Efecto</label>
          <textarea value={efecto} onChange={e => setEfecto(e.target.value)} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} rows={2} placeholder="Describe el efecto..." />
          {tipo !== 'potion' && <><label style={lbl}>Bono CA</label><input type="number" value={caBonus} onChange={e => setCaBonus(e.target.value)} style={{ ...inp, width: '80px' }} /></>}
        </>}

        <label style={lbl}>Slot de equipo</label>
        <select value={slot} onChange={e => setSlot(e.target.value)} style={sel}>
          {CUSTOM_SLOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>Cancelar</button>
          <button onClick={handleSave} disabled={!nombre.trim()} style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-dim)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '8px 16px', cursor: nombre.trim() ? 'pointer' : 'not-allowed', textTransform: 'uppercase', opacity: nombre.trim() ? 1 : 0.5 }}>✦ Crear Item</button>
        </div>
      </div>
    </div>
  );
}

// ── Spell slot row ────────────────────────────────────────────────────────────
function SpellSlotRow({ level, total, used, isOwner, accent, onUse, onRecover }) {
  const available = total - used;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', minWidth: '52px' }}>Nivel {level}</span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Array.from({ length: total }, (_, i) => {
          const filled = i < available;
          return (
            <div key={i} onClick={isOwner ? (filled ? onUse : onRecover) : undefined}
              title={isOwner ? (filled ? 'Clic para gastar' : 'Clic para recuperar') : ''}
              style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${filled ? accent : accent + '44'}`, background: filled ? accent : 'transparent', cursor: isOwner ? 'pointer' : 'default', transition: 'all 0.15s', boxShadow: filled ? `0 0 8px ${accent}44` : 'none' }} />
          );
        })}
      </div>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold-dim)', letterSpacing: '1px' }}>{available}/{total}</span>
    </div>
  );
}

// ── Spell meta line ───────────────────────────────────────────────────────────
function SpellMeta({ label, value }) {
  return (
    <div>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>{label}</span>
      <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)' }}>{value}</span>
    </div>
  );
}

// ── Spell card ────────────────────────────────────────────────────────────────
const SCHOOL_COLORS = {
  'Abjuración': '#6a9fd8', 'Evocación': '#d8a06a', 'Encantamiento': '#a06ad8',
  'Adivinación': '#6ad8d8', 'Transmutación': '#6ad87a', 'Conjuración': '#d8d86a',
  'Necromancia': '#8b8b8b', 'Ilusión': '#d86a9f',
};

function SpellCard({ spell, isOwner, accent, expanded, onToggle, onCast, onUnprepare, canCast, isConcentration }) {
  const schoolColor = SCHOOL_COLORS[spell.escuela] || 'var(--gold-dim)';
  const hasSlot     = onCast && !spell.esHabilidad && spell.nivel > 0;
  return (
    <div style={{ border: `1px solid ${isConcentration ? accent : 'var(--line)'}`, background: isConcentration ? `${accent}0a` : 'rgba(11,9,6,0.4)', marginBottom: '6px', transition: 'border-color 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)', fontWeight: '700', flex: 1 }}>{spell.nombre}</span>
        {spell.esHabilidad
          ? <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: 'var(--gold-dim)', border: '1px solid var(--line)', padding: '2px 6px', textTransform: 'uppercase' }}>HABILIDAD</span>
          : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: accent, border: `1px solid ${accent}55`, padding: '2px 8px' }}>Nv.{spell.nivel}</span>}
        {spell.concentracion && <span style={{ color: 'var(--ember)', fontSize: '8px' }}>●</span>}
        <span style={{ color: 'var(--gold-dim)', fontSize: '9px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px 8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: schoolColor, border: `1px solid ${schoolColor}55`, padding: '1px 6px', textTransform: 'uppercase' }}>{spell.escuela}</span>
        {spell.concentracion && <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: 'var(--ember)', border: '1px solid var(--ember-dim)', padding: '1px 6px', textTransform: 'uppercase' }}>● Concentración</span>}
        {spell.ritual && <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: '#6ad8d8', border: '1px solid #6ad8d855', padding: '1px 6px', textTransform: 'uppercase' }}>Ritual</span>}
        {isConcentration && <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: accent, border: `1px solid ${accent}`, padding: '1px 6px', textTransform: 'uppercase' }}>✦ Activo</span>}
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '12px' }}>
          <p style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', lineHeight: '1.6', margin: '0 0 12px 0' }}>{spell.descripcion}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '12px' }}>
            <SpellMeta label="Tiempo" value={spell.tiempoCasteo} />
            <SpellMeta label="Alcance" value={spell.alcance} />
            <SpellMeta label="Duración" value={spell.duracion} />
            <SpellMeta label="Componentes" value={spell.componentes} />
          </div>
          {isOwner && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasSlot && (
                <button onClick={onCast} disabled={!canCast}
                  style={{ background: canCast ? `${accent}20` : 'transparent', border: `1px solid ${canCast ? accent : 'var(--line)'}`, color: canCast ? accent : 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '6px 14px', cursor: canCast ? 'pointer' : 'not-allowed', textTransform: 'uppercase' }}>
                  ✨ Castear
                </button>
              )}
              {onUnprepare && (
                <button onClick={onUnprepare}
                  style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ember-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  ✕ Quitar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spells tab ────────────────────────────────────────────────────────────────
function SpellsTab({ spellSlots, preparedSpells, maxPrepared, isOwner, accent, charClass, charLevel, charStats, isMobile, updateSpellSlot, longRest, togglePrepared, castSpell, activeConcentration }) {
  const [expanded, setExpanded]       = useState(null);
  const [spellSearch, setSpellSearch] = useState('');

  const normalizedClass  = normalizeClass(charClass);
  const hasSpellcasting  = normalizedClass !== null;
  const classSpells      = normalizedClass
    ? ALL_SPELLS.filter(s => s.clases?.includes(normalizedClass) && !s.esHabilidad)
    : [];
  const abilities        = normalizedClass
    ? ALL_SPELLS.filter(s => s.clases?.includes(normalizedClass) && s.esHabilidad)
    : [];

  const searchResults = spellSearch.length > 1
    ? classSpells.filter(s =>
        !preparedSpells.includes(s.id) &&
        (s.nombre.toLowerCase().includes(spellSearch.toLowerCase()) ||
         s.escuela.toLowerCase().includes(spellSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  const preparedList  = preparedSpells.map(id => SPELLS_MAP[id]).filter(Boolean);
  const activeSlots   = Object.entries(spellSlots || {}).filter(([, d]) => d.total > 0).sort(([a], [b]) => parseInt(a) - parseInt(b));

  const canCast = (spell) => {
    if (spell.nivel === 0 || spell.esHabilidad) return true;
    return Object.entries(spellSlots || {}).some(([lvl, d]) => parseInt(lvl) >= spell.nivel && d.total - d.used > 0);
  };

  const toggle = (id) => setExpanded(e => e === id ? null : id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>

      {/* Botones descanso */}
      {isOwner && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={sp.restBtn} onClick={longRest}>☽ Descanso Largo</button>
          <button style={{ ...sp.restBtn, opacity: 0.35, cursor: 'not-allowed' }} disabled>☀ Descanso Corto</button>
        </div>
      )}

      {/* Sección A — Espacios */}
      <Section title="Espacios de Conjuro" iconEl={<GameIcon author={ICONS.spell.author} name={ICONS.spell.name} size={16} color="c7a242" />}>
        {!charClass
          ? <div style={sp.muted}>Configurá la clase del personaje (tab Ficha → Editar) para ver sus espacios de conjuro.</div>
          : !hasSpellcasting
          ? <div style={sp.muted}>Esta clase no tiene conjuros de forma nativa. Si el personaje tiene una subclase mágica, los espacios se pueden gestionar manualmente desde el DM.</div>
          : activeSlots.length === 0
          ? <div style={sp.muted}>No hay espacios de conjuro guardados. Descanso largo para reinicializar.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeSlots.map(([lvl, data]) => (
                <SpellSlotRow key={lvl} level={parseInt(lvl)} total={data.total} used={data.used}
                  isOwner={isOwner} accent={accent}
                  onUse={() => updateSpellSlot(lvl, data.used + 1)}
                  onRecover={() => updateSpellSlot(lvl, data.used - 1)} />
              ))}
            </div>}
      </Section>

      {/* Sección B — Conjuros preparados */}
      <Section title={`Conjuros Preparados — ${preparedList.length} / ${maxPrepared}`} iconEl={<GameIcon author={ICONS.spell.author} name={ICONS.spell.name} size={16} color="c7a242" />}>
        {preparedList.length === 0
          ? <div style={sp.muted}>Ningún conjuro preparado. Usa el buscador para preparar.</div>
          : preparedList.map(spell => (
              <SpellCard key={spell.id} spell={spell} isOwner={isOwner} accent={accent}
                expanded={expanded === spell.id} onToggle={() => toggle(spell.id)}
                onCast={() => castSpell(spell.id)} onUnprepare={() => togglePrepared(spell.id)}
                canCast={canCast(spell)} isConcentration={activeConcentration === spell.id} />
            ))}
      </Section>

      {/* Sección C — Agregar conjuros */}
      {isOwner && (
        <Section title="Agregar Conjuros" iconEl={<GameIcon author={ICONS.spell.author} name={ICONS.spell.name} size={16} color="c7a242" />}>
          {!charClass
            ? <div style={sp.muted}>Configurá la clase del personaje en la tab Ficha → Editar para ver los conjuros disponibles.</div>
            : !hasSpellcasting
            ? <div style={sp.muted}>Los {charClass}s no tienen lista de conjuros nativa. Clases sin magia propia: Guerrero, Bárbaro, Monje, Pícaro.</div>
            : <>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-dim)', marginBottom: '8px' }}>
                  Máximo preparados: <span style={{ color: accent }}>{maxPrepared}</span>
                  <span style={{ color: 'var(--line)', margin: '0 6px' }}>·</span>
                  <span style={{ fontStyle: 'italic', fontFamily: 'Crimson Pro,serif', fontSize: '10px' }}>CAR mod + nivel de personaje</span>
                </div>
                <input value={spellSearch} onChange={e => setSpellSearch(e.target.value)}
                  style={sp.searchInput} placeholder="Buscar por nombre o escuela..." />
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {searchResults.map(spell => (
                      <div key={spell.id} style={sp.searchRow}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold-bright)' }}>{spell.nombre}</span>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', border: `1px solid ${SCHOOL_COLORS[spell.escuela] || 'var(--line)'}55`, color: SCHOOL_COLORS[spell.escuela] || 'var(--gold-dim)', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{spell.escuela}</span>
                            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', color: accent, border: `1px solid ${accent}55`, padding: '1px 5px' }}>Nv.{spell.nivel}</span>
                            {spell.concentracion && <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', color: 'var(--ember)', letterSpacing: '0.5px' }}>● Conc.</span>}
                          </div>
                          <div style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', marginTop: '2px', lineHeight: 1.3 }}>{spell.descripcion?.substring(0, 90)}…</div>
                        </div>
                        <button style={{ ...sp.addBtn, opacity: preparedList.length >= maxPrepared ? 0.4 : 1 }}
                          disabled={preparedList.length >= maxPrepared}
                          onClick={() => { if (preparedList.length < maxPrepared) { togglePrepared(spell.id); setSpellSearch(''); } }}>
                          + Preparar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {spellSearch.length > 1 && searchResults.length === 0 && (
                  <div style={{ ...sp.muted, marginTop: '8px' }}>Sin resultados para "{spellSearch}".</div>
                )}

                {/* Habilidades de clase — solo las de la clase de este personaje */}
                {abilities.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Habilidades de Clase</div>
                    {abilities.map(ab => (
                      <SpellCard key={ab.id} spell={ab} isOwner={false} accent={accent}
                        expanded={expanded === ab.id} onToggle={() => toggle(ab.id)}
                        onCast={null} onUnprepare={null} canCast={false} isConcentration={false} />
                    ))}
                  </div>
                )}
              </>}
        </Section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const s = {
  page:           { padding: '0 24px 40px' },
  loading:        { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'var(--font-title)', color: 'var(--text-dim)', letterSpacing: '3px', fontSize: '11px' },
  topBar:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  backBtn:        { background: 'transparent', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '4px' },
  editBtn:        { background: 'rgba(247,221,120,0.07)', border: '1px solid rgba(247,221,120,0.3)', color: 'var(--gold-1)', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '500', padding: '6px 14px', cursor: 'pointer', borderRadius: '8px' },
  saveBtn:        { background: 'rgba(101,194,96,0.15)', border: '1px solid rgba(101,194,96,0.45)', color: 'var(--green-1)', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '500', padding: '6px 14px', cursor: 'pointer', borderRadius: '8px' },
  cancelBtn:      { background: 'transparent', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '11px', padding: '6px 14px', cursor: 'pointer', borderRadius: '8px' },
  formLabel:      { fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase' },
  fileInput:      { background: 'transparent', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--gold-1)', fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '6px', cursor: 'pointer', borderRadius: '6px' },
  inputLarge:     { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.3)', color: 'var(--gold-1)', fontFamily: 'var(--font-title)', fontSize: '24px', fontWeight: '700', padding: '6px 10px', width: '100%', borderRadius: '6px', outline: 'none' },
  inputFull:      { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '8px', width: '100%', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
  inputNum:       { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.25)', color: 'var(--gold-1)', fontFamily: 'var(--font-title)', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px', borderRadius: '6px', outline: 'none' },
  textarea:       { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.6', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
  barTrack:       { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: '2px', transition: 'width 0.4s' },
  statsGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' },
  statBlock:      { padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '10px', transition: 'border-color 0.2s' },
  statName:       { fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase' },
  statScore:      { fontSize: '24px', fontWeight: '700', color: 'var(--text-main)' },
  statMod:        { fontSize: '13px', fontWeight: '600' },
  notesText:      { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.7', whiteSpace: 'pre-wrap', margin: 0 },
  readOnlyBadge:  { textAlign: 'center', padding: '10px', fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '1px', color: 'var(--text-dim)', border: '1px solid rgba(234,199,94,0.15)', marginTop: '12px', borderRadius: '8px' },
};

const ss = {
  section:      { padding: '14px' },
  sectionHeader:{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  sectionTitle: { fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine:  { flex: 1, height: '1px' },
  inputNum:     { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.25)', color: 'var(--gold-1)', fontFamily: 'var(--font-title)', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px', borderRadius: '6px', outline: 'none' },
};

// Ficha-specific styles
const fs = {
  row:      { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 2px', borderBottom: '1px solid rgba(255,255,255,0.03)', minHeight: '26px' },
  extraBox: { flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,199,94,0.15)', padding: '10px 12px', borderRadius: '8px' },
};

// Lore-specific styles
const sl = {
  textarea: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.7', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
  input:    { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '8px 10px', width: '100%', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' },
  loreTxt:  { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-soft)', lineHeight: '1.7', whiteSpace: 'pre-wrap', margin: 0 },
};

// Spells styles
const sp = {
  restBtn:     { background: 'rgba(247,221,120,0.07)', border: '1px solid rgba(234,199,94,0.25)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', borderRadius: '8px' },
  searchInput: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '8px 12px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', outline: 'none' },
  searchRow:   { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '8px' },
  addBtn:      { background: 'rgba(247,221,120,0.1)', border: '1px solid rgba(234,199,94,0.3)', color: 'var(--gold-1)', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '500', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start', flexShrink: 0, borderRadius: '6px' },
  muted:       { fontFamily: 'var(--font-ui)', fontStyle: 'italic', fontSize: '12px', color: 'var(--text-dim)' },
};

// Equipment slots styles
const eq = {
  wrap:  { background: 'var(--bg-panel)', border: '1px solid var(--border-gold)', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  label: { fontFamily: 'var(--font-title)', fontSize: '11px', letterSpacing: '3px', color: 'var(--gold-2)', textTransform: 'uppercase', marginBottom: '12px' },
};

// Navbar / tab / mode styles
const nb = {
  tabBar:        { display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(5,5,4,0.68)', borderRadius: '999px', border: '1px solid var(--border-gold)' },
  tab:           { background: 'transparent', border: '1px solid transparent', borderRadius: '20px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '500', padding: '7px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s', letterSpacing: '0.3px' },
  tabActive:     { background: 'var(--bg-panel)', border: '1px solid var(--border-gold-strong)', color: 'var(--gold-1)' },
  badge:         { fontSize: '9px', padding: '1px 6px', borderRadius: '99px', fontWeight: '600' },
  modeBar:       { display: 'inline-flex', gap: '3px', padding: '4px', background: 'rgba(5,5,4,0.68)', borderRadius: '999px', border: '1px solid var(--border-gold)' },
  modeBtn:       { background: 'transparent', border: '1px solid transparent', borderRadius: '20px', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '600', padding: '6px 14px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s' },
  modeBtnActive: { background: 'var(--gold-2)', border: '1px solid var(--gold-2)', color: '#000' },
};

// Inventory styles
const iv = {
  searchWrap:    { background: 'var(--bg-panel)', border: '1px solid rgba(234,199,94,0.18)', borderRadius: '12px', padding: '14px' },
  sectionLabel:  { fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' },
  searchInput:   { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--text-main)', fontFamily: 'var(--font-ui)', fontSize: '13px', padding: '8px 12px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', outline: 'none' },
  searchResults: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  searchResult:  { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '8px' },
  resultName:    { fontFamily: 'var(--font-title)', fontSize: '12px', color: 'var(--gold-1)', marginRight: '4px' },
  resultDesc:    { fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginTop: '2px', lineHeight: '1.4' },
  addBtn:        { background: 'rgba(247,221,120,0.1)', border: '1px solid rgba(234,199,94,0.3)', color: 'var(--gold-1)', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: '500', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start', flexShrink: 0, borderRadius: '6px' },
  typeBadge:     { fontFamily: 'var(--font-ui)', fontSize: '8px', letterSpacing: '0.5px', border: '1px solid', padding: '1px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRadius: '4px' },
  section:       { background: 'var(--bg-panel)', border: '1px solid rgba(234,199,94,0.18)', borderRadius: '12px', padding: '14px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  sectionTitle:  { fontFamily: 'var(--font-title)', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--gold-2)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine:   { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(234,199,94,0.25), transparent)' },
  attackTable:   { display: 'flex', flexDirection: 'column', gap: '4px' },
  attackHeader:  { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '4px 8px', fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '1px', color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid rgba(234,199,94,0.12)', marginBottom: '4px' },
  attackRow:     { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '7px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,199,94,0.12)', borderRadius: '6px' },
  itemRow:       { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', border: '1px solid rgba(234,199,94,0.15)', borderRadius: '8px', marginBottom: '6px' },
  itemName:      { fontFamily: 'var(--font-title)', fontSize: '13px', color: 'var(--gold-1)' },
  itemStats:     { fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--red-1)', marginTop: '3px' },
  itemDesc:      { fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-soft)', marginTop: '3px', lineHeight: '1.4' },
  equippedBadge: { fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--gold-1)', background: 'rgba(247,221,120,0.1)', border: '1px solid rgba(247,221,120,0.3)', padding: '1px 6px', borderRadius: '4px' },
  itemActions:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
  actionBtn:     { background: 'transparent', border: '1px solid', fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '4px 10px', cursor: 'pointer', borderRadius: '6px', whiteSpace: 'nowrap' },
  qtyBtn:        { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,199,94,0.2)', color: 'var(--gold-1)', fontFamily: 'var(--font-title)', fontSize: '14px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '6px' },
  qtyVal:        { fontFamily: 'var(--font-title)', fontSize: '14px', color: 'var(--text-main)', minWidth: '22px', textAlign: 'center' },
};
