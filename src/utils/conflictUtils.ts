/**
 * Vérifie si deux intervalles temporels se chevauchent dans un cycle.
 */
import type { ActionMicro, Groupe, Matrice } from '../types/projet';

export interface TrafficConflict {
    from: number;
    to: number;
    type: 'intergreen' | 'overlap' | 'sl-overlap' | 'sl-sl-overlap';
    required?: number;
    actual?: number;
    message?: string;
}

export interface TimingError {
    type: 'minGreen' | 'overflow';
    message: string;
}

export function rangesOverlap(
    startA: number,
    endA: number,
    startB: number,
    endB: number,
    cycleLength: number
) {
    // Normalize to [0, cycleLength)
    const sA = ((startA % cycleLength) + cycleLength) % cycleLength;
    const eA = ((endA % cycleLength) + cycleLength) % cycleLength;
    const sB = ((startB % cycleLength) + cycleLength) % cycleLength;
    const eB = ((endB % cycleLength) + cycleLength) % cycleLength;

    const wrapA = eA <= sA;
    const wrapB = eB <= sB;

    if (!wrapA && !wrapB) return sA < eB && sB < eA;
    if (wrapA && !wrapB)  return sB < eA || eB > sA;
    if (!wrapA && wrapB)  return sA < eB || eA > sB;
    return true; // Les deux wrappent → chevauchement forcé
}

/**
 * Calcule les conflits d'intervert entre groupes.
 * Logique extraite de useTrafficLight.ts pour être testable indépendamment.
 *
 * @param {Array} groups - Liste des groupes de feux
 * @param {Array} conflictMatrix - Matrice 2D des temps intervert
 * @param {number} cycleLength - Durée du cycle en secondes
 * @param {Array} actionData - Données des actions (seconde lucarne, escamotage, etc.)
 * @returns {Array} Liste des conflits détectés
 */
export function computeConflicts(
    groups: Groupe[],
    conflictMatrix: Matrice,
    cycleLength: number,
    actionData: ActionMicro[] = []
): TrafficConflict[] {
    const list: TrafficConflict[] = [];
    const count = groups.length;

    const secondeLucarnes = actionData.filter(a =>
        a.action === 'Seconde lucarne' && a.gf !== '' && a.deb !== '' && a.fin !== ''
    ).map(a => ({
        gf: parseInt(String(a.gf)),
        deb: parseInt(String(a.deb)),
        fin: parseInt(String(a.fin))
    }));

    const escamotages = actionData.filter(a =>
        (a.action === 'Escamotage' || a.action === 'Escamotage de phase') &&
        a.gf !== '' && a.actGf1 !== ''
    ).map(a => ({ sourceGf: parseInt(String(a.gf)), targetGf: parseInt(String(a.actGf1)) }));

    const flecheAnticipations = actionData.filter(a =>
        a.action === "Flèche d'anticipation" && a.gf !== '' && a.deb !== '' && a.fin !== ''
    ).reduce<Record<number, { deb: number; fin: number }>>((acc, a) => {
        const gf = parseInt(String(a.gf));
        if (!acc[gf]) acc[gf] = { deb: parseInt(String(a.deb)), fin: parseInt(String(a.fin)) };
        return acc;
    }, {});

    const hasEscamotage = (gfA: number, gfB: number) =>
        escamotages.some(e =>
            (e.sourceGf === gfA && e.targetGf === gfB) ||
            (e.sourceGf === gfB && e.targetGf === gfA)
        );

    for (let from = 0; from < count; from++) {
        if (!conflictMatrix[from]) continue;
        for (let to = 0; to < count; to++) {
            const minGap = conflictMatrix[from][to];
            if (minGap === '' || minGap === undefined || minGap === null || from === to) continue;

            const gFrom = groups[from];
            const gTo = groups[to];

            const flecheFrom = flecheAnticipations[gFrom.id];
            const flecheTo = flecheAnticipations[gTo.id];

            const endGreenA = flecheFrom
                ? flecheFrom.fin % cycleLength
                : (gFrom.offset + gFrom.durations.green) % cycleLength;

            const startGreenB = flecheTo
                ? flecheTo.deb % cycleLength
                : gTo.offset % cycleLength;

            const distance = (startGreenB - endGreenA + cycleLength) % cycleLength;

            const requiredGap = Number(minGap);
            if (distance < requiredGap) {
                list.push({ from: gFrom.id, to: gTo.id, required: requiredGap, actual: distance, type: 'intergreen' });
            }

            const startA = flecheFrom ? flecheFrom.deb : gFrom.offset;
            const endA   = flecheFrom ? flecheFrom.fin : gFrom.offset + gFrom.durations.green;
            const startB = flecheTo ? flecheTo.deb : gTo.offset;
            const endB   = flecheTo ? flecheTo.fin : gTo.offset + gTo.durations.green;

            if (rangesOverlap(startA, endA, startB, endB, cycleLength)) {
                if (!hasEscamotage(gFrom.id, gTo.id)) {
                    const existingConflict = list.find(c =>
                        c.from === gFrom.id && c.to === gTo.id && c.type === 'intergreen'
                    );
                    if (!existingConflict) {
                        list.push({ from: gFrom.id, to: gTo.id, type: 'overlap', message: 'Chevauchement des phases vertes' });
                    }
                }
            }

            secondeLucarnes.forEach(sl => {
                if (sl.gf === gFrom.id && rangesOverlap(sl.deb, sl.fin, startB, endB, cycleLength)) {
                    list.push({ from: gFrom.id, to: gTo.id, type: 'sl-overlap', message: 'Seconde lucarne chevauche vert' });
                }
            });
        }
    }

    return list;
}

