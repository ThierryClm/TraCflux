import React from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro, Matrice } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface IncrustationEscamotageGroupeProps {
    ctx: ContexteIncrustations;
    conflictMatrix: Matrice;
    escamotageGroupActions: ActionMicro[];
}

/** Escamotages de groupe : zone hachurée et flèches vers le groupe cible. */
const IncrustationEscamotageGroupe = ({ ctx, conflictMatrix, escamotageGroupActions }: IncrustationEscamotageGroupeProps) => {
    const { groups, pixelsPerSecond, cycleLength, RULER_HEIGHT, ROW_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId } = ctx;

    return (
        <>
            {/* Escamotage (group-specific) with arrows */}
            {escamotageGroupActions.map((action, idx) => {
                const sourceGfId = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const isHighlighted = hoveredActionId === action.id;
                const hasTarget = targetGfId > 0 && targetGfId <= groups.length;

                if (sourceGfId === 0) return null;
                if (sourceGfId > groups.length) return null;

                const sourceGroup = groups.find(g => g.id === sourceGfId);
                if (!sourceGroup) return null;

                const targetGroup = hasTarget ? groups.find(g => g.id === targetGfId) : null;

                // Find actual group indices in the array
                const sourceGroupIndex = groups.findIndex(g => g.id === sourceGfId);
                const targetGroupIndex = hasTarget ? groups.findIndex(g => g.id === targetGfId) : sourceGroupIndex;
                if (sourceGroupIndex === -1) return null;

                // Source group times
                const sourceStart = sourceGroup.offset % cycleLength;
                const sourceEndRaw = sourceStart + sourceGroup.durations.green;
                // If end equals cycle, keep it at cycle instead of wrapping to 0
                const sourceEnd = sourceEndRaw === cycleLength ? cycleLength : (sourceEndRaw % cycleLength);

                // Calculate rectangle position based on whether target is defined
                let rectX, rectWidth, arrow1SourceX, arrow1TargetX, arrow2SourceX, arrow2TargetX, sourceY, targetY;
                const barHeight = ROW_HEIGHT - 14; // Bar has top:7px and bottom:7px (16px)
                const rectHeight = barHeight / 2; // Half the bar height (8px)

                if (hasTarget && targetGroup) {
                    // Get intergreen times from conflict matrix
                    const intergreenSourceToTarget = Number(conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0);
                    const intergreenTargetToSource = Number(conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0);

                    // Y positions (center of each row)
                    sourceY = RULER_HEIGHT + 1 + (sourceGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);

                    // Arrow 1: From start of source GF to (source start - intergreen target→source)
                    arrow1SourceX = sourceStart * pixelsPerSecond;
                    arrow1TargetX = ((sourceStart - intergreenTargetToSource + cycleLength) % cycleLength) * pixelsPerSecond;

                    // Arrow 2: From end of source GF to (source end + intergreen source→target)
                    arrow2SourceX = sourceEnd * pixelsPerSecond;
                    const arrow2TargetRaw = sourceEnd + intergreenSourceToTarget;
                    // If arrow end equals cycle, keep it at cycle instead of wrapping to 0
                    arrow2TargetX = (arrow2TargetRaw === cycleLength ? cycleLength : (arrow2TargetRaw % cycleLength)) * pixelsPerSecond;

                    // Rectangle between arrow endpoints on target row (lower half of bar)
                    rectX = Math.min(arrow1TargetX, arrow2TargetX);
                    rectWidth = Math.abs(arrow2TargetX - arrow1TargetX);

                    // Calculate exact bar bottom position and align rectangle there
                    const rowTopY = RULER_HEIGHT + 1 + (targetGroupIndex * ROW_TOTAL_HEIGHT);
                    const barBottomY = rowTopY + ROW_HEIGHT - 7; // Exact bottom of bar
                    targetY = barBottomY - rectHeight + 1 + rectHeight; // Arrow target Y points to bottom of rectangle
                } else {
                    // No target defined - show rectangle on source group
                    // If deb/fin are specified, use them (e.g. for seconde lucarne); otherwise use green phase
                    const actionDeb = action.deb !== '' ? entier(action.deb) : null;
                    const actionFin = action.fin !== '' ? entier(action.fin) : null;
                    if (actionDeb !== null && actionFin !== null && !isNaN(actionDeb) && !isNaN(actionFin)) {
                        rectX = actionDeb * pixelsPerSecond;
                        rectWidth = (actionFin > actionDeb ? actionFin - actionDeb : (cycleLength - actionDeb + actionFin)) * pixelsPerSecond;
                    } else {
                        rectX = sourceStart * pixelsPerSecond;
                        rectWidth = (sourceEnd - sourceStart) * pixelsPerSecond;
                        if (rectWidth < 0) rectWidth += cycleLength * pixelsPerSecond; // Handle wrap-around
                    }
                }

                // Calculate exact bar bottom position and align rectangle there
                const displayGroupIndex = hasTarget ? targetGroupIndex : sourceGroupIndex;
                const rowTopY = RULER_HEIGHT + 1 + (displayGroupIndex * ROW_TOTAL_HEIGHT);
                const barBottomY = rowTopY + ROW_HEIGHT - 7; // Exact bottom of bar
                const rectY = barBottomY - rectHeight + 1; // Rectangle bottom aligned to bar bottom +1px offset (moved up 4px)

                return (
                    <React.Fragment key={`escamotage-group-${idx}`}>
                        {/* Hover zone for highlighting */}
                        <div
                            className={`escamotage-group-hover ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                position: 'absolute',
                                left: `${rectX}px`,
                                top: `${rectY - 5}px`,
                                width: `${rectWidth}px`,
                                height: `${rectHeight + 10}px`,
                                zIndex: 21,
                                cursor: 'pointer'
                            }}
                            onMouseEnter={() => setHoveredActionId(action.id)}
                            onMouseLeave={() => setHoveredActionId(null)}
                        />
                        <svg
                            className={`escamotage-arrows ${isHighlighted ? 'highlighted' : ''}`}

                            width={totalWidth}
                            height={svgHeight}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none',
                                zIndex: 20
                            }}
                        >
                        <defs>
                            <marker
                                id={`escam-arrowhead-${idx}`}
                                markerWidth="8"
                                markerHeight="6"
                                refX="8"
                                refY="3"
                                orient="auto"
                            >
                                <polygon points="0 0, 8 3, 0 6" fill="#87CEEB" />
                            </marker>
                            <pattern
                                id={`escam-hatch-${idx}`}
                                patternUnits="userSpaceOnUse"
                                width="6"
                                height="6"
                                patternTransform="rotate(-45)"
                            >
                                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(135,206,235,0.9)" strokeWidth="3" />
                            </pattern>
                        </defs>
                        {/* Hatched rectangle between arrow endpoints */}
                        <rect
                            x={rectX}
                            y={rectY}
                            width={rectWidth}
                            height={rectHeight}
                            fill={`url(#escam-hatch-${idx})`}
                            stroke="#006400"
                            strokeWidth="1"
                        />
                        {/* Arrows only when target group is defined */}
                        {hasTarget && (
                            <>
                                {/* Arrow 1: From source start to (source start - intergreen target→source) */}
                                <line
                                    x1={arrow1SourceX}
                                    y1={sourceY}
                                    x2={arrow1TargetX}
                                    y2={targetY}
                                    stroke="#87CEEB"
                                    strokeWidth="1"
                                    strokeDasharray="4,2"
                                    markerEnd={`url(#escam-arrowhead-${idx})`}
                                />
                                {/* Arrow 2: From source end to (source end + intergreen source→target) */}
                                <line
                                    x1={arrow2SourceX}
                                    y1={sourceY}
                                    x2={arrow2TargetX}
                                    y2={targetY}
                                    stroke="#87CEEB"
                                    strokeWidth="1"
                                    strokeDasharray="4,2"
                                    markerEnd={`url(#escam-arrowhead-${idx})`}
                                />
                            </>
                        )}
                        </svg>
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default IncrustationEscamotageGroupe;
