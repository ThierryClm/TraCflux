import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGreenWavePrintClone, buildGreenWavePrintDocument, printGreenWave, renameCloneIds } from './greenWavePrint';

const SVG_NS = 'http://www.w3.org/2000/svg';

const makeSvg = (markup) => {
    const host = document.createElement('div');
    host.innerHTML = `<svg xmlns="${SVG_NS}" class="green-wave-svg">${markup}</svg>`;
    document.body.appendChild(host);
    return host.firstElementChild;
};

describe('buildGreenWavePrintClone', () => {
    it('impose un fond blanc en style inline, prioritaire sur le CSS du thème', () => {
        const svg = makeSvg('<rect class="green-wave-svg-bg" /><line class="green-wave-axis" />');
        const clone = buildGreenWavePrintClone(svg);
        const bg = clone.querySelector('.green-wave-svg-bg');
        expect(bg.style.getPropertyValue('fill')).toMatch(/#ffffff|rgb\(255, 255, 255\)/);
        expect(bg.getAttribute('fill')).toBe('#ffffff');
        expect(clone.querySelector('.green-wave-axis').style.getPropertyValue('stroke')).not.toBe('');
        // L'original affiché à l'écran n'est pas modifié.
        expect(svg.querySelector('.green-wave-svg-bg').getAttribute('style')).toBeNull();
    });

    it('rend les découpes du clone indépendantes de celles de l\'original masqué', () => {
        const svg = makeSvg(`
            <defs>
                <clipPath id="bars-clip"><rect /></clipPath>
                <clipPath id="bandwidth-clip"><rect /></clipPath>
                <pattern id="hatch-0-0-0"></pattern>
            </defs>
            <g clip-path="url(#bars-clip)"><rect fill="url(#hatch-0-0-0)" /></g>
            <g clip-path="url(#bandwidth-clip)"></g>
            <g clip-path="url(#ailleurs)"></g>
        `);
        const clone = buildGreenWavePrintClone(svg);
        expect(clone.querySelector('#bars-clip')).toBeNull();
        expect(clone.querySelector('#bars-clip-print')).not.toBeNull();
        expect(clone.querySelector('g[clip-path="url(#bars-clip-print)"]')).not.toBeNull();
        expect(clone.querySelector('g[clip-path="url(#bandwidth-clip-print)"]')).not.toBeNull();
        expect(clone.querySelector('rect[fill="url(#hatch-0-0-0-print)"]')).not.toBeNull();
        // Une référence vers un identifiant extérieur au clone reste intacte.
        expect(clone.querySelector('g[clip-path="url(#ailleurs)"]')).not.toBeNull();
        // L'original garde ses identifiants.
        expect(svg.querySelector('#bars-clip')).not.toBeNull();
    });

    it('retire les poignées et lignes de vitesse, passe les textes blancs en noir', () => {
        const svg = makeSvg(`
            <g><line stroke="transparent" /><line stroke="#4CAF50" stroke-dasharray="8,4" /></g>
            <g><line stroke="transparent" /><line stroke="#FF9800" stroke-dasharray="8,4" /></g>
            <text fill="#fff">Carrefour</text>
            <polygon opacity="0.2" />
        `);
        const clone = buildGreenWavePrintClone(svg);
        expect(clone.querySelectorAll('line')).toHaveLength(0);
        expect(clone.querySelector('text').getAttribute('fill')).toBe('#000');
        expect(clone.querySelector('polygon').getAttribute('opacity')).toBe('0.35');
    });
});

describe('renameCloneIds', () => {
    it('réécrit aussi les références placées dans l\'attribut style', () => {
        const svg = makeSvg('<clipPath id="c"></clipPath><g style="clip-path: url(#c)"></g>');
        renameCloneIds(svg, '-x');
        expect(svg.querySelector('#c-x')).not.toBeNull();
        expect(svg.querySelector('g').getAttribute('style')).toContain('url(#c-x)');
    });
});

describe("impression dans un onglet indépendant", () => {
    const options = {
        diagramWidth: 2000, diagramHeight: 600, speedUp: 50, speedDown: 45,
        bandwidthData: { ascending: { width: 12.34 }, descending: null },
        greenWaveName: 'Av. <Jaurès>'
    };

    beforeEach(() => { document.body.innerHTML = ''; });
    afterEach(() => { vi.restoreAllMocks(); });

    it("rien à imprimer sans diagramme affiché", () => {
        expect(buildGreenWavePrintDocument(options)).toBeNull();
        const ouvrir = vi.spyOn(window, 'open').mockReturnValue(null);
        printGreenWave(options);
        expect(ouvrir).not.toHaveBeenCalled();
    });

    it("produit un document autonome qui s'imprime puis se ferme", () => {
        makeSvg('<clipPath id="bars-clip"></clipPath><g clip-path="url(#bars-clip)"></g>');
        const html = buildGreenWavePrintDocument(options);
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.title).toBe('Onde verte - Av. <Jaurès>');
        expect(doc.querySelector('h1').textContent).toBe('Onde Verte - Av. <Jaurès>');
        expect(doc.querySelector('base').getAttribute('href')).toBe(document.baseURI);
        expect(doc.body.classList.contains('print-greenwave')).toBe(true);
        const svg = doc.querySelector('#gw-print-area svg');
        // Réduit à la largeur d'une page A4 paysage.
        expect(svg.getAttribute('width')).toBe('1048');
        expect(svg.querySelector('#bars-clip-print')).not.toBeNull();
        expect(doc.body.textContent).toContain('BP montante : 12.3s');
        const script = doc.querySelector('script').textContent;
        expect(script).toContain('window.print()');
        expect(script).toContain("'afterprint'");
    });

    it("l'export PDF propose un nom de fichier comme titre", () => {
        makeSvg('<rect />');
        const doc = new DOMParser().parseFromString(buildGreenWavePrintDocument({ ...options, pdf: true }), 'text/html');
        expect(doc.title).toMatch(/^Onde-verte_Av\.-Jaurès_\d{4}-\d{2}-\d{2}$/);
    });

    it("ouvre l'onglet sans lien avec TraCflux et sans toucher à la page", () => {
        makeSvg('<rect />');
        const ouvrir = vi.spyOn(window, 'open').mockReturnValue(null);
        URL.createObjectURL = vi.fn(() => 'blob:essai');
        URL.revokeObjectURL = vi.fn();
        const titre = document.title;

        printGreenWave(options);

        expect(ouvrir).toHaveBeenCalledWith('blob:essai', '_blank', 'noopener');
        expect(document.querySelector('#gw-print-area')).toBeNull();
        expect(document.body.classList.contains('print-greenwave')).toBe(false);
        expect(document.title).toBe(titre);
    });
});
