import React from 'react';
import type { CSSProperties } from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface BarrePrioritePietonsProps {
    ctx: ContexteIncrustations;
    prioritePietonsActions: ActionMicro[];
}

/** Priorités piétons : barre jaune intermittente. */
const BarrePrioritePietons = ({ ctx, prioritePietonsActions }: BarrePrioritePietonsProps) => {
    const { groups, pixelsPerSecond, effectiveCycleLength, RULER_HEIGHT, ROW_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Priorité piétons - intermittent yellow bar */}
            {prioritePietonsActions.map((action, idx) => {
                const gf = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const rawDeb = entier(action.deb) || 0;
                const rawFin = entier(action.fin) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                // Find group index in array
                const groupIndex = groups.findIndex(g => g.id === gf);
                if (groupIndex === -1) return null;
                if (rawDeb === rawFin) return null;

                // Apply time shifts (from Adaptatif vertical) in simulation mode
                const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Priorité piétons');
                if (shiftedPos.hidden) return null;
                const deb = shiftedPos.deb;
                const fin = shiftedPos.fin;

                // Check for wrap-around (fin < deb means the bar crosses cycle boundary)
                const wrapsAround = deb > fin;

                // Vertical position aligned with the group's phase bar
                // The ruler has height RULER_HEIGHT (50px) + 1px border-bottom = 51px
                // Each row has height ROW_HEIGHT (30px) + 1px border-bottom = 31px
                const height = ROW_HEIGHT - 14;
                const rowTotalHeight = ROW_HEIGHT + 1; // 30px height + 1px border
                const topPos = RULER_HEIGHT + 1 + (groupIndex * rowTotalHeight) + Math.floor((ROW_HEIGHT - height) / 2);

                // Stripe width based on 1 second interval
                const stripeWidth = pixelsPerSecond;

                // Common style for the yellow intermittent bar
                const barStyle = (left: number, width: number): CSSProperties => ({
                    position: 'absolute',
                    left: `${left}px`,
                    width: `${width}px`,
                    top: `${topPos}px`,
                    height: `${height}px`,
                    borderRadius: '2px',
                    pointerEvents: 'none',
                    zIndex: 15,
                    background: `repeating-linear-gradient(
                                    90deg,
                                    #FFFF00,
                                    #FFFF00 ${stripeWidth}px,
                                    transparent ${stripeWidth}px,
                                    transparent ${stripeWidth * 2}px
                                )`,
                    boxShadow: '0 0 3px rgba(255, 255, 0, 0.5)'
                });

                if (wrapsAround) {
                    // Wrap-around case: draw 2 bars
                    const firstPartLeft = deb * pixelsPerSecond;
                    const firstPartWidth = (effectiveCycleLength - deb) * pixelsPerSecond;
                    const secondPartLeft = 0;
                    const secondPartWidth = fin * pixelsPerSecond;

                    return (
                        <React.Fragment key={`priorite-pietons-${idx}`}>
                            {/* First part: from deb to end of cycle */}
                            <div
                                className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: `${firstPartLeft}px`,
                                    width: `${firstPartWidth}px`,
                                    top: `${topPos}px`,
                                    height: `${height}px`,
                                    pointerEvents: 'auto'
                                }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                {/* Drag handle for start (left edge) */}
                                <div
                                    className="action-drag-handle action-drag-handle-start"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                    style={{ pointerEvents: 'auto' }}
                                />
                            </div>
                            <div
                                className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                                style={barStyle(firstPartLeft, firstPartWidth)}
                            />

                            {/* Second part: from start of cycle to fin */}
                            <div
                                className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                style={{
                                    position: 'absolute',
                                    left: `${secondPartLeft}px`,
                                    width: `${secondPartWidth}px`,
                                    top: `${topPos}px`,
                                    height: `${height}px`,
                                    pointerEvents: 'auto'
                                }}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                {/* Drag handle for end (right edge) */}
                                <div
                                    className="action-drag-handle action-drag-handle-end"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                    style={{ pointerEvents: 'auto', left: 'auto', right: '0' }}
                                />
                            </div>
                            <div
                                className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                                style={barStyle(secondPartLeft, secondPartWidth)}
                            >
                            </div>
                        </React.Fragment>
                    );
                }

                // Normal case: single bar
                const leftPos = deb * pixelsPerSecond;
                const barWidth = (fin - deb) * pixelsPerSecond;

                return (
                    <React.Fragment key={`priorite-pietons-${idx}`}>
                        {/* Wrapper for drag handles */}
                        <div
                            className={`priorite-pietons-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                position: 'absolute',
                                left: `${leftPos}px`,
                                width: `${barWidth}px`,
                                top: `${topPos}px`,
                                height: `${height}px`,
                                pointerEvents: 'auto'
                            }}
                            onMouseEnter={() => setHoveredActionId(action.id)}
                            onMouseLeave={() => setHoveredActionId(null)}
                        >
                            {/* Drag handle for start (left edge) */}
                            <div
                                className="action-drag-handle action-drag-handle-start"
                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                style={{ pointerEvents: 'auto' }}
                            />
                            {/* Drag handle for end (right edge) */}
                            <div
                                className="action-drag-handle action-drag-handle-end"
                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                style={{ pointerEvents: 'auto' }}
                            />
                        </div>
                        {/* Intermittent yellow bar */}
                        <div
                            className={`priorite-pietons-bar ${isHighlighted ? 'highlighted' : ''}`}
                            style={barStyle(leftPos, barWidth)}
                        >
                        </div>
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default BarrePrioritePietons;
