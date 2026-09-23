export const dashedPath = (x1, y1, x2, y2, dashLength = 5) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return '';

    const unitX = dx / distance;
    const unitY = dy / distance;
    const segments = [];
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
}) => {
    const findGroup = (groupId) => groups.find((group) => group.id === parseInt(groupId));
    const findSimulatedGroup = (groupId) => simulationResult?.simulatedGroups.find(
        (group) => group.id === parseInt(groupId)
    );

    const getGroupTiming = (groupId) => {
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

    const getGroupRowY = (groupId) => {
        const groupIndex = groups.findIndex((group) => group.id === parseInt(groupId));
        if (groupIndex === -1) return null;
        return rulerHeight + 1 + groupIndex * rowTotalHeight + rowHeight / 2;
    };

    const getGroupStartPos = (groupId) => getGroupTiming(groupId)?.start ?? null;

    const getGroupEndPos = (groupId) => {
        const timing = getGroupTiming(groupId);
        if (!timing) return null;
        const end = timing.start + timing.greenDuration;
        return end === timing.cycle ? timing.cycle : end % timing.cycle;
    };

    const doesGroupWrap = (groupId) => {
        const timing = getGroupTiming(groupId);
        return timing ? timing.start + timing.greenDuration > timing.cycle : false;
    };

    return { dashedPath, doesGroupWrap, getGroupEndPos, getGroupRowY, getGroupStartPos };
};
