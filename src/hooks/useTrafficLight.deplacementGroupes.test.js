import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

/**
 * Déplacer un groupe : ses données changent de place, les numéros GF restent.
 * La matrice, les conditions et les jeux de trafic suivent.
 */

const groupe = (id, name) => ({
    id, name, type: 'VL', courant: '', minGreen: 6, offset: id * 10,
    durations: { green: 8, orange: 3, red: 0 }, da: '', phaseFlag: '', comment: '', commentColor: ''
});

const condition = (id, gf, actGf1) => ({
    id, action: 'Fermeture anticipée', gf, actGf1, deb: '1', fin: '2',
    actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', plage1: '', plage2: '', abrv: '', description: '', micro: ''
});

const projet = () => {
    const matrice = [['', 5, 6], [7, '', ''], [8, '', '']];
    return {
        intersectionName: 'Test', cycleLength: 60,
        groups: [groupe(1, 'A'), groupe(2, 'B'), groupe(3, 'C')],
        conflictMatrix: matrice,
        pfTabs: [{
            id: 1, name: 'PF1', cycleLength: 60, remarques: '',
            data: [condition(1, '1', '2')],
            diagram: [1, 2, 3].map(id => ({ groupId: id, offset: id * 10, greenDuration: 8 })),
            conflictMatrix: matrice.map(r => [...r])
        }],
        activePFId: 1,
        trafficDatasets: { HPM: { 1: { trafficVol: 100 }, 2: { trafficVol: 200 }, 3: { trafficVol: 300 } } }
    };
};

beforeEach(() => localStorage.clear());

describe('useTrafficLight — déplacer un groupe', () => {
    it('vers le bas : données échangées, numéros gardés, matrice qui suit', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => { result.current.loadFullState(projet()); });
        act(() => { result.current.moveGroup(0, 'down'); });
        expect(result.current.groups.map(g => [g.id, g.name])).toEqual([[1, 'B'], [2, 'A'], [3, 'C']]);
        expect(result.current.conflictMatrix).toEqual([['', 7, ''], [5, '', 6], ['', 8, '']]);
    });

    // Défaut constaté sur master, à corriger à part : moveGroup permute les
    // numéros GF des conditions du plan actif deux fois (setActionData puis
    // la boucle sur tous les plans), ce qui les laisse inchangés. Le test des
    // conditions viendra avec la correction.

    it('à une autre position : jeux de trafic renumérotés avec leur groupe', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => { result.current.loadFullState(projet()); });
        act(() => { result.current.moveGroupToPosition(3, 0); });
        expect(result.current.groups.map(g => [g.id, g.name])).toEqual([[1, 'C'], [2, 'A'], [3, 'B']]);
        expect(result.current.trafficDatasets.HPM[1].trafficVol).toBe(300);
        expect(result.current.trafficDatasets.HPM[2].trafficVol).toBe(100);
        expect(result.current.actionData[0]).toMatchObject({ gf: '2', actGf1: '3' });
    });
});
