/**
 * Proposition d'adaptatifs verticaux, un par phase (assistant de construction).
 *
 * Un adaptatif vertical [Déb, Fin] retire cette zone du cycle quand il est
 * contracté : tout groupe vert dans la zone perd ce temps, et le cycle
 * raccourcit d'autant (cf. simulation/operations/adaptatifVertical.ts).
 *
 * Pour chaque phase, la zone finit au plus tôt des fins de vert des groupes
 * de la phase (ceux dont le vert recouvre celui du déterminant) : contracter
 * au-delà de la fin d'un groupe rapprocherait son antagoniste suivant et
 * entamerait le temps intervert. Elle s'allonge vers la gauche, seconde par
 * seconde, sans contenir de début ni de fin de vert, tant que, sur le cycle
 * où toutes les zones sont contractées :
 *  - chaque groupe à trafic reste sous le taux visé (85 % par défaut) ;
 *  - chaque groupe raccourci garde au moins son vert mini.
 * Raccourcir le cycle redonne de la capacité aux autres phases : on refait
 * donc des passages (3 au plus), jusqu'à ce que plus aucune zone ne s'allonge.
 * Les 85 % ne valent alors que si toutes les zones se contractent ensemble :
 * la capacité utilisée « zone seule » est donnée pour le mesurer.
 *
 * Mode prudent : chaque zone est dimensionnée comme si elle seule se
 * contractait (un seul passage), et l'ensemble contracté est vérifié aussi :
 * le taux visé tient quelle que soit la combinaison de zones contractées.
 */
import { SATURATION_FLOW } from './capacityCalc';

export const PASSAGES_MAX = 3;
/**
 * Taux de saturation visé par défaut pour les zones : 90 %, au-dessus des 85 %
 * du calcul de cycle. Une phase ne se contracte que lorsque sa demande est
 * servie : viser plus bas ne protégerait rien.
 */
export const TAUX_VISE_ADAPTATIFS = 90;

export type ModeAdaptatifs = 'iteratif' | 'prudent';

/** Un groupe tel qu'il sera dans le diagramme (instants dans le cycle). */
export interface GroupeAdaptatif {
    id: number;
    debut: number;
    vert: number;
    vertMini: number;
    trafic: number;
    coefVoie: number;
}

export interface LimiteZone {
    id: number;
    /** vert mini atteint, taux visé atteint, ou début/fin de vert du groupe dans la zone. */
    raison: 'mini' | 'capacite' | 'degagement';
}

export interface AdaptatifPropose {
    phase: number;
    determinant: number;
    deb: number;
    fin: number;
    duree: number;
    /** Capacité utilisée du déterminant (%) : au cycle nominal, tout contracté, cette zone seule contractée. */
    capNominale: number | null;
    capContractee: number | null;
    capSeule: number | null;
    /** Ce qui empêche la zone de s'allonger d'une seconde de plus. */
    limite: LimiteZone | null;
    /** Autres groupes dont le vert est raccourci par la zone. */
    aussiRaccourcis: number[];
}

export interface PropositionAdaptatifs {
    adaptatifs: AdaptatifPropose[];
    cycleNominal: number;
    cycleContracte: number;
    /** Passages qui ont allongé au moins une zone. */
    passages: number;
}

/** Recouvrement (s) du vert [debut, debut + vert[ avec la zone [deb, fin[, rebouclage compris. */
const recouvrement = (g: GroupeAdaptatif, deb: number, fin: number, cycle: number) => {
    let total = 0;
    for (const decalage of [-cycle, 0, cycle]) {
        const a = Math.max(g.debut + decalage, deb);
        const b = Math.min(g.debut + decalage + g.vert, fin);
        if (b > a) total += b - a;
    }
    return total;
};

const capaciteUtilisee = (g: GroupeAdaptatif, vert: number, cycle: number) =>
    g.trafic > 0 && vert > 0 ? (g.trafic * cycle) / (SATURATION_FLOW * (g.coefVoie || 1) * vert) * 100 : null;

/**
 * @param determinants groupe déterminant de chaque phase, dans l'ordre du cycle
 * @param groupes disposition prévue des groupes (ceux sans vert sont ignorés)
 * @param cycle cycle nominal du plan
 * @param tauxVise taux de saturation visé, en %
 * @param mode itératif (3 passages au plus) ou prudent (chaque zone seule)
 */
