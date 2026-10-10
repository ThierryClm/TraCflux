import type { EtatSimulation } from '../types';
import { toInt } from '../outils';

/** Escamotage NON coché : le groupe source (GF) est masqué, en tout ou sur sa plage [deb, fin]. */
export const masquerEscamotagesNonCoches = (etat: EtatSimulation): void => {
    const { actionData, selectedActionIds, simulatedGroups } = etat;

    // Get UNselected Escamotage actions (for hiding the source group)
    const unselectedEscamotageActions = actionData.filter(a =>
        !selectedActionIds.includes(a.id) &&
        a.action === 'Escamotage' &&
        a.gf !== ''
    );

    // Process unselected Escamotage first - hide the source group (GF)
    // If deb/fin are specified, only hide the [deb, fin] range (greenCut) instead of the entire group
    unselectedEscamotageActions.forEach(action => {
        const gfId = toInt(action.gf);
        const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
        if (groupIndex !== -1) {
            const deb = action.deb !== '' ? toInt(action.deb) : null;
            const fin = action.fin !== '' ? toInt(action.fin) : null;
            if (deb !== null && fin !== null && !isNaN(deb) && !isNaN(fin)) {
                // deb/fin définis → escamotage partiel sur la plage [deb, fin]
                simulatedGroups[groupIndex].greenCuts.push({ deb, fin });
            } else {
                // Pas de deb/fin → masquer le groupe entièrement
                simulatedGroups[groupIndex].isEscamoted = true;
                simulatedGroups[groupIndex].simulatedGreen = 0;
            }
        }
    });
};

/** Escamotages cochés. */
export const appliquerEscamotagesGroupe = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups } = etat;

    // 3. Escamotage groupe - cut green bar of target group (actGf1) for action duration
    const escamotageActions = selectedActions.filter(a =>
        a.action === 'Escamotage' &&
        a.actGf1 !== '' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    escamotageActions.forEach(action => {
        // Parse actGf1 - might be "G2", "2", or just a number
        const actGf1Str = action.actGf1?.toString().replace(/[Gg]/g, '').trim() || '';
        const targetGfId = toInt(actGf1Str);
        const deb = toInt(action.deb) || 0;
        const fin = toInt(action.fin) || 0;

        if (!isNaN(targetGfId)) {
            const groupIndex = simulatedGroups.findIndex(g => g.id === targetGfId);
            if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                // Add a green cut period for this group
                simulatedGroups[groupIndex].greenCuts.push({ deb, fin });
            }
        }
    });
};
