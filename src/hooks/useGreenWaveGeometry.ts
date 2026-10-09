import { useMemo } from 'react';
import { computeLeftPadding, computeRightPadding, computeTickSpace, truncateName, LABEL_GAP } from '../utils/greenWaveLayout';
import type { GreenWaveIntersection } from '../types/greenWave';

/** Repère du diagramme d'onde verte : échelles, marges, graduations et conversions. */
export interface GreenWaveGeometry {
    maxTime: number;
    minDistance: number;
    maxDistance: number;
    /** Cycle du premier carrefour, qui cadence l'affichage. */
    cycleLength: number;
    timeTicks: number[];
    distanceTicks: number[];
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    /** Abscisse des libellés, alignés à droite avant les chiffres de l'axe. */
    labelX: number;
    diagramWidth: number;
    diagramHeight: number;
    timeToX: (time: number) => number;
    distanceToY: (distance: number) => number;
}

const PADDING_BOTTOM = 50;
const PADDING_TOP = 20;

/**
 * Calcule le repère du diagramme à partir des carrefours et des zooms.
 *
 * L'axe des distances garde toujours 0 dans le champ et 50 m de marge, au-dessus
 * comme en dessous quand des carrefours sont placés en négatif.
 */
const useGreenWaveGeometry = (
    intersections: readonly GreenWaveIntersection[] | null,
    displayCycles: number,
    pixelsPerSecond: number,
    pixelsPerMeter: number
): GreenWaveGeometry => {
    const { maxTime, minDistance, maxDistance, cycleLength } = useMemo(() => {
        if (!intersections || intersections.length === 0) {
            return { maxTime: 100, minDistance: 0, maxDistance: 500, cycleLength: 100 };
        }

        // On considère les deux colonnes (distance + distanceG2 pour le bi-carrefour).
        // 0 reste toujours dans la fenêtre d'affichage (repère central pour l'axe),
        // et on ajoute 50 m de respiration en haut comme en bas si négatif.
        const allDistances = intersections.flatMap(i => [i.distance, i.distanceG2 ?? i.distance]);
        const minDist = Math.min(0, ...allDistances);
        const maxDist = Math.max(...allDistances);
        const cycle = intersections[0]?.cycleLength || 100;

        return {
            maxTime: cycle * displayCycles, // Show 2 or 3 cycles
            minDistance: minDist < 0 ? minDist - 50 : 0,
            maxDistance: maxDist + 50,
            cycleLength: cycle
        };
    }, [intersections, displayCycles]);

    const distanceTicks: number[] = [];
    const distanceSpan = maxDistance - minDistance;
    const distanceStep = distanceSpan > 500 ? 100 : 50;
    // Graduation arrondie au pas inférieur pour démarrer proprement (ex. -180 → -200).
    const firstTick = Math.floor(minDistance / distanceStep) * distanceStep;
    for (let d = firstTick; d <= maxDistance; d += distanceStep) {
        distanceTicks.push(d);
    }

    // Colonne des chiffres de l'axe des distances, à gauche comme dans le
    // rappel à droite du diagramme.
    const tickSpace = computeTickSpace(distanceTicks);

    // Marge gauche élargie au besoin pour que les noms de carrefours et de
    // groupes, alignés à droite avant les chiffres de l'axe, ne soient ni
    // tronqués au début ni superposés à ces chiffres.
    const paddingLeft = useMemo(() => {
        const labels: string[] = [];
        intersections?.forEach(intersection => {
            labels.push(truncateName(intersection.projectName));
            [intersection.selectedGroup1, intersection.selectedGroup2].forEach(groupId => {
                const group = intersection.groups?.find(g => g.id === groupId);
                if (group) labels.push(`G${group.id} - ${truncateName(group.name) || 'Sans nom'}`);
            });
        });
        return computeLeftPadding(labels, tickSpace);
    }, [intersections, tickSpace]);
    const labelX = paddingLeft - tickSpace - LABEL_GAP;
    const paddingRight = computeRightPadding(tickSpace);

    const diagramWidth = maxTime * pixelsPerSecond + paddingLeft + paddingRight;
    const diagramHeight = (maxDistance - minDistance) * pixelsPerMeter + PADDING_TOP + PADDING_BOTTOM;

    // Convert coordinates : Y est mesuré depuis le bas du diagramme, où se
    // trouve la distance minimale (négative possible).
    const timeToX = (time: number): number => paddingLeft + time * pixelsPerSecond;
    const distanceToY = (distance: number): number => diagramHeight - PADDING_BOTTOM - (distance - minDistance) * pixelsPerMeter;

    // Generate axis ticks
    const timeTicks: number[] = [];
    const timeStep = cycleLength >= 60 ? 10 : 5;
    for (let t = 0; t <= maxTime; t += timeStep) {
        timeTicks.push(t);
    }

    return {
        maxTime, minDistance, maxDistance, cycleLength,
        timeTicks, distanceTicks,
        paddingLeft, paddingRight, paddingTop: PADDING_TOP, paddingBottom: PADDING_BOTTOM,
        labelX, diagramWidth, diagramHeight,
        timeToX, distanceToY
    };
};

export default useGreenWaveGeometry;
