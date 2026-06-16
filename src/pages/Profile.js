// src/pages/Profile.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { uploadImage } from '../lib/uploadImage';
import { db } from '../lib/firebase';

const ROLES = ['Jugador', 'Dungeon Master', 'Jugador / DM'];

export default function Profile({ user }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const uid = user.uid;

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, 'profiles', uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setDraft(data);
      } else {
        const initial = {
          alias: user.email?.split('@')[0] || '',
          role: 'Jugador',
          bio: '',
          avatar: '',
          email: user.email,
          createdAt: serverTimestamp(),
        };
        setProfile(initial);
        setDraft(initial);
      }
    };
    load();
  }, [uid, user.email]);

  useEffect(() => {
    const loadCharacters = async () => {
      setLoadingChars(true);
      try {
        const q = query(collection(db, 'characters'), where('ownerEmail', '==', user.email));
        const snap = await getDocs(q);
        setCharacters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error cargando personajes del usuario:', err);
      }
      setLoadingChars(false);
    };
    loadCharacters();
  }, [user.email]);

  const save = async () => {
    setSaving(true);
    await setDoc(doc(db, 'profiles', uid), {
      ...draft,
      email: user.email,
      updatedAt: serverTimestamp(),
    });
    setProfile(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file, `portraits/profiles/${uid}_${Date.now()}`);
      setDraft(d => ({ ...d, avatar: url }));
    } catch (err) {
      console.error('Error subiendo imagen:', err);
    }
    setSaving(false);
  };

  if (!profile) return <div style={s.loading}>Cargando perfil...</div>;

  return (
    <div style={s.page} className="fade-in">

      <div style={s.hero}>
        <div style={s.heroLabel}>Tu cuenta</div>
        <h1 style={s.heroTitle}>PERFIL</h1>
        <p style={s.heroSub}>Personalizá tu identidad en la campaña</p>
      </div>

      <div style={s.card}>

        {/* AVATAR */}
        <div style={s.avatarSection}>
          <div style={s.avatarWrap}>
            {draft.avatar
              ? <img src={draft.avatar} alt="avatar" style={s.avatarImg} />
              : <div style={s.avatarPlaceholder}>
                  <span style={{ fontSize: '36px' }}>⚔</span>
                  <span style={s.avatarInitial}>{(draft.alias || '?')[0].toUpperCase()}</span>
                </div>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.avatarName}>{draft.alias || user.email?.split('@')[0]}</div>
            <div style={s.avatarEmail}>{user.email}</div>
            <div style={{ ...s.roleBadge, marginTop: '8px' }}>{draft.role || 'Jugador'}</div>
            <div style={{ marginTop: '10px' }}>
              <label style={s.fileLabel}>
                📷 Cambiar foto de perfil
                <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>

        <div style={s.divider} />

        {/* FIELDS */}
        <div style={s.fields}>

          <div style={s.field}>
            <label style={s.label}>Alias / Nombre en el juego</label>
            <input
              value={draft.alias || ''}
              onChange={e => setDraft(d => ({ ...d, alias: e.target.value }))}
              style={s.input}
              placeholder="Ej: Rakets, MagoOscuro, ElArquero..."
            />
            <div style={s.hint}>Este es el nombre que verán tus compañeros de party</div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Rol en la campaña</label>
            <div style={s.roleGrid}>
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => setDraft(d => ({ ...d, role: r }))}
                  style={{ ...s.roleBtn, ...(draft.role === r ? s.roleBtnActive : {}) }}
                >
                  {r === 'Jugador' && '⚔️ '}
                  {r === 'Dungeon Master' && '👁️ '}
                  {r === 'Jugador / DM' && '✦ '}
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Bio / Descripción</label>
            <textarea
              value={draft.bio || ''}
              onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
              style={s.textarea}
              placeholder="Contá algo sobre vos como jugador, tu estilo de juego, tus personajes favoritos..."
              rows={3}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Email (no editable)</label>
            <div style={s.emailReadOnly}>{user.email}</div>
          </div>

        </div>

        <div style={s.divider} />

        {/* SAVE */}
        <button onClick={save} style={s.saveBtn} disabled={saving}>
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : '✦ Guardar perfil'}
        </button>

        <div style={s.divider} />

        {/* TUS PERSONAJES */}
        <div style={s.charsSection}>
          <div style={s.charsTitle}>Tus personajes</div>
          {loadingChars
            ? <div style={s.charsLoading}>Cargando personajes...</div>
            : characters.length === 0
              ? <div style={s.charsEmpty}>Todavía no tenés personajes asignados a tu email ({user.email}).</div>
              : <div style={s.charsGrid}>
                  {characters.map(char => (
                    <button key={char.id} style={s.charCard} onClick={() => navigate(`/personaje/${char.id}`)}>
                      <span style={{ fontSize: '22px' }}>{char.icon || '⚔️'}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={s.charName}>{char.name}</div>
                        <div style={s.charSub}>{char.race} {char.class} · Lv{char.level}</div>
                      </div>
                    </button>
                  ))}
                </div>
          }
        </div>

        {/* INFO CAMPAÑA ACTUAL */}
        <div style={s.infoBox}>
          <div style={s.infoTitle}>Campaña actual</div>
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <span style={s.infoKey}>Campaña</span>
              <span style={s.infoVal}>Principal (única activa)</span>
            </div>
            <div style={s.infoItem}>
              <span style={s.infoKey}>Rol</span>
              <span style={s.infoVal}>{draft.role || 'Jugador'}</span>
            </div>
            <div style={s.infoItem}>
              <span style={s.infoKey}>Email registrado</span>
              <span style={s.infoVal}>{user.email}</span>
            </div>
          </div>
          <div style={s.infoNote}>
            ✦ En futuras actualizaciones podrás estar en múltiples campañas con distintos personajes y roles.
          </div>
        </div>

      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { maxWidth: '680px', margin: '0 auto', padding: '0 16px' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Cinzel,serif', color: '#7a6030', letterSpacing: '3px', fontSize: '11px' },
  hero: { textAlign: 'center', padding: '40px 20px 24px' },
  heroLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '4px', color: '#5a4820', textTransform: 'uppercase', marginBottom: '8px' },
  heroTitle: { fontFamily: 'Cinzel,serif', fontSize: 'clamp(26px,6vw,42px)', fontWeight: '900', letterSpacing: '6px', color: '#e8c96a', textShadow: '0 0 30px rgba(232,201,106,0.3)' },
  heroSub: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '8px' },
  card: { background: 'rgba(15,12,24,0.9)', border: '1px solid rgba(201,168,76,0.18)', borderTop: '3px solid #c9a84c', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  avatarSection: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
  avatarWrap: { width: '100px', height: '100px', flexShrink: 0, border: '2px solid rgba(201,168,76,0.3)', overflow: 'hidden', position: 'relative' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarPlaceholder: { width: '100%', height: '100%', background: 'rgba(201,168,76,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  avatarInitial: { fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', color: '#c9a84c' },
  avatarName: { fontFamily: 'Cinzel,serif', fontSize: '20px', fontWeight: '700', color: '#e8c96a', letterSpacing: '1px' },
  avatarEmail: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#5a4820', marginTop: '3px' },
  roleBadge: { display: 'inline-block', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', padding: '3px 10px', textTransform: 'uppercase' },
  fileLabel: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: '#7a6030', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(201,168,76,0.15)', padding: '5px 10px', display: 'inline-block', transition: 'all 0.2s' },
  divider: { height: '1px', background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' },
  fields: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none' },
  hint: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18' },
  roleGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  roleBtn: { background: 'transparent', border: '1px solid rgba(201,168,76,0.15)', color: '#5a4820', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px', padding: '8px 14px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  roleBtnActive: { background: 'rgba(201,168,76,0.12)', borderColor: 'rgba(201,168,76,0.5)', color: '#e8c96a' },
  textarea: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', color: '#c8c4bc', fontFamily: 'Crimson Pro,serif', fontSize: '14px', padding: '10px', width: '100%', resize: 'vertical', lineHeight: '1.6', outline: 'none' },
  emailReadOnly: { fontFamily: 'Crimson Pro,serif', fontSize: '14px', color: '#3a2e18', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' },
  saveBtn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '13px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' },
  charsSection: { display: 'flex', flexDirection: 'column', gap: '12px' },
  charsTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase' },
  charsLoading: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820' },
  charsEmpty: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', color: '#5a4820' },
  charsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' },
  charCard: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)', padding: '10px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' },
  charName: { fontFamily: 'Cinzel,serif', fontSize: '13px', fontWeight: '700', color: '#e8c96a' },
  charSub: { fontFamily: 'Crimson Pro,serif', fontSize: '12px', color: '#7a6030', marginTop: '2px' },
  infoBox: { background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  infoTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '3px', color: '#7a6030', textTransform: 'uppercase' },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  infoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(201,168,76,0.06)' },
  infoKey: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: '#5a4820', textTransform: 'uppercase' },
  infoVal: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#9a9080' },
  infoNote: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '12px', color: '#3a2e18', marginTop: '4px' },
};
