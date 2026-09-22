import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDirectoryHandles from './useDirectoryHandles';

const installIndexedDB = (initial = {}, { failOpen = false } = {}) => {
    const values = new Map(Object.entries(initial));
    const createObjectStore = vi.fn();
    const db = {
        objectStoreNames: { contains: vi.fn(() => false) },
        createObjectStore,
        transaction: vi.fn(() => ({
            objectStore: () => ({
                get(key) {
                    const request = {};
                    queueMicrotask(() => {
                        request.result = values.get(key);
                        request.onsuccess?.();
                    });
                    return request;
                },
                put(handle, key) {
                    const request = {};
                    queueMicrotask(() => {
                        values.set(key, handle);
                        request.onsuccess?.();
                    });
                    return request;
                }
            })
        }))
    };
    const open = vi.fn(() => {
        const request = {};
        queueMicrotask(() => {
            if (failOpen) {
                request.error = new Error('IndexedDB indisponible');
                request.onerror?.();
                return;
            }
            request.onupgradeneeded?.({ target: { result: db } });
            request.result = db;
            request.onsuccess?.();
        });
        return request;
    });
    vi.stubGlobal('indexedDB', { open });
    return { values, open, createObjectStore, db };
};

beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('useDirectoryHandles', () => {
    it('ouvre et initialise la base de handles', async () => {
        const indexed = installIndexedDB();
        renderHook(() => useDirectoryHandles());
        await waitFor(() => expect(indexed.open).toHaveBeenCalled());
        expect(indexed.open).toHaveBeenCalledWith('DiagrammeFeux_FileHandles', 1);
        expect(indexed.createObjectStore).toHaveBeenCalledWith('handles');
    });

    it('restaure les cinq derniers répertoires au démarrage', async () => {
        const handles = {
            lastOpenDirectory: { name: 'open' },
            lastSaveDirectory: { name: 'save' },
            lastImportDirectory: { name: 'import' },
            lastImageDirectory: { name: 'image' },
            lastGreenWaveDirectory: { name: 'greenwave' }
        };
        installIndexedDB(handles);
        const { result } = renderHook(() => useDirectoryHandles());
        await waitFor(() => expect(result.current.lastGreenWaveDirectoryRef.current).toEqual(handles.lastGreenWaveDirectory));
        expect(result.current.lastOpenDirectoryRef.current).toEqual(handles.lastOpenDirectory);
        expect(result.current.lastSaveDirectoryRef.current).toEqual(handles.lastSaveDirectory);
        expect(result.current.lastImportDirectoryRef.current).toEqual(handles.lastImportDirectory);
        expect(result.current.lastImageDirectoryRef.current).toEqual(handles.lastImageDirectory);
    });

    it('sauvegarde puis recharge un handle', async () => {
        installIndexedDB();
        const { result } = renderHook(() => useDirectoryHandles());
        const handle = { name: 'Etudes' };
        await act(async () => { await result.current.saveDirectoryHandle('personnel', handle); });
        await expect(result.current.loadDirectoryHandle('personnel')).resolves.toBe(handle);
    });

    it('retourne null et journalise si IndexedDB échoue', async () => {
        installIndexedDB({}, { failOpen: true });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = renderHook(() => useDirectoryHandles());
        await expect(result.current.loadDirectoryHandle('absent')).resolves.toBeNull();
        await expect(result.current.saveDirectoryHandle('x', {})).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });
});
