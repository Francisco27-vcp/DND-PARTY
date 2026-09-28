import redDragonImage from '../assets/visuals/red-dragon-realistic.jpg';
import greenDragonImage from '../assets/visuals/green-dragon-realistic.jpg';
import blueDragonImage from '../assets/visuals/blue-dragon-realistic.jpg';
import undeadKnightImage from '../assets/visuals/undead-knight-realistic.jpg';
import treasureCofferImage from '../assets/visuals/treasure-coffer-realistic.jpg';
import caveSpiderImage from '../assets/visuals/cave-spider-realistic.jpg';
import goblinScoutImage from '../assets/visuals/goblin-scout-realistic.jpg';
import fireElementalImage from '../assets/visuals/fire-elemental-realistic.jpg';
import stoneGolemImage from '../assets/visuals/stone-golem-realistic.jpg';
import arrowWallTrapImage from '../assets/visuals/arrow-wall-trap-realistic.jpg';
import npcRangerImage from '../assets/visuals/npc-ranger-realistic.jpg';

const CLASS_VISUALS = {
  barbaro: { symbolKey: 'strength', color: '#c85b4f' },
  bardo: { symbolKey: 'charisma', color: '#aa72c2' },
  clerigo: { symbolKey: 'heart', color: '#d8b7d8' },
  druida: { symbolKey: 'wisdom', color: '#65a86a' },
  explorador: { symbolKey: 'perception', color: '#8faa57' },
  guerrero: { symbolKey: 'sword', color: '#aa936a' },
  hechicero: { symbolKey: 'magic', color: '#b461d0' },
  mago: { symbolKey: 'spell', color: '#5c91c2' },
  monje: { symbolKey: 'dexterity', color: '#d5b85b' },
  paladin: { symbolKey: 'shield', color: '#ead36d' },
  picaro: { symbolKey: 'cloak', color: '#8d88ae' },
  warlock: { symbolKey: 'magic', color: '#8150a7' },
};

const ENTITY_VISUALS = {
  pj: { symbolKey: 'sword', color: '#c7a242', entityKind: 'character' },
  monstruo: { symbolKey: 'conditions', color: '#b96055', entityKind: 'monster' },
  trampa: { symbolKey: 'shield', color: '#d18a3d', entityKind: 'trap' },
  objeto: { symbolKey: 'inventory', color: '#c7a242', entityKind: 'object' },
  custom: { symbolKey: 'magic', color: '#7da78a', entityKind: 'custom' },
};

