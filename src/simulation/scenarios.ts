import type { ActionMicro, PlanDeFeu, ScenarioSimulation } from '../types/projet';
import { actionsSimulables } from './actionsSimulables';

/**
 * Les scénarios de simulation d'un plan de feu.
 *
 * Un plan peut porter plusieurs scénarios — un titre et une combinaison
 * d'actions cochées — rangés dans `simulationScenarios`. Le scénario CHOISI
 * est désigné par son titre, `simulationName`, et les cases cochées à l'écran
 * restent dans `simulationActions` : cocher ou décocher ne touche pas au
 * scénario enregistré, seul « Enregistrer » le met à jour.
 *
 * Les projets d'avant les scénarios multiples n'ont que `simulationName` et
 * `simulationActions` : ce couple devient leur premier scénario, sans
 * migration — il est lu ici, et écrit dans la liste à la première écriture.
 */

/** Longueur maximale d'un titre, celle de l'ancien champ « Scénario ». */
export const LONGUEUR_TITRE_SCENARIO = 60;

export const normaliserTitreScenario = (titre: string): string =>
    String(titre || '').trim().slice(0, LONGUEUR_TITRE_SCENARIO);

const memeTitre = (a: string, b: string) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

const idsValides = (ids: unknown): number[] =>
    Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];

/** Les scénarios du plan, par ordre alphabétique, ancien scénario unique compris. */
export const scenariosDuPlan = (pf: PlanDeFeu | null | undefined): ScenarioSimulation[] => {
    if (!pf) return [];
    const liste = (Array.isArray(pf.simulationScenarios) ? pf.simulationScenarios : [])
        .filter(s => s && normaliserTitreScenario(s.nom))
        .map(s => ({ nom: normaliserTitreScenario(s.nom), actions: idsValides(s.actions) }));
    const nomActif = normaliserTitreScenario(pf.simulationName || '');
    if (nomActif && !liste.some(s => memeTitre(s.nom, nomActif))) {
        liste.push({ nom: nomActif, actions: idsValides(pf.simulationActions) });
    }
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
};

/** Le scénario choisi sur le plan, ou null (« Sans titre »). */
export const scenarioChoisi = (pf: PlanDeFeu | null | undefined): ScenarioSimulation | null => {
    const nom = normaliserTitreScenario(pf?.simulationName || '');
    if (!nom) return null;
    return scenariosDuPlan(pf).find(s => memeTitre(s.nom, nom)) || null;
};

/**
 * Les actions d'un scénario encore présentes et simulables. Une action
 * supprimée du tableau, ou passée dans une famille hors simulation, sort
 * ainsi de tous les scénarios sans qu'on ait à les réécrire.
 */
export const actionsDuScenario = (scenario: ScenarioSimulation, actionData: ActionMicro[]): number[] => {
    const simulables = new Set(actionsSimulables(actionData).map(a => a.id));
    return scenario.actions.filter(id => simulables.has(id));
};

/** Vrai si les cases cochées ne sont plus celles du scénario enregistré. */
export const scenarioModifie = (
    scenario: ScenarioSimulation | null,
    cochees: number[],
    actionData: ActionMicro[]
): boolean => {
    if (!scenario) return false;
    const simulables = new Set(actionsSimulables(actionData).map(a => a.id));
    const enregistrees = new Set(scenario.actions.filter(id => simulables.has(id)));
    const actuelles = new Set(cochees.filter(id => simulables.has(id)));
    if (enregistrees.size !== actuelles.size) return true;
    for (const id of actuelles) if (!enregistrees.has(id)) return true;
    return false;
};

/**
 * Pourquoi un titre est refusé, ou null s'il convient. `ancien` est le titre
 * du scénario qu'on renomme : le garder n'est pas un doublon.
 */
export const titreScenarioRefuse = (
    titre: string,
    scenarios: ScenarioSimulation[],
    ancien: string | null = null
): string | null => {
    const nom = normaliserTitreScenario(titre);
    if (!nom) return 'Donne un titre au scénario.';
    const pris = scenarios.some(s => memeTitre(s.nom, nom) && !(ancien && memeTitre(s.nom, ancien)));
    return pris ? `Un scénario s'appelle déjà « ${nom} ».` : null;
};

type MajScenario = Pick<PlanDeFeu, 'simulationScenarios' | 'simulationName' | 'simulationActions'>;

/** Ouvre un scénario : ses cases cochées remplacent celles de l'écran. */
export const choisirScenario = (pf: PlanDeFeu, nom: string): MajScenario | null => {
    const scenarios = scenariosDuPlan(pf);
    const cible = scenarios.find(s => memeTitre(s.nom, normaliserTitreScenario(nom)));
    if (!cible) return null;
    return { simulationScenarios: scenarios, simulationName: cible.nom, simulationActions: [...cible.actions] };
};

/** Quitte le scénario choisi (« Sans titre ») ; les cases restent cochées. */
export const quitterScenario = (pf: PlanDeFeu): MajScenario => ({
    simulationScenarios: scenariosDuPlan(pf),
    simulationName: '',
    simulationActions: idsValides(pf.simulationActions)
});

/** Crée un scénario avec les cases cochées, et le choisit. */
export const creerScenario = (pf: PlanDeFeu, titre: string): MajScenario | null => {
    const scenarios = scenariosDuPlan(pf);
    if (titreScenarioRefuse(titre, scenarios)) return null;
    const nom = normaliserTitreScenario(titre);
    const actions = idsValides(pf.simulationActions);
    return {
        simulationScenarios: [...scenarios, { nom, actions: [...actions] }],
        simulationName: nom,
        simulationActions: actions
    };
};

/**
 * Enregistre les cases cochées dans le scénario choisi, sous `titre` : le
 * même titre met le scénario à jour, un autre le renomme.
 */
export const enregistrerScenario = (pf: PlanDeFeu, titre: string): MajScenario | null => {
    const actif = scenarioChoisi(pf);
    if (!actif) return creerScenario(pf, titre);
    const scenarios = scenariosDuPlan(pf);
    if (titreScenarioRefuse(titre, scenarios, actif.nom)) return null;
    const nom = normaliserTitreScenario(titre);
    const actions = idsValides(pf.simulationActions);
    return {
        simulationScenarios: scenarios.map(s => memeTitre(s.nom, actif.nom) ? { nom, actions: [...actions] } : s),
        simulationName: nom,
        simulationActions: actions
    };
};

/** Supprime le scénario choisi ; les cases cochées restent en place. */
export const supprimerScenario = (pf: PlanDeFeu): MajScenario | null => {
    const actif = scenarioChoisi(pf);
    if (!actif) return null;
    return {
        simulationScenarios: scenariosDuPlan(pf).filter(s => !memeTitre(s.nom, actif.nom)),
        simulationName: '',
        simulationActions: idsValides(pf.simulationActions)
    };
};