export const proposerAdaptatifs = (
    determinants: number[],
    groupes: GroupeAdaptatif[],
    cycle: number,
    tauxVise: number,
    mode: ModeAdaptatifs = 'iteratif',
): PropositionAdaptatifs => {
    const verts = groupes.filter(g => g.vert > 0);
    const det = determinants.map(id => verts.find(g => g.id === id));
    // Fin de zone : la plus précoce des fins de vert des groupes de la phase,
    // lues dans le repère du déterminant (rebouclage compris).
    const fins = det.map(g => {
        if (!g) return 0;
        const finDet = g.debut + g.vert;
        let fin = finDet;
        for (const x of verts) {
            for (const decalage of [-cycle, 0, cycle]) {
                const a = x.debut + decalage;
                const b = a + x.vert;
                if (b > g.debut && a < finDet) fin = Math.min(fin, b);
            }
        }
        return fin;
    });
    const durees = determinants.map(() => 0);
    const limites: (LimiteZone | null)[] = determinants.map(() => null);

    // Premier groupe qui ne tient plus avec ces durées de zone, ou null.
    const bloquant = (d: number[], seule?: number): LimiteZone | null => {
        const zones = d.map((x, i) => ({ deb: fins[i] - x, fin: fins[i], x }))
            .filter((z, i) => z.x > 0 && (seule === undefined || i === seule));
        const cycleContracte = cycle - zones.reduce((s, z) => s + z.x, 0);
        for (const g of verts) {
            // Un début ou une fin de vert dans la zone : la contracter rapprocherait
            // ce groupe de ses antagonistes, au détriment des temps interverts.
            const instants = [g.debut, g.debut + g.vert].flatMap(t => [t - cycle, t, t + cycle]);
            if (zones.some(z => instants.some(t => t > z.deb && t < z.fin))) return { id: g.id, raison: 'degagement' };
            const coupe = zones.reduce((s, z) => s + recouvrement(g, z.deb, z.fin, cycle), 0);
            const vert = g.vert - coupe;
            if (coupe > 0 && vert < g.vertMini) return { id: g.id, raison: 'mini' };
            const cap = capaciteUtilisee(g, vert, cycleContracte);
            if (cap !== null && cap > tauxVise + 1e-9) return { id: g.id, raison: 'capacite' };
        }
        return null;
    };

    let passages = 0;
    const passagesMax = mode === 'prudent' ? 1 : PASSAGES_MAX;
    for (let p = 0; p < passagesMax; p++) {
        let allonge = false;
        det.forEach((g, i) => {
            if (!g) return;
            while (durees[i] < fins[i] - g.debut) {
                const essai = durees.map((x, k) => (k === i ? x + 1 : x));
                const b = (mode === 'prudent' ? bloquant(essai, i) : null) ?? bloquant(essai);
                if (b) { limites[i] = b; return; }
                durees[i] += 1;
                allonge = true;
            }
        });
        if (!allonge) break;
        passages++;
    }

    const total = durees.reduce((s, x) => s + x, 0);
    const adaptatifs = det.flatMap((g, i): AdaptatifPropose[] => {
        if (!g) return [];
        const coupe = (zones: number[]) => zones.reduce((s, x, k) =>
            s + (x > 0 ? recouvrement(g, fins[k] - x, fins[k], cycle) : 0), 0);
        return [{
            phase: i + 1,
            determinant: g.id,
            deb: fins[i] - durees[i],
            fin: fins[i],
            duree: durees[i],
            capNominale: capaciteUtilisee(g, g.vert, cycle),
            capContractee: capaciteUtilisee(g, g.vert - coupe(durees), cycle - total),
            capSeule: capaciteUtilisee(g, g.vert - durees[i], cycle - durees[i]),
            limite: limites[i],
            aussiRaccourcis: durees[i] > 0
                ? verts.filter(x => x.id !== g.id && recouvrement(x, fins[i] - durees[i], fins[i], cycle) > 0).map(x => x.id)
                : [],
        }];
    });
    return { adaptatifs, cycleNominal: cycle, cycleContracte: cycle - total, passages };
};
