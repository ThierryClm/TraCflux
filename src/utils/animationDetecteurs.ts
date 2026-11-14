import type { ActionMicro, Detecteur, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import type { SimulationResult } from '../simulation';
import { etatDeCouleur, getGroupColorAtTime } from './groupColorAtTime';

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

/** En dessous de ce seuil, la demande est considérée servie avant la fin du vert. */
const SEUIL_SANS_FILE = 0.90;

/**
 * Absence visible de véhicule après la fin du vert quand la demande est
 * servie : elle montre que la file a été écoulée.
 */
export const ABSENCE_APRES_VERT_S = 6;

/** Le premier véhicule libère la boucle à la 2e seconde de vert. */
export const PREMIER_PASSAGE_VERT_S = 2;

/** Nombre de véhicules en file nécessaires pour couvrir une boucle éloignée. */
export const vehiculesAvantRecouvrement = (retrait: number): number =>
    Math.max(1, Math.ceil(Math.max(0, retrait) / LONGUEUR_FILE_PAR_VEHICULE_M) + 1);

/** Débit et temps de service d'un groupe sur un de ses verts. */
interface DemandeBoucle {
    /** Véhicules par cycle (peut être décimal). */
    nombreVehicules: number;
    /** Intervalle entre deux véhicules au débit de saturation, en secondes. */
    intervalle: number;
    /** Part du vert consommée par la demande (Cap. U). */
    capacite: number;
    /** Véhicules de la file qui passent effectivement avant la fin du vert. */
    servis: number;
    /** La file ne se vide pas avant la fin du vert. */
    sature: boolean;
}

/** Véhicules passés au vert, en tenant compte du départ à la 3e seconde. */
const vehiculesServisAuVert = (
    nombreVehicules: number,
    intervalle: number,
    dureeVert: number
): number => {
    if (dureeVert < PREMIER_PASSAGE_VERT_S) return 0;
    const possibles = Math.floor(
        (dureeVert - PREMIER_PASSAGE_VERT_S) / intervalle + 1e-9
    ) + 1;
    return Math.max(0, Math.min(Math.ceil(nombreVehicules), possibles));
};

const demandeBoucle = (
    traffic: number,
    coefficient: number,
    cycle: number,
    dureeVert: number
): DemandeBoucle => {
    const nombreVehicules = vehiculesParCycle(traffic, cycle);
    const intervalle = intervallePassage(coefficient);
    const capacite = dureeVert > 0 ? (nombreVehicules * intervalle) / dureeVert : 0;
    const servis = vehiculesServisAuVert(nombreVehicules, intervalle, dureeVert);
    return {
        nombreVehicules,
        intervalle,
        capacite,
        servis,
        sature: dureeVert > 0 && (capacite >= 1 - 0.01 || servis < Math.ceil(nombreVehicules))
    };
};

/** Ajoute une impulsion par véhicule, à partir de l'heure du véhicule `premier`. */
const ajouterVehicules = (
    resultat: Intervalle[],
    premiereHeure: number,
    nombre: number,
    intervalle: number,
    occupation: number,
    premier = 0
): void => {
    for (let k = premier; k < nombre; k++) {
        const debut = premiereHeure + (k - premier) * intervalle;
        resultat.push({ debut, fin: debut + occupation });
    }
};

/** Début du vert suivant, pour borner la période de rouge. */
const debutVertSuivant = (verts: Intervalle[], index: number, cycle: number): number =>
    verts[index + 1]?.debut ?? verts[0].debut + cycle;

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
 * Boucle de pied de feu : au vert, elle s'allume une fois par véhicule de la
 * file, à l'intervalle de passage. La file s'écoule en `nombreVehicules ×
 * intervalle` secondes ; le reste du vert est éteint. Après 6 s sans véhicule
 * (demande servie), le premier véhicule qui arrive se pose sur la boucle et la
 * laisse allumée jusqu'au vert suivant.
 */
const intervallesPiedFeu = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    const groupe = ctx.groups.find(g => g.id === detecteur.gf);
    if (!groupe) return [];
    const traffic = traficDuGroupe(ctx, groupe.id);
    if (traffic <= 0) return [];

    const cycle = ctx.cycleLength;
    const verts = intervallesVert(groupe.id, ctx);
    const coefficient = coefficientVoie(groupe);
    const occupation = dureeOccupation(detecteur.dimension, vitesseCourant(groupe.courant));
    const resultat: Intervalle[] = [];

    for (let i = 0; i < verts.length; i++) {
        const vert = verts[i];
        const dureeVert = arrondiDixieme(Math.max(0, vert.fin - vert.debut));
        const demande = demandeBoucle(traffic, coefficient, cycle, dureeVert);
        const suivant = debutVertSuivant(verts, i, cycle);

        if (demande.servis === 0) {
            // Le vert est trop court pour libérer la boucle : elle reste tenue.
            resultat.push({ debut: vert.debut, fin: suivant });
            continue;
        }

        // Le premier véhicule est sur la boucle et la libère à la 3e seconde.
        resultat.push({
            debut: vert.debut,
            fin: vert.debut + PREMIER_PASSAGE_VERT_S
        });
        // Les véhicules suivants passent ensuite à l'intervalle de débit.
        ajouterVehicules(
            resultat,
            vert.debut + PREMIER_PASSAGE_VERT_S + demande.intervalle,
            demande.servis - 1,
            demande.intervalle,
            occupation
        );

        if (demande.sature) {
            // La file ne se vide pas : un véhicule reste au pied du feu.
            resultat.push({ debut: vert.fin, fin: suivant });
            continue;
        }
        const absence = demande.capacite <= SEUIL_SANS_FILE ? ABSENCE_APRES_VERT_S : 0;
        const premiereArrivee = vert.fin + absence;
        if (demande.nombreVehicules > 0 && premiereArrivee < suivant) {
            // Le premier véhicule arrivé se pose sur la boucle et y reste.
            resultat.push({ debut: premiereArrivee, fin: suivant });
        }
    }
    return resultat;
};

