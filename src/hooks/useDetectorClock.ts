import { useEffect, useState } from 'react';
import { demarrerHorloge } from '../utils/horlogeLecture';

/** Pas de l'animation des boucles, en secondes. */
export const PAS_ANIMATION_DETECTEURS_S = 0.1;

interface Options {
    isPlaying: boolean;
    /** Instant du diagramme, en secondes entières. */
    currentTime: number;
    cycleLength: number;
    playbackSpeed?: number;
}

/**
 * Horloge propre aux détecteurs, plus fine que celle du diagramme.
 *
 * Le diagramme avance d'une seconde à la fois : ses flèches et ses signaux
 * changent donc à la seconde. Les boucles, elles, s'animent au dixième de
 * seconde. Cette horloge se recale sur l'instant du diagramme à chaque fois
 * qu'il change (lecture, pause, déplacement du curseur), puis avance par pas
 * de 0,1 s entre deux secondes.
 */
const useDetectorClock = ({
    isPlaying,
    currentTime,
    cycleLength,
    playbackSpeed = 1
}: Options): number => {
    const [detectorTime, setDetectorTime] = useState(currentTime);

    useEffect(() => {
        setDetectorTime(currentTime);
        if (!isPlaying || cycleLength <= 0) return;

        const vitesse = playbackSpeed > 0 ? playbackSpeed : 1;
        return demarrerHorloge(100 / vitesse, () => {
            setDetectorTime(prev => {
                const next = Math.round((prev + PAS_ANIMATION_DETECTEURS_S) * 10) / 10;
                return next >= cycleLength ? 0 : next;
            });
        });
    }, [isPlaying, currentTime, cycleLength, playbackSpeed]);

    return detectorTime;
};

export default useDetectorClock;
