/**
 * Suggestion de durée du cycle d'un plan de feu (méthode de Webster).
 *
 * L'utilisateur donne, dans l'ordre du cycle, le groupe déterminant de chaque
 * phase (2 à 6) et le dégagement entre deux phases successives (pré-rempli par
 * la matrice, du déterminant d'une phase vers celui de la suivante, mais
 * modifiable : le dégagement qui compte peut venir d'un autre groupe de la
 * phase). On en tire :
 *  - y = trafic / (débit de saturation × coefficient de voie), par phase ;
 *  - Y = Σ y et le temps perdu L = Σ dégagements ;
 *  - le cycle minimal L / (1 − Y), le cycle optimal de Webster
 *    (1,5 L + 5) / (1 − Y) et le cycle qui tient un taux de saturation visé
 *    L / (1 − Y / x) ;
 *  - des verts par phase, proportionnels aux y, jamais sous le vert minimum.
 */
import { SATURATION_FLOW } from './capacityCalc';
import type { Matrice } from '../types/projet';

/** Phasage saisi pour le calcul, enregistré avec le plan de feu. */
export interface PhasageCycle {
    /** Groupe déterminant de chaque phase, dans l'ordre du cycle. */
    determinants: number[];
    /** Dégagement (s) de la phase i vers la phase i+1 (la dernière vers la première). */
    degagements: number[];
    /** Taux de saturation visé, en % (85 par défaut). */
    tauxVise?: number;
}

export const NB_PHASES_MIN = 2;
export const NB_PHASES_MAX = 6;
export const TAUX_VISE_DEFAUT = 85;
/** Y au-delà duquel le carrefour est considéré comme saturé. */
export const Y_SATURE = 0.9;
export const CYCLE_MIN_CONSEILLE = 40;
export const CYCLE_MAX_CONSEILLE = 120;

/** Données d'un groupe utiles au calcul. */
export interface DonneesGroupe {
    id: number;
    nom: string;
    trafic: number;
    coefVoie: number;
    vertMini: number;
}

export interface PhaseCalculee {
    determinant: number;
    nom: string;
    trafic: number;
    coefVoie: number;
    vertMini: number;
    /** Rapport de débit (0 si le groupe n'a pas de trafic). */
    y: number;
}

export interface ResultatCycle {
    phases: PhaseCalculee[];
    Y: number;
    L: number;
    /** null quand Y ≥ 1 : aucun cycle ne suffit. */
    cycleMinimal: number | null;
    /** Valeur exacte de Webster, avant arrondi à la seconde. */
    websterExact: number | null;
    cycleWebster: number | null;
    cycleTauxVise: number | null;
    sature: boolean;
    /** Verts proposés pour le cycle de Webster, arrondis à la seconde. */
    verts: number[];
    /** Phases dont le dégagement vers la suivante n'est pas renseigné. */
    degagementsManquants: number[];
}

/** Dégagement lu dans la matrice entre deux groupes ; null si la case est vide. */
export const degagementMatrice = (matrice: Matrice | undefined, de: number, vers: number): number | null => {
    const v = matrice?.[de - 1]?.[vers - 1];
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Dégagements pré-remplis : matrice entre déterminants successifs (null si vide). */
export const degagementsParDefaut = (determinants: number[], matrice: Matrice | undefined): (number | null)[] =>
    determinants.map((d, i) => degagementMatrice(matrice, d, determinants[(i + 1) % determinants.length]));

const arrondi = (v: number) => Math.round(v);
/** Un cycle « minimal » ne s'arrondit jamais vers le bas. */
const parExces = (v: number) => Math.ceil(v - 1e-9);

export const calculerSuggestionCycle = (
    phasage: { determinants: number[]; degagements: (number | null)[]; tauxVise?: number },
    groupes: DonneesGroupe[],
    saturation = SATURATION_FLOW,
): ResultatCycle => {
    const phases: PhaseCalculee[] = phasage.determinants.map(id => {
        const g = groupes.find(x => x.id === id);
        const trafic = Math.max(0, g?.trafic || 0);
        const coefVoie = g?.coefVoie || 1;
        return {
            determinant: id, nom: g?.nom || `GF${id}`, trafic, coefVoie,
            vertMini: Math.max(0, g?.vertMini || 0),
            y: trafic > 0 ? trafic / (saturation * coefVoie) : 0,
        };
    });
    const degagementsManquants = phasage.degagements
        .map((d, i) => (d === null || d === undefined || !Number.isFinite(d) ? i : -1))
        .filter(i => i >= 0);
    const L = phasage.degagements.reduce<number>((s, d) => s + (Number.isFinite(d) ? (d as number) : 0), 0);
    const Y = phases.reduce((s, p) => s + p.y, 0);
    const taux = (phasage.tauxVise ?? TAUX_VISE_DEFAUT) / 100;

    const possible = Y < 1;
    const cycleMinimal = possible ? parExces(L / (1 - Y)) : null;
    const websterExact = possible ? (1.5 * L + 5) / (1 - Y) : null;
    const cycleWebster = websterExact === null ? null : arrondi(websterExact);
    const cycleTauxVise = Y < taux && taux > 0 ? parExces(L / (1 - Y / taux)) : null;

    return {
        phases, Y, L, cycleMinimal, websterExact, cycleWebster, cycleTauxVise,
        sature: Y >= Y_SATURE,
        verts: cycleWebster ? repartirVerts(phases, cycleWebster - L) : phases.map(p => p.vertMini),
        degagementsManquants,
    };
};

/**
 * Répartit le vert disponible entre les phases, proportionnellement aux y,
 * sans descendre sous le vert minimum du déterminant. Les phases contraintes
 * par leur minimum le gardent, le reste se répartit entre les autres.
 */
export const repartirVerts = (phases: Pick<PhaseCalculee, 'y' | 'vertMini'>[], vertDisponible: number): number[] => {
    const verts = phases.map(p => p.vertMini);
    let libres = phases.map((_, i) => i).filter(i => phases[i].y > 0);
    for (let essai = 0; essai < phases.length && libres.length; essai++) {
        const fixe = phases.reduce((s, p, i) => s + (libres.includes(i) ? 0 : verts[i]), 0);
        const reste = Math.max(0, vertDisponible - fixe);
        const sommeY = libres.reduce((s, i) => s + phases[i].y, 0);
        const sousMini = libres.filter(i => (reste * phases[i].y) / sommeY < phases[i].vertMini);
        if (!sousMini.length) {
            libres.forEach(i => { verts[i] = (reste * phases[i].y) / sommeY; });
            break;
        }
        libres = libres.filter(i => !sousMini.includes(i));
    }
    // Arrondi à la seconde en gardant la somme (méthode du plus fort reste).
    const entiers = verts.map(Math.floor);
    let manque = Math.round(verts.reduce((a, b) => a + b, 0)) - entiers.reduce((a, b) => a + b, 0);
    verts.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r)
        .forEach(({ i }) => { if (manque > 0) { entiers[i]++; manque--; } });
    return entiers;
};

/**
 * Instants du phasage bulle : le milieu du vert de chaque déterminant, tel
 * qu'il est saisi dans le diagramme.
 */
export const instantsPhasageBulle = (
    determinants: number[],
    groupes: { id: number; offset: number; durations: { green: number } }[],
    cycle: number,
): number[] => determinants.map(id => {
    const g = groupes.find(x => x.id === id);
    if (!g || cycle <= 0) return 0;
    return Math.floor((g.offset + g.durations.green / 2) % cycle);
});
