import type { ActionMicro, DrapeauPhase, JeuTrafic, PlanDeFeu } from '../types/projet';

/**
 * Aides trafic partagées entre le tableau Données Trafic et le panneau
 * Diagnostic, pour qu'ils calculent toujours à partir des mêmes bases.
 */

/**
 * Vert pris en compte pour la capacité : vert principal + secondes lucarnes.
 * Un groupe en aiguillage (« a ») ne cumule pas sa seconde lucarne : elle
 * s'ouvre dans le créneau de l'autre branche de l'aiguillage, à la place de
 * celle-ci, et ne s'ajoute pas au vert principal à chaque cycle.
 */
export const getTotalGreenTime = (
    groupId: number,
    mainGreenTime: number | undefined,
    actionData: ActionMicro[] = [],
    cycleLength = 0,
    phaseFlag: DrapeauPhase = ''
): number => {
    if (!mainGreenTime) return 0;
    if (phaseFlag === 'a') return mainGreenTime;
    const lucarneActions = actionData.filter(
        action => action.action === 'Seconde lucarne' &&
            parseInt(String(action.gf ?? '')) === groupId &&
            action.deb !== '' && action.deb !== null &&
            action.fin !== '' && action.fin !== null
    );
    let lucarneDuration = 0;
    lucarneActions.forEach(lucarne => {
        const deb = parseFloat(String(lucarne.deb ?? ''));
        const fin = parseFloat(String(lucarne.fin ?? ''));
        if (!isNaN(deb) && !isNaN(fin)) {
            let duration = fin - deb;
            if (duration < 0) duration += cycleLength;
            lucarneDuration += duration;
        }
    });
    return mainGreenTime + lucarneDuration;
};

/** Valeur numérique du trafic (ignore le suffixe « c » de coordination). */
export const parseTrafficVol = (val: number | string | null | undefined): number => {
    if (!val) return 0;
    const str = String(val).replace(/c$/i, '');
    return parseInt(str) || 0;
};

/** Vrai si le trafic est marqué coordonné (suffixe « c »). */
export const isCoordinated = (val: number | string | null | undefined): boolean => String(val || '').endsWith('c');

/** Familles d'actions qui inhibent la capacité d'un groupe. */
export const INHIBITEURS = ['Escamotage de phase', 'Fermeture anticipée', 'Adaptatif vertical'];

export const groupesInhibes = (actionData: ActionMicro[] = [], selectedActions: number[] = []): Set<number> => {
    const inhibes = new Set<number>();
    actionData.forEach(action => {
        if (!selectedActions.includes(action.id)) return;
        if (!INHIBITEURS.includes(action.action)) return;
        if (!action.gf) return;
        const gfId = parseInt(action.gf.toString().replace(/[Gg]/g, '').trim());
        if (gfId > 0) inhibes.add(gfId);
    });
    return inhibes;
};

/**
 * Construit le catalogue réellement utilisable par le sélecteur Trafic.
 *
 * Un plan peut avoir été renommé sans que le jeu de trafic qui lui est associé
 * le soit. Le nom affiché du plan ne doit donc jamais servir directement de clé
 * dans `trafficDatasets` : `pfTrafficDatasetMap` est la source de vérité.
 */
export const buildTrafficDatasetNames = (
    pfTabs: Pick<PlanDeFeu, 'id' | 'name'>[] = [],
    pfTrafficDatasetMap: Record<string, string> = {},
    customNames: string[] = [],
    trafficDatasets: Record<string, JeuTrafic> = {},
    activeName = ''
): string[] => {
    const names = [
        ...pfTabs.map(pf => pfTrafficDatasetMap[String(pf.id)] || pf.name),
        'Projection',
        ...customNames,
        activeName,
        ...Object.keys(trafficDatasets).filter(name =>
            Object.values(trafficDatasets[name] || {}).some(data => parseTrafficVol(data?.trafficVol) > 0)
        ),
    ];
    return [...new Set(names.filter(Boolean))];
};

/** Vrai si le jeu contient du trafic pour au moins un groupe affichable. */
export const trafficDatasetHasData = (
    dataset: JeuTrafic | undefined,
    groupIds: Array<number | string>
): boolean => groupIds.some(id => parseTrafficVol(dataset?.[String(id)]?.trafficVol) > 0);

/** Ce que supprimer un jeu de trafic impliquerait, ou pourquoi c'est refusé. */
export interface PlanSuppressionJeu {
    /** Raison du refus ; absente si la suppression est possible. */
    refus?: string;
    /** Plans de feux qui utilisent le jeu, par leur nom. */
    plans: string[];
    /** Le jeu qui le remplace pour ces plans, et à l'écran. */
    remplacement: string;
}

/**
 * Prépare la suppression d'un jeu de trafic. « Projection » reste toujours
 * proposé — supprimé, il reviendrait vide — et le dernier jeu de la liste ne
 * se supprime pas. Les plans qui l'utilisaient passent sur le premier autre
 * jeu de la liste qui porte du trafic, à défaut sur le premier autre jeu.
 */
export const planSuppressionJeu = (
    nom: string,
    noms: string[],
    pfTabs: Pick<PlanDeFeu, 'id' | 'name'>[],
    pfTrafficDatasetMap: Record<string, string>,
    trafficDatasets: Record<string, JeuTrafic>,
    groupIds: Array<number | string>
): PlanSuppressionJeu => {
    const plans = pfTabs
        .filter(pf => (pfTrafficDatasetMap[String(pf.id)] || pf.name) === nom)
        .map(pf => pf.name);
    const autres = noms.filter(n => n !== nom);
    const remplacement = autres.find(n => trafficDatasetHasData(trafficDatasets[n], groupIds)) || autres[0] || '';
    if (nom === 'Projection') {
        return { refus: "« Projection » est un jeu standard, toujours proposé : il ne se supprime pas. Ses volumes peuvent être effacés à la main.", plans, remplacement };
    }
    if (!remplacement) {
        return { refus: "C'est le seul jeu de données : il ne se supprime pas.", plans, remplacement };
    }
    return { plans, remplacement };
};
