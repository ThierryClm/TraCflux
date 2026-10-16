import type { ActionMicro, Groupe, Matrice, PlanDeFeu, ScenarioSimulation } from '../types/projet';
import { calculateSimulatedDiagram } from './calculSimulation';
import { conflitsSimules } from './conflits';
import { actionsDuScenario, scenarioChoisi, scenariosDuPlan, estScenarioFixe } from './scenarios';
import type { SimulationResult } from './types';

/**
 * Les scénarios au dossier imprimé.
 *
 * On imprime les scénarios ENREGISTRÉS, plan de feu par plan de feu, chacun
 * recalculé sur son propre plan et d'après sa version enregistrée — non
 * d'après les cases cochées à l'écran. « Tout coché » et « Tout décoché » ne
 * s'impriment pas : ce sont des facilités de coche, pas des scénarios.
 *
 * Le choix se tient dans les sections du dossier : `scenario:<plan>:<titre>`
 * par scénario, `simulation` pour l'ensemble, et des options communes à tous
 * les scénarios imprimés.
 */

type Sections = Record<string, boolean>;

/** Options de contenu, communes à tous les scénarios imprimés. */
export const OPTIONS_SCENARIO = [
    ['simulationDiagramme', 'Diagramme simulé'],
    ['simulationActions', 'Liste des actions'],
    ['simulationConflits', 'Liste des conflits'],
    ['simulationTrafic', 'Données de trafic et calcul de capacité'],
    ['simulationReserve', 'Réserve de capacité']
] as const;

export const cleScenarioImpression = (pfId: number | string, nom: string) => `scenario:${pfId}:${nom}`;

const aDesChoixParScenario = (sections: Sections) =>
    Object.keys(sections).some(k => k.startsWith('scenario:'));

/**
 * Les scénarios du plan à imprimer. Un dossier enregistré avant l'impression
 * multi-scénario n'a qu'une case « Scénario » : elle vaut pour le scénario
 * choisi du plan actif, qu'elle imprimait.
 */
export const scenariosAImprimer = (
    sections: Sections,
    pf: PlanDeFeu,
    activePFId: number
): ScenarioSimulation[] => {
    if (!sections.simulation) return [];
    const scenarios = scenariosDuPlan(pf);
    if (!aDesChoixParScenario(sections)) {
        const choisi = pf.id === activePFId ? scenarioChoisi(pf) : null;
        return choisi && !estScenarioFixe(choisi.nom) ? scenarios.filter(s => s.nom === choisi.nom) : [];
    }
    return scenarios.filter(s => sections[cleScenarioImpression(pf.id, s.nom)]);
};

/**
 * Sélection proposée à la première ouverture de la boîte : le scénario choisi
 * de chaque plan, toutes les options de contenu, et la comparaison.
 */
export const sectionsScenariosInitiales = (pfTabs: PlanDeFeu[]): Sections => {
    const coches: Sections = {};
    pfTabs.forEach(pf => {
        const choisi = scenarioChoisi(pf);
        if (choisi && !estScenarioFixe(choisi.nom)) coches[cleScenarioImpression(pf.id, choisi.nom)] = true;
    });
    const unScenario = Object.keys(coches).length > 0;
    return {
        simulation: unScenario,
        ...Object.fromEntries(OPTIONS_SCENARIO.map(([cle]) => [cle, true])),
        simulationComparatif: true,
        ...coches
    };
};

/**
 * Un dossier enregistré avant l'impression multi-scénario n'a pas les cases
 * nouvelles : le diagramme simulé s'imprimait toujours, la comparaison
 * n'existait pas. Lu ainsi, il imprime ce qu'il imprimait.
 */
export const optionScenario = (sections: Sections, cle: string): boolean => {
    if (cle === 'simulationDiagramme' && sections[cle] === undefined) return true;
    return !!sections[cle];
};

/** Le plan tel qu'il s'imprime : groupes, cycle et actions qui lui sont propres. */
export interface PlanImprime {
    groups: Groupe[];
    cycleLength: number;
    actionData: ActionMicro[];
}

/**
 * Groupes, cycle et actions d'un plan. Le plan actif se lit dans l'état de
 * l'écran, à jour ; les autres dans leur enregistrement — les mêmes règles
 * que le diagramme du plan au dossier.
 */
export const planImprime = (
    pf: PlanDeFeu,
    actif: { activePFId: number; groups: Groupe[]; cycleLength: number; actionData: ActionMicro[] }
): PlanImprime => {
    if (pf.id === actif.activePFId) {
        return { groups: actif.groups, cycleLength: actif.cycleLength, actionData: actif.actionData };
    }
    const groups = actif.groups.map(g => {
        const pfDiag = pf.diagram?.find(d => d.groupId === g.id);
        return pfDiag ? {
            ...g,
            offset: pfDiag.offset !== undefined ? pfDiag.offset : g.offset,
            durations: { ...g.durations, green: pfDiag.greenDuration !== undefined ? pfDiag.greenDuration : g.durations.green },
            da: pfDiag.da !== undefined ? pfDiag.da : g.da,
            phaseFlag: pfDiag.phaseFlag !== undefined ? pfDiag.phaseFlag : g.phaseFlag
        } : g;
    });
    return { groups, cycleLength: pf.cycleLength || actif.cycleLength, actionData: pf.data || [] };
};

/** Un scénario recalculé sur son plan, prêt à imprimer. */
export interface ScenarioCalcule {
    scenario: ScenarioSimulation;
    /** Les actions du scénario encore présentes et simulables. */
    actions: number[];
    simu: SimulationResult;
    cycleSimule: number;
    conflits: ReturnType<typeof conflitsSimules>;
    /** Groupes aux temps simulés : la réserve se calcule sur leurs verts. */
    groupesSimules: Groupe[];
}

export const calculerScenario = (
    scenario: ScenarioSimulation,
    plan: PlanImprime,
    conflictMatrix: Matrice
): ScenarioCalcule => {
    const actions = actionsDuScenario(scenario, plan.actionData);
    const simu = calculateSimulatedDiagram(plan.groups, plan.actionData, actions, plan.cycleLength, conflictMatrix);
    const groupesSimules = plan.groups.map(g => {
        const sim = simu.simulatedGroups?.find(sg => sg.id === g.id);
        if (!sim) return g;
        return {
            ...g,
            offset: sim.simulatedOffset ?? g.offset,
            durations: { ...g.durations, green: sim.simulatedGreen ?? g.durations.green }
        };
    });
    return {
        scenario,
        actions,
        simu,
        cycleSimule: simu.simulatedCycleLength || plan.cycleLength,
        conflits: conflitsSimules(simu.conflicts || [], plan.actionData, actions),
        groupesSimules
    };
};
