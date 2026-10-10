import type { EtatSimulation } from '../types';
import { toInt, TARGET_GROUP_FIELDS } from '../outils';

/** Fermetures anticipées cochées. */
export const appliquerFermeturesAnticipees = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups } = etat;

    // 2. Fermeture anticipée:
    // - Reduce green duration of the group in GF (end of green moves left)
    // - Apply "glissement" (shift offset left) to groups in actGf1-4
    const fermetureActions = selectedActions.filter(a =>
        a.action === 'Fermeture anticipée' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    // Collect AV and EP zones (raw values) for computing effective fermeture durations
    const avEpZones = selectedActions
        .filter(a => (a.action === 'Adaptatif vertical' || a.action === 'Escamotage de phase') && a.deb !== '' && a.fin !== '')
        .map(a => ({ deb: toInt(a.deb) || 0, fin: toInt(a.fin) || 0 }));

    fermetureActions.forEach(action => {
        const deb = toInt(action.deb) || 0;
        const fin = toInt(action.fin) || 0;
        const shiftAmount = fin > deb ? fin - deb : (fin + etat.simulatedCycleLength - deb);

        // Compute effective shift: subtract overlap with selected AV/EP zones
        // (these zones will be removed later, reducing the effective fermeture duration)
        let overlapWithAvEp = 0;
        avEpZones.forEach(zone => {
            const zDeb = zone.deb;
            const zFin = zone.fin;
            if (zFin > zDeb && fin > deb) {
                // Non-wrapping: overlap = max(0, min(fin, zFin) - max(deb, zDeb))
                const overlap = Math.max(0, Math.min(fin, zFin) - Math.max(deb, zDeb));
                overlapWithAvEp += overlap;
            }
        });
        const effectiveShiftAmount = Math.max(0, shiftAmount - overlapWithAvEp);

        // 1. Reduce green duration for the group in GF field
        if (action.gf && action.gf !== '') {
            const gfId = toInt(action.gf);
            if (!isNaN(gfId)) {
                const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
                if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                    // Reduce green duration (end of green moves left) — full amount for source group
                    simulatedGroups[groupIndex].simulatedGreen = Math.max(0, simulatedGroups[groupIndex].simulatedGreen - shiftAmount);
                }
            }
        }

        // 2. Apply effect to target groups in Action GF fields
        // Determine if the action zone points to START or END of each target's green
        const targetGfIds: number[] = [];
        TARGET_GROUP_FIELDS.forEach(field => {
            if (action[field] && action[field] !== '') {
                const gfStr = action[field]?.toString().replace(/[Gg]/g, '').trim() || '';
                const gfId = toInt(gfStr);
                if (!isNaN(gfId) && !targetGfIds.includes(gfId)) {
                    targetGfIds.push(gfId);
                }
            }
        });

        // Helper: circular distance between two points on the cycle
        const circDist = (a: number, b: number) => {
            const d = Math.abs(a - b);
            return Math.min(d, etat.simulatedCycleLength - d);
        };

        targetGfIds.forEach(targetGfId => {
            const groupIndex = simulatedGroups.findIndex(g => g.id === targetGfId);
            if (groupIndex !== -1 && !simulatedGroups[groupIndex].isEscamoted) {
                const target = simulatedGroups[groupIndex];
                const greenStart = target.simulatedOffset;
                const greenEnd = (target.simulatedOffset + target.simulatedGreen) % etat.simulatedCycleLength;
                const actionMid = (deb + Math.floor(shiftAmount / 2)) % etat.simulatedCycleLength;

                const distToEnd = circDist(actionMid, greenEnd);
                const distToStart = circDist(actionMid, greenStart);

                if (distToEnd < distToStart) {
                    // Arrow points to END of green → fermeture anticipée on target
                    // Reduce green duration (end moves left) — use effective amount
                    target.simulatedGreen = Math.max(0, target.simulatedGreen - effectiveShiftAmount);
                } else {
                    // Arrow points to START of green → glissement
                    // Shift offset left, increase green to keep end position — use effective amount
                    target.simulatedOffset =
                        (target.simulatedOffset - effectiveShiftAmount + etat.simulatedCycleLength) % etat.simulatedCycleLength;
                    target.simulatedGreen += effectiveShiftAmount;
                }
            }
        });
    });
};
