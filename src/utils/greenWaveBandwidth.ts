/**
 * Bandes passantes d'une onde verte.
 *
 * La bande passante est la fenêtre de temps pendant laquelle un véhicule roulant
 * à la vitesse de consigne trouve le vert à tous les carrefours. Elle est
 * calculée dans les deux sens : montant (GF montant, distanceG2) et descendant
 * (GF descendant, distance).
 *
 * Pour chaque sens, on calcule la bande obtenue en partant de chaque carrefour
 * jusqu'au dernier, puis on la découpe en segments : un segment commence là où
 * partir d'un carrefour plus loin donne une bande plus large.
 */
import type { GreenWaveIntersection } from '../types/greenWave';

/** Tronçon de bande passante, entre deux élargissements. */
export interface BandwidthSegment {
    /** Indice du premier carrefour du tronçon, dans l'ordre de parcours. */
    startIdx: number;
    /** Indice du dernier carrefour du tronçon. */
    endIdx: number;
    /** Largeur de la bande, en secondes. */
    width: number;
    /** Début de la bande au carrefour de référence, ramené dans [0, cycle[. */
    start: number;
    /** Distance du carrefour de référence (premier du sens de parcours). */
    refDistance: number;
}

/** Bande passante d'un sens : le premier tronçon, plus la liste complète. */
export interface DirectionBandwidth {
    start: number;
    width: number;
    refDistance: number;
    segments: BandwidthSegment[];
}

export interface BandwidthData {
    ascending: DirectionBandwidth | null;
    descending: DirectionBandwidth | null;
}

interface BandwidthFromStart {
    width: number;
    start: number;
    startDist?: number;
}

interface WideningPoint {
    idx: number;
    width: number;
    start: number;
}

/** Carrefours triés par distance du GF montant, du bas vers le haut. */
export const sortByAscendingDistance = (intersections: readonly GreenWaveIntersection[]): GreenWaveIntersection[] =>
    [...intersections].sort((a, b) => (a.distanceG2 ?? a.distance) - (b.distanceG2 ?? b.distance));

/** Carrefours triés par distance du GF descendant, du haut vers le bas. */
export const sortByDescendingDistance = (intersections: readonly GreenWaveIntersection[]): GreenWaveIntersection[] =>
    [...intersections].sort((a, b) => a.distance - b.distance).reverse();

/**
 * Calcule les bandes passantes montante et descendante.
 *
 * @param speedUpMps - Vitesse montante, en m/s
 * @param speedDownMps - Vitesse descendante, en m/s
 * @param cycleLength - Durée de cycle de référence, en secondes
 */
