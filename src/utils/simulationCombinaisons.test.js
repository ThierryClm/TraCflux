import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { calculateSimulatedDiagram } from './simulationCalculator';

/**
 * Combinaisons d'actions de micro-régulation, plan ACTUEL du projet exemple.
 *
 * Règle validée par Thierry : les actions cochées s'enchaînent, et chacune se
 * lit dans le temps déjà transformé par les précédentes, ligne par ligne. Un
 * point de repos décale les instants qui le suivent ; un adaptatif partiel
 * décale, sur les seules lignes de sa plage, les instants qui le suivent.
 */

const exemple = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'Carrefour_Exemple.json'), 'utf8'));
const plan = exemple.pfTabs.find(pf => pf.name === 'ACTUEL');
const groupes = exemple.groups.map(g => {
    const ligne = plan.diagram.find(d => d.groupId === g.id);
    return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
});

// Identifiants des actions du plan ACTUEL
const ESCAMOTAGE_PHASE = 1;     // 20-32 s, tous les groupes
const ADAPTATIF_GF2 = 5;        // 11-15 s, plage GF1 à GF7
const POINT_REPOS_GF2 = 6;      // 14 s

const simuler = (cochees) => calculateSimulatedDiagram(groupes, plan.data, cochees, plan.cycleLength, plan.conflictMatrix);

/** « 1-25 », ou « escamoté » */
const vert = (resultat, id) => {
    const g = resultat.simulatedGroups.find(x => x.id === id);
    return g.isEscamoted || g.simulatedGreen <= 0 ? 'escamoté' : `${g.simulatedOffset}-${g.simulatedOffset + g.simulatedGreen}`;
};

describe('Simulation — escamotage de phase après un point de repos', () => {
    const r = simuler([ESCAMOTAGE_PHASE, POINT_REPOS_GF2]);

    it("l'escamotage se lit après les 10 s insérées par le point de repos", () => {
        expect(vert(r, 2)).toBe('1-25');
        expect(vert(r, 3)).toBe('1-25');
        expect(vert(r, 4)).toBe('0-30');
    });

    it('GF5 et GF6, entièrement dans la zone escamotée, disparaissent', () => {
        expect(vert(r, 5)).toBe('escamoté');
        expect(vert(r, 6)).toBe('escamoté');
    });

    it('le cycle gagne 10 s et en perd 12', () => {
        expect(r.simulatedCycleLength).toBe(68);
    });
});

describe('Simulation — escamotage de phase après un adaptatif partiel', () => {
    const r = simuler([ESCAMOTAGE_PHASE, ADAPTATIF_GF2]);

    it("sur les lignes de la plage, l'escamotage recule de la durée de l'adaptatif", () => {
        // Vert du GF4 : 0-28, adaptatif 11-15 → 0-24, escamotage 16-28 → 0-16
        expect(vert(r, 4)).toBe('0-16');
        expect(vert(r, 5)).toBe('escamoté');
        expect(vert(r, 6)).toBe('escamoté');
    });

    it('le cycle ne perd que la durée de l\'escamotage', () => {
        expect(r.simulatedCycleLength).toBe(58);
    });
});

describe('Simulation — zone hachurée du point de repos après une contraction', () => {
    const POINT_REPOS_GF1 = 4;      // 65 s, sans plage
    const POINT_REPOS_GF9 = 10;     // 60 s, plage à partir de GF9
    const ADAPTATIF_GF8 = 8;        // 7-11 s, plage GF8 à GF13

    const repos = (resultat, id) => resultat.restPoints.find(rp => rp.actionId === id).deb;

    it("seul, le repos démarre à sa seconde", () => {
        expect(repos(simuler([POINT_REPOS_GF1]), POINT_REPOS_GF1)).toBe(65);
    });

    it("après l'escamotage de phase (12 s retirées avant lui), il démarre à 53 s", () => {
        expect(repos(simuler([ESCAMOTAGE_PHASE, POINT_REPOS_GF1]), POINT_REPOS_GF1)).toBe(53);
    });

    it("un adaptatif partiel de sa plage le ramène de sa durée", () => {
        expect(repos(simuler([ADAPTATIF_GF8, POINT_REPOS_GF9]), POINT_REPOS_GF9)).toBe(56);
    });

    it("un adaptatif partiel d'une autre plage ne le déplace pas", () => {
        expect(repos(simuler([ADAPTATIF_GF2, POINT_REPOS_GF9]), POINT_REPOS_GF9)).toBe(60);
    });
});
