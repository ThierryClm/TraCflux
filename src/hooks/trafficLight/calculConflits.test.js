import { describe, it, expect } from 'vitest';
import { calculerConflits, rangesOverlap } from './calculConflits';

const groupe = (id, offset, green) => ({
    id, name: `G${id}`, type: 'VL', minGreen: 5, offset,
    durations: { green, orange: 3, red: 0 }
});

const action = (id, nom, gf, deb, fin, extra = {}) => ({
    id, action: nom, gf: String(gf), deb: String(deb), fin: String(fin),
    actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    plage1: '', plage2: '', abrv: '', description: '', micro: '', ...extra
});

// Deux groupes antagonistes, 5 s d'intervert dans les deux sens, cycle 60 s.
const matrice = [['', 5], [5, '']];

describe('rangesOverlap — plages cycliques', () => {
    it('plages disjointes, puis chevauchantes', () => {
        expect(rangesOverlap(0, 10, 10, 20, 60)).toBe(false);
        expect(rangesOverlap(0, 10, 9, 20, 60)).toBe(true);
    });
    it('plage qui passe la fin du cycle', () => {
        expect(rangesOverlap(55, 5, 2, 8, 60)).toBe(true);
        expect(rangesOverlap(55, 5, 10, 20, 60)).toBe(false);
    });
});

describe('calculerConflits', () => {
    it('aucun conflit quand les interverts sont respectés', () => {
        const groupes = [groupe(1, 0, 20), groupe(2, 25, 30)];
        expect(calculerConflits(groupes, matrice, 60, [])).toEqual([]);
    });

    it('intervert insuffisant : écart réel et écart requis', () => {
        const groupes = [groupe(1, 0, 20), groupe(2, 22, 30)];
        expect(calculerConflits(groupes, matrice, 60, [])).toEqual([
            { from: 1, to: 2, required: 5, actual: 2, type: 'intergreen' }
        ]);
    });

    it('verts qui se chevauchent : chevauchement signalé dans les deux sens', () => {
        // 1 : 0-20 s, 2 : 10-30 s. L'écart circulaire fin → début reste large
        // (50 s et 30 s) : pas d'intervert en défaut, mais un chevauchement.
        const groupes = [groupe(1, 0, 20), groupe(2, 10, 20)];
        const types = calculerConflits(groupes, matrice, 60, []).map(c => `${c.from}>${c.to} ${c.type}`);
        expect(types).toEqual(['1>2 overlap', '2>1 overlap']);
    });

    it('un escamotage entre les deux groupes neutralise le chevauchement', () => {
        const groupes = [groupe(1, 0, 20), groupe(2, 10, 20)];
        const actions = [action(1, 'Escamotage', 1, 10, 20, { actGf1: '2' })];
        const types = calculerConflits(groupes, matrice, 60, actions).map(c => c.type);
        expect(types).not.toContain('overlap');
    });

    it('seconde lucarne sur le vert de l\'antagoniste', () => {
        const groupes = [groupe(1, 0, 20), groupe(2, 25, 30)];
        const actions = [action(1, 'Seconde lucarne', 1, 30, 40)];
        const sl = calculerConflits(groupes, matrice, 60, actions).filter(c => c.type === 'sl-overlap');
        expect(sl.length).toBeGreaterThan(0);
        expect(sl.every(c => c.from === 1 && c.to === 2)).toBe(true);
    });

    it('secondes lucarnes de deux antagonistes qui se chevauchent', () => {
        const groupes = [groupe(1, 0, 20), groupe(2, 25, 10)];
        const actions = [action(1, 'Seconde lucarne', 1, 40, 50), action(2, 'Seconde lucarne', 2, 45, 55)];
        expect(calculerConflits(groupes, matrice, 60, actions)).toContainEqual(
            { from: 1, to: 2, type: 'sl-sl-overlap', message: 'Chevauchement des secondes lucarnes' }
        );
    });
});
