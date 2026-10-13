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
 * Deux scénarios FIXES précèdent ceux qu'on enregistre : « Tout coché » et
 * « Tout décoché ». Leur composition se déduit du tableau des actions ; on ne
 * peut ni les modifier, ni les supprimer, et leurs titres sont réservés.
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

export const TOUT_COCHE = 'Tout coché';
export const TOUT_DECOCHE = 'Tout décoché';

/** Vrai pour « Tout coché » et « Tout décoché », casse et accents ignorés. */
export const estScenarioFixe = (nom: string): boolean =>
    memeTitre(nom, TOUT_COCHE) || memeTitre(nom, TOUT_DECOCHE);

/** Les deux scénarios fixes, composés d'après le tableau des actions. */
export const scenariosFixes = (actionData: ActionMicro[] = []): ScenarioSimulation[] => [
    { nom: TOUT_COCHE, actions: actionsSimulables(actionData).map(a => a.id) },
    { nom: TOUT_DECOCHE, actions: [] }
];

/**
 * Un scénario enregistré sous un titre devenu réservé — « tout coché »,
 * créé avant les scénarios fixes — est gardé, sous un titre distinct.
 */
const titreLibre = (nom: string, pris: string[]): string => {
    if (!estScenarioFixe(nom)) return nom;
    let n = 2;
    while (pris.some(p => memeTitre(p, `${nom} (${n})`))) n++;
    return `${nom} (${n})`;
};

const idsValides = (ids: unknown): number[] =>
    Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];

/** Les scénarios enregistrés du plan, par ordre alphabétique, ancien scénario unique compris. */
export const scenariosDuPlan = (pf: PlanDeFeu | null | undefined): ScenarioSimulation[] => {
    if (!pf) return [];
    const enregistres = (Array.isArray(pf.simulationScenarios) ? pf.simulationScenarios : [])
        .filter(s => s && normaliserTitreScenario(s.nom));
    const titres = enregistres.map(s => normaliserTitreScenario(s.nom));
    const liste = enregistres.map(s => ({
        nom: titreLibre(normaliserTitreScenario(s.nom), titres),
        actions: idsValides(s.actions)
    }));
    const nomActif = normaliserTitreScenario(pf.simulationName || '');
    if (nomActif && !estScenarioFixe(nomActif) && !liste.some(s => memeTitre(s.nom, nomActif))) {
        liste.push({ nom: nomActif, actions: idsValides(pf.simulationActions) });
    }
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
};

/** Le scénario choisi sur le plan, fixe ou enregistré, ou null (« Sans titre »). */
export const scenarioChoisi = (pf: PlanDeFeu | null | undefined): ScenarioSimulation | null => {
    const nom = normaliserTitreScenario(pf?.simulationName || '');
    if (!nom) return null;
    return [...scenariosFixes(pf?.data), ...scenariosDuPlan(pf)].find(s => memeTitre(s.nom, nom)) || null;
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
    if (estScenarioFixe(nom)) return `« ${nom} » est réservé au scénario fixe.`;
    const pris = scenarios.some(s => memeTitre(s.nom, nom) && !(ancien && memeTitre(s.nom, ancien)));
    return pris ? `Un scénario s'appelle déjà « ${nom} ».` : null;
};

type MajScenario = Pick<PlanDeFeu, 'simulationScenarios' | 'simulationName' | 'simulationActions'>;

/** Ouvre un scénario, fixe ou enregistré : ses cases remplacent celles de l'écran. */
export const choisirScenario = (pf: PlanDeFeu, nom: string): MajScenario | null => {
    const scenarios = scenariosDuPlan(pf);
    const cible = [...scenariosFixes(pf.data), ...scenarios]
        .find(s => memeTitre(s.nom, normaliserTitreScenario(nom)));
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
 * même titre met le scénario à jour, un autre le renomme. Un scénario fixe ne
 * s'enregistre pas : ses cases, on les garde en créant un scénario.
 */
export const enregistrerScenario = (pf: PlanDeFeu, titre: string): MajScenario | null => {
    const actif = scenarioChoisi(pf);
    if (!actif) return creerScenario(pf, titre);
    if (estScenarioFixe(actif.nom)) return null;
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
    if (!actif || estScenarioFixe(actif.nom)) return null;
    return {
        simulationScenarios: scenariosDuPlan(pf).filter(s => !memeTitre(s.nom, actif.nom)),
        simulationName: '',
        simulationActions: idsValides(pf.simulationActions)
    };
};
