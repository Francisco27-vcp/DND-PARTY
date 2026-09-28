const DEFAULT_FOG = { enabled: false, cols: 24, rows: 16, hidden: [] };

const finiteNumber = (value, fallback = 0) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
);

export function createPublicToken(token = {}) {
  return {
    id: String(token.id || ''),
    x: Math.min(100, Math.max(0, finiteNumber(token.x))),
    y: Math.min(100, Math.max(0, finiteNumber(token.y))),
    typeId: String(token.typeId || ''),
    cat: String(token.cat || ''),
    label: String(token.label || 'Token').slice(0, 80),
    color: String(token.color || '#f7dd78'),
    size: Math.min(6, Math.max(1, finiteNumber(token.size, 3))),
    imageUrl: typeof token.imageUrl === 'string' ? token.imageUrl : null,
    entityKind: String(token.entityKind || ''),
    className: String(token.className || '').slice(0, 80),
    classKey: String(token.classKey || '').slice(0, 40),
    symbolKey: String(token.symbolKey || '').slice(0, 40),
    level: Math.min(30, Math.max(0, finiteNumber(token.level))),
    hp: Math.max(0, finiteNumber(token.hp)),
    hpMax: Math.max(0, finiteNumber(token.hpMax)),
    visibleToParty: true,
  };
}

export function createPublicMapSnapshot(map) {
  if (!map) return null;
  const fog = map.fog || DEFAULT_FOG;
  return {
    id: String(map.id || ''),
    title: String(map.title || 'Escena').slice(0, 120),
    imageUrl: typeof map.imageUrl === 'string' ? map.imageUrl : '',
    viewport: {
      t: finiteNumber(map.viewport?.t),
      r: finiteNumber(map.viewport?.r),
      b: finiteNumber(map.viewport?.b),
      l: finiteNumber(map.viewport?.l),
    },
    fog: {
      enabled: fog.enabled === true,
      cols: Math.min(100, Math.max(1, finiteNumber(fog.cols, 24))),
      rows: Math.min(100, Math.max(1, finiteNumber(fog.rows, 16))),
      hidden: Array.isArray(fog.hidden)
        ? fog.hidden.filter(cell => typeof cell === 'string').slice(0, 10000)
        : [],
    },
    tokens: (Array.isArray(map.tokens) ? map.tokens : [])
      .filter(token => token?.visibleToParty !== false)
      .map(createPublicToken),
  };
}

export function createLiveSessionPayload(draft, map, active, revision) {
  return {
    active: active === true,
    mapId: active && map ? String(map.id || '') : '',
    title: String(draft?.title || 'Rakets Party').slice(0, 120),
    message: String(draft?.message || '').slice(0, 500),
    mode: ['exploracion', 'combate', 'narrativa', 'intermedio'].includes(draft?.mode)
      ? draft.mode
      : 'exploracion',
    showCombat: draft?.showCombat !== false,
    mapSnapshot: active ? createPublicMapSnapshot(map) : null,
    revision: Math.max(1, finiteNumber(revision, 1)),
  };
}
