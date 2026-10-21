import { describe, it, expect } from 'vitest';
import { calculateSimulatedDiagram } from '.';
import { DESCRIPTION_REPOS_DEFAUT, decouperDescription, lireDureeRepos, tempsApresRetraitRepos } from './dureeRepos';

const groupe = (id, offset, green) => ({ id, name: `GF${id}`, type: 'VL', minGreen: 5, offset, durations: { green, orange: 3, red: 0 } });
const repos = (id, deb, description) => ({ id, gf: '1', action: 'Point de repos', deb: String(deb), fin: '', description, plage1: '', plage2: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', abrv: '', micro: '' });
const matrice = (n) => Array.from({ length: n }, () => Array(n).fill(''));

describe('durée du point de repos lue dans la description', () => {
    it('le nombre après « attente maxi »', () => {
        expect(lireDureeRepos('attente maxi 15 secondes')).toBe(15);
        expect(lireDureeRepos('Attente MAXI 7 s')).toBe(7);
        expect(lireDureeRepos('bus V2, attente maximum : 20 s')).toBe(20);
    });

    it('plafonnée à 30 secondes', () => {
        expect(lireDureeRepos('attente maxi 45 secondes')).toBe(30);
    });

    it('10 secondes sans valeur lisible, comme avant', () => {
        expect(lireDureeRepos('')).toBe(10);
        expect(lireDureeRepos(undefined)).toBe(10);
        expect(lireDureeRepos('attente maxi secondes')).toBe(10);
        expect(lireDureeRepos('attente maxi 0 seconde')).toBe(10);
        // Un autre chiffre de la description ne compte pas.
        expect(lireDureeRepos('GF 3 prioritaire')).toBe(10);
    });

    it('la description proposée vaut 10 secondes', () => {
        expect(DESCRIPTION_REPOS_DEFAUT).toBe('attente maxi 10 secondes');
        expect(lireDureeRepos(DESCRIPTION_REPOS_DEFAUT)).toBe(10);
    });

    it('seul le nombre de la durée est isolé pour être coloré', () => {
        expect(decouperDescription('attente maxi 12 secondes, GF 3')).toEqual([
            { texte: 'attente maxi ', duree: false },
            { texte: '12', duree: true },
            { texte: ' secondes, GF 3', duree: false },
        ]);
        expect(decouperDescription('Bus V2')).toEqual([{ texte: 'Bus V2', duree: false }]);
        expect(decouperDescription('')).toEqual([]);
    });
});

describe('simulation : chaque point de repos a sa durée', () => {
    it('le cycle s\'allonge de la durée lue', () => {
        const r = calculateSimulatedDiagram([groupe(1, 0, 30)], [repos(1, 20, 'attente maxi 15 secondes')], [1], 90, matrice(1));
        expect(r.simulatedCycleLength).toBe(105);
        expect(r.restPoints[0]).toMatchObject({ deb: 20, duration: 15 });
    });

    it('au-delà de 30 s, 30 s', () => {
        const r = calculateSimulatedDiagram([groupe(1, 0, 30)], [repos(1, 20, 'attente maxi 50 secondes')], [1], 90, matrice(1));
        expect(r.simulatedCycleLength).toBe(120);
    });

    it('deux points de repos : le second est décalé de la durée du premier', () => {
        const r = calculateSimulatedDiagram([groupe(1, 0, 30)],
            [repos(1, 10, 'attente maxi 5 secondes'), repos(2, 40, 'attente maxi 20 secondes')], [1, 2], 90, matrice(1));
        expect(r.simulatedCycleLength).toBe(115);
        expect(r.restPoints.map(p => [p.originalDeb, p.deb, p.duration])).toEqual([[10, 10, 5], [40, 45, 20]]);
    });
});

describe('tête de lecture quand on décoche un point de repos', () => {
    const zone = { deb: 20, duration: 15 };
    it('avant la zone : inchangée', () => {
        expect(tempsApresRetraitRepos(12, zone)).toBe(12);
        expect(tempsApresRetraitRepos(20, zone)).toBe(20);
    });
    it('dans la zone : revient au début du repos', () => {
        expect(tempsApresRetraitRepos(27, zone)).toBe(20);
    });
    it('après la zone : recule de toute la durée du repos', () => {
        expect(tempsApresRetraitRepos(35, zone)).toBe(20);
        expect(tempsApresRetraitRepos(60, zone)).toBe(45);
    });
});
