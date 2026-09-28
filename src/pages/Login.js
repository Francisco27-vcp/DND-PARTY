import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import AppIcon from '../components/AppIcon';
import AppBrandMark from '../components/AppBrandMark';
import '../styles/Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'Usuario no encontrado.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ese email ya tiene cuenta.',
        'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
      };
      setError(messages[err.code] || 'No pudimos abrir la mesa. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-atmosphere" aria-hidden="true" />

      <section className="login-story fade-in">
        <div className="login-brand-lockup">
          <AppBrandMark className="login-brand-mark" />
          <div>
            <p className="login-brand-kicker">Rakets Campaign</p>
            <p className="login-brand-name">DND Party</p>
          </div>
        </div>

        <div className="login-story-copy">
          <p className="login-eyebrow"><span /> Campaña activa · D&amp;D 5e 2024</p>
          <h1>La mesa<br />está lista.</h1>
          <p className="login-lead">
            Una única sala de mando para narrar, explorar y mantener a toda la party
            dentro de la misma historia.
          </p>
        </div>

        <div className="login-status-row" aria-label="Funciones principales">
          <div><b>01</b><span>Campaña viva</span></div>
          <div><b>02</b><span>Mesa táctica</span></div>
          <div><b>03</b><span>Party conectada</span></div>
        </div>
      </section>

      <section className="login-access fade-in">
        <div className="login-card">
          <div className="login-card-seal" aria-hidden="true"><span><AppIcon name="swords" size={19} /></span></div>
          <p className="login-card-kicker">Acceso a la campaña</p>
          <h2>{isNew ? 'Unite a la party' : 'Volvé a la mesa'}</h2>
          <p className="login-card-intro">
            {isNew
              ? 'Creá tus credenciales para entrar al mundo de Rakets.'
              : 'Ingresá con tus credenciales para continuar la aventura.'}
          </p>

          <div className="login-divider"><span>✦</span></div>

          <form onSubmit={handle} className="login-form">
            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="login-field">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={isNew ? 'new-password' : 'current-password'}
                required
              />
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-primary" type="submit" disabled={loading}>
              <span>{loading ? 'Abriendo la mesa…' : isNew ? 'Crear cuenta' : 'Ingresar a la campaña'}</span>
              {!loading && <b aria-hidden="true">→</b>}
            </button>
          </form>

          <button
            className="login-toggle"
            type="button"
            onClick={() => { setIsNew(!isNew); setError(''); }}
          >
            {isNew ? 'Ya tengo una cuenta · Ingresar' : 'Primera vez · Crear una cuenta'}
          </button>

          <p className="login-footnote"><span /> Acceso administrado con Firebase</p>
        </div>
      </section>
    </main>
  );
}
