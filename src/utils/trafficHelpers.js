// @ts-check
/**
 * Aides trafic partagées entre le tableau Données Trafic et le panneau
 * Diagnostic, pour qu'ils calculent toujours à partir des mêmes bases
 * (aucune divergence de « vert total » ou de lecture du trafic).
 */

/**
 * Vert total d'un groupe = vert principal + durées des « Secondes lucarnes »
 * (actions de micro-régulation) du groupe. Gère le passage minuit (fin < deb).
 */
/**
 * @param {number} groupId
 * @param {number|undefined} mainGreenTime
 * @param {import('../types/projet.js').ActionMicro[]} [actionData]
 * @param {number} [cycleLength]
 * @returns {number}
 */
export const getTotalGreenTime = (groupId, mainGreenTime, actionData = [], cycleLength = 0) => {
    if (!mainGreenTime) return 0;
    const lucarneActions = actionData.filter(
        action => action.action === 'Seconde lucarne' &&
            parseInt(action.gf ?? '') === groupId &&
            action.deb !== '' && action.deb !== null &&
            action.fin !== '' && action.fin !== null
    );
    let lucarneDuration = 0;
    lucarneActions.forEach(lucarne => {
        const deb = parseFloat(lucarne.deb ?? '');
        const fin = parseFloat(lucarne.fin ?? '');
        if (!isNaN(deb) && !isNaN(fin)) {
            let duration = fin - deb;
            if (duration < 0) duration += cycleLength;
            lucarneDuration += duration;
        }
    });
    return mainGreenTime + lucarneDuration;
};

/** Valeur numérique du trafic (ignore le suffixe « c » de coordination). */
/**
 * @param {number|string|undefined|null} val
 * @returns {number}
 */
export const parseTrafficVol = (val) => {
    if (!val) return 0;
    const str = String(val).replace(/c$/i, '');
    return parseInt(str) || 0;
};

/** Vrai si le trafic est marqué coordonné (suffixe « c »). */
/**
 * @param {number|string|undefined|null} val
 * @returns {boolean}
 */
export const isCoordinated = (val) => String(val || '').endsWith('c');

/**
 * Les groupes de feu qu'une action cochée en simulation inhibe.
 *
 * Trois familles suppriment ou écourtent le vert d'un groupe au point que sa
 * capacité n'a plus de sens : escamotage de phase, fermeture anticipée,
 * adaptatif vertical. Le tableau Données Trafic laisse alors leurs colonnes
 * calculées vides — et la réserve de capacité, qui lit les mêmes groupes, doit
 * en faire autant : elle affichait un degré de saturation pour un groupe dont
 * le tableau juste au-dessus ne donnait aucune capacité.
 *
 * Rend un Set d'identifiants de groupes ; vide si aucune action n'est cochée.
 */
export const INHIBITEURS = ['Escamotage de phase', 'Fermeture anticipée', 'Adaptatif vertical'];

/**
 * @param {import('../types/projet.js').ActionMicro[]} [actionData]
 * @param {number[]} [selectedActions]
 * @returns {Set<number>}
 */
export const groupesInhibes = (actionData = [], selectedActions = []) => {
    /** @type {Set<number>} */
    const inhibes = new Set();
    actionData.forEach(action => {
        if (!selectedActions.includes(action.id)) return;
        if (!INHIBITEURS.includes(action.action)) return;
        if (!action.gf) return;
        const gfId = parseInt(action.gf.toString().replace(/[Gg]/g, '').trim());
        if (gfId > 0) inhibes.add(gfId);
    });
    return inhibes;
};
