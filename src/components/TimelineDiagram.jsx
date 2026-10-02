[earlier output was discarded at the retention cap and cannot be recovered]

className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                        style={{ left: '0px' }}
                                                    >
                                                        <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeSecondPartWidth}px` }}></div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        }

                                        // Normal case: neither wraps
                                        return (
                                            <div
                                                className={`cycle-block ${dragState?.groupId === group.id ? 'dragging' : ''} ${arrowHighlightClass}`}
                                                style={{ left: `${offset * pixelsPerSecond}px` }}
                                            >
                                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                                    <div
                                                        className="drag-handle drag-handle-start"
                                                        onMouseDown={(e) => handleDragStart(e, group.id, 'start', offset)}
                                                    />
                                                </CustomTooltip>
                                                <div className="phase-bar green" style={{ width: `${greenWidth}px` }}></div>
                                                <div className={`phase-bar ${orangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                {showVUtileOverlay && vUtileSec > 0 && (
                                                    <CustomTooltip text={vUtileTitle}>
                                                        <div
                                                            className={`vutile-overlay ${vUtileColorClass}`}
                                                            style={{ width: `${vUtileSec * pixelsPerSecond}px` }}
                                                        />
                                                    </CustomTooltip>
                                                )}
                                                <CustomTooltip text={`${group.name}\nseconde ${Math.round(offset)} à ${Math.round(endValue)}`}>
                                                    <div
                                                        className="drag-handle drag-handle-end"
                                                        onMouseDown={(e) => handleDragStart(e, group.id, 'end', endValue)}
                                                        style={{ left: `${greenWidth}px` }}
                                                    />
                                                </CustomTooltip>
                                            </div>
                                        );
                                    })()}

                                    {/* Green cuts from Escamotage actions - mask portions of the green bar */}
                                    {simGroup?.greenCuts?.map((cut, idx) => {
                                        const cutDeb = cut.deb;
                                        const cutFin = cut.fin;
                                        const currentCycleLen = effectiveCycleLength || cycleLength;
                                        const wrapsAround = cutDeb > cutFin;

                                        if (wrapsAround) {
                                            // Cut wraps around cycle
                                            const firstPartWidth = (currentCycleLen - cutDeb) * pixelsPerSecond;
                                            const secondPartWidth = cutFin * pixelsPerSecond;
                                            return (
                                                <React.Fragment key={`green-cut-${idx}`}>
                                                    {/* First part: from cutDeb to end of cycle */}
                                                    <div
                                                        className="green-cut-overlay"
                                                        style={{
                                                            left: `${cutDeb * pixelsPerSecond}px`,
                                                            width: `${firstPartWidth}px`
                                                        }}
                                                    />
                                                    {/* Second part: from start of cycle to cutFin */}
                                                    <div
                                                        className="green-cut-overlay"
                                                        style={{
                                                            left: '0px',
                                                            width: `${secondPartWidth}px`
                                                        }}
                                                    />
                                                </React.Fragment>
                                            );
                                        }

                                        // Normal case: cut doesn't wrap
                                        const cutWidth = (cutFin - cutDeb) * pixelsPerSecond;
                                        return (
                                            <div
                                                key={`green-cut-${idx}`}
                                                className="green-cut-overlay"
                                                style={{
                                                    left: `${cutDeb * pixelsPerSecond}px`,
                                                    width: `${cutWidth}px`
                                                }}
                                            />
                                        );
                                    })}

                                    {/* Green cuts from SELECTED Escamotage (group-specific) actions */}
                                    {selectedEscamotageGroup
                                        .filter(action => {
                                            const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            return targetGfId === group.id;
                                        })
                                        .map((action, idx) => {
                                            const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                                            if (sourceGfId === 0 || targetGfId === 0) return null;

                                            const sourceGroup = groups.find(g => g.id === sourceGfId);
                                            if (!sourceGroup) return null;

                                            // Get intergreen times from conflict matrix
                                            const intergreenSourceToTarget = conflictMatrix[sourceGfId - 1]?.[targetGfId - 1] || 0;
                                            const intergreenTargetToSource = conflictMatrix[targetGfId - 1]?.[sourceGfId - 1] || 0;

                                            // Source group times
                                            const currentCycleLen = effectiveCycleLength || cycleLength;
                                            const sourceStart = sourceGroup.offset % currentCycleLen;
                                            const sourceEndRaw = sourceStart + sourceGroup.durations.green;
                                            const sourceEnd = sourceEndRaw === currentCycleLen ? currentCycleLen : (sourceEndRaw % currentCycleLen);

                                            // Calculate arrow target positions (cut boundaries)
                                            // Arrow 1: target = sourceStart - intergreenTargetToSource
                                            const cutStart = ((sourceStart - intergreenTargetToSource) % currentCycleLen + currentCycleLen) % currentCycleLen;
                                            // Arrow 2: target = sourceEnd + intergreenSourceToTarget
                                            const cutEndRaw = sourceEnd + intergreenSourceToTarget;
                                            const cutEnd = cutEndRaw === currentCycleLen ? currentCycleLen : (cutEndRaw % currentCycleLen);

                                            const wrapsAround = cutStart > cutEnd;

                                            if (wrapsAround) {
                                                const firstPartWidth = (currentCycleLen - cutStart) * pixelsPerSecond;
                                                const secondPartWidth = cutEnd * pixelsPerSecond;
                                                return (
                                                    <React.Fragment key={`escam-group-cut-${idx}`}>
                                                        <div
                                                            className="green-cut-overlay"
                                                            style={{
                                                                left: `${cutStart * pixelsPerSecond}px`,
                                                                width: `${firstPartWidth}px`
                                                            }}
                                                        />
                                                        <div
                                                            className="green-cut-overlay"
                                                            style={{
                                                                left: '0px',
                                                                width: `${secondPartWidth}px`
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                );
                                            }

                                            const cutWidth = (cutEnd - cutStart) * pixelsPerSecond;
                                            return (
                                                <div
                                                    key={`escam-group-cut-${idx}`}
                                                    className="green-cut-overlay"
                                                    style={{
                                                        left: `${cutStart * pixelsPerSecond}px`,
                                                        width: `${cutWidth}px`
                                                    }}
                                                />
                                            );
                                        })}

                                    {/* Action-based overlays */}
                                    {groupActions.map((action, idx) => {
                                        const origDeb = parseInt(action.deb) || 0;
                                        const origFin = parseInt(action.fin) || 0;
                                        // Apply time shifts from escamotage/adaptatif
                                        // Pass action type to exclude "Seconde lucarne" from group shift
                                        const shifted = getShiftedActionPosition(origDeb, origFin, group.id, action.action, null, action.id);

                                        // Skip rendering if action is hidden (entirely within removed period)
                                        if (shifted.hidden) {
                                            return null;
                                        }

                                        const deb = shifted.deb;
                                        const fin = shifted.fin;
                                        const duration = fin >= deb ? fin - deb : (effectiveCycleLength - deb + fin);
                                        const leftPos = deb * pixelsPerSecond;
                                        const greenWidth = duration * pixelsPerSecond;
                                        const orangeWidth = orangeDuration * pixelsPerSecond;
                                        const abrv = action.abrv || '';
                                        const isHighlighted = hoveredActionId === action.id;

                                        // For Fermeture anticipée: calculate brace start position
                                        // Si l'adaptatif vertical décale la fin de vert, l'accolade se décale du même delta
                                        // Si la fin de vert n'est pas décalée, l'accolade reste à sa position d'origine
                                        let fermetureStartPos = deb; // Default to shifted deb
                                        let fermetureEndPos = fin; // Default to shifted fin
                                        if (action.action === 'Fermeture anticipée' && simGroup) {
                                            const originalGreenEnd = group.offset + group.durations.green;
                                            const simulatedGreenEnd = simGroup.simulatedOffset + simGroup.simulatedGreen;
                                            // Compare modular ends (not raw sums) to detect actual end-of-green change
                                            // Wrapping groups may have different raw sums but same modular end
                                            const originalGreenEndMod = originalGreenEnd % cycleLength;
                                            const simulatedGreenEndMod = simulatedGreenEnd % effectiveCycleLength;
                                            if (originalGreenEndMod !== simulatedGreenEndMod) {
                                                // Vérifier si un Point de repos étire ce vert. Dans ce cas, on
                                                // ne repositionne PAS (la logique « suivre la fin de vert » est
                                                // conçue pour AV/EP, où le vert se DÉPLACE ; avec PR il s'ÉTIRE,
                                                // et la fermeture doit suivre la règle uniforme deb < t inchangé,
                                                // deb >= t décalé — déjà calculée par getShiftedActionPosition).
                                                const greenStartOrig = group.offset;
                                                const greenEndOrig = group.offset + group.durations.green;
                                                const restPointStretchesGreen = simulationResult.restPoints?.some(rp =>
                                                    rp.originalDeb >= greenStartOrig && rp.originalDeb <= greenEndOrig
                                                );

                                                // Vérifier si l'accolade chevauche une zone AV/EP (début avant, fin dans ou après la zone)
                                                let straddlesZone = false;
                                                for (const zone of braceZoneRanges) {
                                                    if (zone.isPartial) {
                                                        const gId = parseInt(group.id);
                                                        if (gId < zone.plage1 || gId > zone.plage2) continue;
                                                    }
                                                    // La fermeture chevauche la zone : début avant, fin dans ou après
                                                    if (origDeb < zone.rawDeb && origFin > zone.rawDeb) {
                                                        straddlesZone = true;
                                                        break;
                                                    }
                                                }

                                                if (!straddlesZone && !restPointStretchesGreen) {
                                                    // Pas de chevauchement AV/EP et pas d'étirement par PR :
                                                    // repositionner relativement à la fin de vert simulée
                                                    const simGreenEnd = simulatedGreenEnd % effectiveCycleLength;
                                                    fermetureStartPos = ((simGreenEnd + (origDeb - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                                                    fermetureEndPos = ((simGreenEnd + (origFin - originalGreenEnd)) % effectiveCycleLength + effectiveCycleLength) % effectiveCycleLength;
                                                }
                                                // Sinon : garder deb/fin de getShiftedActionPosition (déjà corrects)
                                            }
                                        }
                                        // Tronquer l'accolade si elle chevauche une zone Adaptatif partiel
                                        // Les zones full (AV/EP sélectionnées) sont retirées de la timeline,
                                        // donc la troncature ne s'applique qu'aux zones partielles
                                        if (action.action === 'Fermeture anticipée') {
                                            for (const zone of braceZoneRanges) {
                                                // Seules les zones partielles tronquent les accolades
                                                if (!zone.isPartial) continue;
                                                const gId = parseInt(group.id);
                                                if (gId < zone.plage1 || gId > zone.plage2) continue;
                                                if (zone.deb < zone.fin && fermetureStartPos < fermetureEndPos) {
                                                    if (fermetureStartPos < zone.deb && fermetureEndPos > zone.deb) {
                                                        // Début accolade < début zone : tronquer la fin au début de la zone
                                                        fermetureEndPos = zone.deb;
                                                    } else if (fermetureStartPos >= zone.deb && fermetureStartPos < zone.fin) {
                                                        // Début accolade dans la zone : pousser le début après la zone
                                                        fermetureStartPos = zone.fin;
                                                    }
                                                }
                                            }
                                        }
                                        const fermetureLeftPos = fermetureStartPos * pixelsPerSecond;

                                        return (
                                            <React.Fragment key={`action-${idx}`}>
                                                {/* Abrv label on the bar (not for Ouverture anticipée, Escamotage de phase, Adaptatif vertical which have their own labels) */}
                                                {abrv && action.action !== 'Ouverture anticipée' && action.action !== 'Escamotage de phase' && action.action !== 'Adaptatif vertical' && (
                                                    <div
                                                        className="bar-label"
                                                        style={{
                                                            left: `${(action.action === 'Fermeture anticipée' ? fermetureLeftPos : leftPos) + 2}px`,
                                                            width: `${greenWidth - 4}px`
                                                        }}
                                                    >
                                                        {abrv}
                                                    </div>
                                                )}

                                                {/* Seconde lucarne: additional bar with darker green */}
                                                {action.action === 'Seconde lucarne' && (() => {
                                                    // Determine orange class based on group type
                                                    const isPedestrian = group.type === 'P' || group.type === 'Piéton';
                                                    const isCyclist = group.type === 'CY' || group.type === 'Cycliste';
                                                    const lucarneOrangeClass = isPedestrian ? 'pedestrian-orange' : isCyclist ? 'cyclist-orange' : 'orange';
                                                    const wrapsAround = deb > fin;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                                        const secondPartWidth = fin * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                {/* First part: from deb to end of cycle */}
                                                                <div
                                                                    className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${leftPos}px` }}
                                                                    onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                                    onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                                                >
                                                                    <div
                                                                        className="drag-handle drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                                                    />
                                                                    <div className="phase-bar green-dark" style={{ width: `${firstPartWidth}px` }}></div>
                                                                </div>
                                                                {/* Second part: from start of cycle to fin */}
                                                                <div
                                                                    className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px' }}
                                                                    onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                                    onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                                                >
                                                                    <div className="phase-bar green-dark" style={{ width: `${secondPartWidth}px` }}></div>
                                                                    <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                                    <div
                                                                        className="drag-handle drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                        style={{ left: `${secondPartWidth}px` }}

                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`cycle-block lucarne ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${leftPos}px` }}
                                                            onMouseEnter={() => { setHoveredActionId(action.id); setHoveredGroupId(group.id); }}
                                                            onMouseLeave={() => { setHoveredActionId(null); setHoveredGroupId(null); }}
                                                        >
                                                            <div
                                                                className="drag-handle drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                                            />
                                                            <div className="phase-bar green-dark" style={{ width: `${greenWidth}px` }}></div>
                                                            <div className={`phase-bar ${lucarneOrangeClass}`} style={{ width: `${orangeWidth}px` }}></div>
                                                            <div
                                                                className="drag-handle drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}
                                                                style={{ left: `${greenWidth}px` }}

                                                            />
                                                        </div>
                                                    );
                                                })()}

                                                {/* Fermeture anticipée: brace */}
                                                {action.action === 'Fermeture anticipée' && (() => {
                                                    // Don't render brace if the group is escamoted or has no green
                                                    if (isEscamoted || greenDuration <= 0) {
                                                        return null;
                                                    }
                                                    // Use the pre-calculated fermetureStartPos (same as abbreviation)
                                                    // This ensures brace and abbreviation are always at the same position
                                                    const braceStart = fermetureStartPos;
                                                    const braceEnd = fermetureEndPos; // Use truncated fin (accounting for zone overlap)
                                                    // Validate: brace should have positive duration
                                                    // If braceEnd == braceStart, skip rendering
                                                    const normalDuration = braceEnd >= braceStart
                                                        ? braceEnd - braceStart
                                                        : (effectiveCycleLength - braceStart + braceEnd);
                                                    // Skip if duration is 0 or spans almost the entire cycle (which indicates an error)
                                                    if (normalDuration <= 0 || normalDuration >= effectiveCycleLength - 1) {
                                                        return null;
                                                    }
                                                    const braceDuration = normalDuration;
                                                    const braceLeftPos = braceStart * pixelsPerSecond;
                                                    const braceWidth = braceDuration * pixelsPerSecond;

                                                    const wrapsAround = braceStart > braceEnd;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (effectiveCycleLength - braceStart) * pixelsPerSecond;
                                                        const secondPartWidth = braceEnd * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${braceLeftPos}px`, width: `${firstPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <span className="brace-point"></span>
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}

                                                                    />
                                                                </div>
                                                                <div
                                                                    className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px', width: `${secondPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <span className="brace-point"></span>
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}

                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`brace-marker ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${braceLeftPos}px`, width: `${braceWidth}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <span className="brace-point"></span>
                                                            <div
                                                                className="action-drag-handle action-drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', origDeb)}

                                                            />
                                                            <div
                                                                className="action-drag-handle action-drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', origFin)}

                                                            />
                                                        </div>
                                                    );
                                                })()}

                                                {/* Ouverture anticipée: hatched green rectangle */}
                                                {action.action === 'Ouverture anticipée' && (() => {
                                                    const wrapsAround = deb > fin;
                                                    if (wrapsAround) {
                                                        const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                                        const secondPartWidth = fin * pixelsPerSecond;
                                                        return (
                                                            <React.Fragment>
                                                                <div
                                                                    className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: `${leftPos}px`, width: `${firstPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-start"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                                                    />
                                                                    {abrv && (
                                                                        <span className="ouverture-anticipee-label">{abrv}</span>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                                    style={{ left: '0px', width: `${secondPartWidth}px` }}
                                                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                                                    onMouseLeave={() => setHoveredActionId(null)}
                                                                >
                                                                    <div
                                                                        className="action-drag-handle action-drag-handle-end"
                                                                        onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            className={`ouverture-anticipee ${dragState?.actionId === action.id ? 'dragging' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                                            style={{ left: `${leftPos}px`, width: `${greenWidth}px` }}
                                                            onMouseEnter={() => setHoveredActionId(action.id)}
                                                            onMouseLeave={() => setHoveredActionId(null)}
                                                        >
                                                            <div
                                                                className="action-drag-handle action-drag-handle-start"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'deb', deb)}

                                                            />
                                                            <div
                                                                className="action-drag-handle action-drag-handle-end"
                                                                onMouseDown={(e) => handleActionDragStart(e, action.id, 'fin', fin)}

                                                            />
                                                            {abrv && (
                                                                <span className="ouverture-anticipee-label">{abrv}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Adaptatif vertical overlays */}
                        {adaptatifActions.map((action, idx) => {
                            const origDeb = parseInt(action.deb) || 0;
                            const origFin = parseInt(action.fin) || 0;
                            // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                            const plage1 = parseInt(action.plage1) || 0;
                            const plage2 = parseInt(action.plage2) || 0;
                            const avPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
                            const shifted = getShiftedActionPosition(origDeb, origFin, null, 'Adaptatif vertical', avPlage, action.id);
                            if (shifted.hidden) return null;
                            const deb = shifted.deb;
                            const fin = shifted.fin;
                            const leftPos = deb * pixelsPerSecond;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            let topPos, height;
                            if (plage1 > 0 && plage2 > 0) {
                                // Plage values are group numbers (1-indexed)
                                const startGroup = Math.min(plage1, plage2) - 1;
                                const endGroup = Math.max(plage1, plage2) - 1;
                                topPos = RULER_HEIGHT + 1 + (startGroup * ROW_TOTAL_HEIGHT);
                                height = (endGroup - startGroup + 1) * ROW_TOTAL_HEIGHT + 8;
                            } else {
                                // No plage values - full height
                                topPos = RULER_HEIGHT + 1;
                                height = groups.length * ROW_TOTAL_HEIGHT + 8;
                            }

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = fin * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`adaptatif-${idx}`}>
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
                                    key={`adaptatif-${idx}`}
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

                        {/* Fermeture anticipée arrows */}
                        {fermetureActions.map((action, idx) => {
                            const sourceGf = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                            const origDeb = parseInt(action.deb) || 0;
                            const fin = parseInt(action.fin) || 0;

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
                                const targetId = parseInt(action.actGf1.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf2) {
                                const targetId = parseInt(action.actGf1Gf2.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf3) {
                                const targetId = parseInt(action.actGf1Gf3.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }
                            if (action.actGf1Gf4) {
                                const targetId = parseInt(action.actGf1Gf4.toString().replace(/[Gg]/g, '').trim());
                                if (targetId) targets.push(targetId);
                            }

                            return targets.map((targetGf, tIdx) => {
                                const targetStartPos = getGroupStartPos(targetGf);
                                if (targetStartPos === null) return null;

                                // Check if target group (Action GF) overlaps with source group (GF)
                                // Get source group green period
                                const sourceGroup = groups.find(g => g.id === sourceGf);
                                const targetGroup = groups.find(g => g.id === parseInt(targetGf));
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

                        {/* Escamotage de phase overlays */}
                        {escamotageActions.map((action, idx) => {
                            const origDeb = parseInt(action.deb) || 0;
                            const origFin = parseInt(action.fin) || 0;
                            // Apply shift from other Escamotage de phase or Adaptatif vertical actions
                            const shifted = getShiftedActionPosition(origDeb, origFin, null, 'Escamotage de phase', null, action.id);
                            if (shifted.hidden) return null;
                            const deb = shifted.deb;
                            const fin = shifted.fin;
                            const abrv = action.abrv || '';
                            const isHighlighted = hoveredActionId === action.id;

                            const leftPos = deb * pixelsPerSecond;

                            // Cover all rows, starting just below ruler (12px above rows) and 22px below
                            const topPos = RULER_HEIGHT - 12;
                            const height = 12 + (groups.length * ROW_TOTAL_HEIGHT) + 22;

                            // Check if overlay wraps around cycle
                            const wrapsAround = deb > fin;

                            if (wrapsAround) {
                                const firstPartWidth = (cycleLength - deb) * pixelsPerSecond;
                                const secondPartWidth = Math.max(0, fin) * pixelsPerSecond;
                                return (
                                    <React.Fragment key={`escamotage-${idx}`}>
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
...(OpenClaw truncated dynamic tool result: original 200071 chars, weighted budget 64000; rerun with narrower args.)