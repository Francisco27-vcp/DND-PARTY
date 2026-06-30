import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew]       = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found':      'Usuario no encontrado.',
        'auth/wrong-password':      'Contraseña incorrecta.',
        'auth/email-already-in-use':'Ese email ya tiene cuenta.',
        'auth/weak-password':       'Mínimo 6 caracteres.',
        'auth/invalid-credential':  'Email o contraseña incorrectos.',
      };
      setError(msgs[err.code] || 'Error al ingresar.');
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>

      {/* Ambient orb */}
      <div style={s.orb} />

      <div style={s.card} className="fade-in">

        {/* Header */}
        <div style={s.header}>
          <div style={s.gemWrap}>
            <span style={s.gem}>⚔</span>
            <div style={s.gemGlow} />
          </div>
          <h1 style={s.title}>DND PARTY</h1>
          <p style={s.subtitle}>Gestión de Campaña · D&D 5e · 2024</p>
        </div>

        {/* Ornamental divider */}
        <div style={s.ornament}>
          <div style={s.ornamentLine} />
          <span style={s.ornamentGlyph}>✦</span>
          <div style={s.ornamentLine} />
        </div>

        {/* Form */}
        <form onSubmit={handle} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={s.input}
              placeholder="tu@email.com"
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={s.input}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Cargando...' : isNew ? '✦ Crear cuenta' : '✦ Ingresar'}
          </button>
        </form>

        {/* Toggle */}
        <div style={s.ornament}>
          <div style={s.ornamentLine} />
        </div>

        <button onClick={() => { setIsNew(!isNew); setError(''); }} style={s.toggle}>
          {isNew ? '¿Ya tenés cuenta? · Ingresá' : '¿Primera vez? · Creá tu cuenta'}
        </button>

        <p style={s.hint}>Compartí la URL con tu party para que todos creen su cuenta</p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', position: 'relative', overflow: 'hidden',
  },
  orb: {
    position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--panel)',
    border: '1px solid var(--line)',
    borderTop: '2px solid var(--gold)',
    padding: '40px 36px',
    width: '100%', maxWidth: '420px',
    position: 'relative', zIndex: 1,
    boxShadow: '0 0 60px rgba(201,168,76,0.06), 0 20px 40px rgba(0,0,0,0.4)',
  },
  header: { textAlign: 'center', marginBottom: '20px' },
  gemWrap: { position: 'relative', display: 'inline-block', marginBottom: '14px' },
  gem: {
    fontSize: '30px', color: 'var(--gold)',
    textShadow: '0 0 20px rgba(201,164,73,0.8)',
    display: 'block',
  },
  gemGlow: {
    position: 'absolute', inset: '-10px',
    background: 'radial-gradient(circle, rgba(201,164,73,0.2) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  title: {
    fontFamily: 'Cinzel,serif', fontSize: '28px', fontWeight: '900',
    letterSpacing: '6px', color: 'var(--gold-bright)',
    textShadow: '0 0 30px rgba(227,200,120,0.3)',
  },
  subtitle: {
    fontFamily: 'Crimson Pro,serif', fontStyle: 'italic',
    fontSize: '13px', color: 'var(--gold-dim)', marginTop: '6px',
  },
  ornament: {
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '18px 0',
  },
  ornamentLine: {
    flex: 1, height: '1px',
    background: 'linear-gradient(to right, transparent, var(--line), transparent)',
  },
  ornamentGlyph: {
    fontFamily: 'Cinzel,serif', fontSize: '10px',
    color: 'var(--gold-dim)', letterSpacing: '2px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontFamily: 'Cinzel,serif', fontSize: '9px',
    letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase',
  },
  input: {
    background: 'var(--panel-raised)', border: '1px solid var(--line)',
    color: 'var(--parchment)', fontFamily: 'Crimson Pro,serif',
    fontSize: '15px', padding: '11px 14px', outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    fontFamily: 'Crimson Pro,serif', fontSize: '13px',
    color: 'var(--ember)', textAlign: 'center',
    padding: '8px', background: 'rgba(184,100,63,0.08)',
    border: '1px solid rgba(184,100,63,0.2)',
  },
  btn: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
    border: 'none', color: '#1a1206',
    fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '3px',
    padding: '13px', cursor: 'pointer', textTransform: 'uppercase',
    boxShadow: '0 4px 20px rgba(201,164,73,0.2)',
    transition: 'all 0.2s',
  },
  toggle: {
    background: 'transparent', border: 'none',
    color: 'var(--gold-dim)', fontFamily: 'Crimson Pro,serif',
    fontStyle: 'italic', fontSize: '13px',
    cursor: 'pointer', width: '100%', textAlign: 'center',
    padding: '8px', transition: 'color 0.2s',
  },
  hint: {
    fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1.5px',
    color: 'var(--gold-dim)', textAlign: 'center',
    marginTop: '12px', textTransform: 'uppercase', opacity: 0.6,
  },
};
