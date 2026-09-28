import { createLiveSessionPayload, createPublicMapSnapshot } from './liveSession';

const privateMap = {
  id: 'templo', title: 'Templo hundido', imageUrl: 'https://example.test/map.webp',
  viewport: { t: 5, r: 0, b: 10, l: 0 },
  fog: { enabled: true, cols: 24, rows: 16, hidden: ['1:1', '2:1'] },
  tokens: [
    { id: 'hero', label: 'Aurelian', x: 25, y: 50, size: 3, visibleToParty: true,
      entityKind: 'character', className: 'Paladín', classKey: 'paladin', symbolKey: 'shield',
      level: 5, hp: 27, hpMax: 34, armorClass: 18, characterId: 'private-character-id', notes: 'secreto DM' },
    { id: 'trap', label: 'Trampa secreta', x: 70, y: 10, size: 2, visibleToParty: false, secret: 'poison' },
  ],
  dmNotes: 'No revelar el altar',
};

test('la proyección pública elimina secretos y tokens ocultos', () => {
  const result = createPublicMapSnapshot(privateMap);
  expect(result.tokens).toHaveLength(1);
  expect(result.tokens[0].label).toBe('Aurelian');
  expect(result.tokens[0]).toMatchObject({ className: 'Paladín', level: 5, hp: 27, hpMax: 34, symbolKey: 'shield' });
  expect(result.tokens[0]).not.toHaveProperty('armorClass');
  expect(result.tokens[0]).not.toHaveProperty('characterId');
  expect(result.tokens[0]).not.toHaveProperty('notes');
  expect(result).not.toHaveProperty('dmNotes');
  expect(JSON.stringify(result)).not.toContain('Trampa secreta');
  expect(JSON.stringify(result)).not.toContain('poison');
});

test('la publicación limita campos y crea una revisión explícita', () => {
  const result = createLiveSessionPayload({
    title: 'Rakets', message: 'Entren al templo', mode: 'combate', showCombat: true,
    injected: 'no debe publicarse',
  }, privateMap, true, 8);
  expect(result.revision).toBe(8);
  expect(result.active).toBe(true);
  expect(result.mapSnapshot.id).toBe('templo');
  expect(result).not.toHaveProperty('injected');
});

test('pausar retira el mapa publicado', () => {
  const result = createLiveSessionPayload({}, privateMap, false, 2);
  expect(result.active).toBe(false);
  expect(result.mapId).toBe('');
  expect(result.mapSnapshot).toBeNull();
});
