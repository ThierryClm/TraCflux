/**
 * Analyse du diagramme : les règles et recommandations que le plan de feu
 * actif n'applique pas.
 *
 * Sources : ISR, livre 1, 6e partie (règlement) ; Certu, « Guide de conception
 * des carrefours à feux », 2010 (recommandations) ; règles de conception
 * retenues pour TraCflux. Seules les règles vérifiables sur les données du
 * projet sont contrôlées : l'analyse signale, le concepteur décide.
 */
import type { ActionMicro, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import { computeConflicts } from './conflictUtils';
import { lignesDiagnostic } from './diagnosticCarrefour';
import { signalAdmis, typeFormulaire } from './signauxIsr';

/** Obligation réglementaire, recommandation, ou simple information. */
export type NiveauConstat = 'obligation' | 'recommandation' | 'information';

export interface Constat {
    /** Identifiant stable du contrôle (sert de clé d'affichage). */
    id: string;
    niveau: NiveauConstat;
    theme: string;
    /** Groupes concernés, dans l'ordre du formulaire. */
    groupes: number[];
    message: string;
    suggestion: string;
    source: string;
}

export interface ResultatAnalyse {
    constats: Constat[];
    /** Nombre de contrôles passés, pour situer les constats. */
    controles: number;
}

interface EntreesAnalyse {
    groups: Groupe[];
    cycleLength: number;
    conflictMatrix: Matrice;
    intersectionArrows?: FlecheCarrefour[];
    getTrafficData?: (groupId: number) => { trafficVol?: number | string };
    actionData?: ActionMicro[];
}

/** Seuils retenus (règlement, guide Certu, choix de conception TraCflux). */
export const SEUILS_ANALYSE = {
    vertMiniReglementaire: 6,
    vertConfort: 8,
    vertCapacite: 10,
    attenteMaxi: 120,
    attenteMaxiTC: 240,
    cycleMini: 40,
    retardPietonMaxi: 20,
    vertLong: 40,
    traverseeSansRefuge: 12,
    retourFlecheComposee: 0.6,
    retourFlecheSimple: 0.4,
    capaciteUtiliseeAlerte: 90,
    capaciteUtiliseeSaturee: 100
} as const;

const COURANTS_COMPOSES = new Set(['TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG', 'TD_G_D']);
const COURANTS_TOURNANTS = new Set(['TàD', 'TàG']);
const ISR_DUREES = 'ISR, 6e partie, art. 110 C1';

const nomGroupe = (g: Groupe) => `GF${g.id}${g.name ? ` ${g.name}` : ''}`;
const estPieton = (g: Groupe) => typeFormulaire(g.type) === 'P';
const estVehicule = (g: Groupe) => ['V', 'B', 'CY'].includes(typeFormulaire(g.type));
/**
 * Priorité piétons (PP) et flèche lumineuse (FL) : état particulier d'un
 * groupe, sans vert mini ni jaune ; aucune suggestion sur leurs valeurs.
 */
const estEtatParticulier = (g: Groupe) => ['PP', 'FL'].includes(typeFormulaire(g.type));
const estSignalTC = (g: Groupe) => g.signal === 'R17' || g.signal?.startsWith('R18');
const caseRenseignee = (v: unknown) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));

