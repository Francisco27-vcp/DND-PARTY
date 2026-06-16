import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        'auth/user-not-found': 'Usuario no encontrado.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ese email ya tiene cuenta.',
        'auth/weak-password': 'Mínimo 6 caracteres.',
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
      };
      setError(msgs[err.code] || 'Error al ingresar.');
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.gem}>⚔</div>
          <h1 style={s.title}>DND PARTY</h1>
          <p style={s.subtitle}>Gestión de Campaña · D&D 5e · 2024</p>
        </div>
        <form onSubmit={handle} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} placeholder="tu@email.com" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={s.input} placeholder="••••••••" required />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Cargando...' : isNew ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>
        <button onClick={() => { setIsNew(!isNew); setError(''); }} style={s.toggle}>
          {isNew ? '¿Ya tenés cuenta? Ingresá' : '¿Primera vez? Creá tu cuenta'}
        </button>
        <p style={s.hint}>Compartí la URL con tu party para que todos creen su cuenta</p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  card: { background: 'rgba(15,12,24,0.95)', border: '1px solid rgba(201,168,76,0.2)', padding: '40px 32px', width: '100%', maxWidth: '420px' },
  header: { textAlign: 'center', marginBottom: '28px' },
  gem: { fontSize: '28px', color: '#c9a84c', display: 'block', marginBottom: '12px' },
  title: { fontFamily: 'Cinzel,serif', fontSize: '26px', fontWeight: '900', letterSpacing: '4px', color: '#e8c96a' },
  subtitle: { fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '14px', color: '#7a6030', marginTop: '6px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: '#7a6030', textTransform: 'uppercase' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.2)', color: '#f5f0e8', fontFamily: 'Crimson Pro,serif', fontSize: '15px', padding: '10px 14px', outline: 'none' },
  error: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: '#c06060', textAlign: 'center' },
  btn: { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', color: '#e8c96a', fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '2px', padding: '12px', cursor: 'pointer', textTransform: 'uppercase' },
  toggle: { background: 'transparent', border: 'none', color: '#5a4820', fontFamily: 'Crimson Pro,serif', fontStyle: 'italic', fontSize: '13px', cursor: 'pointer', width: '100%', textAlign: 'center', padding: '8px' },
  hint: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', color: '#3a2e18', textAlign: 'center', marginTop: '16px', textTransform: 'uppercase' },
};
