import React from 'react';
import type { CSSProperties } from 'react';
import type { ContexteIncrustations } from './contexteIncrustations';
import type { SimulatedGroup } from '../../../simulation/types';

interface BarresGroupesFlPpProps {
    ctx: ContexteIncrustations;
    getSimulatedGroup: (groupId: number) => SimulatedGroup | null;
}

/** Groupes de type FL ou PP : barre jaune intermittente sur la phase verte. */
const BarresGroupesFlPp = ({ ctx, getSimulatedGroup }: BarresGroupesFlPpProps) => {
    const { groups, pixelsPerSecond, effectiveCycleLength, RULER_HEIGHT, ROW_HEIGHT } = ctx;

    return (
        <>
            {/* Groupes de type FL ou PP - intermittent yellow bar based on green phase */}
            {groups.filter(g => g.type === 'FL' || g.type === 'PP').map((group, idx) => {
                const groupIndex = groups.findIndex(g => g.id === group.id);
                if (groupIndex === -1) return null;

                // Use simulated group data if available
                const simGroup = getSimulatedGroup(group.id);
                const offset = simGroup ? simGroup.simulatedOffset : group.offset;
                const greenDuration = simGroup ? simGroup.simulatedGreen : group.durations.green;

                if (greenDuration <= 0) return null;

                const deb = offset;
                const fin = (offset + greenDuration) % effectiveCycleLength;

                // Check for wrap-around
                const wrapsAround = offset + greenDuration > effectiveCycleLength;

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
                        <React.Fragment key={`type-fl-pp-${group.id}-${idx}`}>
                            <div
                                className="type-fl-pp-bar"
                                style={barStyle(firstPartLeft, firstPartWidth)}
                            />
                            <div
                                className="type-fl-pp-bar"
                                style={barStyle(secondPartLeft, secondPartWidth)}
                            />
                        </React.Fragment>
                    );
                } else {
                    // Normal case: single bar
                    const leftPos = deb * pixelsPerSecond;
                    const barWidth = greenDuration * pixelsPerSecond;

                    return (
                        <div
                            key={`type-fl-pp-${group.id}-${idx}`}
                            className="type-fl-pp-bar"
                            style={barStyle(leftPos, barWidth)}
                        />
                    );
                }
            })}
        </>
    );
};

export default BarresGroupesFlPp;
