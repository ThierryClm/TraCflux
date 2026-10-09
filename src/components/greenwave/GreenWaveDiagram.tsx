import type { MouseEvent, ReactElement } from 'react';
import { truncateName } from '../../utils/greenWaveLayout';
import { sortByAscendingDistance, sortByDescendingDistance, type BandwidthData, type BandwidthSegment } from '../../utils/greenWaveBandwidth';
import type { GreenWaveGeometry } from '../../hooks/useGreenWaveGeometry';
import type { GreenWaveIntersection } from '../../types/greenWave';
import type { GreenWaveDirection } from './GreenWaveDataPanel';

/** Ligne de vitesse en cours de déplacement : montante, descendante, ou aucune. */
export type SpeedLineDrag = 'up' | 'down' | null;

interface GreenWaveDiagramProps {
    intersections: GreenWaveIntersection[];
    geometry: GreenWaveGeometry;
    bandwidthData: BandwidthData | null;
    displayCycles: number;
    pixelsPerSecond: number;
    speedUpMps: number;
    speedDownMps: number;
    showSpeedLines: boolean;
    /** Décalages horizontaux des lignes de vitesse, en secondes. */
    speedLineOffsetUp: number;
    speedLineOffsetDown: number;
    dragging: SpeedLineDrag;
    onSpeedLineMouseDown: (direction: 'up' | 'down', e: MouseEvent<SVGLineElement>) => void;
    onMouseMove: (e: MouseEvent<SVGSVGElement>) => void;
    onMouseUp: () => void;
    isHovered: (idx: number, direction: GreenWaveDirection) => boolean;
}

interface SpeedLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

const BAR_HEIGHT = 12;

/**
 * Polygones d'une bande passante, un par tronçon et par cycle affiché.
 *
 * @param ordered - Carrefours dans l'ordre de parcours du sens
 * @param distanceOf - Distance utilisée par ce sens
 * @param travelTime - Temps de parcours depuis la distance de référence du tronçon
 */
const bandwidthPolygons = (
    segments: BandwidthSegment[],
    ordered: GreenWaveIntersection[],
    groupOf: (it: GreenWaveIntersection) => number | undefined,
    distanceOf: (it: GreenWaveIntersection) => number,
    travelTime: (distance: number, refDistance: number) => number,
    geometry: GreenWaveGeometry,
    displayCycles: number,
    keyPrefix: string,
    colors: { fill: string; stroke: string }
): ReactElement[] => {
    const { cycleLength, timeToX, distanceToY } = geometry;
    const elements: ReactElement[] = [];

    // Draw each segment as a separate polygon
    segments.forEach((segment, segIdx) => {
        const { startIdx, endIdx, width, start, refDistance } = segment;

        for (let cycle = -1; cycle < displayCycles; cycle++) {
            const cycleOffset = cycle * cycleLength;
            const bandStartAtRef = start + cycleOffset;
            const bandEndAtRef = bandStartAtRef + width;

            const leftPoints: Array<{ x: number; y: number }> = [];
            const rightPoints: Array<{ x: number; y: number }> = [];

            // Process intersections in this segment
            // Include endIdx + 1 if it exists to ensure we have at least 2 points for polygon
            const actualEndIdx = Math.min(
                endIdx < ordered.length - 1 ? endIdx + 1 : endIdx,
                ordered.length - 1
            );

            for (let i = startIdx; i <= actualEndIdx; i++) {
                const intersection = ordered[i];
                const group = intersection.groups.find(g => g.id === groupOf(intersection));
                if (!group) continue;

                const dist = distanceOf(intersection);
                const y = distanceToY(dist);
                const dt = travelTime(dist, refDistance);

                leftPoints.push({ x: timeToX(bandStartAtRef + dt), y });
                rightPoints.push({ x: timeToX(bandEndAtRef + dt), y });
            }

            if (leftPoints.length >= 2) {
                const polygonPoints = [
                    ...leftPoints.map(p => `${p.x},${p.y}`),
                    ...[...rightPoints].reverse().map(p => `${p.x},${p.y}`)
                ].join(' ');

                elements.push(
                    <polygon
                        key={`${keyPrefix}-polygon-seg${segIdx}-c${cycle}`}
                        points={polygonPoints}
                        fill={colors.fill}
                        opacity={0.2}
                        stroke={colors.stroke}
                        strokeWidth={2}
                    />
                );
            }
        }
    });

    return elements;
};

/**
 * Diagramme espace-temps de l'onde verte : verts des groupes suivis, lignes de
 * vitesse déplaçables et bandes passantes des deux sens.
 */
