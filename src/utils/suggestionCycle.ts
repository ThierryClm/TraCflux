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
    /** Valeur exacte de Webster, avant arrondi. */
    websterExact: number | null;
    cycleWebster: number | null;
    /** Cycle proposé : Webster arrondi à la dizaine supérieure. */
    cycleSuggere: number | null;
    cycleTauxVise: number | null;
    sature: boolean;
    /** Verts proposés pour le cycle proposé, arrondis à la seconde. */
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
/** Le cycle proposé s'arrondit à la dizaine supérieure (65,6 s → 70 s). */
export const dizaineSuperieure = (v: number) => Math.ceil(v / 10 - 1e-9) * 10;
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
    const cycleSuggere = websterExact === null ? null : dizaineSuperieure(websterExact);
    const cycleTauxVise = Y < taux && taux > 0 ? parExces(L / (1 - Y / taux)) : null;

    return {
        phases, Y, L, cycleMinimal, websterExact, cycleWebster, cycleSuggere, cycleTauxVise,
        sature: Y >= Y_SATURE,
        verts: cycleSuggere ? repartirVerts(phases, cycleSuggere - L) : phases.map(p => p.vertMini),
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

/**
 * Position des phases dans le cycle : la phase 1 ouvre à 0 s, chaque suivante
 * après le vert de la précédente et son dégagement. Renvoie le début de vert
 * de chaque phase.
 */
export const debutsDesPhases = (verts: number[], degagements: number[]): number[] => {
    const debuts: number[] = [];
    let t = 0;
    verts.forEach((v, i) => {
        debuts.push(t);
        t += v + (degagements[i] || 0);
    });
    return debuts;
};

/** Groupe tel qu'il est lu dans le diagramme, pour la détection du chemin critique. */
export interface GroupeDiagramme {
    id: number;
    offset: number;
    vert: number;
    /** Durée suivant le vert (jaune, ou dégagement des piétons). */
    jaune: number;
    vertMini: number;
    trafic: number;
    coefVoie: number;
}

export interface CheminCritique {
    determinants: number[];
    degagements: (number | null)[];
    /** Membres de chaque phase (déterminant compris). */
    phases: number[][];
    /** Capacité utilisée (%) des groupes qui ont du trafic et un vert. */
    capaciteUtilisee: Record<number, number>;
}

const mod = (v: number, c: number) => ((v % c) + c) % c;
/** Écart signé b − a sur le cercle du cycle, ramené dans ]−c/2, c/2]. */
const ecart = (a: number, b: number, c: number) => {
    const d = mod(b - a, c);
    return d > c / 2 ? d - c : d;
};

/**
 * Chemin critique proposé à partir d'un diagramme renseigné.
 *
 * 1. Phases : les groupes à trafic verts en même temps (recouvrement d'au
 *    moins la moitié du plus court des deux verts), dans l'ordre d'ouverture.
 *    Un groupe sans trafic (piétons) rejoint la phase qu'il recouvre le plus ;
 *    s'il n'en recouvre aucune, il forme une phase de piétons.
 * 2. Déterminant : dans chaque phase, la plus forte capacité utilisée ; dans
 *    une phase de piétons, la traversée la plus défavorable (vert mini +
 *    dégagement). C'est une règle générale, pas une vérité : l'utilisateur
 *    garde la main.
 * 3. Dégagement d'une phase à la suivante : le plus contraignant de la matrice
 *    entre leurs groupes, corrigé de l'écart entre la fin de vert du groupe et
 *    la fin de sa phase, et entre le début de la phase suivante et celui du
 *    groupe. null s'il n'y a aucun conflit entre les deux phases.
 */
export const detecterCheminCritique = (
    groupes: GroupeDiagramme[], matrice: Matrice | undefined, cycle: number, saturation = SATURATION_FLOW,
): CheminCritique | null => {
    if (cycle <= 0) return null;
    const verts = groupes.filter(g => g.vert > 0);
    const masque = (g: GroupeDiagramme) => {
        const m = new Array<boolean>(cycle).fill(false);
        for (let t = 0; t < Math.min(g.vert, cycle); t++) m[mod(g.offset + t, cycle)] = true;
        return m;
    };
    const masques = new Map(verts.map(g => [g.id, masque(g)]));
    const recouvrement = (a: number, ids: number[]) => {
        const ma = masques.get(a)!;
        let n = 0;
        for (let t = 0; t < cycle; t++) if (ma[t] && ids.some(id => masques.get(id)![t])) n++;
        return n;
    };
    const parId = new Map(verts.map(g => [g.id, g]));
    const regrouper = (liste: GroupeDiagramme[], phases: number[][]) => {
        [...liste].sort((a, b) => mod(a.offset, cycle) - mod(b.offset, cycle)).forEach(g => {
            const p = phases.find(ph => {
                const graine = parId.get(ph[0])!;
                return recouvrement(g.id, [ph[0]]) >= Math.min(g.vert, graine.vert) / 2;
            });
            if (p) p.push(g.id); else phases.push([g.id]);
        });
    };
    const aTrafic = verts.filter(g => g.trafic > 0);
    const phases: number[][] = [];
    regrouper(aTrafic, phases);
    const pietons: GroupeDiagramme[] = [];
    verts.filter(g => !(g.trafic > 0)).forEach(g => {
        let meilleure = -1, max = 0;
        phases.forEach((ph, i) => {
            const r = recouvrement(g.id, ph.filter(id => (parId.get(id)!.trafic > 0)));
            if (r > max) { max = r; meilleure = i; }
        });
        if (meilleure >= 0 && max >= g.vert / 2) phases[meilleure].push(g.id); else pietons.push(g);
    });
    const phasesPietons: number[][] = [];
    regrouper(pietons, phasesPietons);
    phases.push(...phasesPietons);
    if (phases.length < NB_PHASES_MIN) return null;

    // Bornes d'une phase : ses groupes à trafic, ou tous pour une phase de piétons.
    const coeur = (ph: number[]) => {
        const t = ph.filter(id => parId.get(id)!.trafic > 0);
        return (t.length ? t : ph).map(id => parId.get(id)!);
    };
    const debutPhase = (ph: number[]) => {
        const gs = coeur(ph);
        const ref = gs[0].offset;
        return gs.reduce((m, g) => (ecart(ref, g.offset, cycle) < ecart(ref, m, cycle) ? g.offset : m), ref);
    };
    phases.sort((a, b) => mod(debutPhase(a), cycle) - mod(debutPhase(b), cycle));
    const finPhase = (ph: number[]) => {
        const gs = coeur(ph);
        const ref = gs[0].offset + gs[0].vert;
        return gs.reduce((m, g) => (ecart(ref, g.offset + g.vert, cycle) > ecart(ref, m, cycle) ? g.offset + g.vert : m), ref);
    };

    const capaciteUtilisee: Record<number, number> = {};
    verts.forEach(g => {
        if (g.trafic > 0) capaciteUtilisee[g.id] = (g.trafic * cycle) / (saturation * (g.coefVoie || 1) * g.vert) * 100;
    });
    const determinants = phases.map(ph => {
        const t = ph.filter(id => capaciteUtilisee[id] !== undefined);
        if (t.length) return t.reduce((a, b) => (capaciteUtilisee[b] > capaciteUtilisee[a] ? b : a));
        return ph.reduce((a, b) => {
            const ga = parId.get(a)!, gb = parId.get(b)!;
            return gb.vertMini + gb.jaune > ga.vertMini + ga.jaune ? b : a;
        });
    });
    const degagements = phases.map((ph, i) => {
        const suivante = phases[(i + 1) % phases.length];
        const fin = finPhase(ph), debut = debutPhase(suivante);
        let max: number | null = null;
        ph.forEach(a => suivante.forEach(b => {
            const v = degagementMatrice(matrice, a, b);
            if (v === null) return;
            const ga = parId.get(a)!, gb = parId.get(b)!;
            const utile = v - ecart(ga.offset + ga.vert, fin, cycle) - ecart(debut, gb.offset, cycle);
            if (max === null || utile > max) max = utile;
        }));
        return max === null ? null : Math.max(0, Math.round(max));
    });
    return { determinants, degagements, phases, capaciteUtilisee };
};
