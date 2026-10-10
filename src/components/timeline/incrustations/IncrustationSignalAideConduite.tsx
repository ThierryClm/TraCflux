import React from 'react';
import type { CSSProperties } from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface IncrustationSignalAideConduiteProps {
    ctx: ContexteIncrustations;
    signaActions: ActionMicro[];
}

/** Signaux d'aide à la conduite. */
const IncrustationSignalAideConduite = ({ ctx, signaActions }: IncrustationSignalAideConduiteProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_HEIGHT, ROW_TOTAL_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Signa d'aide à la conduite overlays */}
            {signaActions.map((action, idx) => {
                const gf = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const rawDeb = entier(action.deb) || 0;
                const rawFin = entier(action.fin) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                // Find group index in array
                const groupIndex = groups.findIndex(g => g.id === gf);
                if (groupIndex === -1) return null;

                // Apply time shifts (from contractions) in simulation mode
                const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Signal aide conduite');
                if (shiftedPos.hidden) return null;
                const deb = shiftedPos.deb;
                const fin = shiftedPos.fin;
                const blueStart = fin - 5;

                // Calculate positions
                const orangeLeftPos = deb * pixelsPerSecond;
                const orangeDuration = blueStart - deb; // From Déb to (Fin-5)
                const orangeWidth = orangeDuration * pixelsPerSecond;
                const blueLeftPos = blueStart * pixelsPerSecond;
                const blueWidth = 5 * pixelsPerSecond; // Blue zone (5s at end)
                const totalWidth = (fin - deb) * pixelsPerSecond;

                // Calculate stripe width based on 1 second interval
                const stripeWidth = pixelsPerSecond;

                // Vertical position based on group index (height reduced by 2/3 total)
                const height = Math.round((ROW_HEIGHT - 14) * 4 / 9);
                const topPos = RULER_HEIGHT + 1 + (groupIndex * ROW_TOTAL_HEIGHT) + Math.floor((ROW_HEIGHT - height) / 2);

                return (
                    <React.Fragment key={`signa-${idx}`}>
                        {/* Wrapper for drag handles */}
                        <div
                            className={`signa-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                position: 'absolute',
                                left: `${orangeLeftPos}px`,
                                width: `${totalWidth}px`,
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
                        {/* Orange intermittent bar at start */}
                        <div
                            className={`signa-orange-bar ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                left: `${orangeLeftPos}px`,
                                width: `${orangeWidth}px`,
                                top: `${topPos}px`,
                                height: `${height}px`,
                                '--stripe-width': `${stripeWidth}px`
                            } as CSSProperties}
                        />
                        {/* Blue bar at end (last 5s) */}
                        <div
                            className={`signa-blue-bar ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                left: `${blueLeftPos}px`,
                                width: `${blueWidth}px`,
                                top: `${topPos}px`,
                                height: `${height}px`
                            }}
                        >
                        </div>
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default IncrustationSignalAideConduite;
