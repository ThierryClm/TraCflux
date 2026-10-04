import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useSimulationUI, { VITESSES_SIMULATION } from './useSimulationUI';

describe('useSimulationUI', () => {
    it('fournit un état de simulation neutre', () => {
        const { result } = renderHook(() => useSimulationUI());

        expect(VITESSES_SIMULATION).toEqual([1, 2, 5]);
        expect(result.current.isPlayingSimulation).toBe(false);
        expect(result.current.simulationCurrentTime).toBe(0);
        expect(result.current.hoveredDiagramTime).toBeNull();
        expect(result.current.simulationSpeed).toBe(1);
    });

    it('fait défiler les vitesses disponibles en boucle', () => {
        const { result } = renderHook(() => useSimulationUI());

        act(() => result.current.cycleSimulationSpeed());
        expect(result.current.simulationSpeed).toBe(2);
        act(() => result.current.cycleSimulationSpeed());
        expect(result.current.simulationSpeed).toBe(5);
        act(() => result.current.cycleSimulationSpeed());
        expect(result.current.simulationSpeed).toBe(1);
    });

    it('met à jour la lecture, le temps et le survol', () => {
        const { result } = renderHook(() => useSimulationUI());

        act(() => {
            result.current.setIsPlayingSimulation(true);
            result.current.setSimulationCurrentTime(18);
            result.current.setHoveredDiagramTime(21.5);
        });

        expect(result.current.isPlayingSimulation).toBe(true);
        expect(result.current.simulationCurrentTime).toBe(18);
        expect(result.current.hoveredDiagramTime).toBe(21.5);
    });
});
