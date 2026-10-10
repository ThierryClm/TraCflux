import type { ActionMicro } from '../../types/projet';
import type { EtatSimulation } from '../types';
import { toInt } from '../outils';
import { projeter, adjustForContractions } from '../journal';

/** Adaptatifs verticaux cochés. */
export const appliquerAdaptatifsVerticaux = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups, removedPeriods, timeShifts, contractions, journal } = etat;

    // 4. Adaptatif vertical - shift groups/actions after 'deb' by the duration, reduce cycle length
    // If plage1/plage2 are defined, only groups in that range are affected for green cutting
    // If not defined, all groups are affected
    // In all cases, groups starting after 'deb' are shifted
    const adaptatifActions = selectedActions.filter(a =>
        a.action === 'Adaptatif vertical' &&
        a.deb !== '' &&
        a.fin !== ''
    );

    const totalGroups = simulatedGroups.length;

    // Retire la zone [rawDeb, rawFin] (instants du plan d'origine) : du cycle
    // pour un adaptatif sans plage, des seules lignes de sa plage sinon.
    const retirerZone = (action: ActionMicro, rawDeb: number, rawFin: number) => {
        // Adjust deb/fin based on previous contractions (so we work on the virtual timeline)
        const deb = adjustForContractions(contractions, rawDeb);
        const fin = adjustForContractions(contractions, rawFin);
        const shiftAmount = fin > deb ? fin - deb : 0; // If fin <= deb after adjustment, skip

        if (shiftAmount <= 0) return;

        // Determine affected group range
        // If plage1/plage2 not defined, all groups are affected
        const hasPlageRange = action.plage1 !== '' && action.plage2 !== '';
        const plage1 = hasPlageRange ? (toInt(action.plage1) || 1) : 1;
        const plage2 = hasPlageRange ? (toInt(action.plage2) || totalGroups) : totalGroups;

        // Zone de l'adaptatif vue par chaque ligne (temps transformé par les
        // actions précédentes : points de repos, adaptatifs partiels).
        const zoneDuGroupe = new Map<number, { deb: number; fin: number }>();
        simulatedGroups.forEach(g => {
            zoneDuGroupe.set(g.id, { deb: projeter(journal, rawDeb, g.id), fin: projeter(journal, rawFin, g.id) });
        });

        // Record removed period and time shift for action overlays (use adjusted values)
        removedPeriods.push({ deb, fin, source: 'Adaptatif vertical', actionId: action.id });
        timeShifts.push({
            from: fin,
            amount: shiftAmount,
            plage1: plage1,
            plage2: plage2,
            isPartial: hasPlageRange,  // true if plage1/plage2 were explicitly set
            source: 'Adaptatif vertical',
            actionId: action.id
        });

        // Process groups in the affected range: cut green bars that overlap [deb, fin]
        // and shift their offset if they start at or after deb
        simulatedGroups.forEach(g => {
            if (g.isEscamoted) return;

            // Only process groups in the plage range (for partial) or all groups (for full)
            const isInPlageRange = g.id >= plage1 && g.id <= plage2;

            if (isInPlageRange) {
                const { deb, fin } = zoneDuGroupe.get(g.id)!;
                const shiftAmount = fin > deb ? fin - deb : 0;
                const offset = g.simulatedOffset;
                const greenEnd = offset + g.simulatedGreen;

                if (fin > deb) {
                    // Non-wrapping adaptatif zone [deb, fin]
                    // Case 1: Green bar starts before deb and extends into [deb, fin]
                    if (offset < deb && greenEnd > deb) {
                        const cutAmount = Math.min(greenEnd, fin) - deb;
                        g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                    }
                    // Case 2: Green bar starts within [deb, fin]
                    else if (offset >= deb && offset < fin) {
                        if (greenEnd <= fin) {
                            // Entirely within - escamote the group
                            g.isEscamoted = true;
                            g.simulatedGreen = 0;
                        } else {
                            // Starts in [deb, fin] but extends past fin
                            const cutAmount = fin - offset;
                            g.simulatedGreen = Math.max(0, g.simulatedGreen - cutAmount);
                            // Shift this group to start at deb (partial mode)
                            if (hasPlageRange) {
                                g.simulatedOffset = deb;
                            }
                        }
                    }
                    // Case 3: Green bar starts at or after fin - shift left by full amount (partial mode)
                    // Exception: if bar wraps around cycle and its wrapped portion completely covers [deb, fin],
                    // it "straddles" the zone via wrapping (like Case 1) and Deb should not shift
                    else if (offset >= fin && hasPlageRange) {
                        const wrapsAndCoversZone = greenEnd > etat.simulatedCycleLength &&
                            (greenEnd - etat.simulatedCycleLength) >= fin;
                        if (!wrapsAndCoversZone) {
                            g.simulatedOffset = Math.max(0, g.simulatedOffset - shiftAmount);
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
            }
        });

        // Only reduce cycle length and shift ALL groups if Adaptatif vertical is NOT partial
        // When partial (plage defined), only groups in the plage range are shifted (done above), cycle stays the same
        if (!hasPlageRange) {
            // Reduce cycle length by the adaptatif duration
            etat.simulatedCycleLength -= shiftAmount;

            // Shift ALL groups that start at or after 'fin' by -shiftAmount
            simulatedGroups.forEach(g => {
                if (g.isEscamoted) return;
                const { deb, fin } = zoneDuGroupe.get(g.id)!;
                const shiftAmount = fin > deb ? fin - deb : 0;

                if (g.simulatedOffset >= fin) {
                    // Group starts after the adaptatif zone - shift left by full amount
                    g.simulatedOffset = Math.max(0, g.simulatedOffset - shiftAmount);
                } else if (g.simulatedOffset >= deb) {
                    // Group starts within [deb, fin) - move to deb
                    g.simulatedOffset = deb;
                }
                // Groups starting before deb are not shifted
            });

            // Record this contraction for subsequent actions
            contractions.push({ deb, fin, source: 'Adaptatif vertical' });
        }
        journal.push({
            kind: 'contraction',
            deb: projeter(journal, rawDeb, hasPlageRange ? plage1 : null),
            fin: projeter(journal, rawFin, hasPlageRange ? plage1 : null),
            plage1,
            plage2,
            partiel: hasPlageRange
        });
    };

    adaptatifActions.forEach(action => {
        const rawDeb = toInt(action.deb) || 0;
        const rawFin = toInt(action.fin) || 0;

        if (rawFin >= rawDeb) {
            retirerZone(action, rawDeb, rawFin);
            return;
        }

        // Zone qui chevauche la fin du cycle (ex. 115-5 sur 120 s) : retirée
        // en deux temps, la fin du cycle puis son début.
        retirerZone(action, rawDeb, etat.cycleOrigine);
        // Un vert ramené au début de la partie retirée, désormais la fin du
        // cycle, reprend à 0.
        simulatedGroups.forEach(g => {
            if (g.simulatedOffset >= etat.simulatedCycleLength) g.simulatedOffset -= etat.simulatedCycleLength;
        });
        retirerZone(action, 0, rawFin);
    });
};
