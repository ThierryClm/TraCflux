/**
 * Géométrie du phasage bulle.
 *
 * Le placement des bulles vivait dans PhasageBulle, et l'impression du dossier
 * en portait sa propre copie — deux tables de marges recopiées à la main, qui
 * décidaient de la taille imprimée sans jamais voir la composition réelle. Les
 * deux ne pouvaient qu'diverger. Tout est ici, et les deux appelants s'en
 * servent : l'écran pour dessiner, l'impression pour mesurer avant de réduire.
 */

/**
 * Décalage des arcs de liaison vers l'extérieur de l'ellipse, en % du
 * conteneur (cf. PhasageBulle : outerOffset). Les arcs sont tracés dans un
 * viewBox 0–100 : au-delà de 50 % de rayon utile, ils sortent de la boîte et
 * le navigateur les tronque — d'où les arcs en morceaux dès que les bulles
 * étaient trop écartées.
 */
export const ARROW_OUTER_OFFSET = 14;

/** Décalage minimal : en deçà, les arcs se confondent avec les bulles. */
export const MIN_ARROW_OFFSET = 4;

/** Taille de référence d'une bulle, avant échelle (px). */
export const BASE_BUBBLE_WIDTH = 570;
export const BASE_BUBBLE_HEIGHT = 456;

/**
 * Rayons de l'ellipse de placement (en % du conteneur) et angle de départ.
 * Phase 1 part toujours de la gauche ; les rayons horizontaux sont resserrés
 * pour une répartition moins étalée.
 */
export const getEllipseConfig = (count) => {
    switch (count) {
        case 2:  return { radiusX: 22, radiusY: 25, startAngle: Math.PI };
        case 3:  return { radiusX: 23, radiusY: 30, startAngle: Math.PI };
        case 5:  return { radiusX: 27, radiusY: 34, startAngle: Math.PI };
        case 6:  return { radiusX: 28, radiusY: 35, startAngle: Math.PI };
        default: return { radiusX: 26, radiusY: 32, startAngle: Math.PI };
    }
};

/**
 * Étalement horizontal maximal : au-delà, les arcs de liaison sortent du
 * viewBox et sont tronqués. Deux points de marge sont gardés.
 */
export const maxEllipseScaleX = (count) => {
    const { radiusX } = getEllipseConfig(count);
    return ((50 - MIN_ARROW_OFFSET - 2) / radiusX) * 100;
};

/** Correctif de taille selon le nombre de phases : plus il y en a, plus elles sont petites. */
export const getScaleFactor = (count) => {
    switch (count) {
        case 2:  return 1.2;
        case 5:  return 0.9;
        case 6:  return 0.8;
        default: return 1.0;
    }
};

/**
 * Boîte d'une bulle : l'image garde sa taille, le masque elliptique s'étire
 * selon le rapport H/L choisi.
 */
export const computeBubbleBox = ({ count, bubbleScale = 100, ratio = 100 }) => {
    const scale = getScaleFactor(count) * (bubbleScale / 100);
    const ratioFactor = ratio / 100;
    const bubbleWidth = Math.round(BASE_BUBBLE_WIDTH * scale);
    const bubbleHeight = Math.round(BASE_BUBBLE_HEIGHT * scale);
    return {
        bubbleWidth,
        bubbleHeight,
        clipWidth: Math.round(bubbleWidth / Math.sqrt(ratioFactor)),
        clipHeight: Math.round(bubbleHeight * Math.sqrt(ratioFactor))
    };
};

/**
 * Centre d'une bulle dans le conteneur, en fraction (0–1).
 *
 * L'étalement horizontal se règle séparément (ellipseScaleX) : une feuille A4
 * paysage est bien plus large que haute, alors que la composition est presque
 * carrée. Écarter les bulles latéralement remplit la page sans déformer les
 * plans qu'elles contiennent — ce qu'une mise à l'échelle non uniforme ferait.
 */
export const getPhaseCenter = (index, count, ellipseScale = 100, ellipseScaleX = null) => {
    const { radiusX, radiusY, startAngle } = getEllipseConfig(count);
    const fy = ellipseScale / 100;
    const fx = (ellipseScaleX ?? ellipseScale) / 100;
    const angle = startAngle + ((2 * Math.PI) / count) * index;
    return {
        x: 0.5 + (radiusX * fx / 100) * Math.cos(angle),
        y: 0.5 + (radiusY * fy / 100) * Math.sin(angle)
    };
};

/**
 * Étalement horizontal donnant à la composition les proportions de la page.
 *
 * Renvoie un pourcentage d'ellipse à appliquer sur l'axe X, jamais inférieur au
 * réglage de l'utilisateur : on écarte les bulles, on ne les rapproche pas.
 */
export const fitEllipseScaleX = ({ count, bubbleScale = 100, ellipseScale = 100, ratio = 100, containerWidth, containerHeight, targetAspect }) => {
    const { radiusX } = getEllipseConfig(count);
    const { clipWidth } = computeBubbleBox({ count, bubbleScale, ratio });
    const boxY = computeCompositionBox({ count, bubbleScale, ellipseScale, ratio, containerWidth, containerHeight });
    const largeurVoulue = boxY.height * targetAspect;
    if (radiusX <= 0) return ellipseScale;

    const rayonVoulu = (largeurVoulue - clipWidth) / (2 * containerWidth);
    const fx = (rayonVoulu * 10000) / radiusX;
    if (!Number.isFinite(fx)) return ellipseScale;
    // Bornes : jamais plus resserré que le réglage, jamais au point de sortir
    // les bulles du conteneur au-delà de ce que la mise à l'échelle rattrape.
    return Math.min(maxEllipseScaleX(count), Math.max(ellipseScale, fx));
};