/**
 * Retrait effectif d'une boucle : 0 au pied de feu, la valeur saisie si elle
 * existe, sinon la distance mesurée entre le symbole et la flèche du groupe.
 */
export const retraitEffectif = (
    detecteur: Detecteur,
    groupId: number,
    ctx: ContexteAnimation
): number => {
    if (detecteur.categorie === 'bouclePiedFeu') return 0;
    const saisi = detecteur.retrait;
    if (typeof saisi === 'number' && Number.isFinite(saisi) && saisi >= 0) return saisi;
    if (!detecteur.position) return 0;
    const repere = positionPiedFeu(groupId, ctx);
    return repere ? distanceMetres(detecteur.position, repere, ctx.pixelsParMetre) : 0;
};

/**
 * Boucle éloignée : les premiers véhicules de la file franchissent la boucle
 * sans s'y arrêter et n'y font qu'une impulsion. À partir du véhicule qui
 * recouvre le retrait (un véhicule tous les 6 m), l'occupation devient fixe
 * jusqu'à ce que la file se vide au vert suivant.
 */
const intervallesEloignee = (detecteur: Detecteur, ctx: ContexteAnimation): Intervalle[] => {
    const groupe = ctx.groups.find(g => g.id === detecteur.gf);
    if (!groupe || !detecteur.position) return [];
    const traffic = traficDuGroupe(ctx, groupe.id);
    if (traffic <= 0) return [];

    const cycle = ctx.cycleLength;
    const verts = intervallesVert(groupe.id, ctx);
    const coefficient = coefficientVoie(groupe);
    const vitesse = vitesseCourant(groupe.courant);
    const occupation = dureeOccupation(detecteur.dimension, vitesse);
    const retrait = retraitEffectif(detecteur, groupe.id, ctx);
    const recouvrement = vehiculesAvantRecouvrement(retrait);
    const resultat: Intervalle[] = [];

    for (let i = 0; i < verts.length; i++) {
        const vert = verts[i];
        const dureeVert = arrondiDixieme(Math.max(0, vert.fin - vert.debut));
        const demande = demandeBoucle(traffic, coefficient, cycle, dureeVert);
        const suivant = debutVertSuivant(verts, i, cycle);
        const trajet = retrait / Math.max(0.1, vitesse);
        const couverte = demande.nombreVehicules >= recouvrement;
        const figeAuVert = couverte
            ? Math.max(0, demande.servis - recouvrement + 1)
            : 0;

        // La file recouvre la boucle au début du vert : elle reste tenue
        // pendant les départs, puis les derniers véhicules passent un par un.
        if (couverte) {
            if (demande.servis === 0) {
                resultat.push({ debut: vert.debut, fin: suivant });
                continue;
            }
            if (figeAuVert > 0) {
                resultat.push({
                    debut: vert.debut,
                    fin: vert.debut + PREMIER_PASSAGE_VERT_S
                        + (figeAuVert - 1) * demande.intervalle
                });
                ajouterVehicules(
                    resultat,
                    vert.debut + PREMIER_PASSAGE_VERT_S + figeAuVert * demande.intervalle,
                    demande.servis - figeAuVert,
                    demande.intervalle,
                    occupation
                );
            } else {
                resultat.push({ debut: vert.debut, fin: vert.fin });
            }
        } else if (demande.servis > 0) {
            // La file ne recouvre pas la boucle : chaque véhicule la franchit
            // après le trajet depuis la ligne d'arrêt.
            ajouterVehicules(
                resultat,
                vert.debut + PREMIER_PASSAGE_VERT_S + trajet,
                demande.servis,
                demande.intervalle,
                occupation
            );
        }

        if (demande.sature) {
            resultat.push({ debut: vert.fin, fin: suivant });
            continue;
        }
        const absence = demande.capacite <= SEUIL_SANS_FILE ? ABSENCE_APRES_VERT_S : 0;
        const premiereArrivee = vert.fin + absence;
        const reste = suivant - premiereArrivee;
        if (demande.nombreVehicules <= 0 || reste <= 0) continue;

        // Les véhicules se présentent régulièrement jusqu'au vert suivant :
        // les premiers traversent la boucle, celui qui la recouvre la fige.
        const pas = reste / demande.nombreVehicules;
        for (let k = 0; k < Math.ceil(demande.nombreVehicules); k++) {
            const arrivee = premiereArrivee + k * pas;
            if (arrivee >= suivant) break;
            if (k + 1 >= recouvrement) {
                resultat.push({
                    debut: arrivee,
                    fin: suivant + figeAuVert * demande.intervalle
                });
                break;
            }
            resultat.push({
                debut: arrivee + retrait / Math.max(0.1, vitesse),
                fin: arrivee + retrait / Math.max(0.1, vitesse) + occupation
            });
        }
    }
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
 * Chaque groupe apporte son débit, son coefficient de voie et sa vitesse, et
 * suit le même modèle de file que la boucle éloignée à son retrait.
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
        const retrait = retraitEffectif(detecteur, groupId, ctx);
        const recouvrement = vehiculesAvantRecouvrement(retrait);
        const verts = intervallesVert(groupId, ctx);

        for (let i = 0; i < verts.length; i++) {
            const vert = verts[i];
            const dureeVert = arrondiDixieme(Math.max(0, vert.fin - vert.debut));
            const demande = demandeBoucle(traffic, coefficient, cycle, dureeVert);
            const suivant = debutVertSuivant(verts, i, cycle);
            const trajet = retrait / Math.max(0.1, vitesse);
            const couverte = demande.nombreVehicules >= recouvrement;
            const figeAuVert = couverte
                ? Math.max(0, demande.servis - recouvrement + 1)
                : 0;

            if (couverte) {
                if (demande.servis === 0) {
                    resultat.push({ debut: vert.debut, fin: suivant });
                    continue;
                }
                if (figeAuVert > 0) {
                    resultat.push({
                        debut: vert.debut,
                        fin: vert.debut + PREMIER_PASSAGE_VERT_S
                            + (figeAuVert - 1) * demande.intervalle
                    });
                    ajouterVehicules(
                        resultat,
                        vert.debut + PREMIER_PASSAGE_VERT_S + figeAuVert * demande.intervalle,
                        demande.servis - figeAuVert,
                        demande.intervalle,
                        occupation
                    );
                } else {
                    resultat.push({ debut: vert.debut, fin: vert.fin });
                }
            } else if (demande.servis > 0) {
                ajouterVehicules(
                    resultat,
                    vert.debut + PREMIER_PASSAGE_VERT_S + trajet,
                    demande.servis,
                    demande.intervalle,
                    occupation
                );
            }

            if (demande.sature) {
                resultat.push({ debut: vert.fin, fin: suivant });
                continue;
            }
            const absence = demande.capacite <= SEUIL_SANS_FILE ? ABSENCE_APRES_VERT_S : 0;
            const premiereArrivee = vert.fin + absence;
            const reste = suivant - premiereArrivee;
            if (demande.nombreVehicules <= 0 || reste <= 0) continue;

            const pas = reste / demande.nombreVehicules;
            for (let k = 0; k < Math.ceil(demande.nombreVehicules); k++) {
                const arrivee = premiereArrivee + k * pas;
                if (arrivee >= suivant) break;
                if (k + 1 >= recouvrement) {
                    resultat.push({
                        debut: arrivee,
                        fin: suivant + figeAuVert * demande.intervalle
                    });
                    break;
                }
                resultat.push({
                debut: arrivee + retrait / Math.max(0.1, vitesse),
                fin: arrivee + retrait / Math.max(0.1, vitesse) + occupation
            });
            }
        }
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
