import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useIntersectionDisplayOptions from './useIntersectionDisplayOptions';

describe('useIntersectionDisplayOptions — case Signal', () => {
    beforeEach(() => localStorage.clear());

    it('reste décochée par défaut, à la différence des autres cases', () => {
        const { result } = renderHook(() => useIntersectionDisplayOptions());
        expect(result.current.intersectionDisplay).toEqual({
            showCurrents: true, showGroupNumbers: true, showGroupNames: true, showArrows: false,
            showSignals: false, showDetecteurs: true, showDetecteurNames: true
        });
    });

    it('retient le dernier choix dans le navigateur', () => {
        const { result } = renderHook(() => useIntersectionDisplayOptions());
        act(() => result.current.setIntersectionDisplayOption('showSignals', true));
        expect(localStorage.getItem('intersection_showSignals')).toBe('true');
        const { result: rouvert } = renderHook(() => useIntersectionDisplayOptions());
        expect(rouvert.current.intersectionDisplay.showSignals).toBe(true);
    });

    it('rend Flèche et Signaux exclusifs', () => {
        const { result } = renderHook(() => useIntersectionDisplayOptions());

        act(() => result.current.setIntersectionDisplayOption('showSignals', true));
        expect(result.current.intersectionDisplay.showSignals).toBe(true);
        expect(result.current.intersectionDisplay.showCurrents).toBe(false);

        act(() => result.current.setIntersectionDisplayOption('showCurrents', true));
        expect(result.current.intersectionDisplay.showCurrents).toBe(true);
        expect(result.current.intersectionDisplay.showSignals).toBe(false);
    });

    it('reprend un état ancien avec les deux cases cochées en faveur des signaux', () => {
        localStorage.setItem('intersection_showCurrents', 'true');
        localStorage.setItem('intersection_showSignals', 'true');
        const { result } = renderHook(() => useIntersectionDisplayOptions());
        expect(result.current.intersectionDisplay.showCurrents).toBe(false);
        expect(result.current.intersectionDisplay.showSignals).toBe(true);
    });
});
