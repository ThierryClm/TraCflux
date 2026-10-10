import type { EtatSimulation } from '../types';
import { toInt } from '../outils';

/** Ouvertures anticipées cochées. */
export const appliquerOuverturesAnticipees = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups } = etat;

    // 1. Ouverture anticipée - shift the start of green earlier
    const ouvertureActions = selectedActions.filter(a =>
        a.action === 'Ouverture anticipée' &&
        a.gf !== '' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    ouvertureActions.forEach(action => {
        const gfId = toInt(action.gf);
        const deb = toInt(action.deb) || 0;
        const fin = toInt(action.fin) || 0;
        const shiftAmount = fin > deb ? fin - deb : (fin + etat.simulatedCycleLength - deb);

        const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
        if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
            // Shift the start earlier and extend the green duration
            simulatedGroups[groupIndex].simulatedOffset =
                (simulatedGroups[groupIndex].simulatedOffset - shiftAmount + etat.simulatedCycleLength) % etat.simulatedCycleLength;
            simulatedGroups[groupIndex].simulatedGreen += shiftAmount;
        }
    });
};