export const analyserDiagramme = ({
    groups,
    cycleLength,
    conflictMatrix,
    intersectionArrows = [],
    getTrafficData,
    actionData = []
}: EntreesAnalyse): ResultatAnalyse => {
    const constats: Constat[] = [];
    let controles = 0;
    const ajouter = (c: Constat) => constats.push(c);
    const S = SEUILS_ANALYSE;
    const analyses = groups.filter(g => !estEtatParticulier(g));
    const avecVert = analyses.filter(g => (g.durations?.green ?? 0) > 0);

    // ---------------------------------------------------------------- durées
    controles++;
    const sousMini = avecVert.filter(g => g.durations.green < S.vertMiniReglementaire);
    if (sousMini.length) ajouter({
        id: 'vert-mini', niveau: 'obligation', theme: 'Durées', groupes: sousMini.map(g => g.id),
        message: `Vert inférieur à ${S.vertMiniReglementaire} s : ${sousMini.map(g => `${nomGroupe(g)} (${g.durations.green} s)`).join(', ')}.`,
        suggestion: `Porter chaque vert à ${S.vertMiniReglementaire} s au moins.`,
        source: ISR_DUREES
    });

    controles++;
    const sousCapacite = avecVert.filter(g => g.durations.green >= S.vertMiniReglementaire && g.durations.green < S.vertCapacite);
    if (sousCapacite.length) ajouter({
        id: 'vert-confort', niveau: 'information', theme: 'Durées', groupes: sousCapacite.map(g => g.id),
        message: `Vert compris entre ${S.vertMiniReglementaire} et ${S.vertCapacite} s : ${sousCapacite.map(g => `${nomGroupe(g)} (${g.durations.green} s)`).join(', ')}.`,
        suggestion: `${S.vertMiniReglementaire} s est le minimum réglementaire ; ${S.vertConfort} s apporte plus de confort, ${S.vertCapacite} s est plus rationnel en capacité (le minimum réglementaire est peu perçu, surtout des piétons).`,
        source: 'Certu, Guide de conception des carrefours à feux, 2010, p. 68'
    });

    controles++;
    const vertsLongs = avecVert.filter(g => estVehicule(g) && g.durations.green > S.vertLong);
    if (vertsLongs.length) ajouter({
        id: 'vert-long', niveau: 'information', theme: 'Durées', groupes: vertsLongs.map(g => g.id),
        message: `Vert de plus de ${S.vertLong} s : ${vertsLongs.map(g => `${nomGroupe(g)} (${g.durations.green} s)`).join(', ')}.`,
        suggestion: 'Vérifier que ce vert répond à la demande : au-delà, il n\'écoule plus de trafic supplémentaire et allonge l\'attente des autres usagers, piétons d\'abord. Envisager un cycle plus court ou un adaptatif qui le contracte sans demande.',
        source: 'Cerema, Durée des cycles et capacité des carrefours à feux, 2016'
    });

    controles++;
    const jauneHorsNorme = analyses.filter(g => estVehicule(g) && !estSignalTC(g)
        && g.durations && ![3, 5].includes(Number(g.durations.orange)));
    if (jauneHorsNorme.length) ajouter({
        id: 'jaune', niveau: 'obligation', theme: 'Durées', groupes: jauneHorsNorme.map(g => g.id),
        message: `Jaune fixe différent de 3 s ou 5 s : ${jauneHorsNorme.map(g => `${nomGroupe(g)} (${g.durations.orange} s)`).join(', ')}.`,
        suggestion: 'Jaune de 3 s en agglomération ; 5 s hors agglomération et pour les feux au jaune clignotant (R11j, R13cj, R13bj).',
        source: ISR_DUREES
    });

    controles++;
    const disqueHorsNorme = analyses.filter(g => estSignalTC(g) && g.durations
        && (Number(g.durations.orange) < 3 || Number(g.durations.orange) > 8));
    if (disqueHorsNorme.length) ajouter({
        id: 'disque-tc', niveau: 'obligation', theme: 'Durées', groupes: disqueHorsNorme.map(g => g.id),
        message: `Disque R17/R18 hors de 3 à 8 s : ${disqueHorsNorme.map(g => `${nomGroupe(g)} (${g.durations.orange} s)`).join(', ')}.`,
        suggestion: 'Durée du disque entre 3 et 8 s, identique sur tout le réseau.',
        source: ISR_DUREES
    });

    // ---------------------------------------------------------------- attentes
    if (cycleLength > 0) {
        controles++;
        const tropLongue = avecVert.filter(g => cycleLength - g.durations.green > (estSignalTC(g) ? S.attenteMaxiTC : S.attenteMaxi));
        if (tropLongue.length) ajouter({
            id: 'attente-120', niveau: 'obligation', theme: 'Attentes', groupes: tropLongue.map(g => g.id),
            message: `Attente supérieure à ${S.attenteMaxi} s : ${tropLongue.map(g => `${nomGroupe(g)} (${cycleLength - g.durations.green} s)`).join(', ')}.`,
            suggestion: `L'attente de tout usager, pour tous les courants, ne dépasse pas ${S.attenteMaxi} s (${S.attenteMaxiTC} s ponctuellement pour les TC aux feux R17/R18). Raccourcir le cycle ou ajouter une ouverture. Vérifier aussi les points de repos et la micro-régulation.`,
            source: 'ISR, 6e partie, art. 110 C3'
        });

        controles++;
        if (cycleLength < S.cycleMini) ajouter({
            id: 'cycle-mini', niveau: 'recommandation', theme: 'Cycle', groupes: [],
            message: `Cycle de ${cycleLength} s, inférieur à ${S.cycleMini} s.`,
            suggestion: `Un cycle ne doit pas descendre sous ${S.cycleMini} s pour la sécurité ; au-delà, le plus court possible (50 à 70 s conseillés à deux phases).`,
            source: 'Certu, 2010, p. 34 et 69'
        });

        controles++;
        const retards = analyses.filter(estPieton).filter(g => (g.durations?.green ?? 0) > 0)
            .map(g => ({ g, r: Math.round((cycleLength - g.durations.green) ** 2 / (2 * cycleLength)) }))
            .filter(x => x.r > S.retardPietonMaxi);
        if (retards.length) ajouter({
            id: 'retard-pieton', niveau: 'recommandation', theme: 'Piétons', groupes: retards.map(x => x.g.id),
            message: `Retard moyen des piétons supérieur à ${S.retardPietonMaxi} s au plan nominal : ${retards.map(x => `${nomGroupe(x.g)} (${x.r} s)`).join(', ')}.`,
            suggestion: 'Calcul hors micro-régulation : les contractions de phase (adaptatifs, escamotages) ne sont pas prises en compte et réduisent ce retard en fonctionnement réel. Sinon : allonger le vert piéton, raccourcir le cycle ou ouvrir la traversée dans une autre phase. Retard moyen r = (C − V)² / 2C.',
            source: 'Certu, 2010, p. 72'
        });
    }

    // ---------------------------------------------------------------- traversées
    controles++;
    const longues = groups.map((g, i) => ({ g, i })).filter(({ g }) => estPieton(g)).map(({ g, i }) => {
        const ligne = conflictMatrix[i] ?? [];
        const deg = Math.max(0, ...ligne.filter(caseRenseignee).map(Number));
        return { g, deg };
    }).filter(x => x.deg > S.traverseeSansRefuge);
    if (longues.length) ajouter({
        id: 'refuge-12m', niveau: 'recommandation', theme: 'Piétons', groupes: longues.map(x => x.g.id),
        message: `Dégagement piéton de plus de ${S.traverseeSansRefuge} s, soit une traversée d'environ ${S.traverseeSansRefuge} m ou plus : ${longues.map(x => `${nomGroupe(x.g)} (${x.deg} s)`).join(', ')}.`,
        suggestion: `Au-delà de ${S.traverseeSansRefuge} m, prévoir un îlot refuge (2 m préférable, 1,50 m admissible) et, si besoin, dissocier les deux demi-traversées. Dès 9 m sur une voie à double sens, l'étudier.`,
        source: 'Certu, 2010, p. 19 et 53'
    });

    // ---------------------------------------------------------------- matrice
    controles++;
    const conflits = cycleLength > 0 ? computeConflicts(groups, conflictMatrix, cycleLength, actionData) : [];
    if (conflits.length) {
        const ids = [...new Set(conflits.flatMap(c => [c.from, c.to]))];
        ajouter({
            id: 'conflits', niveau: 'obligation', theme: 'Matrice', groupes: ids,
            message: `${conflits.length} conflit${conflits.length > 1 ? 's' : ''} au plan nominal (rouge de dégagement insuffisant ou verts antagonistes simultanés).`,
            suggestion: 'Décaler les verts concernés ; les valeurs de la matrice sont des minima qu\'il est interdit de réduire.',
            source: 'ISR, 6e partie, art. 110 A et C2 ; Certu, 2010, p. 68'
        });
    }

    controles++;
    const asym: string[] = [];
    const asymIds = new Set<number>();
    groups.forEach((a, i) => groups.forEach((b, j) => {
        if (j <= i) return;
        const ab = caseRenseignee(conflictMatrix[i]?.[j]);
        const ba = caseRenseignee(conflictMatrix[j]?.[i]);
        if (ab !== ba) { asym.push(`GF${a.id}/GF${b.id}`); asymIds.add(a.id); asymIds.add(b.id); }
    }));
    if (asym.length) ajouter({
        id: 'matrice-asymetrique', niveau: 'recommandation', theme: 'Matrice', groupes: [...asymIds],
        message: `Incompatibilité déclarée dans un seul sens : ${asym.join(', ')}.`,
        suggestion: 'Deux courants antagonistes ont un rouge de dégagement dans chaque sens : compléter la case manquante ou vérifier la compatibilité.',
        source: 'ISR, 6e partie, art. 110 A'
    });

    // ---------------------------------------------------------------- signaux et flèches
    controles++;
    const signalIncoherent = analyses.filter(g => g.signal && g.type && !signalAdmis(g.type, g.signal));
    if (signalIncoherent.length) ajouter({
        id: 'signal-type', niveau: 'obligation', theme: 'Signaux', groupes: signalIncoherent.map(g => g.id),
        message: `Signal sans rapport avec le type du groupe : ${signalIncoherent.map(g => `${nomGroupe(g)} (${g.signal})`).join(', ')}.`,
        suggestion: 'Véhicules : signaux tricolores (R11, R14…) ; piétons : R12 ; transports en commun : R11v par défaut, R13b ou R17/R18.',
        source: 'ISR, 6e partie, art. 110 B4'
    });

    controles++;
    const sansFleche = avecVert.filter(g => !intersectionArrows.some(a => a.groupId === g.id));
    if (sansFleche.length && intersectionArrows.length) ajouter({
        id: 'sans-fleche', niveau: 'information', theme: 'Image du carrefour', groupes: sansFleche.map(g => g.id),
        message: `Groupe sans flèche sur l'image : ${sansFleche.map(nomGroupe).join(', ')}.`,
        suggestion: 'Poser une flèche par groupe, sur sa voie, dans l\'axe de la rue.',
        source: 'Règle de conception TraCflux'
    });

    controles++;
    const retours = intersectionArrows.map(a => {
        const g = analyses.find(x => x.id === a.groupId);
        const courant = g?.courant ?? '';
        const attendu = COURANTS_COMPOSES.has(courant) ? S.retourFlecheComposee : COURANTS_TOURNANTS.has(courant) ? S.retourFlecheSimple : null;
        return { g, attendu, reel: a.turnLength ?? 1 };
    }).filter(x => x.g && x.attendu !== null && Math.abs(x.reel - (x.attendu as number)) > 0.001);
    if (retours.length) ajouter({
        id: 'retour-fleche', niveau: 'information', theme: 'Image du carrefour', groupes: [...new Set(retours.map(x => x.g!.id))],
        message: `Retour de flèche différent de la valeur de référence : ${retours.map(x => `${nomGroupe(x.g!)} (${x.reel})`).join(', ')}.`,
        suggestion: `Retour de ${S.retourFlecheComposee} pour les flèches composées (tout droit et tourne), ${S.retourFlecheSimple} pour les tourne-à-gauche et tourne-à-droite simples.`,
        source: 'Règle de conception TraCflux'
    });

    // ---------------------------------------------------------------- capacité
    if (getTrafficData && cycleLength > 0) {
        controles++;
        const lignes = lignesDiagnostic({ groups, cycleLength, getTrafficData, actionData })
            .filter(r => r.capU !== null && !r.coord && r.capU >= S.capaciteUtiliseeAlerte);
        if (lignes.length) {
            const sature = lignes.some(r => (r.capU ?? 0) >= S.capaciteUtiliseeSaturee);
            ajouter({
                id: 'capacite', niveau: sature ? 'obligation' : 'recommandation', theme: 'Capacité', groupes: lignes.map(r => r.g.id),
                message: `Capacité utilisée de ${S.capaciteUtiliseeAlerte} % ou plus : ${lignes.map(r => `${nomGroupe(r.g)} (${Math.round(r.capU ?? 0)} %)`).join(', ')}.`,
                suggestion: sature
                    ? 'Courant saturé : redistribuer les verts, revoir le phasage ou la géométrie (voies, stockage), puis vérifier l\'attente maximale.'
                    : 'Réserve faible : vérifier le trafic et, si besoin, redistribuer les verts.',
                source: 'Certu, 2010, p. 35 et 71'
            });
        }
    }

    return { constats, controles };
};
