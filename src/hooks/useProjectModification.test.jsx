import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useProjectModification from './useProjectModification';

let readyCallback;

beforeEach(() => {
    vi.useFakeTimers();
    readyCallback = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => {
        readyCallback = callback;
        return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const renderTracker = (value = 1) => renderHook(
    ({ dependency }) => useProjectModification([dependency]),
    { initialProps: { dependency: value } }
);

describe('useProjectModification', () => {
    it('ignore l’initialisation puis marque une modification utilisateur', () => {
        const { result, rerender } = renderTracker();
        expect(result.current.projectModified).toBe(false);
        act(() => readyCallback());
        rerender({ dependency: 2 });
        expect(result.current.projectModified).toBe(true);
        expect(result.current.isDirty).toBe(true);
        expect(result.current.hasUnsavedChanges.current).toBe(true);
    });

    it('avertit le navigateur uniquement si le projet est sale', () => {
        const { result, rerender } = renderTracker();
        let event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);

        act(() => readyCallback());
        rerender({ dependency: 2 });
        expect(result.current.isDirty).toBe(true);
        event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('resetModified nettoie l’état et absorbe une cascade de chargement', () => {
        const { result, rerender } = renderTracker();
        act(() => readyCallback());
        rerender({ dependency: 2 });
        act(() => result.current.resetModified());
        expect(result.current.projectModified).toBe(false);
        expect(result.current.isDirty).toBe(false);

        rerender({ dependency: 3 });
        expect(result.current.projectModified).toBe(false);
        act(() => vi.advanceTimersByTime(300));
        // Le premier changement après chargement consomme le drapeau de saut.
        rerender({ dependency: 4 });
        expect(result.current.projectModified).toBe(false);
        rerender({ dependency: 5 });
        expect(result.current.projectModified).toBe(true);
    });

    it('setHasUnsavedChanges pilote l’indicateur et le ref miroir', () => {
        const { result } = renderTracker();
        act(() => result.current.setHasUnsavedChanges(true));
        expect(result.current.isDirty).toBe(true);
        expect(result.current.hasUnsavedChanges.current).toBe(true);
        act(() => result.current.setHasUnsavedChanges(false));
        expect(result.current.isDirty).toBe(false);
        expect(result.current.hasUnsavedChanges.current).toBe(false);
    });

    it('absorbDerivedChanges ignore les recopies sans effacer une modification', () => {
        const { result, rerender } = renderTracker();
        act(() => readyCallback());
        rerender({ dependency: 2 }); // consomme le drapeau de saut du montage
        act(() => result.current.setHasUnsavedChanges(false));
        act(() => vi.advanceTimersByTime(300));

        // Changement de plan de feux : la recopie n'est pas une modification.
        act(() => result.current.absorbDerivedChanges());
        rerender({ dependency: 3 });
        expect(result.current.isDirty).toBe(false);

        // Passé le délai, une vraie modification est signalée…
        act(() => vi.advanceTimersByTime(300));
        rerender({ dependency: 4 });
        expect(result.current.isDirty).toBe(true);

        // … et elle le reste après un nouveau changement de plan.
        act(() => result.current.absorbDerivedChanges());
        rerender({ dependency: 5 });
        expect(result.current.isDirty).toBe(true);
    });

    it('retire les écouteurs et annule l’initialisation au démontage', () => {
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderTracker();
        unmount();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
        expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
});