/**
 * Encombrement réel de la composition dans un conteneur donné, en pixels.
 *
 * Une bulle déborde volontiers de l'ellipse qui la place — c'est même ce qui
 * produit les chevauchements voulus. La boîte englobante ne se déduit donc pas
 * de l'ellipse seule : il faut réunir les bulles une à une. Le centre renvoyé
 * n'est pas celui du conteneur pour un nombre impair de phases, où la
 * répartition n'est pas symétrique horizontalement.
 *
 * @returns {{left, right, top, bottom, width, height, centerX, centerY}} px
 */
export const computeCompositionBox = ({ count, bubbleScale = 100, ellipseScale = 100, ellipseScaleX = null, ratio = 100, containerWidth, containerHeight, arrowOffset = null }) => {
    const { clipWidth, clipHeight } = computeBubbleBox({ count, bubbleScale, ratio });
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < count; i++) {
        const c = getPhaseCenter(i, count, ellipseScale, ellipseScaleX);
        const cx = c.x * containerWidth;
        const cy = c.y * containerHeight;
        left = Math.min(left, cx - clipWidth / 2);
        right = Math.max(right, cx + clipWidth / 2);
        top = Math.min(top, cy - clipHeight / 2);
        bottom = Math.max(bottom, cy + clipHeight / 2);
    }

    // Les arcs contournent les bulles : ils forment le contour extérieur du
    // dessin et doivent tenir dans la page, sinon ils sont rognés.
    if (arrowOffset != null) {
        const { radiusX, radiusY } = getEllipseConfig(count);
        const arcX = (radiusX * ((ellipseScaleX ?? ellipseScale) / 100) + arrowOffset) / 100;
        const arcY = (radiusY * (ellipseScale / 100) + arrowOffset) / 100;
        left = Math.min(left, (0.5 - arcX) * containerWidth);
        right = Math.max(right, (0.5 + arcX) * containerWidth);
        top = Math.min(top, (0.5 - arcY) * containerHeight);
        bottom = Math.max(bottom, (0.5 + arcY) * containerHeight);
    }

    return {
        left, right, top, bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2
    };
};

/**
 * Décalage des arcs adapté à la place restante autour des bulles.
 *
 * Les arcs ne sont qu'un trait : leur faire payer une place de premier rang
 * rapetissait les bulles, seul contenu utile de la page. On dimensionne donc
 * sur les bulles, puis on rentre les arcs dans ce qui reste — jamais moins que
 * MIN_ARROW_OFFSET, où ils colleraient aux bulles, jamais plus que le décalage
 * nominal, où ils s'en éloigneraient sans raison.
 *
 * @param {Object} p - Composition, cadre de page (px de canevas) et centre visé
 * @returns {number} Décalage en % du conteneur
 */
export const fitArrowOffset = ({ count, bubbleScale = 100, ratio = 100, ellipseScale = 100, ellipseScaleX = null, containerWidth, containerHeight, pageWidth, pageHeight, center }) => {
    const { radiusX, radiusY } = getEllipseConfig(count);
    const rx = radiusX * ((ellipseScaleX ?? ellipseScale) / 100);
    const ry = radiusY * (ellipseScale / 100);

    // Marges disponibles entre le centre du conteneur (où l'ellipse est centrée)
    // et les bords de la page, exprimées en % du conteneur.
    const marges = [
        ((center.x + pageWidth / 2) - 0.5 * containerWidth) / containerWidth * 100 - rx,
        (0.5 * containerWidth - (center.x - pageWidth / 2)) / containerWidth * 100 - rx,
        ((center.y + pageHeight / 2) - 0.5 * containerHeight) / containerHeight * 100 - ry,
        (0.5 * containerHeight - (center.y - pageHeight / 2)) / containerHeight * 100 - ry
    ];
    // Écart minimal pour que l'ovale CONTOURNE les bulles au lieu de les
    // traverser. Le décalage nominal est un pourcentage du conteneur : à
    // l'écran, où les bulles sont petites devant leur conteneur, 14 % suffisent
    // largement ; sur une page, où elles en occupent presque la moitié, l'ovale
    // leur passait au travers. On part donc de leur demi-encombrement.
    const { clipWidth, clipHeight } = computeBubbleBox({ count, bubbleScale, ratio });
    const demiX = (clipWidth / 2) / containerWidth * 100;
    const demiY = (clipHeight / 2) / containerHeight * 100;
    const voulu = Math.max(ARROW_OUTER_OFFSET, Math.max(demiX, demiY) + 3);

    // Le tracé lui-même n'est plus une limite : le repère des arcs déborde du
    // conteneur (cf. PhasageBulle), les arcs ne sont donc plus tronqués.
    const dispo = Math.min(...marges);
    if (!Number.isFinite(dispo)) return voulu;
    return Math.max(MIN_ARROW_OFFSET, Math.min(voulu, Math.max(voulu, dispo)));
};
