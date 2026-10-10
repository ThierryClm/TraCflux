import type { EtatSimulation } from '../types';
import { toInt } from '../outils';
import { projeter } from '../journal';

/** Points de repos cochés : le cycle se fige REST_DURATION secondes à chacun. */
export const appliquerPointsDeRepos = (etat: EtatSimulation): void => {
    const { selectedActions, simulatedGroups, restPoints, journal } = etat;

    // 0. Point de repos — at each selected rest point t (in original timeline),
    // freeze the cycle for REST_DURATION seconds. Cycle grows; groups whose green
    // covers t are stretched (option A: green duration extended); groups starting
    // after t are shifted to the right.
    //
    // Inhibition rule: a rest point that falls INSIDE the [deb, fin] zone of a
    // selected Adaptatif vertical or Escamotage de phase action is ignored,
    // because that zone is removed from the cycle later and the freeze cannot apply.
    const REST_DURATION = 10;
    const inhibitionZones = selectedActions
        .filter(a => (a.action === 'Adaptatif vertical' || a.action === 'Escamotage de phase') && a.deb !== '' && a.fin !== '')
        .map(a => ({ deb: toInt(a.deb) || 0, fin: toInt(a.fin) || 0 }));

    const isRestPointInhibited = (rawDeb: number) =>
        inhibitionZones.some(z => z.fin > z.deb && rawDeb >= z.deb && rawDeb < z.fin);

    const restPointActions = selectedActions
        .filter(a => a.action === 'Point de repos' && a.deb !== '')
        .map(a => ({ id: a.id, rawDeb: toInt(a.deb) || 0 }))
        .filter(a => !isRestPointInhibited(a.rawDeb))
        .sort((a, b) => a.rawDeb - b.rawDeb);

    restPointActions.forEach(({ id, rawDeb }, idx) => {
        // Effective position in the (already-stretched) simulated timeline:
        // each prior rest point added REST_DURATION before this one.
        const t = rawDeb + idx * REST_DURATION;

        simulatedGroups.forEach(g => {
            if (g.isEscamoted) return;
            const greenEnd = g.simulatedOffset + g.simulatedGreen;
            if (g.simulatedOffset >= t) {
                // Group starts at/after the rest point → shift right
                g.simulatedOffset += REST_DURATION;
                // Un vert qui chevauche la fin du cycle reprend au début du
                // suivant : s'il y couvre encore t (ou y finit à t), il est aussi
                // étiré, comme un vert qui couvre t dans le cycle.
                if (greenEnd - etat.simulatedCycleLength >= t) {
                    g.simulatedGreen += REST_DURATION;
                }
            } else if (greenEnd >= t) {
                // Green covers t (or ends exactly at t) → stretch (option A)
                // Including the equality case: a green ending at t is treated as
                // « still green at the freeze instant », so it continues during the freeze.
                g.simulatedGreen += REST_DURATION;
            }
            // else: green ends before t → unchanged
        });

        etat.simulatedCycleLength += REST_DURATION;
        journal.push({ kind: 'repos', t, duree: REST_DURATION });
        restPoints.push({ deb: t, originalDeb: rawDeb, duration: REST_DURATION, actionId: id });
    });
};

/** Position affichée des points de repos, une fois toutes les contractions appliquées. */
export const placerZonesDeRepos = (etat: EtatSimulation): void => {
    const { selectedActions, contractions, restPoints, journal } = etat;

    // Position affichée de chaque point de repos : son instant (déjà placé
    // après les repos précédents), ramené par les contractions appliquées
    // ensuite, vues depuis la première ligne de sa plage.
    restPoints.forEach(restPoint => {
        const action = selectedActions.find(a => a.id === restPoint.actionId);
        const plage1 = action ? toInt(action.plage1) : NaN;
        restPoint.deb = projeter(journal, restPoint.deb, !isNaN(plage1) && plage1 > 0 ? plage1 : null, true);
    });
};
