import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { calculateSimulatedDiagram } from '.';

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

describe('Simulation — point de repos et verts qui chevauchent la fin du cycle', () => {
    // Plan PF_Aiguillage (cycle 46) : point de repos GF2 à 5 s. GF2 (45 + 9),
    // GF3 (45 + 6), GF4 (44 + 8), GF8 (44 + 11) et GF12 (44 + 8) débordent sur
    // le cycle suivant et sont encore verts à 5 s : leur fin de vert recule de
    // 10 s, comme celle des autres verts couvrant l'instant du repos.
    const aiguillage = exemple.pfTabs.find(pf => pf.name === 'PF_Aiguillage');
    const groupesAig = exemple.groups.map(g => {
        const ligne = aiguillage.diagram.find(d => d.groupId === g.id);
        return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
    });
    const r = calculateSimulatedDiagram(groupesAig, aiguillage.data, [3], aiguillage.cycleLength, aiguillage.conflictMatrix);
    const finDeVert = id => {
        const g = r.simulatedGroups.find(x => x.id === id);
        return `${g.simulatedOffset}-${(g.simulatedOffset + g.simulatedGreen) % r.simulatedCycleLength}`;
    };

    it('le cycle passe à 56 s', () => {
        expect(r.simulatedCycleLength).toBe(56);
    });

    it('les verts chevauchants commencent 10 s plus tard et finissent 10 s plus tard', () => {
        expect(finDeVert(2)).toBe('55-18');
        expect(finDeVert(3)).toBe('55-15');
        expect(finDeVert(4)).toBe('54-16');
        expect(finDeVert(8)).toBe('54-19');
        expect(finDeVert(12)).toBe('54-16');
    });

    it('un vert qui ne couvre pas 5 s est seulement décalé', () => {
        expect(finDeVert(1)).toBe('25-50');
        expect(finDeVert(7)).toBe('1-20');
    });
});

describe('Simulation — escamotage de phase qui chevauche la fin du cycle', () => {
    // Plan PF1_120 (cycle 120) : escamotage de phase GF6 de 102 à 8 s, soit
    // 18 s en fin de cycle et 8 s au début du suivant.
    const pf1 = exemple.pfTabs.find(pf => pf.name === 'PF1_120');
    const groupesPf1 = exemple.groups.map(g => {
        const ligne = pf1.diagram.find(d => d.groupId === g.id);
        return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
    });
    const ESCAMOTAGE_GF6 = 13;
    const ADAPTATIFS = [8, 9, 10];  // 38-46, 73-76, 11-16, sans plage
    const simulerPf1 = coches => calculateSimulatedDiagram(groupesPf1, pf1.data, coches, pf1.cycleLength, pf1.conflictMatrix);

    it('seul, il retire 26 s au cycle', () => {
        const r = simulerPf1([ESCAMOTAGE_GF6]);
        expect(r.simulatedCycleLength).toBe(94);
        expect(vert(r, 4)).toBe('escamoté');   // 102-121, entièrement dans la zone
        expect(vert(r, 6)).toBe('escamoté');
        expect(vert(r, 7)).toBe('escamoté');
        expect(vert(r, 5)).toBe('0-45');        // 102-173 : reste 8-53
        expect(vert(r, 8)).toBe('0-12');        // 0-20 : reste 8-20
        expect(vert(r, 1)).toBe('2-51');        // 10-59, reculé de 8 s
    });

    it('après les adaptatifs, il se lit dans le cycle déjà réduit', () => {
        const r = simulerPf1([...ADAPTATIFS, ESCAMOTAGE_GF6]);
        expect(r.simulatedCycleLength).toBe(78);
        expect(vert(r, 5)).toBe('0-32');
        expect(vert(r, 8)).toBe('0-7');
    });
});

describe('Simulation — adaptatif vertical qui chevauche la fin du cycle', () => {
    // Plan PF1_120 (cycle 120), adaptatif GF8 déplacé de 11-16 s à 115-5 s :
    // 5 s en fin de cycle, 5 s au début du suivant.
    const pf1 = exemple.pfTabs.find(pf => pf.name === 'PF1_120');
    const groupesPf1 = exemple.groups.map(g => {
        const ligne = pf1.diagram.find(d => d.groupId === g.id);
        return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
    });
    const ADAPTATIF_GF8 = 10;
    const avec = (modif) => pf1.data.map(a => (a.id === ADAPTATIF_GF8 ? { ...a, deb: '115', fin: '5', ...modif } : a));
    const simulerAv = (actions) => calculateSimulatedDiagram(groupesPf1, actions, [ADAPTATIF_GF8], pf1.cycleLength, pf1.conflictMatrix);

    it('sans plage : 10 s retirées au cycle, de part et d\'autre de sa fin', () => {
        const r = simulerAv(avec({}));
        expect(r.simulatedCycleLength).toBe(110);
        expect(vert(r, 4)).toBe('97-110');      // 102-121 : perd 115-120 et 0-1
        expect(vert(r, 8)).toBe('0-15');        // 0-20 : perd 0-5
        expect(vert(r, 1)).toBe('5-54');        // 10-59, reculé de 5 s
    });

    it('avec plage : seules les lignes de la plage sont coupées, le cycle ne change pas', () => {
        const r = simulerAv(avec({ plage1: '8', plage2: '13' }));
        expect(r.simulatedCycleLength).toBe(120);
        expect(vert(r, 8)).toBe('0-15');        // dans la plage
        expect(vert(r, 4)).toBe('102-121');     // hors plage : inchangé
    });
});
