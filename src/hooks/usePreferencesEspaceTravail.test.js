import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBooleenMemorise, usePrefsInfobulles } from './usePreferencesEspaceTravail';

beforeEach(() => localStorage.clear());

describe('interrupteur mémorisé', () => {
    it('absent : la valeur par défaut, puis enregistrée', () => {
        const { result } = renderHook(() => useBooleenMemorise('cle_test', false));
        expect(result.current[0]).toBe(false);
        expect(localStorage.getItem('cle_test')).toBe('false');
        const coche = renderHook(() => useBooleenMemorise('cle_cochee', true));
        expect(coche.result.current[0]).toBe(true);
    });

    it('relu au démarrage, réenregistré à chaque changement', () => {
        localStorage.setItem('cle_test', 'true');
        const { result } = renderHook(() => useBooleenMemorise('cle_test', false));
        expect(result.current[0]).toBe(true);
        act(() => result.current[1](false));
        expect(localStorage.getItem('cle_test')).toBe('false');
    });

    it('valeur illisible : la valeur par défaut, comme avant', () => {
        localStorage.setItem('a', 'oui');
        localStorage.setItem('b', 'oui');
        expect(renderHook(() => useBooleenMemorise('a', false)).result.current[0]).toBe(false);
        expect(renderHook(() => useBooleenMemorise('b', true)).result.current[0]).toBe(true);
    });
});

describe('préférences des infobulles', () => {
    it('toutes cochées par défaut, une section décochée est mémorisée', () => {
        const { result } = renderHook(() => usePrefsInfobulles());
        expect(Object.values(result.current.tooltipPrefs).every(Boolean)).toBe(true);
        act(() => result.current.setTooltipPref('matrix'));
        expect(result.current.tooltipPrefs.matrix).toBe(false);
        expect(JSON.parse(localStorage.getItem('tracflux.tooltips')).matrix).toBe(false);
        expect(renderHook(() => usePrefsInfobulles()).result.current.tooltipPrefs.matrix).toBe(false);
    });

    it('préférence enregistrée illisible : toutes cochées', () => {
        localStorage.setItem('tracflux.tooltips', '{abîmé');
        expect(renderHook(() => usePrefsInfobulles()).result.current.tooltipPrefs.main).toBe(true);
    });
});

 it('ajoute Menu aux anciennes préférences sans réactiver les sections décochées', () => {
    localStorage.setItem('tracflux.tooltips', JSON.stringify({ main: false, matrix: false }));
    const { result } = renderHook(() => usePrefsInfobulles());
    expect(result.current.tooltipPrefs.menu).toBe(true);
    expect(result.current.tooltipPrefs.main).toBe(false);
    act(() => result.current.setTooltipPref('menu'));
    expect(renderHook(() => usePrefsInfobulles()).result.current.tooltipPrefs.menu).toBe(false);
 });
