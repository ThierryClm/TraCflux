/**
 * Proposition d'un point de repos par groupe bus (assistant de construction).
 *
 * Le repos fige tout le cycle : il se place dans les 5 dernières secondes du
 * vert bus, à l'instant où le plus de groupes sont au vert (ils profitent
 * tous de l'attente), le plus tard possible à égalité. La condition de sortie
 * compare l'arrivée du bus au temps maxi d'attente :
 * « Attente quittée si TPPh_Ln + DAx > N + TMABx », avec N le temps passé
 * dans la phase bus à l'instant du repos, moins 1. L'indice x tient la place
 * du code trajet, à remplacer par l'utilisateur.
 */

export const FENETRE_REPOS_BUS = 5;
/** Début de la description : repère des repos inscrits par l'assistant. */
export const DESCRIPTION_REPOS_BUS = 'attente bus théorique';

export interface GroupeRepos {
    id: number;
    type: string;
    debut: number;
    vert: number;
}

export interface ReposPropose {
    groupe: number;
    /** Instant du repos dans le cycle. */
    instant: number;
    /** Groupes au vert à cet instant (bus compris). */
    inclus: number[];
    /** Temps passé dans la phase bus à l'instant du repos, moins 1. */
    n: number;
}

const mod = (v: number, c: number) => ((v % c) + c) % c;
export const estBus = (type: string) => /^(B|TC|BUS)$/i.test(type.trim());

export const proposerReposBus = (groupes: GroupeRepos[], cycle: number): ReposPropose[] => {
    const verts = groupes.filter(g => g.vert > 0);
    return verts.filter(g => estBus(g.type)).map(bus => {
        let meilleur: { instant: number; inclus: number[] } | null = null;
        const premier = Math.max(0, bus.vert - FENETRE_REPOS_BUS);
        for (let k = premier; k < bus.vert; k++) {
            const t = mod(bus.debut + k, cycle);
            const inclus = verts.filter(g => mod(t - g.debut, cycle) < g.vert).map(g => g.id);
            // « >= » : à égalité, l'instant le plus tardif.
            if (!meilleur || inclus.length >= meilleur.inclus.length) meilleur = { instant: t, inclus };
        }
        const instant = meilleur?.instant ?? bus.debut;
        return {
            groupe: bus.id,
            instant,
            inclus: meilleur?.inclus ?? [bus.id],
            n: Math.max(0, mod(instant - bus.debut, cycle) - 1),
        };
    });
};

export const TMAB_DEFAUT = 10;
/** Variable micro ajoutée au plan quand elle manque. */
export const VARIABLE_TMABX = `TMABx = ${TMAB_DEFAUT}`;

/** Valeur de TMABx dans les variables micro du plan (« TMABx = 12 »), ou null si elle n'y est pas. */
export const lireTmabX = (variables: string[] | undefined): number | null => {
    for (const v of variables ?? []) {
        const m = /^\s*TMABx\s*=\s*(\d+)/i.exec(v);
        if (m) return parseInt(m[1], 10);
    }
    return null;
};
