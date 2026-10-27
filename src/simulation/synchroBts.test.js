import { describe, expect, it } from 'vitest';
import { calculateSimulatedDiagram } from './calculSimulation';
import { recalerCurseur } from './curseur';

const groupes = [
    { id: 1, name: 'A', type: 'VL', offset: 0, minGreen: 6, durations: { green: 40, orange: 3, red: 47 } },
    { id: 2, name: 'B', type: 'VL', offset: 70, minGreen: 6, durations: { green: 10, orange: 3, red: 77 } },
];
const action = (id, type, deb, fin = '', extra = {}) => ({ id, action: type, gf: '', deb, fin, plage1: '', plage2: '', ...extra });
const av = (id, deb, fin, extra) => action(id, 'Adaptatif vertical', deb, fin, extra);
const bts = (id, deb) => action(id, 'Synchro BTS', deb);
const simuler = (actions, ids, option = true) => calculateSimulatedDiagram(groupes, actions, ids, 90, [], option);
const attentes = r => r.restPoints.filter(p => p.source === 'Synchro BTS');

describe('Compensation aux synchros BTS', () => {
    it('est inactive par défaut et ne nécessite pas de cocher la synchro', () => {
        const actions = [av(1, 10, 18), bts(2, 60)];
        expect(simuler(actions, [1], false).simulatedCycleLength).toBe(82);
        const r = simuler(actions, [1]);
        expect(r.simulatedCycleLength).toBe(90);
        expect(attentes(r)).toMatchObject([{ deb: 52, duration: 8, originalDeb: 60 }]);
        expect(r.simulatedGroups[1].simulatedOffset).toBe(70);
        expect(groupes[1].offset).toBe(70);
    });
    it('cumule les contractions sans compter deux fois leur chevauchement', () => {
        const r = simuler([av(1, 10, 18), action(2, 'Escamotage de phase', 15, 25), bts(3, 60)], [1, 2]);
        expect(r.simulatedCycleLength).toBe(90);
        expect(attentes(r)[0].duration).toBe(15);
    });
    it('ne compense chaque réduction qu’à la prochaine BTS, même en cas de doublon', () => {
        const r = simuler([bts(5, 80), av(1, 10, 18), bts(2, 40), bts(3, 40), av(4, 50, 55)], [1, 4]);
        expect(attentes(r).map(p => [p.deb, p.duration])).toEqual([[32, 8], [75, 5]]);
        expect(r.simulatedCycleLength).toBe(90);
    });
    it('ignore les adaptatifs partiels, les actions décochées et celles après la dernière BTS', () => {
        const r = simuler([av(1, 10, 18, { plage1: 1, plage2: 1 }), av(2, 20, 25), bts(3, 40), av(4, 60, 65)], [1, 4]);
        expect(attentes(r)).toHaveLength(0);
        expect(r.simulatedCycleLength).toBe(85);
    });
    it('préserve les points de repos explicites et recale le curseur', () => {
        const actions = [av(1, 10, 18), bts(2, 60), action(3, 'Point de repos', 30, '', { description: 'attente maxi 10 secondes' })];
        const sans = simuler(actions, [1, 3], false);
        const avec = simuler(actions, [1, 3]);
        expect(avec.simulatedCycleLength).toBe(100);
        expect(attentes(avec)).toMatchObject([{ deb: 62, duration: 8 }]);
        expect(recalerCurseur(72, sans.journal, avec.journal, 100)).toBe(80);
    });
    it('compense seulement la partie retirée avant une synchro située dans une zone', () => {
        const r = simuler([av(1, 10, 20), bts(2, 15), bts(3, 60)], [1]);
        expect(attentes(r).map(p => p.duration)).toEqual([5, 5]);
        expect(r.simulatedCycleLength).toBe(90);
    });
    it('ne produit aucune attente sans synchro valide', () => {
        const actions = [av(1, 10, 18), bts(2, ''), bts(3, 100), bts(4, -1)];
        expect(attentes(simuler(actions, [1]))).toHaveLength(0);
        expect(calculateSimulatedDiagram(groupes, [av(1, 10, 18), bts(2, 60)], [1], 90, []).simulatedCycleLength).toBe(82);
    });
    it('répartit une contraction chevauchant la fin du cycle entre les rendez-vous', () => {
        const r = simuler([av(1, 80, 5), bts(2, 60), bts(3, 90)], [1]);
        expect(attentes(r).map(p => p.duration)).toEqual([5, 10]);
        expect(r.simulatedCycleLength).toBe(90);
    });
    it('fige les verts qui traversent le repos et conserve les décalages après la synchro', () => {
        const longs = [{ ...groupes[0], durations: { ...groupes[0].durations, green: 80 } }, groupes[1]];
        const r = calculateSimulatedDiagram(longs, [av(1, 10, 18), bts(2, 60)], [1], 90, [], true);
        expect(r.simulatedGroups[0].simulatedGreen).toBe(80);
        expect(r.simulatedGroups[1].simulatedOffset).toBe(70);
        expect(longs[0].durations.green).toBe(80);
    });

});
