// src/pages/CharacterSheet.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';
import ALL_ITEMS from '../data/items.json';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const ITEMS_MAP = Object.fromEntries(ALL_ITEMS.map(i => [i.id, i]));
const TYPE_LABEL = { weapon: 'Arma', armor: 'Armadura', potion: 'Poción', magic: 'Objeto Mágico' };
const TYPE_COLOR = { weapon: 'var(--ember)', armor: 'var(--gold)', potion: '#6aaa6a', magic: '#a07ad0' };
const TYPE_ICON  = { weapon: '⚔️', armor: '🛡️', potion: '⚗️', magic: '✨' };

const STAT_KEYS = ['fue', 'des', 'con', 'int', 'sab', 'car'];
const STAT_ABBR = { fue: 'FUE', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };

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
  const [itemSearch, setItemSearch] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [initRoll, setInitRoll] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const portraitRef = useRef(null);

  const isAdmin = userRole === 'Dungeon Master' || userRole === 'Jugador / DM';
  const isOwner = char?.ownerEmail === user.email || isAdmin;
  const canToggleInspiration = userRole === 'Dungeon Master' || userRole === 'Jugador / DM';

  const accent1 = draft.accentColor || draft.color || 'var(--gold)';
  const accent2 = 'var(--ember)';

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

  const TABS = [
    { id: 'ficha',      label: '📋 Ficha' },
    { id: 'inventario', label: '🎒 Inventario', badge: inventoryItems.length || null },
    { id: 'lore',       label: '📖 Lore' },
  ];

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={s.page} className="fade-in">

      {/* ── HERO SECTION ── */}
      <div
        style={{ position: 'relative', height: isMobile ? '420px' : '520px', background: 'var(--void)', margin: '0 -16px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: draft.portrait ? 'zoom-in' : 'default', borderBottom: `1px solid ${accent1}99` }}
        onClick={() => draft.portrait && setShowModal(true)}
      >
        {draft.portrait
          ? <img src={draft.portrait} alt={draft.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.18, pointerEvents: 'none' }}>
              <span style={{ fontSize: '80px' }}>⚔️</span>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '3px', color: 'var(--gold-dim)' }}>SIN ILUSTRACIÓN</span>
            </div>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 40%, var(--void) 100%)', pointerEvents: 'none' }} />
        {draft.portrait && (
          <span style={{ position: 'absolute', top: '14px', right: '70px', zIndex: 3, fontSize: '16px', opacity: 0.55, pointerEvents: 'none' }}>🔍</span>
        )}
        <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 3, width: '46px', height: '46px', borderRadius: '50%', background: accent1, border: `2px solid ${accent1}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', boxShadow: `0 0 16px ${accent1}88` }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: 'var(--void)', textTransform: 'uppercase', lineHeight: 1 }}>Nv</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '900', color: 'var(--void)', lineHeight: 1 }}>{draft.level}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: isMobile ? '16px' : '24px', zIndex: 3, pointerEvents: 'none' }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: isMobile ? '28px' : '36px', fontWeight: '900', color: accent1, letterSpacing: '2px', textShadow: '0 2px 20px rgba(0,0,0,0.95)', margin: '0 0 6px 0', lineHeight: 1.1 }}>{draft.name}</h1>
          <div style={{ width: '60px', height: '2px', background: accent1, marginBottom: '8px', opacity: 0.8 }} />
          <div style={{ fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '15px', color: 'var(--parchment-dim)', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{draft.race} {draft.class} · Lv{draft.level} · {draft.alignment}</div>
          {draft.subclass && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', color: 'var(--gold-dim)', marginTop: '8px', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{draft.subclass}</div>}
        </div>
      </div>

      {/* ── FULLSCREEN MODAL ── */}
      {showModal && draft.portrait && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setShowModal(false)}
        >
          <img src={draft.portrait} alt={draft.name} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', cursor: 'auto' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate('/')}>← Volver</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwner && !editing && <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Editar</button>}
          {editing && <>
            <button style={s.cancelBtn} onClick={() => { setEditing(false); setDraft(char); }}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </>}
        </div>
      </div>

      {/* ── HEADER ── */}
      <div style={{ ...s.header, borderColor: accent1 }}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: '36px' }}>{draft.icon || '⚔️'}</span>
          <div style={{ flex: 1 }}>
            {editing
              ? <input value={draft.name} onChange={e => update('name', e.target.value)} style={s.inputLarge} />
              : <h1 style={{ ...s.charName, color: accent1 }}>{draft.name}</h1>}
            <div style={s.charSub}>{draft.race} {draft.class} · Lv{draft.level} · {draft.alignment}</div>
            <div style={s.charSubclass}>{draft.subclass}</div>
            {editing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <span style={s.formLabel}>Color del personaje</span>
                <input type="color" value={draft.accentColor || '#C9A84C'}
                  onChange={e => { update('accentColor', e.target.value); updateDoc(doc(db, 'characters', id), { accentColor: e.target.value }); }}
                  style={{ width: '36px', height: '24px', border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', padding: '1px 2px' }} />
                <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '11px', color: 'var(--gold-dim)', fontStyle: 'italic' }}>Se aplica en toda la ficha</span>
              </div>
            )}
          </div>
        </div>
        <div style={s.levelCircle}>
          {editing
            ? <input type="number" value={draft.level} onChange={e => update('level', parseInt(e.target.value))} style={{ ...s.inputNum, fontSize: '28px', width: '60px' }} />
            : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '32px', fontWeight: '900', color: accent1 }}>{draft.level}</span>}
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>Nivel</span>
        </div>
      </div>

      {/* Portrait upload */}
      {editing && (
        <div style={s.portraitEditBox}>
          <div style={s.formLabel}>Ilustración del personaje</div>
          <input type="file" accept="image/*" onChange={handlePortrait} style={s.fileInput} />
        </div>
      )}

      {/* ── XP BAR ── */}
      <div style={s.xpSection}>
        <div style={s.xpRow}>
          <span style={s.xpLabel}>Experiencia</span>
          {editing
            ? <input type="number" value={draft.xp} onChange={e => update('xp', parseInt(e.target.value) || 0)} style={s.inputNum} />
            : <span style={s.xpVal}>{(draft.xp || 0).toLocaleString()} XP</span>}
        </div>
        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${xpPct}%`, background: `linear-gradient(to right, ${accent1}88, ${accent1})` }} />
        </div>
        <div style={{ ...s.xpRow, marginTop: '3px' }}>
          <span style={s.dimLabel}>Lv{(draft.level || 3) + 1} →</span>
          <span style={s.dimLabel}>{(draft.xpNext || 2700).toLocaleString()} XP</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button key={tab.id}
            style={{ ...s.tabBtn, ...(activeTab === tab.id ? { ...s.tabBtnActive, borderColor: accent1, color: accent1 } : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && <span style={s.tabBadge}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          FICHA TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'ficha' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', paddingTop: '12px' }}>

          {/* LEFT: Características + Salvaciones + Habilidades */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <Section title="Características" accent={accent1}>
              <div style={s.statsGrid}>
                {STAT_KEYS.map(stat => (
                  <div key={stat} style={s.statBlock}>
                    <span style={s.statName}>{STAT_ABBR[stat]}</span>
                    {editing
                      ? <input type="number" value={draft.stats?.[stat] || 10} onChange={e => updateStat(stat, e.target.value)}
                          style={{ ...s.inputNum, fontSize: '18px', width: '48px', textAlign: 'center' }} />
                      : <span style={s.statScore}>{draft.stats?.[stat] || 10}</span>}
                    <span style={{ ...s.statMod, color: accent1 }}>{statMod(draft.stats?.[stat] || 10)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Tiradas de Salvación" accent={accent1}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {STAT_KEYS.map(stat => {
                  const active = draft.savingThrows?.[stat] || false;
                  const val    = saveVal(stat);
                  return (
                    <div key={stat} style={fs.row}>
                      <Pip active={active} accent={accent1} editing={editing} onClick={() => toggleSave(stat)} />
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--gold-dim)', width: '28px' }}>{STAT_ABBR[stat]}</span>
                      <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)', flex: 1 }}>Salvación</span>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: active ? accent1 : 'var(--parchment)', minWidth: '28px', textAlign: 'right' }}>{fmtMod(val)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Habilidades" accent={accent1}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 4px' }}>
                {SKILLS.map(skill => {
                  const active = draft.skills?.[skill.id] || false;
                  const val    = skillVal(skill);
                  return (
                    <div key={skill.id} style={fs.row}>
                      <Pip active={active} accent={accent1} editing={editing} onClick={() => toggleSkill(skill.id)} />
                      <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.nombre}</span>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', color: 'var(--gold-dim)', marginRight: '2px', flexShrink: 0 }}>{STAT_ABBR[skill.stat]}</span>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '700', color: active ? accent1 : 'var(--parchment)', minWidth: '22px', textAlign: 'right', flexShrink: 0 }}>{fmtMod(val)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* RIGHT: Combate + HP + Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <Section title="Combate" accent={accent1}>
              <div style={s.combatRow}>
                <CombatStat label="CA" value={draft.ac} field="ac" editing={editing} update={update} />

                {/* Iniciativa — clickeable para tirar */}
                <div
                  style={{ ...ss.combatStat, cursor: 'pointer', borderColor: initRoll ? accent1 : 'var(--line)', transition: 'border-color 0.3s' }}
                  onClick={rollInitiative}
                  title="Clic para tirar iniciativa (1d20 + DES)"
                >
                  <span style={ss.combatLabel}>Iniciativa</span>
                  {initRoll
                    ? <>
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '900', color: accent1, lineHeight: 1 }}>{fmtMod(initRoll.total)}</span>
                        <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '10px', color: 'var(--gold-dim)' }}>d20={initRoll.nat}</span>
                      </>
                    : <span style={ss.combatVal}>{statMod(draft.stats?.des || 10)}</span>}
                </div>

                <CombatStat label="Velocidad" value={draft.speed || '9m'} field="speed" editing={editing} update={update} />

                <div style={{ ...ss.combatStat, borderColor: `${accent1}55` }}>
                  <span style={ss.combatLabel}>Prof.</span>
                  <span style={{ ...ss.combatVal, color: accent1 }}>+{prof}</span>
                </div>
              </div>
            </Section>

            {/* Puntos de Golpe */}
            <Section title="Puntos de Golpe" accent={accent2}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '8px' }}>
                {editing
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="number" value={draft.hp} onChange={e => update('hp', parseInt(e.target.value) || 0)}
                        style={{ ...s.inputNum, width: '56px', fontSize: '22px' }} />
                      <span style={{ color: 'var(--gold-dim)', fontSize: '18px' }}>/</span>
                      <input type="number" value={draft.hpMax} onChange={e => update('hpMax', parseInt(e.target.value) || 0)}
                        style={{ ...s.inputNum, width: '56px', fontSize: '22px' }} />
                    </div>
                  : <div>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '32px', fontWeight: '900', color: hpPct > 50 ? '#6aaa6a' : hpPct > 25 ? accent2 : 'var(--ember)', lineHeight: 1 }}>{draft.hp}</span>
                      <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-dim)' }}> / {draft.hpMax}</span>
                    </div>}
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-dim)', paddingBottom: '4px' }}>{hpPct}%</span>
              </div>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
                <span style={s.xpLabel}>HP Temporales</span>
                {editing
                  ? <input type="number" value={draft.hpTemp || 0} onChange={e => update('hpTemp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '56px' }} />
                  : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: '700', color: '#6abf6a' }}>{draft.hpTemp || 0}</span>}
              </div>
            </Section>

            {/* Tiradas de muerte — solo visible cuando HP = 0 */}
            {(draft.hp || 0) === 0 && (
              <Section title="Tiradas de Muerte" accent={accent2}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  {[
                    { type: 'successes', label: 'Éxitos',  color: '#6aaa6a' },
                    { type: 'failures',  label: 'Fallos',  color: accent2 },
                  ].map(({ type, label, color }) => (
                    <div key={type} style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color, textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} onClick={() => updateDeathSave(type, i)} style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            border: `2px solid ${color}`,
                            background: (draft.deathSaves?.[type] || 0) > i ? color : 'transparent',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Percepción pasiva + Inspiración */}
            <Section title="Extras" accent={accent1}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={fs.extraBox}>
                  <div style={s.xpLabel}>Percepción Pasiva</div>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '28px', fontWeight: '700', color: 'var(--parchment)', lineHeight: 1, marginTop: '6px' }}>{passivePerc}</div>
                </div>
                <div
                  onClick={canToggleInspiration ? toggleInspiration : undefined}
                  style={{ ...fs.extraBox, flex: 1.2, borderColor: draft.inspiration ? accent1 : 'var(--line)', background: draft.inspiration ? `${accent1}15` : 'rgba(11,9,6,0.5)', cursor: canToggleInspiration ? 'pointer' : 'default', transition: 'all 0.3s' }}
                  title={canToggleInspiration ? 'Clic para activar/desactivar' : ''}
                >
                  <div style={s.xpLabel}>Inspiración</div>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: draft.inspiration ? accent1 : 'var(--gold-dim)', marginTop: '6px' }}>
                    {draft.inspiration ? '✦ Activa' : '✧ Sin'}
                  </div>
                  {canToggleInspiration && <div style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', color: 'var(--gold-dim)', marginTop: '2px' }}>SOLO DM</div>}
                </div>
              </div>
            </Section>

            {/* Estado */}
            <Section title="Estado" accent={accent1}>
              <StatusRow label="Condiciones"  value={draft.conditions   || 'Ninguna'} field="conditions"   editing={editing} update={update} />
              <StatusRow label="Concentración" value={draft.concentration || '—'}       field="concentration" editing={editing} update={update} />
              <StatusRow label="Notas sesión"  value={draft.sessionNotes  || '—'}       field="sessionNotes"  editing={editing} update={update} />
            </Section>

            {/* Jugador */}
            <Section title="Jugador" accent={accent1}>
              {editing
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input value={draft.player || ''} onChange={e => update('player', e.target.value)} style={s.inputFull} placeholder="Nombre del jugador" />
                    <input value={draft.ownerEmail || ''} onChange={e => update('ownerEmail', e.target.value)} style={s.inputFull} placeholder="Email del jugador (para permisos)" />
                  </div>
                : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '15px', color: 'var(--gold-bright)' }}>{draft.player || '—'}</span>}
            </Section>

            {/* Notas */}
            <Section title="Notas del personaje" accent={accent1}>
              {editing
                ? <textarea value={draft.notes || ''} onChange={e => update('notes', e.target.value)} style={s.textarea} placeholder="Motivaciones, lore personal, backstory..." rows={4} />
                : <p style={s.notesText}>{draft.notes || <span style={{ color: 'var(--gold-dim)', fontStyle: 'italic' }}>Sin notas.</span>}</p>}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          INVENTARIO TAB (sin cambios)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'inventario' && (
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
          LORE TAB
      ══════════════════════════════════════════════════ */}
      {activeTab === 'lore' && (
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
function Section({ title, children, accent }) {
  const lineColor = accent ? `${accent}55` : 'var(--line)';
  return (
    <div style={ss.section}>
      <div style={ss.sectionHeader}>
        <span style={ss.sectionTitle}>{title}</span>
        <div style={{ ...ss.sectionLine, background: `linear-gradient(to right, ${lineColor}, transparent)` }} />
      </div>
      {children}
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
        <Section key={f.key} title={f.label} accent={accent}>
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
                  <span style={{ fontSize: '18px', minWidth: '24px' }}>{item.emoji || TYPE_ICON[item.tipo] || '✦'}</span>
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
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--parchment)' }}>{item.nombre}</span>
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
  const icon = item.emoji || TYPE_ICON[item.tipo] || '✦';
  const typeColor = TYPE_COLOR[item.tipo] || '#a07ad0';
  const typeLabel = TYPE_LABEL[item.tipo] || 'Personalizado';
  return (
    <div style={{ ...iv.itemRow, background: inv.equipped ? 'rgba(201,168,76,0.06)' : 'rgba(11,9,6,0.4)' }}>
      <span style={{ fontSize: '20px', minWidth: '28px', paddingTop: '2px' }}>{icon}</span>
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

  const icon = item ? (item.itemData?.emoji || TYPE_ICON[item.itemData?.tipo] || info.icon) : info.icon;

  return (
    <div
      style={{ width: '52px', height: '52px', position: 'relative', border: `1px solid ${item ? accentColor + '80' : 'var(--line)'}`, background: item ? `${accentColor}12` : 'var(--panel)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: item ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s', ...(hovered && item && !isMobile ? { borderColor: accentColor, background: `${accentColor}22` } : {}) }}
      onClick={onSlotAction}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: item ? '22px' : '16px', opacity: item ? 1 : 0.22, lineHeight: 1 }}>{icon}</span>
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

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const s = {
  page:           { maxWidth: '900px', margin: '0 auto', padding: '0 16px 20px' },
  loading:        { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '3px', fontSize: '11px' },
  // Portrait: contain so the full image is always visible
  portraitWrap:   { position: 'relative', height: '320px', overflow: 'hidden', margin: '0 -16px', background: '#060504', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  portraitImg:    { width: '100%', height: '100%', objectFit: 'contain' },
  coverOverlay:   { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,9,6,0.95) 0%, rgba(11,9,6,0.2) 40%, transparent 100%)', pointerEvents: 'none' },
  coverText:      { position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 2 },
  coverName:      { fontFamily: 'Cinzel,serif', fontSize: 'clamp(20px,5vw,34px)', fontWeight: '900', letterSpacing: '2px', textShadow: '0 0 24px rgba(0,0,0,0.8)' },
  coverSub:       { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(201,168,76,0.6)', marginTop: '4px' },
  topBar:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  backBtn:        { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer', padding: '6px 0' },
  editBtn:        { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  saveBtn:        { background: 'rgba(74,138,74,0.15)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  cancelBtn:      { background: 'transparent', border: '1px solid var(--line)', color: 'var(--parchment-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', background: 'var(--panel)', borderTop: '3px solid', borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: '12px' },
  headerLeft:     { display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 },
  charName:       { fontFamily: 'Cinzel,serif', fontSize: 'clamp(18px,4vw,26px)', fontWeight: '900', letterSpacing: '2px' },
  charSub:        { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-dim)', marginTop: '4px' },
  charSubclass:   { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', marginTop: '4px', textTransform: 'uppercase' },
  levelCircle:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '8px 16px', border: '1px solid var(--line)', minWidth: '70px' },
  portraitEditBox:{ background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  formLabel:      { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  fileInput:      { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '6px', cursor: 'pointer' },
  inputLarge:     { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', padding: '4px 8px', width: '100%' },
  inputFull:      { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px', width: '100%' },
  inputNum:       { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
  textarea:       { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.6' },
  xpSection:      { background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', marginBottom: '12px' },
  xpRow:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  xpLabel:        { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  xpVal:          { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold)' },
  dimLabel:       { fontFamily: 'Cinzel,serif', fontSize: '8px', color: 'var(--gold-dim)', letterSpacing: '1px' },
  barTrack:       { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: '2px', transition: 'width 0.4s' },
  tabBar:         { display: 'flex', gap: '4px', borderBottom: '1px solid var(--line)', paddingTop: '8px' },
  tabBtn:         { background: 'transparent', border: '1px solid transparent', borderBottom: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' },
  tabBtnActive:   { background: 'var(--panel)', border: '1px solid', borderBottom: '1px solid var(--panel)', marginBottom: '-1px' },
  tabBadge:       { background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '8px', padding: '1px 6px', borderRadius: '2px' },
  statsGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  statBlock:      { background: 'rgba(11,9,6,0.6)', border: '1px solid var(--line)', padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statName:       { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  statScore:      { fontFamily: 'Cinzel,serif', fontSize: '24px', fontWeight: '700', color: 'var(--parchment)' },
  statMod:        { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '600' },
  combatRow:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' },
  notesText:      { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment-dim)', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  readOnlyBadge:  { textAlign: 'center', padding: '10px', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', border: '1px solid var(--line)', marginTop: '12px', textTransform: 'uppercase' },
};

const ss = {
  section:      { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionHeader:{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine:  { flex: 1, height: '1px' },
  combatStat:   { background: 'rgba(11,9,6,0.6)', border: '1px solid var(--line)', padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  combatLabel:  { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  combatVal:    { fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', color: 'var(--parchment)' },
  inputNum:     { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
};

// Ficha-specific styles
const fs = {
  row:      { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 2px', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: '26px' },
  extraBox: { flex: 1, background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)', padding: '10px 12px' },
};

// Lore-specific styles
const sl = {
  textarea: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.7' },
  input:    { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 10px', width: '100%' },
  loreTxt:  { fontFamily: 'Crimson Pro,serif', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', margin: 0 },
};

// Equipment slots styles
const eq = {
  wrap:  { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '12px' },
};

// Inventory styles (unchanged)
const iv = {
  searchWrap:    { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionLabel:  { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  searchInput:   { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', width: '100%', boxSizing: 'border-box' },
  searchResults: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  searchResult:  { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)' },
  resultName:    { fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold-bright)', marginRight: '4px' },
  resultDesc:    { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', marginTop: '2px', lineHeight: '1.4' },
  addBtn:        { background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-dim)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start', flexShrink: 0 },
  typeBadge:     { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', border: '1px solid', padding: '1px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  section:       { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  sectionTitle:  { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine:   { flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line), transparent)' },
  attackTable:   { display: 'flex', flexDirection: 'column', gap: '4px' },
  attackHeader:  { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '4px 8px', fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', marginBottom: '4px' },
  attackRow:     { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '7px 8px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)' },
  itemRow:       { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', border: '1px solid var(--line)', marginBottom: '6px' },
  itemName:      { fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)' },
  itemStats:     { fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ember)', marginTop: '3px', letterSpacing: '0.5px' },
  itemDesc:      { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', marginTop: '3px', lineHeight: '1.4' },
  equippedBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', padding: '1px 6px' },
  itemActions:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
  actionBtn:     { background: 'transparent', border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  qtyBtn:        { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '14px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  qtyVal:        { fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'var(--parchment)', minWidth: '22px', textAlign: 'center' },
};
