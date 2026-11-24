/**
 * Analyse du diagramme : les règles et recommandations que le plan de feu
 * actif n'applique pas.
 *
 * Sources : ISR, livre 1, 6e partie (règlement) ; Certu, « Guide de conception
 * des carrefours à feux », 2010 (recommandations) ; règles de conception
 * retenues pour TraCflux. Seules les règles vérifiables sur les données du
 * projet sont contrôlées : l'analyse signale, le concepteur décide.
 *
 * Trois familles de constats, dans cet ordre d'affichage :
 * - « obligation » (rouge) : règle non respectée, à corriger en priorité ;
 * - « recommandation » (orange) : recommandation non appliquée ou point
 *   d'attention, marqué par `pointAttention` ;
 * - « information » (bleu) : suggestion.
 */
import type { ActionMicro, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import { computeConflicts } from './conflictUtils';
import { lignesDiagnostic } from './diagnosticCarrefour';
import { signalAdmis, typeFormulaire } from './signauxIsr';
import { SEUILS_ANALYSE_DEFAUT, completerSeuils, type SeuilsAnalyse } from './seuilsAnalyse';

/** Règle non respectée (rouge), recommandation (orange) ou suggestion (bleu). */
export type NiveauConstat = 'obligation' | 'recommandation' | 'information';

/** Ordre d'affichage : les règles à corriger d'abord. */
export const ORDRE_NIVEAUX: NiveauConstat[] = ['obligation', 'recommandation', 'information'];

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
    /** Marque orange : « Point d'attention » plutôt que recommandation. */
    pointAttention?: boolean;
}

export interface ResultatAnalyse {
    constats: Constat[];
    /** Nombre de contrôles passés, pour situer les constats. */
    controles: number;
    /** Groupes ignorés faute de renseignement (type ou vert absent). */
    groupesIgnores: number;
}

interface EntreesAnalyse {
    groups: Groupe[];
    cycleLength: number;
    conflictMatrix: Matrice;
    intersectionArrows?: FlecheCarrefour[];
    getTrafficData?: (groupId: number) => { trafficVol?: number | string };
    actionData?: ActionMicro[];
    /** Seuils réglés par l'utilisateur ; complétés par les valeurs par défaut. */
    seuils?: Partial<SeuilsAnalyse>;
}

export { SEUILS_ANALYSE_DEFAUT };

const ISR_DUREES = 'ISR, 6e partie, art. 110 C1';
const CERTU = 'Certu, Guide de conception des carrefours à feux, 2010';

const nomGroupe = (g: Groupe) => `GF${g.id}${g.name ? ` ${g.name}` : ''}`;
const estPieton = (g: Groupe) => typeFormulaire(g.type) === 'P';
const estVehicule = (g: Groupe) => ['V', 'B', 'CY'].includes(typeFormulaire(g.type));
/**
 * Priorité piétons (PP), flèche lumineuse (FL) et groupe porteur d'un signal
 * d'aide à la conduite (SAC) : état particulier d'un groupe, sans vert mini ni
 * jaune ; aucune suggestion sur leurs valeurs.
 */
const estEtatParticulier = (g: Groupe, actionData: ActionMicro[]) =>
    ['PP', 'FL'].includes(typeFormulaire(g.type))
    || actionData.some(a => a.action === 'Signal aide conduite' && Number(a.gf) === g.id);
const estSignalTC = (g: Groupe) => g.signal === 'R17' || g.signal?.startsWith('R18');
const caseRenseignee = (v: unknown) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
const valeurCellule = (v: unknown) => caseRenseignee(v) ? Number(v) : null;

/** Un groupe n'a de valeurs que si son type et son vert sont renseignés. */
const estRenseigne = (g: Groupe) => !!g.type && (g.durations?.green ?? 0) > 0;

