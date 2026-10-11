/**
 * Préparation du clone SVG imprimé de l'onde verte.
 *
 * Le diagramme affiché suit le thème de l'application : ses couleurs de fond,
 * de grille et d'axes viennent de classes CSS. Une règle CSS l'emporte sur un
 * attribut SVG `fill`/`stroke`, d'où un style inline pour imposer la palette
 * d'impression (fond blanc, traits sombres).
 *
 * Quand le clone était imprimé dans la page même, l'application (#root) était
 * masquée par `display: none` alors que le clone portait les mêmes
 * identifiants : une référence `url(#bars-clip)` pointait sur le clipPath
 * masqué, que le navigateur ignore, et les barres de vert débordaient sur les
 * noms des groupes de feux. L'impression se fait désormais dans un onglet à
 * part ; les identifiants du clone restent renommés, ce qui le garde autonome.
 */

import { buildExportFilename } from './exportFilename';
import { toast } from './toast';
import { documentImpression, echapperHtml, ouvrirOngletImpression } from './ongletImpression';
import type { BandwidthData } from './greenWaveBandwidth';

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

export interface GreenWavePrintOptions {
    diagramWidth: number;
    diagramHeight: number;
    speedUp: number;
    speedDown: number;
    bandwidthData: BandwidthData | null;
    greenWaveName: string;
    /** Export PDF : propose « Enregistrer au format PDF » et un nom de fichier. */
    pdf?: boolean;
}

export interface GreenWavePrintDocumentOptions extends GreenWavePrintOptions {
    /** Document d'où viennent le diagramme, les styles et l'adresse de base. */
    source?: Document;
}

/**
 * Document HTML autonome de l'impression : titre, légende, puis le diagramme
 * réduit à une page A4 paysage. Il lance lui-même l'impression une fois
 * chargé et se ferme ensuite. Null si l'onde verte n'est pas affichée.
 */
export const buildGreenWavePrintDocument = ({
    diagramWidth, diagramHeight, speedUp, speedDown, bandwidthData, greenWaveName, pdf = false,
    source = document
}: GreenWavePrintDocumentOptions): string | null => {
    const svgEl = source.querySelector<SVGSVGElement>('.green-wave-svg');
    if (!svgEl) return null;

    const clone = buildGreenWavePrintClone(svgEl);

    const pageW = 1048;
    const headerH = 76;
    const pageH = 756 - headerH;
    const scaleX = pageW / diagramWidth;
    const scaleY = pageH / diagramHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    clone.setAttribute('width', String(Math.round(diagramWidth * scale)));
    clone.setAttribute('height', String(Math.round(diagramHeight * scale)));

    const legendItems: string[] = [];
    const li = (iconHtml: string, text: string) => legendItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;color:#000">${iconHtml} ${text}</span>`);
    li('<span style="width:20px;border-top:2px dashed #4CAF50;display:inline-block"></span>', `V. montante : ${speedUp} km/h`);
    li('<span style="width:20px;border-top:2px dashed #FF9800;display:inline-block"></span>', `V. descendante : ${speedDown} km/h`);
    if (bandwidthData?.ascending) li('<span style="width:14px;height:9px;background:rgba(76,175,80,0.3);border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', `BP montante : ${bandwidthData.ascending.width.toFixed(1)}s`);
    if (bandwidthData?.descending) li('<span style="width:14px;height:9px;background:rgba(255,152,0,0.3);border:1px solid #FF9800;border-radius:2px;display:inline-block"></span>', `BP descendante : ${bandwidthData.descending.width.toFixed(1)}s`);
    li('<span style="width:14px;height:9px;background:#2E7D32;border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', '2nde lucarne');
    li('<span style="width:14px;height:9px;background:repeating-linear-gradient(45deg,transparent,transparent 2px,#4CAF50 2px,#4CAF50 4px);border:1px solid #4CAF50;border-radius:2px;display:inline-block"></span>', 'Ouv. anticipée');

    const nom = greenWaveName ? echapperHtml(greenWaveName) : '';
    // Le titre du document sert de nom de fichier proposé pour le PDF.
    const titre = pdf
        ? buildExportFilename('Onde verte', greenWaveName)
        : `Onde verte${greenWaveName ? ' - ' + greenWaveName : ''}`;

    return documentImpression(
        '<div id="gw-print-area">'
        + `<h1 style="font-size:14pt;margin:0 0 4px 0;font-family:Arial,sans-serif;color:#000;">Onde Verte${nom ? ' - ' + nom : ''}</h1>`
        + `<div style="display:flex;flex-wrap:nowrap;gap:12px;font-size:7.5pt;margin-bottom:6px;font-family:Arial,sans-serif;white-space:nowrap;">${legendItems.join('')}</div>`
        + new XMLSerializer().serializeToString(clone)
        + '</div>',
        {
            titre,
            // Mêmes classes que la page d'origine : thème et règles
            // d'impression de GreenWaveViewer.css s'appliquent comme avant.
            classesBody: `${source.body.className} print-greenwave`.trim(),
            styleSupplementaire: '@page { size: A4 landscape; margin: 5mm 10mm; }'
                + ' html, body { background: #fff !important; margin: 0; }'
                + ' #gw-print-area { background: #fff; padding: 8px; }',
            source
        }
    );
};

/**
 * Imprime l'onde verte dans un onglet indépendant (cf. utils/ongletImpression) :
 * TraCflux reste utilisable pendant l'impression. « Imprimer… » et
 * « Exporter PDF… » partagent ce rendu.
 */
export const printGreenWave = (options: GreenWavePrintOptions): void => {
    const html = buildGreenWavePrintDocument(options);
    if (!html) return;
    ouvrirOngletImpression(html);
    if (options.pdf) {
        toast.info('Dans la boîte d\'impression, sélectionnez « Enregistrer au format PDF »');
    }
};
