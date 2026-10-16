import {
    calculateOfferedCapacity,
    calculateDegreeOfSaturation,
    calculateReserveCapacity,
    calculateAverageDelay,
    calculateAverageQueueLength
} from './capacityCalc';
import { getTotalGreenTime, parseTrafficVol, isCoordinated } from './trafficHelpers';
import type { ActionMicro, Groupe } from '../types/projet';

/**
 * Indicateurs de dimensionnement par courant, et courant dimensionnant du
 * carrefour. Sortis du panneau « Réserve de capacité » pour que le tableau
 * comparatif des scénarios, au dossier imprimé, lise exactement les mêmes
 * chiffres que la section détaillée de chaque scénario.
 */

export interface DiagnosticRow {
    g: Groupe;
    trafic: number;
    coord: boolean;
    inhibe: boolean;
    capacity: number | null;
    x: number | null;
    reserve: { veh: number; ratio: number | null } | null;
    delay: number | null;
    queue: number | null;
    capU: number | null;
}

export interface DimensioningRow extends DiagnosticRow {
    x: number;
    capU: number;
}

interface EntreesDiagnostic {
    groups?: Groupe[];
    cycleLength: number;
    getTrafficData?: (groupId: number) => { trafficVol?: number | string };
    actionData?: ActionMicro[];
    /** Groupes inhibés par une action cochée en simulation : pas de capacité calculée. */
    inhibitedGroups?: Set<number> | null;
}

/** Une ligne par courant véhicules dont le trafic est renseigné. */
export const lignesDiagnostic = ({
    groups = [],
    cycleLength,
    getTrafficData,
    actionData = [],
    inhibitedGroups = null
}: EntreesDiagnostic): DiagnosticRow[] => groups
    .filter(g => g.type === 'VL' || g.type === 'V')
    .map(g => {
        const inhibe = inhibitedGroups ? inhibitedGroups.has(g.id) : false;
        const green = getTotalGreenTime(g.id, g.durations?.green, actionData, cycleLength, g.phaseFlag);
        const raw = getTrafficData ? getTrafficData(g.id).trafficVol : 0;
        const trafic = parseTrafficVol(raw);
        const coord = isCoordinated(raw);
        const coef = g.laneCoef ?? 0;
        if (inhibe) {
            return { g, trafic, coord, inhibe: true, capacity: null, x: null, reserve: null, delay: null, queue: null, capU: null };
        }
        const capacity = calculateOfferedCapacity(coef, green, cycleLength);
        const x = calculateDegreeOfSaturation(trafic, coef, green, cycleLength);
        const reserve = calculateReserveCapacity(trafic, coef, green, cycleLength);
        const delay = coord && trafic ? 0 : calculateAverageDelay(trafic, coef, green, cycleLength);
        const queue = coord && trafic ? 0 : calculateAverageQueueLength(trafic, coef, green, cycleLength);
        const capU = x === null ? null : Math.round(x * 100);
        return { g, trafic, coord, inhibe: false, capacity, x, reserve, delay, queue, capU };
    })
    .filter(r => r.trafic); // uniquement les courants avec trafic renseigné

/** Le courant le plus chargé, celui qui dimensionne le carrefour. */
export const courantDimensionnant = (rows: DiagnosticRow[]): DimensioningRow | null => {
    let best: DimensioningRow | null = null;
    rows.forEach(r => {
        if (r.capU !== null && r.x !== null && (!best || r.capU > best.capU)) {
            best = r as DimensioningRow;
        }
    });
    return best;
};
