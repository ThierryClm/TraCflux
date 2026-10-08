import { describe, it, expect } from 'vitest';
import { relinkIntersection } from './greenWaveRelink';

const intersection = {
    id: 7,
    projectName: 'Car 26057_1 ancien',
    distance: 1372,
    distanceG2: 1340,
    cycleLength: 100,
    selectedPfId: 2,
    selectedGroup1: 1,
    selectedGroup2: 5,
    pfTabs: [{ id: 1, name: 'HC' }, { id: 2, name: 'HPM' }],
    groups: [{ id: 1, name: 'DOYANT nord TD' }, { id: 5, name: 'DOYANT sud' }]
};

describe('relinkIntersection', () => {
    it('conserve distances, plan de feux et groupes retrouvés', () => {
        const project = {
            cycleLength: 90,
            groups: [{ id: 1, name: 'DOYANT nord TD', offset: 0, durations: { green: 20 } }, { id: 5, name: 'DOYANT sud' }],
            pfTabs: [
                { id: 4, name: 'HPM', cycleLength: 100, data: [{ action: 'x' }], diagram: [{ groupId: 1, offset: 12, greenDuration: 30 }] },
                { id: 1, name: 'HC' }
            ]
        };
        const { intersection: updated, report } = relinkIntersection(intersection, 'Car 26057_1 v2', project);
        expect(updated).toMatchObject({
            id: 7, projectName: 'Car 26057_1 v2', distance: 1372, distanceG2: 1340,
            selectedPfId: 4, selectedGroup1: 1, selectedGroup2: 5, cycleLength: 100, actionData: [{ action: 'x' }]
        });
        expect(updated.groups[0]).toMatchObject({ offset: 12, durations: { green: 30 } });
        expect(report).toMatchObject({ pfKept: true, cycleBefore: 100, cycleAfter: 100 });
        expect(report.descending.match).toBe('same');
        expect(report.ascending.match).toBe('same');
    });

    it('retrouve un groupe renuméroté par son nom et signale ce qui manque', () => {
        const project = {
            cycleLength: 110,
            groups: [{ id: 3, name: 'DOYANT sud' }, { id: 1, name: 'Autre nom' }],
            pfTabs: [{ id: 1, name: 'PF1' }]
        };
        const { intersection: updated, report } = relinkIntersection(intersection, 'Nouveau', project);
        expect(updated.selectedGroup2).toBe(3);
        expect(report.ascending.match).toBe('byName');
        expect(updated.selectedGroup1).toBe(1);
        expect(report.descending.match).toBe('byId');
        expect(report.pfKept).toBe(false);
        expect(report.pfAfter).toBe('PF1');
        expect(updated.cycleLength).toBe(110);
    });

    it('choisit le premier groupe quand aucun ne correspond', () => {
        const project = { groups: [{ id: 9, name: 'Z' }] };
        const { intersection: updated, report } = relinkIntersection(intersection, 'X', project);
        expect(updated.selectedGroup1).toBe(9);
        expect(report.descending.match).toBe('missing');
        expect(updated.pfTabs).toEqual([{ id: 1, name: 'PF1', data: [] }]);
    });
});
