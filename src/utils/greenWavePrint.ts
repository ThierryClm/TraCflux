/**
 * Préparation du clone SVG imprimé de l'onde verte.
 *
 * Le diagramme affiché suit le thème de l'application : ses couleurs de fond,
 * de grille et d'axes viennent de classes CSS. Une règle CSS l'emporte sur un
 * attribut SVG `fill`/`stroke`, d'où un style inline pour imposer la palette
 * d'impression (fond blanc, traits sombres).
 *
 * Pendant l'impression, l'application (#root) est masquée par `display: none`.
 * Le clone porte pourtant les mêmes identifiants que l'original : une
 * référence `url(#bars-clip)` pointe alors sur le clipPath masqué, que le
 * navigateur ignore. Les barres de vert et les bandes passantes débordaient
 * ainsi sur les noms des groupes de feux. Tous les identifiants du clone sont
 * donc renommés, et leurs références réécrites.
 */

const PRINT_ID_SUFFIX = '-print';

const URL_REFERENCE_ATTRIBUTES = ['clip-path', 'fill', 'stroke', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end'];

const PRINT_COLORS: Array<[string, 'fill' | 'stroke', string]> = [
    ['.green-wave-svg-bg', 'fill', '#ffffff'],
    ['.green-wave-grid', 'stroke', '#dddddd'],
    ['.green-wave-grid-cycle', 'stroke', '#bbbbbb'],
    ['.green-wave-axis', 'stroke', '#333333'],
    ['.green-wave-axis-tick', 'fill', '#333333'],
    ['.green-wave-axis-label', 'fill', '#333333'],
];

const removeSpeedLine = (line: Element): void => {
    const group = line.parentElement;
    if (group && group.tagName.toLowerCase() === 'g' && group.children.length <= 2) group.remove();
    else line.remove();
};

/** Renomme les identifiants du clone et réécrit les références `url(#…)`. */
export const renameCloneIds = (root: Element, suffix = PRINT_ID_SUFFIX): void => {
    const renamed = new Map<string, string>();
    root.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id');
        if (!id) return;
        const next = `${id}${suffix}`;
        renamed.set(id, next);
        el.setAttribute('id', next);
    });
    if (renamed.size === 0) return;

    const rewrite = (value: string): string =>
        value.replace(/url\(\s*#([^)\s]+)\s*\)/g, (match, id: string) => {
            const next = renamed.get(id);
            return next ? `url(#${next})` : match;
        });

    const elements = [root, ...Array.from(root.querySelectorAll('*'))];
    elements.forEach((el) => {
        URL_REFERENCE_ATTRIBUTES.forEach((attr) => {
            const value = el.getAttribute(attr);
            if (value && value.includes('url(')) el.setAttribute(attr, rewrite(value));
        });
        const style = el.getAttribute('style');
        if (style && style.includes('url(')) el.setAttribute('style', rewrite(style));
    });
};

/**
 * Clone le SVG de l'onde verte et l'adapte à l'impression : fond blanc,
 * textes clairs passés en noir, poignées et lignes de vitesse retirées,
 * bandes passantes plus opaques, découpes rendues autonomes.
 */
export const buildGreenWavePrintClone = (svgEl: SVGSVGElement): SVGSVGElement => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;

    PRINT_COLORS.forEach(([selector, property, color]) => {
        clone.querySelectorAll<SVGElement>(selector).forEach((el) => {
            el.setAttribute(property, color);
            el.style.setProperty(property, color);
        });
    });
    clone.querySelectorAll('text[fill="#fff"]').forEach((el) => el.setAttribute('fill', '#000'));
    clone.querySelectorAll('line[stroke="transparent"]').forEach((el) => el.remove());
    clone.querySelectorAll('line[stroke="#4CAF50"][stroke-dasharray="8,4"]').forEach(removeSpeedLine);
    clone.querySelectorAll('line[stroke="#FF9800"][stroke-dasharray="8,4"]').forEach(removeSpeedLine);
    clone.querySelectorAll('polygon[opacity]').forEach((el) => el.setAttribute('opacity', '0.35'));

    renameCloneIds(clone);
    clone.style.removeProperty('cursor');
    return clone;
};
