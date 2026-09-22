import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';
import { buildDiagramFromGroups } from '../utils/pfHelpers';

/**
 * Chaque plan de feu garde SA durée de cycle.
 *
 * Le diagramme affiché et le plan de feu actif sont deux états distincts, tenus
 * d'accord par deux effets miroirs : l'un recopie les groupes et le cycle vers
 * l'onglet actif, l'autre réinstalle l'onglet dans les groupes quand on en
 * change. Le premier reconnaît un changement d'onglet en comparant
 * l'identifiant courant à un repère — et c'est ce repère qui a menti.
 *
 * Trois chemins réinstallent l'état d'un bloc sans passer par un clic d'onglet :
 * l'ouverture d'un projet du cache, l'annulation, le rétablissement. Le repère
 * y restait sur le plan précédent, si bien que la recopie croyait quitter un
 * onglet et écrivait dans CELUI-LÀ le diagramme et le cycle de celui qu'on
 * venait d'ouvrir ou de restaurer. Un plan de feu se retrouvait avec le cycle
 * d'un autre — celui visité avant — sans le moindre avertissement, et la
 * sauvegarde automatique enregistrait la valeur fausse deux secondes plus tard.
 *
 * Ces tests parcourent les trois chemins et vérifient la même chose à chaque
 * fois : aucun plan de feu autre que celui qu'on modifie ne change de cycle.
 */

beforeEach(() => { localStorage.clear(); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));

/** Les cycles de tous les plans, dans l'ordre des onglets. */
const cycles = (resultat) => resultat.current.pfTabs.map(pf => pf.cycleLength);

/** Un projet à trois plans de feu, cycles distincts, tous avec un diagramme. */
const projetTroisPlans = (groupes, matrice, actif) => {
    const diagramme = () => JSON.parse(JSON.stringify(buildDiagramFromGroups(groupes)));
    return {
        projectName: 'essai',
        intersectionName: 'Carrefour témoin',
        groups: groupes,
        // Le cycle du projet est celui du plan actif, comme à l'enregistrement.
        cycleLength: { 1: 120, 2: 90, 3: 80 }[actif],
        conflictMatrix: matrice,
        pfTabs: [
            { id: 1, name: 'PF1', data: [], diagram: diagramme(), cycleLength: 120, remarques: '' },
            { id: 2, name: 'PF2', data: [], diagram: diagramme(), cycleLength: 90, remarques: '' },
            { id: 3, name: 'PF3', data: [], diagram: diagramme(), cycleLength: 80, remarques: '' }
        ],
        activePFId: actif
    };
};

/** Un crochet monté et sorti de son verrou de chargement initial. */
const monter = async () => {
    const { result } = renderHook(() => useTrafficLight());
    await act(async () => { await pause(2200); });
    return result;
};

describe('Cycle par plan de feu — la bascule ordinaire', () => {
    it('chaque onglet retrouve son cycle, sans toucher aux autres', async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetTroisPlans(
                result.current.groups, result.current.conflictMatrix, 1));
        });
        await act(async () => { await pause(200); });

        for (const [id, attendu] of [[2, 90], [3, 80], [1, 120], [2, 90]]) {
            await act(async () => { result.current.setActivePFId(id); });
            await act(async () => { await pause(150); });
            expect(result.current.cycleLength, 'PF' + id + ' devrait afficher ' + attendu + ' s').toBe(attendu);
            expect(cycles(result), 'la bascule vers PF' + id + ' a modifié un autre plan').toEqual([120, 90, 80]);
        }
    });

    it('le cycle modifié est écrit dans le plan actif, et nulle part ailleurs', async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetTroisPlans(
                result.current.groups, result.current.conflictMatrix, 2));
        });
        await act(async () => { await pause(200); });

        await act(async () => { result.current.setCycleLength(111); });
        await act(async () => { await pause(200); });
        expect(cycles(result)).toEqual([120, 111, 80]);

        // Et il survit à un aller-retour par un autre onglet.
        await act(async () => { result.current.setActivePFId(3); });
        await act(async () => { await pause(150); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(150); });
        expect(result.current.cycleLength).toBe(111);
        expect(cycles(result)).toEqual([120, 111, 80]);
    });
});

describe("Cycle par plan de feu — l'ouverture d'un projet du cache", () => {
    it("n'écrase pas le cycle du plan actif avant l'ouverture", async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetTroisPlans(result.current.groups, result.current.conflictMatrix, 3)));

        // L'application vient de démarrer sur PF1 ; le projet ouvert désigne PF3.
        // C'est PF1 qui recevait le cycle de PF3.
        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(400); });

        expect(result.current.activePFId).toBe(3);
        expect(result.current.cycleLength).toBe(80);
        expect(cycles(result), 'un plan de feu a hérité du cycle du plan actif').toEqual([120, 90, 80]);
    });

    it('le diagramme des autres plans reste le leur', async () => {
        const result = await monter();
        const projet = projetTroisPlans(result.current.groups, result.current.conflictMatrix, 3);
        // PF1 tient un diagramme reconnaissable : son premier groupe démarre à 42 s.
        projet.pfTabs[0].diagram[0].offset = 42;
        localStorage.setItem('traffic_project_essai', JSON.stringify(projet));

        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(400); });

        const pf1 = result.current.pfTabs.find(pf => pf.id === 1);
        expect(pf1.diagram[0].offset, 'le diagramme de PF1 a été remplacé par celui du plan actif').toBe(42);
    });
});

describe("Cycle par plan de feu — l'annulation et le rétablissement", () => {
    it("annuler ne recopie pas le cycle restauré dans l'onglet quitté", async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetTroisPlans(
                result.current.groups, result.current.conflictMatrix, 1));
        });
        await act(async () => { await pause(200); });

        // Une modification sur PF1, puis on passe sur PF2 : l'annulation ramène
        // à la fois le cycle de PF1 et PF1 lui-même.
        await act(async () => { result.current.setCycleLength(130); });
        await act(async () => { await pause(150); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(150); });
        expect(cycles(result)).toEqual([130, 90, 80]);

        await act(async () => { result.current.undo(); });
        await act(async () => { await pause(300); });

        expect(result.current.activePFId).toBe(1);
        expect(result.current.cycleLength).toBe(120);
        expect(cycles(result), "PF2 a hérité du cycle restauré de PF1").toEqual([120, 90, 80]);
    });

    it('rétablir ne le fait pas davantage', async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetTroisPlans(
                result.current.groups, result.current.conflictMatrix, 1));
        });
        await act(async () => { await pause(200); });

        await act(async () => { result.current.setCycleLength(130); });
        await act(async () => { await pause(150); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(150); });
        await act(async () => { result.current.undo(); });
        await act(async () => { await pause(300); });
        await act(async () => { result.current.redo(); });
        await act(async () => { await pause(300); });

        expect(cycles(result), 'un plan de feu a changé de cycle au rétablissement')
            .toEqual([130, 90, 80]);
    });
});
