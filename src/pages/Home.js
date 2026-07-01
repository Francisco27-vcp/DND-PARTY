// src/pages/Home.js — Party Hub
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, limit, updateDoc, where,
} from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';

const COMBAT_TYPE_COLORS = { pj: '#c9a84c', enemigo: '#8b1a1a' };

function sortParticipants(participants) {
  return [...(participants || [])].sort(
    (a, b) => (b.initiative - a.initiative) || (a.addedAt - b.addedAt)
  );
}

const INITIAL_CHARACTERS = [
  {
    id: 'aurelian',
    name: 'Aurelian Lerathel',
    class: 'Paladín',
    subclass: 'Jur. de los Antiguos',
    race: 'Aasimar',
    level: 3,
    hp: 19,
    hpMax: 19,
    ac: 18,
    xp: 1520,
    xpNext: 2700,
    alignment: 'Neutral Bueno',
    player: 'franr',
    ownerEmail: 'sociosn5@gmail.com',
    color: '#c9a84c',
    icon: '⚔️',
    portrait: '',
    stats: { fue: 18, des: 10, con: 11, int: 13, sab: 10, car: 16 },
  },
  {
    id: 'azrael',
    name: 'Azrael',
    class: 'Bardo',
    subclass: 'Col. del Glamour',
    race: 'Aasimar',
    level: 3,
    hp: 19,
    hpMax: 19,
    ac: 13,
    xp: 0,
    xpNext: 2700,
    alignment: 'Caótico Bueno',
    player: '—',
    ownerEmail: '',
    color: '#4a7fa5',
    icon: '🎵',
    portrait: '',
    stats: { fue: 10, des: 14, con: 12, int: 13, sab: 12, car: 16 },
  },
];

const EMPTY_CHAR = {
  name: '', class: 'Guerrero', subclass: '', race: 'Humano',
  level: 1, hp: 10, hpMax: 10, ac: 10, xp: 0, xpNext: 300,
  alignment: 'Neutral', player: '', ownerEmail: '',
  color: '#7a5a9a', icon: '🧙', portrait: '',
  stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
};

const CLASSES = ['Bárbaro','Bardo','Clérigo','Druida','Explorador','Guerrero','Hechicero','Mago','Monje','Paladín','Pícaro','Warlock'];
const RACES = ['Humano','Elfo','Enano','Mediano','Gnomo','Semielfo','Semiorco','Tiefling','Aasimar','Draconido'];
const ICONS = ['⚔️','🎵','🔮','🏹','🛡️','⚡','🌿','🔥','❄️','☠️','✨','🐉'];
const COLORS = ['#c9a84c','#4a7fa5','#8b1a1a','#5a8a5a','#7a5a9a','#4a7a7a','#a57a4a','#6a4a8a'];

const LOOT_EMOJIS = ['🗡','🛡','💎','📜','🪙','🔮','🧪','🗝','💍','📦','⚔️','🏹','🪄','👑','🔱'];

const DEFAULT_META = {
  nombre: 'Campaña de Rakets Party',
  tagline: 'Una historia épica comienza con decisiones valientes.',
  worldLevel: 4,
  objetivo: 'El Santuario Olvidado',
  objetivoDesc: 'Explorar las profundidades y descubrir el origen de la corrupción.',
  objetivoProgreso: 60,
  loot: [],
};

