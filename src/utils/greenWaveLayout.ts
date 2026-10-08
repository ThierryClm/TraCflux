/**
 * Mise en page de la marge gauche du diagramme d'onde verte.
 *
 * Les noms des carrefours et des groupes de feux sont alignés à droite sur
 * l'axe des distances. Avec une marge fixe, les noms longs commençaient
 * avant le bord du SVG et leur début était tronqué, à l'écran comme à
 * l'impression. La marge s'élargit donc selon le plus long libellé.
 *
 * Les chiffres de l'axe des distances ont leur propre colonne, entre les
 * libellés et l'axe : ils ne sont plus recouverts par les noms de groupes.
 * Ils sont rappelés à droite du diagramme, dans une marge minimale.
 */

export const LABEL_FONT = 'bold 13px Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
export const TICK_FONT = '10px Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';

/** Marge gauche minimale historique (px). */
export const MIN_PADDING_LEFT = 260;
/** Marge droite minimale historique (px). */
export const MIN_PADDING_RIGHT = 20;
/** Écart entre l'axe et ses chiffres de graduation (px). */
export const TICK_LABEL_OFFSET = 8;
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

const widestOf = (texts: string[], measure: (text: string) => number): number =>
    texts.reduce((max, text) => Math.max(max, measure(text)), 0);

/** Largeur de la colonne des chiffres de l'axe des distances, écart compris. */
export const computeTickSpace = (ticks: number[], measure = (text: string) => measureLabelWidth(text, TICK_FONT)): number =>
    Math.ceil(TICK_LABEL_OFFSET + widestOf(ticks.map(String), measure));

/** Marge gauche suffisante pour afficher entièrement tous les libellés,
 *  à gauche de la colonne des chiffres de l'axe. */
export const computeLeftPadding = (labels: string[], tickSpace = 0, measure = measureLabelWidth): number =>
    Math.max(MIN_PADDING_LEFT, Math.ceil(widestOf(labels, measure) + LABEL_GAP + tickSpace + AXIS_TITLE_SPACE));

/** Marge droite juste suffisante pour le rappel des chiffres de distance. */
export const computeRightPadding = (tickSpace: number): number =>
    Math.max(MIN_PADDING_RIGHT, tickSpace + 2);
