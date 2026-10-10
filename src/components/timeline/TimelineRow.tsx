import React from 'react';
import CustomTooltip from '../CustomTooltip';
import { entier } from '../../utils/entier';
import type { ContexteIncrustations } from './incrustations/contexteIncrustations';
import type { VertUtileSurvole } from '../TimelineDiagram';
import type { DragHandleType, TimelineConflict } from './useTimelineDrag';
import type { SimulatedGroup, SimulationResult } from '../../simulation/types';
import type { ActionMicro, Groupe, Matrice } from '../../types/projet';
import type { TrafficConflict } from '../../utils/conflictUtils';

interface TimelineRowProps {
    ctx: ContexteIncrustations;
    group: Groupe;
    TIME_WINDOW: number;
    activeConflicts: TrafficConflict[] | TimelineConflict[];
    biCarrefourSeparator: number | null;
    braceZoneRanges: { deb: number; fin: number; rawDeb: number; rawFin: number; plage1?: number | undefined; plage2?: number | undefined; isPartial?: boolean | undefined; }[];
    conflictMatrix: Matrice;
    getActionsForGroup: (groupId: number) => ActionMicro[];
    getSimulatedGroup: (groupId: number) => SimulatedGroup | null;
    handleDragStart: (event: React.MouseEvent<Element, MouseEvent>, groupId: number, type: DragHandleType, currentValue: number) => void;
    hoveredArrowGroupId: number | null;
    hoveredArrowGroupSaturated: boolean;
    hoveredVUtile: VertUtileSurvole | null;
    onGroupClick: (group: Groupe) => void;
    selectedEscamotageGroup: ActionMicro[];
    setHoveredGroupId: (id: number | null) => void;
    simulationResult: SimulationResult | null;
}

/**
 * Une ligne du diagramme : la barre du groupe (vert, orange, rouge, coupes
 * d'escamotage) et les actions qui lui sont rattachées (seconde lucarne,
 * accolade de fermeture anticipée, ouverture anticipée...).
 */
