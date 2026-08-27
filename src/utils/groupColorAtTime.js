/**
 * Couleur d'un groupe de feux à un instant donné du cycle.
 *
 * Cette logique est le SEUL point de vérité pour la couleur des flèches du
 * carrefour. Elle vivait auparavant dans IntersectionImage, et la fenêtre
 * détachée de l'image en portait sa propre copie, réduite : elle ignorait les
 * verts découpés par un escamotage, les groupes escamotés et la zone de
 * coupure, et n'employait les temps simulés que pendant la lecture. Les deux
 * affichages ne pouvaient donc pas s'accorder. Toute évolution de la couleur
 * se fait désormais ici, et les deux fenêtres la reçoivent ensemble.
 */

/**
 * Le temps tombe-t-il dans la plage d'une action ? Gère l'enroulement de cycle.
 *
 * @param {number} time - Instant à tester (secondes)
 * @param {number|string} start - Début de la plage
 * @param {number|string} end - Fin de la plage
 * @param {number} effectiveCycleLength - Longueur de cycle en vigueur
 * @returns {boolean}
 */
export const isTimeInRange = (time, start, end, effectiveCycleLength) => {
    const normalizedTime = time % effectiveCycleLength;
    const normalizedStart = parseInt(start);
    const normalizedEnd = parseInt(end);

    if (normalizedEnd > normalizedStart) {
        return normalizedTime >= normalizedStart && normalizedTime < normalizedEnd;
    } else {
        // Wrap-around case
        return normalizedTime >= normalizedStart || normalizedTime < normalizedEnd;
    }
};

/**
 * Couleur de la flèche d'un groupe à un instant donné.
 *
 * @param {number} groupId - Identifiant du groupe de feux
 * @param {number} time - Instant du cycle (secondes)
 * @param {Object} context - Données du plan de feux
 * @param {Array} context.groups - Groupes du projet
 * @param {Object|null} context.simulationResult - Résultat de simulation, s'il existe
 * @param {number} context.cycleLength - Longueur de cycle nominale
 * @param {Array} context.actionData - Lignes du tableau d'actions
 * @param {Array} context.selectedActions - Identifiants des actions cochées en simulation
 * @param {Array} context.conflictMatrix - Matrice des temps interverts
 * @returns {string} Couleur CSS
 */