const GreenWaveDiagram = ({
    intersections, geometry, bandwidthData, displayCycles, pixelsPerSecond,
    speedUpMps, speedDownMps, showSpeedLines, speedLineOffsetUp, speedLineOffsetDown,
    dragging, onSpeedLineMouseDown, onMouseMove, onMouseUp, isHovered
}: GreenWaveDiagramProps) => {
    const {
        maxTime, minDistance, maxDistance, cycleLength, timeTicks, distanceTicks,
        paddingLeft, paddingRight, paddingTop, paddingBottom, labelX,
        diagramWidth, diagramHeight, timeToX, distanceToY
    } = geometry;

    // Generate speed lines (green wave corridors) - ascending and descending
    // Apply offsets (in seconds) to shift lines horizontally
    const speedLinesUp: SpeedLine[] = [];
    const speedLinesDown: SpeedLine[] = [];
    // Les lignes de vitesse balaient la pleine amplitude [minDistance ; maxDistance].
    const speedSpanMeters = maxDistance - minDistance;
    for (let startTime = 0; startTime < maxTime; startTime += cycleLength) {
        // Ascending lines (bottom to top) - apply speedLineOffsetUp
        const startTimeUp = startTime + speedLineOffsetUp;
        speedLinesUp.push({
            x1: timeToX(startTimeUp),
            y1: distanceToY(minDistance),
            x2: timeToX(startTimeUp + speedSpanMeters / speedUpMps),
            y2: distanceToY(maxDistance)
        });
        // Descending lines (top to bottom) - apply speedLineOffsetDown
        const startTimeDown = startTime + speedLineOffsetDown;
        speedLinesDown.push({
            x1: timeToX(startTimeDown),
            y1: distanceToY(maxDistance),
            x2: timeToX(startTimeDown + speedSpanMeters / speedDownMps),
            y2: distanceToY(minDistance)
        });
    }

    const renderSpeedLines = (lines: SpeedLine[], direction: 'up' | 'down', color: string) => lines.map((line, idx) => (
        <g key={`speed-${direction}-${idx}`}>
            {/* Invisible wider hit area for easier dragging */}
            <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="transparent"
                strokeWidth={16}
                style={{ cursor: 'ew-resize' }}
                onMouseDown={(e) => onSpeedLineMouseDown(direction, e)}
            />
            {/* Visible line */}
            <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={color}
                strokeWidth={dragging === direction ? 4 : 2}
                strokeDasharray="8,4"
                opacity={dragging === direction ? 0.9 : 0.6}
                style={{ cursor: 'ew-resize', pointerEvents: 'none' }}
            />
        </g>
    ));

    return (
        <svg
            className="green-wave-svg"
            width={diagramWidth}
            height={diagramHeight}
            viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: dragging ? 'ew-resize' : 'default' }}
        >
            {/* Background — fill géré par CSS pour suivre le thème */}
            <rect
                x={paddingLeft}
                y={paddingTop}
                width={diagramWidth - paddingLeft - paddingRight}
                height={diagramHeight - paddingTop - paddingBottom}
                className="green-wave-svg-bg"
            />

            {/* Grid lines - vertical (time) — pointillés pour alléger.
                Limites de cycle plus marquées via une classe distincte. */}
            {timeTicks.map(t => (
                <line
                    key={`grid-t-${t}`}
                    x1={timeToX(t)}
                    y1={paddingTop}
                    x2={timeToX(t)}
                    y2={diagramHeight - paddingBottom}
                    className={t % cycleLength === 0 ? 'green-wave-grid-cycle' : 'green-wave-grid'}
                    strokeDasharray="2,3"
                />
            ))}

            {/* Grid lines - horizontal (distance) — pointillés pour alléger */}
            {distanceTicks.map(d => (
                <line
                    key={`grid-d-${d}`}
                    x1={paddingLeft}
                    y1={distanceToY(d)}
                    x2={diagramWidth - paddingRight}
                    y2={distanceToY(d)}
                    className="green-wave-grid"
                    strokeDasharray="2,3"
                />
            ))}

            {/* Speed lines (green wave corridors) - draggable */}
            {showSpeedLines && renderSpeedLines(speedLinesUp, 'up', '#4CAF50')}
            {showSpeedLines && renderSpeedLines(speedLinesDown, 'down', '#FF9800')}

            {/* Intersection bars */}
            {intersections.map((intersection, idx) => {
                const yG1 = distanceToY(intersection.distance);
                const yG2 = distanceToY(intersection.distanceG2 ?? intersection.distance);

                // Get the two selected groups
                const group1 = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                const group2 = intersection.groups.find(g => g.id === intersection.selectedGroup2);

                const bars: ReactElement[] = [];

                // Render bars for multiple cycles. Cycle -1 dessine la
                // queue du cycle précédent qui rentre dans le 1er cycle
                // visible (cas des verts qui wrap autour du cycle).
                // Le clipping SVG (bars-clip) coupe ensuite ce qui
                // dépasse à gauche (avant t=0) ou à droite (après le
                // dernier cycle visible). On utilise displayCycles
                // pour suivre le choix utilisateur (2 ou 3 cycles).
                for (let cycle = -1; cycle < displayCycles; cycle++) {
                    const cycleOffset = cycle * intersection.cycleLength;

                    // Group 1 bar (Descendant - Orange) at distance
                    if (group1) {
                        const start1 = group1.offset + cycleOffset;
                        const duration1 = group1.durations?.green || 0;
                        const end1 = start1 + duration1;
                        const hoveredD = isHovered(idx, 'D');
                        bars.push(
                            <g key={`bar-${idx}-g1-c${cycle}`}>
                                <rect
                                    x={timeToX(start1)}
                                    y={yG1 - BAR_HEIGHT / 2}
                                    width={duration1 * pixelsPerSecond}
                                    height={BAR_HEIGHT}
                                    fill="#FF9800"
                                    opacity={hoveredD ? 1 : 0.9}
                                    stroke={hoveredD ? '#fff' : 'none'}
                                    strokeWidth={hoveredD ? 1 : 0}
                                />
                                {/* Deb value at start - above bar */}
                                <text
                                    x={timeToX(start1) + 2}
                                    y={yG1 - BAR_HEIGHT / 2 - 3}
                                    fill="#FF9800"
                                    fontSize="14"
                                >
                                    {Math.round(start1 % intersection.cycleLength)}
                                </text>
                                {/* Fin value at end - above bar */}
                                <text
                                    x={timeToX(end1) - 2}
                                    y={yG1 - BAR_HEIGHT / 2 - 3}
                                    fill="#FF9800"
                                    fontSize="14"
                                    textAnchor="end"
                                >
                                    {Math.round(end1 % intersection.cycleLength)}
                                </text>
                            </g>
                        );
                    }

                    // Group 2 bar (Montant - Vert) at distanceG2
                    if (group2) {
                        const start2 = group2.offset + cycleOffset;
                        const duration2 = group2.durations?.green || 0;
                        const end2 = start2 + duration2;
                        const hoveredM = isHovered(idx, 'M');
                        bars.push(
                            <g key={`bar-${idx}-g2-c${cycle}`}>
                                <rect
                                    x={timeToX(start2)}
                                    y={yG2 - BAR_HEIGHT / 2}
                                    width={duration2 * pixelsPerSecond}
                                    height={BAR_HEIGHT}
                                    fill="#4CAF50"
                                    opacity={hoveredM ? 1 : 0.9}
                                    stroke={hoveredM ? '#fff' : 'none'}
                                    strokeWidth={hoveredM ? 1 : 0}
                                />
                                {/* Deb value at start - above bar */}
                                <text
                                    x={timeToX(start2) + 2}
                                    y={yG2 - BAR_HEIGHT / 2 - 3}
                                    fill="#4CAF50"
                                    fontSize="14"
                                >
                                    {Math.round(start2 % intersection.cycleLength)}
                                </text>
                                {/* Fin value at end - above bar */}
                                <text
                                    x={timeToX(end2) - 2}
                                    y={yG2 - BAR_HEIGHT / 2 - 3}
                                    fill="#4CAF50"
                                    fontSize="14"
                                    textAnchor="end"
                                >
                                    {Math.round(end2 % intersection.cycleLength)}
                                </text>
                            </g>
                        );
                    }

                    // Render actions (Seconde lucarne, Ouverture anticipée) for selected groups
                    const actions = intersection.actionData || [];
                    actions.forEach((action, actionIdx) => {
                        // Skip if no group, or no start/end time
                        if (!action.gf || action.deb === '' || action.deb === undefined ||
                            action.fin === '' || action.fin === undefined) return;
                        // Skip if not the right action type
                        if (action.action !== 'Seconde lucarne' && action.action !== 'Ouverture anticipée') return;

                        // Les cellules peuvent contenir un nombre ou un texte :
                        // parseInt les ramène toutes deux à un entier.
                        const actionGroupId = parseInt(action.gf as string);
                        const isGroup1 = actionGroupId === intersection.selectedGroup1;
                        const isGroup2 = actionGroupId === intersection.selectedGroup2;
                        if (!isGroup1 && !isGroup2) return;

                        const yAction = isGroup1 ? yG1 : yG2;
                        const actionStart = parseInt(action.deb as string) + cycleOffset;
                        const actionEnd = parseInt(action.fin as string) + cycleOffset;
                        const actionDuration = actionEnd - actionStart;

                        if (action.action === 'Seconde lucarne') {
                            // Seconde lucarne - darker green bar
                            bars.push(
                                <rect
                                    key={`lucarne-${idx}-${actionIdx}-c${cycle}`}
                                    x={timeToX(actionStart)}
                                    y={yAction - BAR_HEIGHT / 2 - 2}
                                    width={actionDuration * pixelsPerSecond}
                                    height={BAR_HEIGHT}
                                    fill={isGroup1 ? '#E65100' : '#2E7D32'}
                                    opacity={0.9}
                                    stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                    strokeWidth={1}
                                />
                            );
                        } else if (action.action === 'Ouverture anticipée') {
                            // Ouverture anticipée - hatched rectangle
                            const patternId = `hatch-${idx}-${actionIdx}-${cycle}`;
                            bars.push(
                                <g key={`oa-${idx}-${actionIdx}-c${cycle}`}>
                                    <defs>
                                        <pattern id={patternId} patternUnits="userSpaceOnUse" width="4" height="4">
                                            <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
                                                  stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                                  strokeWidth="1" />
                                        </pattern>
                                    </defs>
                                    <rect
                                        x={timeToX(actionStart)}
                                        y={yAction - BAR_HEIGHT / 2}
                                        width={actionDuration * pixelsPerSecond}
                                        height={BAR_HEIGHT}
                                        fill={`url(#${patternId})`}
                                        stroke={isGroup1 ? '#FF9800' : '#4CAF50'}
                                        strokeWidth={1}
                                    />
                                </g>
                            );
                        }
                    });
                }

                return (
                    <g key={`intersection-${idx}`}>
                        {/* Group 1 name (Descendant) */}
                        {group1 && (
                            <text
                                x={labelX}
                                y={yG1 + 4}
                                textAnchor="end"
                                fill="#FF9800"
                                fontSize="13"
                                fontWeight="bold"
                            >
                                {`G${group1.id} - ${truncateName(group1.name) || 'Sans nom'}`}
                            </text>
                        )}

                        {/* Project name - 16px above group 1 (Descendant) */}
                        <text
                            x={labelX}
                            y={yG1 - 12}
                            textAnchor="end"
                            fill="#fff"
                            fontSize="13"
                            fontWeight="bold"
                        >
                            {truncateName(intersection.projectName)}
                        </text>

                        {/* Group 2 name (Montant) */}
                        {group2 && (
                            <text
                                x={labelX}
                                y={yG2 + 4}
                                textAnchor="end"
                                fill="#8BC34A"
                                fontSize="13"
                                fontWeight="bold"
                            >
                                {`G${group2.id} - ${truncateName(group2.name) || 'Sans nom'}`}
                            </text>
                        )}

                        {/* Horizontal lines at each group position */}
                        <line
                            x1={paddingLeft}
                            y1={yG1}
                            x2={diagramWidth - paddingRight}
                            y2={yG1}
                            stroke="#FF9800"
                            strokeWidth={0.5}
                            strokeDasharray="2,2"
                            opacity={0.3}
                        />
                        <line
                            x1={paddingLeft}
                            y1={yG2}
                            x2={diagramWidth - paddingRight}
                            y2={yG2}
                            stroke="#8BC34A"
                            strokeWidth={0.5}
                            strokeDasharray="2,2"
                            opacity={0.3}
                        />

                        <g clipPath="url(#bars-clip)">
                            {bars}
                        </g>
                    </g>
                );
            })}

            {/* Clip path : les bandes passantes restent dans le cadre du diagramme */}
            <defs>
                <clipPath id="bandwidth-clip">
                    <rect x={paddingLeft} y={paddingTop}
                          width={diagramWidth - paddingLeft - paddingRight}
                          height={diagramHeight - paddingTop - paddingBottom} />
                </clipPath>
                {/* Clip path pour les barres de vert : coupe à gauche
                    (t=0) ET à droite (fin du dernier cycle visible).
                    Les portions qui wrap au-delà sont masquées. */}
                <clipPath id="bars-clip">
                    <rect x={paddingLeft} y={0}
                          width={diagramWidth - paddingLeft - paddingRight}
                          height={diagramHeight} />
                </clipPath>
            </defs>

            <g clipPath="url(#bandwidth-clip)">
                {/* Ascending bandwidth corridor (bottom to top), GF montant à distanceG2 */}
                {bandwidthData?.ascending?.segments && bandwidthPolygons(
                    bandwidthData.ascending.segments,
                    sortByAscendingDistance(intersections),
                    it => it.selectedGroup2,
                    it => it.distanceG2 ?? it.distance,
                    (dist, refDistance) => (dist - refDistance) / speedUpMps,
                    geometry, displayCycles, 'asc',
                    { fill: '#4CAF50', stroke: '#81C784' }
                )}

                {/* Descending bandwidth corridor (top to bottom), GF descendant à distance */}
                {bandwidthData?.descending?.segments && bandwidthPolygons(
                    bandwidthData.descending.segments,
                    sortByDescendingDistance(intersections),
                    it => it.selectedGroup1,
                    it => it.distance,
                    (dist, refDistance) => (refDistance - dist) / speedDownMps,
                    geometry, displayCycles, 'desc',
                    { fill: '#FF9800', stroke: '#FFAB91' }
                )}
            </g>

            {/* X Axis (Time) */}
            <line
                x1={paddingLeft}
                y1={diagramHeight - paddingBottom}
                x2={diagramWidth - paddingRight}
                y2={diagramHeight - paddingBottom}
                className="green-wave-axis"
                strokeWidth={1}
            />

            {/* X Axis ticks and labels */}
            {timeTicks.map(t => (
                <g key={`tick-t-${t}`}>
                    <line
                        x1={timeToX(t)}
                        y1={diagramHeight - paddingBottom}
                        x2={timeToX(t)}
                        y2={diagramHeight - paddingBottom + 5}
                        className="green-wave-axis"
                    />
                    <text
                        x={timeToX(t)}
                        y={diagramHeight - paddingBottom + 18}
                        textAnchor="middle"
                        className="green-wave-axis-tick"
                        fontSize="10"
                    >
                        {t}
                    </text>
                </g>
            ))}

            {/* X Axis label */}
            <text
                x={diagramWidth / 2}
                y={diagramHeight - 8}
                textAnchor="middle"
                className="green-wave-axis-label"
                fontSize="12"
            >
                Temps (s)
            </text>

            {/* Y Axis (Distance) */}
            <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={paddingLeft}
                y2={diagramHeight - paddingBottom}
                className="green-wave-axis"
                strokeWidth={1}
            />

            {/* Y Axis ticks and labels */}
            {distanceTicks.map(d => (
                <g key={`tick-d-${d}`}>
                    <line
                        x1={paddingLeft - 5}
                        y1={distanceToY(d)}
                        x2={paddingLeft}
                        y2={distanceToY(d)}
                        className="green-wave-axis"
                    />
                    <text
                        x={paddingLeft - 8}
                        y={distanceToY(d) + 4}
                        textAnchor="end"
                        className="green-wave-axis-tick"
                        fontSize="10"
                    >
                        {d}
                    </text>
                </g>
            ))}

            {/* Rappel de l'axe des distances à droite du diagramme */}
            <line
                x1={diagramWidth - paddingRight}
                y1={paddingTop}
                x2={diagramWidth - paddingRight}
                y2={diagramHeight - paddingBottom}
                className="green-wave-axis"
                strokeWidth={1}
            />
            {distanceTicks.map(d => (
                <g key={`tick-d-right-${d}`}>
                    <line
                        x1={diagramWidth - paddingRight}
                        y1={distanceToY(d)}
                        x2={diagramWidth - paddingRight + 5}
                        y2={distanceToY(d)}
                        className="green-wave-axis"
                    />
                    <text
                        x={diagramWidth - paddingRight + 8}
                        y={distanceToY(d) + 4}
                        textAnchor="start"
                        className="green-wave-axis-tick"
                        fontSize="10"
                    >
                        {d}
                    </text>
                </g>
            ))}

            {/* Y Axis label */}
            <text
                x={15}
                y={diagramHeight / 2}
                textAnchor="middle"
                className="green-wave-axis-label"
                fontSize="12"
                transform={`rotate(-90, 15, ${diagramHeight / 2})`}
            >
                Distance (m)
            </text>
        </svg>
    );
};

export default GreenWaveDiagram;