export const analyserDiagramme = ({
    groups,
    cycleLength,
    conflictMatrix,
    intersectionArrows = [],
    getTrafficData,
    actionData = [],
    seuils
}: EntreesAnalyse): ResultatAnalyse => {
    const constats: Constat[] = [];
    let controles = 0;
    const ajouter = (c: Constat) => constats.push(c);
    const S = completerSeuils(seuils);
    const analyses = groups.filter(g => estRenseigne(g) && !estEtatParticulier(g, actionData));
    const avecVert = analyses.filter(g => (g.durations?.green ?? 0) > 0);
    const groupesIgnores = groups.filter(g => !estRenseigne(g) || estEtatParticulier(g, actionData)).length;

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
        source: `${CERTU}, p. 68`
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

    // ---------------------------------------------------------------- attentes et cycle
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
            source: `${CERTU}, p. 34 et 69`
        });

        controles++;
        const attentePieton = avecVert.filter(estPieton).filter(g => cycleLength - g.durations.green > S.attentePietonMaxi);
        if (attentePieton.length) ajouter({
            id: 'attente-pieton-maxi', niveau: 'recommandation', pointAttention: true, theme: 'Piétons',
            groupes: attentePieton.map(g => g.id),
            message: `Attente piétonne de plus de ${S.attentePietonMaxi} s : ${attentePieton.map(g => `${nomGroupe(g)} (${cycleLength - g.durations.green} s)`).join(', ')}.`,
            suggestion: `Seuil de tolérance réglé à ${S.attentePietonMaxi} s : un piéton arrivé au rouge attend au plus C − V. Allonger le vert piéton, raccourcir le cycle ou ouvrir la traversée dans une autre phase.`,
            source: 'Règle de conception TraCflux'
        });

        controles++;
        const retards = analyses.filter(estPieton).filter(g => (g.durations?.green ?? 0) > 0)
            .map(g => ({ g, r: Math.round((cycleLength - g.durations.green) ** 2 / (2 * cycleLength)) }))
            .filter(x => x.r > S.retardPietonMaxi);
        if (retards.length) ajouter({
            id: 'retard-pieton', niveau: 'recommandation', theme: 'Piétons', groupes: retards.map(x => x.g.id),
            message: `Retard moyen des piétons supérieur à ${S.retardPietonMaxi} s au plan nominal : ${retards.map(x => `${nomGroupe(x.g)} (${x.r} s)`).join(', ')}.`,
            suggestion: 'Calcul hors micro-régulation : les contractions de phase (adaptatifs, escamotages) ne sont pas prises en compte et réduisent ce retard en fonctionnement réel. Sinon : allonger le vert piéton, raccourcir le cycle ou ouvrir la traversée dans une autre phase. Retard moyen r = (C − V)² / 2C.',
            source: `${CERTU}, p. 72`
        });
    }

    // ---------------------------------------------------------------- traversées
    controles++;
    const longues = groups.map((g, i) => ({ g, i })).filter(({ g }) => estRenseigne(g) && estPieton(g)).map(({ g, i }) => {
        const ligne = conflictMatrix[i] ?? [];
        const deg = Math.max(0, ...ligne.filter(caseRenseignee).map(Number));
        return { g, deg };
    }).filter(x => x.deg > S.traverseeSansRefuge);
    if (longues.length) ajouter({
        id: 'refuge-12m', niveau: 'recommandation', theme: 'Piétons', groupes: longues.map(x => x.g.id),
        message: `Dégagement piéton de plus de ${S.traverseeSansRefuge} s, soit une traversée d'environ ${S.traverseeSansRefuge} m ou plus : ${longues.map(x => `${nomGroupe(x.g)} (${x.deg} s)`).join(', ')}.`,
        suggestion: `Au-delà de ${S.traverseeSansRefuge} m, prévoir un îlot refuge (2 m préférable, 1,50 m admissible) et, si besoin, dissocier les deux demi-traversées. Dès 9 m sur une voie à double sens, l'étudier.`,
        source: `${CERTU}, p. 19 et 53`
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
        if (j <= i || !estRenseigne(a) || !estRenseigne(b)) return;
        const ab = caseRenseignee(conflictMatrix[i]?.[j]);
        const ba = caseRenseignee(conflictMatrix[j]?.[i]);
        if (ab !== ba) { asym.push(`GF${a.id}/GF${b.id}`); asymIds.add(a.id); asymIds.add(b.id); }
    }));
    if (asym.length) ajouter({
        id: 'matrice-asymetrique', niveau: 'obligation', theme: 'Matrice', groupes: [...asymIds],
        message: `Incompatibilité déclarée dans un seul sens : ${asym.join(', ')}.`,
        suggestion: 'Deux courants antagonistes ont un rouge de dégagement dans chaque sens : compléter la case manquante ou vérifier la compatibilité.',
        source: 'ISR, 6e partie, art. 110 A'
    });

    controles++;
    const diagonale = groups.filter((g, i) => estRenseigne(g) && caseRenseignee(conflictMatrix[i]?.[i]));
    if (diagonale.length) ajouter({
        id: 'matrice-diagonale', niveau: 'obligation', theme: 'Matrice', groupes: diagonale.map(g => g.id),
        message: `Case du groupe avec lui-même renseignée : ${diagonale.map(nomGroupe).join(', ')}.`,
        suggestion: 'Une case de la diagonale ne protège d\'aucun conflit : la vider.',
        source: 'ISR, 6e partie, art. 110 A'
    });

    controles++;
    const intervertFaibles: string[] = [];
    const intervertFaiblesIds = new Set<number>();
    groups.forEach((a, i) => groups.forEach((b, j) => {
        if (i === j || !estRenseigne(a) || !estRenseigne(b) || !estVehicule(a) || !estVehicule(b)) return;
        const v = valeurCellule(conflictMatrix[i]?.[j]);
        if (v !== null && v > 0 && v < 3) {
            intervertFaibles.push(`GF${a.id}→GF${b.id} (${v} s)`);
            intervertFaiblesIds.add(a.id); intervertFaiblesIds.add(b.id);
        }
    }));
    if (intervertFaibles.length) ajouter({
        id: 'intervert-faible', niveau: 'recommandation', pointAttention: true, theme: 'Matrice', groupes: [...intervertFaiblesIds],
        message: `Temps intervert inférieur à 3 s entre deux courants véhicules : ${intervertFaibles.join(', ')}.`,
        suggestion: 'Le rouge de dégagement couvre au moins le jaune (3 s) avant l\'ouverture du courant suivant : relever la valeur ou vérifier qu\'il ne s\'agit pas d\'une case mal saisie.',
        source: ISR_DUREES
    });

    controles++;
    const intervertCycles: string[] = [];
    if (cycleLength > 0) {
        groups.forEach((a, i) => groups.forEach((b, j) => {
            if (!estRenseigne(a) || !estRenseigne(b)) return;
            const v = valeurCellule(conflictMatrix[i]?.[j]);
            if (v !== null && v > cycleLength) intervertCycles.push(`GF${a.id}/GF${b.id} (${v} s)`);
        }));
    }
    if (intervertCycles.length) ajouter({
        id: 'intervert-cycle', niveau: 'obligation', theme: 'Matrice', groupes: [],
        message: `Temps intervert supérieur au cycle de ${cycleLength} s : ${intervertCycles.join(', ')}.`,
        suggestion: 'Aucun phasage ne peut respecter un temps intervert plus long que le cycle : corriger la valeur ou allonger le cycle.',
        source: 'ISR, 6e partie, art. 110 A'
    });

    controles++;
    const matriceRenseignee = groups.some((_, i) => (conflictMatrix[i] ?? []).some(caseRenseignee));
    if (groups.length >= 2 && !matriceRenseignee) ajouter({
        id: 'matrice-vide', niveau: 'recommandation', pointAttention: true, theme: 'Matrice', groupes: [],
        message: 'Matrice des temps interverts vide : les conflits ne peuvent pas être contrôlés.',
        suggestion: 'Renseigner le rouge de dégagement de chaque paire de courants antagonistes (onglet Matrice) ; l\'analyse vérifie alors les conflits du plan.',
        source: 'ISR, 6e partie, art. 110 A'
    });

    // ---------------------------------------------------------------- signaux
    controles++;
    const signalIncoherent = analyses.filter(g => g.signal && g.type && !signalAdmis(g.type, g.signal));
    if (signalIncoherent.length) ajouter({
        id: 'signal-type', niveau: 'obligation', theme: 'Signaux', groupes: signalIncoherent.map(g => g.id),
        message: `Signal sans rapport avec le type du groupe : ${signalIncoherent.map(g => `${nomGroupe(g)} (${g.signal})`).join(', ')}.`,
        suggestion: 'Véhicules : signaux tricolores (R11, R14…) ; piétons : R12 ; transports en commun : R11v par défaut, R13b ou R17/R18.',
        source: 'ISR, 6e partie, art. 110 B4'
    });

    controles++;
    const sansSignal = analyses.filter(g => !g.signal);
    if (sansSignal.length) ajouter({
        id: 'signal-absent', niveau: 'information', theme: 'Signaux', groupes: sansSignal.map(g => g.id),
        message: `Groupe sans signal ISR : ${sansSignal.map(nomGroupe).join(', ')}.`,
        suggestion: 'Renseigner le signal de chaque groupe : il figure au dossier imprimé et sert de base aux contrôles de cohérence.',
        source: 'ISR, 6e partie, art. 110 B4'
    });

    controles++;
    const parCourant = new Map<string, Groupe[]>();
    analyses.forEach(g => {
        const courant = g.courant?.trim();
        if (!courant) return;
        parCourant.set(courant, [...(parCourant.get(courant) ?? []), g]);
    });
    const melanges: string[] = [];
    const melangesIds = new Set<number>();
    parCourant.forEach((liste, courant) => {
        const r11 = liste.filter(g => g.signal?.startsWith('R11'));
        const r14 = liste.filter(g => g.signal?.startsWith('R14'));
        if (r11.length && r14.length) {
            const ids = [...r11, ...r14].map(g => g.id);
            melanges.push(`${courant} (${ids.map(id => `GF${id}`).join(', ')})`);
            ids.forEach(id => melangesIds.add(id));
        }
    });
    if (melanges.length) ajouter({
        id: 'r11-r14-courant', niveau: 'recommandation', pointAttention: true, theme: 'Signaux', groupes: [...melangesIds],
        message: `R11 et R14 sur le même courant : ${melanges.join(' ; ')}.`,
        suggestion: 'À vérifier : un R11 ne peut coexister avec un R14 sur un même couloir. S\'ils le partagent, passez à un R11 unique ou à des R14 pour tous les groupes du couloir (flèches au sol obligatoires) ; sinon, rattachez-les à des courants distincts.',
        source: 'ISR, 6e partie, art. 110-1 §2 et 110-4 §1'
    });

    controles++;
    const r14Trop: string[] = [];
    const r14TropIds = new Set<number>();
    parCourant.forEach((liste, courant) => {
        const r14 = liste.filter(g => g.signal?.startsWith('R14'));
        if (r14.length > 3) {
            r14Trop.push(`${courant} (${r14.length} R14)`);
            r14.forEach(g => r14TropIds.add(g.id));
        }
    });
    if (r14Trop.length) ajouter({
        id: 'r14-trop', niveau: 'recommandation', pointAttention: true, theme: 'Signaux', groupes: [...r14TropIds],
        message: `Plus de trois R14 sur un même courant : ${r14Trop.join(' ; ')}.`,
        suggestion: 'À vérifier : un couloir reçoit deux ou trois groupes en R14, pas davantage. Si ces groupes partagent la même voie d\'entrée, regroupez les mouvements ou revoyez le découpage des courants.',
        source: 'ISR, 6e partie, art. 110-4 §2'
    });

    // ---------------------------------------------------------------- image et capacité
    controles++;
    const sansFleche = avecVert.filter(g => !intersectionArrows.some(a => a.groupId === g.id));
    if (sansFleche.length && intersectionArrows.length) ajouter({
        id: 'sans-fleche', niveau: 'information', theme: 'Image du carrefour', groupes: sansFleche.map(g => g.id),
        message: `Groupe sans flèche sur l'image : ${sansFleche.map(nomGroupe).join(', ')}.`,
        suggestion: 'Poser une flèche par groupe, sur sa voie, dans l\'axe de la rue.',
        source: 'Règle de conception TraCflux'
    });

    controles++;
    const orphelines = intersectionArrows.filter(a => !groups.some(g => g.id === a.groupId));
    if (orphelines.length) ajouter({
        id: 'fleche-orpheline', niveau: 'information', theme: 'Image du carrefour', groupes: [],
        message: `Flèche sans groupe de feux : ${orphelines.length} flèche${orphelines.length > 1 ? 's' : ''} sur l'image.`,
        suggestion: 'Rattacher chaque flèche à un groupe existant, ou la supprimer : elle ne peut prendre aucune couleur.',
        source: 'Règle de conception TraCflux'
    });

    if (getTrafficData && cycleLength > 0) {
        controles++;
        const lignes = lignesDiagnostic({ groups, cycleLength, getTrafficData, actionData })
            .filter(r => r.capU !== null && !r.coord);
        const saturees = lignes.filter(r => (r.capU ?? 0) >= S.capaciteUtiliseeAlerte);
        if (saturees.length) {
            const sature = saturees.some(r => (r.capU ?? 0) >= S.capaciteUtiliseeSaturee);
            ajouter({
                id: 'capacite', niveau: 'recommandation', pointAttention: true, theme: 'Capacité',
                groupes: saturees.map(r => r.g.id),
                message: `Capacité utilisée de ${S.capaciteUtiliseeAlerte} % ou plus : ${saturees.map(r => `${nomGroupe(r.g)} (${Math.round(r.capU ?? 0)} %)`).join(', ')}.`,
                suggestion: sature
                    ? 'Courant saturé : redistribuer les verts, revoir le phasage ou la géométrie (voies, stockage), puis vérifier l\'attente maximale.'
                    : 'Réserve faible : vérifier le trafic et, si besoin, redistribuer les verts.',
                source: `${CERTU}, p. 35 et 71`
            });
        }

        controles++;
        const reserveFaible = lignes.filter(r => (r.capU ?? 0) >= S.capaciteReserveFaible && (r.capU ?? 0) < S.capaciteUtiliseeAlerte);
        if (reserveFaible.length) ajouter({
            id: 'reserve-faible', niveau: 'information', theme: 'Capacité', groupes: reserveFaible.map(r => r.g.id),
            message: `Réserve de capacité faible, de ${S.capaciteReserveFaible} à ${S.capaciteUtiliseeAlerte} % : ${reserveFaible.map(r => `${nomGroupe(r.g)} (${Math.round(r.capU ?? 0)} %)`).join(', ')}.`,
            suggestion: 'Surveiller ces courants : une pointe de trafic les fera basculer au-dessus du seuil d\'alerte.',
            source: `${CERTU}, p. 35 et 71`
        });
    }

    constats.sort((a, b) => ORDRE_NIVEAUX.indexOf(a.niveau) - ORDRE_NIVEAUX.indexOf(b.niveau));
    return { constats, controles, groupesIgnores };
};
