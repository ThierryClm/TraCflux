import React from 'react';
import type { CSSProperties } from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface BarreFlecheAnticipationProps {
    ctx: ContexteIncrustations;
    flecheAnticipationActions: ActionMicro[];
}

/** Flèches d'anticipation : barre jaune intermittente. */
const BarreFlecheAnticipation = ({ ctx, flecheAnticipationActions }: BarreFlecheAnticipationProps) => {
    const { groups, pixelsPerSecond, effectiveCycleLength, RULER_HEIGHT, ROW_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Flèche d'anticipation - intermittent yellow bar (same as Priorité piétons) */}
            {flecheAnticipationActions.map((action, idx) => {
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
                const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, "Flèche d'anticipation");
                if (shiftedPos.hidden) return null;
                const deb = shiftedPos.deb;
                const fin = shiftedPos.fin;

                // Check for wrap-around (fin < deb means the bar crosses cycle boundary)
                const wrapsAround = deb > fin;

                // Vertical position aligned with the group's phase bar
                const height = ROW_HEIGHT - 14;
                const rowTotalHeight = ROW_HEIGHT + 1;
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
                        <React.Fragment key={`fleche-anticipation-${idx}`}>
                            {/* First part: from deb to end of cycle */}
                            <div
                                className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                <div
                                    className="action-drag-handle action-drag-handle-start"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                    style={{ pointerEvents: 'auto' }}
                                />
                            </div>
                            <div
                                className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                style={barStyle(firstPartLeft, firstPartWidth)}
                            />
                            {/* Second part: from start of cycle to fin */}
                            <div
                                className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                <div
                                    className="action-drag-handle action-drag-handle-end"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                    style={{ pointerEvents: 'auto' }}
                                />
                            </div>
                            <div
                                className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                style={barStyle(secondPartLeft, secondPartWidth)}
                            >
                            </div>
                        </React.Fragment>
                    );
                } else {
                    // Normal case: single bar
                    const leftPos = deb * pixelsPerSecond;
                    const barWidth = (fin - deb) * pixelsPerSecond;

                    return (
                        <React.Fragment key={`fleche-anticipation-${idx}`}>
                            <div
                                className={`fleche-anticipation-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                <div
                                    className="action-drag-handle action-drag-handle-start"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                    style={{ pointerEvents: 'auto' }}
                                />
                                <div
                                    className="action-drag-handle action-drag-handle-end"
                                    onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                    style={{ pointerEvents: 'auto' }}
                                />
                            </div>
                            <div
                                className={`fleche-anticipation-bar ${isHighlighted ? 'highlighted' : ''}`}
                                style={barStyle(leftPos, barWidth)}
                            >
                            </div>
                        </React.Fragment>
                    );
                }
            })}
        </>
    );
};

export default BarreFlecheAnticipation;
