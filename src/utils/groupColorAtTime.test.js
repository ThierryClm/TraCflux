import { describe, it, expect } from 'vitest';
import { getGroupColorAtTime, isTimeInRange, numeroGroupe } from './groupColorAtTime';

const VERT = 'rgb(0, 255, 0)';
const JAUNE = 'rgb(255, 255, 0)';
const ROUGE = 'rgb(255, 0, 0)';
const VERT_LUCARNE = 'rgb(0, 180, 0)';

// Plan de base : un groupe vert de 0 à 30, jaune jusqu'à 33, rouge ensuite.
const groupe = (surcharge = {}) => ({
    id: 1,
    offset: 0,
    durations: { green: 30, orange: 3, red: 27 },
    ...surcharge
});

const contexte = (surcharge = {}) => ({
    groups: [groupe()],
    simulationResult: null,
    cycleLength: 60,
    actionData: [],
    selectedActions: [],
    conflictMatrix: [],
    ...surcharge
});

describe('isTimeInRange', () => {
    it('reconnaît une plage ordinaire', () => {
        expect(isTimeInRange(15, 10, 20, 60)).toBe(true);
        expect(isTimeInRange(25, 10, 20, 60)).toBe(false);
    });

    it('borne incluse au début, exclue à la fin', () => {
        expect(isTimeInRange(10, 10, 20, 60)).toBe(true);
        expect(isTimeInRange(20, 10, 20, 60)).toBe(false);
    });

    it('gère une plage qui enjambe la fin de cycle', () => {
        expect(isTimeInRange(55, 50, 10, 60)).toBe(true);  // avant le zéro
        expect(isTimeInRange(5, 50, 10, 60)).toBe(true);   // après le zéro
        expect(isTimeInRange(30, 50, 10, 60)).toBe(false); // au milieu
    });

    it('ramène le temps dans le cycle', () => {
        expect(isTimeInRange(75, 10, 20, 60)).toBe(true); // 75 % 60 = 15
    });
});

describe('getGroupColorAtTime — phases de base', () => {
    it('donne le vert pendant le vert', () => {
        expect(getGroupColorAtTime(1, 0, contexte())).toBe(VERT);
        expect(getGroupColorAtTime(1, 29, contexte())).toBe(VERT);
    });

    it('donne le jaune pendant le jaune', () => {
        expect(getGroupColorAtTime(1, 30, contexte())).toBe(JAUNE);
        expect(getGroupColorAtTime(1, 32, contexte())).toBe(JAUNE);
    });

    it('donne le rouge le reste du cycle', () => {
        expect(getGroupColorAtTime(1, 33, contexte())).toBe(ROUGE);
        expect(getGroupColorAtTime(1, 59, contexte())).toBe(ROUGE);
    });

    it('ramène un temps hors cycle dans le cycle', () => {
        expect(getGroupColorAtTime(1, 60, contexte())).toBe(VERT);
        expect(getGroupColorAtTime(1, 90, contexte())).toBe(JAUNE); // 90 % 60 = 30
    });

    it('donne le rouge pour un groupe inconnu', () => {
        expect(getGroupColorAtTime(99, 0, contexte())).toBe(ROUGE);
    });

    it('gère un vert qui enjambe la fin de cycle', () => {
        const ctx = contexte({ groups: [groupe({ offset: 50, durations: { green: 20, orange: 3, red: 37 } })] });
        expect(getGroupColorAtTime(1, 55, ctx)).toBe(VERT); // avant le zéro
        expect(getGroupColorAtTime(1, 5, ctx)).toBe(VERT);  // après le zéro
        expect(getGroupColorAtTime(1, 30, ctx)).toBe(ROUGE);
    });

    it('n\'accorde jamais de vert à une durée nulle', () => {
        const ctx = contexte({ groups: [groupe({ durations: { green: 0, orange: 3, red: 57 } })] });
        expect(getGroupColorAtTime(1, 0, ctx)).toBe(JAUNE);
        expect(getGroupColorAtTime(1, 10, ctx)).toBe(ROUGE);
    });
});

