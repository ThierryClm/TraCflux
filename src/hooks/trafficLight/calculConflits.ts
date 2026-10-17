/**
 * Conflits du diagramme : verts antagonistes qui se chevauchent compte tenu
 * des temps interverts, secondes lucarnes comprises. Calcul pur, appelé par
 * useTrafficLight.
 */
import { entier } from '../../utils/entier';
import type { TrafficConflict } from '../../utils/conflictUtils';
import type { ActionMicro, Groupe, Matrice } from '../../types/projet';

// Helper: Check if two time ranges overlap in cyclic time
export const rangesOverlap = (start1: number, end1: number, start2: number, end2: number, cycle: number) => {
    // Normalize to cycle
    start1 = ((start1 % cycle) + cycle) % cycle;
    end1 = ((end1 % cycle) + cycle) % cycle;
    start2 = ((start2 % cycle) + cycle) % cycle;
    end2 = ((end2 % cycle) + cycle) % cycle;

    // Handle wrap-around cases
    const range1Wraps = end1 <= start1;
    const range2Wraps = end2 <= start2;

    if (!range1Wraps && !range2Wraps) {
        // Neither wraps: simple overlap check
        return start1 < end2 && start2 < end1;
    } else if (range1Wraps && !range2Wraps) {
        // Range 1 wraps: [start1, cycle) and [0, end1)
        return (start2 < end1) || (start2 >= start1);
    } else if (!range1Wraps && range2Wraps) {
        // Range 2 wraps
        return (start1 < end2) || (start1 >= start2);
    } else {
        // Both wrap: they definitely overlap
        return true;
    }
};

