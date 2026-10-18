import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// exampleMode lit l'URL au premier import : chaque test réimporte le hook
// après avoir posé son URL (cf. utils/exampleMode.test).
const charger = async (search) => {
    window.history.replaceState(null, '', window.location.pathname + search);
    vi.resetModules();
    return import('./useModeExemple');
};

const options = (surcharge = {}) => ({
    loadFullState: vi.fn(),
    loadFullStateRaw: vi.fn(),
    setProjectModified: vi.fn(),
    projectModifiedSkip: { current: true },
    setHasUnsavedChanges: vi.fn(),
    setFloatingCrop: vi.fn(),
    setFloatingZoom: vi.fn(),
    markLegacyCrop: vi.fn(),
    hasActiveProject: false,
    setHasActiveProject: vi.fn(),
    ...surcharge,
});

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', window.location.pathname);
});

describe('mode exemple', () => {
    it('hors exemple : faux, et le chargement passe au chargeur brut', async () => {
        const { useModeExemple } = await charger('');
        const brut = vi.fn(() => 'ok');
        const { result } = renderHook(() => useModeExemple(brut));
        expect(result.current.isExample).toBe(false);
        expect(result.current.loadFullState({ projectName: 'P' })).toBe('ok');
        expect(brut).toHaveBeenCalledWith({ projectName: 'P' });
    });

    it("ouvrir un vrai projet quitte le mode exemple", async () => {
        const { useModeExemple } = await charger('?example=carrefour');
        const { result } = renderHook(() => useModeExemple(vi.fn()));
        expect(result.current.isExample).toBe(true);
        act(() => { result.current.loadFullState({}); });
        expect(result.current.isExample).toBe(false);
    });
});

describe('chargements au démarrage', () => {
    it('?duplicate : charge l’état copié, le retire et nettoie l’URL', async () => {
        sessionStorage.setItem('duplicate_42', JSON.stringify({ projectName: 'Copie' }));
        const { useChargementDemarrage } = await charger('?duplicate=42');
        const o = options();
        renderHook(() => useChargementDemarrage(o));
        expect(o.loadFullState).toHaveBeenCalledWith({ projectName: 'Copie' });
        expect(sessionStorage.getItem('duplicate_42')).toBeNull();
        expect(window.location.search).toBe('');
    });

    it('?example=carrefour : charge l’exemple sans le compter comme modifié', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ intersectionName: 'Carrefour' }) })));
        const { useChargementDemarrage } = await charger('?example=carrefour');
        const o = options();
        renderHook(() => useChargementDemarrage(o));
        await waitFor(() => expect(o.setHasActiveProject).toHaveBeenCalledWith(true));
        expect(o.loadFullStateRaw).toHaveBeenCalledWith({ projectName: 'Carrefour', intersectionName: 'Carrefour' });
        expect(o.loadFullState).not.toHaveBeenCalled();
        expect(o.projectModifiedSkip.current).toBe(false);
        expect(o.setHasUnsavedChanges).toHaveBeenCalledWith(false);
        expect(o.markLegacyCrop).toHaveBeenCalledWith(false);
        expect(window.location.search).toBe('');
    });

    it('sans paramètre : rien n’est chargé', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const { useChargementDemarrage } = await charger('');
        const o = options();
        renderHook(() => useChargementDemarrage(o));
        expect(fetch).not.toHaveBeenCalled();
        expect(o.loadFullState).not.toHaveBeenCalled();
    });
});
