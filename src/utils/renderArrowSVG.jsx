/**
 * Renders an SVG arrow for a given traffic movement type.
 *
 * @param {string} courant - Movement type ('TD', 'TàD', 'TàG', 'TDTàD', 'TDTàG', 'TD_G_D', 'Piéton', 'Cycle')
 * @param {string} color - SVG stroke color
 * @param {number} arrowLength - Length multiplier (default 1)
 * @param {number} turnLength - Turn length multiplier (default 1)
 * @param {boolean} ppAllume - Triangle PP allumé à cet instant (cf. isPPLit)
 * @returns {JSX.Element} SVG element
 */
const renderFloatingArrowSVG = (courant, color, arrowLength = 1, turnLength = 1, ppAllume = false) => {
    const strokeWidth = 3;
    const thinStrokeWidth = 2;
    const size = 32;

    switch (courant) {
        case 'TD':
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case 'TàD': {
            const tadEndX = 14 + (12 * turnLength);
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${tadEndX - 6},2 ${tadEndX},8 ${tadEndX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TàG': {
            const tagEndX = 18 - (12 * turnLength);
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${tagEndX + 6},2 ${tagEndX},8 ${tagEndX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TD_TàD':
        case 'TDTàD':
        case 'TD-TàD': {
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
                    <path d={`M12,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TD_TàG':
        case 'TDTàG':
        case 'TD-TàG': {
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
                    <path d={`M20,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'TD_G_D': { // Tout droit + Tourne à gauche et à droite
            // Somme exacte de TD_TàD et TD_TàG : même hampe, mêmes branches
            // perpendiculaires attachées à mi-hampe, mêmes barbes.
            //
            // Le tracé courbe d'origine détonnait à côté des deux flèches dont
            // celle-ci est la combinaison, et ignorait « Longueur » et « Retour ».
            const bottom = 28 + (arrowLength - 1) * 24;
            const vb = 32 + (arrowLength - 1) * 24;
            const portee = 14 * turnLength;
            const racineY = (8 + bottom) / 2;
            // Une branche par côté : sens = +1 à droite, -1 à gauche. La branche
            // étant horizontale, les barbes se déduisent sans rotation.
            const branche = (sens) => {
                const tipX = 16 + portee * sens;
                const barbe = (dx, dy) => `${(tipX - dy * sens).toFixed(2)},${(racineY + dx * sens).toFixed(2)}`;
                return { tipX: tipX.toFixed(2), pointe: `${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}` };
            };
            return (
                <svg width={size} height={size + (arrowLength - 1) * 24} viewBox={`0 0 32 ${vb}`}>
                    {/* Flèche tout droit, hampe centrée */}
                    <line x1="16" y1={bottom} x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                    <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Branches tournantes, à gauche et à droite */}
                    {[branche(-1), branche(1)].map((b, i) => (
                        <g key={i}>
                            <path d={`M16,${racineY} L${b.tipX},${racineY}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points={b.pointe} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    ))}
                </svg>
            );
        }
        case 'PP': {
            // Priorité piéton : ce n'est pas un mouvement, donc pas une flèche.
            // Contour rouge constant, fond noir ; il ne passe au jaune que
            // pendant la phase jaune du groupe. Orientable et redimensionnable
            // par la rotation et l'échelle, comme les autres symboles.
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
            // Un courant cycliste a un SENS : flèche simple, et non la double
            // flèche des traversées piétonnes. Trait fin pour la distinguer
            // d'un courant de véhicules.
            const cycleHeight = size + (arrowLength - 1) * 24;
            const cycleViewBox = 32 + (arrowLength - 1) * 24;
            const cycleTop = 6;
            const cycleBottom = 26 + (arrowLength - 1) * 24;
            return (
                <svg width={size} height={cycleHeight} viewBox={`0 0 32 ${cycleViewBox}`}>
                    <line x1="16" y1={cycleBottom} x2="16" y2={cycleTop} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                    <polyline points={`11,${cycleTop + 5} 16,${cycleTop} 21,${cycleTop + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        case 'Piéton': {
            const extendedHeight = size + (arrowLength - 1) * 24;
            const viewBoxHeight = 32 + (arrowLength - 1) * 24;
            const topY = 6;
            const bottomY = 26 + (arrowLength - 1) * 24;
            const centerY = (topY + bottomY) / 2;
            return (
                <svg width={size} height={extendedHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                    <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                    <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
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

export default renderFloatingArrowSVG;
