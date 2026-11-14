import { describe, it, expect } from 'vitest';
import {
    ABSENCE_APRES_VERT_S,
    dureeOccupation,
    estDetecteurOccupe,
    estOccupee,
    groupesComptesParProximite,
    intervallesDetecteur,
    intervallePassage,
    retraitEffectif,
    vehiculesAvantRecouvrement,
    vitesseCourant
} from './animationDetecteurs';
import type { Detecteur, FlecheCarrefour, Groupe } from '../types/projet';

const groupe = (overrides: Partial<Groupe> = {}): Groupe => ({
    id: 1,
    name: 'Nord',
    type: 'V',
    courant: 'TD',
    laneCoef: 1,
    minGreen: 6,
    offset: 0,
    durations: { green: 30, orange: 3, red: 57 },
    ...overrides
});

const detecteur = (overrides: Partial<Detecteur> = {}): Detecteur => ({
    id: 1,
    nom: 'Boucle',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 2,
    position: { x: 50, y: 50 },
    orientation: 0,
    note: '',
    ...overrides
});

const fleche = (groupId: number, x: number, y: number): FlecheCarrefour => ({ id: groupId, groupId, x, y });

const contexte = (overrides: Record<string, unknown> = {}) => ({
    cycleLength: 90,
    groups: [groupe()],
    arrows: [] as FlecheCarrefour[],
    getTrafficData: (groupId: number) => ({ trafficVol: groupId === 1 ? 600 : 300 }),
    simulationResult: null,
    actionData: [],
    selectedActions: [],
    conflictMatrix: [],
    pixelsParMetre: 12,
    ...overrides
});

describe('paramètres de passage', () => {
    it('déduit l’intervalle du coefficient de voie', () => {
        expect(intervallePassage(1)).toBe(2);
        expect(intervallePassage(0.8)).toBeCloseTo(2.5);
        expect(intervallePassage(1.2)).toBeCloseTo(1.6667, 3);
        expect(intervallePassage(undefined)).toBe(2);
    });

    it('ralentit les mouvements tournants', () => {
        expect(vitesseCourant('TD')).toBe(10);
        expect(vitesseCourant('TàD')).toBe(8);
        expect(vitesseCourant('TàG')).toBe(6);
        expect(vitesseCourant('inconnu')).toBe(10);
    });

    it('calcule l’occupation à partir de la longueur de boucle', () => {
        expect(dureeOccupation(2, 10)).toBeCloseTo(0.7);
        expect(dureeOccupation(5, 10)).toBeCloseTo(1.0);
        expect(dureeOccupation(30, 10)).toBeCloseTo(3.5);
        expect(dureeOccupation(2, 6)).toBeCloseTo(1.1667, 3);
    });

    it('déduit le véhicule qui recouvre une boucle éloignée', () => {
        // Un véhicule tous les 6 m : à 20 m, quatre passent, le cinquième fige.
        expect(vehiculesAvantRecouvrement(0)).toBe(1);
        expect(vehiculesAvantRecouvrement(6)).toBe(2);
        expect(vehiculesAvantRecouvrement(20)).toBe(5);
        expect(vehiculesAvantRecouvrement(25)).toBe(6);
    });

    it('force le retrait 0 pour une boucle de pied de feu', () => {
        const ctx = contexte();
        const piedFeu = detecteur({ retrait: 40 });
        expect(retraitEffectif(piedFeu, 1, ctx)).toBe(0);
        const eloignee = detecteur({ categorie: 'boucleEloignee', retrait: 18 });
        expect(retraitEffectif(eloignee, 1, ctx)).toBe(18);
    });
});

describe('occupation dans le cycle', () => {
    it('gère un intervalle qui passe le début du cycle', () => {
        expect(estOccupee(88, [{ debut: -10, fin: 5 }], 90)).toBe(true);
        expect(estOccupee(2, [{ debut: -10, fin: 5 }], 90)).toBe(true);
        expect(estOccupee(10, [{ debut: -10, fin: 5 }], 90)).toBe(false);
    });

    it('ne rend rien pour un radar ou un bouton', () => {
        expect(intervallesDetecteur(detecteur({ categorie: 'radar' }), contexte())).toEqual([]);
        expect(intervallesDetecteur(detecteur({ categorie: 'boutonPoussoir' }), contexte())).toEqual([]);
        expect(estDetecteurOccupe(detecteur({ categorie: 'radar' }), 10, contexte())).toBe(false);
    });
});

