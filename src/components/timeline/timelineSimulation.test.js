import { describe, expect, it } from 'vitest';
import { createTimelineSimulation } from './timelineSimulation';

const groups = [
    { id: 1, offset: 20, durations: { green: 30 } },
    { id: 2, offset: 70, durations: { green: 10 } }
];

const createModel = (simulationResult) => createTimelineSimulation({
    groups,
    cycleLength: 100,
    simulationResult
});

describe('createTimelineSimulation', () => {
    it('conserve les positions sans résultat de simulation', () => {
        const model = createModel(null);

        expect(model.effectiveCycleLength).toBe(100);
        expect(model.getSimulatedGroup(1)).toBeNull();
        expect(model.getShiftedActionPosition(15, 25, 1)).toEqual({ deb: 15, fin: 25, hidden: false });
    });

    it('calcule les décalages de début et de fin des groupes', () => {
        const model = createModel({
            simulatedCycleLength: 100,
            simulatedGroups: [
                { id: 1, simulatedOffset: 15, simulatedGreen: 25 },
                { id: 2, simulatedOffset: 75, simulatedGreen: 10 }
            ]
        });

        expect(model.getGroupShift(1)).toBe(5);
        expect(model.getGroupEndShift(1)).toBe(10);
        expect(model.getGroupShift(2)).toBe(0);
    });

    it('masque une action entièrement comprise dans une contraction', () => {
        const model = createModel({
            simulatedCycleLength: 95,
            simulatedGroups: groups.map(group => ({
                id: group.id,
                simulatedOffset: group.offset,
                simulatedGreen: group.durations.green
            })),
            timeShifts: [{ from: 30, amount: 5, isPartial: false }]
        });

        expect(model.getShiftedActionPosition(26, 29)).toEqual({ deb: 26, fin: 29, hidden: true });
        expect(model.getShiftedActionPosition(35, 45)).toEqual({ deb: 30, fin: 40, hidden: false });
    });

    it('applique les points de repos après les contractions', () => {
        const model = createModel({
            simulatedCycleLength: 105,
            simulatedGroups: groups.map(group => ({
                id: group.id,
                simulatedOffset: group.offset,
                simulatedGreen: group.durations.green
            })),
            restPoints: [{ originalDeb: 40, duration: 5 }]
        });

        expect(model.getShiftedActionPosition(45, 60)).toEqual({ deb: 50, fin: 65, hidden: false });
    });

    it('préserve les actions de micro-régulation dans les périodes supprimées', () => {
        const model = createModel({
            simulatedCycleLength: 100,
            simulatedGroups: groups.map(group => ({
                id: group.id,
                simulatedOffset: group.offset,
                simulatedGreen: group.durations.green
            })),
            removedPeriods: [{ deb: 20, fin: 40, source: 'Escamotage de phase' }]
        });

        expect(model.getShiftedActionPosition(25, 30, null, 'Seconde lucarne').hidden).toBe(true);
        expect(model.getShiftedActionPosition(25, 30, 1, 'Priorité piétons').hidden).toBe(false);
        expect(model.getShiftedActionPosition(25, 30, 1, "Flèche d'anticipation").hidden).toBe(false);
    });

    it('ne décale pas une action par sa propre contraction', () => {
        const model = createModel({
            simulatedCycleLength: 95,
            simulatedGroups: groups.map(group => ({
                id: group.id,
                simulatedOffset: group.offset,
                simulatedGreen: group.durations.green
            })),
            timeShifts: [{ actionId: 9, from: 30, amount: 5, isPartial: false }]
        });

        expect(model.getShiftedActionPosition(25, 30, null, 'Adaptatif vertical', null, 9))
            .toEqual({ deb: 25, fin: 30, hidden: false });
    });

    // Plan ACTUEL du projet exemple : GF4 vert de 0 à 28 s, Fermeture
    // anticipée 16-28 s, Escamotage de phase 20-32 s coché (cycle 70 → 58 s).
    describe("Fermeture anticipée coupée par un escamotage de phase", () => {
        const gf4 = [{ id: 4, offset: 0, durations: { green: 28 } }];
        const model = createTimelineSimulation({
            groups: gf4,
            cycleLength: 70,
            simulationResult: {
                simulatedCycleLength: 58,
                simulatedGroups: [{ id: 4, simulatedOffset: 0, simulatedGreen: 20 }],
                timeShifts: [{ from: 32, amount: 12, isPartial: false }]
            }
        });

        it('garde son début et finit là où commence la contraction', () => {
            expect(model.getShiftedActionPosition(16, 28, 4, 'Fermeture anticipée'))
                .toEqual({ deb: 16, fin: 20, hidden: false });
        });

        it('fait de même quand elle finit avant la fin de vert', () => {
            expect(model.getShiftedActionPosition(16, 26, 4, 'Fermeture anticipée'))
                .toEqual({ deb: 16, fin: 20, hidden: false });
        });

        it('reste masquée si elle est entièrement dans la contraction', () => {
            expect(model.getShiftedActionPosition(22, 28, 4, 'Fermeture anticipée').hidden).toBe(true);
        });
    });
});