const TimelineRow = ({ ctx, group, TIME_WINDOW, activeConflicts, biCarrefourSeparator, braceZoneRanges, conflictMatrix, getActionsForGroup, getSimulatedGroup, handleDragStart, hoveredArrowGroupId, hoveredArrowGroupSaturated, hoveredVUtile, onGroupClick, selectedEscamotageGroup, setHoveredGroupId, simulationResult }: TimelineRowProps) => {
    const { groups, pixelsPerSecond, cycleLength, effectiveCycleLength, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart, getShiftedActionPosition } = ctx;

    const groupActions = getActionsForGroup(group.id);
    // Filter out conflicts that are managed by a SELECTED Escamotage action
    const isConflict = activeConflicts && activeConflicts.some(c => {
        if (c.from !== group.id && c.to !== group.id) return false;
        // Check if this conflict is inhibited by a selected Escamotage action
        const isInhibitedByEscamotage = selectedEscamotageGroup.some(action => {
            const sourceGfId = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
            const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
            return (sourceGfId === c.from && targetGfId === c.to) ||
                   (sourceGfId === c.to && targetGfId === c.from);
        });
        if (isInhibitedByEscamotage) return false;
        // Check if first group has a phaseFlag (aiguillage/escamotage)
        const fromGrp = groups.find(g => g.id === c.from);
        if (fromGrp?.phaseFlag) return false;
        return true;
    });
    const orangeDuration = group.durations.orange || 3;

    // Get simulated group data if in simulation mode
    const simGroup = getSimulatedGroup(group.id);
    const isEscamoted = simGroup?.isEscamoted || false;

    // Use simulated values when in simulation mode, otherwise use original values
    let offset = simGroup
        ? (simGroup.simulatedOffset % effectiveCycleLength)
        : (group.offset % cycleLength);
    let greenDuration = simGroup
        ? simGroup.simulatedGreen
        : group.durations.green;

    // Apply visual drag offset (no state update yet, just visual)
    if (dragState?.groupId === group.id && dragState.deltaSeconds) {
        const ds = dragState.deltaSeconds;
        if (dragState.type === 'start') {
            const newOffset = ((dragState.initialValue + ds) % cycleLength + cycleLength) % cycleLength;
            const oldEnd = (dragState.initialValue + greenDuration) % cycleLength;
            let newDur = oldEnd - newOffset;
            if (newDur <= 0) newDur += cycleLength;
            if (newDur > 0 && newDur <= cycleLength) {
                offset = newOffset;
                greenDuration = newDur;
            }
        } else if (dragState.type === 'end') {
            let newEnd = ((dragState.initialValue + ds) % cycleLength + cycleLength) % cycleLength;
            let newDur = newEnd - offset;
            if (newDur <= 0) newDur += cycleLength;
            if (newDur > 0 && newDur <= cycleLength) {
                greenDuration = newDur;
            }
        }
    }

    const endValue = (offset + greenDuration) % effectiveCycleLength;
    const hasPhase = !isEscamoted && greenDuration > 0;

    // Calculate base bars from group offset/duration
    const totalDuration = group.durations.green + group.durations.orange + group.durations.red;
    const cyclesToRender = Math.ceil(TIME_WINDOW / totalDuration) + 1;

    const isHighlightedByArrow = hoveredArrowGroupId === group.id;
    const arrowHighlightClass = isHighlightedByArrow ? (hoveredArrowGroupSaturated ? 'arrow-highlighted arrow-saturated' : 'arrow-highlighted') : '';

    return (
        <div
            key={group.id}
            className={`timeline-row-track ${isConflict ? 'row-conflict' : ''}`}
            onClick={() => onGroupClick(group)}
            style={{ backgroundColor: isHighlightedByArrow ? (hoveredArrowGroupSaturated ? 'rgba(231, 76, 60, 0.25)' : 'rgba(100, 150, 255, 0.2)') : (isConflict ? 'rgba(231, 76, 60, 0.1)' : 'transparent'), ...(biCarrefourSeparator != null && group.id === biCarrefourSeparator ? { borderBottom: '1px solid white' } : {}) }}
            onMouseEnter={() => setHoveredGroupId(group.id)}
            onMouseLeave={() => setHoveredGroupId(null)}
        >
            {/* Base bars from group Début/Fin (sidebar values) - only if phase exists */}
            {hasPhase && (() => {
                const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                const isFlOrPP = group.type === 'FL' || group.type === 'PP';

                // FL and PP types don't show the green bar (only yellow intermittent bar)
                if (isFlOrPP) return null;

                // P (piéton) gets red bar (pedestrian-orange), CY (cycle) gets dashed red bar (cyclist-orange), others get yellow (orange)
                const orangeClass = isPedestrian ? 'pedestrian-orange' : isCyclist ? 'cyclist-orange' : 'orange';
                const orangeDur = group.durations.orange;
                const orangeWidth = orangeDur * pixelsPerSecond;

                // Check if green bar wraps around cycle
                const currentCycleLen = simGroup ? effectiveCycleLength : cycleLength;
                const greenWrapsAround = offset + greenDuration > currentCycleLen;
                // Check if orange bar wraps around cycle (for pedestrians and cyclists with their special display)
                const greenEnd = (offset + greenDuration) % currentCycleLen;
                const orangeEnd = (greenEnd + orangeDur) % currentCycleLen;
                const orangeWrapsAround = (isPedestrian || isCyclist) && (greenEnd + orangeDur > currentCycleLen);

                // V.Utile overlay (capacity color on first green seconds) - available for ALL cases
                const showVUtileOverlay = hoveredVUtile && hoveredVUtile.groupId === group.id;
                const vUtileSec = showVUtileOverlay ? Math.min(hoveredVUtile.vUtile, greenDuration) : 0;
                const getCapacityColorClass = (value: number | null | undefined) => {
                    if (value === null || value === undefined) return '';
                    if (value < 76) return 'vutile-green';
                    if (value <= 85) return 'vutile-orange';
                    if (value <= 100) return 'vutile-red';
                    return 'vutile-black';
                };
                const vUtileColorClass = showVUtileOverlay ? getCapacityColorClass(hoveredVUtile.capacityValue) : '';
                const vUtileTitle = showVUtileOverlay ? `V.Utile: ${hoveredVUtile.vUtile}s (${hoveredVUtile.capacityValue}%)` : '';

                if (greenWrapsAround) {
                    // Green bar wraps around
                    const firstPartSec = currentCycleLen - offset;
                    const secondPartSec = (offset + greenDuration) % currentCycleLen;
                    const firstPartWidth = firstPartSec * pixelsPerSecond;
                    const secondPartWidth = secondPartSec * pixelsPerSecond;
                    // V.Utile split across the two green parts
                    const vUtileFirstSec = Math.min(vUtileSec, firstPartSec);
                    const vUtileSecondSec = Math.max(0, vUtileSec - firstPartSec);

                    // Check if orange also wraps
                    if (orangeWrapsAround) {
                        const orangeFirstPartWidth = (currentCycleLen - greenEnd) * pixelsPerSecond;
                        const orangeSecondPartWidth = orangeEnd * pixelsPerSecond;

                        return (
                            <React.Fragment>
                                {/* First part: from offset to end of cycle */}
                                <div
                                    className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                    style={{ left: `${offset * pixelsPerSecond}px` }}
                                >
                                    <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                        <div
                                            className="drag-handle drag-handle-start"
                                            onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                        />
                                    </CustomTooltip>
                                    <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                    {showVUtileOverlay && vUtileFirstSec > 0 && (
                                        <CustomTooltip text={vUtileTitle}><div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileFirstSec * pixelsPerSecond}px` }} /></CustomTooltip>
                                    )}
                                </div>
                                {/* Second part: green from 0 + orange first part to end of cycle */}
                                <div
                                    className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                    style={{ left: '0px' }}
                                >
                                    <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                    <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                    {showVUtileOverlay && vUtileSecondSec > 0 && (
                                        <CustomTooltip text={vUtileTitle}><div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileSecondSec * pixelsPerSecond}px` }} /></CustomTooltip>
                                    )}
                                    <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                        <div
                                            className="drag-handle drag-handle-end"
                                            onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                            style={{ left: `${secondPartWidth}px` }}
                                        />
                                    </CustomTooltip>
                                </div>
                                {/* Third part: orange continuation at start of cycle */}
                                <div
                                    className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                    style={{ left: '0px' }}
                                >
                                    <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeSecondPartWidth}px` }}></div>
                                </div>
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment>
                            {/* First part: from offset to end of cycle */}
                            <div
                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                style={{ left: `${offset * pixelsPerSecond}px` }}
                            >
                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                    <div
                                        className="drag-handle drag-handle-start"
                                        onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                    />
                                </CustomTooltip>
                                <div className="phase-bar green" style={{ width: `${firstPartWidth}px` }}></div>
                                {showVUtileOverlay && vUtileFirstSec > 0 && (
                                    <CustomTooltip text={vUtileTitle}><div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileFirstSec * pixelsPerSecond}px` }} /></CustomTooltip>
                                )}
                            </div>
                            {/* Second part: from start of cycle to end */}
                            <div
                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                style={{ left: '0px' }}
                            >
                                <div className="phase-bar green" style={{ width: `${secondPartWidth}px` }}></div>
                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                {showVUtileOverlay && vUtileSecondSec > 0 && (
                                    <CustomTooltip text={vUtileTitle}><div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileSecondSec * pixelsPerSecond}px` }} /></CustomTooltip>
                                )}
                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                    <div
                                        className="drag-handle drag-handle-end"
                                        onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                        style={{ left: `${secondPartWidth}px` }}
                                    />
                                </CustomTooltip>
                            </div>
                        </React.Fragment>
                    );
                }

                // Green doesn't wrap, but orange might wrap (for pedestrians/cyclists)
                const greenWidth = greenDuration * pixelsPerSecond;

                if (orangeWrapsAround) {
                    const orangeFirstPartWidth = (currentCycleLen - greenEnd) * pixelsPerSecond;
                    const orangeSecondPartWidth = orangeEnd * pixelsPerSecond;
                    const vUtileWidthPx = vUtileSec * pixelsPerSecond;

                    return (
                        <React.Fragment>
                            {/* Main part: green + first part of orange */}
                            <div
                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                style={{ left: `${offset * pixelsPerSecond}px` }}
                            >
                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                    <div
                                        className="drag-handle drag-handle-start"
                                        onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                    />
                                </CustomTooltip>
                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeFirstPartWidth}px` }}></div>
                                {showVUtileOverlay && vUtileSec > 0 && (
                                    <CustomTooltip text={vUtileTitle}><div className={`vutile-overlay ${vUtileColorClass}`} style={{ width: `${vUtileWidthPx}px` }} /></CustomTooltip>
                                )}
                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                    <div
                                        className="drag-handle drag-handle-end"
                                        onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                        style={{ left: `${greenWidth}px` }}
                                    />
                                </CustomTooltip>
                            </div>
                            {/* Orange continuation at start of cycle */}
                            <div
                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                style={{ left: '0px' }}
                            >
                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeSecondPartWidth}px` }}></div>
                            </div>
                        </React.Fragment>
                    );
                }

                // Normal case: neither wraps
                return (
                    <div
                        className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                        style={{ left: `${offset * pixelsPerSecond}px` }}
                    >
                        <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                            <div
                                className="drag-handle drag-handle-start"
                                onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                            />
                        </CustomTooltip>
                        <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                        {showVUtileOverlay && vUtileSec > 0 && (
                            <CustomTooltip text={vUtileTitle}>
                                <div
                                    className={`vutile-overlay ${vUtileColorClass}`}
                                    style={{ width: `${vUtileSec * pixelsPerSecond}px` }}
                                />
                            </CustomTooltip>
                        )}
                        <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                            <div
                                className="drag-handle drag-handle-end"
                                onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                style={{ left: `${greenWidth}px` }}
                            />
                        </CustomTooltip>
                    </div>
                );
            })()}

            {/* Green cuts from Escamotage actions - mask portions of the green bar */}
            {simGroup?.greenCuts?.map((cut, idx) => {
                const cutDeb = cut.deb;
                const cutFin = cut.fin;
                const currentCycleLen = effectiveCycleLength || cycleLength;
                const wrapsAround = cutDeb > cutFin;

                if (wrapsAround) {
                    // Cut wraps around cycle
                    const firstPartWidth = (currentCycleLen - cutDeb) * pixelsPerSecond;
                    const secondPartWidth = cutFin * pixelsPerSecond;
                    return (
                        <React.Fragment key={`green-cut-${idx}`}>
                            {/* First part: from cutDeb to end of cycle */}
                            <div
                                className="green-cut-overlay"
                                style={{
                                    left: `${cutDeb * pixelsPerSecond}px`,
                                    width: `${firstPartWidth}px`
                                }}
                            />
                            {/* Second part: from start of cycle to cutFin */}
                            <div
                                className="green-cut-overlay"
                                style={{
                                    left: '0px',
                                    width: `${secondPartWidth}px`
                                }}
                            />
                        </React.Fragment>
                    );
                }

                // Normal case: cut doesn't wrap
                const cutWidth = (cutFin - cutDeb) * pixelsPerSecond;
                return (
                    <div
                        key={`green-cut-${idx}`}
                        className="green-cut-overlay"
                        style={{
                            left: `${cutDeb * pixelsPerSecond}px`,
                            width: `${cutWidth}px`
                        }}
                    />
                );
            })}

            {/* Green cuts from SELECTED Escamotage (group-specific) actions */}
            {selectedEscamotageGroup
                .filter(action => {
                    const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                    return targetGfId === group.id;
                })
                .map((action, idx) => {
                    const sourceGfId = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                    const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                    if (sourceGfId === 0 || targetGfId === 0) return null;

                    const sourceGroup = groups.find(g => g.id === sourceGfId);
                    if (!sourceGroup) return null;

                    // Get intergreen times from conflict matrix
                    const intergreenSourceToTarget = Number(conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0);
                    const intergreenTargetToSource = Number(conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0);

                    // Source group times
                    const currentCycleLen = effectiveCycleLength || cycleLength;
                    const sourceStart = sourceGroup.offset % currentCycleLen;
                    const sourceEndRaw = sourceStart + sourceGroup.durations.green;
                    const sourceEnd = sourceEndRaw === currentCycleLen ? currentCycleLen : (sourceEndRaw % currentCycleLen);

                    // Calculate arrow target positions (cut boundaries)
                    // Arrow 1: target = sourceStart - intergreenTargetToSource
                    const cutStart = ((sourceStart - intergreenTargetToSource) % currentCycleLen + currentCycleLen) % currentCycleLen;
                    // Arrow 2: target = sourceEnd + intergreenSourceToTarget
                    const cutEndRaw = sourceEnd + intergreenSourceToTarget;
                    const cutEnd = cutEndRaw === currentCycleLen ? currentCycleLen : (cutEndRaw % currentCycleLen);

                    const wrapsAround = cutStart > cutEnd;

                    if (wrapsAround) {
                        const firstPartWidth = (currentCycleLen - cutStart) * pixelsPerSecond;
                        const secondPartWidth = cutEnd * pixelsPerSecond;
                        return (
                            <React.Fragment key={`escam-group-cut-${idx}`}>
                                <div
                                    className="green-cut-overlay"
                                    style={{
                                        left: `${cutStart * pixelsPerSecond}px`,
                                        width: `${firstPartWidth}px`
                                    }}
                                />
                                <div
                                    className="green-cut-overlay"
                                    style={{
                                        left: '0px',
                                        width: `${secondPartWidth}px`
                                    }}
                                />
                            </React.Fragment>
                        );
                    }

                    const cutWidth = (cutEnd - cutStart) * pixelsPerSecond;
                    return (
                        <div
                            key={`escam-group-cut-${idx}`}
                            className="green-cut-overlay"
                            style={{
                                left: `${cutStart * pixelsPerSecond}px`,
                                width: `${cutWidth}px`
                            }}
                        />
                    );
                })}

            {/* Action-based overlays */}
            {groupActions.map((action, idx) => {
                const origDeb = entier(action.deb) || 0;
                const origFin = entier(action.fin) || 0;
                // Apply time shifts from escamotage/adaptatif
                // Pass action type to exclude "Seconde lucarne" from group shift
                const shifted = getShiftedActionPosition(origDeb, origFin, group.id, action.action, null, action.id);

                // Skip rendering if action is hidden (entirely within removed period)
                if (shifted.hidden) {
                    return null;
                }

                const deb = shifted.deb;
                const fin = shifted.fin;
                const duration = fin >= deb ? fin - deb : (effectiveCycleLength - deb + fin);
                const leftPos = deb * pixelsPerSecond;
                const greenWidth = duration * pixelsPerSecond;
                const orangeWidth = orangeDuration * pixelsPerSecond;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                // For Fermeture anticipée: calculate brace start position
                // Si l'adaptatif vertical décale la fin de vert, l'accolade se décale du même delta
                // Si la fin de vert n'est pas décalée, l'accolade reste à sa position d'origine
                let fermetureStartPos = deb; // Default to shifted deb
                let fermetureEndPos = fin; // Default to shifted fin
                if (action.action === 'Fermeture anticipée' && simGroup) {
                    const originalGreenEnd = group.offset + group.durations.green;
                    const simulatedGreenEnd = simGroup.simulatedOffset + simGroup.simulatedGreen;
                    // Compare modular ends (not raw sums) to detect actual end-of-green change
                    // Wrapping groups may have different raw sums but same modular end
                    const originalGreenEndMod = originalGreenEnd % cycleLength;
                    const simulatedGreenEndMod = simulatedGreenEnd % effectiveCycleLength;
                    if (originalGreenEndMod !== simulatedGreenEndMod) {
                        // Vérifier si un Point de repos étire ce vert. Dans ce cas, on
                        // ne repositionne PAS (la logique « suivre la fin de vert » est
                        // conçue pour AV/EP, où le vert se DÉPLACE ; avec PR il s'ÉTIRE,
                        // et la fermeture doit suivre la règle uniforme deb < t inchangé,
                        // deb >= t décalé — déjà calculée par getShiftedActionPosition).
                        const greenStartOrig = group.offset;
                        const greenEndOrig = group.offset + group.durations.green;
                        // Un vert qui chevauche la fin du cycle couvre aussi, au début du
                        // cycle suivant, les instants jusqu'à greenEndOrig - cycleLength.
                        const restPointStretchesGreen = simulationResult?.restPoints?.some(rp =>
                            (rp.originalDeb >= greenStartOrig && rp.originalDeb <= greenEndOrig) ||
                            rp.originalDeb <= greenEndOrig - cycleLength
                        );

                        // Vérifier si l'accolade chevauche une zone AV/EP (début avant, fin dans ou après la zone)
                        let straddlesZone = false;
                        for (const zone of braceZoneRanges) {
                            if (zone.isPartial) {
                                const gId = group.id;
                                if (gId < (zone.plage1 ?? 0) || gId > (zone.plage2 ?? 0)) continue;
                            }
                            // La fermeture chevauche la zone : début avant, fin dans ou après
                            if (origDeb < zone.rawDeb && origFin > zone.rawDeb) {
                                straddlesZone = true;
                                break;
                            }
                        }

                        if (!straddlesZone && !restPointStretchesGreen) {
                            // Pas de chevauchement AV/EP et pas d'étirement par PR :
                            // repositionner relativement à la fin de vert simulée
                            const simGreenEnd = simulatedGreenEnd % effectiveCycleLength;
                            fermetureStartPos = ((simGreenEnd + (origDeb - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                            fermetureEndPos = ((simGreenEnd + (origFin - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                        }
                        // Sinon : garder deb/fin de getShiftedActionPosition (déjà corrects)
                    }
                }
                // Tronquer l'accolade si elle chevauche une zone Adaptatif partiel
                // Les zones full (AV/EP sélectionnées) sont retirées de la timeline,
                // donc la troncature ne s'applique qu'aux zones partielles
                if (action.action === 'Fermeture anticipée') {
                    for (const zone of braceZoneRanges) {
                        // Seules les zones partielles tronquent les accolades
                        if (!zone.isPartial) continue;
                        const gId = group.id;
                        if (gId < (zone.plage1 ?? 0) || gId > (zone.plage2 ?? 0)) continue;
                        // Seule une accolade qui chevauche la zone dans le plan
                        // d'origine est tronquée. Les positions comparées
                        // ci-dessous sont déjà décalées : une accolade située
                        // après la zone, ramenée vers la gauche de la durée de
                        // l'adaptatif, y retombait et voyait son début repoussé
                        // en fin de zone au lieu de suivre le décalage.
                        const chevauche = (debut: number, finale: number) => debut < zone.rawFin && finale > zone.rawDeb;
                        const chevaucheOrigine = origDeb <= origFin
                            ? chevauche(origDeb, origFin)
                            : chevauche(origDeb, cycleLength) || chevauche(0, origFin);
                        if (!chevaucheOrigine) continue;
                        if (zone.deb < zone.fin && fermetureStartPos < fermetureEndPos) {
                            if (fermetureStartPos < zone.deb && fermetureEndPos > zone.deb) {
                                // Début accolade < début zone : tronquer la fin au début de la zone
                                fermetureEndPos = zone.deb;
                            } else if (fermetureStartPos >= zone.deb && fermetureStartPos < zone.fin) {
                                // Début accolade dans la zone : pousser le début après la zone
                                fermetureStartPos = zone.fin;
                            }
                        }
                    }
                }
                const fermetureLeftPos = fermetureStartPos * pixelsPerSecond;

                return (
                    <React.Fragment key={`action-${idx}`}>
                        {/* Abrv label on the bar (not for Ouverture anticipée, Escamotage de phase, Adaptatif vertical which have their own labels) */}
                        {abrv && action.action !== 'Ouverture anticipée' && action.action !== 'Escamotage de phase' && action.action !== 'Adaptatif vertical' && (
                            <div
                                className="bar-label"
                                style={{
                                    left: `${(action.action === 'Fermeture anticipée' ? fermetureLeftPos : leftPos) + 2}px`,
                                    width: `${greenWidth - 4}px`
                                }}
                            >
                                {abrv}
                            </div>
                        )}

                        {/* Seconde lucarne: additional bar with darker green */}
                        {action.action === 'Seconde lucarne' && (() => {
                            // Determine orange class based on group type
                            const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                            const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                            const lucarneOrangeClass = isPedestrian ? 'pedestrian-orange' : isCyclist ? 'cyclist-orange' : 'orange';
                            const wrapsAround = deb > fin;
                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = fin * pixelsPerSecond;
                                return (
                                    <React.Fragment>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: `${leftPos}px` }}
                                            onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                            onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                        >
                                            <div
                                                className="drag-handle drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                            />
                                            <div className="phase-bar green-dark" style={{ width: `${firstPartWidth}px` }}></div>
                                        </div>
                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: '0px' }}
                                            onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                            onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                        >
                                            <div className="phase-bar green-dark" style={{ width: `${secondPartWidth}px` }}></div>
                                            <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                            <div
                                                className="drag-handle drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                style={{ left: `${secondPartWidth}px` }}

                                            />
                                        </div>
                                    </React.Fragment>
                                );
                            }
                            return (
                                <div
                                    className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{ left: `${leftPos}px` }}
                                    onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                    onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                >
                                    <div
                                        className="drag-handle drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                    />
                                    <div className="phase-bar green-dark" style={{ width: `${greenWidth}px` }}></div>
                                    <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                    <div
                                        className="drag-handle drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                        style={{ left: `${greenWidth}px` }}

                                    />
                                </div>
                            );
                        })()}

                        {/* Fermeture anticipée: brace */}
                        {action.action === 'Fermeture anticipée' && (() => {
                            // Don't render brace if the group is escamoted or has no green
                            if (isEscamoted || greenDuration <= 0) {
                                return null;
                            }
                            // Use the pre-calculated fermetureStartPos (same as abbreviation)
                            // This ensures brace and abbreviation are always at the same position
                            const braceStart = fermetureStartPos;
                            const braceEnd = fermetureEndPos; // Use truncated fin (accounting for zone overlap)
                            // Validate: brace should have positive duration
                            // If braceEnd == braceStart, skip rendering
                            const normalDuration = braceEnd >= braceStart
                                ? braceEnd - braceStart
                                : (effectiveCycleLength - braceStart + braceEnd);
                            // Skip if duration is 0 or spans almost the entire cycle (which indicates an error)
                            if (normalDuration <= 0 || normalDuration >= effectiveCycleLength - 1) {
                                return null;
                            }
                            const braceDuration = normalDuration;
                            const braceLeftPos = braceStart * pixelsPerSecond;
                            const braceWidth = braceDuration * pixelsPerSecond;

                            const wrapsAround = braceStart > braceEnd;
                            if (wrapsAround) {
                                const firstPartWidth = (effectiveCycleLength - braceStart) * pixelsPerSecond;
                                const secondPartWidth = braceEnd * pixelsPerSecond;
                                return (
                                    <React.Fragment>
                                        <div
                                            className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: `${braceLeftPos}px`, width: `${firstPartWidth}px` }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <span className="brace-point"></span>
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}

                                            />
                                        </div>
                                        <div
                                            className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: '0px', width: `${secondPartWidth}px` }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <span className="brace-point"></span>
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}

                                            />
                                        </div>
                                    </React.Fragment>
                                );
                            }
                            return (
                                <div
                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{ left: `${braceLeftPos}px`, width: `${braceWidth}px` }}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                >
                                    <span className="brace-point"></span>
                                    <div
                                        className="action-drag-handle action-drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}

                                    />
                                    <div
                                        className="action-drag-handle action-drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}

                                    />
                                </div>
                            );
                        })()}

                        {/* Ouverture anticipée: hatched green rectangle */}
                        {action.action === 'Ouverture anticipée' && (() => {
                            const wrapsAround = deb > fin;
                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = fin * pixelsPerSecond;
                                return (
                                    <React.Fragment>
                                        <div
                                            className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: `${leftPos}px`, width: `${firstPartWidth}px` }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                            />
                                            {abrv && (
                                                <span className="ouverture-anticipee-label">{abrv}</span>
                                            )}
                                        </div>
                                        <div
                                            className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{ left: '0px', width: `${secondPartWidth}px` }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                            />
                                        </div>
                                    </React.Fragment>
                                );
                            }
                            return (
                                <div
                                    className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{ left: `${leftPos}px`, width: `${greenWidth}px` }}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                >
                                    <div
                                        className="action-drag-handle action-drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                    />
                                    <div
                                        className="action-drag-handle action-drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                    />
                                    {abrv && (
                                        <span className="ouverture-anticipee-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })()}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default TimelineRow;
