import type { ActionMicro } from '../../types/projet';
import type { EtatSimulation } from '../types';
import { toInt } from '../outils';
import { projeter, adjustForContractions } from '../journal';

/** Escamotages de phase cochés, traités en dernier. */
export const appliquerEscamotagesDePhase = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups, removedPeriods, timeShifts, contractions, journal } = etat;

    // 5. Escamotage de phase - remove the phase and reduce cycle (traité EN DERNIER)
    // Ne se cumule pas avec les effets déjà appliqués par les actions précédentes
    const escamotagePhaseActions = selectedActions.filter(a =>
        a.action === 'Escamotage de phase' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    // Retire la zone [rawDeb, rawFin] (instants du plan d'origine) du cycle.
    const retirerZone = (action: ActionMicro, rawDeb: number, rawFin: number) => {
        // Adjust deb/fin based on previous contractions (so we work on the virtual timeline)
        const deb = adjustForContractions(contractions, rawDeb);
        const fin = adjustForContractions(contractions, rawFin);
        const duration = fin > deb ? fin - deb : 0; // If fin <= deb after adjustment, skip

        if (duration <= 0) return;

        // Zone de l'escamotage vue par chaque ligne (temps transformé par les
        // actions précédentes : points de repos, adaptatifs partiels).
        const zoneDuGroupe = new Map<number, { deb: number; fin: number }>();
        simulatedGroups.forEach(g => {
            zoneDuGroupe.set(g.id, { deb: projeter(journal, rawDeb, g.id), fin: projeter(journal, rawFin, g.id) });
        });
        // Largeur retirée au cycle : celle vue en commun par toutes les lignes.
        const debCommun = projeter(journal, rawDeb, null);
        const finCommun = projeter(journal, rawFin, null);
        const largeurRetiree = finCommun > debCommun ? finCommun - debCommun : 0;

        // If GF is specified, only mark as escamoted if the group's green actually overlaps [deb, fin]
        if (action.gf) {
            const gfId = toInt(action.gf);
            const groupIndex = simulatedGroups.findIndex(g => g.id === gfId);
            if (groupIndex !== -1) {
                const g = simulatedGroups[groupIndex];
                const { deb, fin } = zoneDuGroupe.get(g.id)!;
                const greenEnd = g.simulatedOffset + g.simulatedGreen;
                // Check if the group's green overlaps with [deb, fin]
                const overlaps = fin > deb && (
                    (g.simulatedOffset >= deb && g.simulatedOffset < fin) ||
                    (greenEnd > deb && greenEnd <= fin) ||
                    (g.simulatedOffset < deb && greenEnd > fin)
                );
                if (overlaps) {
                    g.isEscamoted = true;
                    g.simulatedGreen = 0;
                }
            }
        }

        // Record removed period for action filtering (use adjusted values)
        removedPeriods.push({ deb, fin, source: 'Escamotage de phase', actionId: action.id });

        // Record time shift for action overlays
        timeShifts.push({ from: fin, amount: duration, source: 'Escamotage de phase', actionId: action.id });

        // For each group, cut the green bar that intersects with [deb, fin]
        simulatedGroups.forEach(g => {
            if (g.isEscamoted) return;

            const { deb, fin } = zoneDuGroupe.get(g.id)!;
            const offset = g.simulatedOffset;
            const greenEnd = offset + g.simulatedGreen;

            // Check if green bar intersects with [deb, fin]
            if (fin > deb) {
                // Case 1: Green starts before deb and extends into [deb, fin]
                if (offset < deb && greenEnd > deb) {
                    // Cut the part after deb
                    const cutAmount = Math.min(greenEnd, fin) - deb;
                    g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                }
                // Case 2: Green starts within [deb, fin]
                else if (offset >= deb && offset < fin) {
                    if (greenEnd <= fin) {
                        // Entirely within - escamote the group
                        g.isEscamoted = true;
                        g.simulatedGreen = 0;
                    } else {
                        // Starts in [deb, fin] but extends past fin
                        const cutAmount = fin - offset;
                        g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                        // Will be shifted later
                    }
                }

                // Case 4: Green bar wraps around the cycle and its wrap portion [0, wrapEnd] overlaps [deb, fin]
                if (greenEnd > etat.simulatedCycleLength) {
                    const wrapEnd = greenEnd - etat.simulatedCycleLength;
                    if (wrapEnd > deb) {
                        const overlapEnd = Math.min(wrapEnd, fin);
                        const wrapCutAmount = overlapEnd - deb;
                        if (wrapCutAmount > 0) {
                            g.simulatedGreen = Math.max(0, g.simulatedGreen - wrapCutAmount);
                        }
                    }
                }
            }
        });

        // Reduce cycle length
        etat.simulatedCycleLength -= largeurRetiree;

        // Shift all groups that start at or after 'fin' by -duration
        // (after the removed period, everything shifts left)
        simulatedGroups.forEach(g => {
            const { deb, fin } = zoneDuGroupe.get(g.id)!;
            const duration = fin > deb ? fin - deb : 0;
            if (!g.isEscamoted && g.simulatedOffset >= fin) {
                g.simulatedOffset = Math.max(0, g.simulatedOffset - duration);
            } else if (!g.isEscamoted && g.simulatedOffset >= deb) {
                // Groups starting within [deb, fin) that weren't escamoted - move to deb
                g.simulatedOffset = deb;
            }
        });

        // Record this contraction for subsequent escamotage de phase actions
        contractions.push({ deb, fin, source: 'Escamotage de phase' });
        journal.push({ kind: 'contraction', deb: debCommun, fin: finCommun, partiel: false });
    };

    escamotagePhaseActions.forEach(action => {
        const rawDeb = toInt(action.deb) || 0;
        const rawFin = toInt(action.fin) || 0;

        if (rawFin >= rawDeb) {
            retirerZone(action, rawDeb, rawFin);
            return;
        }

        // Zone qui chevauche la fin du cycle (ex. 102-8 sur 120 s) : retirée
        // en deux temps, la fin du cycle puis son début.
        retirerZone(action, rawDeb, etat.cycleOrigine);
        // Le cycle a raccourci : un vert qui commençait dans la partie retirée
        // a été ramené à la nouvelle fin du cycle, il reprend donc à 0.
        simulatedGroups.forEach(g => {
            if (g.simulatedOffset >= etat.simulatedCycleLength) g.simulatedOffset -= etat.simulatedCycleLength;
        });
        retirerZone(action, 0, rawFin);
    });
};
