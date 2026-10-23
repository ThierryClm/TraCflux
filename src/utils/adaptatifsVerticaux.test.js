import { describe, it, expect } from 'vitest';
import { proposerAdaptatifs } from './adaptatifsVerticaux';

// TD « carrefour en croix avec couloir bus d'approche », plan à 70 s (HPM).
const g = (id, debut, vert, vertMini, trafic = 0) => ({ id, debut, vert, vertMini, trafic, coefVoie: 1 });
const td = [
    g(1, 0, 29, 8, 600), g(2, 0, 29, 8, 500), g(3, 33, 6, 6, 24), g(4, 45, 19, 8, 380), g(5, 45, 19, 8, 300),
    g(6, 46, 16, 7), g(7, 44, 16, 8), g(8, 0, 37, 6), g(9, 0, 37, 6),
];

describe('adaptatifs verticaux proposés', () => {
    it('TD : V1 25–29 et V4 61–64 après trois passages, cycle contracté de 63 s', () => {
        const r = proposerAdaptatifs([1, 3, 4], td, 70, 85);
        expect(r.adaptatifs.map(a => [a.determinant, a.deb, a.fin])).toEqual([[1, 25, 29], [3, 39, 39], [4, 61, 64]]);
        expect(r.cycleContracte).toBe(63);
        expect(r.passages).toBe(3);
        const [v1, b3, v4] = r.adaptatifs;
        expect(v1.capContractee).toBeLessThanOrEqual(85);
        expect(v4.capContractee).toBeLessThanOrEqual(85);
        // Seule, la zone de V1 le porte au-delà de 85 % : l'itération compte sur les autres.
        expect(v1.capSeule).toBeGreaterThan(85);
        expect(b3.duree).toBe(0);
        expect(b3.limite).toEqual({ id: 3, raison: 'mini' });
        expect(v1.limite).toEqual({ id: 1, raison: 'capacite' });
    });

    it('capacité utilisée du déterminant au cycle nominal', () => {
        const r = proposerAdaptatifs([1, 3, 4], td, 70, 85);
        expect(r.adaptatifs[0].capNominale).toBeCloseTo(80.5, 0);
    });

    it('le vert mini d\'un groupe associé arrête la zone', () => {
        // V2 ne peut pas descendre sous 27 s : la zone de V1 s'arrête à 2 s.
        const groupes = td.map(x => (x.id === 2 ? { ...x, vertMini: 27 } : x));
        const r = proposerAdaptatifs([1, 3, 4], groupes, 70, 85);
        expect(r.adaptatifs[0].duree).toBe(2);
        expect(r.adaptatifs[0].limite).toEqual({ id: 2, raison: 'mini' });
    });

    it('déterminant sans vert : pas de zone pour sa phase', () => {
        const groupes = td.map(x => (x.id === 4 ? { ...x, vert: 0 } : x));
        const r = proposerAdaptatifs([1, 3, 4], groupes, 70, 85);
        expect(r.adaptatifs.map(a => a.determinant)).toEqual([1, 3]);
    });

    it('mode prudent : chaque zone tient seule, V1 27–29 et V4 62–64, cycle contracté de 66 s', () => {
        const r = proposerAdaptatifs([1, 3, 4], td, 70, 85, 'prudent');
        expect(r.adaptatifs.map(a => [a.determinant, a.deb, a.fin])).toEqual([[1, 27, 29], [3, 39, 39], [4, 62, 64]]);
        expect(r.cycleContracte).toBe(66);
        expect(r.passages).toBe(1);
        r.adaptatifs.filter(a => a.duree > 0).forEach(a => {
            expect(a.capSeule).toBeLessThanOrEqual(85);
            expect(a.capContractee).toBeLessThanOrEqual(85);
        });
    });
});