export const computeBandwidth = (
    intersections: readonly GreenWaveIntersection[] | null | undefined,
    speedUpMps: number,
    speedDownMps: number,
    cycleLength: number
): BandwidthData | null => {
    if (!intersections || intersections.length === 0) return null;

    // Sort intersections by distance for G1 (descending) and distanceG2 for G2 (ascending)
    const sortedByDistG1 = [...intersections].sort((a, b) => a.distance - b.distance);
    const sortedByDistG2 = sortByAscendingDistance(intersections);

    if (sortedByDistG1.length === 0) return null;

    // Reference = bottom intersection (min distance) for each group
    const bottomIntersectionG2 = sortedByDistG2[0];
    const topIntersectionG1 = sortedByDistG1[sortedByDistG1.length - 1];

    // Helper function to normalize a time value to [0, cycleLength) range
    const normalizeTime = (t: number): number => {
        const mod = t % cycleLength;
        return mod < 0 ? mod + cycleLength : mod;
    };

    // Helper function to compute intersection of two green windows with cycle wrap-around
    // Returns the intersection window [start, end] relative to the reference
    // Windows are represented as [start, start + width] where width is the green duration
    const intersectWindows = (refStart: number, refWidth: number, windowStart: number, windowWidth: number): { start: number; width: number } | null => {
        // Both windows are expressed in the same time reference
        // We need to find the overlap considering cycle wrap-around

        // Normalize windowStart relative to refStart to handle cycle boundaries
        // We want to find where windowStart is relative to refStart in the cycle
        let relativeStart = normalizeTime(windowStart - refStart);

        // If the relative start is more than half a cycle away, it's actually before us
        // This handles the wrap-around case
        if (relativeStart > cycleLength / 2) {
            relativeStart -= cycleLength;
        }

        // Now compute intersection
        // Reference window is [0, refWidth] in relative coordinates
        // Other window is [relativeStart, relativeStart + windowWidth]
        const overlapStart = Math.max(0, relativeStart);
        const overlapEnd = Math.min(refWidth, relativeStart + windowWidth);

        if (overlapEnd <= overlapStart) {
            return null; // No intersection
        }

        return {
            start: overlapStart,
            width: overlapEnd - overlapStart
        };
    };

    // ASCENDING bandwidth (bottom to top, positive slope) - uses Group 2 with distanceG2
    // Calculate bandwidth successively: from 1st to last, 2nd to last, 3rd to last, etc.
    // Then create segments that can widen when starting from a later intersection gives more bandwidth
    const ascSegments: BandwidthSegment[] = [];
    const bottomDistG2 = bottomIntersectionG2.distanceG2 ?? bottomIntersectionG2.distance;

    if (sortedByDistG2.length > 0) {
        // Calculate bandwidth from each starting intersection to the top
        const bandwidthFromEachStart: BandwidthFromStart[] = [];

        for (let startIdx = 0; startIdx < sortedByDistG2.length; startIdx++) {
            const startIntersection = sortedByDistG2[startIdx];
            const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup2);
            if (!startGroup) {
                bandwidthFromEachStart.push({ width: 0, start: 0 });
                continue;
            }

            const startDistG2 = startIntersection.distanceG2 ?? startIntersection.distance;
            const startRefStart = startGroup.offset;
            const startRefWidth = startGroup.durations?.green || 0;

            let calcStart = 0;
            let calcWidth = startRefWidth;

            // Calculate intersection of windows from startIdx to the end
            for (let i = startIdx; i < sortedByDistG2.length; i++) {
                if (calcWidth <= 0) break;

                const intersection = sortedByDistG2[i];
                const group = intersection.groups.find(g => g.id === intersection.selectedGroup2);
                if (!group) continue;

                const distG2 = intersection.distanceG2 ?? intersection.distance;
                const travelTime = (distG2 - startDistG2) / speedUpMps;
                const greenStart = group.offset;
                const greenWidth = group.durations?.green || 0;
                const greenStartAtStart = greenStart - travelTime;

                const intersection2 = intersectWindows(
                    startRefStart + calcStart,
                    calcWidth,
                    greenStartAtStart,
                    greenWidth
                );

                if (intersection2) {
                    calcStart += intersection2.start;
                    calcWidth = intersection2.width;
                } else {
                    calcWidth = 0;
                }
            }

            // Convert start time to bottom reference for consistent rendering
            const travelTimeFromBottom = (startDistG2 - bottomDistG2) / speedUpMps;
            const startAtBottom = normalizeTime(startRefStart + calcStart - travelTimeFromBottom);

            bandwidthFromEachStart.push({
                width: calcWidth,
                start: startAtBottom,
                startDist: startDistG2
            });
        }

        // Build segments: find where bandwidth can widen
        // Each segment covers from its startIdx to the end, but only extends visually to
        // where the next wider segment begins
        let currentWidth = bandwidthFromEachStart[0]?.width || 0;
        const currentStart = bandwidthFromEachStart[0]?.start || 0;

        // Collect widening points
        const wideningPoints: WideningPoint[] = [{ idx: 0, width: currentWidth, start: currentStart }];

        for (let i = 1; i < sortedByDistG2.length; i++) {
            const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

            // If starting from this intersection gives a wider bandwidth
            if (maxFromHere > currentWidth) {
                wideningPoints.push({
                    idx: i,
                    width: maxFromHere,
                    start: bandwidthFromEachStart[i].start
                });
                currentWidth = maxFromHere;
            }
        }

        // Create segments between widening points
        for (let w = 0; w < wideningPoints.length; w++) {
            const point = wideningPoints[w];
            // Each segment goes from this widening point to the next one (or to the end)
            const nextIdx = w + 1 < wideningPoints.length
                ? wideningPoints[w + 1].idx
                : sortedByDistG2.length;

            if (point.width > 0) {
                ascSegments.push({
                    startIdx: point.idx,
                    endIdx: nextIdx - 1,
                    width: point.width,
                    start: point.start,
                    refDistance: bottomDistG2
                });
            }
        }
    }

    // For backwards compatibility
    let ascResult: DirectionBandwidth | null = null;
    if (ascSegments.length > 0) {
        const firstSegment = ascSegments[0];
        ascResult = {
            start: firstSegment.start,
            width: firstSegment.width,
            refDistance: firstSegment.refDistance,
            segments: ascSegments
        };
    }

    // DESCENDING bandwidth (top to bottom, negative slope) - uses Group 1 with distance
    // Calculate bandwidth successively: from 1st (top) to last (bottom), 2nd to last, 3rd to last, etc.
    // Then create segments that can widen when starting from a later intersection gives more bandwidth
    const descSegments: BandwidthSegment[] = [];
    const topDist = topIntersectionG1.distance;

    // sortedByDistG1 is sorted ascending (bottom to top), so we need to process from top to bottom
    const sortedTopToBottom = [...sortedByDistG1].reverse();

    if (sortedTopToBottom.length > 0) {
        // Calculate bandwidth from each starting intersection (top to bottom) to the bottom
        const bandwidthFromEachStart: BandwidthFromStart[] = [];

        for (let startIdx = 0; startIdx < sortedTopToBottom.length; startIdx++) {
            const startIntersection = sortedTopToBottom[startIdx];
            const startGroup = startIntersection.groups.find(g => g.id === startIntersection.selectedGroup1);
            if (!startGroup) {
                bandwidthFromEachStart.push({ width: 0, start: 0 });
                continue;
            }

            const startDist = startIntersection.distance;
            const startRefStart = startGroup.offset;
            const startRefWidth = startGroup.durations?.green || 0;

            let calcStart = 0;
            let calcWidth = startRefWidth;

            // Calculate intersection of windows from startIdx to the end (bottom)
            for (let i = startIdx; i < sortedTopToBottom.length; i++) {
                if (calcWidth <= 0) break;

                const intersection = sortedTopToBottom[i];
                const group = intersection.groups.find(g => g.id === intersection.selectedGroup1);
                if (!group) continue;

                const dist = intersection.distance;
                const travelTime = (startDist - dist) / speedDownMps;
                const greenStart = group.offset;
                const greenWidth = group.durations?.green || 0;
                const greenStartAtStart = greenStart - travelTime;

                const intersection2 = intersectWindows(
                    startRefStart + calcStart,
                    calcWidth,
                    greenStartAtStart,
                    greenWidth
                );

                if (intersection2) {
                    calcStart += intersection2.start;
                    calcWidth = intersection2.width;
                } else {
                    calcWidth = 0;
                }
            }

            // Convert start time to top reference for consistent rendering
            const travelTimeFromTop = (topDist - startDist) / speedDownMps;
            const startAtTop = normalizeTime(startRefStart + calcStart - travelTimeFromTop);

            bandwidthFromEachStart.push({
                width: calcWidth,
                start: startAtTop,
                startDist: startDist
            });
        }

        // Build segments: find where bandwidth can widen
        // Each segment covers from its startIdx to the end, but only extends visually to
        // where the next wider segment begins
        let currentWidth = bandwidthFromEachStart[0]?.width || 0;
        const currentStart = bandwidthFromEachStart[0]?.start || 0;

        // Collect widening points
        const wideningPoints: WideningPoint[] = [{ idx: 0, width: currentWidth, start: currentStart }];

        for (let i = 1; i < sortedTopToBottom.length; i++) {
            const maxFromHere = bandwidthFromEachStart[i]?.width || 0;

            // If starting from this intersection gives a wider bandwidth
            if (maxFromHere > currentWidth) {
                wideningPoints.push({
                    idx: i,
                    width: maxFromHere,
                    start: bandwidthFromEachStart[i].start
                });
                currentWidth = maxFromHere;
            }
        }

        // Create segments between widening points
        for (let w = 0; w < wideningPoints.length; w++) {
            const point = wideningPoints[w];
            // Each segment goes from this widening point to the next one (or to the end)
            const nextIdx = w + 1 < wideningPoints.length
                ? wideningPoints[w + 1].idx
                : sortedTopToBottom.length;

            if (point.width > 0) {
                descSegments.push({
                    startIdx: point.idx,
                    endIdx: nextIdx - 1,
                    width: point.width,
                    start: point.start,
                    refDistance: topDist
                });
            }
        }
    }

    // For backwards compatibility
    let descResult: DirectionBandwidth | null = null;
    if (descSegments.length > 0) {
        const firstSegment = descSegments[0];
        descResult = {
            start: firstSegment.start,
            width: firstSegment.width,
            refDistance: firstSegment.refDistance,
            segments: descSegments
        };
    }

    return {
        ascending: ascResult,
        descending: descResult
    };
};
