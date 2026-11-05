import React from 'react';
import type { ActionAPlage, ContexteIncrustations } from './contexteIncrustations';
import { instantRepereFixe } from './instantsActions';
import { entier } from '../../../utils/entier';

interface FlechesInstantCoProps {
    ctx: ContexteIncrustations;
    instantCoActions: ActionAPlage[];
}

/** Instants Co : flèches verticales orange. */
const FlechesInstantCo = ({ ctx, instantCoActions }: FlechesInstantCoProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId, handleActionDragStart } = ctx;

    return (
        <>
            {/* Instant Co arrows - vertical orange arrows */}
            {instantCoActions.map((action, idx) => {
                const rawDeb = entier(action.deb) || 0;
                const dernierRang = ctx.flechesBasAuPied ? groups.length : entier(action.plage2) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                const deb = instantRepereFixe(ctx, action);
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
                            {/* Invisible hover+drag zone */}
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
