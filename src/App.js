// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';

import Login from './pages/Login';
import Home from './pages/Home';
import CharacterSheet from './pages/CharacterSheet';
import Campaign from './pages/Campaign';
import Timeline from './pages/Timeline';
import Notes from './pages/Notes';
import Manual from './pages/Manual';
import Profile from './pages/Profile';
import DMPanel from './pages/DMPanel';
import Nav from './components/Nav';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <Loader />;

  return (
    <BrowserRouter>
      {user && <Nav user={user} />}
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

