import type { ContexteIncrustations } from './contexteIncrustations';
import type { SimulatedGroup, SimulationResult } from '../../../simulation/types';
import type { ActionMicro } from '../../../types/projet';
import { entier } from '../../../utils/entier';
import type { GroupId } from '../timelineSimulation';

interface FlechesFermetureAnticipeeProps {
    ctx: ContexteIncrustations;
    doesGroupWrap: (groupId: GroupId) => boolean;
    fermetureActions: ActionMicro[];
    getGroupEndPos: (groupId: GroupId) => number | null;
    getGroupRowY: (groupId: GroupId) => number | null;
    getGroupStartPos: (groupId: GroupId) => number | null;
    getSimulatedGroup: (groupId: number) => SimulatedGroup | null;
    simulationResult: SimulationResult | null;
}

/** Flèches des fermetures anticipées, du groupe source vers les groupes visés. */
const FlechesFermetureAnticipee = ({ ctx, doesGroupWrap, fermetureActions, getGroupEndPos, getGroupRowY, getGroupStartPos, getSimulatedGroup, simulationResult }: FlechesFermetureAnticipeeProps) => {
    const { groups, pixelsPerSecond, cycleLength, effectiveCycleLength, svgHeight, totalWidth, getShiftedActionPosition } = ctx;

    return (
        <>
            {/* Fermeture anticipée arrows */}
            {fermetureActions.map((action, idx) => {
                const sourceGf = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const origDeb = entier(action.deb) || 0;
                const fin = entier(action.fin) || 0;

                // Check if overlay is hidden (e.g. within AV zone)
                if (simulationResult) {
                    const shifted = getShiftedActionPosition(origDeb, fin, sourceGf, 'Fermeture anticipée');
                    if (shifted.hidden) return null;
                    // Also hide if effective duration is 0
                    if (shifted.deb === shifted.fin) return null;
                }

                // Get target groups from ActGF1, ActGF2, ActGF3, ActGF4
                const targets = [];
                if (action.actGf1) {
                    const targetId = entier(action.actGf1.toString().replace(/[Gg]/g, '').trim());
                    if (targetId) targets.push(targetId);
                }
                if (action.actGf1Gf2) {
                    const targetId = entier(action.actGf1Gf2.toString().replace(/[Gg]/g, '').trim());
                    if (targetId) targets.push(targetId);
                }
                if (action.actGf1Gf3) {
                    const targetId = entier(action.actGf1Gf3.toString().replace(/[Gg]/g, '').trim());
                    if (targetId) targets.push(targetId);
                }
                if (action.actGf1Gf4) {
                    const targetId = entier(action.actGf1Gf4.toString().replace(/[Gg]/g, '').trim());
                    if (targetId) targets.push(targetId);
                }

                return targets.map((targetGf, tIdx) => {
                    const targetStartPos = getGroupStartPos(targetGf);
                    if (targetStartPos === null) return null;

                    // Check if target group (Action GF) overlaps with source group (GF)
                    // Get source group green period
                    const sourceGroup = groups.find(g => g.id === sourceGf);
                    const targetGroup = groups.find(g => g.id === targetGf);
                    if (!sourceGroup || !targetGroup) return null;

                    // Skip if source group is escamoted or has no green duration
                    const sourceSimGroup = getSimulatedGroup(sourceGf);
                    if (sourceSimGroup?.isEscamoted || (sourceSimGroup?.simulatedGreen !== undefined && sourceSimGroup.simulatedGreen <= 0)) {
                        return null;
                    }

                    const sourceStart = getGroupStartPos(sourceGf);
                    const sourceEnd = getGroupEndPos(sourceGf);
                    const targetEnd = getGroupEndPos(targetGf);

                    // Check if target group's green overlaps with source group's green
                    // Overlap occurs if target's green period intersects with source's green period
                    const cycle = simulationResult ? effectiveCycleLength : cycleLength;
                    let groupsOverlap = false;

                    if (sourceStart !== null && sourceEnd !== null && targetEnd !== null) {
                        // Handle wrap-around cases
                        const sourceWraps = doesGroupWrap(sourceGf);
                        const targetWraps = doesGroupWrap(targetGf);

                        if (!sourceWraps && !targetWraps) {
                            // Neither wraps: simple overlap check
                            groupsOverlap = (targetStartPos < sourceEnd && targetEnd > sourceStart);
                        } else if (sourceWraps && !targetWraps) {
                            // Source wraps: target overlaps if it's in [sourceStart, cycle] or [0, sourceEnd]
                            groupsOverlap = (targetStartPos >= sourceStart || targetEnd <= sourceEnd);
                        } else if (!sourceWraps && targetWraps) {
                            // Target wraps: overlaps if source intersects [targetStart, cycle] or [0, targetEnd]
                            groupsOverlap = (sourceStart <= targetEnd || sourceEnd >= targetStartPos);
                        } else {
                            // Both wrap: they definitely overlap
                            groupsOverlap = true;
                        }
                    }

                    // If groups overlap, point to end of target's green, otherwise to start
                    const targetPos = groupsOverlap ? targetEnd : targetStartPos;

                    // Calculate positions using actual group indices
                    const sourceY = getGroupRowY(sourceGf);
                    const targetY = getGroupRowY(targetGf);
                    if (sourceY === null || targetY === null) return null;
                    if (sourceEnd === null || targetPos === null) return null;
                    // Use the group's actual end position (already accounts for simulation)
                    // This ensures the arrow follows the group's green bar end, not just the action's fin value
                    const sourceX = sourceEnd * pixelsPerSecond;
                    const targetX = targetPos * pixelsPerSecond;
                    const cycleEndX = effectiveCycleLength * pixelsPerSecond;

                    // If arrow would go backwards, split into two segments
                    if (sourceX > targetX) {
                        return (
                            <svg
                                key={`arrow-${idx}-${tIdx}`}
                                className="fermeture-arrow"

                                width={totalWidth}
                                height={svgHeight}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    pointerEvents: 'none',
                                    zIndex: 20
                                }}
                            >
                                <defs>
                                    <marker
                                        id={`arrowhead-${idx}-${tIdx}`}
                                        markerWidth="6"
                                        markerHeight="4"
                                        refX="6"
                                        refY="2"
                                        orient="auto"
                                    >
                                        <polygon
                                            points="0 0, 6 2, 0 4"
                                            fill="#ff0000"
                                        />
                                    </marker>
                                </defs>
                                {/* First segment: from source to end of cycle */}
                                <line
                                    x1={sourceX}
                                    y1={sourceY}
                                    x2={cycleEndX}
                                    y2={sourceY + (targetY - sourceY) * ((cycleEndX - sourceX) / (cycleEndX - sourceX + targetX))}
                                    stroke="#ff0000"
                                    strokeWidth="1.5"
                                />
                                {/* Second segment: from start of cycle to target */}
                                <line
                                    x1={0}
                                    y1={sourceY + (targetY - sourceY) * ((cycleEndX - sourceX) / (cycleEndX - sourceX + targetX))}
                                    x2={targetX}
                                    y2={targetY}
                                    stroke="#ff0000"
                                    strokeWidth="1.5"
                                    markerEnd={`url(#arrowhead-${idx}-${tIdx})`}
                                />
                            </svg>
                        );
                    }

                    return (
                        <svg
                            key={`arrow-${idx}-${tIdx}`}
                            className="fermeture-arrow"

                            width={totalWidth}
                            height={svgHeight}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none',
                                zIndex: 20
                            }}
                        >
                            <defs>
                                <marker
                                    id={`arrowhead-${idx}-${tIdx}`}
                                    markerWidth="6"
                                    markerHeight="4"
                                    refX="6"
                                    refY="2"
                                    orient="auto"
                                >
                                    <polygon
                                        points="0 0, 6 2, 0 4"
                                        fill="#ff0000"
                                    />
                                </marker>
                            </defs>
                            <line
                                x1={sourceX}
                                y1={sourceY}
                                x2={targetX}
                                y2={targetY}
                                stroke="#ff0000"
                                strokeWidth="1.5"
                                markerEnd={`url(#arrowhead-${idx}-${tIdx})`}
                            />
                        </svg>
                    );
                });
            })}
        </>
    );
};

export default FlechesFermetureAnticipee;
