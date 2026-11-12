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
});
