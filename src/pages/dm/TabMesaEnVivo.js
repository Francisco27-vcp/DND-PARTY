import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createLiveSessionPayload } from '../../lib/liveSession';
import { createCharacterToken, hydrateMapCharacters } from '../../lib/tacticalTokens';
import LiveMapCanvas from '../../components/LiveMapCanvas';
import AppIcon from '../../components/AppIcon';
import demoMapUrl from '../../assets/visuals/campaign-atlas-bg.webp';
import '../../styles/LiveSession.css';

const DEFAULT_LIVE = {
  active: false, mapId: '', title: 'Rakets Party', message: '',
  mode: 'exploracion', showCombat: true, revision: 0,
};

const DEMO_CHARACTERS = [
  { id: 'demo-aurelian', name: 'Aurelian', class: 'Paladín', level: 5, hp: 31, hpMax: 38, ac: 18 },
  { id: 'demo-mog', name: 'Mog', class: 'Bárbaro', level: 4, hp: 34, hpMax: 42, ac: 14 },
  { id: 'demo-kaelion', name: 'Kaelion', class: 'Monje', level: 4, hp: 25, hpMax: 34, ac: 16 },
];

export default function TabMesaEnVivo() {
  const [maps, setMaps] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_LIVE);
  const [published, setPublished] = useState(DEFAULT_LIVE);
  const [baseRevision, setBaseRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const dirtyRef = useRef(false);
  const baseRevisionRef = useRef(0);

  useEffect(() => onSnapshot(
    query(collection(db, 'maps'), orderBy('createdAt', 'desc')),
    snap => setMaps(snap.docs.map(item => ({ id: item.id, ...item.data() }))),
    error => {
      console.error('No se pudieron cargar los mapas privados:', error);
      setConnection('error');
    },
  ), []);

  useEffect(() => onSnapshot(
    collection(db, 'characters'),
    snap => setCharacters(snap.docs.map(item => ({ id: item.id, ...item.data() }))),
    error => console.error('No se pudieron cargar los personajes para la mesa:', error),
  ), []);

  useEffect(() => onSnapshot(
    doc(db, 'live_sessions', 'main'),
    { includeMetadataChanges: true },
    snap => {
      const next = { ...DEFAULT_LIVE, ...(snap.exists() ? snap.data() : {}) };
      setPublished(next);
      setConnection(snap.metadata.fromCache ? 'offline' : 'online');
      if (!dirtyRef.current) {
        baseRevisionRef.current = next.revision || 0;
        setBaseRevision(next.revision || 0);
        setConflict(false);
        setDraft(next);
      } else if ((next.revision || 0) !== baseRevisionRef.current) {
        setConflict(true);
      }
    },
    error => {
      console.error('No se pudo seguir la mesa en vivo:', error);
      setConnection('error');
    },
  ), []);

  const activeMap = useMemo(() => {
    const selected = maps.find(map => map.id === draft.mapId) || null;
    return hydrateMapCharacters(selected, characters);
  }, [maps, characters, draft.mapId]);
  const demoMap = useMemo(() => {
    const party = characters.length ? characters.slice(0, 4) : DEMO_CHARACTERS;
    const positions = [[28, 38], [47, 55], [66, 39], [58, 70]];
    return {
      id: 'local-visual-demo',
      title: 'Demostración táctica local',
      imageUrl: demoMapUrl,
      fog: { enabled: true, cols: 24, rows: 16, hidden: ['0:0', '1:0', '2:0', '0:1', '1:1', '22:14', '23:14', '22:15', '23:15'] },
      tokens: party.map((character, index) => createCharacterToken(character, {
        id: `demo-${character.id || index}`,
        x: positions[index]?.[0] || 50,
        y: positions[index]?.[1] || 50,
        size: index === 0 ? 4 : 3,
      })),
    };
  }, [characters]);
  const previewMap = activeMap || demoMap;
  const markDirty = updater => {
    dirtyRef.current = true;
    setDirty(true);
    setDraft(updater);
    setNotice('Cambios en borrador. La party todavía no los ve.');
  };
  const change = key => event => markDirty(value => ({ ...value, [key]: event.target.value }));

  const reloadPublished = () => {
    dirtyRef.current = false;
    setDirty(false);
    baseRevisionRef.current = published.revision || 0;
    setBaseRevision(published.revision || 0);
    setConflict(false);
    setDraft(published);
    setNotice('Borrador restablecido a la última publicación.');
  };

  const save = async (active = draft.active) => {
    if (active && !activeMap) return;
    setSaving(true);
    setNotice('');
    try {
      const liveRef = doc(db, 'live_sessions', 'main');
      let savedRevision = baseRevisionRef.current;
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(liveRef);
        const currentRevision = snapshot.exists() ? (snapshot.data().revision || 0) : 0;
        if (currentRevision !== baseRevisionRef.current) {
          const conflict = new Error('LIVE_SESSION_CONFLICT');
          conflict.code = 'LIVE_SESSION_CONFLICT';
          throw conflict;
        }
        transaction.set(liveRef, {
          ...createLiveSessionPayload(draft, activeMap, active, currentRevision + 1),
          updatedAt: serverTimestamp(),
        });
        savedRevision = currentRevision + 1;
      });
      dirtyRef.current = false;
      setDirty(false);
      baseRevisionRef.current = savedRevision;
      setBaseRevision(savedRevision);
      setConflict(false);
      setNotice(active ? 'Publicación actualizada para la party.' : 'La transmisión quedó en pausa.');
    } catch (error) {
      console.error(error);
      setNotice(error.code === 'LIVE_SESSION_CONFLICT'
        ? 'Otra ventana publicó cambios. Revisá la versión recibida y volvé a publicar.'
        : 'No se pudo actualizar la mesa en vivo.');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = connection === 'online'
    ? 'Conectado'
    : connection === 'offline' ? 'Sin conexión · usando caché' : connection === 'error' ? 'Error de conexión' : 'Conectando';

  return (
    <div className="live-control-layout" style={s.layout}>
      <aside style={s.panel} className="live-command-panel">
        <div style={s.statusRow}>
          <div style={s.eyebrow}>Control de transmisión</div>
          <span style={{ ...s.connection, color: connection === 'online' ? '#83d77f' : '#d9ad63' }}>{statusLabel}</span>
        </div>
        <h2 style={s.title}>Mesa en vivo</h2>
        <p style={s.copy}>Prepará el borrador y publicalo cuando esté listo. Los secretos del DM nunca se incluyen.</p>

        <label style={s.field}>
          <span style={s.label}>Escena activa</span>
          <select style={s.input} value={draft.mapId || ''} onChange={change('mapId')}>
            <option value="">Sin mapa</option>
            {maps.map(map => <option key={map.id} value={map.id}>{map.title}</option>)}
          </select>
        </label>
        <label style={s.field}>
          <span style={s.label}>Título para la party</span>
          <input style={s.input} value={draft.title || ''} onChange={change('title')} />
        </label>
        <label style={s.field}>
          <span style={s.label}>Mensaje en pantalla</span>
          <textarea style={{ ...s.input, minHeight: 82, resize: 'vertical' }} value={draft.message || ''} onChange={change('message')} placeholder="El aire se vuelve helado…" />
        </label>
        <label style={s.field}>
          <span style={s.label}>Modo</span>
          <select style={s.input} value={draft.mode || 'exploracion'} onChange={change('mode')}>
            <option value="exploracion">Exploración</option>
            <option value="combate">Combate</option>
            <option value="narrativa">Narrativa</option>
            <option value="intermedio">Intermedio</option>
          </select>
        </label>
        <label style={s.check}>
          <input type="checkbox" checked={draft.showCombat !== false} onChange={event => markDirty(value => ({ ...value, showCombat: event.target.checked }))} />
          Mostrar iniciativa cuando haya combate
        </label>

        <div style={s.versionRow}>
          <span>Base v{baseRevision} · recibida v{published.revision || 0}</span>
          <span style={{ color: conflict ? '#e78468' : dirty ? '#d9ad63' : '#83d77f' }}>{conflict ? 'Conflicto detectado' : dirty ? 'Borrador pendiente' : 'Sin cambios'}</span>
        </div>
        <div style={s.actions}>
          <button style={s.primary} className="command-button command-button--primary" disabled={saving || !draft.mapId || connection === 'error'} onClick={() => save(true)}><AppIcon name="play" size={15} /> Publicar</button>
          <button style={s.secondary} className="command-button" disabled={saving || connection === 'error'} onClick={() => save(false)}><AppIcon name="pause" size={15} /> Pausar</button>
        </div>
        {dirty && <button type="button" style={s.reset} onClick={reloadPublished}>Descartar borrador</button>}
        <button style={s.projector} className="command-button command-button--projector" onClick={() => window.open('/proyector', '_blank', 'noopener,noreferrer')}><AppIcon name="eye" size={15} /> Abrir proyector</button>
        {notice && <div style={s.notice}>{notice}</div>}
      </aside>

      <section style={s.preview}>
        <div style={s.previewHeader}>
          <span>{activeMap ? 'Vista previa privada del DM' : 'Demostración visual local · no se publica'}</span>
          <span style={{ color: published.active ? '#65c260' : 'var(--gold-dim)' }}>{activeMap ? (published.active ? '● En vivo' : '○ En pausa') : '◆ Demo segura'}</span>
        </div>
        <LiveMapCanvas map={previewMap} dmView compact />
      </section>
    </div>
  );
}