describe('boucle de pied de feu', () => {
    it('reste allumée pendant le rouge, à cause du véhicule en attente', () => {
        const ctx = contexte();
        expect(estDetecteurOccupe(detecteur(), 40, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 89, ctx)).toBe(true);
    });

    it('s’allume par impulsions pendant le vert, une par véhicule de la file', () => {
        const ctx = contexte();
        // 600 véh/h, cycle 90 s, vert 30 s, coefficient 1 : le premier véhicule
        // libère la boucle à 2 s, les suivants passent toutes les 2 s.
        expect(estDetecteurOccupe(detecteur(), 0.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 1.9, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 3, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 4.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 20.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 27, ctx)).toBe(false);
    });

    it('ne s’anime pas sans trafic', () => {
        const ctx = contexte({ getTrafficData: () => ({ trafficVol: 0 }) });
        expect(intervallesDetecteur(detecteur(), ctx)).toEqual([]);
    });

    it('reste allumée pendant le vert utile, même si la file est courte', () => {
        // 386 véh/h, coefficient 0,8, cycle 80 s : V.Utile ≈ 21,4 s, comme le
        // montre la colonne V.Utile du tableau de trafic (54 % d'un vert de 41 s).
        const ctx = contexte({
            cycleLength: 80,
            groups: [groupe({ laneCoef: 0.8, durations: { green: 41, orange: 3, red: 36 } })],
            getTrafficData: () => ({ trafficVol: 386 })
        });
        // Coefficient 0,8 : libération à 2,5 s puis un véhicule toutes les 2,5 s.
        expect(estDetecteurOccupe(detecteur(), 2.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 2.7, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 5.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 7.7, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 21, ctx)).toBe(false);
    });

    it('laisse 6 s sans véhicule après le vert quand la capacité ne dépasse pas 90 %', () => {
        const ctx = contexte({
            cycleLength: 80,
            groups: [groupe({ laneCoef: 0.8, durations: { green: 41, orange: 3, red: 36 } })],
            getTrafficData: () => ({ trafficVol: 386 })
        });
        // Vert 0–41, capacité ≈ 52 % : boucle éteinte de 41 à 47, puis le
        // premier véhicule arrivé la maintient allumée.
        expect(ABSENCE_APRES_VERT_S).toBe(6);
        expect(estDetecteurOccupe(detecteur(), 43, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 46.9, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 47.1, ctx)).toBe(true);
    });

    it('reste allumée dès la fin du vert au-dessus de 90 % de capacité', () => {
        const ctx = contexte({
            cycleLength: 80,
            groups: [groupe({ laneCoef: 0.8, durations: { green: 41, orange: 3, red: 36 } })],
            getTrafficData: () => ({ trafficVol: 700 })
        });
        // Capacité ≈ 95 % : pas d'absence de 8 s.
        expect(estDetecteurOccupe(detecteur(), 43, ctx)).toBe(true);
    });
});

describe('exemple du cahier des charges : 320 véh/h, cycle 90 s, vert 40 s', () => {
    const ctxExemple = (overrides: Record<string, unknown> = {}) => contexte({
        cycleLength: 90,
        groups: [groupe({ durations: { green: 40, orange: 3, red: 47 } })],
        getTrafficData: () => ({ trafficVol: 320 }),
        ...overrides
    });

    it('sert 8 véhicules à partir de la 2e seconde, puis reste éteinte', () => {
        const ctx = ctxExemple();
        // Le premier véhicule tient la boucle jusqu'à 2 s, les 7 autres passent
        // ensuite toutes les 2 s jusqu'à 16 s.
        expect(estDetecteurOccupe(detecteur(), 0.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 2.5, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 4.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 12.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 16.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 17, ctx)).toBe(false);
        // Le reste du vert et les 6 s de principe (40–46) sont éteints.
        expect(estDetecteurOccupe(detecteur(), 20, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 39, ctx)).toBe(false);
        expect(estDetecteurOccupe(detecteur(), 45.9, ctx)).toBe(false);
    });

    it('rallume la boucle de pied de feu dès le premier véhicule qui arrive', () => {
        const ctx = ctxExemple();
        expect(estDetecteurOccupe(detecteur(), 46.1, ctx)).toBe(true);
        expect(estDetecteurOccupe(detecteur(), 89, ctx)).toBe(true);
    });

    it('pour une boucle à 20 m, laisse passer quatre véhicules puis fige au cinquième', () => {
        const ctx = ctxExemple({
            arrows: [fleche(1, 50, 50)],
            pixelsParMetre: 12
        });
        const boucle = detecteur({ categorie: 'boucleEloignee', position: { x: 82, y: 50 } });
        // Au vert : la file recouvre la boucle 8 s, puis les 4 derniers passent.
        expect(estDetecteurOccupe(boucle, 2, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 7.9, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 8.2, ctx)).toBe(false);
        expect(estDetecteurOccupe(boucle, 10.2, ctx)).toBe(true);
        // Après le vert : quatre passages (2 s de trajet jusqu'à la boucle),
        // puis le cinquième fige l'occupation.
        expect(estDetecteurOccupe(boucle, 46.2, ctx)).toBe(false);
        expect(estDetecteurOccupe(boucle, 48.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 49, ctx)).toBe(false);
        expect(estDetecteurOccupe(boucle, 68.1, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 70, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 89, ctx)).toBe(true);
        // L'occupation se poursuit jusqu'à ce que la file se vide au vert suivant.
        expect(estDetecteurOccupe(boucle, 95, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 99, ctx)).toBe(false);
    });
});

