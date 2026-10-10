import type { ActionMicro, Matrice } from '../types/projet';
import type { TrafficConflict } from '../utils/conflictUtils';
import type { SimulatedGroup, SimulationConflict } from './types';
import { toInt } from './outils';

/**
 * Calculate conflicts for the simulated diagram
 */
export const calculateSimulatedConflicts = (
    simulatedGroups: SimulatedGroup[],
    cycleLength: number,
    conflictMatrix: Matrice
): SimulationConflict[] => {
    const conflicts: SimulationConflict[] = [];
    const count = simulatedGroups.length;

    // Helper to check overlap
    const rangesOverlap = (
        start1: number,
        end1: number,
        start2: number,
        end2: number,
        cycle: number
    ) => {
        start1 = ((start1 % cycle) + cycle) % cycle;
        end1 = ((end1 % cycle) + cycle) % cycle;
        start2 = ((start2 % cycle) + cycle) % cycle;
        end2 = ((end2 % cycle) + cycle) % cycle;

        const range1Wraps = end1 <= start1;
        const range2Wraps = end2 <= start2;

        if (!range1Wraps && !range2Wraps) {
            return start1 < end2 && start2 < end1;
        } else if (range1Wraps && !range2Wraps) {
            return (start2 < end1) || (start2 >= start1);
        } else if (!range1Wraps && range2Wraps) {
            return (start1 < end2) || (start1 >= start2);
        } else {
            return true;
        }
    };

    for (let from = 0; from < count; from++) {
        for (let to = 0; to < count; to++) {
            if (from === to) continue;

            const minGap = conflictMatrix[from]?.[to];
            if (!minGap || minGap === '' || minGap === 0) continue;

            const gFrom = simulatedGroups[from];
            const gTo = simulatedGroups[to];

            // Skip escamoted groups or groups with zero green (e.g. reduced by Fermeture anticipée)
            if (gFrom.isEscamoted || gTo.isEscamoted) continue;
            if (gFrom.simulatedGreen <= 0 || gTo.simulatedGreen <= 0) continue;

            const startA = gFrom.simulatedOffset;
            const endA = (gFrom.simulatedOffset + gFrom.simulatedGreen) % cycleLength;
            const startB = gTo.simulatedOffset;
            const endB = (gTo.simulatedOffset + gTo.simulatedGreen) % cycleLength;

            // Check intergreen time
            const endGreenA = (gFrom.simulatedOffset + gFrom.simulatedGreen) % cycleLength;
            const startGreenB = gTo.simulatedOffset % cycleLength;

            const distance = (startGreenB - endGreenA + cycleLength) % cycleLength;
            const requiredGap = Number(minGap);

            if (distance < requiredGap) {
                conflicts.push({
                    from: gFrom.id,
                    to: gTo.id,
                    required: requiredGap,
                    actual: distance,
                    type: 'intergreen',
                    message: `Dégagement insuffisant (${distance.toFixed(1)}s / ${minGap}s requis)`
                });
            }

            // Check overlap
            if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                const existingConflict = conflicts.find(c =>
                    c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                );
                if (!existingConflict) {
                    conflicts.push({
                        from: gFrom.id,
                        to: gTo.id,
                        type: 'overlap',
                        message: 'Chevauchement des phases vertes'
                    });
                }
            }
        }
    }

    return conflicts;
};

/**
 * Les conflits que la simulation retient, escamotages cochés déduits.
 *
 * Un escamotage coché prend en charge le couple de groupes qu'il nomme : le
 * dégagement y est assuré par l'escamotage lui-même, le conflit calculé sur les
 * temps n'a plus lieu d'être signalé. Exporté pour que le dossier imprimé
 * affiche exactement la liste du panneau, et non une seconde lecture des mêmes
 * règles.
 */
export const conflitsSimules = (
    conflitsBruts: TrafficConflict[] = [],
    actionData: ActionMicro[] = [],
    selectedActions: number[] = []
): TrafficConflict[] => {
    const escamotagesCoches = actionData.filter(action =>
        action.action === 'Escamotage' && action.gf && action.actGf1 &&
        selectedActions.includes(action.id)
    );
    if (escamotagesCoches.length === 0) return conflitsBruts;

    const idDe = (v: unknown) => toInt(String(v ?? '').replace(/[Gg]/g, '').trim()) || 0;
    return conflitsBruts.filter(c => !escamotagesCoches.some(action => {
        const source = idDe(action.gf);
        const cible = idDe(action.actGf1);
        return (source === c.from && cible === c.to) || (source === c.to && cible === c.from);
    }));
};
