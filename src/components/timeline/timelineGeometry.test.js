import { describe, expect, it } from 'vitest';
import { createTimelineGeometry, dashedPath } from './timelineGeometry';

const groups = [
    { id: 1, offset: 10, durations: { green: 20 } },
    { id: 2, offset: 55, durations: { green: 10 } }
];

const geometry = (props = {}) => createTimelineGeometry({
    cycleLength: 60,
    effectiveCycleLength: 60,
    groups,
    rowHeight: 30,
    rowTotalHeight: 31,
    rulerHeight: 50,
    simulationResult: null,
    ...props
});

describe('dashedPath', () => {
    it('retourne un chemin vide pour un segment nul', () => {
        expect(dashedPath(1, 1, 1, 1)).toBe('');
    });

    it('construit des tirets manuels alternés', () => {
        expect(dashedPath(0, 0, 20, 0, 5)).toBe('M0,0L5,0M10,0L15,0');
    });
});

describe('createTimelineGeometry', () => {
    it('calcule la position verticale au centre de chaque ligne', () => {
        expect(geometry().getGroupRowY(1)).toBe(66);
        expect(geometry().getGroupRowY(2)).toBe(97);
        expect(geometry().getGroupRowY(99)).toBeNull();
    });

    it('calcule les bornes nominales et conserve la fin exacte du cycle', () => {
        expect(geometry().getGroupStartPos(1)).toBe(10);
        expect(geometry().getGroupEndPos(1)).toBe(30);
        expect(geometry({ groups: [{ id: 1, offset: 40, durations: { green: 20 } }] }).getGroupEndPos(1)).toBe(60);
    });

    it('détecte le retour au début du cycle', () => {
        expect(geometry().doesGroupWrap(1)).toBe(false);
        expect(geometry().doesGroupWrap(2)).toBe(true);
        expect(geometry().doesGroupWrap(99)).toBe(false);
    });

    it('utilise les positions simulées quand elles existent', () => {
        const simulated = geometry({
            effectiveCycleLength: 70,
            simulationResult: {
                simulatedGroups: [{ id: 1, simulatedOffset: 65, simulatedGreen: 10 }]
            }
        });

        expect(simulated.getGroupStartPos(1)).toBe(65);
        expect(simulated.getGroupEndPos(1)).toBe(5);
        expect(simulated.doesGroupWrap(1)).toBe(true);
    });

    it('reprend la durée nominale si la simulation ne la remplace pas', () => {
        const simulated = geometry({
            effectiveCycleLength: 70,
            simulationResult: {
                simulatedGroups: [{ id: 1, simulatedOffset: 15 }]
            }
        });

        expect(simulated.getGroupEndPos(1)).toBe(35);
    });
});
