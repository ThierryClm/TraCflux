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

describe("Cycle par plan de feu — le plan actif fait foi à l'ouverture", () => {
    /**
     * Un projet enregistré porte DEUX durées de cycle : celle du projet — l'état
     * vivant au moment de l'enregistrement — et celle que chaque plan garde pour
     * lui. C'est le plan qui fait foi : c'est sa valeur que l'application
     * réinstalle à chaque changement d'onglet.
     *
     * À l'ouverture, on installait pourtant celle du projet. La recopie
     * « diagramme → plan actif » écrivait alors ce cycle-là DANS le plan actif et
     * effaçait le sien. Le désaccord ne se voyait pas tout de suite — l'écran
     * affichait encore la bonne valeur — mais le plan était abîmé dans le cache
     * comme dans le fichier, et la fois suivante il repartait avec le cycle d'un
     * autre, ses actions restant calées sur l'ancien : un escamotage de phase
     * débordait alors du cycle, seul signe visible.
     */
    const projetDivergent = (groupes, matrice) => {
        const diagramme = () => JSON.parse(JSON.stringify(buildDiagramFromGroups(groupes)));
        return {
            projectName: 'essai', intersectionName: 'Carrefour témoin',
            groups: groupes,
            cycleLength: 120,   // cycle du PROJET
            conflictMatrix: matrice,
            pfTabs: [
                { id: 1, name: 'PF1', data: [], diagram: diagramme(), cycleLength: 122, remarques: '' },
                { id: 2, name: 'PF2', data: [], diagram: diagramme(), cycleLength: 90, remarques: '' }
            ],
            activePFId: 1       // actif = celui à 122
        };
    };

    it("le cycle du plan actif n'est pas remplacé par celui du projet", async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetDivergent(result.current.groups, result.current.conflictMatrix)));

        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(500); });

        expect(result.current.cycleLength, "l'écran doit afficher le cycle du plan actif").toBe(122);
        expect(cycles(result), 'le plan actif a été réécrit avec le cycle du projet').toEqual([122, 90]);
    });

    it('et il survit à un aller-retour entre onglets', async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetDivergent(result.current.groups, result.current.conflictMatrix)));

        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(500); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(200); });
        await act(async () => { result.current.setActivePFId(1); });
        await act(async () => { await pause(200); });

        // C'est ici que le défaut se voyait : de retour sur le plan, on lisait
        // le cycle que l'ouverture y avait écrit, non le sien.
        expect(result.current.cycleLength).toBe(122);
        expect(cycles(result)).toEqual([122, 90]);
    });

    it("ce qui est réenregistré porte la même valeur des deux côtés", async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetDivergent(result.current.groups, result.current.conflictMatrix)));

        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(500); });

        const sauve = result.current.getFullState();
        const planActif = sauve.pfTabs.find(pf => pf.id === sauve.activePFId);
        expect(sauve.cycleLength, 'le projet et son plan actif doivent dire la même chose')
            .toBe(planActif.cycleLength);
        expect(sauve.cycleLength).toBe(122);
    });
});

describe("Cycle par plan de feu — changer d'onglet juste après l'ouverture", () => {
    /**
     * Le piège à retardement.
     *
     * L'ouverture d'un projet posait un rappel à trois secondes qui
     * réinstallait comme « plan courant », pour la recopie « diagramme → plan
     * actif », celui qui était actif AU CHARGEMENT. Changer d'onglet prend
     * moins de trois secondes : la recopie croyait alors être restée sur
     * l'ancien plan, et la première durée de cycle saisie partait dans CE
     * plan-là. Le plan qu'on avait sous les yeux gardait la sienne — il
     * semblait refuser la valeur — et un autre la recevait en silence.
     *
     * Les deux dégâts ne se voyaient qu'à la réouverture suivante, sous la
     * forme d'un cycle inattendu et d'actions qui débordent de leur cycle.
     */
    it("la durée saisie va dans le plan affiché, pas dans celui de l'ouverture", async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetTroisPlans(result.current.groups, result.current.conflictMatrix, 1)));

        await act(async () => { result.current.loadProject('essai'); });
        // Changement d'onglet AVANT que le rappel de trois secondes ne se déclenche.
        await act(async () => { await pause(300); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(300); });
        expect(result.current.cycleLength, 'PF2 doit afficher son propre cycle').toBe(90);

        // On laisse passer l'instant où le rappel se déclenchait.
        await act(async () => { await pause(3200); });
        await act(async () => { result.current.setCycleLength(122); });
        await act(async () => { await pause(300); });

        expect(result.current.cycleLength).toBe(122);
        expect(cycles(result), 'la valeur saisie sur PF2 est partie dans un autre plan')
            .toEqual([120, 122, 80]);
    }, 20000);

    it('et elle y reste après un aller-retour', async () => {
        const result = await monter();
        localStorage.setItem('traffic_project_essai', JSON.stringify(
            projetTroisPlans(result.current.groups, result.current.conflictMatrix, 1)));

        await act(async () => { result.current.loadProject('essai'); });
        await act(async () => { await pause(300); });
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(3200); });
        await act(async () => { result.current.setCycleLength(122); });
        await act(async () => { await pause(300); });

        await act(async () => { result.current.setActivePFId(1); });
        await act(async () => { await pause(250); });
        expect(result.current.cycleLength, 'PF1 a été contaminé').toBe(120);
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(250); });
        expect(result.current.cycleLength).toBe(122);
    }, 20000);
});