const s = {
  layout: { display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 20, alignItems: 'start' },
  panel: { background: 'var(--panel)', border: '1px solid var(--line)', borderTop: '2px solid var(--gold)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: 8, letterSpacing: 3, textTransform: 'uppercase' },
  connection: { fontFamily: 'Inter,sans-serif', fontSize: 9 },
  title: { margin: 0, color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: 22, letterSpacing: 2 },
  copy: { margin: 0, color: 'var(--parchment-dim)', fontFamily: 'Crimson Pro,serif', fontSize: 14, lineHeight: 1.55 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 11px', color: 'var(--parchment)', background: 'var(--panel-raised)', border: '1px solid var(--line)', borderRadius: 4, fontFamily: 'Crimson Pro,serif', fontSize: 14 },
  check: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--parchment-dim)', fontFamily: 'Crimson Pro,serif', fontSize: 13 },
  versionRow: { display: 'flex', justifyContent: 'space-between', color: 'var(--gold-dim)', fontFamily: 'Inter,sans-serif', fontSize: 9 },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  primary: { padding: '11px 12px', border: 0, borderRadius: 4, background: 'linear-gradient(135deg,var(--gold-bright),var(--gold))', color: '#1a1206', fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' },
  secondary: { padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 4, background: 'transparent', color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' },
  reset: { border: 0, background: 'transparent', color: 'var(--gold-dim)', fontFamily: 'Inter,sans-serif', fontSize: 10, textDecoration: 'underline', cursor: 'pointer' },
  projector: { padding: 10, border: '1px solid rgba(101,194,96,.3)', borderRadius: 4, background: 'rgba(101,194,96,.06)', color: '#83d77f', fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' },
  notice: { padding: 10, border: '1px solid var(--line)', color: 'var(--gold-dim)', fontFamily: 'Crimson Pro,serif', fontSize: 13 },
  preview: { minWidth: 0, background: 'rgba(0,0,0,.18)', border: '1px solid var(--line)', padding: 12 },
  previewHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: 'var(--gold-dim)', fontFamily: 'Cinzel,serif', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
};
