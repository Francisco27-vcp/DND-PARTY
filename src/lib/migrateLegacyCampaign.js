import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

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

  return pending.length;
}
