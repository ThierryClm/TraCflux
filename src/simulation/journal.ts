import type { Contraction, OperationTemps } from './types';

// Recale une position du plan d'origine d'après les contractions complètes
// déjà appliquées (position dans le cycle contracté).
export const adjustForContractions = (contractions: Contraction[], time: number) => {
    let adjusted = time;
    for (const c of contractions) {
        if (adjusted >= c.fin) {
            // Position is after the contracted zone → shift left by the zone width
            adjusted -= (c.fin - c.deb);
        } else if (adjusted > c.deb) {
            // Position is inside the contracted zone → clamp to the zone start
            adjusted = c.deb;
            // Also adjust c.deb for subsequent contractions' reference
            // (c.deb itself was already in the adjusted space)
        }
    }
    return adjusted;
};

// Projette un instant du plan d'origine dans le temps transformé vu par la
// ligne du groupe groupId (null : les seules opérations communes à toutes
// les lignes). contractionsSeules : ignore les points de repos, pour un
// instant déjà placé après eux.
export const projeter = (journal: OperationTemps[], time: number, groupId: number | null, contractionsSeules = false) => {
    let t = time;
    for (const op of journal) {
        if (op.kind === 'repos') {
            if (!contractionsSeules && t >= op.t) t += op.duree;
            continue;
        }
        if (op.partiel && (groupId === null || groupId < (op.plage1 as number) || groupId > (op.plage2 as number))) continue;
        if (t >= op.fin) t -= op.fin - op.deb;
        else if (t > op.deb) t = op.deb;
    }
    return t;
};

