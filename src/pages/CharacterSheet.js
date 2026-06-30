// src/pages/CharacterSheet.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';
import ALL_ITEMS from '../data/items.json';

const ITEMS_MAP = Object.fromEntries(ALL_ITEMS.map(i => [i.id, i]));
const TYPE_LABEL = { weapon: 'Arma', armor: 'Armadura', potion: 'Poción', magic: 'Objeto Mágico' };
const TYPE_COLOR = { weapon: 'var(--ember)', armor: 'var(--gold)', potion: '#6aaa6a', magic: '#a07ad0' };
const TYPE_ICON  = { weapon: '⚔️', armor: '🛡️', potion: '⚗️', magic: '✨' };

export default function CharacterSheet({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [char, setChar] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('ficha');
  const [itemSearch, setItemSearch] = useState('');

  const isOwner = char?.ownerEmail === user.email || isAdmin;

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
        if (snap.exists()) {
          const role = snap.data().role;
          setIsAdmin(role === 'Dungeon Master' || role === 'Jugador / DM');
        }
      } catch (err) {
        console.error('Error cargando rol del perfil:', err);
      }
    };
    loadRole();
  }, [user.uid]);

  const save = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'characters', id), { ...draft, updatedAt: serverTimestamp() });
    setChar(draft);
    setEditing(false);
    setSaving(false);
  };

  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const updateStat = (stat, value) => setDraft(d => ({ ...d, stats: { ...d.stats, [stat]: parseInt(value) || 0 } }));

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

  // ── INVENTORY ──────────────────────────────────────────────────────────────
  const inventoryItems = draft.inventoryItems || [];

  const recomputeAC = (items, stats) => {
    const desMod = Math.floor(((stats?.des || 10) - 10) / 2);
    const equippedItems = items.filter(i => i.equipped).map(i => ITEMS_MAP[i.itemId]).filter(Boolean);
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

  const applyInventoryUpdate = (newItems) => {
    const newAC = recomputeAC(newItems, draft.stats);
    setDraft(d => ({ ...d, inventoryItems: newItems, ac: newAC }));
    updateDoc(doc(db, 'characters', id), { inventoryItems: newItems, ac: newAC });
  };

  const addToInventory = (itemId) => {
    if (inventoryItems.find(i => i.itemId === itemId)) return;
    applyInventoryUpdate([...inventoryItems, { itemId, equipped: false, quantity: 1 }]);
  };

  const removeFromInventory = (itemId) => {
    applyInventoryUpdate(inventoryItems.filter(i => i.itemId !== itemId));
  };

  const toggleEquipped = (itemId) => {
    const item = ITEMS_MAP[itemId];
    const currentlyEquipped = inventoryItems.find(i => i.itemId === itemId)?.equipped;
    const newItems = inventoryItems.map(i => {
      if (i.itemId === itemId) return { ...i, equipped: !i.equipped };
      // Only one armor equipped at a time
      if (!currentlyEquipped && item?.tipo === 'armor' && ITEMS_MAP[i.itemId]?.tipo === 'armor') {
        return { ...i, equipped: false };
      }
      return i;
    });
    applyInventoryUpdate(newItems);
  };

  const changeQuantity = (itemId, delta) => {
    const newItems = inventoryItems.map(i =>
      i.itemId === itemId ? { ...i, quantity: Math.max(1, (i.quantity || 1) + delta) } : i
    );
    setDraft(d => ({ ...d, inventoryItems: newItems }));
    updateDoc(doc(db, 'characters', id), { inventoryItems: newItems });
  };
  // ────────────────────────────────────────────────────────────────────────────

  if (!char) return <div style={s.loading}>Cargando personaje...</div>;

  const xpPct = Math.min(100, Math.round(((draft.xp || 0) / (draft.xpNext || 2700)) * 100));
  const hpPct = Math.min(100, Math.round(((draft.hp || 0) / (draft.hpMax || 1)) * 100));
  const statMod = (val) => { const m = Math.floor((val - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  return (
    <div style={s.page} className="fade-in">

      {/* PORTRAIT COVER */}
      {draft.portrait && (
        <div style={s.coverWrap}>
          <img src={draft.portrait} alt={draft.name} style={s.coverImg} />
          <div style={s.coverOverlay} />
          <div style={s.coverText}>
            <div style={s.coverName}>{draft.name}</div>
            <div style={s.coverSub}>{draft.race} {draft.class} · Lv{draft.level}</div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate('/')}>← Volver</button>
        {isOwner && !editing && <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Editar</button>}
        {editing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={s.cancelBtn} onClick={() => { setEditing(false); setDraft(char); }}>Cancelar</button>
            <button style={s.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div style={{ ...s.header, borderColor: draft.color || '#c9a84c' }}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: '36px' }}>{draft.icon || '⚔️'}</span>
          <div style={{ flex: 1 }}>
            {editing
              ? <input value={draft.name} onChange={e => update('name', e.target.value)} style={s.inputLarge} />
              : <h1 style={s.charName}>{draft.name}</h1>}
            <div style={s.charSub}>{draft.race} {draft.class} · Lv{draft.level} · {draft.alignment}</div>
            <div style={s.charSubclass}>{draft.subclass}</div>
          </div>
        </div>
        <div style={s.levelCircle}>
          {editing
            ? <input type="number" value={draft.level} onChange={e => update('level', parseInt(e.target.value))} style={{ ...s.inputNum, fontSize: '28px', width: '60px' }} />
            : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '32px', fontWeight: '900', color: draft.color || '#c9a84c' }}>{draft.level}</span>}
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>Nivel</span>
        </div>
      </div>

      {/* Portrait upload in edit mode */}
      {editing && (
        <div style={s.portraitEditBox}>
          <div style={s.formLabel}>Cambiar ilustración / foto del personaje</div>
          <input type="file" accept="image/*" onChange={handlePortrait} style={s.fileInput} />
        </div>
      )}

      {/* XP BAR */}
      <div style={s.xpSection}>
        <div style={s.xpRow}>
          <span style={s.xpLabel}>Experiencia</span>
          {editing
            ? <input type="number" value={draft.xp} onChange={e => update('xp', parseInt(e.target.value) || 0)} style={s.inputNum} />
            : <span style={s.xpVal}>{(draft.xp || 0).toLocaleString()} XP</span>}
        </div>
        <div style={s.barTrack}><div style={{ ...s.barFill, width: `${xpPct}%`, background: 'linear-gradient(to right, #7a6030, #c9a84c)' }} /></div>
        <div style={{ ...s.xpRow, marginTop: '3px' }}>
          <span style={s.dimLabel}>Lv{(draft.level || 3) + 1} →</span>
          <span style={s.dimLabel}>{(draft.xpNext || 2700).toLocaleString()} XP</span>
        </div>
      </div>

      {/* TABS */}
      <div style={s.tabBar}>
        {['ficha', 'inventario'].map(tab => (
          <button
            key={tab}
            style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'ficha' ? '📋 Ficha' : '🎒 Inventario'}
            {tab === 'inventario' && inventoryItems.length > 0 && (
              <span style={s.tabBadge}>{inventoryItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* FICHA TAB */}
      {activeTab === 'ficha' && (
        <div style={s.mainGrid}>

          {/* LEFT */}
          <div style={s.leftCol}>
            <Section title="Características">
              <div style={s.statsGrid}>
                {['fue','des','con','int','sab','car'].map(stat => (
                  <div key={stat} style={s.statBlock}>
                    <span style={s.statName}>{stat.toUpperCase()}</span>
                    {editing
                      ? <input type="number" value={draft.stats?.[stat] || 10} onChange={e => updateStat(stat, e.target.value)} style={{ ...s.inputNum, fontSize: '18px', width: '48px', textAlign: 'center' }} />
                      : <span style={s.statScore}>{draft.stats?.[stat] || 10}</span>}
                    <span style={s.statMod}>{statMod(draft.stats?.[stat] || 10)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Combate">
              <div style={s.combatRow}>
                <CombatStat label="CA" value={draft.ac} field="ac" editing={editing} update={update} />
                <CombatStat label="Iniciativa" value={statMod(draft.stats?.des || 10)} />
                <CombatStat label="Velocidad" value="9m" />
                <CombatStat label="Prof." value="+2" />
              </div>
              <div style={s.hpBox}>
                <div style={s.xpRow}>
                  <span style={s.xpLabel}>Puntos de Golpe</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editing
                      ? <><input type="number" value={draft.hp} onChange={e => update('hp', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '48px' }} />
                         <span style={{ color: '#5a4820' }}>/</span>
                         <input type="number" value={draft.hpMax} onChange={e => update('hpMax', parseInt(e.target.value) || 0)} style={{ ...s.inputNum, width: '48px' }} />
                        </>
                      : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', color: 'var(--ember)', fontWeight: '700' }}>{draft.hp} <span style={{ color: 'var(--gold-dim)', fontSize: '13px' }}>/ {draft.hpMax}</span></span>}
                  </div>
                </div>
                <div style={s.barTrack}><div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} /></div>
              </div>
            </Section>

            <Section title="Jugador">
              {editing
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input value={draft.player || ''} onChange={e => update('player', e.target.value)} style={s.inputFull} placeholder="Nombre del jugador" />
                    <input value={draft.ownerEmail || ''} onChange={e => update('ownerEmail', e.target.value)} style={s.inputFull} placeholder="Email del jugador (para permisos de edición)" />
                  </div>
                : <span style={{ fontFamily: 'Cinzel,serif', fontSize: '15px', color: 'var(--gold-bright)' }}>{draft.player || '—'}</span>}
            </Section>
          </div>

          {/* RIGHT */}
          <div style={s.rightCol}>
            <Section title="Notas del personaje">
              {editing
                ? <textarea value={draft.notes || ''} onChange={e => update('notes', e.target.value)} style={s.textarea} placeholder="Motivaciones, lore personal, backstory..." rows={5} />
                : <p style={s.notesText}>{draft.notes || <span style={{ color: 'var(--gold-dim)', fontStyle: 'italic' }}>Sin notas. Editá para agregar.</span>}</p>}
            </Section>

            <Section title="Estado actual">
              <StatusRow label="Condiciones" value={draft.conditions || 'Ninguna'} field="conditions" editing={editing} update={update} />
              <StatusRow label="Concentración" value={draft.concentration || '—'} field="concentration" editing={editing} update={update} />
              <StatusRow label="Inspiración" value={draft.inspiration ? '✦ Activa' : 'No tiene'} field="inspiration" editing={editing} update={update} isToggle />
            </Section>
          </div>
        </div>
      )}

      {/* INVENTARIO TAB */}
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
        />
      )}

      {!isOwner && <div style={s.readOnlyBadge}>👁️ Vista de solo lectura — este no es tu personaje</div>}
      <div style={{ height: '80px' }} />
    </div>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function InventoryTab({ inventoryItems, itemSearch, setItemSearch, addToInventory, removeFromInventory, toggleEquipped, changeQuantity, isOwner }) {
  const searchResults = itemSearch.length > 1
    ? ALL_ITEMS.filter(item =>
        !inventoryItems.find(i => i.itemId === item.id) &&
        (item.nombre.toLowerCase().includes(itemSearch.toLowerCase()) ||
         TYPE_LABEL[item.tipo].toLowerCase().includes(itemSearch.toLowerCase()))
      ).slice(0, 6)
    : [];

  const equippedItems  = inventoryItems.filter(i => i.equipped);
  const unequippedItems = inventoryItems.filter(i => !i.equipped);
  const equippedWeapons = equippedItems
    .map(i => ({ inv: i, item: ITEMS_MAP[i.itemId] }))
    .filter(({ item }) => item?.tipo === 'weapon');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>

      {/* Search */}
      {isOwner && (
        <div style={iv.searchWrap}>
          <div style={iv.sectionLabel}>Agregar objeto al inventario</div>
          <input
            value={itemSearch}
            onChange={e => setItemSearch(e.target.value)}
            style={iv.searchInput}
            placeholder="Buscar por nombre o tipo (arma, armadura, poción, objeto mágico)..."
          />
          {searchResults.length > 0 && (
            <div style={iv.searchResults}>
              {searchResults.map(item => (
                <div key={item.id} style={iv.searchResult}>
                  <span style={{ fontSize: '18px', minWidth: '24px' }}>{TYPE_ICON[item.tipo]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={iv.resultName}>{item.nombre}</span>
                      <span style={{ ...iv.typeBadge, borderColor: TYPE_COLOR[item.tipo], color: TYPE_COLOR[item.tipo] }}>{TYPE_LABEL[item.tipo]}</span>
                    </div>
                    <div style={iv.resultDesc}>{item.descripcion}</div>
                  </div>
                  <button style={iv.addBtn} onClick={() => { addToInventory(item.id); setItemSearch(''); }}>
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attacks table from equipped weapons */}
      {equippedWeapons.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Ataques</span><div style={iv.sectionLine} /></div>
          <div style={iv.attackTable}>
            <div style={iv.attackHeader}>
              <span>Arma</span><span>Daño</span><span>Tipo</span><span>Propiedades</span>
            </div>
            {equippedWeapons.map(({ inv, item }) => (
              <div key={inv.itemId} style={iv.attackRow}>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--parchment)' }}>{item.nombre}</span>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--ember)' }}>{item.stats.daño}</span>
                <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment-dim)' }}>{item.stats.tipoDaño}</span>
                <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)' }}>{item.stats.propiedades?.join(', ') || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipped items */}
      {equippedItems.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Equipado</span><div style={iv.sectionLine} /></div>
          {equippedItems.map(inv => (
            <ItemRow key={inv.itemId} inv={inv} isOwner={isOwner}
              toggleEquipped={toggleEquipped} removeFromInventory={removeFromInventory} changeQuantity={changeQuantity} />
          ))}
        </div>
      )}

      {/* Unequipped items */}
      {unequippedItems.length > 0 && (
        <div style={iv.section}>
          <div style={iv.sectionHeader}><span style={iv.sectionTitle}>Mochila</span><div style={iv.sectionLine} /></div>
          {unequippedItems.map(inv => (
            <ItemRow key={inv.itemId} inv={inv} isOwner={isOwner}
              toggleEquipped={toggleEquipped} removeFromInventory={removeFromInventory} changeQuantity={changeQuantity} />
          ))}
        </div>
      )}

      {inventoryItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', border: '1px solid var(--line)', background: 'var(--panel)' }}>
          Inventario vacío · Usá el buscador para agregar objetos
        </div>
      )}
    </div>
  );
}

function ItemRow({ inv, isOwner, toggleEquipped, removeFromInventory, changeQuantity }) {
  const item = ITEMS_MAP[inv.itemId];
  if (!item) return null;

  const statsText = item.tipo === 'weapon'
    ? `${item.stats.daño} ${item.stats.tipoDaño}`
    : item.tipo === 'armor'
    ? `CA ${item.stats.caBase}${item.stats.armorType !== 'heavy' ? ' + DES' : ''}`
    : item.stats.efecto;

  return (
    <div style={{ ...iv.itemRow, background: inv.equipped ? 'rgba(201,168,76,0.06)' : 'rgba(11,9,6,0.4)' }}>
      <span style={{ fontSize: '20px', minWidth: '28px', paddingTop: '2px' }}>{TYPE_ICON[item.tipo]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={iv.itemName}>{item.nombre}</span>
          <span style={{ ...iv.typeBadge, borderColor: TYPE_COLOR[item.tipo], color: TYPE_COLOR[item.tipo] }}>{TYPE_LABEL[item.tipo]}</span>
          {inv.equipped && <span style={iv.equippedBadge}>✓ Equipado</span>}
          {item.tipo === 'potion' && (inv.quantity || 1) > 1 && (
            <span style={iv.equippedBadge}>×{inv.quantity}</span>
          )}
        </div>
        <div style={iv.itemStats}>{statsText}</div>
        {item.descripcion && <div style={iv.itemDesc}>{item.descripcion}</div>}
      </div>
      {isOwner && (
        <div style={iv.itemActions}>
          {item.tipo === 'potion' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button style={iv.qtyBtn} onClick={() => changeQuantity(inv.itemId, -1)}>−</button>
              <span style={iv.qtyVal}>{inv.quantity || 1}</span>
              <button style={iv.qtyBtn} onClick={() => changeQuantity(inv.itemId, 1)}>+</button>
            </div>
          ) : (
            <button
              style={{ ...iv.actionBtn, borderColor: inv.equipped ? 'var(--gold-dim)' : 'var(--line)', color: inv.equipped ? 'var(--gold)' : 'var(--parchment-dim)' }}
              onClick={() => toggleEquipped(inv.itemId)}
            >
              {inv.equipped ? 'Desequipar' : 'Equipar'}
            </button>
          )}
          <button
            style={{ ...iv.actionBtn, color: 'var(--ember-dim)', borderColor: 'transparent', marginTop: '4px' }}
            onClick={() => removeFromInventory(inv.itemId)}
          >
            ✕ Quitar
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={ss.section}>
      <div style={ss.sectionHeader}>
        <span style={ss.sectionTitle}>{title}</span>
        <div style={ss.sectionLine} />
      </div>
      {children}
    </div>
  );
}

function CombatStat({ label, value, field, editing, update }) {
  return (
    <div style={ss.combatStat}>
      <span style={ss.combatLabel}>{label}</span>
      {editing && field
        ? <input type="number" value={value} onChange={e => update(field, parseInt(e.target.value))} style={{ ...ss.inputNum, fontSize: '18px', width: '50px' }} />
        : <span style={ss.combatVal}>{value}</span>}
    </div>
  );
}

function StatusRow({ label, value, field, editing, update, isToggle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>{label}</span>
      {editing
        ? isToggle
          ? <button onClick={() => update(field, !value)} style={{ background: value ? 'rgba(201,168,76,0.2)' : 'transparent', border: '1px solid var(--line)', color: 'var(--gold-bright)', padding: '3px 10px', fontFamily: 'Cinzel,serif', fontSize: '9px', cursor: 'pointer' }}>{value ? 'Quitar' : 'Dar'}</button>
          : <input value={value} onChange={e => update(field, e.target.value)} style={{ background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '3px 8px', maxWidth: '160px' }} />
        : <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--parchment)' }}>{value}</span>}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px 20px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '3px', fontSize: '11px' },
  coverWrap: { position: 'relative', height: '280px', overflow: 'hidden', margin: '0 -16px' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' },
  coverOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,9,6,1) 0%, rgba(11,9,6,0.5) 50%, transparent 100%)' },
  coverText: { position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 2 },
  coverName: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(20px,5vw,34px)', fontWeight: '900', color: 'var(--gold-bright)', letterSpacing: '2px', textShadow: '0 0 20px rgba(227,200,120,0.5)' },
  coverSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(201,168,76,0.6)', marginTop: '4px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  backBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer', padding: '6px 0' },
  editBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  saveBtn: { background: 'rgba(74,138,74,0.15)', border: '1px solid rgba(74,138,74,0.4)', color: '#7aaa7a', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--parchment-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', background: 'var(--panel)', borderTop: '3px solid', borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: '12px' },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 },
  charName: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(18px,4vw,26px)', fontWeight: '900', color: 'var(--gold-bright)', letterSpacing: '2px' },
  charSub: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-dim)', marginTop: '4px' },
  charSubclass: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', marginTop: '4px', textTransform: 'uppercase' },
  levelCircle: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '8px 16px', border: '1px solid var(--line)', minWidth: '70px' },
  portraitEditBox: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  formLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  fileInput: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '6px', cursor: 'pointer' },
  inputLarge: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', padding: '4px 8px', width: '100%' },
  inputFull: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px', width: '100%' },
  inputNum: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
  textarea: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.6' },
  xpSection: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '12px', marginBottom: '12px' },
  xpRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  xpLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  xpVal: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold)' },
  dimLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', color: 'var(--gold-dim)', letterSpacing: '1px' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.4s' },
  tabBar: { display: 'flex', gap: '4px', marginBottom: '0', borderBottom: '1px solid var(--line)', paddingTop: '8px' },
  tabBtn: { background: 'transparent', border: '1px solid transparent', borderBottom: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' },
  tabBtnActive: { background: 'var(--panel)', border: '1px solid var(--line)', borderBottom: '1px solid var(--panel)', color: 'var(--gold)', marginBottom: '-1px' },
  tabBadge: { background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '8px', padding: '1px 6px', borderRadius: '2px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: '12px' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '12px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  statBlock: { background: 'rgba(11,9,6,0.6)', border: '1px solid var(--line)', padding: '10px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statName: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  statScore: { fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: '700', color: 'var(--parchment)' },
  statMod: { fontFamily: 'Cinzel,serif', fontSize: '12px', fontWeight: '600', color: 'var(--gold)' },
  combatRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '10px' },
  hpBox: { background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)', padding: '10px' },
  notesText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--parchment-dim)', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  readOnlyBadge: { textAlign: 'center', padding: '10px', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', border: '1px solid var(--line)', marginTop: '12px', textTransform: 'uppercase' },
};

const ss = {
  section: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line), transparent)' },
  combatStat: { background: 'rgba(11,9,6,0.6)', border: '1px solid var(--line)', padding: '8px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  combatLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  combatVal: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: 'var(--parchment)' },
  inputNum: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', padding: '4px 6px', textAlign: 'center', width: '60px' },
};

const iv = {
  searchWrap: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginBottom: '8px' },
  searchInput: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', width: '100%', boxSizing: 'border-box' },
  searchResults: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  searchResult: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)' },
  resultName: { fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold-bright)', marginRight: '4px' },
  resultDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', marginTop: '2px', lineHeight: '1.4' },
  addBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-dim)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'flex-start', flexShrink: 0 },
  typeBadge: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1px', border: '1px solid', padding: '1px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  section: { background: 'var(--panel)', border: '1px solid var(--line)', padding: '14px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line), transparent)' },
  attackTable: { display: 'flex', flexDirection: 'column', gap: '4px' },
  attackHeader: { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '4px 8px', fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', marginBottom: '4px' },
  attackRow: { display: 'grid', gridTemplateColumns: '1fr 80px 100px 1fr', gap: '12px', padding: '7px 8px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)' },
  itemRow: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', border: '1px solid var(--line)', marginBottom: '6px' },
  itemName: { fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)' },
  itemStats: { fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ember)', marginTop: '3px', letterSpacing: '0.5px' },
  itemDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--parchment-dim)', marginTop: '3px', lineHeight: '1.4' },
  equippedBadge: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', padding: '1px 6px' },
  itemActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
  actionBtn: { background: 'transparent', border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  qtyBtn: { background: 'var(--panel-raised)', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '14px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  qtyVal: { fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'var(--parchment)', minWidth: '22px', textAlign: 'center' },
};
