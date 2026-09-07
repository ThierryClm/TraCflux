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
/**
 * Cadre de référence des flèches : l'image du carrefour.
 *
 * C'est là que l'utilisateur règle rotation, zoom, longueur et retour de chaque
 * flèche ; sa taille y fait donc foi. Le cadre mesure 750 × 530 px
 * (`.intersection-image-area`, IntersectionImage.css) et la flèche 96 px
 * (`ARROW_SIZE`, floatingImageBox.js) — deux valeurs à garder d'accord avec
 * celles-ci si elles changent.
 */
export const REF_IMAGE_BOX_WIDTH = 750;
export const REF_IMAGE_BOX_HEIGHT = 530;
export const REF_ARROW_SIZE = 96;

/**
 * Cadre du plan dans une bulle : homothétique de celui du carrefour.
 *
 * Les flèches sont repérées en pourcentage de leur cadre, et l'image y est posée
 * en « contain ». Deux cadres de rapports différents placent donc leurs bandes
 * vides sur des axes différents — à gauche et à droite dans le carrefour, en
 * haut et en bas dans la bulle pour un plan en 4/3 — et chaque flèche dérive
 * d'un côté ici, de l'autre là. La bulle recevait `bubbleWidth × bubbleHeight`,
 * de rapport 1,25 contre 1,415 : le placement ne pouvait pas coïncider.
 *
 * En donnant à la bulle le cadre du carrefour réduit d'un facteur unique, tout
 * suit : même découpage, même position relative, même taille de flèche par
 * rapport au plan, quel que soit le format de l'image. À l'impression, où la
 * composition est agrandie pour occuper la page, le facteur grandit avec elle.
 */
export const planFrameForBubble = (bubbleWidth, bubbleHeight) => {
    const facteur = Math.min(bubbleWidth / REF_IMAGE_BOX_WIDTH, bubbleHeight / REF_IMAGE_BOX_HEIGHT);
    return {
        facteur,
        frameWidth: Math.round(REF_IMAGE_BOX_WIDTH * facteur),
        frameHeight: Math.round(REF_IMAGE_BOX_HEIGHT * facteur),
        arrowSize: Math.round(REF_ARROW_SIZE * facteur)
    };
};

export const BASE_BUBBLE_WIDTH = 570;
// Hauteur de base : celle du cadre du plan, pas une valeur propre.
//
// La bulle valait 570 × 456, de rapport 1,25, alors que le plan y est posé dans
// un cadre au rapport de l'image du carrefour, 750 × 530 soit 1,415. Le plan
// n'occupait donc que 88 % de la hauteur de l'ovale, deux bandes vides au-dessus
// et au-dessous — et c'est ce qui donnait aux bulles imprimées cet air de
// contenu trop petit. En donnant à la bulle la forme exacte de son cadre, le
// plan la remplit et gagne 13 % de taille sans consommer un millimètre de page.
export const BASE_BUBBLE_HEIGHT = Math.round(BASE_BUBBLE_WIDTH * REF_IMAGE_BOX_HEIGHT / REF_IMAGE_BOX_WIDTH);

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
    // Proportionnel à la bulle, SANS plancher fixe : un plancher exprimé en % du
    // conteneur ne suit pas la taille des bulles. En dessous d'une certaine
    // taille, l'ovale cessait de rétrécir avec elles et c'est lui qui dictait la
    // mise à l'échelle de la page — les bulles se retrouvaient en petit tas au
    // centre. Le dessin est désormais semblable à lui-même quel que soit le
    // curseur : sa mise en page imprimée ne bouge plus.
    const voulu = Math.max(demiX, demiY) * 1.15;

    // Le tracé lui-même n'est plus une limite : le repère des arcs déborde du
    // conteneur (cf. PhasageBulle), les arcs ne sont donc plus tronqués.
    const dispo = Math.min(...marges);
    if (!Number.isFinite(dispo)) return voulu;
    return Math.max(MIN_ARROW_OFFSET, Math.min(voulu, Math.max(voulu, dispo)));
};

/**
 * Rayons d'ellipse donnant des écarts ÉGAUX entre bulles voisines.
 *
 * Les rayons de getEllipseConfig sont des pourcentages du conteneur : leur
 * rapport dépend donc de la forme du conteneur, pas de celle des bulles. Sur un
 * conteneur large, les bulles du haut et du bas s'éloignent de leurs voisines
 * alors que celles de gauche et de droite s'en rapprochent — c'est l'écart que
 * l'œil relève sur la bulle du bas.
 *
 * En donnant à l'ellipse de placement le MÊME rapport de forme que les bulles,
 * la configuration se ramène, après normalisation, à des cercles unité répartis
 * sur un cercle de rayon k : deux voisins distants de 2·k·sin(π/N) se touchent
 * quand k = 1 / sin(π/N). Les écarts sont alors égaux par construction, pour
 * n'importe quel nombre de phases.
 *
 * @param {number} jeu - 1 = tangent, 1,05 = un léger jour entre les bulles
 * @returns {{ellipseScale: number, ellipseScaleX: number}} à passer au composant
 */
