import { describe, it, expect } from 'vitest';
import { calculateSimulatedDiagram } from '.';
import { recalerCurseur } from './curseur';

// Un groupe vert de 0 à 30 s, cycle de 90 s.
const groupes = [{ id: 1, name: 'GF1', type: 'VL', minGreen: 5, offset: 0, durations: { green: 30, orange: 3, red: 0 } }];
const action = (id, champs) => ({ id, gf: '1', action: '', deb: '', fin: '', description: '', plage1: '', plage2: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', abrv: '', micro: '', ...champs });
const actions = [
    action(1, { action: 'Point de repos', deb: '20', description: 'attente maxi 15 secondes' }),
    action(2, { action: 'Adaptatif vertical', deb: '50', fin: '60' }),
    action(3, { action: 'Adaptatif vertical', deb: '40', fin: '45', plage1: '1', plage2: '1' }),
    action(4, { action: 'Escamotage de phase', deb: '70', fin: '80' }),
];
const simuler = (cochees) => calculateSimulatedDiagram(groupes, actions, cochees, 90, [['']]);
/** Curseur à t dans la simulation « avant », recalé dans « après ». */
const recale = (t, avant, apres) => {
    const a = simuler(avant), b = simuler(apres);
    return recalerCurseur(t, a.journal, b.journal, b.simulatedCycleLength);
};

describe('curseur : point de repos (15 s à 20 s)', () => {
    it('coché : après le repos, le curseur avance de 15 s ; avant ou sur le point, il ne bouge pas', () => {
        expect(recale(30, [], [1])).toBe(45);
        expect(recale(10, [], [1])).toBe(10);
        expect(recale(20, [], [1])).toBe(20);
    });
    it('décoché : dans le repos, retour à son début ; après, recul de 15 s', () => {
        expect(recale(27, [1], [])).toBe(20);
        expect(recale(60, [1], [])).toBe(45);
        expect(recale(12, [1], [])).toBe(12);
    });
});

describe('curseur : adaptatif vertical sans plage (zone 50-60 s retirée)', () => {
    it('coché : après la zone, recul de 10 s ; dans la zone, au début ; avant, rien', () => {
        expect(recale(70, [], [2])).toBe(60);
        expect(recale(55, [], [2])).toBe(50);
        expect(recale(30, [], [2])).toBe(30);
    });
    it('décoché : après l\'endroit de la zone, avance de 10 s', () => {
        expect(recale(60, [2], [])).toBe(70);
        expect(recale(30, [2], [])).toBe(30);
    });
});

describe('curseur : escamotage de phase (zone 70-80 s retirée)', () => {
    it('coché : après la zone, recul de 10 s ; dans la zone, au début', () => {
        expect(recale(85, [], [4])).toBe(75);
        expect(recale(74, [], [4])).toBe(70);
    });
    it('décoché : après l\'endroit de la zone, avance de 10 s', () => {
        expect(recale(75, [4], [])).toBe(85);
    });
});

describe('curseur : combinaisons', () => {
    it('cocher l\'adaptatif quand le repos est déjà coché : même règle, dans le temps simulé', () => {
        // Repos 20-35 ; zone d'origine 50-60 devenue 65-75 ; curseur à 85 → 75.
        expect(recale(85, [1], [1, 2])).toBe(75);
    });
    it('dans un repos qui demeure, le curseur garde sa place quand une autre action change', () => {
        expect(recale(27, [1], [1, 2])).toBe(27);
        expect(recale(27, [1, 2], [1])).toBe(27);
    });
    it('Tout coché puis Tout décoché : retour au même instant', () => {
        const t = recale(30, [], [1, 2]);
        expect(recale(t, [1, 2], [])).toBe(30);
    });
    it('un adaptatif avec plage ne change pas le cycle : le curseur ne bouge pas', () => {
        expect(recale(70, [], [3])).toBe(70);
    });
});
