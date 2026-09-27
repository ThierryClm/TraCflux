import { useCallback, useEffect, useMemo, useState } from 'react';

const normalizeToCycle = (value, cycleLength) => ((value % cycleLength) + cycleLength) % cycleLength;

const parseGroupId = (value) => parseInt(value?.toString().replace(/[Gg]/g, '').trim()) || 0;

const collectLinkedBandwidthActions = (actionData, groupId, actionType) => actionData
    .filter(action =>
        parseGroupId(action.gf) === groupId &&
        action.action === actionType &&
        action.deb !== ''
    )
    .map(action => ({
        id: action.id,
        initialDeb: parseInt(action.deb) || 0,
        initialFin: action.fin !== '' ? parseInt(action.fin) || 0 : null
    }));

const updateLinkedActions = (linkedActions, deltaSeconds, cycleLength, updateActionRow) => {
    if (!linkedActions?.length || !updateActionRow) return;

    linkedActions.forEach(action => {
        updateActionRow(action.id, 'deb', normalizeToCycle(action.initialDeb + deltaSeconds, cycleLength).toString());
        if (action.initialFin !== null) {
            updateActionRow(action.id, 'fin', normalizeToCycle(action.initialFin + deltaSeconds, cycleLength).toString());
        }
    });
};

export const calculateDragConflicts = ({ dragState, groups, conflictMatrix, cycleLength }) => {
    if (!dragState || dragState.deltaSeconds === undefined || dragState.deltaSeconds === 0) return null;
    if (!dragState.groupId) return null;

    const deltaSeconds = dragState.deltaSeconds;
    const draggedGroupId = dragState.groupId;

    const getVirtualOffset = (group) => {
        if (group.id !== draggedGroupId || dragState.type !== 'start') return group.offset % cycleLength;
        return normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);
    };

    const getVirtualGreen = (group) => {
        if (group.id !== draggedGroupId) return group.durations.green;

        if (dragState.type === 'start') {
            const newOffset = normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);
            const oldEnd = (dragState.initialValue + group.durations.green) % cycleLength;
            let duration = oldEnd - newOffset;
            if (duration <= 0) duration += cycleLength;
            return duration > 0 && duration <= cycleLength ? duration : group.durations.green;
        }

        if (dragState.type === 'end') {
            const newEnd = normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);
            const offset = group.offset % cycleLength;
            let duration = newEnd - offset;
            if (duration <= 0) duration += cycleLength;
            return duration > 0 && duration <= cycleLength ? duration : group.durations.green;
        }

        return group.durations.green;
    };

    const conflicts = [];
    for (let from = 0; from < groups.length; from++) {
        if (!conflictMatrix[from]) continue;

        for (let to = 0; to < groups.length; to++) {
            const minGap = conflictMatrix[from][to];
            if (minGap === '' || minGap === undefined || minGap === null || from === to) continue;

            const fromGroup = groups[from];
            const toGroup = groups[to];
            const end = (getVirtualOffset(fromGroup) + getVirtualGreen(fromGroup)) % cycleLength;
            const start = getVirtualOffset(toGroup);
            const distance = (start - end + cycleLength) % cycleLength;

            if (distance < minGap) {
                conflicts.push({
                    from: fromGroup.id,
                    to: toGroup.id,
                    required: minGap,
                    actual: distance,
                    type: 'intergreen'
                });
            }
        }
    }

    return conflicts;
};