export const calculerConflits = (
    groups: Groupe[],
    conflictMatrix: Matrice,
    cycleLength: number,
    actionData: ActionMicro[]
): TrafficConflict[] => {
    const list: TrafficConflict[] = [];
    const count = groups.length;

    // Get seconde lucarne actions from current actionData
    const secondeLucarnes = actionData.filter(action =>
        action.action === 'Seconde lucarne' &&
        action.gf !== '' &&
        action.deb !== '' &&
        action.fin !== ''
    ).map(action => ({
        gf: entier(action.gf),
        deb: entier(action.deb),
        fin: entier(action.fin),
        abrv: action.abrv || 'SL'
    }));

    // Get escamotage actions (both types) to check for managed overlaps
    const escamotages = actionData.filter(action =>
        (action.action === 'Escamotage' || action.action === 'Escamotage de phase') &&
        action.gf !== '' &&
        action.actGf1 !== ''
    ).map(action => ({
        sourceGf: entier(action.gf),
        targetGf: entier(action.actGf1)
    }));

    // Get flèche d'anticipation actions - these override the green phase timing for conflict calculation
    const flecheAnticipations = actionData.filter(action =>
        action.action === "Flèche d'anticipation" &&
        action.gf !== '' &&
        action.deb !== '' &&
        action.fin !== ''
    ).reduce<Record<number, { deb: number; fin: number }>>((acc, action) => {
        const gf = entier(action.gf);
        // Store the first flèche d'anticipation for each group
        if (!acc[gf]) {
            acc[gf] = {
                deb: entier(action.deb),
                fin: entier(action.fin)
            };
        }
        return acc;
    }, {});

    // Helper to check if an escamotage exists between two groups
    const hasEscamotage = (gfA: number, gfB: number) => {
        return escamotages.some(e =>
            (e.sourceGf === gfA && e.targetGf === gfB) ||
            (e.sourceGf === gfB && e.targetGf === gfA)
        );
    };

    // Check intergreen time conflicts (existing logic)
    for (let from = 0; from < count; from++) {
        // Safety check: skip if row doesn't exist in matrix
        if (!conflictMatrix[from]) continue;
        for (let to = 0; to < count; to++) {
            const caseMatrice = conflictMatrix[from][to];
            // Skip empty values
            if ((caseMatrice === '' || caseMatrice === undefined || caseMatrice === null) || from === to) continue;
            const minGap = Number(caseMatrice);

            const gFrom = groups[from];
            const gTo = groups[to];

            // Check if groups have flèche d'anticipation - use those timings instead
            const flecheFrom = flecheAnticipations[gFrom.id];
            const flecheTo = flecheAnticipations[gTo.id];

            // For "from" group: end of green (or end of flèche d'anticipation)
            const endGreenA_Absolute = flecheFrom
                ? flecheFrom.fin % cycleLength
                : (gFrom.offset + gFrom.durations.green) % cycleLength;

            // For "to" group: start of green (or start of flèche d'anticipation)
            const startGreenB_Absolute = flecheTo
                ? flecheTo.deb % cycleLength
                : gTo.offset % cycleLength;

            let distance = (startGreenB_Absolute - endGreenA_Absolute + cycleLength) % cycleLength;

            if (distance < minGap) {
                list.push({
                    from: gFrom.id,
                    to: gTo.id,
                    required: minGap,
                    actual: distance,
                    type: 'intergreen'
                });
            }

            // Check for actual overlap between antagonist groups
            // Use flèche d'anticipation timings if present
            const startA = flecheFrom ? flecheFrom.deb : gFrom.offset;
            const endA = flecheFrom ? flecheFrom.fin : gFrom.offset + gFrom.durations.green;
            const startB = flecheTo ? flecheTo.deb : gTo.offset;
            const endB = flecheTo ? flecheTo.fin : gTo.offset + gTo.durations.green;

            if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                // Skip if there's an escamotage between these groups (overlap is managed)
                if (hasEscamotage(gFrom.id, gTo.id)) {
                    continue;
                }
                // Only add if not already a more severe intergreen conflict
                const existingConflict = list.find(c =>
                    c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                );
                if (!existingConflict) {
                    list.push({
                        from: gFrom.id,
                        to: gTo.id,
                        type: 'overlap',
                        message: 'Chevauchement des phases vertes'
                    });
                }
            }

            // Check seconde lucarne overlaps with antagonist green phases
            secondeLucarnes.forEach(sl => {
                if (sl.gf === gFrom.id) {
                    // Check SL of gFrom against green of gTo
                    if (rangesOverlap(sl.deb, sl.fin, startB, endB, cycleLength)) {
                        list.push({
                            from: gFrom.id,
                            to: gTo.id,
                            type: 'sl-overlap',
                            message: `Seconde lucarne chevauche vert`
                        });
                    }
                }
                if (sl.gf === gTo.id) {
                    // Check SL of gTo against green of gFrom
                    if (rangesOverlap(sl.deb, sl.fin, startA, endA, cycleLength)) {
                        list.push({
                            from: gTo.id,
                            to: gFrom.id,
                            type: 'sl-overlap',
                            message: `Seconde lucarne chevauche vert`
                        });
                    }
                }
            });
        }
    }

    // Check seconde lucarne overlaps between themselves for antagonist groups
    for (let i = 0; i < secondeLucarnes.length; i++) {
        for (let j = i + 1; j < secondeLucarnes.length; j++) {
            const sl1 = secondeLucarnes[i];
            const sl2 = secondeLucarnes[j];

            // Check if these groups are antagonists
            const idx1 = sl1.gf - 1;
            const idx2 = sl2.gf - 1;
            if (idx1 >= 0 && idx2 >= 0 && idx1 < count && idx2 < count) {
                const areAntagonists = conflictMatrix[idx1][idx2] !== '' || conflictMatrix[idx2][idx1] !== '';
                if (areAntagonists && rangesOverlap(sl1.deb, sl1.fin, sl2.deb, sl2.fin, cycleLength)) {
                    list.push({
                        from: sl1.gf,
                        to: sl2.gf,
                        type: 'sl-sl-overlap',
                        message: `Chevauchement des secondes lucarnes`
                    });
                }
            }
        }
    }

    return list;
};
