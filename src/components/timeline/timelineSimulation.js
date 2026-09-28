const normalizeToCycle = (value, cycle) => ((value % cycle) + cycle) % cycle;

export const createTimelineSimulation = ({ groups, cycleLength, simulationResult }) => {
    const effectiveCycleLength = simulationResult?.simulatedCycleLength || cycleLength;

    const getSimulatedGroup = (groupId) => {
        if (!simulationResult) return null;
        return simulationResult.simulatedGroups.find(group => group.id === groupId) || null;
    };

    const getGroupShift = (groupId) => {
        if (!simulationResult) return 0;
        const originalGroup = groups.find(group => group.id === parseInt(groupId));
        const simulatedGroup = simulationResult.simulatedGroups.find(group => group.id === parseInt(groupId));
        if (!originalGroup || !simulatedGroup) return 0;

        const cycle = simulationResult.simulatedCycleLength || cycleLength;
        const shift = normalizeToCycle(originalGroup.offset - simulatedGroup.simulatedOffset, cycle);
        return shift > cycle / 2 ? 0 : shift;
    };

    const getGroupEndShift = (groupId) => {
        if (!simulationResult) return 0;
        const originalGroup = groups.find(group => group.id === parseInt(groupId));
        const simulatedGroup = simulationResult.simulatedGroups.find(group => group.id === parseInt(groupId));
        if (!originalGroup || !simulatedGroup) return 0;

        const cycle = simulationResult.simulatedCycleLength || cycleLength;
        const originalEnd = (originalGroup.offset + originalGroup.durations.green) % cycleLength;
        const simulatedEnd = (simulatedGroup.simulatedOffset + simulatedGroup.simulatedGreen) % cycle;
        const shift = normalizeToCycle(originalEnd - simulatedEnd, cycle);
        return shift > cycle / 2 ? 0 : shift;
    };

    const getShiftedActionPosition = (
        deb,
        fin,
        groupId = null,
        actionType = null,
        actionPlage = null,
        actionId = null
    ) => {
        let hidden = false;
        let totalShift = 0;
        let adjustedDeb = deb;
        let adjustedFin = fin;
        let fullShiftOnDeb = 0;
        let fullShiftOnFin = 0;
        const isAvOrEscamotage = actionType === 'Escamotage de phase' || actionType === 'Adaptatif vertical';

        if (simulationResult?.timeShifts?.length) {
            simulationResult.timeShifts.forEach(shift => {
                if (shift.amount <= 0 || (shift.isPartial && !isAvOrEscamotage)) return;
                if (isAvOrEscamotage && actionId && shift.actionId === actionId) return;

                const zoneStart = shift.from - shift.amount;
                const zoneEnd = shift.from;
                const zoneWidth = shift.amount;

                if (!isAvOrEscamotage) {
                    const debInside = adjustedDeb >= zoneStart && adjustedDeb < zoneEnd;
                    const finInside = adjustedFin > zoneStart && adjustedFin <= zoneEnd;

                    if (debInside && finInside) {
                        hidden = true;
                    } else if (debInside) {
                        adjustedDeb = zoneStart;
                    } else if (finInside) {
                        adjustedFin = zoneStart;
                    }
                }

                if (adjustedDeb >= zoneEnd) {
                    adjustedDeb -= zoneWidth;
                    fullShiftOnDeb += zoneWidth;
                }
                if (adjustedFin >= zoneEnd) {
                    adjustedFin -= zoneWidth;
                    fullShiftOnFin += zoneWidth;
                }
            });
        }

        let restShiftDeb = 0;
        let restShiftFin = 0;
        simulationResult?.restPoints?.forEach(restPoint => {
            if (deb >= restPoint.originalDeb) restShiftDeb += restPoint.duration;
            if (fin >= restPoint.originalDeb) restShiftFin += restPoint.duration;
        });

        if (
            simulationResult?.removedPeriods?.length &&
            actionType !== 'Escamotage de phase' &&
            actionType !== 'Priorité piétons' &&
            actionType !== "Flèche d'anticipation" &&
            actionType !== 'Signal aide conduite'
        ) {
            for (const period of simulationResult.removedPeriods) {
                if (actionType === 'Adaptatif vertical' && period.source !== 'Escamotage de phase') continue;
                const debInPeriod = deb >= period.deb && deb < period.fin;
                const finInPeriod = fin > period.deb && fin <= period.fin;
                if (debInPeriod && finInPeriod) {
                    hidden = true;
                    break;
                }
            }
        }

        if (
            groupId &&
            simulationResult &&
            actionType !== 'Seconde lucarne' &&
            actionType !== 'Adaptatif vertical' &&
            actionType !== 'Escamotage de phase'
        ) {
            const originalGroup = groups.find(group => group.id === parseInt(groupId));
            let useEndShift = false;

            if (originalGroup && actionType === 'Fermeture anticipée') {
                const cycle = simulationResult.simulatedCycleLength || cycleLength;
                const greenStart = originalGroup.offset;
                const greenEnd = (originalGroup.offset + originalGroup.durations.green) % cycleLength;
                const actionMid = (adjustedDeb + ((adjustedFin > adjustedDeb ? adjustedFin - adjustedDeb : 0) / 2)) % cycle;
                const circularDistance = (a, b) => {
                    const distance = Math.abs(a - b);
                    return Math.min(distance, cycle - distance);
                };
                useEndShift = circularDistance(actionMid, greenEnd) < circularDistance(actionMid, greenStart);
            }

            const groupShift = useEndShift ? getGroupEndShift(groupId) : getGroupShift(groupId);
            if (groupShift > 0) {
                totalShift = Math.max(0, groupShift - (useEndShift ? fullShiftOnFin : fullShiftOnDeb));
            }
        } else if (simulationResult?.timeShifts?.length) {
            simulationResult.timeShifts.forEach(shift => {
                if (adjustedDeb < shift.from || !shift.isPartial) return;

                if (groupId) {
                    const parsedGroupId = parseInt(groupId);
                    if (parsedGroupId >= shift.plage1 && parsedGroupId <= shift.plage2) {
                        totalShift += shift.amount;
                    }
                } else if (
                    actionPlage &&
                    actionPlage.plage1 >= shift.plage1 &&
                    actionPlage.plage2 <= shift.plage2
                ) {
                    totalShift += shift.amount;
                }
            });
        }

        if (isAvOrEscamotage) {
            return {
                deb: adjustedDeb - totalShift + restShiftDeb,
                fin: adjustedFin - totalShift + restShiftFin,
                hidden
            };
        }

        const cycle = effectiveCycleLength || cycleLength;
        const shiftedDeb = normalizeToCycle(adjustedDeb - totalShift, cycle) + restShiftDeb;
        const finAfterShift = adjustedFin - totalShift;
        const shiftedFin = (fin === cycle ? finAfterShift : normalizeToCycle(finAfterShift, cycle)) + restShiftFin;

        return { deb: shiftedDeb, fin: shiftedFin, hidden };
    };

    return {
        effectiveCycleLength,
        getGroupEndShift,
        getGroupShift,
        getShiftedActionPosition,
        getSimulatedGroup
    };
};

