const { before, after, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');
const { deleteObject, ref, uploadBytes } = require('firebase/storage');

const PROJECT_ID = 'demo-dnd-app';
let env;

const auth = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true });
const firestore = (uid, email) => auth(uid, email).firestore();
const storage = (uid, email) => auth(uid, email).storage(`gs://${PROJECT_ID}.appspot.com`);

async function seedBaseData() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'profiles', 'dm-1'), { email: 'dm@example.test', role: 'Dungeon Master' }),
      setDoc(doc(db, 'profiles', 'player-1'), { email: 'player@example.test', role: 'Jugador' }),
      setDoc(doc(db, 'maps', 'secret-map'), {
        title: 'Mapa privado', visibleToParty: true,
        tokens: [{ id: 'trap', label: 'Trampa secreta', visibleToParty: false }],
      }),
      setDoc(doc(db, 'public_maps', 'public-map'), {
        title: 'Mapa publicado', tokens: [{ id: 'hero', label: 'Aurelian', visibleToParty: true }],
      }),
      setDoc(doc(db, 'dm_session_notes', 'session-1'), { text: 'El villano es el rey.' }),
      setDoc(doc(db, 'sessions', 'visible-session'), { visibleToParty: true, title: 'Sesión visible' }),
      setDoc(doc(db, 'sessions', 'hidden-session'), { visibleToParty: false, title: 'Sesión secreta' }),
      setDoc(doc(db, 'characters', 'player-character'), { ownerEmail: 'player@example.test', name: 'Aurelian' }),
    ]);
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1', port: 8080,
      rules: fs.readFileSync(path.resolve('firestore.rules'), 'utf8'),
    },
    storage: {
      host: '127.0.0.1', port: 9199,
      rules: fs.readFileSync(path.resolve('storage.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedBaseData();
});

after(async () => {
  await env.cleanup();
});

describe('Firestore: separación DM / party', { concurrency: false }, () => {
  test('una persona no autenticada no puede leer la campaña', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'public_maps', 'public-map')));
  });

  test('la party ve la proyección pública pero no el mapa editable', async () => {
    const db = firestore('player-1', 'player@example.test');
    await assertSucceeds(getDoc(doc(db, 'public_maps', 'public-map')));
    await assertFails(getDoc(doc(db, 'maps', 'secret-map')));
  });

  test('la party solo puede consultar sesiones visibles', async () => {
    const db = firestore('player-1', 'player@example.test');
    const visible = await assertSucceeds(getDocs(query(
      collection(db, 'sessions'),
      where('visibleToParty', '==', true),
    )));
    assert.equal(visible.size, 1);
    await assertFails(getDoc(doc(db, 'sessions', 'hidden-session')));
  });

  test('las notas privadas solo son accesibles para el DM', async () => {
    const playerDb = firestore('player-1', 'player@example.test');
    const dmDb = firestore('dm-1', 'dm@example.test');
    await assertFails(getDoc(doc(playerDb, 'dm_session_notes', 'session-1')));
    await assertSucceeds(getDoc(doc(dmDb, 'dm_session_notes', 'session-1')));
  });

  test('un jugador solo modifica su personaje y no puede cambiar propietario', async () => {
    const db = firestore('player-1', 'player@example.test');
    await assertSucceeds(updateDoc(doc(db, 'characters', 'player-character'), { hp: 20 }));
    await assertFails(updateDoc(doc(db, 'characters', 'player-character'), { ownerEmail: 'attacker@example.test' }));
  });

  test('solo el DM publica y las revisiones deben ser consecutivas', async () => {
    const playerDb = firestore('player-1', 'player@example.test');
    const dmDb = firestore('dm-1', 'dm@example.test');
    await assertFails(setDoc(doc(playerDb, 'live_sessions', 'main'), { active: true, revision: 1 }));
    await assertSucceeds(setDoc(doc(dmDb, 'live_sessions', 'main'), { active: true, revision: 1 }));
    await assertFails(updateDoc(doc(dmDb, 'live_sessions', 'main'), { revision: 3 }));
    await assertSucceeds(updateDoc(doc(dmDb, 'live_sessions', 'main'), { revision: 2 }));
  });

  test('una mesa heredada sin revisión puede migrar una sola vez a revisión 1', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'live_sessions', 'legacy'), { active: false });
    });
    const dmDb = firestore('dm-1', 'dm@example.test');
    await assertFails(updateDoc(doc(dmDb, 'live_sessions', 'legacy'), { revision: 2 }));
    await assertSucceeds(updateDoc(doc(dmDb, 'live_sessions', 'legacy'), { revision: 1 }));
    await assertFails(updateDoc(doc(dmDb, 'live_sessions', 'legacy'), { revision: 3 }));
  });
});

describe('Storage: imágenes y propiedad', { concurrency: false }, () => {
  const image = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

  test('un jugador sube y elimina su retrato, pero no el de otra cuenta', async () => {
    const playerStorage = storage('player-1', 'player@example.test');
    await assertSucceeds(uploadBytes(
      ref(playerStorage, 'portraits/profiles/player-1_avatar.webp'), image,
      { contentType: 'image/webp' },
    ));
    await assertFails(uploadBytes(
      ref(playerStorage, 'portraits/profiles/dm-1_avatar.webp'), image,
      { contentType: 'image/webp' },
    ));
    await assertSucceeds(deleteObject(ref(playerStorage, 'portraits/profiles/player-1_avatar.webp')));
  });

  test('Storage rechaza contenido no gráfico y mapas subidos por jugadores', async () => {
    const playerStorage = storage('player-1', 'player@example.test');
    await assertFails(uploadBytes(
      ref(playerStorage, 'portraits/profiles/player-1_notes.txt'), image,
      { contentType: 'text/plain' },
    ));
    await assertFails(uploadBytes(
      ref(playerStorage, 'maps/forbidden.webp'), image,
      { contentType: 'image/webp' },
    ));
  });

  test('el DM puede administrar imágenes de mapas', async () => {
    const dmStorage = storage('dm-1', 'dm@example.test');
    const mapRef = ref(dmStorage, 'maps/scene.webp');
    await assertSucceeds(uploadBytes(mapRef, image, { contentType: 'image/webp' }));
    await assertSucceeds(deleteObject(mapRef));
  });
});
