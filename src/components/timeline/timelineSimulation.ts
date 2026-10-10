import type { Groupe } from '../../types/projet';
import type { SimulatedGroup, SimulationResult } from '../../utils/simulationCalculator';

/** Identifiant de groupe, numérique ou tel que lu dans un champ de saisie. */
type GroupId = number | string;

/** Plage de groupes visée par une action « Adaptatif vertical ». */
export interface ActionPlage {
    plage1: number;
    plage2: number;
}

export interface ShiftedActionPosition {
    deb: number;
    fin: number;
    hidden: boolean;
}

export interface TimelineSimulationInput {
    groups: Groupe[];
    cycleLength: number;
    simulationResult: SimulationResult | null | undefined;
}

const normalizeToCycle = (value: number, cycle: number): number => ((value % cycle) + cycle) % cycle;

export const createTimelineSimulation = ({ groups, cycleLength, simulationResult }: TimelineSimulationInput) => {
    const effectiveCycleLength = simulationResult?.simulatedCycleLength || cycleLength;

    const getSimulatedGroup = (groupId: number): SimulatedGroup | null => {
        if (!simulationResult) return null;
        return simulationResult.simulatedGroups.find(group => group.id === groupId) || null;
    };

    const getGroupShift = (groupId: GroupId): number => {
        if (!simulationResult) return 0;
        const originalGroup = groups.find(group => group.id === parseInt(String(groupId)));
        const simulatedGroup = simulationResult.simulatedGroups.find(group => group.id === parseInt(String(groupId)));
        if (!originalGroup || !simulatedGroup) return 0;

        const cycle = simulationResult.simulatedCycleLength || cycleLength;
        const shift = normalizeToCycle(originalGroup.offset - simulatedGroup.simulatedOffset, cycle);
        return shift > cycle / 2 ? 0 : shift;
    };

    const getGroupEndShift = (groupId: GroupId): number => {
        if (!simulationResult) return 0;
        const originalGroup = groups.find(group => group.id === parseInt(String(groupId)));
        const simulatedGroup = simulationResult.simulatedGroups.find(group => group.id === parseInt(String(groupId)));
        if (!originalGroup || !simulatedGroup) return 0;

        const cycle = simulationResult.simulatedCycleLength || cycleLength;
        const originalEnd = (originalGroup.offset + originalGroup.durations.green) % cycleLength;
        const simulatedEnd = (simulatedGroup.simulatedOffset + simulatedGroup.simulatedGreen) % cycle;
        const shift = normalizeToCycle(originalEnd - simulatedEnd, cycle);
        return shift > cycle / 2 ? 0 : shift;
    };

    const getShiftedActionPosition = (
        deb: number,
        fin: number,
        groupId: GroupId | null = null,
        actionType: string | null = null,
        actionPlage: ActionPlage | null = null,
        actionId: number | null = null
    ): ShiftedActionPosition => {
        let hidden = false;
        let totalShift = 0;
        let adjustedDeb = deb;
        let adjustedFin = fin;
        let fullShiftOnDeb = 0;
        let fullShiftOnFin = 0;
        // Recul de la fin de vert du groupe dû aux contractions qui coupent
        // aussi la fin de l'action. Cette coupure est déjà appliquée à la fin
        // de l'action (ramenée au début de la contraction) : la reporter une
        // seconde fois par le décalage de fin de vert ferait glisser toute
        // l'action vers la gauche.
        let finCoupeeAvecLeVert = 0;
        const isAvOrEscamotage = actionType === 'Escamotage de phase' || actionType === 'Adaptatif vertical';
        const groupeAction = groupId ? groups.find(group => group.id === parseInt(String(groupId))) : undefined;
        const finDeVert = groupeAction ? groupeAction.offset + groupeAction.durations.green : null;

        if (simulationResult?.timeShifts?.length) {
            simulationResult.timeShifts.forEach(shift => {
                if (shift.amount <= 0 || (shift.isPartial && !isAvOrEscamotage)) return;
                // Un adaptatif PARTIEL ne raccourcit que les groupes de sa plage
                // et ne contracte pas le cycle : le calcul de simulation applique
                // les adaptatifs et escamotages suivants à leurs instants
                // d'origine. Leurs cadres n'ont donc pas à le suivre ici. Seul le
                // cadre d'un adaptatif dont la plage est comprise dans la sienne
                // recule, et c'est le calcul par plage, plus bas, qui s'en charge.
                // Le prendre en compte ici décalait les cadres des autres plages,
                // et deux fois ceux de la même plage.
                if (shift.isPartial && isAvOrEscamotage) return;
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
                        if (finDeVert !== null && finDeVert > zoneStart) {
                            finCoupeeAvecLeVert += Math.min(finDeVert, zoneEnd) - zoneStart;
                        }
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
            const originalGroup = groups.find(group => group.id === parseInt(String(groupId)));
            let useEndShift = false;

            if (originalGroup && actionType === 'Fermeture anticipée') {
                const cycle = simulationResult.simulatedCycleLength || cycleLength;
                const greenStart = originalGroup.offset;
                const greenEnd = (originalGroup.offset + originalGroup.durations.green) % cycleLength;
                const actionMid = (adjustedDeb + ((adjustedFin > adjustedDeb ? adjustedFin - adjustedDeb : 0) / 2)) % cycle;
                const circularDistance = (a: number, b: number): number => {
                    const distance = Math.abs(a - b);
                    return Math.min(distance, cycle - distance);
                };
                useEndShift = circularDistance(actionMid, greenEnd) < circularDistance(actionMid, greenStart);
            }

            const groupShift = useEndShift ? getGroupEndShift(groupId) : getGroupShift(groupId);
            if (groupShift > 0) {
                totalShift = Math.max(0, groupShift - (useEndShift ? fullShiftOnFin + finCoupeeAvecLeVert : fullShiftOnDeb));
            }
        } else if (simulationResult?.timeShifts?.length) {
            simulationResult.timeShifts.forEach(shift => {
                if (adjustedDeb < shift.from || !shift.isPartial) return;

                if (groupId) {
                    const parsedGroupId = parseInt(String(groupId));
                    if (parsedGroupId >= (shift.plage1 as number) && parsedGroupId <= (shift.plage2 as number)) {
                        totalShift += shift.amount;
                    }
                } else if (
                    actionPlage &&
                    actionPlage.plage1 >= (shift.plage1 as number) &&
                    actionPlage.plage2 <= (shift.plage2 as number)
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

