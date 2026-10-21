import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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

    it('les descriptions existantes : nombre juste après ou juste avant « maxi » / « max »', () => {
        expect(lireDureeRepos("Attente bus V2 Sémard maxi 15''")).toBe(15);
        expect(lireDureeRepos("Attente bus 15'' max")).toBe(15);
        expect(lireDureeRepos("Attente bus Sémard maxi 16''  sur la plage GF1 à GF7")).toBe(16);
        expect(lireDureeRepos("Attente bus 12'' max")).toBe(12);
        expect(lireDureeRepos('Attente bus maxi 16')).toBe(16);
        expect(lireDureeRepos("Attente bus V2 Sémard maxi 12'' (Niveau 2)")).toBe(12);
        expect(lireDureeRepos("Attente bus B9 ou B11  maxi 12''")).toBe(12);
        expect(lireDureeRepos('Attente 20 s max')).toBe(20);
        expect(lireDureeRepos('Attente 8 secondes maximum')).toBe(8);
        expect(lireDureeRepos('attente maximale : 25')).toBe(25);
    });

    it('un chiffre éloigné de « maxi » ne compte pas', () => {
        expect(lireDureeRepos('Bus V2 prioritaire')).toBe(10);
        expect(lireDureeRepos('GF 3 maxi')).toBe(10);
        expect(lireDureeRepos('Climax 3')).toBe(10);
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
        expect(decouperDescription("Attente bus 12'' max")).toEqual([
            { texte: 'Attente bus ', duree: false },
            { texte: '12', duree: true },
            { texte: "'' max", duree: false },
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

describe('carrefour exemple : les durées écrites sont appliquées', () => {
    const exemple = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'Carrefour_Exemple.json'), 'utf8'));
    it("PF_Aiguillage : « maxi 12'' » sur les deux points de repos, le cycle gagne 24 s", () => {
        const plan = exemple.pfTabs.find(pf => pf.name === 'PF_Aiguillage');
        const repos = plan.data.filter(a => a.action === 'Point de repos');
        expect(repos.map(a => lireDureeRepos(a.description))).toEqual([12, 12]);
        const r = calculateSimulatedDiagram(exemple.groups, plan.data, repos.map(a => a.id), plan.cycleLength, plan.conflictMatrix);
        expect(r.restPoints.map(p => p.duration)).toEqual([12, 12]);
    });
});
