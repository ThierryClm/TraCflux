import { describe, it, expect } from 'vitest';
import { computeBandwidth, sortByAscendingDistance, sortByDescendingDistance } from './greenWaveBandwidth';

// 36 km/h = 10 m/s : 100 m se parcourent en 10 s.
const V = 10;

const carrefour = (projectName, distance, offset, green, extra = {}) => ({
    projectName,
    distance,
    cycleLength: 90,
    selectedGroup1: 1,
    selectedGroup2: 1,
    groups: [{ id: 1, name: 'G1', offset, durations: { green, orange: 3, red: 0 } }],
    ...extra
});

describe('computeBandwidth', () => {
    it('renvoie null sans carrefour', () => {
        expect(computeBandwidth(null, V, V, 90)).toBeNull();
        expect(computeBandwidth([], V, V, 90)).toBeNull();
    });

    it('donne le vert entier quand les verts sont décalés du temps de parcours', () => {
        // Montant : 0 m vert à 0 s, 100 m vert à 10 s → bande de 30 s.
        const its = [carrefour('A', 0, 0, 30), carrefour('B', 100, 10, 30)];
        const bw = computeBandwidth(its, V, V, 90);
        expect(bw.ascending).toMatchObject({ start: 0, width: 30, refDistance: 0 });
        expect(bw.ascending.segments).toHaveLength(1);
    });

    it('réduit la bande au recouvrement des verts', () => {
        // Le vert de B commence 5 s trop tard : il reste 25 s.
        const its = [carrefour('A', 0, 0, 30), carrefour('B', 100, 15, 30)];
        const bw = computeBandwidth(its, V, V, 90);
        expect(bw.ascending.width).toBe(25);
        expect(bw.ascending.start).toBe(5);
    });

    it('calcule le sens descendant depuis le carrefour le plus haut', () => {
        // Descendant : B (100 m) vert à 0 s, A (0 m) vert à 10 s.
        const its = [carrefour('A', 0, 10, 20), carrefour('B', 100, 0, 20)];
        const bw = computeBandwidth(its, V, V, 90);
        expect(bw.descending).toMatchObject({ start: 0, width: 20, refDistance: 100 });
    });

    it('suit la distance propre au GF montant', () => {
        // distanceG2 place B à 200 m pour le sens montant : vert attendu à 20 s.
        const its = [carrefour('A', 0, 0, 30), carrefour('B', 100, 20, 30, { distanceG2: 200 })];
        expect(computeBandwidth(its, V, V, 90).ascending.width).toBe(30);
    });

    it("ouvre un nouveau tronçon là où la bande s'élargit", () => {
        // A étrangle la bande à 10 s ; à partir de B, elle retrouve 30 s.
        const its = [carrefour('A', 0, 0, 10), carrefour('B', 100, 10, 30), carrefour('C', 200, 20, 30)];
        const segments = computeBandwidth(its, V, V, 90).ascending.segments;
        expect(segments.map(s => [s.startIdx, s.endIdx, s.width])).toEqual([[0, 0, 10], [1, 2, 30]]);
    });

    it("ne fait partir la bande que d'où les verts se recouvrent", () => {
        // Depuis A, les verts ne se recouvrent jamais : la bande ne naît qu'en B.
        const its = [carrefour('A', 0, 0, 10), carrefour('B', 100, 50, 10)];
        const segments = computeBandwidth(its, V, V, 90).ascending.segments;
        expect(segments.map(s => [s.startIdx, s.endIdx, s.width])).toEqual([[1, 1, 10]]);
    });

    it('renvoie un sens sans bande quand aucun vert ne dure', () => {
        expect(computeBandwidth([carrefour('A', 0, 0, 0)], V, V, 90).ascending).toBeNull();
    });
});

describe('ordre de parcours', () => {
    const its = [
        { projectName: 'A', distance: 300, distanceG2: 0 },
        { projectName: 'B', distance: 0, distanceG2: 300 },
        { projectName: 'C', distance: 150 }
    ];
    it('trie le sens montant par distanceG2, à défaut distance', () => {
        expect(sortByAscendingDistance(its).map(i => i.projectName)).toEqual(['A', 'C', 'B']);
    });
    it('trie le sens descendant du plus haut au plus bas', () => {
        expect(sortByDescendingDistance(its).map(i => i.projectName)).toEqual(['A', 'C', 'B']);
    });
});
