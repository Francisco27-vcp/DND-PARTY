// src/App.js
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';

import Nav from './components/Nav';

const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const CharacterSheet = lazy(() => import('./pages/CharacterSheet'));
const Campaign = lazy(() => import('./pages/Campaign'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Notes = lazy(() => import('./pages/Notes'));
const Manual = lazy(() => import('./pages/Manual'));
const Profile = lazy(() => import('./pages/Profile'));
const DMPanel = lazy(() => import('./pages/DMPanel'));

async function ensureUserProfile(user) {
  const profileRef = doc(db, 'profiles', user.uid);
  const snapshot = await getDoc(profileRef);
  if (snapshot.exists()) return;
  await setDoc(profileRef, {
    alias: user.email?.split('@')[0] || '',
    role: 'Jugador',
    bio: '',
    avatar: '',
    email: user.email || '',
    createdAt: serverTimestamp(),
  });
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) ensureUserProfile(u).catch(error => console.error('Error inicializando perfil:', error));
    });
    return unsub;
  }, []);

  if (loading) return <Loader />;

  return (
    <BrowserRouter>
      {user && <Nav user={user} />}
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" />} />
          <Route path="/personaje/:id" element={user ? <CharacterSheet user={user} /> : <Navigate to="/login" />} />
          <Route path="/campana" element={user ? <Campaign user={user} /> : <Navigate to="/login" />} />
          <Route path="/historia" element={user ? <Timeline user={user} /> : <Navigate to="/login" />} />
          <Route path="/notas" element={user ? <Notes user={user} /> : <Navigate to="/login" />} />
          <Route path="/manual" element={user ? <Manual /> : <Navigate to="/login" />} />
          <Route path="/perfil" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
          <Route path="/dm" element={user ? <DMPanel user={user} /> : <Navigate to="/login" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontFamily:'Cinzel,serif', fontSize:'28px', fontWeight:'900', color:'var(--gold-bright)', letterSpacing:'4px', textShadow:'0 0 30px rgba(227,200,120,0.5)' }}>⚔</div>
      <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'4px', color:'var(--gold-dim)', textTransform:'uppercase' }}>Cargando campaña...</div>
    </div>
  );
}

