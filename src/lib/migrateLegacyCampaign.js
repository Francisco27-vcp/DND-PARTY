import {
  collection, deleteField, doc, getDoc, getDocs, serverTimestamp,
  setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { createPublicMapSnapshot } from './liveSession';

const LEGACY_COLLECTIONS = [
  { name: 'sessions', field: 'visibleToParty', fallback: true },
  { name: 'timeline', field: 'visibleToParty', fallback: true },
  { name: 'npcs', field: 'visibleToPlayers', fallback: false },
  { name: 'locations', field: 'visibleToPlayers', fallback: false },
  { name: 'factions', field: 'visibleToPlayers', fallback: false },
  { name: 'maps', field: 'visibleToParty', fallback: false },
];

// Normalizes documents created before visibility fields existed. This must run
// as a DM because campaign collections are intentionally write-protected.
export async function migrateLegacyCampaignVisibility() {
  const markerRef = doc(db, 'schema_migrations', 'campaign_security_v3');
  const marker = await getDoc(markerRef);
  if (marker.exists()) return 0;

  const pending = [];

  for (const config of LEGACY_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, config.name));
    snapshot.docs.forEach(snapshotDoc => {
      if (!(config.field in snapshotDoc.data())) {
        pending.push({
          ref: doc(db, config.name, snapshotDoc.id),
          field: config.field,
          value: config.fallback,
        });
      }
    });
  }

  for (let start = 0; start < pending.length; start += 450) {
    const batch = writeBatch(db);
    pending.slice(start, start + 450).forEach(item => {
      batch.set(item.ref, { [item.field]: item.value }, { merge: true });
    });
    await batch.commit();
  }

  // Move private DM notes out of party-readable session documents.
  const sessions = await getDocs(collection(db, 'sessions'));
  const noteMigrations = sessions.docs
    .filter(session => typeof session.data().dmNotes === 'string' && session.data().dmNotes.trim())
    .map(session => ({ id: session.id, text: session.data().dmNotes }));

  for (let start = 0; start < noteMigrations.length; start += 225) {
    const batch = writeBatch(db);
    noteMigrations.slice(start, start + 225).forEach(item => {
      batch.set(doc(db, 'dm_session_notes', item.id), {
        text: item.text,
        migratedAt: serverTimestamp(),
      }, { merge: true });
      batch.update(doc(db, 'sessions', item.id), { dmNotes: deleteField() });
    });
    await batch.commit();
  }

  // Public maps are whitelisted copies. Party clients never read editable DM maps.
  const maps = await getDocs(collection(db, 'maps'));
  const publicMaps = maps.docs.filter(map => map.data().visibleToParty === true);
  for (let start = 0; start < publicMaps.length; start += 450) {
    const batch = writeBatch(db);
    publicMaps.slice(start, start + 450).forEach(map => {
      batch.set(doc(db, 'public_maps', map.id), {
        ...createPublicMapSnapshot({ id: map.id, ...map.data() }),
        publishedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const liveSessionRef = doc(db, 'live_sessions', 'main');
  const liveSession = await getDoc(liveSessionRef);
  const migratedLiveRevision = liveSession.exists() && !('revision' in liveSession.data());
  if (migratedLiveRevision) {
    await setDoc(liveSessionRef, { revision: 1, migratedAt: serverTimestamp() }, { merge: true });
  }

  await setDoc(markerRef, {
    completedAt: serverTimestamp(),
    visibilityDocuments: pending.length,
    privateNotes: noteMigrations.length,
    publicMaps: publicMaps.length,
    liveRevision: migratedLiveRevision,
  });

  return pending.length + noteMigrations.length + publicMaps.length + Number(migratedLiveRevision);
}