export const useTimelineDrag = ({
    actionData,
    conflictMatrix,
    conflicts,
    cycleLength,
    endDrag,
    groups,
    onDragConflicts,
    pixelsPerSecond,
    readOnly,
    startDrag,
    updateActionRow,
    updateGroupParams
}) => {
    const [dragState, setDragState] = useState(null);

    const handleStartChange = useCallback((id, value) => {
        const group = groups.find(candidate => candidate.id === id);
        if (!group) return;

        const newStart = parseInt(value) || 0;
        const oldStart = group.offset % cycleLength;
        const oldEnd = (oldStart + group.durations.green) % cycleLength;
        let newDuration = oldEnd - newStart;
        if (newDuration <= 0) newDuration += cycleLength;

        updateGroupParams(id, {
            offset: newStart,
            durations: { green: Math.max(1, newDuration) }
        });
    }, [cycleLength, groups, updateGroupParams]);

    const handleEndChange = useCallback((id, endValue, startValue) => {
        let duration = (parseInt(endValue) || 0) - startValue;
        if (duration < 0) duration += cycleLength;
        updateGroupParams(id, { durations: { green: Math.max(0, duration) } });
    }, [cycleLength, updateGroupParams]);

    const handleDragStart = useCallback((event, groupId, type, currentValue) => {
        if (readOnly) return;
        event.stopPropagation();
        event.preventDefault();
        startDrag?.();

        setDragState({
            groupId,
            type,
            initialMouseX: event.clientX,
            initialValue: currentValue,
            linkedDebutBandeActions: type === 'start'
                ? collectLinkedBandwidthActions(actionData, groupId, 'Début de bande passante')
                : [],
            linkedFinBandeActions: type === 'end'
                ? collectLinkedBandwidthActions(actionData, groupId, 'Fin de bande passante')
                : []
        });
    }, [actionData, readOnly, startDrag]);

    const handleActionDragStart = useCallback((event, actionId, field, currentValue) => {
        if (readOnly) return;
        event.stopPropagation();
        event.preventDefault();
        startDrag?.();

        const action = actionData.find(candidate => candidate.id === actionId);
        const dragsWholeBandwidth = action &&
            (action.action === 'Début de bande passante' || action.action === 'Fin de bande passante') &&
            field === 'deb' &&
            action.fin !== '';
        const tooltipActions = ['Point de repos', 'Synchro BTS', 'Instant CO'];

        setDragState({
            actionId,
            field,
            initialMouseX: event.clientX,
            initialValue: parseInt(currentValue) || 0,
            initialFinValue: dragsWholeBandwidth ? parseInt(action.fin) || 0 : null,
            showTooltip: Boolean(action && tooltipActions.includes(action.action))
        });
    }, [actionData, readOnly, startDrag]);

    const handleDragMove = useCallback((event) => {
        if (!dragState) return;
        const deltaSeconds = Math.round((event.clientX - dragState.initialMouseX) / pixelsPerSecond);

        if (dragState.actionId !== undefined && updateActionRow) {
            const newValue = normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);

            if (dragState.initialFinValue !== null && dragState.initialFinValue !== undefined) {
                const newFin = normalizeToCycle(dragState.initialFinValue + deltaSeconds, cycleLength);
                updateActionRow(dragState.actionId, 'deb', newValue.toString());
                updateActionRow(dragState.actionId, 'fin', newFin.toString());
            } else {
                updateActionRow(dragState.actionId, dragState.field, newValue.toString());
            }

            setDragState(previous => previous ? {
                ...previous,
                deltaSeconds,
                mouseX: event.clientX,
                mouseY: event.clientY,
                currentValue: newValue
            } : null);
            return;
        }

        setDragState(previous => previous ? {
            ...previous,
            deltaSeconds,
            mouseX: event.clientX,
            mouseY: event.clientY
        } : null);
    }, [cycleLength, dragState, pixelsPerSecond, updateActionRow]);

    const handleDragEnd = useCallback(() => {
        if (dragState?.deltaSeconds !== undefined && dragState.deltaSeconds !== 0) {
            const deltaSeconds = dragState.deltaSeconds;

            if (dragState.actionId === undefined && dragState.type === 'start') {
                const newOffset = normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);
                const group = groups.find(candidate => candidate.id === dragState.groupId);

                if (group) {
                    const oldEnd = (dragState.initialValue + group.durations.green) % cycleLength;
                    let newDuration = oldEnd - newOffset;
                    if (newDuration <= 0) newDuration += cycleLength;

                    if (newDuration > 0 && newDuration <= cycleLength) {
                        updateGroupParams(dragState.groupId, {
                            offset: newOffset,
                            durations: { green: newDuration }
                        });
                        updateLinkedActions(
                            dragState.linkedDebutBandeActions,
                            deltaSeconds,
                            cycleLength,
                            updateActionRow
                        );
                    }
                }
            } else if (dragState.actionId === undefined && dragState.type === 'end') {
                const group = groups.find(candidate => candidate.id === dragState.groupId);

                if (group) {
                    const offset = group.offset % cycleLength;
                    const newEnd = normalizeToCycle(dragState.initialValue + deltaSeconds, cycleLength);
                    let newDuration = newEnd - offset;
                    if (newDuration <= 0) newDuration += cycleLength;

                    if (newDuration > 0 && newDuration <= cycleLength) {
                        updateGroupParams(dragState.groupId, { durations: { green: newDuration } });
                        updateLinkedActions(
                            dragState.linkedFinBandeActions,
                            deltaSeconds,
                            cycleLength,
                            updateActionRow
                        );
                    }
                }
            }
        }

        endDrag?.();
        setDragState(null);
    }, [cycleLength, dragState, endDrag, groups, updateActionRow, updateGroupParams]);

    useEffect(() => {
        if (!dragState) return undefined;

        const handleMouseMove = event => handleDragMove(event);
        const handleMouseUp = () => handleDragEnd();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, handleDragEnd, handleDragMove]);

    const dragConflicts = useMemo(() => calculateDragConflicts({
        dragState,
        groups,
        conflictMatrix,
        cycleLength
    }), [conflictMatrix, cycleLength, dragState, groups]);

    useEffect(() => {
        onDragConflicts?.(dragConflicts);
    }, [dragConflicts, onDragConflicts]);

    return {
        activeConflicts: dragConflicts || conflicts,
        dragState,
        handleActionDragStart,
        handleDragStart,
        handleEndChange,
        handleStartChange
    };
};

