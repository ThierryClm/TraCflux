import { calculateVUtile, calculateCapacity } from './capacityCalc';
import { calculerScenario, planImprime } from '../simulation/impressionScenarios';
import { scenariosDuPlan } from '../simulation/scenarios';
import type { ActionMicro, Groupe, JeuTrafic, Matrice, PlanDeFeu, ScenarioSimulation } from '../types/projet';

/**
 * Comparateur de capacité : colonnes (plans de feu et scénarios cochés) et
 * cellules, partagés par la fenêtre du comparateur et le dossier imprimé.
 */

/** Choix « Jeu associé à chaque PF » de la liste des jeux de trafic. */
export const PAR_PLAN = '__per_pf__';

/** Clé d'un scénario dans la sélection du comparateur. */
export const cleScenarioComparaison = (pfId: number, nom: string) => `${pfId}:${nom}`;

export interface DonneesTrafic {
    trafficDatasets: Record<string, JeuTrafic>;
    pfTrafficDatasetMap: Record<string | number, string>;
    activeTrafficDataset: string;
    trafficDatasetNames: string[];
}

/** Plan actif tel qu'à l'écran : ses groupes, son cycle et ses actions sont à jour. */
export interface PlanActif {
    activePFId: number;
    groups: Groupe[];
    cycleLength: number;
    actionData: ActionMicro[];
}

/**
 * Jeu de trafic appliqué à un plan : le jeu unique choisi, ou celui du plan —
 * associé explicitement, sinon le jeu à son nom, sinon le jeu actif (mêmes
 * règles que l'onglet Trafic).
 */
export const jeuDuPlan = (pf: PlanDeFeu, choix: string, t: DonneesTrafic): string =>
    choix === PAR_PLAN
        ? (t.pfTrafficDatasetMap[pf.id] || (t.trafficDatasetNames.includes(pf.name) ? pf.name : t.activeTrafficDataset))
        : choix;

/** Un jeu est vide si aucun groupe n'y a de trafic. */
export const jeuRenseigne = (nom: string, t: DonneesTrafic): boolean =>
    Object.values(t.trafficDatasets?.[nom] ?? {}).some(v => Number(v?.trafficVol) > 0);

/** Le plan peut être comparé : son jeu de trafic a des données. */
export const planComparable = (pf: PlanDeFeu, choix: string, t: DonneesTrafic): boolean =>
    jeuRenseigne(jeuDuPlan(pf, choix, t), t);

export interface ColonneComparaison {
    cle: string;
    pf: PlanDeFeu;
    scenario: ScenarioSimulation | null;
    jeu: string;
    cycle: number;
    /** Vert de chaque groupe dans cette colonne (nominal, ou simulé pour un scénario). */
    verts: Record<number, number>;
}

export interface SelectionComparaison {
    /** PF cochés ; null = tous. */
    pfIds: number[] | null;
    /** Scénarios cochés (cleScenarioComparaison). */
    scenarios: string[];
    choixJeu: string;
}

/**
 * Colonnes du tableau, plan par plan : le plan (valeurs nominales) puis ses
 * scénarios cochés (valeurs simulées). Un plan sans trafic n'est pas comparé,
 * ni ses scénarios.
 */
export const colonnesComparaison = (
    pfTabs: PlanDeFeu[],
    selection: SelectionComparaison,
    t: DonneesTrafic,
    actif: PlanActif,
    conflictMatrix: Matrice
): ColonneComparaison[] => {
    const pfIds = Array.isArray(selection.pfIds) ? selection.pfIds : pfTabs.map(pf => pf.id);
    const colonnes: ColonneComparaison[] = [];
    pfTabs.forEach(pf => {
        if (!planComparable(pf, selection.choixJeu, t)) return;
        const jeu = jeuDuPlan(pf, selection.choixJeu, t);
        if (pfIds.includes(pf.id)) {
            const verts: Record<number, number> = {};
            actif.groups.forEach(g => {
                const d = pf.diagram?.find(x => x.groupId === g.id);
                verts[g.id] = d && d.greenDuration !== undefined && d.greenDuration !== null ? d.greenDuration : g.durations?.green;
            });
            colonnes.push({ cle: String(pf.id), pf, scenario: null, jeu, cycle: pf.cycleLength ?? actif.cycleLength, verts });
        }
        const scenarios = scenariosDuPlan(pf).filter(s => selection.scenarios.includes(cleScenarioComparaison(pf.id, s.nom)));
        if (scenarios.length === 0) return;
        const plan = planImprime(pf, actif);
        scenarios.forEach(scenario => {
            const calcule = calculerScenario(scenario, plan, pf.conflictMatrix ?? conflictMatrix);
            const verts: Record<number, number> = {};
            calcule.groupesSimules.forEach(g => { verts[g.id] = g.durations?.green; });
            colonnes.push({
                cle: cleScenarioComparaison(pf.id, scenario.nom), pf, scenario, jeu,
                cycle: calcule.cycleSimule, verts
            });
        });
    });
    return colonnes;
};

export interface CelluleComparaison {
    trafficVol: number | string;
    vUtile: number | null;
    capacity: ReturnType<typeof calculateCapacity>;
}

/** cellules[cle de colonne][id de groupe] */
export const cellulesComparaison = (
    colonnes: ColonneComparaison[],
    groupes: Groupe[],
    t: DonneesTrafic
): Record<string, Record<number, CelluleComparaison>> => {
    const out: Record<string, Record<number, CelluleComparaison>> = {};
    colonnes.forEach(c => {
        out[c.cle] = {};
        groupes.forEach(g => {
            const trafficVol = t.trafficDatasets?.[c.jeu]?.[g.id]?.trafficVol ?? 0;
            const vUtile = calculateVUtile(trafficVol as number, g.laneCoef ?? 0, c.cycle ?? 0);
            out[c.cle][g.id] = { trafficVol, vUtile, capacity: calculateCapacity(c.verts[g.id], vUtile ?? 0) };
        });
    });
    return out;
};

/** Groupes comparés : les groupes véhicules. */
export const groupesComparables = (groups: Groupe[]) => groups.filter(g => g.type === 'VL' || g.type === 'V');
