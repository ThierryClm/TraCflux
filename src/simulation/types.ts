import type { Groupe } from '../types/projet';
import type { ActionMicro } from '../types/projet';
import type { TrafficConflict } from '../utils/conflictUtils';

export interface SimulatedGroup extends Groupe {
    simulatedOffset: number;
    simulatedGreen: number;
    isEscamoted: boolean;
    greenCuts: Array<{ deb: number; fin: number }>;
}

export interface RemovedPeriod {
    deb: number;
    fin: number;
    source: string;
    actionId: number;
}

export interface TimeShift {
    from: number;
    amount: number;
    source: string;
    actionId: number;
    plage1?: number;
    plage2?: number;
    isPartial?: boolean;
}

export interface Contraction {
    deb: number;
    fin: number;
    source: string;
}

export interface SimulationRestPoint {
    deb: number;
    originalDeb: number;
    duration: number;
    actionId: number;
}

export interface SimulationConflict extends TrafficConflict {
    message: string;
}

export interface SimulationResult {
    simulatedGroups: SimulatedGroup[];
    simulatedCycleLength: number;
    conflicts: SimulationConflict[];
    timeShifts: TimeShift[];
    removedPeriods: RemovedPeriod[];
    contractions: Contraction[];
    restPoints: SimulationRestPoint[];
}

/**
 * Opération qui transforme le temps, inscrite au journal dans l'ordre où elle
 * est appliquée. Un point de repos décale les instants suivants de sa durée
 * pour tous les groupes ; une contraction (adaptatif, escamotage de phase) les
 * ramène en arrière, mais un adaptatif partiel ne le fait que pour les groupes
 * de sa plage.
 */
export type OperationTemps =
    | { kind: 'repos'; t: number; duree: number }
    | { kind: 'contraction'; deb: number; fin: number; plage1?: number; plage2?: number; partiel: boolean };

/**
 * État partagé par les opérations de la simulation : chacune lit et modifie
 * les groupes simulés, la durée du cycle et les relevés destinés au dessin.
 */
export interface EtatSimulation {
    actionData: ActionMicro[];
    selectedActionIds: number[];
    selectedActions: ActionMicro[];
    simulatedGroups: SimulatedGroup[];
    simulatedCycleLength: number;
    // Périodes retirées du diagramme, pour filtrer les actions
    removedPeriods: RemovedPeriod[];
    // Décalages : les positions >= from reculent de amount (incrustations)
    timeShifts: TimeShift[];
    // Contractions complètes, pour recaler les actions suivantes
    contractions: Contraction[];
    // Points de repos, pour le dessin
    restPoints: SimulationRestPoint[];
    // Journal des opérations qui transforment le temps
    journal: OperationTemps[];
}
