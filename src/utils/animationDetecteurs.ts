import type { ActionMicro, Detecteur, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import type { SimulationResult } from '../simulation';
import { etatDeCouleur, getGroupColorAtTime } from './groupColorAtTime';
import { calculateQueueLength, calculateVUtile } from './capacityCalc';

/** Un intervalle de temps du cycle, en secondes. Les bornes peuvent sortir de [0, cycle]. */
export interface Intervalle {
    debut: number;
    fin: number;
}

/** Tout ce qu'il faut pour calculer l'occupation d'une boucle à un instant. */
export interface ContexteAnimation {
    cycleLength: number;
    groups: Groupe[];
    arrows: FlecheCarrefour[];
    getTrafficData: (groupId: number) => { trafficVol?: number | string } | undefined;
    simulationResult?: SimulationResult | null;
    actionData?: ActionMicro[];
    selectedActions?: number[];
    conflictMatrix?: Matrice;
    pixelsParMetre: number;
}

/** Dimensions de la boîte d'affichage de l'image, pour convertir les % en pixels. */
const LARGEUR_IMAGE = 750;
const HAUTEUR_IMAGE = 530;

export const LONGUEUR_VEHICULE_M = 5;
/** Longueur d'un véhicule en file, espacement compris (cf. capacityCalc). */
export const LONGUEUR_FILE_PAR_VEHICULE_M = 6;
export const VITESSE_DEFAUT = 10;

/**
 * Vitesse de traversée selon le mouvement. Un tourne à gauche aborde la boucle
 * plus lentement qu'un tout droit, ce qui allonge son temps d'occupation.
 */
export const VITESSE_PAR_COURANT: Record<string, number> = {
    TD: 10,
    TàD: 8,
    TàG: 6,
    TD_TàD: 7,
    TD_TàG: 7,
    TDTàD: 7,
    TDTàG: 7,
    'TD-TàD': 7,
    'TD-TàG': 7,
    TD_G_D: 7
};

export const vitesseCourant = (courant?: string): number =>
    VITESSE_PAR_COURANT[(courant || '').trim()] ?? VITESSE_DEFAUT;

/** Intervalle entre deux véhicules au débit de saturation : 2 s pour un coefficient de 1. */
export const intervallePassage = (laneCoef?: number): number =>
    2 / (laneCoef && laneCoef > 0 ? laneCoef : 1);

/** Temps pendant lequel un véhicule occupe une boucle de longueur donnée. */
export const dureeOccupation = (dimension: number | null, vitesse: number): number =>
    ((dimension ?? 3) + LONGUEUR_VEHICULE_M) / Math.max(0.1, vitesse);

/** Nombre de véhicules du groupe par cycle, à partir du trafic du jeu de données. */
export const vehiculesParCycle = (trafficVol: number, cycleLength: number): number =>
    Math.max(0, trafficVol) * Math.max(0, cycleLength) / 3600;

/** Nombre de véhicules représentés par une longueur de file. */
export const vehiculesEnFile = (longueurFileM: number): number =>
    Math.max(0, Math.ceil(longueurFileM / LONGUEUR_FILE_PAR_VEHICULE_M));

const nombre = (valeur: unknown): number => {
    const n = Number(valeur);
    return Number.isFinite(n) ? n : 0;
};

/** Le balayage du cycle donne 30,000000000000156 : on arrondit au dixième. */
const arrondiDixieme = (valeur: number): number => Math.round(valeur * 10) / 10;

const traficDuGroupe = (ctx: ContexteAnimation, groupId: number): number =>
    nombre(ctx.getTrafficData(groupId)?.trafficVol);

const coefficientVoie = (groupe: Groupe): number =>
    groupe.laneCoef && groupe.laneCoef > 0 ? groupe.laneCoef : 1;

/**
 * Temps de vert nécessaire pour servir la demande du cycle (V.Utile) : c'est
 * la durée pendant laquelle les boucles restent occupées par le flux, et non
 * la longueur de file seule. Plafonnée au vert disponible.
 */
const dureeService = (
    traffic: number,
    coefficient: number,
    cycle: number,
    dureeVert: number
): number => {
    const vUtile = calculateVUtile(traffic, coefficient, cycle) ?? 0;
    return Math.max(0, Math.min(dureeVert, vUtile));
};

const nombreImpulsions = (service: number, intervalle: number): number =>
    service > 0 ? Math.max(0, Math.floor(service / intervalle) + 1) : 0;

/** Le courant est-il saturé (demande au moins égale à la capacité du vert) ? */
const estSature = (
    traffic: number,
    coefficient: number,
    cycle: number,
    dureeVert: number
): boolean => {
    const vUtile = calculateVUtile(traffic, coefficient, cycle) ?? 0;
    return dureeVert > 0 && vUtile >= dureeVert - 0.01;
};

/** Part du vert nécessaire pour servir la demande (Cap.U en ratio). */
const capaciteUtilisee = (
    traffic: number,
    coefficient: number,
    cycle: number,
    dureeVert: number
): number => {
    const vUtile = calculateVUtile(traffic, coefficient, cycle) ?? 0;
    return dureeVert > 0 ? vUtile / dureeVert : 0;
};

/** En dessous de ce seuil, la demande est considérée servie avant la fin du vert. */
const SEUIL_SANS_FILE = 0.90;

/** Absence visible de véhicule après la fin du vert quand la demande est servie. */
const ABSENCE_APRES_VERT_S = 8;

/**
 * Plages de rouge après chaque vert. Si la capacité utilisée ne dépasse pas
 * 90 %, on laisse 8 s sans véhicule après la fin du vert : la boucle reste
 * éteinte, ce qui montre que la demande a été servie.
 */
const rougesApresVert = (
    verts: Intervalle[],
    cycle: number,
    capacite: number
): Intervalle[] => {
    if (!verts.length) return [];
    const rouges: Intervalle[] = [];
    for (let i = 0; i < verts.length; i++) {
        const vert = verts[i];
        const debutSuivant = verts[i + 1]?.debut ?? verts[0].debut + cycle;
        const debut = capacite <= SEUIL_SANS_FILE
            ? vert.fin + ABSENCE_APRES_VERT_S
            : vert.fin;
        if (debut < debutSuivant) rouges.push({ debut, fin: debutSuivant });
    }
    return rouges;
};

const contexteCouleur = (ctx: ContexteAnimation) => ({
    groups: ctx.groups,
    simulationResult: ctx.simulationResult,
    cycleLength: ctx.cycleLength,
    actionData: ctx.actionData,
    selectedActions: ctx.selectedActions,
    conflictMatrix: ctx.conflictMatrix
});

const estVert = (groupId: number, time: number, ctx: ContexteAnimation): boolean => {
    const t = ((time % ctx.cycleLength) + ctx.cycleLength) % ctx.cycleLength;
    return etatDeCouleur(getGroupColorAtTime(groupId, t, contexteCouleur(ctx))) === 'vert';
};

/**
 * Plages de vert d'un groupe sur un cycle, lues avec la même règle que la
 * couleur des flèches (simulation, secondes lucarnes, escamotages compris).
 * Un vert qui passe le début du cycle est rendu avec un début négatif, pour
 * que ses impulsions restent continues de part et d'autre de zéro.
 */
export const intervallesVert = (groupId: number, ctx: ContexteAnimation): Intervalle[] => {
    const cycle = ctx.cycleLength;
    if (!cycle || cycle <= 0) return [];
    const pas = 0.1;
    const intervals: Intervalle[] = [];
    let debut: number | null = estVert(groupId, 0, ctx) ? 0 : null;
    let precedent = debut !== null;

    for (let t = pas; t <= cycle + 1e-9; t += pas) {
        const vert = estVert(groupId, t % cycle, ctx);
        if (vert && !precedent) debut = t;
        if (!vert && precedent && debut !== null) {
            intervals.push({ debut, fin: t });
            debut = null;
        }
        precedent = vert;
    }
    if (debut !== null) intervals.push({ debut, fin: cycle });

    // Vert à cheval sur le début du cycle : un seul intervalle continu.
    if (intervals.length > 1 && estVert(groupId, 0, ctx) && estVert(groupId, cycle - pas, ctx)) {
        const premier = intervals[0];
        const dernier = intervals[intervals.length - 1];
        if (premier.debut === 0 && dernier.fin === cycle) {
            intervals.shift();
            intervals.pop();
            intervals.push({ debut: dernier.debut - cycle, fin: premier.fin });
        }
    }
    return intervals;
};

/** Découpe un intervalle qui déborde du cycle en morceaux dans [0, cycle]. */
const morceauxDansCycle = (intervalle: Intervalle, cycle: number): Intervalle[] => {
    const morceaux: Intervalle[] = [];
    for (const decalage of [-cycle, 0, cycle]) {
        const debut = Math.max(0, intervalle.debut + decalage);
        const fin = Math.min(cycle, intervalle.fin + decalage);
        if (fin > debut) morceaux.push({ debut, fin });
    }
    return morceaux;
};

const fusionner = (intervals: Intervalle[], cycle: number): Intervalle[] => {
    const morceaux = intervals.flatMap(i => morceauxDansCycle(i, cycle))
        .sort((a, b) => a.debut - b.debut || a.fin - b.fin);
    const fusionnes: Intervalle[] = [];
    for (const intervalle of morceaux) {
        const dernier = fusionnes[fusionnes.length - 1];
        if (dernier && intervalle.debut <= dernier.fin + 1e-6) {
            dernier.fin = Math.max(dernier.fin, intervalle.fin);
        } else {
            fusionnes.push({ ...intervalle });
        }
    }
    return fusionnes;
};

/** Plages de rouge (complément des verts) sur un cycle. */
export const intervallesRouge = (verts: Intervalle[], cycle: number): Intervalle[] => {
    const normalises = fusionner(verts, cycle);
    const rouges: Intervalle[] = [];
    let curseur = 0;
    for (const vert of normalises) {
        if (vert.debut > curseur) rouges.push({ debut: curseur, fin: vert.debut });
        curseur = Math.max(curseur, vert.fin);
    }
    if (curseur < cycle) rouges.push({ debut: curseur, fin: cycle });
    return rouges;
};

/** L'instant tombe-t-il dans l'un des intervalles, en tenant compte du cycle ? */
export const estOccupee = (time: number, intervals: Intervalle[], cycle: number): boolean => {
    if (!intervals.length || !cycle) return false;
    const t = ((time % cycle) + cycle) % cycle;
    return intervals.some(({ debut, fin }) => {
        for (const decalage of [0, cycle, -cycle]) {
            const x = t + decalage;
            if (x >= debut && x < fin) return true;
        }
        return false;
    });
};

const ajouterImpulsions = (
    resultat: Intervalle[],
    depart: number,
    nombreVehicules: number,
    intervalle: number,
    occupation: number
): void => {
    const n = Math.max(0, Math.ceil(nombreVehicules));
    for (let k = 0; k < n; k++) {
        const debut = depart + k * intervalle;
        resultat.push({ debut, fin: debut + occupation });
    }
};

/** Position de la flèche du groupe, prise comme repère du pied de feu. */
const positionPiedFeu = (groupId: number, ctx: ContexteAnimation) =>
    ctx.arrows.find(a => a.groupId === groupId) || null;

const distanceMetres = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    pixelsParMetre: number
): number => {
    const dx = ((a.x - b.x) / 100) * LARGEUR_IMAGE;
    const dy = ((a.y - b.y) / 100) * HAUTEUR_IMAGE;
    return Math.hypot(dx, dy) / Math.max(1, pixelsParMetre);
};

