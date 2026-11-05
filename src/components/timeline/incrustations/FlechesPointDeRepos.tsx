import React from 'react';
import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { instantPointDeRepos } from './instantsActions';
import { entier } from '../../../utils/entier';

interface FlechesPointDeReposProps {
    ctx: ContexteIncrustations;
    pointReposActions: ActionAPlage[];
}

/** Points de repos : flèches verticales rouges. */
const FlechesPointDeRepos = ({ ctx, pointReposActions }: FlechesPointDeReposProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId, handleActionDragStart } = ctx;

    return (
        <>
            {/* Point de repos arrows - vertical red arrows */}
            {pointReposActions.map((action, idx) => {
                const rawDeb = entier(action.deb) || 0;
                const dernierRang = ctx.flechesBasAuPied ? groups.length : entier(action.plage2) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                const deb = instantPointDeRepos(ctx, action);
                if (deb === null) return null;

                // X position at deb
                const xPos = deb * pixelsPerSecond;

                // Arrow length fixed at 13 pixels
                const arrowLength = 13;

                // Upward arrow: ends just below plage2 row
                const upArrowEndY = RULER_HEIGHT + 1 + dernierRang * ROW_TOTAL_HEIGHT + 2;
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
                            {/* Invisible hover+drag zone */}
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
