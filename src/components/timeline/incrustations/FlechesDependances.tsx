import type { ContexteIncrustations } from './contexteIncrustations';
import type { SimulationResult } from '../../../simulation/types';
import type { ActionMicro, Matrice } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface FlechesDependancesProps {
    ctx: ContexteIncrustations;
    actionData: ActionMicro[];
    conflictMatrix: Matrice;
    dependencyGap: number;
    hoveredConflict: { from: number; to: number; isConflict?: boolean | undefined; } | null;
    hoveredGroupId: number | null;
    showDependencies: boolean;
    simulationFilter: Set<number> | null;
    simulationResult: SimulationResult | null;
}

/** Flèches de dépendance : temps de dégagement entre groupes. */
const FlechesDependances = ({ ctx, actionData, conflictMatrix, dependencyGap, hoveredConflict, hoveredGroupId, showDependencies, simulationFilter, simulationResult }: FlechesDependancesProps) => {
    const { groups, pixelsPerSecond, cycleLength, effectiveCycleLength, RULER_HEIGHT, ROW_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth } = ctx;

    return (
        <>
            {/* Dependency arrows - intergreen times between groups */}
            {(showDependencies || hoveredConflict) && (
                <svg
                    className="dependency-arrows"
                    width={totalWidth}
                    height={svgHeight}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        pointerEvents: 'none',
                        zIndex: 5
                    }}
                >
                    <defs>
                        <marker
                            id="dep-arrowhead"
                            markerWidth="6"
                            markerHeight="4"
                            refX="6"
                            refY="2"
                            orient="auto"
                        >
                            <polygon points="0 0, 6 2, 0 4" fill="#999" />
                        </marker>
                        <marker
                            id="dep-arrowhead-conflict"
                            markerWidth="6"
                            markerHeight="4"
                            refX="6"
                            refY="2"
                            orient="auto"
                        >
                            <polygon points="0 0, 6 2, 0 4" fill="red" />
                        </marker>
                        <marker
                            id="dep-arrowhead-potential"
                            markerWidth="6"
                            markerHeight="4"
                            refX="6"
                            refY="2"
                            orient="auto"
                        >
                            <polygon points="0 0, 6 2, 0 4" fill="#ff9800" />
                        </marker>
                    </defs>
                    {/* Arrows from main green phases */}
                    {groups.map((fromGroup, fromIndex) => {
                        const fromId = fromGroup.id;
                        // Use simulated values when simulation is active
                        const simFrom = simulationResult?.simulatedGroups?.find(g => g.id === fromId);
                        const useSimValues = simFrom && effectiveCycleLength;
                        const effCycle = useSimValues ? effectiveCycleLength : cycleLength;
                        const fromOffset = useSimValues ? (simFrom.simulatedOffset % effCycle) : (fromGroup.offset % cycleLength);
                        const fromGreen = useSimValues ? simFrom.simulatedGreen : fromGroup.durations.green;
                        const fromGreenEnd = (fromOffset + fromGreen) % effCycle;
                        const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                        const fromX = fromGreenEnd * pixelsPerSecond;

                        return groups.map((toGroup, toIndex) => {
                            const toId = toGroup.id;
                            if (fromId === toId) return null;

                            // Check if this arrow matches the hovered conflict (exact direction only)
                            const showForConflict = hoveredConflict &&
                                (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                            // Filter: show arrows for hovered group OR hovered conflict
                            if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                            // If hoveredConflict is active but doesn't match this pair, hide the arrow
                            if (hoveredConflict && !showForConflict) return null;

                            const intergreenTime = Number(conflictMatrix[fromId - 1]?.[toId - 1] || 0);
                            if (intergreenTime <= 0) return null;

                            // Determine if this arrow is a conflict (from matrix hover)
                            const isMajorConflictArrow = showForConflict && hoveredConflict?.isConflict === true;
                            const isPotentialConflictArrow = showForConflict && hoveredConflict?.isConflict === false;
                            const arrowColor = isMajorConflictArrow ? 'red' : isPotentialConflictArrow ? '#ff9800' : '#999';
                            const arrowWidth = isMajorConflictArrow ? 3 : isPotentialConflictArrow ? 2 : 1;
                            const arrowOpacity = (isMajorConflictArrow || isPotentialConflictArrow) ? 0.9 : 0.6;
                            const arrowMarker = isMajorConflictArrow
                                ? 'url(#dep-arrowhead-conflict)'
                                : isPotentialConflictArrow
                                    ? 'url(#dep-arrowhead-potential)'
                                    : 'url(#dep-arrowhead)';
                            const arrowDash = (isMajorConflictArrow || isPotentialConflictArrow) ? '6,3' : undefined;

                            // Use simulated offset for target too
                            const simTo = simulationResult?.simulatedGroups?.find(g => g.id === toId);
                            const toOffset = (useSimValues && simTo) ? (simTo.simulatedOffset % effCycle) : (toGroup.offset % cycleLength);

                            // Skip if either group is escamoted or has no green in simulation
                            if (useSimValues && (simFrom?.isEscamoted || simFrom?.simulatedGreen <= 0)) return null;
                            if (useSimValues && simTo && (simTo.isEscamoted || simTo.simulatedGreen <= 0)) return null;

                            // Calculate gap between end of fromGroup green and start of toGroup green
                            let gap = (toOffset - fromGreenEnd + effCycle) % effCycle;
                            // If gap is 0, it means they're at the same time, consider it as full cycle
                            if (gap === 0) gap = effCycle;

                            // Don't show arrow if gap > dependencyGap seconds (unless forced by conflict hover)
                            if (!showForConflict && gap > dependencyGap) return null;

                            // Arrow ends at: end of green + intergreen time
                            const arrowEndTime = (fromGreenEnd + intergreenTime) % effCycle;
                            const toX = arrowEndTime * pixelsPerSecond;
                            const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            const cycleEndX = effCycle * pixelsPerSecond;

                            // If arrow would go backwards, split into two segments
                            if (fromX > toX) {
                                return (
                                    <g key={`dep-${fromId}-${toId}`}>
                                        {/* First segment: from start to end of cycle */}
                                        <line
                                            x1={fromX}
                                            y1={fromRowY}
                                            x2={cycleEndX}
                                            y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            stroke={arrowColor}
                                            strokeWidth={arrowWidth}
                                            strokeDasharray={arrowDash}
                                            opacity={arrowOpacity}
                                        />
                                        {/* Second segment: from start of cycle to end point */}
                                        <line
                                            x1={0}
                                            y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            x2={toX}
                                            y2={toRowY}
                                            stroke={arrowColor}
                                            strokeWidth={arrowWidth}
                                            strokeDasharray={arrowDash}
                                            markerEnd={arrowMarker}
                                            opacity={arrowOpacity}
                                        />
                                    </g>
                                );
                            }

                            return (
                                <line
                                    key={`dep-${fromId}-${toId}`}
                                    x1={fromX}
                                    y1={fromRowY}
                                    x2={toX}
                                    y2={toRowY}
                                    stroke={arrowColor}
                                    strokeWidth={arrowWidth}
                                    strokeDasharray={arrowDash}
                                    markerEnd={arrowMarker}
                                    opacity={arrowOpacity}
                                />
                            );
                        });
                    })}

                    {/* Arrows from Seconde lucarne phases */}
                    {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((lucarne, lIdx) => {
                        const fromId = entier(lucarne.gf);
                        const fromIndex = groups.findIndex(g => g.id === fromId);
                        if (fromIndex === -1) return null;

                        const lucarneEnd = entier(lucarne.fin) || 0;
                        const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                        const fromX = lucarneEnd * pixelsPerSecond;

                        return groups.map((toGroup, toIndex) => {
                            const toId = toGroup.id;
                            if (fromId === toId) return null;

                            // Check if this arrow matches the hovered conflict (exact direction only)
                            const showForConflict = hoveredConflict &&
                                (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                            // Filter: show arrows for hovered group OR hovered conflict
                            if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                            // If hoveredConflict is active but doesn't match this pair, hide the arrow
                            if (hoveredConflict && !showForConflict) return null;

                            const intergreenTime = Number(conflictMatrix[fromId - 1]?.[toId - 1] || 0);
                            if (intergreenTime <= 0) return null;

                            const toOffset = toGroup.offset % cycleLength;

                            // Calculate gap between end of lucarne and start of toGroup green
                            let gap = (toOffset - lucarneEnd + cycleLength) % cycleLength;
                            if (gap === 0) gap = cycleLength;

                            // Don't show arrow if gap > dependencyGap seconds
                            if (gap > dependencyGap) return null;

                            // Arrow ends at: end of lucarne + intergreen time
                            const arrowEndTime = (lucarneEnd + intergreenTime) % cycleLength;
                            const toX = arrowEndTime * pixelsPerSecond;
                            const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // If arrow would go backwards, split into two segments
                            if (fromX > toX) {
                                return (
                                    <g key={`dep-luc-${lIdx}-${toId}`}>
                                        {/* First segment: from start to end of cycle */}
                                        <line
                                            x1={fromX}
                                            y1={fromRowY}
                                            x2={cycleEndX}
                                            y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            stroke="#999"
                                            strokeWidth="1"
                                            opacity="0.6"
                                        />
                                        {/* Second segment: from start of cycle to end point */}
                                        <line
                                            x1={0}
                                            y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            x2={toX}
                                            y2={toRowY}
                                            stroke="#999"
                                            strokeWidth="1"
                                            markerEnd="url(#dep-arrowhead)"
                                            opacity="0.6"
                                        />
                                    </g>
                                );
                            }

                            return (
                                <line
                                    key={`dep-luc-${lIdx}-${toId}`}
                                    x1={fromX}
                                    y1={fromRowY}
                                    x2={toX}
                                    y2={toRowY}
                                    stroke="#999"
                                    strokeWidth="1"
                                    markerEnd="url(#dep-arrowhead)"
                                    opacity="0.6"
                                />
                            );
                        });
                    })}

                    {/* Arrows from Seconde lucarne to other Seconde lucarne */}
                    {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((fromLucarne, fromLIdx) => {
                        const fromId = entier(fromLucarne.gf);
                        const fromIndex = groups.findIndex(g => g.id === fromId);
                        if (fromIndex === -1) return null;

                        const fromLucarneEnd = entier(fromLucarne.fin) || 0;
                        const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                        const fromX = fromLucarneEnd * pixelsPerSecond;

                        return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                            const toId = entier(toLucarne.gf);
                            if (fromId === toId) return null;
                            if (fromLIdx === toLIdx) return null;

                            // Check if this arrow matches the hovered conflict (exact direction only)
                            const showForConflict = hoveredConflict &&
                                (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                            // Filter: show arrows for hovered group OR hovered conflict
                            if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                            // If hoveredConflict is active but doesn't match this pair, hide the arrow
                            if (hoveredConflict && !showForConflict) return null;

                            const intergreenTime = Number(conflictMatrix[fromId - 1]?.[toId - 1] || 0);
                            if (intergreenTime <= 0) return null;

                            const toIndex = groups.findIndex(g => g.id === toId);
                            if (toIndex === -1) return null;

                            const toLucarneDeb = entier(toLucarne.deb) || 0;

                            // Calculate gap between end of fromLucarne and start of toLucarne
                            let gap = (toLucarneDeb - fromLucarneEnd + cycleLength) % cycleLength;
                            if (gap === 0) gap = cycleLength;

                            // Don't show arrow if gap > dependencyGap seconds
                            if (gap > dependencyGap) return null;

                            // Arrow ends at: end of lucarne + intergreen time
                            const arrowEndTime = (fromLucarneEnd + intergreenTime) % cycleLength;
                            const toX = arrowEndTime * pixelsPerSecond;
                            const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // If arrow would go backwards, split into two segments
                            if (fromX > toX) {
                                return (
                                    <g key={`dep-luc2luc-${fromLIdx}-${toLIdx}`}>
                                        {/* First segment: from start to end of cycle */}
                                        <line
                                            x1={fromX}
                                            y1={fromRowY}
                                            x2={cycleEndX}
                                            y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            stroke="#999"
                                            strokeWidth="1"
                                            opacity="0.6"
                                        />
                                        {/* Second segment: from start of cycle to end point */}
                                        <line
                                            x1={0}
                                            y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            x2={toX}
                                            y2={toRowY}
                                            stroke="#999"
                                            strokeWidth="1"
                                            markerEnd="url(#dep-arrowhead)"
                                            opacity="0.6"
                                        />
                                    </g>
                                );
                            }

                            return (
                                <line
                                    key={`dep-luc2luc-${fromLIdx}-${toLIdx}`}
                                    x1={fromX}
                                    y1={fromRowY}
                                    x2={toX}
                                    y2={toRowY}
                                    stroke="#999"
                                    strokeWidth="1"
                                    markerEnd="url(#dep-arrowhead)"
                                    opacity="0.6"
                                />
                            );
                        });
                    })}

                    {/* Arrows from main green phases to Seconde lucarne */}
                    {groups.map((fromGroup, fromIndex) => {
                        const fromId = fromGroup.id;
                        const fromOffset = fromGroup.offset % cycleLength;
                        const fromGreenEnd = (fromOffset + fromGroup.durations.green) % cycleLength;
                        const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                        const fromX = fromGreenEnd * pixelsPerSecond;

                        return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                            const toId = entier(toLucarne.gf);
                            if (fromId === toId) return null;

                            // Check if this arrow matches the hovered conflict (exact direction only)
                            const showForConflict = hoveredConflict &&
                                (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                            // Filter: show arrows for hovered group OR hovered conflict
                            if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                            // If hoveredConflict is active but doesn't match this pair, hide the arrow
                            if (hoveredConflict && !showForConflict) return null;

                            const intergreenTime = Number(conflictMatrix[fromId - 1]?.[toId - 1] || 0);
                            if (intergreenTime <= 0) return null;

                            const toIndex = groups.findIndex(g => g.id === toId);
                            if (toIndex === -1) return null;

                            const toLucarneDeb = entier(toLucarne.deb) || 0;

                            // Calculate gap between end of main green and start of lucarne
                            let gap = (toLucarneDeb - fromGreenEnd + cycleLength) % cycleLength;
                            if (gap === 0) gap = cycleLength;

                            // Don't show arrow if gap > dependencyGap seconds
                            if (gap > dependencyGap) return null;

                            // Arrow ends at: end of green + intergreen time
                            const arrowEndTime = (fromGreenEnd + intergreenTime) % cycleLength;
                            const toX = arrowEndTime * pixelsPerSecond;
                            const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // If arrow would go backwards, split into two segments
                            if (fromX > toX) {
                                return (
                                    <g key={`dep-main2luc-${fromId}-${toLIdx}`}>
                                        {/* First segment: from start to end of cycle */}
                                        <line
                                            x1={fromX}
                                            y1={fromRowY}
                                            x2={cycleEndX}
                                            y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            stroke="#999"
                                            strokeWidth="1"
                                            opacity="0.6"
                                        />
                                        {/* Second segment: from start of cycle to end point */}
                                        <line
                                            x1={0}
                                            y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            x2={toX}
                                            y2={toRowY}
                                            stroke="#999"
                                            strokeWidth="1"
                                            markerEnd="url(#dep-arrowhead)"
                                            opacity="0.6"
                                        />
                                    </g>
                                );
                            }

                            return (
                                <line
                                    key={`dep-main2luc-${fromId}-${toLIdx}`}
                                    x1={fromX}
                                    y1={fromRowY}
                                    x2={toX}
                                    y2={toRowY}
                                    stroke="#999"
                                    strokeWidth="1"
                                    markerEnd="url(#dep-arrowhead)"
                                    opacity="0.6"
                                />
                            );
                        });
                    })}

                    {/* Arrows from Seconde lucarne to Seconde lucarne (end to start) */}
                    {actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.fin !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((fromLucarne, fromLIdx) => {
                        const fromId = entier(fromLucarne.gf);
                        const fromIndex = groups.findIndex(g => g.id === fromId);
                        if (fromIndex === -1) return null;

                        const fromLucarneEnd = entier(fromLucarne.fin) || 0;
                        const fromRowY = RULER_HEIGHT + 1 + (fromIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                        const fromX = fromLucarneEnd * pixelsPerSecond;

                        return actionData.filter(a => a.action === 'Seconde lucarne' && a.gf && a.deb !== '' && (!simulationFilter || simulationFilter.has(a.id))).map((toLucarne, toLIdx) => {
                            const toId = entier(toLucarne.gf);
                            if (fromId === toId) return null;
                            if (fromLIdx === toLIdx) return null;

                            // Check if this arrow matches the hovered conflict (exact direction only)
                            const showForConflict = hoveredConflict &&
                                (fromId === hoveredConflict.from && toId === hoveredConflict.to);

                            // Filter: show arrows for hovered group OR hovered conflict
                            if (!showForConflict && hoveredGroupId !== null && fromId !== hoveredGroupId && toId !== hoveredGroupId) return null;
                            // If hoveredConflict is active but doesn't match this pair, hide the arrow
                            if (hoveredConflict && !showForConflict) return null;

                            const intergreenTime = Number(conflictMatrix[fromId - 1]?.[toId - 1] || 0);
                            if (intergreenTime <= 0) return null;

                            const toIndex = groups.findIndex(g => g.id === toId);
                            if (toIndex === -1) return null;

                            const toLucarneDeb = entier(toLucarne.deb) || 0;

                            // Calculate gap between end of fromLucarne and start of toLucarne
                            let gap = (toLucarneDeb - fromLucarneEnd + cycleLength) % cycleLength;
                            if (gap === 0) gap = cycleLength;

                            // Don't show arrow if gap > dependencyGap seconds
                            if (gap > dependencyGap) return null;

                            // Arrow ends at: end of lucarne + intergreen time
                            const arrowEndTime = (fromLucarneEnd + intergreenTime) % cycleLength;
                            const toX = arrowEndTime * pixelsPerSecond;
                            const toRowY = RULER_HEIGHT + 1 + (toIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                            const cycleEndX = cycleLength * pixelsPerSecond;

                            // If arrow would go backwards, split into two segments
                            if (fromX > toX) {
                                return (
                                    <g key={`dep-luc2lucdeb-${fromLIdx}-${toLIdx}`}>
                                        {/* First segment: from start to end of cycle */}
                                        <line
                                            x1={fromX}
                                            y1={fromRowY}
                                            x2={cycleEndX}
                                            y2={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            stroke="#999"
                                            strokeWidth="1"
                                            opacity="0.6"
                                        />
                                        {/* Second segment: from start of cycle to end point */}
                                        <line
                                            x1={0}
                                            y1={fromRowY + (toRowY - fromRowY) * ((cycleEndX - fromX) / (cycleEndX - fromX + toX))}
                                            x2={toX}
                                            y2={toRowY}
                                            stroke="#999"
                                            strokeWidth="1"
                                            markerEnd="url(#dep-arrowhead)"
                                            opacity="0.6"
                                        />
                                    </g>
                                );
                            }

                            return (
                                <line
                                    key={`dep-luc2lucdeb-${fromLIdx}-${toLIdx}`}
                                    x1={fromX}
                                    y1={fromRowY}
                                    x2={toX}
                                    y2={toRowY}
                                    stroke="#999"
                                    strokeWidth="1"
                                    markerEnd="url(#dep-arrowhead)"
                                    opacity="0.6"
                                />
                            );
                        });
                    })}
                </svg>
            )}
        </>
    );
};

export default FlechesDependances;
