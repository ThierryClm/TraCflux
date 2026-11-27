import React from 'react';
import type { CSSProperties } from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';
import { zonesControleFlot, type ReposControleFlot } from '../../../utils/groupColorAtTime';

interface IncrustationControleDeFlotProps {
    ctx: ContexteIncrustations;
    controleFlotActions: ActionMicro[];
    /** Points de repos simulés : l'état tenu prolonge la zone en cours. */
    repos?: ReposControleFlot[];
}

/** Contrôles de flot. */
const IncrustationControleDeFlot = ({ ctx, controleFlotActions, repos = [] }: IncrustationControleDeFlotProps) => {
    const { groups, pixelsPerSecond, RULER_HEIGHT, ROW_HEIGHT, ROW_TOTAL_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart } = ctx;

    return (
        <>
            {/* Contrôle de flot overlays */}
            {controleFlotActions.map((action, idx) => {
                const gf = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const deb = entier(action.deb) || 0;
                const fin = entier(action.fin) || 0;
                const isHighlighted = hoveredActionId === action.id;

                // Find group and get minGreen and orange duration
                const group = groups.find(g => g.id === gf);
                if (!group) return null;

                const groupIndex = groups.findIndex(g => g.id === gf);
                if (groupIndex === -1) return null;

                const minGreen = group.minGreen || 0;
                const orangeDuration = group.durations?.orange || 3;

                // Trois zones : trame d'amorce, jaune fixe, rouge. Un point de
                // repos tombant dans la plage tient l'état en cours et prolonge
                // la zone correspondante (le rouge va alors jusqu'au-delà de FIN).
                const zones = zonesControleFlot(deb, fin, minGreen, orangeDuration, repos);
                const finEffective = zones.fin;

                // Positions in pixels
                const intermittentLeft = deb * pixelsPerSecond;
                const intermittentWidth = (zones.intermittentEnd - deb) * pixelsPerSecond;
                const orangeLeft = zones.intermittentEnd * pixelsPerSecond;
                const orangeWidth = (zones.orangeEnd - zones.intermittentEnd) * pixelsPerSecond;
                const redLeft = zones.orangeEnd * pixelsPerSecond;
                const redWidth = Math.max(0, (finEffective - zones.orangeEnd)) * pixelsPerSecond;
                const totalWidth = (finEffective - deb) * pixelsPerSecond;

                // Stripe width for intermittent pattern (1 second)
                const stripeWidth = pixelsPerSecond;

                // Vertical position
                const height = Math.round((ROW_HEIGHT - 14) * 4 / 9);
                const topPos = RULER_HEIGHT + 1 + (groupIndex * ROW_TOTAL_HEIGHT) + Math.floor((ROW_HEIGHT - height) / 2);

                return (
                    <React.Fragment key={`controle-flot-${idx}`}>
                        {/* Wrapper for drag handles */}
                        <div
                            className={`controle-flot-wrapper ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                            style={{
                                position: 'absolute',
                                left: `${intermittentLeft}px`,
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
                        {/* Intermittent yellow/gray bar (from DEB to minGreen) */}
                        {intermittentWidth > 0 && (
                            <div
                                className={`controle-flot-intermittent ${isHighlighted ? 'highlighted' : ''}`}
                                style={{
                                    left: `${intermittentLeft}px`,
                                    width: `${intermittentWidth}px`,
                                    top: `${topPos}px`,
                                    height: `${height}px`,
                                    '--stripe-width': `${stripeWidth}px`
                                } as CSSProperties}
                            />
                        )}
                        {/* Orange/Yellow solid bar (orange duration) */}
                        {orangeWidth > 0 && (
                            <div
                                className={`controle-flot-orange ${isHighlighted ? 'highlighted' : ''}`}
                                style={{
                                    left: `${orangeLeft}px`,
                                    width: `${orangeWidth}px`,
                                    top: `${topPos}px`,
                                    height: `${height}px`
                                }}
                            />
                        )}
                        {/* Red bar (from orange end to FIN) */}
                        {redWidth > 0 && (
                            <div
                                className={`controle-flot-red ${isHighlighted ? 'highlighted' : ''}`}
                                style={{
                                    left: `${redLeft}px`,
                                    width: `${redWidth}px`,
                                    top: `${topPos}px`,
                                    height: `${height}px`
                                }}
                            >
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default IncrustationControleDeFlot;
