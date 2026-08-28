import { useState, useCallback } from 'react';

/** Vitesses de déroulement proposées, dans l'ordre du bouton. */
export const VITESSES_SIMULATION = [1, 2, 5];

/**
 * Gère les états UI de la simulation (lecture, temps courant, survol du diagramme).
 */
const useSimulationUI = () => {
    const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);
    const [simulationCurrentTime, setSimulationCurrentTime] = useState(0);
    const [hoveredDiagramTime, setHoveredDiagramTime] = useState(null);

    // Vitesse de déroulement. Volontairement NON persistée, ni au projet ni au
    // navigateur : c'est un confort de lecture du moment, pas une donnée. On
    // repart donc toujours à ×1.
    const [simulationSpeed, setSimulationSpeed] = useState(1);

    const cycleSimulationSpeed = useCallback(() => {
        setSimulationSpeed(v => {
            const i = VITESSES_SIMULATION.indexOf(v);
            return VITESSES_SIMULATION[(i + 1) % VITESSES_SIMULATION.length];
        });
    }, []);

    return {
        isPlayingSimulation, setIsPlayingSimulation,
        simulationCurrentTime, setSimulationCurrentTime,
        hoveredDiagramTime, setHoveredDiagramTime,
        simulationSpeed, cycleSimulationSpeed
    };
};

export default useSimulationUI;
