import type { ActionMicro } from '../types/projet';

/**
 * Aides trafic partagées entre le tableau Données Trafic et le panneau
 * Diagnostic, pour qu'ils calculent toujours à partir des mêmes bases.
 */

export const getTotalGreenTime = (
    groupId: number,
    mainGreenTime: number | undefined,
    actionData: ActionMicro[] = [],
    cycleLength = 0
): number => {
    if (!mainGreenTime) return 0;
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
