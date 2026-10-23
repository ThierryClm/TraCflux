import { describe, it, expect } from 'vitest';
import { proposerReposBus, lireTmabX } from './reposBus';

const g = (id, type, debut, vert) => ({ id, type, debut, vert });
// TD : B3 vert de 33 à 39 s ; P8 et P9 jusqu'à 37 s.
const td = [
    g(1, 'V', 0, 29), g(2, 'V', 0, 29), g(3, 'B', 33, 6), g(4, 'V', 45, 19), g(5, 'V', 45, 19),
    g(6, 'P', 46, 16), g(7, 'P', 44, 16), g(8, 'P', 0, 37), g(9, 'P', 0, 37),
];

describe('point de repos bus proposé', () => {
    it('TD : à 36 s, dernier instant où B3, P8 et P9 sont au vert ; N = 36 − 33 − 1 = 2', () => {
        expect(proposerReposBus(td, 70)).toEqual([{ groupe: 3, instant: 36, inclus: [3, 8, 9], n: 2 }]);
    });

    it('bus seul au vert : le plus tard possible', () => {
        const r = proposerReposBus(td.filter(x => x.id < 8), 70);
        expect(r[0].instant).toBe(38);
        expect(r[0].n).toBe(4);
    });

    it('pas de groupe bus : rien', () => {
        expect(proposerReposBus(td.filter(x => x.id !== 3), 70)).toEqual([]);
    });

    it('TMABX lu dans les variables micro, sinon absent', () => {
        expect(lireTmabX(['TMAB1 = 12', 'TMABX = 15'])).toBe(15);
        expect(lireTmabX(['TMAB1 = 12'])).toBeNull();
    });
});
