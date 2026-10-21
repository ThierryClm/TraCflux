/**
 * Position du curseur de lecture quand la simulation change (case cochée ou
 * décochée, scénario choisi, durée de repos modifiée) : il reste au même
 * instant du cycle d'origine.
 *
 * Le journal décrit comment le temps du plan d'origine devient le temps
 * simulé : un point de repos insère sa durée, un escamotage de phase ou un
 * adaptatif vertical sans plage retire sa zone. On ramène le curseur dans le
 * temps d'origine avec l'ancien journal, puis on le reporte avec le nouveau.
 *
 * Règles qui en découlent, pour une action cochée ou décochée :
 * - avant l'endroit concerné : le curseur ne bouge pas ;
 * - après : il avance (repos ajouté, zone rétablie) ou recule (repos retiré,
 *   zone retirée) de la durée correspondante ;
 * - dans une zone de repos qu'on retire, ou une zone qu'on retire du cycle :
 *   il se place à son début ; dans un repos qui demeure, il y garde sa place.
 * Un adaptatif avec plage ne change pas la durée du cycle : il est ignoré.
 */
import type { OperationTemps } from './types';

/** Instant du cycle d'origine ; dans un repos, l'avance déjà faite dans ce repos. */
interface InstantOrigine {
    instant: number;
    dansRepos: number | null;
}

const estGlobale = (op: OperationTemps) => op.kind === 'repos' || !op.partiel;

/** Du temps simulé vers le temps d'origine, opérations prises à rebours. */
export const versOrigine = (journal: OperationTemps[], temps: number): InstantOrigine => {
    let t = temps;
    let dansRepos: number | null = null;
    for (let i = journal.length - 1; i >= 0; i--) {
        const op = journal[i];
        if (!estGlobale(op)) continue;
        if (op.kind === 'repos') {
            if (t > op.t + op.duree) t -= op.duree;
            else if (t >= op.t) { dansRepos = t - op.t; t = op.t; }
        } else if (t > op.deb) {
            // Une zone retirée a été rétrécie en un point, son début.
            t += op.fin - op.deb;
        }
    }
    return { instant: t, dansRepos };
};

/** Du temps d'origine vers le temps simulé. */
export const depuisOrigine = (journal: OperationTemps[], { instant, dansRepos }: InstantOrigine): number => {
    let t = instant;
    let resteDansRepos = dansRepos;
    for (const op of journal) {
        if (!estGlobale(op)) continue;
        if (op.kind === 'repos') {
            if (t > op.t) t += op.duree;
            else if (t === op.t && resteDansRepos !== null) {
                // Le repos où se trouvait le curseur demeure : il y garde sa place.
                t += Math.min(resteDansRepos, op.duree);
                resteDansRepos = null;
            }
        } else if (t >= op.fin) t -= op.fin - op.deb;
        else if (t > op.deb) t = op.deb;
    }
    return t;
};

/** Curseur recalé d'une simulation à la suivante, dans les bornes du nouveau cycle. */
export const recalerCurseur = (
    temps: number,
    ancienJournal: OperationTemps[],
    nouveauJournal: OperationTemps[],
    nouveauCycle: number
): number => {
    const t = depuisOrigine(nouveauJournal, versOrigine(ancienJournal, temps));
    return Math.max(0, Math.min(Math.round(t), Math.max(0, nouveauCycle - 1)));
};
