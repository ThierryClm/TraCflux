import { describe, it, expect } from 'vitest';
import { calculerSuggestionCycle, debutsDesPhases, degagementsParDefaut, dizaineSuperieure, instantsPhasageBulle, repartirVerts } from './suggestionCycle';

// Cas du TD « carrefour en croix avec couloir bus d'approche », option A.
const groupes = [
    { id: 1, nom: 'V1', trafic: 600, coefVoie: 1, vertMini: 8 },
    { id: 3, nom: 'B3', trafic: 24, coefVoie: 1, vertMini: 6 },
    { id: 4, nom: 'V4', trafic: 380, coefVoie: 1, vertMini: 8 },
];
const matrice = [];
for (let i = 0; i < 9; i++) matrice.push(Array(9).fill(''));
matrice[2][3] = 6; // B3 → V4
matrice[3][0] = 6; // V4 → V1

describe('suggestion de durée du cycle', () => {
    it('dégagements pré-remplis par la matrice, null quand la case est vide', () => {
        expect(degagementsParDefaut([1, 3, 4], matrice)).toEqual([null, 6, 6]);
    });

    it('TD : Y = 0,558, L = 16 s, Webster 65,6 s, cycle proposé 70 s', () => {
        const r = calculerSuggestionCycle({ determinants: [1, 3, 4], degagements: [4, 6, 6] }, groupes);
        expect(r.Y).toBeCloseTo(0.558, 3);
        expect(r.L).toBe(16);
        expect(r.websterExact).toBeCloseTo(65.58, 2);
        expect(r.cycleWebster).toBe(66);
        expect(r.cycleMinimal).toBe(37);
        expect(r.cycleTauxVise).toBe(47);
        expect(r.sature).toBe(false);
        expect(r.cycleSuggere).toBe(70);
        expect(r.verts).toEqual([29, 6, 19]);
        expect(r.verts.reduce((a, b) => a + b, 0) + r.L).toBe(70);
    });

    it('un dégagement manquant est signalé', () => {
        const r = calculerSuggestionCycle({ determinants: [1, 3, 4], degagements: [null, 6, 6] }, groupes);
        expect(r.degagementsManquants).toEqual([0]);
    });

    it('carrefour saturé : alerte, et pas de cycle quand Y ≥ 1', () => {
        const lourds = groupes.map(g => ({ ...g, trafic: 900 }));
        const r = calculerSuggestionCycle({ determinants: [1, 3, 4], degagements: [4, 6, 6] }, lourds);
        expect(r.sature).toBe(true);
        expect(r.cycleWebster).toBeNull();
        expect(r.cycleTauxVise).toBeNull();
    });

    it('le coefficient de voie réduit y', () => {
        const r = calculerSuggestionCycle({ determinants: [1, 4], degagements: [6, 6] },
            [{ id: 1, nom: 'V1', trafic: 900, coefVoie: 2, vertMini: 8 }, { id: 4, nom: 'V4', trafic: 0, coefVoie: 1, vertMini: 8 }]);
        expect(r.phases[0].y).toBeCloseTo(0.25);
        expect(r.phases[1].y).toBe(0);
    });

    it('les verts ne descendent jamais sous le minimum', () => {
        const v = repartirVerts([{ y: 0.5, vertMini: 8 }, { y: 0.01, vertMini: 10 }, { y: 0.2, vertMini: 8 }], 40);
        expect(v[1]).toBe(10);
        expect(v.reduce((a, b) => a + b, 0)).toBe(40);
    });

    it('arrondi à la dizaine supérieure', () => {
        expect(dizaineSuperieure(65.6)).toBe(70);
        expect(dizaineSuperieure(70)).toBe(70);
        expect(dizaineSuperieure(70.2)).toBe(80);
    });

    it('début de vert de chaque phase, dégagements compris', () => {
        expect(debutsDesPhases([30, 6, 18], [4, 6, 6])).toEqual([0, 34, 46]);
    });

    it('phasage bulle : milieu du vert de chaque déterminant', () => {
        const g = [{ id: 1, offset: 0, durations: { green: 28 } }, { id: 3, offset: 32, durations: { green: 6 } }, { id: 4, offset: 44, durations: { green: 20 } }];
        expect(instantsPhasageBulle([1, 3, 4], g, 70)).toEqual([14, 35, 54]);
    });
});
