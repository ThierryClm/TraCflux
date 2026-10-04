import { useState, useEffect } from 'react';

export interface FlechePhasage {
    groupId: number;
}

/**
 * Gère l'état UI du mode Phasage Bulle.
 *
 * @param intersectionArrows Flèches de l'image du carrefour
 */
const usePhasageBulleUI = (intersectionArrows: readonly FlechePhasage[]) => {
    const [phasageBulleEnabled, setPhasageBulleEnabled] = useState(false);
    const [phasageBulleModal, setPhasageBulleModal] = useState(false);
    const [phasageBulleVisibleGroups, setPhasageBulleVisibleGroups] = useState<Set<number>>(new Set());
    const [phasageBulleVersion, setPhasageBulleVersion] = useState(0);
    const [hoveredPhasageGroupId, setHoveredPhasageGroupId] = useState<number | null>(null);

    // Initialise les groupes visibles quand on entre dans le mode
    useEffect(() => {
        if (phasageBulleEnabled && phasageBulleVisibleGroups.size === 0) {
            const arrowGroupIds = new Set(intersectionArrows.map(a => a.groupId));
            setPhasageBulleVisibleGroups(arrowGroupIds);
        }
    }, [phasageBulleEnabled, intersectionArrows]);

    const togglePhasageBulleGroup = (groupId: number) => {
        setPhasageBulleVisibleGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    };

    return {
        phasageBulleEnabled, setPhasageBulleEnabled,
        phasageBulleModal, setPhasageBulleModal,
        phasageBulleVisibleGroups, setPhasageBulleVisibleGroups,
        phasageBulleVersion, setPhasageBulleVersion,
        hoveredPhasageGroupId, setHoveredPhasageGroupId,
        togglePhasageBulleGroup
    };
};

export default usePhasageBulleUI;
