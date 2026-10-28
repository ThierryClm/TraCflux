import { compenserAuxSynchrosBts } from './operations/synchroBts';
import { projeter } from './journal';
import type { ActionMicro, Groupe, Matrice } from '../types/projet';
import type { EtatSimulation, SimulationResult } from './types';
import { calculateSimulatedConflicts } from './conflits';
import { masquerEscamotagesNonCoches, appliquerEscamotagesGroupe } from './operations/escamotageGroupe';
import { appliquerPointsDeRepos, placerZonesDeRepos } from './operations/pointDeRepos';
import { appliquerOuverturesAnticipees } from './operations/ouvertureAnticipee';
import { appliquerFermeturesAnticipees } from './operations/fermetureAnticipee';
import { appliquerAdaptatifsVerticaux } from './operations/adaptatifVertical';
import { appliquerEscamotagesDePhase } from './operations/escamotageDePhase';

/**
 * Les plages d'escamotage (greenCuts) sont saisies dans le temps du plan
 * d'origine : on les reporte dans le temps simulé, pour qu'elles suivent le
 * vert de leur groupe quand un repos, un adaptatif ou un escamotage de phase
 * le déplace. Une plage entièrement retirée par une contraction disparaît.
 */
const recalerCoupesDeVert = ({ simulatedGroups, journal }: EtatSimulation): void => {
    for (const g of simulatedGroups) {
        g.greenCuts = g.greenCuts
            .map(c => ({ ...c, deb: projeter(journal, c.deb, g.id), fin: projeter(journal, c.fin, g.id) }))
            .filter(c => c.deb !== c.fin);
    }
};

/**
 * Calculate the simulated diagram based on selected actions
 *
 * @param {Array} groups - Original groups array
 * @param {Array} actionData - All actions
 * @param {Array} selectedActionIds - IDs of selected actions for simulation
 * @param {number} cycleLength - Original cycle length
 * @param {Array} conflictMatrix - The intergreen time matrix
 * @returns {Object} { simulatedGroups, simulatedCycleLength, conflicts }
 */
export const calculateSimulatedDiagram = (
    groups: Groupe[],
    actionData: ActionMicro[],
    selectedActionIds: number[],
    cycleLength: number,
    conflictMatrix: Matrice,
    compenserBts = false
): SimulationResult => {
    const etat: EtatSimulation = {
        actionData,
        selectedActionIds,
        selectedActions: actionData.filter(a => selectedActionIds.includes(a.id)),
        // Deep copy groups to avoid mutation
        simulatedGroups: groups.map(g => ({
            ...g,
            durations: { ...g.durations },
            simulatedOffset: g.offset,
            simulatedGreen: g.durations.green,
            isEscamoted: false,
            greenCuts: [] // Array of {deb, fin} for periods where green is hidden (used by Escamotage only)
        })),
        simulatedCycleLength: cycleLength,
        cycleOrigine: cycleLength,
        removedPeriods: [],
        timeShifts: [],
        contractions: [],
        restPoints: [],
        journal: []
    };

    // Les escamotages NON cochés masquent d'abord leur groupe source, puis
    // chaque famille d'actions cochées est appliquée dans cet ordre ; chacune
    // se lit dans le temps déjà transformé par les précédentes (journal).
    masquerEscamotagesNonCoches(etat);
    appliquerPointsDeRepos(etat);          // 0. allonge le cycle
    appliquerOuverturesAnticipees(etat);   // 1.
    appliquerFermeturesAnticipees(etat);   // 2.
    appliquerEscamotagesGroupe(etat);      // 3. coupes de vert sur la cible
    appliquerAdaptatifsVerticaux(etat);    // 4.
    appliquerEscamotagesDePhase(etat);     // 5. en dernier, pour ne pas cumuler avec les effets existants
    placerZonesDeRepos(etat);
    if (compenserBts) compenserAuxSynchrosBts(etat);
    recalerCoupesDeVert(etat);

    const { simulatedGroups, simulatedCycleLength, timeShifts, removedPeriods, contractions, restPoints, journal } = etat;
    return {
        simulatedGroups,
        simulatedCycleLength,
        conflicts: calculateSimulatedConflicts(simulatedGroups, simulatedCycleLength, conflictMatrix),
        timeShifts,
        removedPeriods,
        contractions,
        restPoints,
        journal
    };
};

export default calculateSimulatedDiagram;
