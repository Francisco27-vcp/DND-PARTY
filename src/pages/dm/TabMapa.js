// src/pages/dm/TabMapa.js — Mapas interactivos (DM)
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadImage } from '../../lib/uploadImage';

const TOKEN_TYPES = [
  { type: 'pj',      emoji: '🧙', label: 'PJ',      color: '#c9a84c' },
  { type: 'enemigo', emoji: '💀', label: 'Enemigo',  color: '#8b1a1a' },
  { type: 'tesoro',  emoji: '💎', label: 'Tesoro',   color: '#4a7fa5' },
  { type: 'trampa',  emoji: '⚠️', label: 'Trampa',   color: '#c07a20' },
  { type: 'pdi',     emoji: '📍', label: 'PDI',      color: '#65c260' },
  { type: 'custom',  emoji: '⭐', label: 'Custom',   color: '#9a6aaa' },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function TabMapa() {
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedType, setSelectedType] = useState('pj');
  const [customLabel, setCustomLabel] = useState('');
  const [placing, setPlacing] = useState(false); // modo colocación
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const mapRef = useRef(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);

  const activeMap = maps.find(m => m.id === activeMapId) || null;
  const selectedTokenDef = TOKEN_TYPES.find(t => t.type === selectedType);

  // Firestore listener
  useEffect(() => {
    const q = query(collection(db, 'maps'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaps(list);
      // auto-select first if none selected
      setActiveMapId(prev => prev || (list[0]?.id ?? null));
    }, () => {});
  }, []);

  // Upload new map
  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, `maps/${Date.now()}_${file.name}`);
      const ref = await addDoc(collection(db, 'maps'), {
        title: uploadTitle.trim(),
        imageUrl: url,
        visibleToParty: false,
        tokens: [],
        createdAt: serverTimestamp(),
      });
      setActiveMapId(ref.id);
      setUploadTitle('');
      setShowUpload(false);
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  // Toggle visibility
  const toggleVisible = async () => {
    if (!activeMap) return;
    await updateDoc(doc(db, 'maps', activeMap.id), {
      visibleToParty: !activeMap.visibleToParty,
    });
  };

  // Delete map
  const deleteMap = async (id) => {
    await deleteDoc(doc(db, 'maps', id));
    if (activeMapId === id) setActiveMapId(maps.find(m => m.id !== id)?.id ?? null);
  };

  // Track image real size for % positioning
  const onImgLoad = useCallback(() => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
    }
  }, []);

  // Click on map to place token
  const handleMapClick = async (e) => {
    if (!placing || !activeMap || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const def = TOKEN_TYPES.find(t => t.type === selectedType);
    const newToken = {
      id: uid(),
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
      type: selectedType,
      emoji: def.emoji,
      color: def.color,
      label: customLabel.trim() || def.label,
    };
    const updated = [...(activeMap.tokens || []), newToken];
    await updateDoc(doc(db, 'maps', activeMap.id), { tokens: updated });
  };

  // Remove token
  const removeToken = async (tokenId) => {
    if (!activeMap) return;
    const updated = (activeMap.tokens || []).filter(t => t.id !== tokenId);
    await updateDoc(doc(db, 'maps', activeMap.id), { tokens: updated });
  };

  // Clear all tokens
  const clearTokens = async () => {
    if (!activeMap) return;
    await updateDoc(doc(db, 'maps', activeMap.id), { tokens: [] });
  };

  return (
    <div style={s.wrap}>
      {/* ── SIDEBAR ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <span style={s.sidebarTitle}>Mapas</span>
          <button style={s.addBtn} onClick={() => setShowUpload(v => !v)}>
            {showUpload ? '✕' : '+ Nuevo'}
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <form onSubmit={handleUpload} style={s.uploadForm}>
            <input
              style={s.input}
              placeholder="Título del mapa"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              required
            />
            <input ref={fileRef} type="file" accept="image/*" style={s.fileInput} required />
            <button type="submit" style={s.submitBtn} disabled={uploading}>
              {uploading ? 'Subiendo...' : '↑ Subir mapa'}
            </button>
          </form>
        )}

        {/* Map list */}
        <div style={s.mapList}>
          {maps.length === 0 && (
            <p style={s.emptyMsg}>Sin mapas. Subí uno.</p>
          )}
          {maps.map(m => (
            <div
              key={m.id}
              style={{ ...s.mapItem, ...(m.id === activeMapId ? s.mapItemActive : {}) }}
              onClick={() => setActiveMapId(m.id)}
            >
              <div style={s.mapItemInfo}>
                <span style={s.mapItemTitle}>{m.title}</span>
                <span style={s.mapItemMeta}>
                  {(m.tokens || []).length} tokens ·{' '}
                  <span style={{ color: m.visibleToParty ? '#65c260' : 'var(--gold-dim)' }}>
                    {m.visibleToParty ? '👁 Visible' : '🔒 Oculto'}
                  </span>
                </span>
              </div>
              <button
                style={s.deleteMapBtn}
                onClick={e => { e.stopPropagation(); deleteMap(m.id); }}
                title="Eliminar mapa"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CANVAS AREA ── */}
      <div style={s.main}>
        {!activeMap ? (
          <div style={s.emptyCanvas}>
            <span style={{ fontSize: '48px', opacity: 0.3 }}>🗺</span>
            <p style={s.emptyMsg}>Seleccioná o subí un mapa para comenzar</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div style={s.toolbar}>
              <span style={s.mapTitle}>{activeMap.title}</span>
              <div style={s.toolbarRight}>
                <button
                  style={{ ...s.visBtn, ...(activeMap.visibleToParty ? s.visBtnOn : {}) }}
                  onClick={toggleVisible}
                >
                  {activeMap.visibleToParty ? '👁 Party puede ver' : '🔒 Oculto a party'}
                </button>
                <button
                  style={{ ...s.placeBtn, ...(placing ? s.placeBtnOn : {}) }}
                  onClick={() => setPlacing(v => !v)}
                >
                  {placing ? '✕ Cancelar' : '+ Colocar token'}
                </button>
                {(activeMap.tokens || []).length > 0 && (
                  <button style={s.clearBtn} onClick={clearTokens}>🗑 Limpiar</button>
                )}
              </div>
            </div>

            {/* Token palette (shown while placing) */}
            {placing && (
              <div style={s.palette}>
                {TOKEN_TYPES.map(t => (
                  <button
                    key={t.type}
                    style={{ ...s.paletteBtn, ...(selectedType === t.type ? { borderColor: t.color, background: `${t.color}22` } : {}) }}
                    onClick={() => setSelectedType(t.type)}
                  >
                    <span style={{ fontSize: '18px' }}>{t.emoji}</span>
                    <span style={{ ...s.paletteLbl, color: selectedType === t.type ? t.color : 'var(--gold-dim)' }}>{t.label}</span>
                  </button>
                ))}
                <input
                  style={{ ...s.input, width: '110px', fontSize: '12px', padding: '4px 8px' }}
                  placeholder="Etiqueta"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                />
                <span style={s.paletteTip}>Hacé clic en el mapa para colocar</span>
              </div>
            )}

            {/* Map with tokens */}
            <div
              ref={mapRef}
              style={{ ...s.mapCanvas, cursor: placing ? 'crosshair' : 'default' }}
              onClick={handleMapClick}
            >
              <img
                ref={imgRef}
                src={activeMap.imageUrl}
                alt={activeMap.title}
                style={s.mapImg}
                onLoad={onImgLoad}
                draggable={false}
              />

              {/* Tokens */}
              {(activeMap.tokens || []).map(token => (
                <div
                  key={token.id}
                  style={{
                    ...s.token,
                    left: `${token.x}%`,
                    top: `${token.y}%`,
                    borderColor: token.color,
                    background: `${token.color}33`,
                  }}
                  onClick={e => { e.stopPropagation(); removeToken(token.id); }}
                  title={`${token.label} — clic para quitar`}
                >
                  <span style={s.tokenEmoji}>{token.emoji}</span>
                  <span style={{ ...s.tokenLabel, color: token.color }}>{token.label}</span>
                </div>
              ))}
            </div>

            {/* Token legend */}
            {(activeMap.tokens || []).length > 0 && (
              <div style={s.legend}>
                {(activeMap.tokens || []).map(t => (
                  <span key={t.id} style={{ ...s.legendItem, color: t.color }}>
                    {t.emoji} {t.label}
                    <button style={s.legendRemove} onClick={() => removeToken(t.id)}>✕</button>
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
  wrap: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', minHeight: '500px' },

  // Sidebar
  sidebar: { background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)' },
  sidebarTitle: { fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--gold-dim)', textTransform: 'uppercase' },
  addBtn: { background: 'transparent', border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  uploadForm: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,0.2)' },
  input: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', color: 'var(--parchment, #f4ecd2)', fontFamily: 'Crimson Pro,serif', fontSize: '13px', padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', borderRadius: '4px' },
  fileInput: { color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', background: 'transparent', border: 'none', cursor: 'pointer' },
  submitBtn: { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '4px' },
  mapList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  mapItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)', transition: 'background 0.15s' },
  mapItemActive: { background: 'rgba(201,168,76,0.08)', borderLeft: '3px solid var(--gold-2, #c7a242)' },
  mapItemInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  mapItemTitle: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--gold-bright)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mapItemMeta: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', color: 'var(--gold-dim)' },
  deleteMapBtn: { background: 'transparent', border: 'none', color: 'rgba(224,80,80,0.5)', cursor: 'pointer', fontSize: '11px', flexShrink: 0, padding: '2px' },
  emptyMsg: { fontFamily: 'Crimson Pro,serif', fontSize: '13px', color: 'var(--text-soft)', opacity: 0.6, padding: '16px', textAlign: 'center', fontStyle: 'italic' },

  // Main
  main: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  emptyCanvas: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  mapTitle: { fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--gold-bright)', letterSpacing: '1px', flex: 1 },
  toolbarRight: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  visBtn: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', transition: 'all 0.2s' },
  visBtnOn: { background: 'rgba(101,194,96,0.12)', borderColor: '#65c260', color: '#65c260' },
  placeBtn: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px', transition: 'all 0.2s' },
  placeBtnOn: { background: 'rgba(201,168,76,0.12)', borderColor: 'var(--gold-2)', color: 'var(--gold-bright)' },
  clearBtn: { background: 'transparent', border: '1px solid rgba(224,80,80,0.3)', color: 'rgba(224,80,80,0.7)', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase', borderRadius: '6px' },

  // Palette
  palette: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '8px', flexWrap: 'wrap' },
  paletteBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer', minWidth: '52px', transition: 'all 0.15s' },
  paletteLbl: { fontFamily: 'Cinzel,serif', fontSize: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' },
  paletteTip: { fontFamily: 'Crimson Pro,serif', fontSize: '11px', color: 'var(--gold-dim)', fontStyle: 'italic', marginLeft: 'auto' },

  // Map canvas
  mapCanvas: { position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--line)', background: '#0a0806', maxHeight: '70vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start' },
  mapImg: { width: '100%', height: 'auto', display: 'block', userSelect: 'none', pointerEvents: 'none' },

  // Tokens
  token: { position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'pointer', zIndex: 10, padding: '3px 5px', border: '1.5px solid', borderRadius: '6px', backdropFilter: 'blur(4px)', transition: 'transform 0.1s', minWidth: '32px' },
  tokenEmoji: { fontSize: '18px', lineHeight: 1 },
  tokenLabel: { fontFamily: 'Cinzel,serif', fontSize: '7px', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' },

  // Legend
  legend: { display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 0' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '0.5px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', padding: '3px 8px', borderRadius: '4px' },
  legendRemove: { background: 'transparent', border: 'none', color: 'rgba(224,80,80,0.6)', cursor: 'pointer', fontSize: '9px', padding: '0 0 0 4px', lineHeight: 1 },
};
