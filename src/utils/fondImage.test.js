import { describe, it, expect } from 'vitest';
import { luminanceMoyenne, fondEstClair, SEUIL_FOND_CLAIR } from './fondImage';

// Fabrique un tableau RGBA de `n` pixels identiques.
const pixels = (n, [r, v, b, a = 255]) => {
    const t = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i += 1) {
        t[i * 4] = r; t[i * 4 + 1] = v; t[i * 4 + 2] = b; t[i * 4 + 3] = a;
    }
    return t;
};

describe('luminanceMoyenne', () => {
    it('rend 255 pour du blanc et 0 pour du noir', () => {
        expect(luminanceMoyenne(pixels(16, [255, 255, 255]))).toBeCloseTo(255, 5);
        expect(luminanceMoyenne(pixels(16, [0, 0, 0]))).toBeCloseTo(0, 5);
    });

    it('pondère les canaux : le vert pèse plus que le bleu', () => {
        const vert = luminanceMoyenne(pixels(4, [0, 255, 0]));
        const bleu = luminanceMoyenne(pixels(4, [0, 0, 255]));
        expect(vert).toBeGreaterThan(bleu);
    });

    it('ignore les pixels transparents plutôt que de les compter en noir', () => {
        const moitie = new Uint8ClampedArray([
            ...[255, 255, 255, 255],
            ...[0, 0, 0, 0],
        ]);
        expect(luminanceMoyenne(moitie)).toBeCloseTo(255, 5);
    });

    it('traite une image entièrement transparente comme un fond clair', () => {
        expect(fondEstClair(luminanceMoyenne(pixels(8, [0, 0, 0, 0])))).toBe(true);
    });
});

describe('fondEstClair', () => {
    it('classe un plan au trait en fond clair et une vue aérienne en fond sombre', () => {
        // Valeurs représentatives : plan de bureau d'études ~240, photo ~120.
        expect(fondEstClair(240)).toBe(true);
        expect(fondEstClair(120)).toBe(false);
    });

    it('place le seuil entre les deux familles, sans les frôler', () => {
        expect(SEUIL_FOND_CLAIR).toBeGreaterThan(150);
        expect(SEUIL_FOND_CLAIR).toBeLessThan(220);
    });
});