export const fitTangentEllipse = ({ count, bubbleScale = 100, ratio = 100, ellipseScale = 100, containerWidth, containerHeight, jeu = 1 }) => {
    const { clipWidth, clipHeight } = computeBubbleBox({ count, bubbleScale, ratio });
    const config = getEllipseConfig(count);
    const k = (jeu / Math.sin(Math.PI / Math.max(2, count))) * (ellipseScale / 100);

    // Rayons voulus, en % du conteneur, puis convertis dans l'échelle attendue
    // par le composant (un pourcentage des rayons de référence).
    const rxVoulu = (k * (clipWidth / 2)) / containerWidth * 100;
    const ryVoulu = (k * (clipHeight / 2)) / containerHeight * 100;
    return {
        ellipseScaleX: (rxVoulu / config.radiusX) * 100,
        ellipseScale: (ryVoulu / config.radiusY) * 100
    };
};

/**
 * Composition dessinée DIRECTEMENT à la taille de la page.
 *
 * Remplace l'empilement précédent — canevas virtuel, mise à l'échelle, décalage
 * de recentrage, contre-échelle des étiquettes. Chaque couche rattrapait la
 * précédente, et leur composition n'était plus prévisible.
 *
 * Ici, une seule inconnue : la demi-hauteur de bulle. Tout le reste en découle
 * linéairement — rayons de l'ellipse (tangence, cf. fitTangentEllipse), écart des
 * arcs, encombrement total. On résout donc directement pour que le dessin
 * remplisse la page, sans plus rien mettre à l'échelle ensuite.
 *
 * @param {number} jeu - 1 = bulles tangentes, 1,02 = un cheveu de jour
 * @param {number} degagement - marge des arcs autour des bulles, en demi-bulles
 * @returns {{bubbleScale, ellipseScale, ellipseScaleX, arrowOffsetX, arrowOffsetY}}
 *          les réglages à passer au composant, en % comme il les attend
 */
export const fitBubblesToPage = ({ count, ratio = 100, ellipseScale = 100, pageWidth, pageHeight, jeu = 1.02, degagement = 0.15 }) => {
    const config = getEllipseConfig(count);
    const base = computeBubbleBox({ count, bubbleScale: 100, ratio });
    const forme = base.clipWidth / base.clipHeight; // largeur / hauteur d'une bulle
    // L'écartement voulu par l'utilisateur peut ÉLOIGNER les bulles, jamais les
    // rapprocher en deçà de la tangence : sous 100 %, il annulait la garantie
    // portée par « jeu » et les bulles imprimées se chevauchaient — visible sur
    // un plan et pas sur le suivant, chacun ayant son propre réglage.
    const k = (jeu / Math.sin(Math.PI / Math.max(2, count))) * Math.max(1, ellipseScale / 100);

    // Tout est exprimé en demi-hauteurs de bulle : la composition est linéaire.
    const angles = Array.from({ length: count }, (_, i) => config.startAngle + (2 * Math.PI / count) * i);
    const cosMax = Math.max(...angles.map(a => Math.abs(Math.cos(a))));
    const sinMax = Math.max(...angles.map(a => Math.abs(Math.sin(a))));
    const uX = Math.max(k * forme * cosMax + forme, k * forme + (1 + degagement) * forme);
    const uY = Math.max(k * sinMax + 1, k + (1 + degagement));

    const demiHauteur = Math.min(pageWidth / (2 * uX), pageHeight / (2 * uY));
    const demiLargeur = forme * demiHauteur;


    const echelleBulle = ((2 * demiHauteur) / (BASE_BUBBLE_HEIGHT * getScaleFactor(count) * Math.sqrt(ratio / 100))) * 100;
    return {
        bubbleScale: echelleBulle,
        ellipseScale: (((k * demiHauteur) / pageHeight) * 100 / config.radiusY) * 100,
        ellipseScaleX: (((k * demiLargeur) / pageWidth) * 100 / config.radiusX) * 100,
        arrowOffsetX: ((degagement * demiLargeur) / pageWidth) * 100,
        arrowOffsetY: ((degagement * demiHauteur) / pageHeight) * 100
    };
};
