import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import usePhasageBulleUI from './usePhasageBulleUI';

describe('usePhasageBulleUI', () => {
    it('initialise les groupes visibles depuis les flèches à l’activation', () => {
        const arrows = [{ groupId: 1 }, { groupId: 3 }, { groupId: 1 }];
        const { result } = renderHook(() => usePhasageBulleUI(arrows));

        expect(result.current.phasageBulleVisibleGroups.size).toBe(0);
        act(() => result.current.setPhasageBulleEnabled(true));

        expect([...result.current.phasageBulleVisibleGroups]).toEqual([1, 3]);
    });

    it('masque puis réaffiche un groupe', () => {
        const { result } = renderHook(() => usePhasageBulleUI([{ groupId: 1 }, { groupId: 2 }]));
        act(() => result.current.setPhasageBulleEnabled(true));

        act(() => result.current.togglePhasageBulleGroup(2));
        expect(result.current.phasageBulleVisibleGroups.has(2)).toBe(false);

        act(() => result.current.togglePhasageBulleGroup(2));
        expect(result.current.phasageBulleVisibleGroups.has(2)).toBe(true);
    });

    it('conserve une sélection déjà personnalisée', () => {
        const { result, rerender } = renderHook(
            ({ arrows }) => usePhasageBulleUI(arrows),
            { initialProps: { arrows: [{ groupId: 1 }] } }
        );
        act(() => result.current.setPhasageBulleVisibleGroups(new Set([9])));
        act(() => result.current.setPhasageBulleEnabled(true));
        rerender({ arrows: [{ groupId: 1 }, { groupId: 2 }] });

        expect([...result.current.phasageBulleVisibleGroups]).toEqual([9]);
    });
});
