import React from 'react';
import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { entier } from '../../../utils/entier';

interface FlechesPointDeReposProps {
    ctx: ContexteIncrustations;
    pointReposActions: ActionAPlage[];
}

/** Points de repos : flèches verticales rouges. */
const FlechesPointDeRepos = ({ ctx, pointReposActions }: FlechesPointDeReposProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Point de repos arrows - vertical red arrows */}
            {pointReposActions.map((action, idx) => {
                const rawDeb = entier(action.deb) || 0;
                const plage1 = entier(action.plage1) || 0;
                const plage2 = entier(action.plage2) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                if (plage1 < 1 || plage2 < 1 || plage1 > groups.length || plage2 > groups.length) return null;

                // Apply time shifts in simulation mode
                const reposPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                const shiftedPos = getShiftedActionPosition(rawDeb, rawDeb, null, 'Point de repos', reposPlage);
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

                // Hover zone half-width (px)
                const hoverHalf = 6;
                return (
                    <React.Fragment key={`point-repos-${idx}`}>
                        <svg
                            className={`point-repos-arrows ${isHighlighted ? 'highlighted' : ''}`}
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
                                stroke="#ff0000"
                                strokeWidth="2"
                            />
                            {/* Downward arrow head (pointing down) */}
                            <polygon
                                points={`${xPos - arrowSize},${downArrowEndY} ${xPos + arrowSize},${downArrowEndY} ${xPos},${downArrowEndY + arrowSize * 1.5}`}
                                fill="#ff0000"
                            />
                            {/* Upward arrow line */}
                            <line
                                x1={xPos}
                                y1={upArrowStartY}
                                x2={xPos}
                                y2={upArrowEndY}
                                stroke="#ff0000"
                                strokeWidth="2"
                            />
                            {/* Upward arrow head (pointing up) */}
                            <polygon
                                points={`${xPos - arrowSize},${upArrowEndY} ${xPos + arrowSize},${upArrowEndY} ${xPos},${upArrowEndY - arrowSize * 1.5}`}
                                fill="#ff0000"
                            />
                            {/* Invisible hover+drag zones for both arrows */}
                            <rect
                                x={xPos - hoverHalf}
                                y={downArrowStartY}
                                width={hoverHalf * 2}
                                height={downArrowEndY + arrowSize * 1.5 - downArrowStartY}
                                fill="transparent"
                                style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', rawDeb)}
                            />
                            <rect
                                x={xPos - hoverHalf}
                                y={upArrowEndY - arrowSize * 1.5}
                                width={hoverHalf * 2}
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
                                className="point-repos-label"
                                style={{
                                    position: 'absolute',
                                    left: `${xPos}px`,
                                    top: `${labelY}px`,
                                    transform: 'translateX(-50%)',
                                    color: '#ffffff',
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

export default FlechesPointDeRepos;
