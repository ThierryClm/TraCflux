/**
 * Mise en page de la marge gauche du diagramme d'onde verte.
 *
 * Les noms des carrefours et des groupes de feux sont alignés à droite sur
 * l'axe des distances. Avec une marge fixe, les noms longs commençaient
 * avant le bord du SVG et leur début était tronqué, à l'écran comme à
 * l'impression. La marge s'élargit donc selon le plus long libellé.
 */

export const LABEL_FONT = 'bold 13px Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

/** Marge gauche minimale historique (px). */
export const MIN_PADDING_LEFT = 260;
/** Écart entre la fin d'un libellé et l'axe des distances (px). */
export const LABEL_GAP = 5;
/** Place réservée au titre vertical « Distance (m) » (px). */
export const AXIS_TITLE_SPACE = 30;

const MAX_NAME_LENGTH = 40;
// Largeur moyenne d'un caractère gras 13 px, quand le canvas est indisponible.
const FALLBACK_CHAR_WIDTH = 8.5;

let measureContext: CanvasRenderingContext2D | null | undefined;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
    if (measureContext !== undefined) return measureContext;
    measureContext = null;
    try {
        if (typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) {
            measureContext = document.createElement('canvas').getContext('2d');
        }
    } catch {
        measureContext = null;
    }
    return measureContext;
};

export const measureLabelWidth = (text: string, font = LABEL_FONT): number => {
    const ctx = getMeasureContext();
    if (ctx) {
        ctx.font = font;
        return ctx.measureText(text).width;
    }
    return text.length * FALLBACK_CHAR_WIDTH;
};

export const truncateName = (name: string | undefined | null, maxLen = MAX_NAME_LENGTH): string => {
    if (!name) return '';
    return name.length > maxLen ? name.substring(0, maxLen) + '…' : name;
};

/** Marge gauche suffisante pour afficher entièrement tous les libellés. */
export const computeLeftPadding = (labels: string[], measure = measureLabelWidth): number => {
    const widest = labels.reduce((max, label) => Math.max(max, measure(label)), 0);
    return Math.max(MIN_PADDING_LEFT, Math.ceil(widest + LABEL_GAP + AXIS_TITLE_SPACE));
};
