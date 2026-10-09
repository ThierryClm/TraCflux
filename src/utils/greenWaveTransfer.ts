/**
 * Reprise d'une onde verte créée dans la fenêtre principale.
 *
 * La fenêtre principale dépose les carrefours et les réglages sous un
 * identifiant, dans sessionStorage, ou dans IndexedDB quand ils sont trop gros
 * (paramètre d'URL `idb`). La fenêtre Onde verte les relit à son ouverture ;
 * dans IndexedDB, elle les efface ensuite.
 */
import type { GreenWaveIntersection, GreenWaveSettings } from '../types/greenWave';

const DATABASE_NAME = 'DiagrammeFeux_GreenWave';
const STORE_NAME = 'data';

export interface GreenWaveTransfer {
    intersections: GreenWaveIntersection[] | null;
    settings: GreenWaveSettings | null;
}

const openTransferDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
        }
    };
});

/** Lit, puis efface, l'onde verte déposée dans IndexedDB sous cet identifiant. */
export const takeGreenWaveFromIndexedDB = async (greenWaveId: string): Promise<GreenWaveTransfer> => {
    const db = await openTransferDatabase();

    const getData = <T>(key: string) => new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const deleteData = (key: string) => new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });

    const intersections = await getData<GreenWaveIntersection[]>(`greenwave_${greenWaveId}`);
    const settings = await getData<GreenWaveSettings>(`greenwave_settings_${greenWaveId}`);

    await deleteData(`greenwave_${greenWaveId}`);
    await deleteData(`greenwave_settings_${greenWaveId}`);

    return { intersections: intersections ?? null, settings: settings ?? null };
};
