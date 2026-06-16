// src/pages/Home.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';

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
  name: '',
  class: 'Guerrero',
  subclass: '',
  race: 'Humano',
  level: 1,
  hp: 10,
  hpMax: 10,
  ac: 10,
  xp: 0,
  xpNext: 300,
  alignment: 'Neutral',
  player: '',
  ownerEmail: '',
  color: '#7a5a9a',
  icon: '🧙',
  portrait: '',
  stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
};

const CLASSES = ['Bárbaro','Bardo','Clérigo','Druida','Explorador','Guerrero','Hechicero','Mago','Monje','Paladín','Pícaro','Warlock'];
const RACES = ['Humano','Elfo','Enano','Mediano','Gnomo','Semielfo','Semiorco','Tiefling','Aasimar','Draconido'];
const ICONS = ['⚔️','🎵','🔮','🏹','🛡️','⚡','🌿','🔥','❄️','☠️','✨','🐉'];
const COLORS = ['#c9a84c','#4a7fa5','#8b1a1a','#5a8a5a','#7a5a9a','#4a7a7a','#a57a4a','#6a4a8a'];

export default function Home({ user }) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CHAR });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    try {
      const snap = await getDocs(collection(db, 'characters'));
      if (snap.empty) {
        for (const char of INITIAL_CHARACTERS) {
          await setDoc(doc(db, 'characters', char.id), { ...char, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        setCharacters(INITIAL_CHARACTERS);
      } else {
        setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdmin = user.email === 'sociosn5@gmail.com';

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
    } catch (err) {
      console.error('Error subiendo imagen:', err);
    }
    setSaving(false);
  };

  if (loading) return <div style={s.loading}>Cargando party...</div>;

  return (
    <div style={s.page}>
      {/* HERO */}
      <div style={s.hero}>
        <div style={s.heroGlow} />
        <div style={s.heroContent}>
          <div style={s.heroLabel}>Campaña Activa · D&D 5e 2024</div>
          <h1 style={s.heroTitle}>DND PARTY</h1>
        </div>
      </div>

      {/* CHARACTERS */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Personajes</span>
          <div style={s.sectionLine} />
          <button style={s.addBtn} onClick={() => { setAdding(!adding); setForm({ ...EMPTY_CHAR }); }}>
            {adding ? '✕ Cancelar' : '+ Agregar PJ'}
          </button>
        </div>

        {/* ADD FORM */}
        {adding && (
          <form onSubmit={saveChar} style={s.form} className="fade-in">
            <div style={s.formTitle}>Nuevo Personaje</div>

            {/* Portrait upload */}
            <div style={s.portraitUploadArea}>
              {form.portrait
                ? <img src={form.portrait} alt="portrait" style={s.portraitPreview} />
                : <div style={s.portraitPlaceholder}>📷</div>
              }
              <div style={{ flex: 1 }}>
                <div style={s.formLabel}>Foto / Ilustración del personaje</div>
                <input type="file" accept="image/*" onChange={handlePortrait} style={s.fileInput} />
                <div style={{ fontSize: '11px', color: '#5a4820', marginTop: '4px' }}>JPG, PNG o cualquier imagen. Aparecerá como portada.</div>
              </div>
            </div>

            <div style={s.formGrid}>
              <Field label="Nombre">
                <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del personaje" required />
              </Field>
              <Field label="Email del jugador">
                <input style={s.input} value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} placeholder="jugador@email.com" />
              </Field>
              <Field label="Clase">
                <select style={s.input} value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Subclase">
                <input style={s.input} value={form.subclass} onChange={e => setForm(f => ({ ...f, subclass: e.target.value }))} placeholder="Ej: Colegio del Glamour" />
              </Field>
              <Field label="Raza">
                <select style={s.input} value={form.race} onChange={e => setForm(f => ({ ...f, race: e.target.value }))}>
                  {RACES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Nivel">
                <input type="number" min="1" max="20" style={s.input} value={form.level} onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value) || 1 }))} />
              </Field>
              <Field label="PG máx">
                <input type="number" style={s.input} value={form.hpMax} onChange={e => setForm(f => ({ ...f, hpMax: parseInt(e.target.value) || 1, hp: parseInt(e.target.value) || 1 }))} />
              </Field>
              <Field label="CA">
                <input type="number" style={s.input} value={form.ac} onChange={e => setForm(f => ({ ...f, ac: parseInt(e.target.value) || 10 }))} />
              </Field>
              <Field label="Alineamiento">
                <input style={s.input} value={form.alignment} onChange={e => setForm(f => ({ ...f, alignment: e.target.value }))} placeholder="Neutral Bueno" />
              </Field>
              <Field label="XP actual">
                <input type="number" style={s.input} value={form.xp} onChange={e => setForm(f => ({ ...f, xp: parseInt(e.target.value) || 0 }))} />
              </Field>
            </div>

            {/* Icon & color */}
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
                <div style={s.formLabel}>Color del personaje</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {COLORS.map(col => (
                    <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                      style={{ width: '24px', height: '24px', background: col, border: form.color === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer', borderRadius: '2px' }} />
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" style={s.submitBtn} disabled={saving}>
              {saving ? 'Guardando...' : '✦ Crear personaje'}
            </button>
          </form>
        )}

        {/* CHARACTERS GRID */}
        <div style={s.grid}>
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
      </div>

      {/* STATS BAR */}
      <div style={s.statsBar}>
        <StatPill label="Miembros" value={characters.length} />
        <StatPill label="Nivel prom." value={Math.round(characters.reduce((a, c) => a + (c.level || 0), 0) / (characters.length || 1))} />
        <StatPill label="Sesiones" value="—" />
        <StatPill label="XP mayor" value={(Math.max(...characters.map(c => c.xp || 0))).toLocaleString()} />
      </div>

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={s.confirmBox}>
            <div style={s.confirmTitle}>¿Eliminar personaje?</div>
            <p style={s.confirmText}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={s.deleteBtn} onClick={() => deleteChar(deleteConfirm)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

function CharCard({ char, user, isAdmin, onClick, onDelete }) {
  const xpPct = Math.min(100, Math.round(((char.xp || 0) / (char.xpNext || 2700)) * 100));
  const hpPct = Math.min(100, Math.round(((char.hp || 0) / (char.hpMax || 1)) * 100));
  const isOwner = char.ownerEmail === user.email || isAdmin;

  return (
    <div style={{ ...s.card, borderTopColor: char.color || '#c9a84c' }} className="fade-in">
      {/* Portrait */}
      {char.portrait
        ? <div style={{ position: 'relative', height: '160px', overflow: 'hidden', margin: '-0px' }}>
            <img src={char.portrait} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(15,12,24,1), transparent)' }} />
          </div>
        : null
      }

      <div style={s.cardBody} onClick={onClick}>
        <div style={s.cardHeader}>
          <span style={{ fontSize: '26px' }}>{char.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={s.cardName}>{char.name}</div>
            <div style={s.cardSub}>{char.race} {char.class} · Lv{char.level}</div>
          </div>
          <div style={{ ...s.levelBadge, borderColor: char.color, color: char.color }}>{char.level}</div>
        </div>

        <div style={{ ...s.cardDivider, background: `linear-gradient(to right, ${char.color}40, transparent)` }} />

        <div style={s.cardStats}>
          <MiniStat label="PG" value={`${char.hp}/${char.hpMax}`} />
          <MiniStat label="CA" value={char.ac} />
          <MiniStat label="CAR" value={`+${Math.floor(((char.stats?.car || 10) - 10) / 2)}`} />
          <MiniStat label="Jugador" value={char.player || '—'} small />
        </div>

        <div style={s.barTrack}>
          <div style={{ ...s.barFill, width: `${hpPct}%`, background: hpPct > 50 ? '#4a8a4a' : hpPct > 25 ? '#a07020' : '#8b1a1a' }} />
        </div>
        <div style={s.barLabel}><span style={{ color: '#5a4820' }}>PG</span></div>

        <div style={{ ...s.barTrack, marginTop: '6px' }}>
          <div style={{ ...s.barFill, width: `${xpPct}%`, background: `${char.color}80` }} />
        </div>
        <div style={s.barLabel}>
          <span style={{ color: '#5a4820' }}>XP</span>
          <span style={{ color: '#5a4820' }}>{(char.xp || 0).toLocaleString()} / {(char.xpNext || 2700).toLocaleString()}</span>
        </div>

        <div style={{ ...s.subclassBadge, borderColor: `${char.color}40`, color: char.color }}>{char.subclass}</div>
        <div style={s.cardCta}>Ver ficha completa →</div>
      </div>

      {/* Owner/Admin actions */}
      {isOwner && (
        <button style={s.deleteCharBtn} onClick={e => { e.stopPropagation(); onDelete(); }} title="Eliminar personaje">✕</button>
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
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: small ? '11px' : '14px', fontWeight: '700', color: '#e8c96a' }}>{value}</div>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={s.pill}>
      <span style={s.pillVal}>{value}</span>
      <span style={s.pillLabel}>{label}</span>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  hero: { position: 'relative', padding: '40px 20px 28px', textAlign: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 70%)', pointerEvents: 'none' },
  heroContent: { position: 'relative', zIndex: 1 },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(28px,6vw,48px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  section: { marginBottom: '28px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  sectionTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sectionLine: { flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },
  addBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  form: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.2)', borderTop: '2px solid #c9a84c', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  formTitle: { fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '3px', color: '#c9a84c', textTransform: 'uppercase' },
  formLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '8px 12px', outline: 'none', width: '100%' },
  fileInput: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: '#c9a84c', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '6px', cursor: 'pointer', width: '100%', marginTop: '4px' },
  portraitUploadArea: { display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' },
  portraitPreview: { width: '80px', height: '100px', objectFit: 'cover', objectPosition: 'top', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 },
  portraitPlaceholder: { width: '80px', height: '100px', background: 'rgba(201,168,76,0.06)', border: '1px dashed rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 },
  submitBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px', cursor: 'pointer', textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.15)', borderTop: '3px solid #c9a84c', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' },
  cardBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  cardName: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e8c96a', letterSpacing: '0.5px' },
  cardSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' },
  levelBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardDivider: { height: '1px' },
  cardStats: { display: 'flex', justifyContent: 'space-between' },
  barTrack: { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  barLabel: { display: 'flex', justifyContent: 'space-between', marginTop: '2px' },
  subclassBadge: { border: '1px solid', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', padding: '3px 8px', textTransform: 'uppercase', alignSelf: 'flex-start' },
  cardCta: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase', marginTop: '2px' },
  deleteCharBtn: { position: 'absolute', top: '8px', right: '8px', background: 'rgba(139,26,26,0.2)', border: '1px solid rgba(139,26,26,0.4)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  statsBar: { display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '16px 0', borderTop: '1px solid rgba(201,168,76,0.1)', marginTop: '8px' },
  pill: { background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)', padding: '8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  pillVal: { fontFamily: 'Cinzel,serif', fontSize: '16px', fontWeight: '700', color: '#e8c96a' },
  pillLabel: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '2px', color: '#5a4820', textTransform: 'uppercase' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  confirmBox: { background: '#0f0c18', border: '1px solid rgba(139,26,26,0.4)', borderTop: '2px solid #8b1a1a', padding: '24px', maxWidth: '320px', width: '100%' },
  confirmTitle: { fontFamily: 'Cinzel,serif', fontSize: '14px', fontWeight: '700', color: '#e07070', marginBottom: '8px', letterSpacing: '1px' },
  confirmText: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#8a8070' },
  cancelBtn: { flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8a8070', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' },
  deleteBtn: { flex: 1, background: 'rgba(139,26,26,0.2)', border: '1px solid rgba(139,26,26,0.5)', color: '#e07070', fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' },
};

