// src/pages/dm/TabMapa.js — Mapas interactivos v2
import React, { useEffect, useState, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { deleteImageByUrl, uploadImage } from '../../lib/uploadImage';
import { createPublicMapSnapshot } from '../../lib/liveSession';
import { createCharacterToken, getTacticalVisual, hydrateMapCharacters, withLocalTokenArtwork } from '../../lib/tacticalTokens';
import AppIcon from '../../components/AppIcon';
import GameIcon from '../../components/GameIcon';
import GAME_ICONS from '../../data/gameicons';

const CATS = [
  { id: 'pj',       label: 'PJs',       icon: 'user' },
  { id: 'monstruo', label: 'Monstruos', icon: 'swords' },
  { id: 'trampa',   label: 'Trampas',   icon: 'shield' },
  { id: 'objeto',   label: 'Objetos',   icon: 'crown' },
  { id: 'custom',   label: 'Custom',    icon: 'sparkles' },
];

const TOKENS = [
  // PJs
  { id: 'barbaro',    cat: 'pj',       emoji: '🪓', label: 'Bárbaro',    color: '#c84040' },
  { id: 'bardo',      cat: 'pj',       emoji: '🎵', label: 'Bardo',      color: '#9a6aaa' },
  { id: 'clerigo',    cat: 'pj',       emoji: '✝', label: 'Clérigo',    color: '#d4a0d4' },
  { id: 'druida',     cat: 'pj',       emoji: '🌿', label: 'Druida',     color: '#4a8a4a' },
  { id: 'explorador', cat: 'pj',       emoji: '🏹', label: 'Explorador', color: '#7a9a4a' },
  { id: 'guerrero',   cat: 'pj',       emoji: '⚔', label: 'Guerrero',   color: '#8a7a5a' },
  { id: 'mago',       cat: 'pj',       emoji: '🔮', label: 'Mago',       color: '#4a7fa5' },
  { id: 'monje',      cat: 'pj',       emoji: '🥷', label: 'Monje',      color: '#c9a84c' },
  { id: 'paladin',    cat: 'pj',       emoji: '🛡', label: 'Paladín',    color: '#f0d060' },
  { id: 'picaro',     cat: 'pj',       emoji: '🗡', label: 'Pícaro',     color: '#7a7a9a' },
  { id: 'hechicero',  cat: 'pj',       emoji: '⚡', label: 'Hechicero', color: '#a040c0' },
  { id: 'warlock',    cat: 'pj',       emoji: '🌑', label: 'Warlock',   color: '#5a2080' },
  { id: 'aasimar',    cat: 'pj',       emoji: '😇', label: 'Aasimar',   color: '#e0d080' },
  { id: 'tiefling',   cat: 'pj',       emoji: '😈', label: 'Tiefling',  color: '#a04060' },
  // Monstruos
  { id: 'dragon-r',   cat: 'monstruo', emoji: '🐉', label: 'Dragón Rojo',  color: '#8b1a1a' },
  { id: 'dragon-v',   cat: 'monstruo', emoji: '🦎', label: 'Dragón Verde', color: '#2a6a2a' },
  { id: 'dragon-b',   cat: 'monstruo', emoji: '🐲', label: 'Dragón Azul',  color: '#2040a0' },
  { id: 'zombi',      cat: 'monstruo', emoji: '🧟', label: 'Zombi',        color: '#5a7a4a' },
  { id: 'esqueleto',  cat: 'monstruo', emoji: '💀', label: 'Esqueleto',    color: '#b0b0b0' },
  { id: 'vampiro',    cat: 'monstruo', emoji: '🧛', label: 'Vampiro',      color: '#6a1a4a' },
  { id: 'lobo',       cat: 'monstruo', emoji: '🐺', label: 'Lobo',         color: '#7a6a5a' },
  { id: 'arana',      cat: 'monstruo', emoji: '🕷', label: 'Araña',        color: '#3a2a1a' },
  { id: 'goblin',     cat: 'monstruo', emoji: '👺', label: 'Goblin',       color: '#4a6a2a' },
  { id: 'orco',       cat: 'monstruo', emoji: '👹', label: 'Orco',         color: '#5a3a2a' },
  { id: 'troll',      cat: 'monstruo', emoji: '🗿', label: 'Troll',        color: '#5a7a5a' },
  { id: 'golem',      cat: 'monstruo', emoji: '🪨', label: 'Gólem',        color: '#8a8a8a' },
  { id: 'banshee',    cat: 'monstruo', emoji: '👻', label: 'Banshee',      color: '#a0c0e0' },
  { id: 'lich',       cat: 'monstruo', emoji: '☠', label: 'Lich',         color: '#7a1a9a' },
  { id: 'mimic',      cat: 'monstruo', emoji: '📦', label: 'Mimic',        color: '#8a6a2a' },
  { id: 'beholder',   cat: 'monstruo', emoji: '👁', label: 'Beholder',     color: '#4a2a8a' },
  { id: 'el-fuego',   cat: 'monstruo', emoji: '🔥', label: 'El. Fuego',    color: '#c04000' },
  { id: 'el-agua',    cat: 'monstruo', emoji: '💧', label: 'El. Agua',     color: '#2060a0' },
  { id: 'el-aire',    cat: 'monstruo', emoji: '🌪', label: 'El. Aire',     color: '#80a0c0' },
  { id: 'medusa',     cat: 'monstruo', emoji: '🐍', label: 'Medusa',       color: '#2a6a4a' },
  { id: 'hipogrife',  cat: 'monstruo', emoji: '🦅', label: 'Hipogrife',    color: '#8a6a2a' },
  { id: 'gargola',    cat: 'monstruo', emoji: '🦇', label: 'Gárgola',      color: '#5a5a7a' },
  { id: 'demonio',    cat: 'monstruo', emoji: '😈', label: 'Demonio',      color: '#8b1a1a' },
  { id: 'gigante',    cat: 'monstruo', emoji: '🏔', label: 'Gigante',      color: '#7a5a4a' },
  { id: 'kraken',     cat: 'monstruo', emoji: '🦑', label: 'Kraken',       color: '#204060' },
  { id: 'wyvern',     cat: 'monstruo', emoji: '🐊', label: 'Wyvern',       color: '#3a5a2a' },
  { id: 'npc-aliado', cat: 'monstruo', emoji: '🧑', label: 'NPC aliado',   color: '#a08060' },
  // Trampas
  { id: 't-flecha',   cat: 'trampa',   emoji: '🏹', label: 'Flechas',     color: '#c07020' },
  { id: 't-foso',     cat: 'trampa',   emoji: '⬛', label: 'Foso',        color: '#3a2a1a' },
  { id: 't-espinas',  cat: 'trampa',   emoji: '🌵', label: 'Espinas',     color: '#4a6a2a' },
  { id: 't-gas',      cat: 'trampa',   emoji: '💨', label: 'Gas',         color: '#6a9a4a' },
  { id: 't-fuego',    cat: 'trampa',   emoji: '🔥', label: 'Llamas',      color: '#c04000' },
  { id: 't-runa',     cat: 'trampa',   emoji: '🔯', label: 'Runa',        color: '#6a2a9a' },
  { id: 't-roca',     cat: 'trampa',   emoji: '🪨', label: 'Roca',        color: '#7a7a7a' },
  { id: 't-hielo',    cat: 'trampa',   emoji: '❄', label: 'Hielo',       color: '#80c0e0' },
  { id: 't-aguja',    cat: 'trampa',   emoji: '📌', label: 'Aguja',       color: '#c04040' },
  { id: 't-rayo',     cat: 'trampa',   emoji: '⚡', label: 'Rayo',        color: '#c0a000' },
  { id: 't-pendulo',  cat: 'trampa',   emoji: '⚔', label: 'Péndulo',     color: '#7a6a5a' },
  // Objetos
  { id: 'cofre',      cat: 'objeto',   emoji: '📦', label: 'Cofre',       color: '#c9a84c' },
  { id: 'tesoro',     cat: 'objeto',   emoji: '💎', label: 'Tesoro',      color: '#4a7fa5' },
  { id: 'puerta',     cat: 'objeto',   emoji: '🚪', label: 'Puerta',      color: '#8a6a4a' },
  { id: 'escalera',   cat: 'objeto',   emoji: '⬆', label: 'Escalera',    color: '#7a7a7a' },
  { id: 'altar',      cat: 'objeto',   emoji: '🕯', label: 'Altar',       color: '#c0a060' },
  { id: 'portal',     cat: 'objeto',   emoji: '🌀', label: 'Portal',      color: '#4060c0' },
  { id: 'inicio',     cat: 'objeto',   emoji: '🟢', label: 'Inicio',      color: '#4a8a4a' },
  { id: 'objetivo',   cat: 'objeto',   emoji: '🎯', label: 'Objetivo',    color: '#c84040' },
  { id: 'pdi',        cat: 'objeto',   emoji: '📍', label: 'PDI',         color: '#c07a20' },
  { id: 'secreto',    cat: 'objeto',   emoji: '❓', label: 'Secreto',     color: '#6a6a9a' },
  { id: 'barril',     cat: 'objeto',   emoji: '🛢', label: 'Barril',      color: '#8a6a4a' },
  { id: 'campamento', cat: 'objeto',   emoji: '⛺', label: 'Campamento',  color: '#7a5a3a' },
  { id: 'caido',      cat: 'objeto',   emoji: '💀', label: 'Caído',       color: '#8b1a1a' },
];

const SIZES = [
  { id: 1, label: 'Tiny', px: 28 },
  { id: 2, label: 'S',    px: 36 },
  { id: 3, label: 'M',    px: 48 },
  { id: 4, label: 'L',    px: 64 },
  { id: 5, label: 'XL',   px: 88 },
  { id: 6, label: 'XXL',  px: 120 },
];

const DEFAULT_VP = { t: 0, r: 0, b: 0, l: 0 };
const FOG_COLS = 24;
const FOG_ROWS = 16;

function tokenMonogram(label = 'Token') {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function TabMapa() {
  const [maps, setMaps] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // Placement
  const [mode, setMode] = useState('select');
  const [selCat, setSelCat] = useState('pj');
  const [selTokenId, setSelTokenId] = useState('guerrero');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [tokenLabel, setTokenLabel] = useState('');
  const [tokenSize, setTokenSize] = useState(3);
  const [customImg, setCustomImg] = useState(null);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [fogAction, setFogAction] = useState('hide');

  // Popover
  const [popover, setPopover] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSize, setEditSize] = useState(3);

  // Viewport
  const [showVp, setShowVp] = useState(false);
  const [vp, setVp] = useState(DEFAULT_VP);

  const mapRef = useRef(null);
  const fileRef = useRef(null);
  const customFileRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const [, setHistoryVersion] = useState(0);

  const activeMap = maps.find(m => m.id === activeMapId) || null;

  useEffect(() => {
    setVp(activeMap?.viewport || DEFAULT_VP);
    undoRef.current = [];
    redoRef.current = [];
    setHistoryVersion(value => value + 1);
  }, [activeMapId]); // eslint-disable-line

  useEffect(() => {
    const q = query(collection(db, 'maps'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaps(list);
      setActiveMapId(prev => prev || (list[0]?.id ?? null));
    }, () => {});
  }, []);

  useEffect(() => onSnapshot(
    collection(db, 'characters'),
    snap => {
      const list = snap.docs.map(item => ({ id: item.id, ...item.data() }));
      setCharacters(list);
      setSelectedCharacterId(previous => previous || list[0]?.id || '');
    },
    () => {},
  ), []);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, `maps/${Date.now()}_${file.name}`);
      const ref = await addDoc(collection(db, 'maps'), {
        title: uploadTitle.trim(), imageUrl: url,
        visibleToParty: false, tokens: [],
        viewport: DEFAULT_VP, createdAt: serverTimestamp(),
      });
      setActiveMapId(ref.id);
      setUploadTitle('');
      setShowUpload(false);
    } catch (err) { console.error(err); }
    setUploading(false);
  };

  const toggleMapVisible = async () => {
    if (!activeMap) return;
    const nextVisibility = !activeMap.visibleToParty;
    const batch = writeBatch(db);
    batch.update(doc(db, 'maps', activeMap.id), { visibleToParty: nextVisibility });
    const publicRef = doc(db, 'public_maps', activeMap.id);
    if (nextVisibility) {
      batch.set(publicRef, {
        ...createPublicMapSnapshot(hydrateMapCharacters(activeMap, characters)),
        publishedAt: serverTimestamp(),
      });
    } else {
      batch.delete(publicRef);
    }
    await batch.commit();
  };

  const editableState = (map) => ({
    tokens: map?.tokens || [],
    fog: map?.fog || { enabled: false, cols: FOG_COLS, rows: FOG_ROWS, hidden: [] },
    viewport: map?.viewport || DEFAULT_VP,
  });

  const commitMapPatch = async (patch) => {
    if (!activeMap) return;
    undoRef.current.push(editableState(activeMap));
    if (undoRef.current.length > 40) undoRef.current.shift();
    redoRef.current = [];
    setHistoryVersion(value => value + 1);
    await updateDoc(doc(db, 'maps', activeMap.id), patch);
  };

  const restoreHistory = async (direction) => {
    if (!activeMap) return;
    const source = direction === 'undo' ? undoRef : redoRef;
    const target = direction === 'undo' ? redoRef : undoRef;
    const state = source.current.pop();
    if (!state) return;
    target.current.push(editableState(activeMap));
    setHistoryVersion(value => value + 1);
    setVp(state.viewport || DEFAULT_VP);
    await updateDoc(doc(db, 'maps', activeMap.id), state);
  };

  const deleteMap = async (id) => {
    const target = maps.find(map => map.id === id);
    if (!window.confirm(`¿Eliminar el mapa "${target?.title || 'seleccionado'}" y sus imágenes?`)) return;
    await deleteDoc(doc(db, 'maps', id));
    await deleteDoc(doc(db, 'public_maps', id)).catch(() => {});
    const imageUrls = [target?.imageUrl, ...(target?.tokens || []).map(token => token.imageUrl)].filter(Boolean);
    await Promise.allSettled([...new Set(imageUrls)].map(deleteImageByUrl));
    if (activeMapId === id) setActiveMapId(maps.find(m => m.id !== id)?.id ?? null);
  };

  const saveVp = (newVp) => activeMap && commitMapPatch({ viewport: newVp });

  const handleCustomImg = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCustom(true);
    try { setCustomImg(await uploadImage(file, `tokens/${Date.now()}_${file.name}`)); }
    catch (err) { console.error(err); }
    setUploadingCustom(false);
  };

  const handleMapClick = async (e) => {
    if (!activeMap || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(2));
    const y = parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(2));
    if (mode === 'fog') {
      const cellX = Math.max(0, Math.min(FOG_COLS - 1, Math.floor((x / 100) * FOG_COLS)));
      const cellY = Math.max(0, Math.min(FOG_ROWS - 1, Math.floor((y / 100) * FOG_ROWS)));
      const key = `${cellX}:${cellY}`;
      const hidden = new Set(activeMap.fog?.hidden || []);
      if (fogAction === 'hide') hidden.add(key); else hidden.delete(key);
      await commitMapPatch({
        fog: { enabled: true, cols: FOG_COLS, rows: FOG_ROWS, hidden: [...hidden] },
      });
      return;
    }
    if (mode !== 'place') return;
    const selectedCharacter = selCat === 'pj'
      ? characters.find(character => character.id === selectedCharacterId)
      : null;
    const def = TOKENS.find(t => t.id === selTokenId) || TOKENS[0];
    const visual = getTacticalVisual({ ...def, cat: selCat });
    const baseToken = {
      id: uid(), x, y, size: tokenSize,
      label: tokenLabel.trim() || def.label,
    };
    const newToken = selectedCharacter
      ? createCharacterToken(selectedCharacter, baseToken)
      : {
        ...baseToken,
        typeId: selTokenId,
        cat: selCat,
        entityKind: visual.entityKind,
        symbolKey: visual.symbolKey,
        color: def.color || visual.color,
        visibleToParty: selCat !== 'trampa',
        imageUrl: selCat === 'custom' ? customImg : null,
      };
    await commitMapPatch({ tokens: [...(activeMap.tokens || []), newToken] });
  };

  const setAllFog = async (hidden) => {
    if (!activeMap) return;
    const cells = hidden
      ? Array.from({ length: FOG_ROWS }, (_, y) => Array.from({ length: FOG_COLS }, (__, x) => `${x}:${y}`)).flat()
      : [];
    await commitMapPatch({
      fog: { enabled: true, cols: FOG_COLS, rows: FOG_ROWS, hidden: cells },
    });
  };

  const moveToken = async (event, token) => {
    if (!activeMap || !mapRef.current || mode !== 'select') return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    const tokens = (activeMap.tokens || []).map(item => item.id === token.id
      ? { ...item, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
      : item);
    await commitMapPatch({ tokens });
  };

  const nudgeToken = async (event, token) => {
    if (mode !== 'select' || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 2 : 0.5;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const nextX = Math.max(0, Math.min(100, Number(token.x || 0) + dx));
    const nextY = Math.max(0, Math.min(100, Number(token.y || 0) + dy));
    const tokens = (activeMap.tokens || []).map(item => item.id === token.id
      ? { ...item, x: Number(nextX.toFixed(2)), y: Number(nextY.toFixed(2)) }
      : item);
    await commitMapPatch({ tokens });
  };

  const openPopover = (e, token) => {
    if (mode === 'place') return;
    e.stopPropagation();
    setPopover(token);
    setEditLabel(token.label);
    setEditSize(token.size || 3);
  };

  const saveTokenField = async (field, value) => {
    if (!activeMap || !popover) return;
    const updated = (activeMap.tokens || []).map(t => t.id === popover.id ? { ...t, [field]: value } : t);
    await commitMapPatch({ tokens: updated });
    setPopover(p => p ? { ...p, [field]: value } : null);
  };

  const deleteToken = async (id) => {
    if (!activeMap) return;
    await commitMapPatch({ tokens: (activeMap.tokens || []).filter(t => t.id !== id) });
    setPopover(null);
  };

  const catTokens = TOKENS.filter(t => t.cat === selCat);
  const displayMap = hydrateMapCharacters(activeMap, characters);
  const tacticalIcon = token => GAME_ICONS[getTacticalVisual(token).symbolKey] || GAME_ICONS.sword;

  return (
    <div style={s.wrap}>
      {/* ── SIDEBAR ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <span style={s.sidebarTitle}>Mapas</span>
          <button style={s.addBtn} onClick={() => setShowUpload(v => !v)}>{showUpload ? '✕' : '+ Nuevo'}</button>
        </div>
        {showUpload && (
          <form onSubmit={handleUpload} style={s.uploadForm}>
            <input style={s.input} placeholder="Título del mapa" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} required />
            <input ref={fileRef} type="file" accept="image/*" style={s.fileInput} required />
            <button type="submit" style={s.submitBtn} disabled={uploading}>{uploading ? 'Subiendo...' : '↑ Subir mapa'}</button>
          </form>
        )}
        <div style={s.mapList}>
          {maps.length === 0 && <p style={s.emptyMsg}>Sin mapas. Subí uno.</p>}
          {maps.map(m => (
            <div key={m.id} style={{ ...s.mapItem, ...(m.id === activeMapId ? s.mapItemActive : {}) }} onClick={() => setActiveMapId(m.id)}>
              <div style={s.mapItemInfo}>
                <span style={s.mapItemTitle}>{m.title}</span>
                <span style={s.mapItemMeta}>
                  {(m.tokens || []).length} tokens ·{' '}
                  <span style={{ color: m.visibleToParty ? '#65c260' : 'var(--gold-dim)' }}>
                    <AppIcon name={m.visibleToParty ? 'eye' : 'lock'} size={10} /> {m.visibleToParty ? 'Visible' : 'Oculto'}
                  </span>
                </span>
              </div>
              <button style={s.deleteMapBtn} onClick={e => { e.stopPropagation(); deleteMap(m.id); }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={s.main}>
        {!activeMap ? (
          <div style={s.emptyCanvas}>
            <span style={{ opacity: 0.3 }}><AppIcon name="map" size={48} /></span>
            <p style={s.emptyMsg}>Seleccioná o subí un mapa</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={s.toolbar}>
              <span style={s.mapTitle}>{activeMap.title}</span>
              <div style={s.toolbarRight}>
                <button type="button" title="Deshacer" aria-label="Deshacer" style={s.toolBtn}
                  disabled={undoRef.current.length === 0} onClick={() => restoreHistory('undo')}>
                  <AppIcon name="undo" size={14} />
                </button>
                <button type="button" title="Rehacer" aria-label="Rehacer" style={s.toolBtn}
                  disabled={redoRef.current.length === 0} onClick={() => restoreHistory('redo')}>
                  <AppIcon name="redo" size={14} />
                </button>
                <button style={{ ...s.toolBtn, ...(activeMap.visibleToParty ? s.toolBtnGreen : {}) }} onClick={toggleMapVisible}>
                  <AppIcon name={activeMap.visibleToParty ? 'eye' : 'lock'} size={13} /> {activeMap.visibleToParty ? 'Visible' : 'Oculto'}
                </button>
                <button style={{ ...s.toolBtn, ...(showVp ? s.toolBtnGold : {}) }} onClick={() => setShowVp(v => !v)}>
                  <AppIcon name="scissors" size={13} /> Revelar zona
                </button>
                <button style={{ ...s.toolBtn, ...(mode === 'place' ? s.toolBtnGold : {}) }}
                  onClick={() => { setMode(m => m === 'place' ? 'select' : 'place'); setPopover(null); }}>
                  <AppIcon name={mode === 'place' ? 'close' : 'plus'} size={13} /> {mode === 'place' ? 'Cancelar' : 'Token'}
                </button>
                <button style={{ ...s.toolBtn, ...(mode === 'fog' ? s.toolBtnGold : {}) }}
                  onClick={() => { setMode(m => m === 'fog' ? 'select' : 'fog'); setPopover(null); }}>
                  <AppIcon name={mode === 'fog' ? 'close' : 'grid'} size={13} /> {mode === 'fog' ? 'Cerrar niebla' : 'Niebla por celdas'}
                </button>
                {(activeMap.tokens || []).length > 0 && (
                  <button style={{ ...s.toolBtn, color: 'rgba(224,80,80,0.7)', borderColor: 'rgba(224,80,80,0.3)' }}
                    onClick={() => {
                      if (window.confirm('¿Eliminar todas las fichas de este mapa? Podés deshacer esta acción.')) commitMapPatch({ tokens: [] });
                    }}>
                    <AppIcon name="trash" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Viewport controls */}
            {showVp && (
              <div style={s.vpPanel}>
                <span style={s.vpTitle}>Niebla de guerra — arrastrá para revelar/ocultar áreas a la party</span>
                <div style={s.vpSliders}>
                  {[
                    { key: 't', label: '↑ Ocultar arriba' },
                    { key: 'b', label: '↓ Ocultar abajo' },
                    { key: 'l', label: '← Ocultar izq.' },
                    { key: 'r', label: '→ Ocultar der.' },
                  ].map(({ key, label }) => (
                    <div key={key} style={s.vpRow}>
                      <span style={s.vpLbl}>{label}</span>
                      <input type="range" min="0" max="90" value={vp[key] || 0}
                        style={{ flex: 1, accentColor: 'var(--gold-2)' }}
                        onChange={e => setVp(p => ({ ...p, [key]: Number(e.target.value) }))}
                        onMouseUp={() => saveVp(vp)}
                        onTouchEnd={() => saveVp(vp)}
                      />
                      <span style={s.vpVal}>{vp[key] || 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'fog' && (
              <div style={s.vpPanel}>
                <span style={s.vpTitle}>Niebla por celdas — cada clic modifica una sola zona y se sincroniza con el proyector</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button style={{ ...s.toolBtn, ...(fogAction === 'hide' ? s.toolBtnGold : {}) }} onClick={() => setFogAction('hide')}>Ocultar</button>
                  <button style={{ ...s.toolBtn, ...(fogAction === 'reveal' ? s.toolBtnGreen : {}) }} onClick={() => setFogAction('reveal')}>Revelar</button>
                  <button style={s.toolBtn} onClick={() => setAllFog(true)}>Cubrir todo</button>
                  <button style={s.toolBtn} onClick={() => setAllFog(false)}>Revelar todo</button>
                </div>
              </div>
            )}

            {/* Placement palette */}
            {mode === 'place' && (
              <div style={s.palette}>
                <div style={s.catTabs}>
                  {CATS.map(c => (
                    <button key={c.id}
                      style={{ ...s.catTab, ...(selCat === c.id ? s.catTabActive : {}) }}
                      onClick={() => { setSelCat(c.id); const first = TOKENS.find(t => t.cat === c.id); if (first) setSelTokenId(first.id); }}>
                      <AppIcon name={c.icon} size={14} /> {c.label}
                    </button>
                  ))}
                </div>

                {selCat === 'custom' ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '4px 0' }}>
                    {customImg
                      ? <img src={customImg} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--line)' }} />
                      : <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--line)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AppIcon name="sparkles" size={20} /></div>
                    }
                    <label style={{ ...s.catTab, cursor: 'pointer' }}>
                      {uploadingCustom ? 'Subiendo...' : 'Subir imagen'}
                      <input ref={customFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCustomImg} />
                    </label>
                    {customImg && <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '11px', color: '#65c260' }}>Lista. Clic en el mapa.</span>}
                  </div>
                ) : selCat === 'pj' && characters.length > 0 ? (
                  <div className="tactical-character-picker">
                    {characters.map(character => {
                      const preview = createCharacterToken(character);
                      const icon = tacticalIcon(preview);
                      const hpPct = Math.max(0, Math.min(100, (preview.hp / Math.max(1, preview.hpMax)) * 100));
                      return (
                        <button key={character.id} type="button"
                          className={`tactical-character-pick${selectedCharacterId === character.id ? ' is-selected' : ''}`}
                          style={{ '--token-color': preview.color }}
                          onClick={() => setSelectedCharacterId(character.id)}>
                          {preview.imageUrl
                            ? <img src={preview.imageUrl} alt="" />
                            : <span className="tactical-character-symbol"><GameIcon {...icon} size={25} color={preview.color} /></span>}
                          <span className="tactical-character-copy">
                            <strong>{preview.label}</strong>
                            <small>{preview.className} · Nivel {preview.level}</small>
                            <i><b style={{ width: `${hpPct}%` }} /></i>
                            <small>{preview.hp}/{preview.hpMax} PG</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={s.tokenGrid}>
                    {catTokens.map(t => (
                      <button key={t.id} className={`token-pick-button token-pick-button--${t.cat}`}
                        style={{ ...s.tokenPickBtn, ...(selTokenId === t.id ? { borderColor: t.color, background: t.color + '22' } : {}) }}
                        onClick={() => setSelTokenId(t.id)}>
                        {withLocalTokenArtwork(t).imageUrl
                          ? <img className="token-palette-art" style={{ '--token-color': t.color }} src={withLocalTokenArtwork(t).imageUrl} alt="" />
                          : <span className="token-palette-monogram" style={{ '--token-color': t.color }}><GameIcon {...tacticalIcon(t)} size={18} color={t.color} /></span>}
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '7px', color: selTokenId === t.id ? t.color : 'var(--gold-dim)', textTransform: 'uppercase', marginTop: '2px' }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div style={s.placeOpts}>
                  <span style={s.vpLbl}>Tamano:</span>
                  {SIZES.map(sz => (
                    <button key={sz.id} style={{ ...s.sizeBtn, ...(tokenSize === sz.id ? s.sizeBtnOn : {}) }} onClick={() => setTokenSize(sz.id)}>{sz.label}</button>
                  ))}
                  <input style={{ ...s.input, width: '130px', fontSize: '12px', padding: '4px 8px', marginLeft: '6px' }}
                    placeholder="Etiqueta" value={tokenLabel} onChange={e => setTokenLabel(e.target.value)} />
                  <span style={{ fontFamily: 'Crimson Pro,serif', fontSize: '11px', color: 'var(--gold-dim)', fontStyle: 'italic', marginLeft: 'auto' }}>
                    Clic en el mapa
                  </span>
                </div>
              </div>
            )}

            {/* Map */}
            <div style={s.mapWrap}>
              <div ref={mapRef} style={{ ...s.mapCanvas, cursor: ['place', 'fog'].includes(mode) ? 'crosshair' : 'default' }} onClick={handleMapClick}>
                <img src={activeMap.imageUrl} alt={activeMap.title} style={s.mapImg} draggable={false} />

                {activeMap.fog?.enabled ? (activeMap.fog.hidden || []).map(key => {
                  const [x, y] = key.split(':').map(Number);
                  return <div key={key} className="map-fog-cell" style={{ ...s.fog, left: `${x / FOG_COLS * 100}%`, top: `${y / FOG_ROWS * 100}%`, width: `${100 / FOG_COLS + 0.08}%`, height: `${100 / FOG_ROWS + 0.08}%`, opacity: 0.58 }} />;
                }) : <>
                  {vp.t > 0 && <div style={{ ...s.fog, top: 0, left: 0, right: 0, height: vp.t + '%' }} />}
                  {vp.b > 0 && <div style={{ ...s.fog, bottom: 0, left: 0, right: 0, height: vp.b + '%' }} />}
                  {vp.l > 0 && <div style={{ ...s.fog, top: vp.t + '%', bottom: vp.b + '%', left: 0, width: vp.l + '%' }} />}
                  {vp.r > 0 && <div style={{ ...s.fog, top: vp.t + '%', bottom: vp.b + '%', right: 0, width: vp.r + '%' }} />}
                </>}

                {(displayMap.tokens || []).map(token => {
                  const sz = SIZES.find(s => s.id === (token.size || 3)) || SIZES[2];
                  const isHidden = token.visibleToParty === false;
                  const isCharacter = token.entityKind === 'character';
                  const hasPortraitCard = isCharacter || Boolean(token.imageUrl);
                  const icon = tacticalIcon(token);
                  const hpPct = Math.max(0, Math.min(100, (Number(token.hp) / Math.max(1, Number(token.hpMax))) * 100));
                  return (
                    <div key={token.id} className={`map-editor-token${isCharacter ? ' map-editor-token--character' : ''}${hasPortraitCard && !isCharacter ? ' map-editor-token--illustrated' : ''}${!isCharacter && token.cat ? ` map-editor-token--${token.cat}` : ''}`}
                      data-token-id={token.typeId || 'custom'}
                      role="button"
                      tabIndex={0}
                      aria-label={`${token.label || 'Ficha'}${isCharacter ? `, ${token.className || 'personaje'}, ${token.hp || 0} de ${token.hpMax || 0} puntos de golpe` : ''}${isHidden ? ', oculta para la party' : ''}. Enter para editar; flechas para mover.`}
                      draggable={mode === 'select'}
                      onDragEnd={event => moveToken(event, token)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPopover(event, token);
                          return;
                        }
                        nudgeToken(event, token);
                      }}
                      style={{
                        position: 'absolute', left: token.x + '%', top: token.y + '%',
                        transform: 'translate(-50%, -50%)', width: (hasPortraitCard ? Math.max(94, sz.px * 1.9) : sz.px) + 'px', height: (hasPortraitCard ? Math.max(50, sz.px) : sz.px) + 'px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                        border: '2px solid ' + token.color, borderRadius: hasPortraitCard ? '11px' : '50%',
                        background: token.color + '33', backdropFilter: 'blur(4px)',
                        zIndex: popover && popover.id === token.id ? 30 : 10, cursor: 'pointer',
                        padding: '2px 3px', opacity: isHidden ? 0.55 : 1,
                        outline: isHidden ? '2px dashed rgba(255,80,80,0.5)' : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={e => openPopover(e, token)}>
                      <span className="map-editor-token-portrait">
                        {token.imageUrl
                          ? <img className="map-editor-token-art" src={token.imageUrl} alt={token.label} />
                          : <GameIcon {...icon} size={Math.max(18, sz.px * 0.42)} color={token.color || 'f7dd78'} />}
                      </span>
                      {hasPortraitCard ? (
                        <span className="map-editor-token-card-copy">
                          <strong>{token.label}</strong>
                          {isCharacter ? <>
                            <small><GameIcon {...icon} size={10} color={token.color || 'f7dd78'} /> {token.className} · N{token.level}</small>
                            <i><b style={{ width: `${hpPct}%` }} /></i>
                            <small>{token.hp}/{token.hpMax} PG · CA {token.armorClass || '—'}</small>
                          </> : <small>{token.cat === 'monstruo' ? 'Criatura' : 'Ficha ilustrada'}</small>}
                        </span>
                      ) : <span className="map-editor-token-label" style={{ fontSize: Math.max(7, Math.round(sz.px * 0.15)) + 'px', color: token.color }}>{token.label}</span>}
                      {isHidden && <span className="map-editor-token-lock"><AppIcon name="lock" size={10} /></span>}
                    </div>
                  );
                })}

                {popover && (
                  <div
                    style={{
                      position: 'absolute', left: popover.x + '%',
                      transform: popover.y > 65 ? 'translate(-50%, calc(-100% - 16px))' : 'translate(-50%, 16px)',
                      top: popover.y + '%',
                      zIndex: 50, minWidth: '200px',
                      background: 'rgba(10,8,4,0.97)', border: '1px solid ' + popover.color,
                      borderRadius: '10px', padding: '12px',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
                    }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      {popover.imageUrl
                        ? <img src={popover.imageUrl} style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                        : <GameIcon {...tacticalIcon(popover)} size={22} color={popover.color || 'f7dd78'} />}
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: popover.color, flex: 1 }}>{popover.label}</span>
                      <button style={s.popClose} onClick={() => setPopover(null)}>x</button>
                    </div>
                    <input style={{ ...s.input, marginBottom: '8px', fontSize: '12px', padding: '5px 8px' }}
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => saveTokenField('label', editLabel)}
                      onKeyDown={e => e.key === 'Enter' && saveTokenField('label', editLabel)}
                      placeholder="Etiqueta" />
                    <div style={{ display: 'flex', gap: '3px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {SIZES.map(sz => (
                        <button key={sz.id} style={{ ...s.sizeBtn, ...(editSize === sz.id ? s.sizeBtnOn : {}) }}
                          onClick={() => { setEditSize(sz.id); saveTokenField('size', sz.id); }}>{sz.label}</button>
                      ))}
                    </div>
                    <button
                      style={{ ...s.popBtn, width: '100%', marginBottom: '6px',
                        color: popover.visibleToParty === false ? 'rgba(224,80,80,0.8)' : '#65c260',
                        borderColor: popover.visibleToParty === false ? 'rgba(224,80,80,0.3)' : 'rgba(101,194,96,0.3)' }}
                      onClick={() => saveTokenField('visibleToParty', popover.visibleToParty !== false ? false : true)}>
                      {popover.visibleToParty === false ? 'Oculto a party - Mostrar' : 'Visible a party - Ocultar'}
                    </button>
                    <button style={{ ...s.popBtn, width: '100%', color: 'rgba(224,80,80,0.8)', borderColor: 'rgba(224,80,80,0.3)' }}
                      onClick={() => deleteToken(popover.id)}>
                      Eliminar token
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(activeMap.tokens || []).length > 0 && (
              <div style={s.legend}>
                {(displayMap.tokens || []).map(t => (
                  <span key={t.id} style={{ ...s.legendItem, color: t.color, borderColor: t.color, opacity: t.visibleToParty === false ? 0.5 : 1 }}
                    onClick={() => { setPopover(t); setEditLabel(t.label); setEditSize(t.size || 3); }}>
                    {t.imageUrl ? <img src={t.imageUrl} style={{ width: '12px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} alt="" /> : <GameIcon {...tacticalIcon(t)} size={12} color={t.color || 'f7dd78'} />}
                    {' '}{t.label}{t.visibleToParty === false ? ' (oculto)' : ''}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', minHeight: '500px' },
  sidebar: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 },
  sidebarTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  addBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  uploadForm: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', color: 'var(--parchment, #f4ecd2)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  fileInput: { color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', background: 'transparent', border: 'none', cursor: 'pointer' },
  submitBtn: { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  mapList: { flex: 1, overflowY: 'auto' },
  mapItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)', transition: 'background 0.15s' },
  mapItemActive: { background: 'rgba(201,168,76,0.08)', borderLeft: '3px solid var(--gold-2)' },
  mapItemInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  mapItemTitle: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--gold-bright)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mapItemMeta: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', color: 'var(--gold-dim)' },
  deleteMapBtn: { background: 'transparent', border: 'none', color: 'rgba(224,80,80,0.5)', cursor: 'pointer', fontSize: '11px', flexShrink: 0 },
  emptyMsg: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', opacity: 0.6, padding: '16px', textAlign: 'center', fontStyle: 'italic' },
  main: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  emptyCanvas: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  mapTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)', letterSpacing: '1px', flex: 1 },
  toolbarRight: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  toolBtn: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', transition: 'all 0.2s', whiteSpace: 'nowrap' },
  toolBtnGreen: { background: 'rgba(101,194,96,0.12)', borderColor: '#65c260', color: '#65c260' },
  toolBtnGold: { background: 'rgba(201,168,76,0.12)', borderColor: 'var(--gold-2)', color: 'var(--gold-bright)' },
  vpPanel: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  vpTitle: { fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  vpSliders: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  vpRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  vpLbl: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', color: 'var(--gold-dim)', textTransform: 'uppercase', minWidth: '80px' },
  vpVal: { fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold-bright)', minWidth: '28px', textAlign: 'right' },
  palette: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  catTabs: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  catTab: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', transition: 'all 0.15s' },
  catTabActive: { background: 'rgba(201,168,76,0.12)', borderColor: 'var(--gold-2)', color: 'var(--gold-bright)' },
  tokenGrid: { display: 'flex', gap: '5px', flexWrap: 'wrap', maxHeight: '108px', overflowY: 'auto' },
  tokenPickBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 7px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', minWidth: '46px', transition: 'all 0.15s' },
  placeOpts: { display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' },
  sizeBtn: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '8px', padding: '3px 7px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s' },
  sizeBtnOn: { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--gold-2)', color: 'var(--gold-bright)' },
  mapWrap: { overflow: 'auto', maxHeight: '68vh', borderRadius: '10px', border: '1px solid var(--line)', background: '#0a0806' },
  mapCanvas: { position: 'relative', display: 'inline-block', minWidth: '100%' },
  mapImg: { display: 'block', width: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' },
  fog: { position: 'absolute', background: '#0a0804', pointerEvents: 'none', zIndex: 20 },
  popClose: { background: 'transparent', border: 'none', color: 'var(--gold-dim)', cursor: 'pointer', fontSize: '12px', padding: '2px', lineHeight: 1 },
  popBtn: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px', transition: 'all 0.15s' },
  legend: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', border: '1px solid', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' },
};
