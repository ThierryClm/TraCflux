import { useRef, useEffect, useCallback } from 'react';

const DATABASE_NAME = 'DiagrammeFeux_FileHandles';
const STORE_NAME = 'handles';

/**
 * Gère les handles de répertoires via IndexedDB (File System Access API).
 * Mémorise les 5 derniers répertoires utilisés (ouverture, sauvegarde, import, image, onde verte)
 * et les restaure au démarrage.
 */
const useDirectoryHandles = () => {
    const lastOpenDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
    const lastSaveDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
    const lastImportDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
    const lastImageDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);
    const lastGreenWaveDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);

    const openIndexedDB = useCallback((): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }, []);

    const saveDirectoryHandle = useCallback(async (
        key: string,
        handle: FileSystemDirectoryHandle
    ): Promise<void> => {
        try {
            const db = await openIndexedDB();
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(handle, key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Erreur sauvegarde handle:', error);
        }
    }, [openIndexedDB]);

    const loadDirectoryHandle = useCallback(async (
        key: string
    ): Promise<FileSystemDirectoryHandle | null> => {
        try {
            const db = await openIndexedDB();
            return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onsuccess = () => {
                    resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Erreur chargement handle:', error);
            return null;
        }
    }, [openIndexedDB]);

    // Charger les derniers répertoires au démarrage
    useEffect(() => {
        const loadHandles = async () => {
            try {
                const openHandle = await loadDirectoryHandle('lastOpenDirectory');
                const saveHandle = await loadDirectoryHandle('lastSaveDirectory');
                const importHandle = await loadDirectoryHandle('lastImportDirectory');
                const imageHandle = await loadDirectoryHandle('lastImageDirectory');
                const greenWaveHandle = await loadDirectoryHandle('lastGreenWaveDirectory');
                if (openHandle) lastOpenDirectoryRef.current = openHandle;
                if (saveHandle) lastSaveDirectoryRef.current = saveHandle;
                if (importHandle) lastImportDirectoryRef.current = importHandle;
                if (imageHandle) lastImageDirectoryRef.current = imageHandle;
                if (greenWaveHandle) lastGreenWaveDirectoryRef.current = greenWaveHandle;
            } catch (error) {
                console.error('Erreur chargement handles:', error);
            }
        };
        void loadHandles();
    }, [loadDirectoryHandle]);

    return {
        lastOpenDirectoryRef,
        lastSaveDirectoryRef,
        lastImportDirectoryRef,
        lastImageDirectoryRef,
        lastGreenWaveDirectoryRef,
        saveDirectoryHandle,
        loadDirectoryHandle
    };
};

export default useDirectoryHandles;