/**
 * Boucle de pied de feu : le premier véhicule de la file l'occupe pendant tout
 * le rouge ; au vert, elle s'allume à chaque passage, puis reste allumée si la
 * file n'est pas vidée à la fin du vert.
 */
const intervallesPiedFeu = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    const groupe = ctx.groups.find(g => g.id === detecteur.gf);
    if (!groupe) return [];
    const traffic = traficDuGroupe(ctx, groupe.id);
    if (traffic <= 0) return [];

    const cycle = ctx.cycleLength;
    const verts = intervallesVert(groupe.id, ctx);
    const coefficient = coefficientVoie(groupe);
    const intervalle = intervallePassage(coefficient);
    const occupation = dureeOccupation(detecteur.dimension, vitesseCourant(groupe.courant));
    const resultat: Intervalle[] = [];

    for (const vert of verts) {
        const dureeVert = arrondiDixieme(Math.max(0, vert.fin - vert.debut));
        const service = dureeService(traffic, coefficient, cycle, dureeVert);
        ajouterImpulsions(resultat, vert.debut, nombreImpulsions(service, intervalle), intervalle, occupation);
    }

    // Pendant le rouge, un véhicule attend au pied du feu : la boucle reste
    // allumée, sauf les 8 premières secondes si la demande a été servie.
    const dureeVertTotale = arrondiDixieme(verts.reduce((somme, v) => somme + Math.max(0, v.fin - v.debut), 0));
    const capacite = capaciteUtilisee(traffic, coefficient, cycle, dureeVertTotale);
    resultat.push(...rougesApresVert(verts, cycle, capacite));
    return resultat;
};

