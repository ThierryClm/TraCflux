import React from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';

interface FlechesFinBandePassanteProps {
    ctx: ContexteIncrustations;
    dashedPath: (x1: number, y1: number, x2: number, y2: number, dashLength?: number) => string;
    finBandeActions: ActionMicro[];
}

/** Fins de bande passante : flèches obliques rouges en pointillés. */
const FlechesFinBandePassante = ({ ctx, dashedPath, finBandeActions }: FlechesFinBandePassanteProps) => {
    const { groups, pixelsPerSecond, cycleLength, RULER_HEIGHT, ROW_HEIGHT, ROW_TOTAL_HEIGHT, svgHeight, totalWidth, hoveredActionId, setHoveredActionId, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Fin de bande passante arrows - dashed red diagonal arrows */}
            {finBandeActions.map((action, idx) => {
                const gf = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const rawDeb = entier(action.deb) || 0;
                const rawFin = entier(action.fin) || 0;
                const actGf1 = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const abrv = action.abrv || '';
                const isHighlighted = hoveredActionId === action.id;

                // Find group indices
                const startGroupIndex = groups.findIndex(g => g.id === gf);
                const endGroupIndex = groups.findIndex(g => g.id === actGf1);
                if (startGroupIndex === -1 || endGroupIndex === -1) return null;

                // Apply time shifts in simulation mode
                const shiftedPos = getShiftedActionPosition(rawDeb, rawFin, gf, 'Fin de bande passante');
                if (shiftedPos.hidden) return null;
                const deb = shiftedPos.deb;
                const fin = shiftedPos.fin;

                // Calculate positions (same as début: from gf at deb to actGf1 at fin)
                const startX = deb * pixelsPerSecond;
                const endX = fin * pixelsPerSecond;
                const startY = RULER_HEIGHT + 1 + (startGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                const endY = RULER_HEIGHT + 1 + (endGroupIndex * ROW_TOTAL_HEIGHT) + (ROW_HEIGHT / 2);
                const cycleEndX = cycleLength * pixelsPerSecond;

                // Arrow head size
                const arrowSize = 4;

                // Check if arrow wraps around cycle (deb > fin)
                const wrapsAround = deb > fin;

                if (wrapsAround) {
                    // Calculate intermediate Y at cycle boundary
                    const totalXDistance = (cycleLength - deb) + fin;
                    const firstSegmentRatio = (cycleLength - deb) / totalXDistance;
                    const intermediateY = startY + (endY - startY) * firstSegmentRatio;

                    // Angle for second segment arrow head
                    const angle2 = Math.atan2(endY - intermediateY, endX - 0);

                    return (
                        <React.Fragment key={`fin-bande-${idx}`}>
                            <svg
                                className={`fin-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                                width={totalWidth}
                                height={svgHeight}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    pointerEvents: 'none',
                                    zIndex: 50,
                                    overflow: 'visible'
                                }}
                            >
                                {/* First segment: from start to end of cycle */}
                                {/* Doublure transparente, sur la TRAJECTOIRE et non sur les
                                    tirets : le tracé visible ne fait que
                                    0,7 px, impossible à viser. Celle-ci ne se voit pas mais
                                    se survole, et l'événement remonte au <svg>. */}
                                <path d={`M${startX},${startY}L${cycleEndX},${intermediateY}`} className="bande-prise" stroke="transparent" strokeWidth="16" fill="none" style={{ pointerEvents: 'stroke' }} />
                                <path d={dashedPath(startX, startY, cycleEndX, intermediateY)} stroke="#00cc00" strokeWidth="0.7" fill="none" />
                                {/* Second segment: from start of cycle to end */}
                                {/* Doublure transparente, sur la TRAJECTOIRE et non sur les
                                    tirets : le tracé visible ne fait que
                                    0,7 px, impossible à viser. Celle-ci ne se voit pas mais
                                    se survole, et l'événement remonte au <svg>. */}
                                <path d={`M${0},${intermediateY}L${endX},${endY}`} className="bande-prise" stroke="transparent" strokeWidth="16" fill="none" style={{ pointerEvents: 'stroke' }} />
                                <path d={dashedPath(0, intermediateY, endX, endY)} stroke="#00cc00" strokeWidth="0.7" fill="none" />
                                {/* Arrow head at end */}
                                <polygon
                                    points={`
                                                    ${endX},${endY}
                                                    ${endX - arrowSize * Math.cos(angle2 - Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 - Math.PI / 6)}
                                                    ${endX - arrowSize * Math.cos(angle2 + Math.PI / 6)},${endY - arrowSize * Math.sin(angle2 + Math.PI / 6)}
                                                `}
                                    fill="#00cc00"
                                    stroke="none"
                                />
                            </svg>
                        </React.Fragment>
                    );
                }

                const angle = Math.atan2(endY - startY, endX - startX);

                return (
                    <React.Fragment key={`fin-bande-${idx}`}>
                        <svg
                            className={`fin-bande-arrows ${isHighlighted ? 'highlighted' : ''}`}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            width={totalWidth}
                            height={svgHeight}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none',
                                zIndex: 50,
                                overflow: 'visible'
                            }}
                        >
                            {/* Dashed diagonal line */}
                            {/* Doublure transparente, sur la TRAJECTOIRE et non sur les
                                    tirets : le tracé visible ne fait que
                                0,7 px, impossible à viser. Celle-ci ne se voit pas mais
                                se survole, et l'événement remonte au <svg>. */}
                            <path d={`M${startX},${startY}L${endX},${endY}`} className="bande-prise" stroke="transparent" strokeWidth="16" fill="none" style={{ pointerEvents: 'stroke' }} />
                            <path d={dashedPath(startX, startY, endX, endY)} stroke="#00cc00" strokeWidth="0.7" fill="none" />
                            {/* Arrow head at end */}
                            <polygon
                                points={`
                                                ${endX},${endY}
                                                ${endX - arrowSize * Math.cos(angle - Math.PI / 6)},${endY - arrowSize * Math.sin(angle - Math.PI / 6)}
                                                ${endX - arrowSize * Math.cos(angle + Math.PI / 6)},${endY - arrowSize * Math.sin(angle + Math.PI / 6)}
                                            `}
                                fill="#00cc00"
                                stroke="none"
                            />
                        </svg>
                    </React.Fragment>
                );
            })}
        </>
    );
};

export default FlechesFinBandePassante;
