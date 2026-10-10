import React from 'react';
import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { entier } from '../../../utils/entier';

interface FlechesInstantCoProps {
    ctx: ContexteIncrustations;
    instantCoActions: ActionAPlage[];
}

/** Instants Co : flèches verticales orange. */
const FlechesInstantCo = ({ ctx, instantCoActions }: FlechesInstantCoProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Instant Co arrows - vertical orange arrows */}
            {instantCoActions.map((action, idx) => {
                const rawDeb = entier(action.deb) || 0;
                const plage1 = entier(action.plage1) || 0;
                const plage2 = entier(action.plage2) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                // Apply time shifts in simulation mode
                const coPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                const shiftedPos = getShiftedActionPosition(rawDeb, rawDeb, null, 'Instant Co', coPlage);
                if (shiftedPos.hidden) return null;
                const deb = shiftedPos.deb;

                // X position at deb
                const xPos = deb * pixelsPerSecond;

                // Arrow length fixed at 13 pixels
                const arrowLength = 13;

                // Downward arrow: ends just above plage1 row
                const downArrowEndY = RULER_HEIGHT + 1 + (plage1 - 1) * ROW_TOTAL_HEIGHT - 2;
                const downArrowStartY = downArrowEndY - arrowLength;

                // Upward arrow: ends just below plage2 row
                const upArrowEndY = RULER_HEIGHT + 1 + plage2 * ROW_TOTAL_HEIGHT + 2;
                const upArrowStartY = upArrowEndY + arrowLength;

                // Arrow head size
                const arrowSize = 5;

                // Label position below the diagram
                const labelY = RULER_HEIGHT + 1 + groups.length * ROW_TOTAL_HEIGHT + 20;

                return (
                    <React.Fragment key={`instant-co-${idx}`}>
                        <svg
                            className={`instant-co-arrows ${isHighlighted ? 'highlighted' : ''}`}
                            width={totalWidth}
                            height={svgHeight}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none',
                                zIndex: 100,
                                overflow: 'visible'
                            }}
                        >
                            {/* Downward arrow line */}
                            <line
                                x1={xPos}
                                y1={downArrowStartY}
                                x2={xPos}
                                y2={downArrowEndY}
                                stroke="#FF8C00"
                                strokeWidth="2"
                            />
                            {/* Downward arrow head (pointing down) */}
                            <polygon
                                points={`${xPos - arrowSize},${downArrowEndY} ${xPos + arrowSize},${downArrowEndY} ${xPos},${downArrowEndY + arrowSize * 1.5}`}
                                fill="#FF8C00"
                            />
                            {/* Upward arrow line */}
                            <line
                                x1={xPos}
                                y1={upArrowStartY}
                                x2={xPos}
                                y2={upArrowEndY}
                                stroke="#FF8C00"
                                strokeWidth="2"
                            />
                            {/* Upward arrow head (pointing up) */}
                            <polygon
                                points={`${xPos - arrowSize},${upArrowEndY} ${xPos + arrowSize},${upArrowEndY} ${xPos},${upArrowEndY - arrowSize * 1.5}`}
                                fill="#FF8C00"
                            />
                            {/* Invisible hover+drag zones */}
                            <rect
                                x={xPos - 6}
                                y={downArrowStartY}
                                width={12}
                                height={downArrowEndY + arrowSize * 1.5 - downArrowStartY}
                                fill="transparent"
                                style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', rawDeb)}
                            />
                            <rect
                                x={xPos - 6}
                                y={upArrowEndY - arrowSize * 1.5}
                                width={12}
                                height={upArrowStartY - (upArrowEndY - arrowSize * 1.5)}
                                fill="transparent"
                                style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', rawDeb)}
                            />
                        </svg>
                        {/* Label below diagram */}
                        {abrv && (
                            <div
                                className="instant-co-label"
                                style={{
                                    position: 'absolute',
                                    left: `${xPos}px`,
                                    top: `${labelY}px`,
                                    transform: 'translateX(-50%)',
                                    color: '#FF8C00',
                                    fontSize: '0.7em',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap',
                                    zIndex: 100
                                }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                {abrv}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default FlechesInstantCo;
