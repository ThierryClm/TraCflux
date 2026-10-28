import { describe, expect, it } from 'vitest';
import { calculateSimulatedDiagram } from './calculSimulation';

// Cas de Thierry (28/10) : l'adaptatif ou l'escamotage de phase coché avance
// le vert du GF8, mais sa plage d'escamotage restait au temps d'origine.
const groupes = [
    { id: 1, name: 'A', type: 'VL', offset: 0, minGreen: 6, durations: { green: 30, orange: 3, red: 57 } },
    { id: 2, name: 'B', type: 'VL', offset: 72, minGreen: 6, durations: { green: 8, orange: 3, red: 79 } },
];
const action = (id, type, deb, fin, extra = {}) => ({ id, action: type, gf: '', deb, fin, plage1: '', plage2: '', actGf1: '', ...extra });
const av = (id, deb, fin, extra) => action(id, 'Adaptatif vertical', deb, fin, extra);
const esc = (id, deb, fin) => action(id, 'Escamotage', deb, fin, { gf: '1', actGf1: '2' });
const simuler = (actions, ids) => calculateSimulatedDiagram(groupes, actions, ids, 90, []);
const groupe2 = r => r.simulatedGroups.find(g => g.id === 2);

describe('Escamotage de groupe et contractions', () => {
    it('la plage d’un escamotage coché suit le vert avancé par un adaptatif', () => {
        const r = simuler([av(1, 10, 18), esc(2, 72, 80)], [1, 2]);
        expect(groupe2(r).simulatedOffset).toBe(64);
        expect(groupe2(r).greenCuts).toEqual([{ deb: 64, fin: 72, coche: true }]);
    });
    it('sans contraction, la plage reste au temps saisi', () => {
        expect(groupe2(simuler([av(1, 10, 18), esc(2, 72, 80)], [2])).greenCuts).toEqual([{ deb: 72, fin: 80, coche: true }]);
    });
    it('escamotage non coché (hachures) : la plage suit aussi, y compris après un escamotage de phase', () => {
        const r = simuler([action(1, 'Escamotage de phase', 40, 50), esc(2, 72, 80)], [1]);
        // L'escamotage non coché hachure le groupe source, GF1 : sa plage est avancée de 10 s.
        expect(r.simulatedGroups.find(g => g.id === 1).greenCuts).toEqual([{ deb: 62, fin: 70 }]);
    });
    it('suit un point de repos placé avant elle', () => {
        const r = simuler([action(1, 'Point de repos', 20, '', { description: 'attente maxi 6 secondes' }), esc(2, 72, 80)], [1, 2]);
        expect(groupe2(r).greenCuts).toEqual([{ deb: 78, fin: 86, coche: true }]);
    });
    it('une plage entièrement retirée par une contraction disparaît', () => {
        const r = simuler([av(1, 70, 82), esc(2, 72, 80)], [1, 2]);
        expect(groupe2(r).greenCuts).toEqual([]);
    });
});
