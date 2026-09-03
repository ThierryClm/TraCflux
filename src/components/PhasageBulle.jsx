import { useState, useCallback, useEffect, useId } from 'react';
import { isPPLit } from '../utils/groupColorAtTime';
import { getEllipseConfig, computeBubbleBox, ARROW_OUTER_OFFSET } from '../utils/phasageLayout';
import './PhasageBulle.css';

const PhasageBulle = ({
    groups,
    cycleLength,
    intersectionImage,
    intersectionArrows,
    simulationResult,
    actionData = [],
    selectedActions = [],
    intersectionName = '',
    planName = '',
    initialTimes = [0, 15, 30, 45, 60, 75],
    initialCount = 4,
    hoveredGroupId = null,
    setHoveredGroupId = () => {},
    imageBrightness = 100,
    imageContrast = 100,
    initialBubbleScale = 100,
    initialEllipseScale = 100,
    initialBubbleRatio = 100,
    // Étalement horizontal et décalage des arcs imposés (impression) :
    // aucun curseur, aucun état.
    ellipseScaleX = null,
    arrowOffset = ARROW_OUTER_OFFSET,
    onBubbleScaleChange,
    onEllipseScaleChange,
    onBubbleRatioChange
}) => {
    // Number of phases to display (2-6)
    const [phaseCount, setPhaseCount] = useState(initialCount);

    // Phase times - use initial times from props
    const [phaseTimes, setPhaseTimes] = useState(initialTimes);

    // Scale factors for bubbles and ellipse (50% to 150%)
    // Le marqueur de pointe de flèche portait un identifiant fixe. À l'écran,
    // une seule instance existe et rien ne se voyait ; à l'impression du dossier,
    // le document en contient une par plan de feu — plus celle, masquée, de
    // l'application. Toutes les flèches résolvaient alors « url(#arrowhead) »
    // vers le premier marqueur du document, celui d'un sous-arbre en display:none,
    // que le navigateur ne dessine pas : les arcs sortaient sans pointe.
    const marqueurFleche = 'phasage-arrowhead-' + useId().replace(/:/g, '');

    const [bubbleScaleUser, setBubbleScaleUser] = useState(initialBubbleScale);
    const [ellipseScaleUser, setEllipseScaleUser] = useState(initialEllipseScale);
    const [bubbleRatioUser, setBubbleRatioUser] = useState(initialBubbleRatio);

    // Sync state when props change (from configuration modal)
    useEffect(() => {
        setPhaseCount(initialCount);
    }, [initialCount]);

    useEffect(() => {
        setBubbleScaleUser(initialBubbleScale);
    }, [initialBubbleScale]);

    useEffect(() => {
        setEllipseScaleUser(initialEllipseScale);
    }, [initialEllipseScale]);

    useEffect(() => {
        setBubbleRatioUser(initialBubbleRatio);
    }, [initialBubbleRatio]);

    useEffect(() => {
        setPhaseTimes(initialTimes);
    }, [initialTimes]);

    // Get group info for display
    const getGroupInfo = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group ? { name: group.name, courant: group.courant || '' } : { name: '?', courant: '' };
    };

    // Check if time is within an action's time range (handles wrap-around)
    const isTimeInRange = (time, start, end, effectiveCycleLength) => {
        const normalizedTime = time % effectiveCycleLength;
        const normalizedStart = parseInt(start);
        const normalizedEnd = parseInt(end);

        if (normalizedEnd > normalizedStart) {
            return normalizedTime >= normalizedStart && normalizedTime < normalizedEnd;
        } else {
            return normalizedTime >= normalizedStart || normalizedTime < normalizedEnd;
        }
    };

    // Get the color for a group at a specific time
    const getGroupColorAtTime = useCallback((groupId, time) => {
        const groupsData = simulationResult?.simulatedGroups || groups;
        const group = groupsData.find(g => g.id === groupId);

        if (!group) return 'rgb(255, 0, 0)';

        const effectiveCycleLength = simulationResult?.simulatedCycleLength || cycleLength;
        const offset = simulationResult ? (group.simulatedOffset ?? group.offset) : group.offset;
        const greenDuration = simulationResult ? (group.simulatedGreen ?? group.durations?.green ?? 0) : (group.durations?.green || 0);
        const orangeDuration = group.durations?.orange || 0;

        const normalizedTime = time % effectiveCycleLength;

        // Check for "Seconde lucarne" action
        const secondeLucarneAction = actionData.find(action =>
            action.action === 'Seconde lucarne' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
        );

        // Check for "Priorité piétons" action
        const prioritePietonsAction = actionData.find(action =>
            action.action === 'Priorité piétons' &&
            action.gf === String(groupId) &&
            action.deb !== '' &&
            action.fin !== '' &&
            selectedActions.includes(action.id)
        );

        if (secondeLucarneAction) {
            const inSecondeLucarne = isTimeInRange(
                normalizedTime,
                secondeLucarneAction.deb,
                secondeLucarneAction.fin,
                effectiveCycleLength
            );
            if (inSecondeLucarne) {
                return 'rgb(0, 180, 0)';
            }
        }

        if (prioritePietonsAction) {
            const inPrioritePietons = isTimeInRange(
                normalizedTime,
                prioritePietonsAction.deb,
                prioritePietonsAction.fin,
                effectiveCycleLength
            );
            if (inPrioritePietons) {
                const blink = Math.floor(time * 2) % 2 === 0;
                return blink ? 'rgb(255, 255, 0)' : 'rgb(180, 180, 0)';
            }
        }

        const greenStart = offset;
        const greenEnd = (offset + greenDuration) % effectiveCycleLength;
        const orangeEnd = (offset + greenDuration + orangeDuration) % effectiveCycleLength;

        let isGreen = false;
        if (greenEnd > greenStart) {
            isGreen = normalizedTime >= greenStart && normalizedTime < greenEnd;
        } else if (greenDuration > 0) {
            isGreen = normalizedTime >= greenStart || normalizedTime < greenEnd;
        }

        let isOrange = false;
        if (orangeDuration > 0) {
            if (orangeEnd > greenEnd) {
                isOrange = normalizedTime >= greenEnd && normalizedTime < orangeEnd;
            } else if (orangeEnd < greenEnd) {
                isOrange = normalizedTime >= greenEnd || normalizedTime < orangeEnd;
            }
        }

        if (isGreen) {
            return 'rgb(0, 255, 0)';
        } else if (isOrange) {
            return 'rgb(255, 255, 0)';
        } else {
            return 'rgb(255, 0, 0)';
        }
    }, [groups, simulationResult, cycleLength, actionData, selectedActions]);

    // Render arrow SVG based on courant type (with arrowLength and turnLength support)
    const renderArrowSVG = (courant, color, size = 24, arrowLength = 1, turnLength = 1, ppAllume = false) => {
        const strokeWidth = 2;
        const thinStrokeWidth = 1.5; // Thinner stroke for Piéton/Cycle

        switch (courant) {
            case 'TD':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD': {
                // Reduce horizontal part: full = 26, min = 14 (just after the curve)
                const tadEndX = 14 + (12 * turnLength); // 14 to 26
                const tadArrowX = tadEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tadArrowX - 6},2 ${tadArrowX},8 ${tadArrowX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TàG': {
                // Reduce horizontal part: full = 6, max = 18 (just after the curve)
                const tagEndX = 18 - (12 * turnLength); // 18 to 6
                const tagArrowX = tagEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tagArrowX + 6},2 ${tagArrowX},8 ${tagArrowX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TD_TàD':
            case 'TDTàD': // Legacy support
            case 'TD-TàD': { // Tout droit + Tourne à droite
                // Longueur : rallonge la hampe vers le bas, inchangée à 1.
                // Retour : portée de la branche tournante.
                const bottom = 28 + (arrowLength - 1) * 24;
                const vb = 32 + (arrowLength - 1) * 24;
                // Branche tournante perpendiculaire à la hampe, partant de sa racine.
                // Elle croisait la hampe quand elle en partait à mi-hauteur en
                // oblique ; au pied et à 90°, les deux tracés ne se rencontrent
                // plus. « Retour » (0 à 1) règle sa portée.
                const ANGLE = Math.PI / 2;
                const ct = Math.cos(ANGLE);
                const st = Math.sin(ANGLE);
                const portee = 14 * turnLength;
                const tipX = 12 + portee * st;
                // Attache à MI-HAMPE, donc proportionnelle : à un écart fixe du pied,
            // elle se retrouvait tassée en queue dès que la longueur passait à 2.
            const racineY = (8 + bottom) / 2;
                const tipY = racineY - portee * ct;
                // Barbes de la pointe, tournées du même angle que la branche.
                const barbe = (dx, dy) => `${(tipX + dx * ct - dy * st).toFixed(2)},${(tipY + dx * st + dy * ct).toFixed(2)}`;
                return (
                    <svg width={size} height={size + (arrowLength - 1) * 24} viewBox={`0 0 32 ${vb}`}>
                        <line x1="12" y1={bottom} x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M12,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TD_TàG':
            case 'TDTàG': // Legacy support
            case 'TD-TàG': { // Tout droit + Tourne à gauche
                const bottom = 28 + (arrowLength - 1) * 24;
                const vb = 32 + (arrowLength - 1) * 24;
                // Branche tournante perpendiculaire à la hampe, partant de sa racine.
                // Elle croisait la hampe quand elle en partait à mi-hauteur en
                // oblique ; au pied et à 90°, les deux tracés ne se rencontrent
                // plus. « Retour » (0 à 1) règle sa portée.
                const ANGLE = Math.PI / 2;
                const ct = Math.cos(ANGLE);
                const st = -Math.sin(ANGLE);
                const portee = 14 * turnLength;
                const tipX = 20 + portee * st;
                // Attache à MI-HAMPE, donc proportionnelle : à un écart fixe du pied,
            // elle se retrouvait tassée en queue dès que la longueur passait à 2.
            const racineY = (8 + bottom) / 2;
                const tipY = racineY - portee * ct;
                // Barbes de la pointe, tournées du même angle que la branche.
                const barbe = (dx, dy) => `${(tipX + dx * ct - dy * st).toFixed(2)},${(tipY + dx * st + dy * ct).toFixed(2)}`;
                return (
                    <svg width={size} height={size + (arrowLength - 1) * 24} viewBox={`0 0 32 ${vb}`}>
                        <line x1="20" y1={bottom} x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M20,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TD_G_D':
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16,20 Q8,20 8,12 L8,10" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="4,14 8,10 12,14" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16,20 Q24,20 24,12 L24,10" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,14 24,10 28,14" fill="none" stroke={color} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'PP': {
                // Priorité piéton : contour rouge constant, fond noir, jaune
                // pendant la phase jaune du groupe.
                // Le fond ne signale qu'un état : la phase jaune du groupe.
                // Priorité piéton : ce n'est pas un mouvement, donc pas une flèche.
                // Contour rouge constant et fin, fond noir.
                //
                // Le diagramme représente la période de priorité piéton en alternance
                // d'une seconde allumée et d'une seconde éteinte. Le triangle suit la
                // même cadence : jaune les secondes paires de la phase jaune, noir les
                // autres. Sans quoi le symbole serait fixe là où le diagramme clignote.
                // L'allumage est décidé par l'appelant (isPPLit) : il connaît la période
                // du groupe, que le dessin ignore.
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <polygon points="16,12 12,20 20,20" fill={ppAllume ? '#ffff00' : '#000000'} stroke="#e00000" strokeWidth={strokeWidth / 6} strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'Cycle': {
                // Un courant cycliste a un SENS : flèche simple, et non la
                // double flèche des traversées piétonnes. Trait fin pour la
                // distinguer d'un courant de véhicules.
                const cycleBase = 32;
                const cycleHeight = cycleBase + (arrowLength - 1) * 24;
                const cycleViewBox = 32 + (arrowLength - 1) * 24;
                const cycleTop = 6;
                const cycleBottom = 26 + (arrowLength - 1) * 24;
                const cycleScaled = size * (cycleHeight / cycleBase);
                return (
                    <svg width={size} height={cycleScaled} viewBox={`0 0 32 ${cycleViewBox}`}>
                        <line x1="16" y1={cycleBottom} x2="16" y2={cycleTop} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${cycleTop + 5} 16,${cycleTop} 21,${cycleTop + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'Piéton': {
                // Calculate extended height based on arrowLength (1 = normal, 2 = double, etc.)
                const baseSize = 32;
                const extendedHeight = baseSize + (arrowLength - 1) * 24; // Add 24px per unit above 1
                const viewBoxHeight = 32 + (arrowLength - 1) * 24;
                const topY = 6;
                const bottomY = 26 + (arrowLength - 1) * 24;
                const centerY = (topY + bottomY) / 2;
                // Scale the SVG size proportionally
                const scaledHeight = size * (extendedHeight / baseSize);
                return (
                    <svg width={size} height={scaledHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                        {/* Flèche vers le haut */}
                        <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche vers le bas */}
                        <line x1="16" y1={centerY} x2="16" y2={bottomY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${bottomY - 5} 16,${bottomY} 21,${bottomY - 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            default:
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
        }
    };

    // Calculate position on ellipse for each phase
    const ellipseFactor = ellipseScaleUser / 100;
    const ellipseFactorX = (ellipseScaleX ?? ellipseScaleUser) / 100;
    const getPhasePosition = (index, total) => {
        const { radiusX, radiusY, startAngle } = getEllipseConfig(total);
        const rx = radiusX * ellipseFactorX;
        const ry = radiusY * ellipseFactor;

        // Calculate angle step and position (clockwise)
        const angleStep = (2 * Math.PI) / total;
        const angle = startAngle + angleStep * index;

        const x = 50 + rx * Math.cos(angle);
        const y = 50 + ry * Math.sin(angle);

        return { x, y, angle };
    };

    // Get ellipse radii for SVG outline (uses same config)
    const getEllipseRadii = (count) => {
        const config = getEllipseConfig(count);
        return { radiusX: config.radiusX * ellipseFactorX, radiusY: config.radiusY * ellipseFactor };
    };

    // Arrow size ratio from IntersectionImage (96px arrow / 500px container = 19.2%)
    const ARROW_SIZE_RATIO = 0.192;

    // Tailles : calculées par la géométrie partagée, dont l'impression se sert
    // aussi pour mesurer la composition avant de la réduire à la page.
    const { bubbleWidth, bubbleHeight, clipWidth, clipHeight } = computeBubbleBox({
        count: phaseCount,
        bubbleScale: bubbleScaleUser,
        ratio: bubbleRatioUser
    });
    // Arrow size proportional to bubble height (same ratio as IntersectionImage)
    const arrowSize = Math.round(bubbleHeight * ARROW_SIZE_RATIO);

    // Render a phase bubble with label positioned based on vertical position
    const renderPhaseBubble = (index) => {
        const time = phaseTimes[index];
        const position = getPhasePosition(index, phaseCount);
        const isSideLabel = (courant) => courant === 'Piéton' || courant === 'Cycle';
        // Phase 1 always top-left, phases 3-4 (index 2-3) always bottom-right, others based on vertical position
        const isLabelTopLeft = index === 0 ? true : (index === 2 || index === 3) ? false : position.y < 50;

        return (
            <div
                key={index}
                className="phase-bubble"
                style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${clipWidth}px`,
                    height: `${clipHeight}px`
                }}
            >
                {/* Label positioned based on bubble vertical position (Phase 1 always top-left) */}
                {/* Coin d'ancrage posé ici, et non laissé à la feuille de style :
                    à l'impression, une étiquette a été vue décrochée de sa bulle.
                    Des coordonnées explicites ne dépendent d'aucune règle qu'une
                    feuille d'impression pourrait neutraliser. */}
                <div
                    className={`phase-bubble-label ${isLabelTopLeft ? 'label-top-left' : 'label-bottom-right'}`}
                    style={isLabelTopLeft
                        ? { top: '5px', left: '5px', bottom: 'auto', right: 'auto' }
                        : { bottom: '5px', right: '5px', top: 'auto', left: 'auto' }}
                >
                    <span className="phase-number">Phase {index + 1}</span>
                    <span className="phase-time-display">Seconde {time}</span>
                </div>
                {/* Image bubble - clip container changes shape with ratio, image stays fixed */}
                <div className="phase-bubble-content" style={{
                    width: `${clipWidth}px`,
                    height: `${clipHeight}px`
                }}>
                    <div
                        className="phase-bubble-image"
                        style={{
                            width: `${bubbleWidth}px`,
                            height: `${bubbleHeight}px`
                        }}
                    >
                        {intersectionImage ? (
                            <div className="phase-image-wrapper">
                                <img src={intersectionImage} alt="" className="phase-img" style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }} />
                                {intersectionArrows.map(arrow => {
                                    const groupInfo = getGroupInfo(arrow.groupId);
                                    const rotation = arrow.rotation || 0;
                                    const scale = arrow.scale || 1;
                                    const arrowLength = arrow.length || 1;
                                    const turnLength = arrow.turnLength || 1;
                                    const arrowColor = getGroupColorAtTime(arrow.groupId, time);

                                    return (
                                        <div
                                            key={arrow.id}
                                            className={`phase-arrow-marker ${isSideLabel(groupInfo.courant) ? 'side-label' : ''} ${hoveredGroupId === arrow.groupId ? 'hovered' : ''}`}
                                            style={{
                                                left: `${arrow.x}%`,
                                                top: `${arrow.y}%`
                                            }}
                                            onMouseEnter={() => setHoveredGroupId(arrow.groupId)}
                                            onMouseLeave={() => setHoveredGroupId(null)}
                                        >
                                            <div
                                                className="phase-arrow-symbol"
                                                style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
                                            >
                                                {renderArrowSVG(groupInfo.courant, arrowColor, arrowSize, arrowLength, turnLength, isPPLit(arrow.groupId, time, { groups, simulationResult, cycleLength }))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="phase-no-image">?</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="phasage-bulle-container">
            <div className="phasage-bulle-header">
                <div className="phasage-title-section">
                    <h3>Phasage bulle</h3>
                    {(planName || intersectionName) && (
                        <span className="phasage-plan-name">
                            {planName && intersectionName
                                ? `${planName} - ${intersectionName}`
                                : planName || intersectionName}
                        </span>
                    )}
                </div>
                <div className="phasage-controls">
                    <label className="phasage-slider-label">
                        Bulles
                        <input type="range" min="50" max="150" value={bubbleScaleUser} onChange={(e) => { const v = parseInt(e.target.value); setBubbleScaleUser(v); onBubbleScaleChange?.(v); }} className="phasage-slider" />
                    </label>
                    <label className="phasage-slider-label">
                        H/L
                        <input type="range" min="50" max="150" value={bubbleRatioUser} onChange={(e) => { const v = parseInt(e.target.value); setBubbleRatioUser(v); onBubbleRatioChange?.(v); }} className="phasage-slider" />
                    </label>
                    <label className="phasage-slider-label">
                        Ellipse
                        <input type="range" min="50" max="150" value={ellipseScaleUser} onChange={(e) => { const v = parseInt(e.target.value); setEllipseScaleUser(v); onEllipseScaleChange?.(v); }} className="phasage-slider" />
                    </label>
                    <span className="phasage-info">Cycle: {cycleLength}s</span>
                </div>
            </div>

            <div className="phasage-circular-container">
                {/* Ellipse outline - uses dynamic radii based on phase count */}
                <svg className="ellipse-outline" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <ellipse
                        cx="50"
                        cy="50"
                        rx={getEllipseRadii(phaseCount).radiusX}
                        ry={getEllipseRadii(phaseCount).radiusY}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                    />
                </svg>

                {/* Phase bubbles positioned around the ellipse */}
                {Array.from({ length: phaseCount }, (_, i) => renderPhaseBubble(i))}

                {/* Curved arrows between phases (clockwise, on outer periphery) */}
                {/* Repère élargi de 25 % de chaque côté, et élément débordant d'autant :
                    une unité vaut toujours 1 % du conteneur, mais un arc peut passer
                    au large des bulles sans être tronqué au bord du dessin. */}
                <svg
                    className="connecting-arrows"
                    viewBox="-25 -25 150 150"
                    preserveAspectRatio="none"
                    style={{ left: '-25%', top: '-25%', width: '150%', height: '150%' }}
                >
                    <defs>
                        <marker
                            id={marqueurFleche}
                            markerWidth="4"
                            markerHeight="3"
                            refX="3"
                            refY="1.5"
                            orient="auto"
                            markerUnits="strokeWidth"
                        >
                            <polygon
                                points="0,0 4,1.5 0,3"
                                fill="rgba(180,140,255,0.7)"
                            />
                        </marker>
                    </defs>
                    {Array.from({ length: phaseCount }, (_, i) => {
                        const { radiusX: baseRX, radiusY: baseRY, startAngle } = getEllipseConfig(phaseCount);
                        const radiusX = baseRX * ellipseFactorX;
                        const radiusY = baseRY * ellipseFactor;
                        const angleStep = (2 * Math.PI) / phaseCount;

                        // Current and next angles
                        const angle1 = startAngle + angleStep * i;
                        const angle2 = startAngle + angleStep * (i + 1);

                        // Écart des arcs vers l'extérieur de l'ellipse. À l'impression, il
                        // se resserre pour ne pas prendre la place des bulles (cf. App).
                        const outerOffset = arrowOffset;
                        const outerRadiusX = radiusX + outerOffset;
                        const outerRadiusY = radiusY + outerOffset;

                        // Start and end points on outer ellipse (with larger gap for shorter arrows)
                        const gapAngle = 0.55; // Larger gap = shorter arrows
                        const startAngleAdjusted = angle1 + gapAngle;
                        const endAngleAdjusted = angle2 - gapAngle;

                        const x1 = 50 + outerRadiusX * Math.cos(startAngleAdjusted);
                        const y1 = 50 + outerRadiusY * Math.sin(startAngleAdjusted);
                        const x2 = 50 + outerRadiusX * Math.cos(endAngleAdjusted);
                        const y2 = 50 + outerRadiusY * Math.sin(endAngleAdjusted);

                        // SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                        // sweep-flag=1 for clockwise
                        const largeArc = (endAngleAdjusted - startAngleAdjusted) > Math.PI ? 1 : 0;

                        return (
                            <path
                                key={i}
                                d={`M ${x1} ${y1} A ${outerRadiusX} ${outerRadiusY} 0 ${largeArc} 1 ${x2} ${y2}`}
                                fill="none"
                                stroke="rgba(180,140,255,0.7)"
                                strokeWidth="0.8"
                                markerEnd={`url(#${marqueurFleche})`}
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

export default PhasageBulle;