/**
 * Déplace un groupe de la position `from` à la position `to` dans le tableau.
 * Réassigne les ids séquentiellement après déplacement.
 */
export function moveGroup(groups: Groupe[], fromIndex: number, toIndex: number): Groupe[] {
    const newGroups = [...groups];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    return newGroups.map((g, idx) => ({ ...g, id: idx + 1 }));
}

/**
 * Réorganise la matrice de conflits après un déplacement de groupe.
 * Logique extraite de moveGroupToPosition dans useTrafficLight.ts.
 *
 * @param {Array} matrix - Matrice 2D originale
 * @param {Array} groups - Groupes avant déplacement
 * @param {number} fromIndex - Index source (0-based)
 * @param {number} toIndex - Index destination (0-based)
 * @returns {Array} Nouvelle matrice réorganisée
 */
export function remapMatrix(
    matrix: Matrice,
    groups: Groupe[],
    fromIndex: number,
    toIndex: number
): Matrice {
    if (!matrix || matrix.length === 0) return matrix;

    // Calculer le nouvel ordre des groupes
    const newGroups = [...groups];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);

    // Construire la correspondance ancienne position → nouvelle position
    const oldToNew: Record<number, number> = {};
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const newIndex = newGroups.findIndex(g => g.id === group.id);
        oldToNew[i + 1] = newIndex + 1; // 1-based
    }

    const size = matrix.length;
    const newMatrix = Array(size).fill(null).map(() => Array(size).fill(0));
    for (let oldRow = 0; oldRow < size; oldRow++) {
        for (let oldCol = 0; oldCol < size; oldCol++) {
            const newRow = oldToNew[oldRow + 1] - 1;
            const newCol = oldToNew[oldCol + 1] - 1;
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                newMatrix[newRow][newCol] = matrix[oldRow][oldCol];
            }
        }
    }
    return newMatrix;
}

/**
 * Valide les contraintes de timing d'un groupe par rapport au cycle.
 *
 * @param {Object} group - Groupe à valider
 * @param {number} cycleLength - Durée du cycle en secondes
 * @returns {Array} Liste des erreurs détectées (vide si tout est OK)
 */
export function validateGroupTiming(group: Groupe, cycleLength: number): TimingError[] {
    const errors: TimingError[] = [];
    const { offset, durations, minGreen } = group;
    const { green, orange } = durations;

    if (green < minGreen) {
        errors.push({ type: 'minGreen', message: `Vert (${green}s) < minimum (${minGreen}s)` });
    }
    if (offset + green + orange > cycleLength) {
        errors.push({ type: 'overflow', message: `offset+vert+orange (${offset + green + orange}s) dépasse le cycle (${cycleLength}s)` });
    }
    return errors;
}
