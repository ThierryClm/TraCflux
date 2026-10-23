import { describe, it, expect } from 'vitest';
import { calculerConflits } from './calculConflits';

const g = (id, offset, green) => ({ id, name: `G${id}`, type: 'V', minGreen: 8, offset, durations: { green, orange: 3, red: 70 - green - 3 } });
const matrice = [['', 6], [6, '']];

describe('conflits : groupes sans vert', () => {
    it('un groupe sans vert (Déb et Fin vides) n\'est pas compté', () => {
        expect(calculerConflits([g(1, 0, 0), g(2, 0, 0)], matrice, 70, [])).toEqual([]);
        expect(calculerConflits([g(1, 0, 30), g(2, 0, 0)], matrice, 70, [])).toEqual([]);
    });

    it('dès que les deux groupes ont un vert, le conflit réapparaît', () => {
        const c = calculerConflits([g(1, 0, 30), g(2, 10, 20)], matrice, 70, []);
        expect(c.length).toBeGreaterThan(0);
    });
});
