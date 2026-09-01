import { describe, it, expect } from 'vitest';
import { BOX_W, BOX_H, CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM, fitImageBox, fitContentBox, cropFromBoxToImage } from './floatingImageBox';

describe('fitImageBox', () => {
    it('remplit la boîte quand l\'image est exactement au format de référence', () => {
        expect(fitImageBox({ width: BOX_W, height: BOX_H }))
            .toEqual({ dispW: BOX_W, dispH: BOX_H, padX: 0, padY: 0 });
    });

    it('ne laisse de bandes que sur un seul axe pour une image plus large', () => {
        const { dispW, dispH, padX, padY } = fitImageBox({ width: 1600, height: 900 });
        expect(dispW).toBe(BOX_W);          // limité par la largeur
        expect(dispH).toBeLessThan(BOX_H);  // bandes haut/bas
        expect(padX).toBe(0);
        expect(padY).toBeGreaterThan(0);
    });

    it('ne laisse de bandes que sur un seul axe pour une image plus haute', () => {
        const { dispW, dispH, padX, padY } = fitImageBox({ width: 900, height: 1600 });
        expect(dispH).toBe(BOX_H);          // limité par la hauteur
        expect(dispW).toBeLessThan(BOX_W);  // bandes gauche/droite
        expect(padY).toBe(0);
        expect(padX).toBeGreaterThan(0);
    });

    it('conserve le rapport de forme de l\'image', () => {
        const { dispW, dispH } = fitImageBox({ width: 1200, height: 800 });
        expect(dispW / dispH).toBeCloseTo(1200 / 800, 2);
    });

    it('centre le cadre utile dans la boîte de référence', () => {
        const { dispW, dispH, padX, padY } = fitImageBox({ width: 1600, height: 400 });
        expect(2 * padX + dispW).toBe(BOX_W);
        expect(2 * padY + dispH).toBe(BOX_H);
    });

    it('n\'agrandit pas une image plus petite que la boîte', () => {
        const { dispW, dispH } = fitImageBox({ width: 300, height: 200 });
        expect(dispW).toBeLessThanOrEqual(BOX_W);
        expect(dispH).toBeLessThanOrEqual(BOX_H);
        expect(dispW / dispH).toBeCloseTo(1.5, 2);
    });

    it('retombe sur la boîte pleine tant que les dimensions natives sont inconnues', () => {
        // L'image se décode en asynchrone : la fenêtre peut s'ouvrir avant que
        // ses dimensions soient connues (état initial { width: 1, height: 1 }).
        const attendu = { dispW: BOX_W, dispH: BOX_H, padX: 0, padY: 0 };
        expect(fitImageBox({ width: 1, height: 1 })).toEqual(attendu);
        expect(fitImageBox(null)).toEqual(attendu);
        expect(fitImageBox(undefined)).toEqual(attendu);
    });

    it('ne renvoie jamais de dimension nulle ou négative', () => {
        const { dispW, dispH } = fitImageBox({ width: 10000, height: 1 });
        expect(dispW).toBeGreaterThan(0);
        expect(dispH).toBeGreaterThan(0);
    });
});

describe('cadrage par défaut', () => {
    it('démarre sans rognage ni zoom', () => {
        expect(DEFAULT_CROP).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
        expect(DEFAULT_ZOOM).toBe(1);
    });
});

describe('cropFromBoxToImage', () => {
    // Image portrait dans une boîte 750×530 : bandes gauche/droite uniquement.
    const portrait = { width: 900, height: 1600 };

    it('annule un rognage qui ne faisait que masquer les bandes vides', () => {
        const { padX } = fitImageBox(portrait);
        const converti = cropFromBoxToImage(
            { top: 0, bottom: 0, left: padX, right: padX },
            portrait
        );
        expect(converti).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it('ne retient que la part qui mordait réellement dans l\'image', () => {
        const { padX } = fitImageBox(portrait);
        const converti = cropFromBoxToImage(
            { top: 0, bottom: 0, left: padX + 30, right: padX - 20 },
            portrait
        );
        expect(converti.left).toBe(30);
        expect(converti.right).toBe(0); // en deçà de la bande : rien de rogné
    });

    it('laisse intact un rognage sur un axe sans bande', () => {
        // Portrait : padY vaut 0, le rognage haut/bas portait déjà sur l'image.
        const converti = cropFromBoxToImage(
            { top: 40, bottom: 25, left: 0, right: 0 },
            portrait
        );
        expect(converti.top).toBe(40);
        expect(converti.bottom).toBe(25);
    });

    it('ne produit jamais de valeur négative', () => {
        const converti = cropFromBoxToImage(
            { top: 0, bottom: 0, left: 0, right: 0 },
            { width: 1600, height: 400 }
        );
        expect(Object.values(converti).every(v => v >= 0)).toBe(true);
    });

    it('tolère un rognage absent', () => {
        expect(cropFromBoxToImage(undefined, portrait))
            .toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it('déclare le référentiel courant', () => {
        expect(CROP_BASIS).toBe('image');
    });
});

describe('fitContentBox', () => {
    // Image très large : le cadre s'arrête à l'image, avec plus de cent pixels
    // de bande vide en haut et en bas de la boîte de référence.
    const large = { width: 2400, height: 1000 };

    it('sans flèche, se réduit au cadre de l\'image', () => {
        const { dispW, dispH, padX, padY } = fitImageBox(large);
        expect(fitContentBox(large, [])).toEqual({ x: padX, y: padY, w: dispW, h: dispH });
    });

    it('englobe une flèche qui déborde sous le bord bas de l\'image', () => {
        const { dispH, padY } = fitImageBox(large);
        // Flèche posée juste au-dessus du bord bas : son symbole le dépasse.
        const yBas = ((padY + dispH - 5) / BOX_H) * 100;
        const cadre = fitContentBox(large, [{ x: 50, y: yBas }]);
        expect(cadre.y + cadre.h).toBeGreaterThan(padY + dispH);
    });

    it('ne dépasse jamais la boîte de référence', () => {
        const cadre = fitContentBox(large, [{ x: 0, y: 0 }, { x: 100, y: 100, scale: 3 }]);
        expect(cadre.x).toBeGreaterThanOrEqual(0);
        expect(cadre.y).toBeGreaterThanOrEqual(0);
        expect(cadre.x + cadre.w).toBeLessThanOrEqual(BOX_W);
        expect(cadre.y + cadre.h).toBeLessThanOrEqual(BOX_H);
    });

    it('tient compte de l\'échelle et de l\'allongement du symbole', () => {
        const { dispH, padY } = fitImageBox(large);
        const y = ((padY + dispH - 5) / BOX_H) * 100;
        const petit = fitContentBox(large, [{ x: 50, y }]);
        const grand = fitContentBox(large, [{ x: 50, y, scale: 2, length: 2 }]);
        expect(grand.h).toBeGreaterThan(petit.h);
    });

    it('ignore une flèche aux coordonnées absentes', () => {
        expect(fitContentBox(large, [{ x: undefined, y: null }, null]))
            .toEqual(fitContentBox(large, []));
    });
});