/**
 * Boucle éloignée : si la file calculée la recouvre, elle reste allumée pendant
 * le rouge et jusqu'à ce que le dernier véhicule de la file l'ait dépassée.
 * Sinon, elle s'allume au passage des véhicules, après le temps de parcours.
 */
const intervallesEloignee = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    const groupe = ctx.groups.find(g => g.id === detecteur.gf);
    if (!groupe || !detecteur.position) return [];
    const traffic = traficDuGroupe(ctx, groupe.id);
    if (traffic <= 0) return [];

    const cycle = ctx.cycleLength;
    const verts = intervallesVert(groupe.id, ctx);
    const coefficient = coefficientVoie(groupe);
    const intervalle = intervallePassage(coefficient);
    const vitesse = vitesseCourant(groupe.courant);
    const occupation = dureeOccupation(detecteur.dimension, vitesse);
    const repere = positionPiedFeu(groupe.id, ctx);
    const distance = repere ? distanceMetres(detecteur.position, repere, ctx.pixelsParMetre) : 0;
    const dureeVertNominale = arrondiDixieme(Math.max(
        groupe.durations?.green || 0,
        ...verts.map(v => v.fin - v.debut)
    ));
    const fileM = calculateQueueLength(traffic, coefficient, dureeVertNominale, cycle) ?? 0;
    const couverte = distance > 0 && fileM >= distance;
    const service = dureeService(traffic, coefficient, cycle, dureeVertNominale);
    const sature = estSature(traffic, coefficient, cycle, dureeVertNominale);
    const resultat: Intervalle[] = [];

    for (const vert of verts) {
        if (couverte) {
            // La file recouvre la boucle : elle est occupée pendant le rouge,
            // puis pendant le temps nécessaire pour servir la demande.
            resultat.push({ debut: vert.debut, fin: Math.min(vert.fin, vert.debut + service) });
        } else {
            ajouterImpulsions(
                resultat,
                vert.debut + distance / Math.max(0.1, vitesse),
                nombreImpulsions(service, intervalle),
                intervalle,
                occupation
            );
        }
    }

    // Courant saturé : la file ne se vide pas, la boucle reste occupée pendant
    // le rouge, même si le calcul de file ne la recouvre pas encore. Si la
    // demande a été servie, on laisse 8 s sans véhicule après le vert.
    const capacite = capaciteUtilisee(traffic, coefficient, cycle, dureeVertNominale);
    if (couverte || sature) resultat.push(...rougesApresVert(verts, cycle, capacite));
    return resultat;
};

