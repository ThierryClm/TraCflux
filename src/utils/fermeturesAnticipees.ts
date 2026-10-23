/**
 * Proposition de fermetures anticipées avec glissements (assistant de
 * construction).
 *
 * Un groupe voitures peu chargé (capacité utilisée sous un seuil, 81 % par
 * défaut) a du vert en trop : vert − V.utile, avec V.utile = trafic × cycle /
 * (1800 × coef. voie). On propose une fermeture anticipée en fin de vert
 * d'environ les deux tiers de ce temps disponible, sans passer sous le vert
 * mini, et on y attache en Action GF (4 au plus) les groupes antagonistes qui
 * ouvrent après lui : la fermeture pointe sur leur début de vert, d'où un
 * glissement (cf. simulation/operations/fermetureAnticipee.ts). Un groupe
 * n'est retenu que si avancer son ouverture ne crée aucun conflit intervert
 * avec ses autres antagonistes. Sans groupe à faire glisser, rien n'est
 * proposé : fermer plus tôt ne servirait à personne.
 */
import { SATURATION_FLOW } from './capacityCalc';
import { degagementMatrice } from './suggestionCycle';
import type { Matrice } from '../types/projet';

export const SEUIL_CAPACITE_FERMETURE = 81;
export const PART_TEMPS_DISPONIBLE = 2 / 3;
const ACTION_GF_MAX = 4;

export interface GroupeFermeture {
    id: number;
    type: string;
    debut: number;
    vert: number;
    vertMini: number;
    trafic: number;
    coefVoie: number;
}

export interface FermeturePropose {
    groupe: number;
    capacite: number;
    vertUtile: number;
    disponible: number;
    /** Zone de la fermeture anticipée (instants dans le cycle) ; duree 0 si rien n'est proposé. */
    deb: number;
    fin: number;
    duree: number;
    /** Groupes qui glissent (Action GF), dans l'ordre d'ouverture. */
    glissements: number[];
    /** Antagonistes qui ouvrent après le groupe sans pouvoir glisser, et le groupe qui les retient. */
    retenus: { id: number; par: number }[];
}

const mod = (v: number, c: number) => ((v % c) + c) % c;
const estVoiture = (type: string) => type === 'V' || type === 'VL';
/** L'instant t (dans le cycle) tombe-t-il dans le vert [debut, debut + vert[ ? */
const dansLeVert = (g: GroupeFermeture, t: number, cycle: number) => mod(t - g.debut, cycle) < g.vert;

export const proposerFermetures = (
    groupes: GroupeFermeture[],
    matrice: Matrice | undefined,
    cycle: number,
    seuil = SEUIL_CAPACITE_FERMETURE,
): FermeturePropose[] => {
    const verts = groupes.filter(g => g.vert > 0);
    const resultat: FermeturePropose[] = [];
    for (const x of verts) {
        if (!estVoiture(x.type) || x.trafic <= 0) continue;
        const vertUtile = (x.trafic * cycle) / (SATURATION_FLOW * (x.coefVoie || 1));
        const capacite = (vertUtile / x.vert) * 100;
        if (capacite >= seuil) continue;
        const disponible = x.vert - vertUtile;
        const duree = Math.max(0, Math.min(Math.floor(disponible * PART_TEMPS_DISPONIBLE + 1e-9), x.vert - x.vertMini));
        const finX = x.debut + x.vert;

        const glissements: number[] = [];
        const retenus: { id: number; par: number }[] = [];
        if (duree > 0) {
            // Antagonistes qui ouvrent pendant le rouge de x, du plus proche au plus loin.
            const suivants = verts
                .filter(t => t.id !== x.id && degagementMatrice(matrice, x.id, t.id) !== null
                    && mod(t.debut - finX, cycle) < cycle - x.vert)
                .sort((a, b) => mod(a.debut - finX, cycle) - mod(b.debut - finX, cycle));
            for (const t of suivants) {
                const nouveauDebut = t.debut - duree;
                // Le glissement est rejoué si la fermeture pointe vers le début du vert de t.
                const milieu = finX - duree / 2;
                const dist = (a: number, b: number) => Math.min(mod(a - b, cycle), mod(b - a, cycle));
                if (dist(milieu, t.debut + t.vert) < dist(milieu, t.debut)) continue;
                const bloquant = verts.find(a => {
                    if (a.id === x.id || a.id === t.id) return false;
                    const intervert = degagementMatrice(matrice, a.id, t.id);
                    if (intervert === null) return false;
                    if (dansLeVert(a, nouveauDebut, cycle)) return true;
                    return mod(nouveauDebut - (a.debut + a.vert), cycle) < intervert;
                });
                if (bloquant) retenus.push({ id: t.id, par: bloquant.id });
                else if (glissements.length < ACTION_GF_MAX) glissements.push(t.id);
            }
        }
        const avecGlissement = glissements.length > 0;
        resultat.push({
            groupe: x.id,
            capacite,
            vertUtile,
            disponible,
            deb: mod(finX - (avecGlissement ? duree : 0), cycle),
            fin: mod(finX, cycle) || (finX > 0 ? cycle : 0),
            duree: avecGlissement ? duree : 0,
            glissements,
            retenus,
        });
    }
    return resultat;
};