function formatRelativeDate(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Hace un momento';
  if (h < 24) return `Hace ${h}h`;
  if (d < 7) return `Hace ${d}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function Home({ user }) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CHAR });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [combat, setCombat] = useState(null);

  // Party Hub state
  const [sessions, setSessions] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [missions, setMissions] = useState([]);
  const [addingMission, setAddingMission] = useState(false);
  const [missionForm, setMissionForm] = useState({ nombre: '', progreso: 0 });
  const [addingLoot, setAddingLoot] = useState(false);
  const [lootForm, setLootForm] = useState({ emoji: '🗡', nombre: '' });
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [longDescanso, setLongDescanso] = useState(false);

  // Shared world content (DM → party)
  const [sharedNpcs, setSharedNpcs] = useState([]);
  const [sharedLocations, setSharedLocations] = useState([]);
  const [sharedFactions, setSharedFactions] = useState([]);
  const [sharedTimeline, setSharedTimeline] = useState([]);

  // Maps
  const [sharedMaps, setSharedMaps] = useState([]);

  // Combat
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'combat', 'current'), (snap) => {
      setCombat(snap.exists() ? snap.data() : null);
    }, () => {});
    return unsub;
  }, []);

  // Role
  useEffect(() => {
    const loadRole = async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', user.uid));
        if (snap.exists()) {
          const role = snap.data().role;
          setIsAdmin(role === 'Dungeon Master' || role === 'Jugador / DM');
        }
      } catch (err) { console.error(err); }
    };
    loadRole();
  }, [user.uid]);

  // Characters
  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'characters'));
      if (snap.empty) {
        for (const char of INITIAL_CHARACTERS) {
          await setDoc(doc(db, 'characters', char.id), {
            ...char, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        setCharacters(INITIAL_CHARACTERS);
      } else {
        setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Sessions (for activity feed)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(8));
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  // Campaign meta
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'campaign_meta', 'main'), async (snap) => {
      if (snap.exists()) {
        setMeta(snap.data());
      } else {
        await setDoc(doc(db, 'campaign_meta', 'main'), DEFAULT_META);
        setMeta(DEFAULT_META);
      }
    }, () => {});
    return unsub;
  }, []);

  // Missions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'missions'), (snap) => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  // Shared world content (DM → party visibility)
  useEffect(() => {
    const q = query(collection(db, 'npcs'), where('visibleToPlayers', '==', true));
    return onSnapshot(q, snap => setSharedNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'locations'), where('visibleToPlayers', '==', true));
    return onSnapshot(q, snap => setSharedLocations(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'factions'), where('visibleToPlayers', '==', true));
    return onSnapshot(q, snap => setSharedFactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'timeline'), where('visibleToParty', '==', true));
    return onSnapshot(q, snap => setSharedTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  useEffect(() => {
    const q = query(collection(db, 'maps'), where('visibleToParty', '==', true));
    return onSnapshot(q, snap => setSharedMaps(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, []);

  // Computed
  const latestSession = sessions[0] || null;
  const groupXP = characters.reduce((a, c) => a + (c.xp || 0), 0);
  const avgLevel = characters.length
    ? Math.round(characters.reduce((a, c) => a + (c.level || 0), 0) / characters.length)
    : 0;

  // Handlers — Characters
  const saveChar = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      ownerEmail: form.ownerEmail || user.email,
      player: form.player || user.email.split('@')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (form.id) {
      await setDoc(doc(db, 'characters', form.id), data);
    } else {
      await addDoc(collection(db, 'characters'), data);
    }
    setAdding(false);
    setForm({ ...EMPTY_CHAR });
    setSaving(false);
    load();
  };

  const deleteChar = async (id) => {
    await deleteDoc(doc(db, 'characters', id));
    setDeleteConfirm(null);
    load();
  };

  const handlePortrait = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, `portraits/characters/new_${Date.now()}`);
      setForm(f => ({ ...f, portrait: url }));
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // Handlers — Missions
  const saveMission = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'missions'), {
      ...missionForm, activa: true, createdAt: serverTimestamp(),
    });
    setAddingMission(false);
    setMissionForm({ nombre: '', progreso: 0 });
  };

  const updateMissionProgress = async (id, progreso) => {
    await updateDoc(doc(db, 'missions', id), { progreso: parseInt(progreso) || 0 });
  };

  const deleteMission = async (id) => {
    await deleteDoc(doc(db, 'missions', id));
  };

  // Handlers — Loot
  const addLoot = async (e) => {
    e.preventDefault();
    const newLoot = [...(meta.loot || []), { ...lootForm }];
    await updateDoc(doc(db, 'campaign_meta', 'main'), { loot: newLoot });
    setAddingLoot(false);
    setLootForm({ emoji: '🗡', nombre: '' });
  };

  const removeLoot = async (idx) => {
    const newLoot = (meta.loot || []).filter((_, i) => i !== idx);
    await updateDoc(doc(db, 'campaign_meta', 'main'), { loot: newLoot });
  };

  // Handlers — Meta
  const saveMeta = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, 'campaign_meta', 'main'), {
      ...metaForm,
      objetivoProgreso: parseInt(metaForm.objetivoProgreso) || 0,
      worldLevel: parseInt(metaForm.worldLevel) || 4,
    });
    setEditingMeta(false);
  };

  // Long rest
  const doLongRest = async () => {
    for (const char of characters) {
      await updateDoc(doc(db, 'characters', char.id), {
        hp: char.hpMax || char.hp,
        spellSlots: null,
        updatedAt: serverTimestamp(),
      });
    }
    setLongDescanso(false);
    load();
  };

  if (loading) return <div style={s.loading}>Cargando party...</div>;

  return (
    <div style={s.page}>

      {/* ── CAMPAIGN HEADER ── */}
      <header style={s.campaignHeader} className="campaign-header-grid">
        <div style={s.campaignEmblem}>✦</div>
        <div style={s.campaignInfo}>

          <div style={s.eyebrow}>Campaña activa · D&D 5e 2024</div>
          <h1 style={s.campaignTitle}>{meta.nombre || 'DND PARTY'}</h1>
          <p style={s.campaignTagline}>{meta.tagline || ''}</p>
          <div style={s.campaignMeta}>
            <span>Nivel del mundo: {meta.worldLevel || 4}</span>
            <span style={s.metaDot}>·</span>
            <span>Sesión actual: {sessions.length || '—'}</span>
            <span style={s.metaDot}>·</span>
            <span>XP del grupo: {groupXP.toLocaleString()}</span>
            <button style={s.editMetaInlineBtn} onClick={() => {
              setMetaForm({
                nombre: meta.nombre,
                tagline: meta.tagline,
                worldLevel: meta.worldLevel,
                objetivo: meta.objetivo,
                objetivoDesc: meta.objetivoDesc,
                objetivoProgreso: meta.objetivoProgreso,
              });
              setEditingMeta(true);
            }}>✎ Editar campaña</button>
          </div>
        </div>
        <div style={s.campaignActions} className="campaign-actions-grid">
          <button style={s.quickAction} onClick={() => navigate('/campana')}>
            <span style={s.qaIcon}>✚</span><span style={s.qaLabel}>Nueva sesión</span>
          </button>
          <button style={s.quickAction} onClick={() => setLongDescanso(true)}>
            <span style={s.qaIcon}>↻</span><span style={s.qaLabel}>Descanso largo</span>
          </button>
          <button style={s.quickAction} onClick={() => navigate('/notas')}>
            <span style={s.qaIcon}>💬</span><span style={s.qaLabel}>Notas</span>
          </button>
          <button style={s.quickAction} onClick={() => navigate('/manual')}>
            <span style={s.qaIcon}>📖</span><span style={s.qaLabel}>Manual</span>
          </button>
        </div>
      </header>

      {/* ── COMBAT BANNER ── */}
      {combat?.active && (
        <div style={s.combatBanner} className="fade-in">
          <div style={s.combatBannerHeader}>
            <span style={s.combatBannerTitle}>⚔ Combate en curso</span>
            <span style={s.combatBannerRound}>Ronda {combat.round || 1}</span>
          </div>
          <div style={s.combatBannerList}>
            {sortParticipants(combat.participants).map((p, i) => {
              const color = COMBAT_TYPE_COLORS[p.type] || COMBAT_TYPE_COLORS.pj;
              const isCurrent = i === (combat.currentIndex || 0);
              return (
                <div key={p.id} style={{ ...s.combatBannerRow, ...(isCurrent ? s.combatBannerRowActive : {}) }}>
                  <span style={s.combatBannerTurnIcon}>{isCurrent ? '▶' : ''}</span>
                  <span style={{ ...s.combatBannerType, borderColor: `${color}50`, color }}>{p.type === 'enemigo' ? 'Enemigo' : 'PJ'}</span>
                  <span style={s.combatBannerName}>{p.name}</span>
                  <span style={s.combatBannerInit}>{p.initiative}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PARTY LAYOUT ── */}
      <div style={s.partyLayout} className="party-layout-grid">

        {/* ── MAIN ── */}
        <main style={s.partyMain}>

          {/* PARTY ROSTER */}
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Party</span>
              <div style={s.sectionLine} />
              {isAdmin && (
                <button style={s.addBtn} onClick={() => { setAdding(!adding); setForm({ ...EMPTY_CHAR }); }}>
                  {adding ? '✕ Cancelar' : '+ Agregar PJ'}
                </button>
              )}
            </div>

            {/* ADD FORM */}
            {adding && (
              <form onSubmit={saveChar} style={s.form} className="fade-in">
                <div style={s.formTitle}>Nuevo Personaje</div>
                <div style={s.portraitUploadArea}>
                  {form.portrait
                    ? <img src={form.portrait} alt="portrait" style={s.portraitPreview} />
                    : <div style={s.portraitPlaceholder}>📷</div>}
                  <div style={{ flex: 1 }}>
                    <div style={s.formLabel}>Foto del personaje</div>
                    <input type="file" accept="image/*" onChange={handlePortrait} style={s.fileInput} />
                    <div style={{ fontSize: '11px', color: 'var(--gold-dim)', marginTop: '4px' }}>JPG, PNG. Aparecerá como portada.</div>
                  </div>
                </div>
                <div style={s.formGrid}>
                  <Field label="Nombre"><input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del personaje" required /></Field>
                  <Field label="Email del jugador"><input style={s.input} value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} placeholder="jugador@email.com" /></Field>
                  <Field label="Clase"><select style={s.input} value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>{CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="Subclase"><input style={s.input} value={form.subclass} onChange={e => setForm(f => ({ ...f, subclass: e.target.value }))} placeholder="Ej: Colegio del Glamour" /></Field>
                  <Field label="Raza"><select style={s.input} value={form.race} onChange={e => setForm(f => ({ ...f, race: e.target.value }))}>{RACES.map(r => <option key={r}>{r}</option>)}</select></Field>
                  <Field label="Nivel"><input type="number" min="1" max="20" style={s.input} value={form.level} onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value) || 1 }))} /></Field>
                  <Field label="PG máx"><input type="number" style={s.input} value={form.hpMax} onChange={e => setForm(f => ({ ...f, hpMax: parseInt(e.target.value) || 1, hp: parseInt(e.target.value) || 1 }))} /></Field>
                  <Field label="CA"><input type="number" style={s.input} value={form.ac} onChange={e => setForm(f => ({ ...f, ac: parseInt(e.target.value) || 10 }))} /></Field>
                  <Field label="Alineamiento"><input style={s.input} value={form.alignment} onChange={e => setForm(f => ({ ...f, alignment: e.target.value }))} placeholder="Neutral Bueno" /></Field>
                  <Field label="XP actual"><input type="number" style={s.input} value={form.xp} onChange={e => setForm(f => ({ ...f, xp: parseInt(e.target.value) || 0 }))} /></Field>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={s.formLabel}>Icono</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {ICONS.map(ic => (
                        <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                          style={{ fontSize: '20px', background: form.icon === ic ? 'rgba(201,168,76,0.2)' : 'transparent', border: form.icon === ic ? '1px solid #c9a84c' : '1px solid transparent', padding: '4px', cursor: 'pointer', borderRadius: '2px' }}>
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={s.formLabel}>Color</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {COLORS.map(col => (
                        <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                          style={{ width: '24px', height: '24px', background: col, border: form.color === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer', borderRadius: '2px' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <button type="submit" style={s.submitBtn} disabled={saving}>{saving ? 'Guardando...' : '✦ Crear personaje'}</button>
              </form>
            )}

            {/* ROSTER GRID */}
            <div style={s.rosterGrid} className="roster-grid">
              {characters.map(char => (
                <CharCard
                  key={char.id}
                  char={char}
                  user={user}
                  isAdmin={isAdmin}
                  onClick={() => navigate(`/personaje/${char.id}`)}
                  onDelete={() => setDeleteConfirm(char.id)}
                />
              ))}
            </div>
          </section>

          {/* TABLÓN DE CAMPAÑA — shared by DM */}
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>📌 Tablón de campaña</span>
              <div style={s.sectionLine} />
            </div>
            {(sharedNpcs.length === 0 && sharedLocations.length === 0 && sharedFactions.length === 0 && sharedTimeline.length === 0) ? (
              <p style={{ ...s.dashText, opacity: 0.5, fontStyle: 'italic' }}>El DM no ha compartido nada con la party todavía.</p>
            ) : (
              <div style={s.tablon}>

                {/* NPCs */}
                {sharedNpcs.length > 0 && (
                  <div style={s.tablonCard}>
                    <div style={s.tablonCardHeader}><span style={s.tablonCardIcon}>🧑‍🤝‍🧑</span> NPCs conocidos</div>
                    {sharedNpcs.map(npc => (
                      <div key={npc.id} style={s.tablonRow}>
                        <span style={s.tablonRowName}>{npc.name}</span>
                        {npc.role && <span style={s.tablonTag}>{npc.role}</span>}
                        {npc.faction && <span style={{ ...s.tablonTag, opacity: 0.7 }}>{npc.faction}</span>}
                        {npc.motivation && <span style={s.tablonDesc}>{npc.motivation}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Locations */}
                {sharedLocations.length > 0 && (
                  <div style={s.tablonCard}>
                    <div style={s.tablonCardHeader}><span style={s.tablonCardIcon}>🗺</span> Ubicaciones</div>
                    {sharedLocations.map(loc => (
                      <div key={loc.id} style={s.tablonRow}>
                        <span style={s.tablonRowName}>{loc.name}</span>
                        {loc.type && <span style={s.tablonTag}>{loc.type}</span>}
                        {loc.description && <span style={s.tablonDesc}>{loc.description.slice(0, 80)}{loc.description.length > 80 ? '…' : ''}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Factions */}
                {sharedFactions.length > 0 && (
                  <div style={s.tablonCard}>
                    <div style={s.tablonCardHeader}><span style={s.tablonCardIcon}>⚜️</span> Facciones</div>
                    {sharedFactions.map(fac => (
                      <div key={fac.id} style={s.tablonRow}>
                        <span style={s.tablonRowName}>{fac.name}</span>
                        {fac.alignment && <span style={s.tablonTag}>{fac.alignment}</span>}
                        {fac.description && <span style={s.tablonDesc}>{fac.description.slice(0, 80)}{fac.description.length > 80 ? '…' : ''}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                {sharedTimeline.length > 0 && (
                  <div style={s.tablonCard}>
                    <div style={s.tablonCardHeader}><span style={s.tablonCardIcon}>📜</span> Eventos conocidos</div>
                    {sharedTimeline.map(ev => (
                      <div key={ev.id} style={s.tablonRow}>
                        {ev.date && <span style={s.tablonDate}>{ev.date}</span>}
                        <span style={s.tablonRowName}>{ev.title}</span>
                        {ev.description && <span style={s.tablonDesc}>{ev.description.slice(0, 80)}{ev.description.length > 80 ? '…' : ''}</span>}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </section>

          {/* DASHBOARD GRID */}
          <div style={s.dashboardGrid} className="dashboard-grid-2col">

            {/* Última sesión */}
            <div style={s.dashCard}>
              <div style={s.dashCardHeader}>
                <span style={s.dashCardTitle}>Última sesión</span>
                <button style={s.dashLinkBtn} onClick={() => navigate('/campana')}>Ver todas →</button>
              </div>
              <div style={s.dashCardBody}>
                {latestSession ? (
                  <>
                    <div style={s.smallStat}>
                      <span style={s.smallStatLabel}>Sesión</span>
                      <strong style={s.smallStatVal}>{sessions.length}</strong>
                    </div>
                    <p style={s.dashText}>{latestSession.summary || latestSession.title || 'Sin descripción.'}</p>
                    {latestSession.xp > 0 && (
                      <div style={s.xpTag}>+{latestSession.xp} XP</div>
                    )}
                  </>
                ) : (
                  <p style={s.dashText}>Todavía no hay sesiones registradas.</p>
                )}
              </div>
            </div>

            {/* Próximo objetivo */}
            <div style={s.dashCard}>
              <div style={s.dashCardHeader}>
                <span style={s.dashCardTitle}>Próximo objetivo</span>
              </div>
              <div style={s.dashCardBody}>
                <h3 style={s.dashGold}>{meta.objetivo || '—'}</h3>
                <p style={s.dashText}>{meta.objetivoDesc || ''}</p>
                <div style={s.miniBarTrack}>
                  <div style={{ ...s.miniBarFill, width: `${meta.objetivoProgreso || 0}%` }} />
                </div>
                <div style={s.progressLabel}>{meta.objetivoProgreso || 0}% completado</div>
              </div>
            </div>

            {/* Misiones activas */}
            <div style={s.dashCard}>
              <div style={s.dashCardHeader}>
                <span style={s.dashCardTitle}>Misiones activas</span>
                {isAdmin && (
                  <button style={s.dashLinkBtn} onClick={() => setAddingMission(v => !v)}>
                    {addingMission ? '✕' : '+ Misión'}
                  </button>
                )}
              </div>
              <div style={s.dashCardBody}>
                {missions.length === 0 && !addingMission && (
                  <p style={s.dashText}>Sin misiones activas.</p>
                )}
                {missions.map(m => (
                  <div key={m.id} style={s.missionRow}>
                    <span style={s.missionName}>{m.nombre}</span>
                    {isAdmin ? (
                      <input
                        type="number" min="0" max="100"
                        value={m.progreso || 0}
                        onChange={e => updateMissionProgress(m.id, e.target.value)}
                        style={s.missionInput}
                      />
                    ) : (
                      <span style={s.missionPct}>{m.progreso || 0}%</span>
                    )}
                    {isAdmin && (
                      <button style={s.missionDeleteBtn} onClick={() => deleteMission(m.id)}>✕</button>
                    )}
                  </div>
                ))}
                {missions.map(m => (
                  <div key={`bar-${m.id}`} style={{ ...s.miniBarTrack, marginTop: '0', marginBottom: '6px' }}>
                    <div style={{ ...s.miniBarFill, width: `${m.progreso || 0}%`, background: 'var(--green-2)' }} />
                  </div>
                ))}
                {addingMission && isAdmin && (
                  <form onSubmit={saveMission} style={s.miniForm}>
                    <input style={s.miniInput} value={missionForm.nombre} onChange={e => setMissionForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre de la misión" required />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="number" min="0" max="100" style={{ ...s.miniInput, width: '70px' }} value={missionForm.progreso} onChange={e => setMissionForm(f => ({ ...f, progreso: parseInt(e.target.value) || 0 }))} placeholder="%" />
                      <button type="submit" style={s.miniSubmitBtn}>Agregar</button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Botín compartido */}
            <div style={s.dashCard}>
              <div style={s.dashCardHeader}>
                <span style={s.dashCardTitle}>Botín compartido</span>
                {isAdmin && (
                  <button style={s.dashLinkBtn} onClick={() => setAddingLoot(v => !v)}>
                    {addingLoot ? '✕' : '+ Item'}
                  </button>
                )}
              </div>
              <div style={s.dashCardBody}>
                {(meta.loot || []).length === 0 && !addingLoot && (
                  <p style={s.dashText}>El cofre está vacío.</p>
                )}
                <div style={s.lootGrid}>
                  {(meta.loot || []).map((item, i) => (
                    <div key={i} style={s.lootItem} title={item.nombre}>
                      <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.emoji}</span>
                      {isAdmin && (
                        <button
                          style={s.lootDeleteBtn}
                          onClick={() => removeLoot(i)}
                          title={`Quitar ${item.nombre}`}
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {addingLoot && isAdmin && (
                  <form onSubmit={addLoot} style={{ ...s.miniForm, marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select style={{ ...s.miniInput, width: '50px', fontSize: '18px', textAlign: 'center' }}
                        value={lootForm.emoji} onChange={e => setLootForm(f => ({ ...f, emoji: e.target.value }))}>
                        {LOOT_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                      </select>
                      <input style={s.miniInput} value={lootForm.nombre} onChange={e => setLootForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del objeto" required />
                    </div>
                    <button type="submit" style={s.miniSubmitBtn}>Agregar al cofre</button>
                  </form>
                )}
              </div>
            </div>

            {/* Mapa del viaje — span 2 */}
            {sharedMaps.length > 0 ? (
              sharedMaps.map(map => (
                <div key={map.id} style={{ ...s.dashCard, ...s.dashCardSpan2 }}>
                  <div style={s.dashCardHeader}>
                    <span style={s.dashCardTitle}>🗾 {map.title}</span>
                  </div>
                  <div style={s.dashCardBody}>
                    <div style={s.partyMapWrap}>
                      <img src={map.imageUrl} alt={map.title} style={s.partyMapImg} />
                      {(map.tokens || []).map(token => (
                        <div
                          key={token.id}
                          style={{
                            position: 'absolute',
                            left: `${token.x}%`,
                            top: `${token.y}%`,
                            transform: 'translate(-50%, -50%)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                            padding: '3px 5px', border: `1.5px solid ${token.color}`,
                            borderRadius: '6px', background: `${token.color}33`,
                            backdropFilter: 'blur(4px)', zIndex: 5, minWidth: '32px',
                          }}
                          title={token.label}
                        >
                          <span style={{ fontSize: '16px', lineHeight: 1 }}>{token.emoji}</span>
                          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', color: token.color, whiteSpace: 'nowrap' }}>{token.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ ...s.dashCard, ...s.dashCardSpan2 }}>
                <div style={s.dashCardHeader}>
                  <span style={s.dashCardTitle}>Mapa del viaje</span>
                </div>
                <div style={s.dashCardBody}>
                  <div style={s.mapCard}>
                    <div style={s.mapOverlay}>
                      <span style={s.mapText}>Montañas de Valgrun</span>
                    </div>
                  </div>
                  <p style={{ ...s.dashText, marginTop: '8px', textAlign: 'center', opacity: 0.5 }}>El DM no ha compartido ningún mapa todavía.</p>
                </div>
              </div>
            )}

            {/* Manual rápido — span 2 */}
            <div style={{ ...s.dashCard, ...s.dashCardSpan2 }}>
              <div style={s.dashCardHeader}>
                <span style={s.dashCardTitle}>Manual rápido</span>
              </div>
              <div style={{ ...s.dashCardBody, display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <h3 style={s.dashGold}>¿Nuevo en D&D?</h3>
                  <p style={s.dashText}>Aprendé lo esencial: cómo jugar, acciones en combate, creación de personaje y reglas básicas del Manual del Jugador 2024.</p>
                </div>
                <button style={s.manualBtn} onClick={() => navigate('/manual')}>Ir al manual →</button>
              </div>
            </div>

          </div>{/* END dashboardGrid */}
        </main>

        {/* ── ASIDE — Activity feed ── */}
        <aside style={s.partyAside} className="party-aside-sticky">

          {/* STATS */}
          <div style={{ ...s.dashCard, marginBottom: '12px' }}>
            <div style={s.dashCardHeader}>
              <span style={s.dashCardTitle}>Estadísticas</span>
            </div>
            <div style={s.dashCardBody}>
              <div style={s.statsGrid}>
                <StatTile label="Miembros" value={characters.length} />
                <StatTile label="Nivel prom." value={avgLevel} />
                <StatTile label="Sesiones" value={sessions.length || '—'} />
                <StatTile label="XP total" value={groupXP.toLocaleString()} />
              </div>
            </div>
          </div>

          {/* ACTIVITY FEED */}
          <div style={s.dashCard}>
            <div style={s.dashCardHeader}>
              <span style={s.dashCardTitle}>Actividad reciente</span>
            </div>
            <div style={s.dashCardBody}>
              <div style={s.activityFeed}>
                {sessions.slice(0, 5).map(session => (
                  <div key={session.id} style={s.activityItem}>
                    <span style={s.activityAvatar}>📜</span>
                    <div style={s.activityContent}>
                      <span style={s.activityName}>{session.title || `Sesión ${sessions.indexOf(session) + 1}`}</span>
                      <span style={s.activityDesc}>{session.summary ? session.summary.slice(0, 55) + (session.summary.length > 55 ? '...' : '') : 'Nueva sesión registrada'}</span>
                    </div>
                    <small style={s.activityTime}>{formatRelativeDate(session.createdAt)}</small>
                  </div>
                ))}
                {characters.map(c => (
                  <div key={`lv-${c.id}`} style={s.activityItem}>
                    <span style={s.activityAvatar}>⬆</span>
                    <div style={s.activityContent}>
                      <span style={s.activityName}>{c.name}</span>
                      <span style={s.activityDesc}>nivel {c.level} · {c.race} {c.class}</span>
                    </div>
                    <span style={{ ...s.levelPip, borderColor: c.color, color: c.color }}>{c.level}</span>
                  </div>
                ))}
                {sessions.length === 0 && characters.length === 0 && (
                  <p style={s.dashText}>Sin actividad reciente.</p>
                )}
              </div>
            </div>
          </div>

          {/* DM LINK */}
          {isAdmin && (
            <button style={s.dmPanelBtn} onClick={() => navigate('/dm')}>
              👁 Panel del Dungeon Master
            </button>
          )}
        </aside>
      </div>{/* END partyLayout */}

      {/* ── MODALS ── */}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>¿Eliminar personaje?</div>
            <p style={s.modalText}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.deleteBtn} onClick={() => deleteChar(deleteConfirm)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit meta */}
      {editingMeta && isAdmin && (
        <div style={s.overlay}>
          <div style={{ ...s.modalBox, maxWidth: '480px' }}>
            <div style={s.modalTitle}>Editar campaña</div>
            <form onSubmit={saveMeta} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <Field label="Nombre de la campaña">
                <input style={s.input} value={metaForm.nombre || ''} onChange={e => setMetaForm(f => ({ ...f, nombre: e.target.value }))} />
              </Field>
              <Field label="Tagline">
                <input style={s.input} value={metaForm.tagline || ''} onChange={e => setMetaForm(f => ({ ...f, tagline: e.target.value }))} />
              </Field>
              <Field label="Nivel del mundo">
                <input type="number" min="1" max="20" style={s.input} value={metaForm.worldLevel || 4} onChange={e => setMetaForm(f => ({ ...f, worldLevel: e.target.value }))} />
              </Field>
              <Field label="Objetivo actual">
                <input style={s.input} value={metaForm.objetivo || ''} onChange={e => setMetaForm(f => ({ ...f, objetivo: e.target.value }))} />
              </Field>
              <Field label="Descripción del objetivo">
                <textarea style={{ ...s.input, resize: 'vertical', minHeight: '60px' }} value={metaForm.objetivoDesc || ''} onChange={e => setMetaForm(f => ({ ...f, objetivoDesc: e.target.value }))} />
              </Field>
              <Field label="Progreso % (0-100)">
                <input type="number" min="0" max="100" style={s.input} value={metaForm.objetivoProgreso || 0} onChange={e => setMetaForm(f => ({ ...f, objetivoProgreso: e.target.value }))} />
              </Field>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="button" style={s.cancelBtn} onClick={() => setEditingMeta(false)}>Cancelar</button>
                <button type="submit" style={s.submitBtn}>Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Long rest confirm */}
      {longDescanso && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>↻ Descanso largo</div>
            <p style={s.modalText}>Todos los personajes recuperan sus PG máximos y espacios de conjuro. ¿Confirmar?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={() => setLongDescanso(false)}>Cancelar</button>
              <button style={s.submitBtn} onClick={doLongRest}>Descansar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

// ── SUB-COMPONENTS ──

function CharCard({ char, user, isAdmin, onClick, onDelete }) {
  const xpPct = Math.min(100, Math.round(((char.xp || 0) / (char.xpNext || 2700)) * 100));
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  const isOwner = char.ownerEmail === user.email || isAdmin;
  const hpColor = hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a';

  return (
    <div style={{ ...s.card, borderTopColor: char.color || '#c9a84c' }} className="fade-in">
      {char.portrait && (
        <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
          <img src={char.portrait} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70px', background: 'linear-gradient(to top, rgba(5,5,4,1), transparent)' }} />
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', ...s.levelBadge, borderColor: char.color, color: char.color }}>{char.level}</div>
        </div>
      )}
      <div style={s.cardBody} onClick={onClick}>
        <div style={s.cardHeader}>
          <span style={{ fontSize: '24px' }}>{char.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={s.cardName}>{char.name}</div>
            <div style={s.cardSub}>{char.race} {char.class} · Lv{char.level}</div>
          </div>
          {!char.portrait && (
            <div style={{ ...s.levelBadge, borderColor: char.color, color: char.color }}>{char.level}</div>
          )}
        </div>
        <div style={{ height: '1px', background: `linear-gradient(to right, ${char.color}40, transparent)`, margin: '4px 0' }} />
        <div style={s.cardStats}>
          <MiniStat label="PG" value={`${char.hp}/${char.hpMax}`} />
          <MiniStat label="CA" value={char.ac} />
          <MiniStat label="CAR" value={`+${Math.floor(((char.stats?.car || 10) - 10) / 2)}`} />
          <MiniStat label="Jugador" value={char.player || '—'} small />
        </div>
        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpColor }} />
        </div>
        <div style={s.barLabel}><span style={{ color: 'var(--gold-dim)' }}>PG</span></div>
        <div style={{ ...s.barTrack, marginTop: '6px' }}>
          <div style={{ ...s.barFill, width: `${xpPct}%`, background: `${char.color}80` }} />
        </div>
        <div style={s.barLabel}>
          <span style={{ color: 'var(--gold-dim)' }}>XP</span>
          <span style={{ color: 'var(--gold-dim)' }}>{(char.xp || 0).toLocaleString()} / {(char.xpNext || 2700).toLocaleString()}</span>
        </div>
        <div style={{ ...s.subclassBadge, borderColor: `${char.color}40`, color: char.color }}>{char.subclass}</div>
        <div style={s.cardCta}>Ver ficha completa →</div>
      </div>
      {isOwner && (
        <button style={s.deleteCharBtn} onClick={e => { e.stopPropagation(); onDelete(); }} title="Eliminar">✕</button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={s.formLabel}>{label}</label>
      {children}
    </div>
  );
}

function MiniStat({ label, value, small }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: small ? '11px' : '14px', fontWeight: '700', color: 'var(--gold-bright)' }}>{value}</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={s.statTile}>
      <span style={s.statTileVal}>{value}</span>
      <span style={s.statTileLabel}>{label}</span>
    </div>
  );
}

// ── STYLES ──
const s = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: 'var(--gold-dim)', letterSpacing: '3px', fontSize: '11px' },

  // Campaign header
  campaignHeader: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '20px', alignItems: 'center', padding: '28px 0 20px', borderBottom: '1px solid var(--line)', marginBottom: '20px', flexWrap: 'wrap' },
  campaignEmblem: { width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-gold-strong, rgba(201,168,76,0.5))', borderRadius: '20px', background: 'radial-gradient(circle, rgba(166,238,129,0.15), rgba(0,0,0,0.6))', fontSize: '2rem', boxShadow: '0 0 20px rgba(201,168,76,0.15)', flexShrink: 0 },
  campaignInfo: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  eyebrow: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  campaignTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(1.4rem,3vw,2.4rem)', fontWeight: '900', letterSpacing: '0.08em', color: 'var(--gold-bright, #f7dd78)', textTransform: 'uppercase', margin: 0, lineHeight: 1.1 },
  campaignTagline: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft, #b8a87a)', margin: '2px 0 0', fontStyle: 'italic' },
  campaignMeta: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' },
  metaDot: { color: 'var(--gold-dim)', opacity: 0.5 },
  editMetaInlineBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '3px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', marginLeft: '8px' },
  campaignActions: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(72px, 1fr))', gap: '8px', flexShrink: 0 },
  quickAction: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', minHeight: '72px', padding: '10px 8px', background: 'var(--bg-panel, rgba(20,18,12,0.8))', border: '1px solid var(--line, rgba(201,168,76,0.15))', borderRadius: '12px', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' },
  qaIcon: { fontSize: '1.4rem', color: 'var(--gold-bright, #f7dd78)', lineHeight: 1 },
  qaLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '0.5px', color: 'var(--text-soft, #b8a87a)', textAlign: 'center', textTransform: 'uppercase' },

  // Combat banner
  combatBanner: { background: 'var(--panel, rgba(20,18,12,0.9))', border: '1px solid rgba(139,26,26,0.35)', borderTop: '2px solid #8b1a1a', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: '8px' },
  combatBannerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  combatBannerTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '2px', color: '#e05050', textTransform: 'uppercase' },
  combatBannerRound: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--gold)', border: '1px solid var(--line)', padding: '3px 10px', textTransform: 'uppercase' },
  combatBannerList: { display: 'flex', flexDirection: 'column', gap: '5px' },
  combatBannerRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(11,9,6,0.5)', border: '1px solid var(--line)' },
  combatBannerRowActive: { background: 'rgba(201,168,76,0.1)', borderColor: 'rgba(201,168,76,0.5)', boxShadow: '0 0 12px rgba(201,168,76,0.15)' },
  combatBannerTurnIcon: { width: '14px', color: 'var(--gold-bright)', fontSize: '11px', flexShrink: 0 },
  combatBannerType: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', textTransform: 'uppercase', flexShrink: 0 },
  combatBannerName: { flex: 1, fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-bright)' },
  combatBannerInit: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--gold)', minWidth: '24px', textAlign: 'right' },

  // Layout
  partyLayout: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: '16px', alignItems: 'start' },
  partyMain: { minWidth: 0 },
  partyAside: { position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '0' },

  // Section
  section: { marginBottom: '20px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: 'var(--gold-dim)', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, var(--line, rgba(201,168,76,0.2)), transparent)' },
  addBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRadius: '4px' },

  // Roster
  rosterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },

  // Character cards
  card: { background: 'var(--bg-panel, rgba(20,18,12,0.8))', border: '1px solid var(--line)', borderTop: '3px solid var(--gold)', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderRadius: '8px' },
  cardBody: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  cardName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.5px' },
  cardSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--gold-dim)', marginTop: '2px' },
  levelBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%' },
  cardStats: { display: 'flex', justifyContent: 'space-between' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  barLabel: { display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px' },
  subclassBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', padding: '3px 8px', textTransform: 'uppercase', alignSelf: 'flex-start', borderRadius: '4px' },
  cardCta: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', marginTop: '2px' },
  deleteCharBtn: { position: 'absolute', top: '8px', right: '8px', background: 'rgba(184,100,63,0.1)', border: '1px solid rgba(184,100,63,0.4)', color: '#e05050', fontFamily: 'Cinzel,serif', fontSize: '10px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderRadius: '50%' },

  // Dashboard grid
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  dashCardSpan2: { gridColumn: 'span 2' },
  dashCard: { background: 'var(--bg-panel, rgba(20,18,12,0.8))', border: '1px solid var(--line, rgba(201,168,76,0.15))', borderRadius: '12px', overflow: 'hidden', position: 'relative' },
  dashCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 0', borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '0' },
  dashCardTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  dashLinkBtn: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', padding: '0', opacity: 0.7 },
  dashCardBody: { padding: '12px 14px 14px' },
  dashText: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft, #b8a87a)', margin: '6px 0', lineHeight: 1.5 },
  dashGold: { fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)', margin: '0 0 6px', letterSpacing: '0.5px' },
  xpTag: { display: 'inline-block', background: 'rgba(101,194,96,0.12)', border: '1px solid rgba(101,194,96,0.3)', color: 'var(--green-2, #65c260)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '3px 8px', borderRadius: '4px', marginTop: '4px' },
  smallStat: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' },
  smallStatLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  smallStatVal: { fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: '700', color: 'var(--gold-bright)', lineHeight: 1 },

  // Progress bars
  miniBarTrack: { height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', margin: '8px 0 4px' },
  miniBarFill: { height: '100%', background: 'var(--gold-2, #c7a242)', borderRadius: '3px', transition: 'width 0.3s' },
  progressLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },

  // Missions
  missionRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  missionName: { flex: 1, fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-main, #f4ecd2)' },
  missionPct: { fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--green-2, #65c260)', fontWeight: '700', minWidth: '36px', textAlign: 'right' },
  missionInput: { width: '52px', background: 'var(--bg-deep, #020201)', border: '1px solid var(--line)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '11px', padding: '3px 6px', textAlign: 'center', outline: 'none', borderRadius: '4px' },
  missionDeleteBtn: { background: 'transparent', border: 'none', color: 'rgba(224,80,80,0.6)', cursor: 'pointer', fontSize: '11px', padding: '0', lineHeight: 1, flexShrink: 0 },

  // Loot
  lootGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' },
  lootItem: { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', position: 'relative', cursor: 'default' },
  lootDeleteBtn: { position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', background: 'rgba(139,26,26,0.8)', border: '1px solid rgba(224,80,80,0.5)', color: '#e05050', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', lineHeight: 1, padding: 0 },

  // Party map viewer
  partyMapWrap: { position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)', background: '#0a0806' },
  partyMapImg: { width: '100%', height: 'auto', display: 'block', userSelect: 'none' },

  // Map
  mapCard: { minHeight: '140px', borderRadius: '10px', background: 'radial-gradient(circle at 30% 40%, rgba(247,221,120,0.18), transparent 8%), radial-gradient(circle at 70% 60%, rgba(139,26,26,0.15), transparent 10%), linear-gradient(135deg, #2a1f0f, #5a3d1a 52%, #1a110a)', position: 'relative', overflow: 'hidden' },
  mapOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '10px 14px' },
  mapText: { fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'rgba(255,220,100,0.4)', letterSpacing: '1px' },

  // Manual
  manualBtn: { background: 'linear-gradient(135deg, var(--gold-bright, #f7dd78), var(--gold-2, #c7a242))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '10px 20px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 },

  // Aside stats grid
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  statTile: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 8px', gap: '2px' },
  statTileVal: { fontFamily: 'Cinzel,serif', fontSize: '18px', fontWeight: '700', color: 'var(--gold-bright)', lineHeight: 1 },
  statTileLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px', color: 'var(--gold-dim)', textTransform: 'uppercase' },

  // Activity feed
  activityFeed: { display: 'flex', flexDirection: 'column', gap: '0' },
  activityItem: { display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: '8px', alignItems: 'start', padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' },
  activityAvatar: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.08)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '16px', flexShrink: 0 },
  activityContent: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  activityName: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '0.5px', color: 'var(--gold-bright)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  activityDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--text-soft)', display: 'block', lineHeight: 1.4 },
  activityTime: { fontFamily: 'Cinzel,serif', fontSize: '8px', color: 'var(--gold-dim)', whiteSpace: 'nowrap', letterSpacing: '0.5px', marginTop: '2px' },
  levelPip: { fontFamily: 'Cinzel,serif', fontSize: '10px', fontWeight: '700', border: '1px solid', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 },

  // Tablón de campaña
  tablon: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  tablonCard: { background: 'var(--bg-panel, rgba(20,18,12,0.8))', border: '1px solid var(--line, rgba(201,168,76,0.15))', borderRadius: '10px', overflow: 'hidden' },
  tablonCardHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--line)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase', background: 'rgba(0,0,0,0.2)' },
  tablonCardIcon: { fontSize: '14px' },
  tablonRow: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 14px', borderBottom: '1px solid rgba(201,168,76,0.06)' },
  tablonRowName: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--gold-bright)', fontWeight: '600' },
  tablonTag: { display: 'inline-block', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '2px 6px', borderRadius: '3px', alignSelf: 'flex-start', textTransform: 'uppercase' },
  tablonDesc: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: 'var(--text-soft, #b8a87a)', lineHeight: 1.4 },
  tablonDate: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },

  // DM button
  dmPanelBtn: { marginTop: '12px', width: '100%', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1.5px', padding: '12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '8px', transition: 'border-color 0.2s' },

  // Form
  form: { background: 'var(--bg-panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)', padding: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: '8px' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '3px', color: 'var(--gold)', textTransform: 'uppercase' },
  formLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', color: 'var(--parchment, #f4ecd2)', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  fileInput: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '6px', cursor: 'pointer', width: '100%', marginTop: '4px' },
  portraitUploadArea: { display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '6px' },
  portraitPreview: { width: '80px', height: '100px', objectFit: 'cover', objectPosition: 'top', border: '1px solid var(--line)', flexShrink: 0, borderRadius: '4px' },
  portraitPlaceholder: { width: '80px', height: '100px', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, borderRadius: '4px' },
  submitBtn: { background: 'linear-gradient(135deg, var(--gold-bright, #f7dd78), var(--gold-2, #c7a242))', border: 'none', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px' },

  // Mini form (missions/loot)
  miniForm: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--line)' },
  miniInput: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '6px 10px', outline: 'none', flex: 1, borderRadius: '4px' },
  miniSubmitBtn: { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },

  // Modals
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  modalBox: { background: 'var(--bg-panel, rgba(20,18,12,0.98))', border: '1px solid rgba(201,168,76,0.3)', borderTop: '2px solid var(--gold-2)', padding: '24px', maxWidth: '400px', width: '100%', borderRadius: '12px' },
  modalTitle: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: 'var(--gold-bright)', marginBottom: '8px', letterSpacing: '1px' },
  modalText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: 'var(--text-soft)' },
  cancelBtn: { flex: 1, background: 'transparent', border: '1px solid var(--line)', color: 'var(--text-soft)', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '4px' },
  deleteBtn: { flex: 1, background: 'rgba(184,100,63,0.1)', border: '1px solid rgba(184,100,63,0.4)', color: '#e05050', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '4px' },
};