/**
 * Groupes comptés par une boucle de comptage : les flèches les plus proches
 * sur l'image, c'est-à-dire les mouvements qui sortent par la même branche.
 */
export const groupesComptesParProximite = (detecteur: Detecteur, ctx: ContexteAnimation): number[] => {
    if (!detecteur.position) return [];
    const distances = ctx.arrows
        .filter(a => a.groupId)
        .map(a => ({
            id: a.groupId,
            d: distanceMetres(a, detecteur.position!, ctx.pixelsParMetre)
        }))
        .sort((a, b) => a.d - b.d);

    if (!distances.length) return detecteur.gf ? [detecteur.gf] : [];
    const plusProche = distances[0].d;
    const seuil = Math.max(plusProche * 1.6, 8);
    return [...new Set(distances.filter(c => c.d <= seuil).map(c => c.id))];
};

/**
 * Boucle de comptage : elle compte les véhicules de tous les groupes dont la
 * flèche aboutit sur la même branche, tournants des transversales compris.
 * Chaque groupe apporte son débit, son coefficient de voie et sa vitesse.
 */
const intervallesComptage = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    if (!detecteur.position) return [];
    const groupes = groupesComptesParProximite(detecteur, ctx);
    if (!groupes.length) return [];

    const cycle = ctx.cycleLength;
    const resultat: Intervalle[] = [];

    for (const groupId of groupes) {
        const groupe = ctx.groups.find(g => g.id === groupId);
        if (!groupe) continue;
        const traffic = traficDuGroupe(ctx, groupId);
        if (traffic <= 0) continue;

        const coefficient = coefficientVoie(groupe);
        const vitesse = vitesseCourant(groupe.courant);
        const occupation = dureeOccupation(detecteur.dimension, vitesse);
        const repere = positionPiedFeu(groupId, ctx);
        const distance = repere ? distanceMetres(detecteur.position, repere, ctx.pixelsParMetre) : 0;
        const verts = intervallesVert(groupId, ctx);
        const intervalle = intervallePassage(coefficient);
        const dureeVertNominale = Math.max(
            groupe.durations?.green || 0,
            ...verts.map(v => v.fin - v.debut)
        );
        const sature = estSature(traffic, coefficient, cycle, dureeVertNominale);

        for (const vert of verts) {
            const dureeVert = Math.max(0, vert.fin - vert.debut);
            const service = dureeService(traffic, coefficient, cycle, dureeVert);
            ajouterImpulsions(
                resultat,
                vert.debut + distance / Math.max(0.1, vitesse),
                nombreImpulsions(service, intervalle),
                intervalle,
                occupation
            );
        }

        // Courant saturé : les véhicules continuent de se présenter, la boucle
        // de comptage reste occupée pendant le rouge.
        if (sature) resultat.push(...intervallesRouge(verts, cycle));
    }
    return resultat;
};

/** Intervalles d'occupation d'un détecteur, selon sa catégorie. */
export const intervallesDetecteur = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    if (!detecteur.position) return [];
    switch (detecteur.categorie) {
        case 'bouclePiedFeu':
            return intervallesPiedFeu(detecteur, ctx);
        case 'boucleEloignee':
            return intervallesEloignee(detecteur, ctx);
        case 'boucleComptage':
            return intervallesComptage(detecteur, ctx);
        default:
            return [];
    }
};

/** La boucle est-elle occupée à cet instant ? Radar et bouton restent statiques. */
export const estDetecteurOccupe = (
    detecteur: Detecteur,
    time: number,
    ctx: ContexteAnimation
): boolean => estOccupee(time, intervallesDetecteur(detecteur, ctx), ctx.cycleLength);