const TOKEN_VISUALS = {
  'dragon-r': { symbolKey: 'magic', color: '#8b1a1a' },
  'dragon-v': { symbolKey: 'wisdom', color: '#2a6a2a' },
  'dragon-b': { symbolKey: 'spell', color: '#2040a0' },
  zombi: { symbolKey: 'conditions', color: '#5a7a4a' },
  esqueleto: { symbolKey: 'conditions', color: '#b0b0b0' },
  vampiro: { symbolKey: 'cloak', color: '#6a1a4a' },
  lobo: { symbolKey: 'speed', color: '#7a6a5a' },
  arana: { symbolKey: 'perception', color: '#3a2a1a' },
  goblin: { symbolKey: 'proficiency', color: '#4a6a2a' },
  orco: { symbolKey: 'strength', color: '#5a3a2a' },
  troll: { symbolKey: 'armor', color: '#5a7a5a' },
  golem: { symbolKey: 'armor', color: '#8a8a8a' },
  banshee: { symbolKey: 'cloak', color: '#a0c0e0' },
  lich: { symbolKey: 'spell', color: '#7a1a9a' },
  mimic: { symbolKey: 'inventory', color: '#8a6a2a' },
  beholder: { symbolKey: 'perception', color: '#4a2a8a' },
  'el-fuego': { symbolKey: 'magic', color: '#c04000' },
  'el-agua': { symbolKey: 'wisdom', color: '#2060a0' },
  'el-aire': { symbolKey: 'speed', color: '#80a0c0' },
  medusa: { symbolKey: 'charisma', color: '#2a6a4a' },
  hipogrife: { symbolKey: 'speed', color: '#8a6a2a' },
  gargola: { symbolKey: 'armor', color: '#5a5a7a' },
  demonio: { symbolKey: 'conditions', color: '#8b1a1a' },
  gigante: { symbolKey: 'strength', color: '#7a5a4a' },
  kraken: { symbolKey: 'wisdom', color: '#204060' },
  wyvern: { symbolKey: 'speed', color: '#3a5a2a' },
  'npc-aliado': { symbolKey: 'heart', color: '#a08060' },
  't-flecha': { symbolKey: 'perception', color: '#c07020' },
  't-foso': { symbolKey: 'conditions', color: '#3a2a1a' },
  't-espinas': { symbolKey: 'sword', color: '#4a6a2a' },
  't-gas': { symbolKey: 'magic', color: '#6a9a4a' },
  't-fuego': { symbolKey: 'magic', color: '#c04000' },
  't-runa': { symbolKey: 'spell', color: '#6a2a9a' },
  't-roca': { symbolKey: 'strength', color: '#7a7a7a' },
  't-hielo': { symbolKey: 'wisdom', color: '#80c0e0' },
  't-aguja': { symbolKey: 'sword', color: '#c04040' },
  't-rayo': { symbolKey: 'magic', color: '#c0a000' },
  't-pendulo': { symbolKey: 'broadsword', color: '#7a6a5a' },
  cofre: { symbolKey: 'inventory', color: '#c9a84c' },
  tesoro: { symbolKey: 'ring', color: '#4a7fa5' },
  puerta: { symbolKey: 'shield', color: '#8a6a4a' },
  escalera: { symbolKey: 'boots', color: '#7a7a7a' },
  altar: { symbolKey: 'spell', color: '#c0a060' },
  portal: { symbolKey: 'magic', color: '#4060c0' },
  inicio: { symbolKey: 'inspiration', color: '#4a8a4a' },
  objetivo: { symbolKey: 'perception', color: '#c84040' },
  pdi: { symbolKey: 'perception', color: '#c07a20' },
  secreto: { symbolKey: 'cloak', color: '#6a6a9a' },
  barril: { symbolKey: 'inventory', color: '#8a6a4a' },
  campamento: { symbolKey: 'heart', color: '#7a5a3a' },
  caido: { symbolKey: 'conditions', color: '#8b1a1a' },
};

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function isSingleAdjacentSwap(first, second) {
  if (!first || !second || first.length !== second.length || first.length < 7) return false;
  const mismatches = [];
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) mismatches.push(index);
  }
  return mismatches.length === 2
    && mismatches[1] === mismatches[0] + 1
    && first[mismatches[0]] === second[mismatches[1]]
    && first[mismatches[1]] === second[mismatches[0]];
}

export function normalizeClassKey(value = '') {
  const normalized = normalizeText(value);
  return Object.keys(CLASS_VISUALS).find(key => normalized.includes(key)) || 'guerrero';
}

export function getTacticalVisual(token = {}) {
  const classKey = token.classKey || normalizeClassKey(token.className || token.label);
  if (token.entityKind === 'character' || token.cat === 'pj') {
    return { ...ENTITY_VISUALS.pj, ...CLASS_VISUALS[classKey], classKey };
  }
  const typeVisual = TOKEN_VISUALS[normalizeText(token.typeId || '')];
  return { ...(ENTITY_VISUALS[token.cat] || ENTITY_VISUALS.custom), ...typeVisual, classKey };
}

export function createCharacterToken(character = {}, base = {}) {
  const classKey = normalizeClassKey(character.class);
  const visual = CLASS_VISUALS[classKey] || CLASS_VISUALS.guerrero;
  return {
    ...base,
    typeId: classKey,
    cat: 'pj',
    entityKind: 'character',
    characterId: String(character.id || ''),
    label: String(character.name || 'Aventurero'),
    className: String(character.class || 'Aventurero'),
    classKey,
    symbolKey: visual.symbolKey,
    level: Number(character.level) || 1,
    hp: Math.max(0, Number(character.hp) || 0),
    hpMax: Math.max(1, Number(character.hpMax) || 1),
    armorClass: Number(character.ac) || 0,
    imageUrl: character.portrait || null,
    color: character.color || character.accentColor || visual.color,
    visibleToParty: true,
  };
}