describe('boucle éloignée', () => {
    it('reste allumée quand la file la recouvre', () => {
        // Flèche à x=50, boucle à 20 m : 240 px à 12 px/m.
        const ctx = contexte({
            arrows: [fleche(1, 50, 50)],
            pixelsParMetre: 12
        });
        const boucle = detecteur({ categorie: 'boucleEloignee', position: { x: 82, y: 50 } });
        expect(estDetecteurOccupe(boucle, 40, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 2, ctx)).toBe(true);
        // La boucle reste occupée pendant le temps de service (V.Utile), ici 30 s.
        expect(estDetecteurOccupe(boucle, 5, ctx)).toBe(true);
    });

    it('s’allume au passage quand la file ne la recouvre pas', () => {
        // 80 m entre le pied de feu et la boucle, avec une échelle de 6 px/m.
        // 300 véh/h : la file ne recouvre pas la boucle, les véhicules la
        // franchissent après 8 s de trajet.
        const ctx = contexte({
            arrows: [fleche(1, 10, 50)],
            pixelsParMetre: 6,
            getTrafficData: () => ({ trafficVol: 300 })
        });
        const boucle = detecteur({ categorie: 'boucleEloignee', position: { x: 74, y: 50 } });
        // Départ à 2 s puis 8 s de trajet jusqu'à la boucle.
        expect(estDetecteurOccupe(boucle, 10.2, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 2, ctx)).toBe(false);
    });
});

describe('boucle de comptage', () => {
    it('choisit les flèches les plus proches', () => {
        const ctx = contexte({
            groups: [groupe({ id: 1 }), groupe({ id: 2, name: 'Sud', offset: 45 })],
            arrows: [fleche(1, 20, 50), fleche(2, 30, 50)],
            pixelsParMetre: 12
        });
        const boucle = detecteur({ categorie: 'boucleComptage', position: { x: 25, y: 50 }, gf: null });
        expect(groupesComptesParProximite(boucle, ctx)).toEqual([1, 2]);
    });

    it('compte les véhicules de chaque groupe sur son vert, tournants compris', () => {
        const ctx = contexte({
            groups: [groupe({ id: 1 }), groupe({ id: 2, name: 'Sud', offset: 45 })],
            arrows: [fleche(1, 20, 50), fleche(2, 30, 50)],
            getTrafficData: (groupId: number) => ({ trafficVol: groupId === 1 ? 300 : 150 }),
            pixelsParMetre: 12
        });
        const boucle = detecteur({ categorie: 'boucleComptage', position: { x: 25, y: 50 }, gf: null });
        // Le groupe 2 est vert de 45 à 75 : la boucle s'allume à ses véhicules.
        expect(estDetecteurOccupe(boucle, 45.4, ctx)).toBe(true);
        expect(estDetecteurOccupe(boucle, 0.4, ctx)).toBe(true);
        // À 3 m de l'arrêt, la file de la transversale recouvre la boucle
        // pendant son rouge : l'occupation reste fixe.
        expect(estDetecteurOccupe(boucle, 40, ctx)).toBe(true);
    });

    it('reste allumée pendant le rouge quand le groupe compté est saturé', () => {
        // GF8 de l'exemple : vert 19–35 sur un cycle de 100 s, 303 véh/h,
        // coefficient 0,85 → 101 % de capacité, la file ne se vide pas.
        const ctx = contexte({
            cycleLength: 100,
            groups: [groupe({
                id: 8,
                name: 'Rue PESTRE',
                offset: 81,
                laneCoef: 0.85,
                durations: { green: 16, orange: 3, red: 81 }
            })],
            arrows: [fleche(8, 20, 50)],
            getTrafficData: () => ({ trafficVol: 303 })
        });
        const boucle = detecteur({ categorie: 'boucleComptage', position: { x: 25, y: 50 }, gf: null });
        expect(estDetecteurOccupe(boucle, 50, ctx)).toBe(true);
    });

    it('s’éteint pendant le rouge quand le groupe compté n’est pas saturé', () => {
        const ctx = contexte({
            cycleLength: 100,
            groups: [groupe({
                id: 8,
                name: 'Rue PESTRE',
                offset: 81,
                laneCoef: 0.85,
                durations: { green: 16, orange: 3, red: 81 }
            })],
            arrows: [fleche(8, 20, 50)],
            getTrafficData: () => ({ trafficVol: 100 })
        });
        // Boucle loin de l'arrêt : la file ne la recouvre jamais, seuls les
        // véhicules qui la franchissent l'allument.
        const boucle = detecteur({
            categorie: 'boucleComptage',
            position: { x: 25, y: 50 },
            retrait: 100,
            gf: null
        });
        expect(estDetecteurOccupe(boucle, 50, ctx)).toBe(false);
    });
});