describe('getGroupColorAtTime — temps simulés', () => {
    // Le cœur du sujet : dès qu'une simulation existe, ce sont SES valeurs qui
    // priment, indépendamment de toute lecture en cours.
    const simule = (surcharge = {}) => ({
        simulatedGroups: [{ ...groupe(), simulatedOffset: 10, simulatedGreen: 20, ...surcharge }],
        simulatedCycleLength: 50
    });

    it('emploie le décalage et le vert simulés', () => {
        const ctx = contexte({ simulationResult: simule() });
        expect(getGroupColorAtTime(1, 5, ctx)).toBe(ROUGE);  // avant le vert simulé
        expect(getGroupColorAtTime(1, 15, ctx)).toBe(VERT);  // dedans
        expect(getGroupColorAtTime(1, 31, ctx)).toBe(JAUNE); // 10+20 = 30, jaune 3 s
    });

    it('emploie le cycle simulé pour ramener le temps', () => {
        const ctx = contexte({ simulationResult: simule() });
        // 65 % 50 = 15, dans le vert simulé — alors que 65 % 60 = 5 serait rouge.
        expect(getGroupColorAtTime(1, 65, ctx)).toBe(VERT);
    });

    it('met au rouge un groupe entièrement escamoté', () => {
        const ctx = contexte({ simulationResult: simule({ isEscamoted: true }) });
        expect(getGroupColorAtTime(1, 15, ctx)).toBe(ROUGE);
    });

    it('retire le vert sur une découpe (greenCuts)', () => {
        const ctx = contexte({ simulationResult: simule({ greenCuts: [{ deb: 14, fin: 18 }] }) });
        expect(getGroupColorAtTime(1, 13, ctx)).toBe(VERT);
        expect(getGroupColorAtTime(1, 15, ctx)).toBe(ROUGE); // découpé
        expect(getGroupColorAtTime(1, 19, ctx)).toBe(VERT);
    });

    it('retire le vert sur une découpe qui enjambe la fin de cycle', () => {
        const ctx = contexte({
            simulationResult: {
                simulatedGroups: [{ ...groupe(), simulatedOffset: 40, simulatedGreen: 30, greenCuts: [{ deb: 45, fin: 5 }] }],
                simulatedCycleLength: 50
            }
        });
        expect(getGroupColorAtTime(1, 42, ctx)).toBe(VERT);
        expect(getGroupColorAtTime(1, 47, ctx)).toBe(ROUGE); // avant le zéro
        expect(getGroupColorAtTime(1, 2, ctx)).toBe(ROUGE);  // après le zéro
        expect(getGroupColorAtTime(1, 8, ctx)).toBe(VERT);
    });
});

describe('getGroupColorAtTime — seconde lucarne', () => {
    const lucarne = { id: 'a1', action: 'Seconde lucarne', gf: '1', deb: '40', fin: '45' };

    it('colore la lucarne en vert soutenu', () => {
        const ctx = contexte({ actionData: [lucarne] });
        expect(getGroupColorAtTime(1, 42, ctx)).toBe(VERT_LUCARNE);
        expect(getGroupColorAtTime(1, 46, ctx)).toBe(ROUGE);
    });

    it('reste active quand d\'AUTRES actions sont cochées en simulation', () => {
        // Régression du 2026-08-27 : la lucarne était conditionnée à sa propre
        // coche, alors que la simulation ne traite pas cette action.
        const ctx = contexte({
            actionData: [lucarne, { id: 'a2', action: 'Escamotage', gf: '2', deb: '0', fin: '5' }],
            selectedActions: ['a2']
        });
        expect(getGroupColorAtTime(1, 42, ctx)).toBe(VERT_LUCARNE);
    });

    it('ignore une lucarne aux bornes vides', () => {
        const ctx = contexte({ actionData: [{ ...lucarne, deb: '', fin: '' }] });
        expect(getGroupColorAtTime(1, 42, ctx)).toBe(ROUGE);
    });

    it('ignore la lucarne d\'un autre groupe', () => {
        const ctx = contexte({ actionData: [{ ...lucarne, gf: '2' }] });
        expect(getGroupColorAtTime(1, 42, ctx)).toBe(ROUGE);
    });
});

describe('getGroupColorAtTime — escamotage, groupe cible', () => {
    // GF1 est la cible ; GF2 la source. La zone de coupure s'étend de part et
    // d'autre du vert de la source, élargie des temps interverts.
    const ctx = () => contexte({
        groups: [groupe(), { id: 2, offset: 40, durations: { green: 10, orange: 3, red: 47 } }],
        actionData: [{ id: 'e1', action: 'Escamotage', gf: '2', actGf1: '1', deb: '0', fin: '5' }],
        selectedActions: ['e1'],
        // [source][cible] = 4 s, [cible][source] = 6 s
        conflictMatrix: [[0, 6], [4, 0]]
    });

    it('coupe la cible autour du vert de la source', () => {
        // Source verte de 40 à 50 ; coupure de 40-6=34 à 50+4=54.
        expect(getGroupColorAtTime(1, 36, ctx())).toBe(JAUNE); // début de coupure : jaune
        expect(getGroupColorAtTime(1, 45, ctx())).toBe(ROUGE); // au-delà du jaune
        expect(getGroupColorAtTime(1, 55, ctx())).toBe(ROUGE); // hors coupure, mais hors vert
    });

    it('reste sans effet si l\'action n\'est pas cochée', () => {
        const sansCoche = { ...ctx(), selectedActions: [] };
        // Sans coupure, à 36 s le groupe est rouge (vert de 0 à 30) — et non jaune.
        expect(getGroupColorAtTime(1, 36, sansCoche)).toBe(ROUGE);
    });

    it('reste sans effet sans matrice des interverts', () => {
        const sansMatrice = { ...ctx(), conflictMatrix: [] };
        expect(getGroupColorAtTime(1, 36, sansMatrice)).toBe(ROUGE);
    });
});

