import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useDetectorClock from './useDetectorClock';

vi.mock('../utils/horlogeLecture', () => ({
    demarrerHorloge: vi.fn((periode: number, tic: () => void) => {
        const id = setInterval(tic, periode);
        return () => clearInterval(id);
    })
}));

const rendre = (options: {
    isPlaying: boolean;
    currentTime: number;
    cycleLength?: number;
    playbackSpeed?: number;
}) => renderHook(
    (props: typeof options) => useDetectorClock({
        cycleLength: 60,
        ...props
    }),
    { initialProps: options }
);

describe('useDetectorClock — horloge fine des détecteurs', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('avance au dixième de seconde pendant la lecture', () => {
        const { result } = rendre({ isPlaying: true, currentTime: 0 });
        expect(result.current).toBe(0);

        act(() => { vi.advanceTimersByTime(300); });
        expect(result.current).toBeCloseTo(0.3, 5);
    });

    it('se recale sur chaque seconde du diagramme sans perdre les dixièmes', () => {
        const { result, rerender } = rendre({ isPlaying: true, currentTime: 0 });

        act(() => { vi.advanceTimersByTime(500); });
        expect(result.current).toBeCloseTo(0.5, 5);

        rerender({ isPlaying: true, currentTime: 1 });
        expect(result.current).toBe(1);

        act(() => { vi.advanceTimersByTime(200); });
        expect(result.current).toBeCloseTo(1.2, 5);
    });

    it('suit la vitesse de lecture', () => {
        const { result } = rendre({ isPlaying: true, currentTime: 0, playbackSpeed: 2 });

        act(() => { vi.advanceTimersByTime(100); });
        expect(result.current).toBeCloseTo(0.2, 5);
    });

    it('à l’arrêt, montre l’instant du diagramme', () => {
        const { result } = rendre({ isPlaying: false, currentTime: 7 });

        act(() => { vi.advanceTimersByTime(500); });
        expect(result.current).toBe(7);
    });

    it('repasse à zéro à la fin du cycle', () => {
        const { result } = rendre({ isPlaying: true, currentTime: 59.9 });

        act(() => { vi.advanceTimersByTime(200); });
        expect(result.current).toBeCloseTo(0.1, 5);
    });
});
