import { describe, it, expect } from 'vitest';
import { buildGreenWavePrintClone, renameCloneIds } from './greenWavePrint';

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