export const getGroupColorAtTime = (groupId, time, context = {}) => {
    const {
        groups = [],
        simulationResult = null,
        cycleLength = 100,
        actionData = [],
        selectedActions = [],
        conflictMatrix = []
    } = context;

    // Use simulation result if available, otherwise use original groups
    const groupsData = simulationResult?.simulatedGroups || groups;
    const group = groupsData.find(g => g.id === groupId);

    if (!group) return 'rgb(255, 0, 0)'; // Red by default

    const effectiveCycleLength = simulationResult?.simulatedCycleLength || cycleLength;
    const offset = simulationResult ? (group.simulatedOffset ?? group.offset) : group.offset;
    const greenDuration = simulationResult ? (group.simulatedGreen ?? group.durations?.green ?? 0) : (group.durations?.green || 0);
    const orangeDuration = group.durations?.orange || 0;
    const greenCuts = simulationResult ? (group.greenCuts || []) : [];

    // Normalize time within cycle
    const normalizedTime = time % effectiveCycleLength;

    // Seconde lucarne : action DÉCLARATIVE. calculateSimulatedDiagram ne la
    // traite pas — la cocher dans le panneau de simulation ne change rien au
    // diagramme simulé. La conditionner à cette coche l'éteignait donc dès
    // qu'une AUTRE action était cochée, alors que le diagramme continuait de
    // la dessiner : son filtre masque les actions SÉLECTIONNÉES (une action
    // appliquée par la simulation n'a plus à être annoncée), convention
    // exactement inverse. Les deux ne pouvaient jamais s'accorder.
    //
    // Les flèches l'honorent donc toujours, comme au survol et comme le fait
    // déjà la fenêtre détachée de l'image.
    const secondeLucarneAction = actionData.find(action =>
        action.action === 'Seconde lucarne' &&
        action.gf === String(groupId) &&
        action.deb !== '' &&
        action.fin !== ''
    );

    // Check for "Priorité piétons" action for this group
    const prioritePietonsAction = actionData.find(action =>
        action.action === 'Priorité piétons' &&
        action.gf === String(groupId) &&
        action.deb !== '' &&
        action.fin !== '' &&
        selectedActions.includes(action.id)
    );

    // Check if current time is in "Seconde lucarne" period
    if (secondeLucarneAction) {
        const inSecondeLucarne = isTimeInRange(
            normalizedTime,
            secondeLucarneAction.deb,
            secondeLucarneAction.fin,
            effectiveCycleLength
        );
        if (inSecondeLucarne) {
            return 'rgb(0, 180, 0)'; // Dark green for Seconde lucarne
        }
    }

    // Check if current time is in "Priorité piétons" period
    if (prioritePietonsAction) {
        const inPrioritePietons = isTimeInRange(
            normalizedTime,
            prioritePietonsAction.deb,
            prioritePietonsAction.fin,
            effectiveCycleLength
        );
        if (inPrioritePietons) {
            // Blinking yellow - alternate based on time (every 0.5s = blink)
            const blink = Math.floor(time * 2) % 2 === 0;
            return blink ? 'rgb(255, 255, 0)' : 'rgb(180, 180, 0)'; // Blinking yellow
        }
    }

    // Check for "Escamotage" action where this group is the TARGET (actGf1)
    // When escamotage is active (checked), the target group bar is cut
    const escamotageAction = actionData.find(action =>
        action.action === 'Escamotage' &&
        action.gf &&
        action.actGf1 &&
        parseInt(action.actGf1.toString().replace(/[Gg]/g, '').trim()) === groupId &&
        selectedActions.includes(action.id)
    );

    if (escamotageAction) {
        // Get source group info - use simulated data if available
        const sourceGfId = parseInt(escamotageAction.gf.toString().replace(/[Gg]/g, '').trim()) || 0;
        const sourceGroup = groupsData.find(g => g.id === sourceGfId);

        if (sourceGroup && conflictMatrix && conflictMatrix.length > 0) {
            // Get intergreen times from conflict matrix
            const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[groupId - 1] || 0;
            const intergreenTargetToSource = conflictMatrix[groupId - 1]?.[sourceGfId - 1] || 0;

            // Source group times - use simulated values if available
            const sourceOffset = simulationResult ? (sourceGroup.simulatedOffset ?? sourceGroup.offset) : sourceGroup.offset;
            const sourceGreen = simulationResult ? (sourceGroup.simulatedGreen ?? sourceGroup.durations?.green ?? 0) : (sourceGroup.durations?.green || 0);
            const sourceStart = sourceOffset % effectiveCycleLength;
            const sourceEndRaw = sourceStart + sourceGreen;
            const sourceEnd = sourceEndRaw === effectiveCycleLength ? effectiveCycleLength : (sourceEndRaw % effectiveCycleLength);

            // Calculate cut zone boundaries
            const cutStart = ((sourceStart - intergreenTargetToSource) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
            const cutEndRaw = sourceEnd + intergreenSourceToTarget;
            const cutEnd = cutEndRaw === effectiveCycleLength ? effectiveCycleLength : (cutEndRaw % effectiveCycleLength);

            // Check if current time is in cut zone
            let isInCutZone = false;
            if (cutStart <= cutEnd) {
                isInCutZone = normalizedTime >= cutStart && normalizedTime < cutEnd;
            } else {
                // Wrap-around case
                isInCutZone = normalizedTime >= cutStart || normalizedTime < cutEnd;
            }

            if (isInCutZone) {
                // Calculate time elapsed in cut zone
                const timeInCut = cutStart <= normalizedTime
                    ? normalizedTime - cutStart
                    : (effectiveCycleLength - cutStart + normalizedTime);

                // Return orange for first orangeDuration seconds, then red
                if (timeInCut < orangeDuration) {
                    return 'rgb(255, 255, 0)'; // Orange/Yellow
                } else {
                    return 'rgb(255, 0, 0)'; // Red
                }
            }
        }
    }

    // Calculate phase boundaries
    const greenStart = offset;
    const greenEnd = (offset + greenDuration) % effectiveCycleLength;
    const orangeEnd = (offset + greenDuration + orangeDuration) % effectiveCycleLength;

    // Check if time is in green phase (handle wrap-around)
    let isGreen = false;
    if (greenEnd > greenStart) {
        isGreen = normalizedTime >= greenStart && normalizedTime < greenEnd;
    } else if (greenDuration > 0) {
        // Wrap-around case
        isGreen = normalizedTime >= greenStart || normalizedTime < greenEnd;
    }

    // If in green phase, check greenCuts (from simulation Escamotage actions)
    if (isGreen && greenCuts.length > 0) {
        for (const cut of greenCuts) {
            const cutDeb = Number(cut.deb);
            const cutFin = Number(cut.fin);
            if (cutDeb <= cutFin) {
                if (normalizedTime >= cutDeb && normalizedTime < cutFin) {
                    isGreen = false;
                    break;
                }
            } else {
                // Wrap-around cut
                if (normalizedTime >= cutDeb || normalizedTime < cutFin) {
                    isGreen = false;
                    break;
                }
            }
        }
    }

    // Check if group is escamoted (removed entirely by simulation)
    if (simulationResult && group.isEscamoted) {
        return 'rgb(255, 0, 0)'; // Always red
    }

    // Check if time is in orange phase
    let isOrange = false;
    if (orangeDuration > 0) {
        if (orangeEnd > greenEnd) {
            isOrange = normalizedTime >= greenEnd && normalizedTime < orangeEnd;
        } else if (orangeEnd < greenEnd) {
            // Wrap-around case
            isOrange = normalizedTime >= greenEnd || normalizedTime < orangeEnd;
        }
    }

    if (isGreen) {
        return 'rgb(0, 255, 0)'; // Green
    } else if (isOrange) {
        return 'rgb(255, 255, 0)'; // Yellow (Jaune)
    } else {
        return 'rgb(255, 0, 0)'; // Red
    }
};
