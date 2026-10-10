import React from 'react';
import type { ContexteIncrustations, MorceauxPleineLargeur } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface IncrustationAdaptatifVerticalProps {
    ctx: ContexteIncrustations;
    adaptatifActions: ActionMicro[];
    morceauxPleineLargeur: MorceauxPleineLargeur;
}

/** Cadres des adaptatifs verticaux (pleine largeur ou sur leur plage). */
const IncrustationAdaptatifVertical = ({ ctx, adaptatifActions, morceauxPleineLargeur }: IncrustationAdaptatifVerticalProps) => {
    const { groups, pixelsPerSecond, effectiveCycleLength, RULER_HEIGHT, ROW_TOTAL_HEIGHT, hoveredActionId, setHoveredActionId, dragState, handleActionDragStart, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Adaptatif vertical overlays */}
            {adaptatifActions.map((action, idx) => {
                const origDeb = entier(action.deb) || 0;
                const origFin = entier(action.fin) || 0;
                // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                const plage1 = entier(action.plage1) || 0;
                const plage2 = entier(action.plage2) || 0;
                const avPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                const morceaux = avPlage
                    ? [{ ...getShiftedActionPosition(origDeb, origFin, null, 'Adaptatif vertical', avPlage, action.id), premierIdx: 0, dernierIdx: groups.length - 1 }]
                    : morceauxPleineLargeur(origDeb, origFin, 'Adaptatif vertical', action.id);
                return (
                    <React.Fragment key={`adaptatif-${idx}`}>
                        {morceaux.map((morceau, mIdx) => {
                            if (morceau.hidden) return null;
                            const deb = morceau.deb;
                            const fin = morceau.fin;
                            const leftPos = deb * pixelsPerSecond;
                            // Le libellé va dans le dernier morceau (en bas du cadre)
                            const abrv = mIdx === morceaux.length - 1 ? (action.abrv || '') : '';
                            const isHighlighted = hoveredActionId === action.id;

                            let topPos, height;
                            if (plage1 > 0 && plage2 > 0) {
                                // Plage values are group numbers (1-indexed)
                                const startGroup = Math.min(plage1, plage2) - 1;
                                const endGroup = Math.max(plage1, plage2) - 1;
                                topPos = RULER_HEIGHT + 1 + (startGroup * ROW_TOTAL_HEIGHT);
                                height = (endGroup - startGroup + 1) * ROW_TOTAL_HEIGHT + 8;
                            } else {
                                // No plage values - full height (or the rows of its section)
                                topPos = RULER_HEIGHT + 1 + morceau.premierIdx * ROW_TOTAL_HEIGHT;
                                height = (morceau.dernierIdx - morceau.premierIdx + 1) * ROW_TOTAL_HEIGHT +
                                    (morceau.dernierIdx === groups.length - 1 ? 8 : 0);
                            }

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (effectiveCycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = fin * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`adaptatif-${idx}-${mIdx}`}>
                                        {/* First part: from deb to end of cycle */}
                                        <div
                                            className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                            className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                                <span className="adaptatif-label">{abrv}</span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            }

                            const duration = fin - deb;
                            const width = duration * pixelsPerSecond;

                            return (
                                <div
                                    key={`adaptatif-${idx}-${mIdx}`}
                                    className={`adaptatif-overlay ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
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
                                        <span className="adaptatif-label">{abrv}</span>
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

export default IncrustationAdaptatifVertical;
