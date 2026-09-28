import { createCharacterToken, getTacticalVisual, hydrateMapCharacters, normalizeClassKey } from './tacticalTokens';

test('normaliza clases en español y conserva una alternativa segura', () => {
  expect(normalizeClassKey('Pícaro nivel 4')).toBe('picaro');
  expect(normalizeClassKey('Clérigo de la Luz')).toBe('clerigo');
  expect(normalizeClassKey('Clase casera')).toBe('guerrero');
});

test('crea una ficha táctica vinculada con información del DM', () => {
  const token = createCharacterToken({
    id: 'aurelian', name: 'Aurelian', class: 'Paladín', level: 5,
    hp: 27, hpMax: 34, ac: 18, portrait: '/aurelian.webp',
  }, { id: 'token-1', x: 20, y: 30, size: 3 });
  expect(token).toMatchObject({
    id: 'token-1', entityKind: 'character', characterId: 'aurelian',
    classKey: 'paladin', symbolKey: 'shield', hp: 27, hpMax: 34, armorClass: 18,
  });
});

test('actualiza las estadísticas de personajes vinculados sin mover la ficha', () => {
  const map = { tokens: [{ id: 't1', characterId: 'mog', x: 72, y: 44, size: 4 }] };
  const result = hydrateMapCharacters(map, [{ id: 'mog', name: 'Mog', class: 'Bárbaro', hp: 19, hpMax: 31, level: 4, ac: 14 }]);
  expect(result.tokens[0]).toMatchObject({ id: 't1', x: 72, y: 44, label: 'Mog', hp: 19, classKey: 'barbaro' });
  expect(getTacticalVisual({ cat: 'trampa' }).symbolKey).toBe('shield');
});