describe('getGroupColorAtTime — robustesse', () => {
    it('accepte un contexte vide', () => {
        expect(() => getGroupColorAtTime(1, 0)).not.toThrow();
        expect(getGroupColorAtTime(1, 0)).toBe(ROUGE);
    });

    it('accepte un groupe sans durées', () => {
        const ctx = contexte({ groups: [{ id: 1, offset: 0 }] });
        expect(getGroupColorAtTime(1, 0, ctx)).toBe(ROUGE);
    });
});

describe('numeroGroupe — formes du champ GF', () => {
    it('accepte les écritures rencontrées à la saisie et à l\'import', () => {
        expect(numeroGroupe('5')).toBe(5);
        expect(numeroGroupe('G5')).toBe(5);
        expect(numeroGroupe('g5')).toBe(5);
        expect(numeroGroupe(' 5 ')).toBe(5);
        expect(numeroGroupe('G 5')).toBe(5);
        expect(numeroGroupe(5)).toBe(5);
    });

    it('rend NaN pour un champ vide', () => {
        expect(numeroGroupe('')).toBeNaN();
        expect(numeroGroupe(null)).toBeNaN();
        expect(numeroGroupe(undefined)).toBeNaN();
    });
});

describe('seconde lucarne — champ GF sous toutes ses formes', () => {
    // Le défaut constaté le 2026-08-28 : notée « G1 », la lucarne n'était pas
    // reconnue et la flèche restait rouge en parcourant sa période.
    const avecGf = (gf) => contexte({
        actionData: [{ id: 'a1', action: 'Seconde lucarne', gf, deb: '40', fin: '45' }]
    });

    it.each(['1', 'G1', 'g1', ' 1 ', 1])('reconnaît la lucarne notée %p', (gf) => {
        expect(getGroupColorAtTime(1, 42, avecGf(gf))).toBe(VERT_LUCARNE);
    });

    it('ne confond pas deux groupes dont le numéro commence pareil', () => {
        // « G1 » ne doit pas activer la lucarne du groupe 11.
        expect(getGroupColorAtTime(11, 42, avecGf('G1'))).not.toBe(VERT_LUCARNE);
    });
});

describe('type FL — courant clignotant', () => {
    // Le diagramme ne trace pas de barre verte pour un groupe FL mais une bande
    // jaune intermittente : le courant associé doit battre à la même cadence,
    // 1 s allumée / 1 s éteinte, calée sur le début de la période.
    const ETEINT = 'rgb(120, 120, 120)';
    const fl = (surcharge = {}) => contexte({
        groups: [groupe({ type: 'FL', offset: 10, ...surcharge })]
    });

    it('alterne allumé et éteint pendant sa période', () => {
        expect(getGroupColorAtTime(1, 10, fl())).toBe(JAUNE);        // 1re seconde
        expect(getGroupColorAtTime(1, 11, fl())).toBe(ETEINT); // 2e
        expect(getGroupColorAtTime(1, 12, fl())).toBe(JAUNE);        // 3e
    });

    it('cale l\'alternance sur le début de période, pas sur le zéro du cycle', () => {
        // Décalage impair : sans calage sur le début, l'alternance serait inversée.
        expect(getGroupColorAtTime(1, 11, fl({ offset: 11 }))).toBe(JAUNE);
    });

    it('reste éteint hors de sa période, jamais rouge', () => {
        // Un feu clignotant n'a pas d'état rouge : hors plage il est simplement
        // éteint, du même gris qu'entre deux allumages.
        expect(getGroupColorAtTime(1, 50, fl())).toBe(ETEINT);
    });

    it('ne touche pas aux groupes des autres types', () => {
        expect(getGroupColorAtTime(1, 10, contexte())).toBe(VERT);
    });
});
