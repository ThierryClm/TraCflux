import type { EtatSimulation, OperationTemps } from '../types';

/** Temps global effectivement retiré avant un rendez-vous du cycle d'origine. */
const bilanAvant = (journal: OperationTemps[], instant: number) => {
    let t = instant;
    let retire = 0;
    for (const op of journal) {
        if (op.kind === 'repos') {
            if (t >= op.t) t += op.duree;
        } else if (!op.partiel) {
            const avant = t;
            if (t >= op.fin) t -= op.fin - op.deb;
            else if (t > op.deb) t = op.deb;
            retire += avant - t;
        }
    }
    return { t, retire };
};

/** Chaque BTS compense les réductions globales depuis le rendez-vous précédent. */
export const compenserAuxSynchrosBts = (etat: EtatSimulation): void => {
    const journalInitial = [...etat.journal];
    const synchros = etat.actionData
        .filter(a => a.action === 'Synchro BTS' && a.deb !== '' && a.deb != null)
        .map(a => ({ id: a.id, t: Number(a.deb) }))
        .filter(a => Number.isFinite(a.t) && a.t >= 0 && a.t <= etat.cycleOrigine)
        .sort((a, b) => a.t - b.t);
    let compense = 0;
    for (const synchro of synchros) {
        const bilan = bilanAvant(journalInitial, synchro.t);
        const duree = bilan.retire - compense;
        if (duree <= 0) continue;
        const t = bilan.t + compense;
        for (const g of etat.simulatedGroups) {
            if (g.isEscamoted) continue;
            const fin = g.simulatedOffset + g.simulatedGreen;
            if (g.simulatedOffset >= t) {
                g.simulatedOffset += duree;
                if (fin - etat.simulatedCycleLength >= t) g.simulatedGreen += duree;
            } else if (fin >= t) g.simulatedGreen += duree;
        }
        for (const repos of etat.restPoints) {
            if (repos.deb >= t) repos.deb += duree;
        }
        etat.simulatedCycleLength += duree;
        etat.journal.push({ kind: 'repos', t, duree });
        etat.restPoints.push({ deb: t, originalDeb: synchro.t, duration: duree, actionId: synchro.id, source: 'Synchro BTS' });
        compense += duree;
    }
};
