import type { Groupe } from '../../types/projet';
import type { SimulationResult } from '../../utils/simulationCalculator';

/** Identifiant de groupe, numérique ou tel que lu dans un champ de saisie. */
type GroupId = number | string;

interface GroupTiming {
    cycle: number;
    greenDuration: number;
    start: number;
}

export interface TimelineGeometryInput {
    cycleLength: number;
    effectiveCycleLength: number;
    groups: Groupe[];
    rowHeight: number;
    rowTotalHeight: number;
    rulerHeight: number;
    simulationResult: SimulationResult | null | undefined;
}

export const dashedPath = (x1: number, y1: number, x2: number, y2: number, dashLength = 5): string => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return '';

    const unitX = dx / distance;
    const unitY = dy / distance;
    const segments: string[] = [];
    let position = 0;
    let drawing = true;

    while (position < distance) {
        const segmentEnd = Math.min(position + dashLength, distance);
        if (drawing) {
            segments.push(`M${x1 + unitX * position},${y1 + unitY * position}L${x1 + unitX * segmentEnd},${y1 + unitY * segmentEnd}`);
        }
        position = segmentEnd;
        drawing = !drawing;
    }

    return segments.join('');
};

export const createTimelineGeometry = ({
    cycleLength,
    effectiveCycleLength,
    groups,
    rowHeight,
    rowTotalHeight,
    rulerHeight,
    simulationResult
}: TimelineGeometryInput) => {
    const findGroup = (groupId: GroupId) => groups.find((group) => group.id === parseInt(String(groupId)));
    const findSimulatedGroup = (groupId: GroupId) => simulationResult?.simulatedGroups.find(
        (group) => group.id === parseInt(String(groupId))
    );

    const getGroupTiming = (groupId: GroupId): GroupTiming | null => {
        const group = findGroup(groupId);
        if (!group) return null;

        const simulatedGroup = findSimulatedGroup(groupId);
        if (simulatedGroup) {
            return {
                cycle: effectiveCycleLength,
                greenDuration: simulatedGroup.simulatedGreen !== undefined
                    ? simulatedGroup.simulatedGreen
                    : (group.durations?.green || 0),
                start: simulatedGroup.simulatedOffset % effectiveCycleLength
            };
        }

        return {
            cycle: simulationResult ? effectiveCycleLength : cycleLength,
            greenDuration: group.durations?.green || 0,
            start: group.offset % cycleLength
        };
    };

    const getGroupRowY = (groupId: GroupId): number | null => {
        const groupIndex = groups.findIndex((group) => group.id === parseInt(String(groupId)));
        if (groupIndex === -1) return null;
        return rulerHeight + 1 + groupIndex * rowTotalHeight + rowHeight / 2;
    };

    const getGroupStartPos = (groupId: GroupId): number | null => getGroupTiming(groupId)?.start ?? null;

    const getGroupEndPos = (groupId: GroupId): number | null => {
        const timing = getGroupTiming(groupId);
        if (!timing) return null;
        const end = timing.start + timing.greenDuration;
        return end === timing.cycle ? timing.cycle : end % timing.cycle;
    };

    const doesGroupWrap = (groupId: GroupId): boolean => {
        const timing = getGroupTiming(groupId);
        return timing ? timing.start + timing.greenDuration > timing.cycle : false;
    };

    return { dashedPath, doesGroupWrap, getGroupEndPos, getGroupRowY, getGroupStartPos };
};
