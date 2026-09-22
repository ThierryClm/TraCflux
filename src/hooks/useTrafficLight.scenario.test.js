import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';
import { buildDiagramFromGroups } from '../utils/pfHelpers';

/**
 * Le scénario de micro-régulation appartient au plan de feu.
 *
 * Un scénario, c'est un nom et une combinaison d'actions cochées : « escamotage
 * bus phase 1 », « priorité bus + ouverture anticipée ». Il vivait dans un état
 * de session, perdu à la fermeture — on rouvrait un projet avec ses actions
 * saisies, mais plus aucune trace de la combinaison retenue ni de ce qu'elle
 * démontrait.
 *
 * Il est désormais porté par le plan de feu, comme ses remarques ou son cycle,
 * et voyage donc avec le projet par les deux chemins d'enregistrement.
 *
 * Ces tests tiennent surtout la propriété qui a coûté cher ailleurs dans ce
 * fichier : ce qu'on écrit sur un plan ne doit pas se retrouver sur un autre.
 */

beforeEach(() => { localStorage.clear(); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));

const monter = async () => {
    const { result } = renderHook(() => useTrafficLight());
    await act(async () => { await pause(2200); });
    return result;
};

const projetDeuxPlans = (groupes, matrice) => {
    const diagramme = () => JSON.parse(JSON.stringify(buildDiagramFromGroups(groupes)));
    return {
        projectName: 'essai', intersectionName: 'Carrefour témoin',
        groups: groupes, cycleLength: 120, conflictMatrix: matrice,
        pfTabs: [
            { id: 1, name: 'PF1', data: [], diagram: diagramme(), cycleLength: 120, remarques: '' },
            { id: 2, name: 'PF2', data: [], diagram: diagramme(), cycleLength: 90, remarques: '' }
        ],
        activePFId: 1
    };
};

/** Le scénario du plan actif, tel que le crochet l'expose. */
const scenario = (r) => ({ nom: r.current.simulationName, actions: [...r.current.simulationSelectedActions] });

describe('Scénario de micro-régulation — il suit son plan de feu', () => {
    it("ce qu'on saisit sur un plan ne déborde pas sur l'autre", async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetDeuxPlans(
                result.current.groups, result.current.conflictMatrix));
        });
        await act(async () => { await pause(200); });

        await act(async () => { result.current.updateSimulationName('Escamotage bus phase 1'); });
        await act(async () => { result.current.toggleSimulationAction(11); });
        await act(async () => { result.current.toggleSimulationAction(12); });
        await act(async () => { await pause(200); });
        expect(scenario(result)).toEqual({ nom: 'Escamotage bus phase 1', actions: [11, 12] });

        // PF2 n'a pas de scénario : il ne doit pas hériter de celui de PF1.
        await act(async () => { result.current.setActivePFId(2); });
        await act(async () => { await pause(200); });
        expect(scenario(result), 'PF2 a hérité du scénario de PF1').toEqual({ nom: '', actions: [] });

        await act(async () => { result.current.updateSimulationName('Sans priorité'); });
        await act(async () => { await pause(200); });

        // Et de retour sur PF1, le sien est intact.
        await act(async () => { result.current.setActivePFId(1); });
        await act(async () => { await pause(200); });
        expect(scenario(result)).toEqual({ nom: 'Escamotage bus phase 1', actions: [11, 12] });
    }, 15000);

    it('décocher une action ne touche que le plan affiché', async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetDeuxPlans(
                result.current.groups, result.current.conflictMatrix));
        });
        await act(async () => { await pause(200); });

        await act(async () => { result.current.toggleSimulationAction(7); });
        await act(async () => { await pause(150); });
        await act(async () => { result.current.toggleSimulationAction(7); });
        await act(async () => { await pause(150); });
        expect(result.current.simulationSelectedActions).toEqual([]);

        const pf2 = result.current.pfTabs.find(pf => pf.id === 2);
        expect(pf2.simulationActions === undefined || pf2.simulationActions.length === 0).toBe(true);
    }, 15000);
});

describe('Scénario de micro-régulation — il survit à un enregistrement', () => {
    it("l'état canonique le porte, plan par plan", async () => {
        const result = await monter();
        await act(async () => {
            result.current.loadFullState(projetDeuxPlans(
                result.current.groups, result.current.conflictMatrix));
        });
        await act(async () => { await pause(200); });
        await act(async () => { result.current.updateSimulationName('Priorité bus'); });
        await act(async () => { result.current.toggleSimulationAction(3); });
        await act(async () => { await pause(200); });

        const sauve = JSON.parse(JSON.stringify(result.current.getFullState()));
        const pf1 = sauve.pfTabs.find(pf => pf.id === 1);
        expect(pf1.simulationName).toBe('Priorité bus');
        expect(pf1.simulationActions).toEqual([3]);
    }, 15000);

    it('et on le retrouve en rouvrant le projet depuis le cache', async () => {
        const premier = await monter();
        await act(async () => {
            premier.current.loadFullState(projetDeuxPlans(
                premier.current.groups, premier.current.conflictMatrix));
        });
        await act(async () => { await pause(200); });
        await act(async () => { premier.current.updateSimulationName('Priorité bus'); });
        await act(async () => { premier.current.toggleSimulationAction(3); });
        await act(async () => { await pause(200); });
        localStorage.setItem('traffic_project_essai',
            JSON.stringify(premier.current.getFullState()));

        const second = await monter();
        await act(async () => { second.current.loadProject('essai'); });
        await act(async () => { await pause(500); });

        expect(scenario(second), 'le scénario ne survit pas à la réouverture')
            .toEqual({ nom: 'Priorité bus', actions: [3] });
    }, 20000);
});