export function hydrateMapCharacters(map, characters = []) {
  if (!map) return map;
  const byId = new Map(characters.map(character => [String(character.id), character]));
  const byName = new Map();
  characters.forEach(character => {
    const key = normalizeText(character.name || '');
    if (!key) return;
    byName.set(key, byName.has(key) ? null : character);
  });
  const uniqueNameMatch = label => {
    const normalized = normalizeText(label || '');
    const exact = byName.get(normalized);
    if (exact) return exact;
    const closeMatches = characters.filter(character => isSingleAdjacentSwap(normalized, normalizeText(character.name || '')));
    return closeMatches.length === 1 ? closeMatches[0] : null;
  };
  return {
    ...map,
    tokens: (map.tokens || []).map(token => {
      const character = (token.characterId ? byId.get(String(token.characterId)) : null)
        || uniqueNameMatch(token.label)
        || null;
      const visual = getTacticalVisual(token);
      const typedVisual = TOKEN_VISUALS[normalizeText(token.typeId || '')];
      const localToken = character
        ? createCharacterToken(character, token)
        : { ...visual, ...token, symbolKey: typedVisual?.symbolKey || token.symbolKey || visual.symbolKey };
      return withLocalTokenArtwork(localToken);
    }),
  };
}

// Visual compatibility for older map tokens: fill missing local artwork in memory only.
export function withLocalTokenArtwork(token = {}) {
  const typeId = normalizeText(token.typeId || '');
  const label = normalizeText(token.label || '');
  const identity = `${typeId} ${label}`;
  const has = (...terms) => terms.some(term => identity.includes(term));
  const typeVisual = TOKEN_VISUALS[typeId];
  const preserveCatalogSymbol = (artworkToken) => typeVisual
    ? { ...artworkToken, symbolKey: typeVisual.symbolKey }
    : artworkToken;
  token = preserveCatalogSymbol(token);
  if (token.imageUrl) return token;
  if (typeId === 'dragon-r' || has('dragon rojo')) return { ...token, imageUrl: redDragonImage };
  if (typeId === 'dragon-v' || has('dragon verde')) return { ...token, imageUrl: greenDragonImage };
  if (typeId === 'dragon-b' || has('dragon azul')) return { ...token, imageUrl: blueDragonImage };
  if (token.cat === 'monstruo' && (typeId === 'arana' || has('arana', 'araña'))) {
    return { ...token, imageUrl: caveSpiderImage };
  }
  if (token.cat === 'monstruo' && (typeId === 'goblin' || has('goblin'))) {
    return { ...token, imageUrl: goblinScoutImage };
  }
  if (token.cat === 'monstruo' && (typeId === 'el-fuego' || has('elemental de fuego'))) {
    return { ...token, imageUrl: fireElementalImage };
  }
  if (token.cat === 'monstruo' && (typeId === 'golem' || has('golem'))) {
    return { ...token, imageUrl: stoneGolemImage };
  }
  if (token.cat === 'monstruo' && (typeId === 'troll' || typeId === 'gargola')) {
    return { ...token, imageUrl: stoneGolemImage };
  }
  if (token.cat === 'monstruo' && (typeId === 'demonio' || typeId === 'wyvern')) {
    return { ...token, imageUrl: typeId === 'demonio' ? fireElementalImage : greenDragonImage };
  }
  if (has('vampiro', 'lich', 'zombi', 'zombie', 'esqueleto', 'banshee', 'no muerto')) {
    return { ...token, imageUrl: undeadKnightImage };
  }
  if (token.cat === 'trampa' && (typeId === 't-flecha' || has('flecha'))) {
    return { ...token, imageUrl: arrowWallTrapImage };
  }
  if ((token.cat === 'objeto' || token.entityKind === 'object') && has('cofre', 'tesoro')) {
    return { ...token, imageUrl: treasureCofferImage };
  }
  if (identity.includes('npc-aliado') || identity.includes('npc aliado') || identity === 'npc') {
    return { ...token, imageUrl: npcRangerImage };
  }
  const looksLikeNamedPerson = /^[A-Za-zÀ-ÖØ-öø-ÿ'-]+$/.test(String(token.label || '').trim());
  if (token.entityKind === 'character' || token.cat === 'pj'
    || ((token.cat === 'custom' || !token.cat) && looksLikeNamedPerson && ['magic', 'spell'].includes(token.symbolKey))) {
    return { ...token, imageUrl: npcRangerImage };
  }
  return token;
}

export { CLASS_VISUALS, ENTITY_VISUALS, TOKEN_VISUALS };
