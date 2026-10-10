import React from 'react';
import type { ContexteIncrustations, MorceauxPleineLargeur } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface IncrustationEscamotageDePhaseProps {
    ctx: ContexteIncrustations;
    escamotageActions: ActionMicro[];
    morceauxPleineLargeur: MorceauxPleineLargeur;
}

/** Cadres des escamotages de phase. */
const IncrustationEscamotageDePhase = ({ ctx, escamotageActions, morceauxPleineLargeur }: IncrustationEscamotageDePhaseProps) => {
    const { groups, pixelsPerSecond, cycleLength, RULER_HEIGHT, ROW_TOTAL_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart } = ctx;

    return (
        <>
            {/* Escamotage de phase overlays */}
            {escamotageActions.map((action, idx) => {
                const origDeb = entier(action.deb) || 0;
                const origFin = entier(action.fin) || 0;
                // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                const morceaux = morceauxPleineLargeur(origDeb, origFin, 'Escamotage de phase', action.id);
                return (
                    <React.Fragment key={`escamotage-${idx}`}>
                        {morceaux.map((morceau, mIdx) => {
                            if (morceau.hidden) return null;
                            const deb = morceau.deb;
                            const fin = morceau.fin;
                            // Le libellé va dans le dernier morceau (en bas du cadre)
                            const abrv = mIdx === morceaux.length - 1 ? (action.abrv || '') : '';
                            const isHighlighted = hoveredActionId === action.id;

                            const leftPos = deb * pixelsPerSecond;

                            // Cover all rows (or the rows of its section), starting just below
                            // ruler (12px above rows) and 22px below
                            const topPos = morceau.premierIdx === 0 ? RULER_HEIGHT - 12 : RULER_HEIGHT + morceau.premierIdx * ROW_TOTAL_HEIGHT;
                            const bottomPos = morceau.dernierIdx === groups.length - 1
                                ? RULER_HEIGHT + groups.length * ROW_TOTAL_HEIGHT + 22
                                : RULER_HEIGHT + (morceau.dernierIdx + 1) * ROW_TOTAL_HEIGHT;
                            const height = bottomPos - topPos;

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = Math.max(0, fin) * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`escamotage-${idx}-${mIdx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: `${leftPos}px`,
                                                width: `${firstPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-start"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}

                                            />
                                        </div>
                                        {/* Second part: from start of cycle to fin */}
                                        <div
                                            className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                            style={{
                                                left: '0px',
                                                width: `${secondPartWidth}px`,
                                                top: `${topPos}px`,
                                                height: `${height}px`
                                            }}
                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                            onMouseLeave={() => setHoveredActionId(null)}
                                        >
                                            <div
                                                className="action-drag-handle action-drag-handle-end"
                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}

                                            />
                                            {abrv && (
                                                <span className="escamotage-label">{abrv}</span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            const duration = Math.max(0, fin - deb);
                            const width = duration * pixelsPerSecond;

                            return (
                                <div
                                    key={`escamotage-${idx}-${mIdx}`}
                                    className={`escamotage-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                    style={{
                                        left: `${leftPos}px`,
                                        width: `${width}px`,
                                        top: `${topPos}px`,
                                        height: `${height}px`
                                    }}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                >
                                    {/* Drag handle for start (left edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-start"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}


                                    />
                                    {/* Drag handle for end (right edge) */}
                                    <div
                                        className="action-drag-handle action-drag-handle-end"
                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}


                                    />
                                    {abrv && (
                                        <span className="escamotage-label">{abrv}</span>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default IncrustationEscamotageDePhase;
