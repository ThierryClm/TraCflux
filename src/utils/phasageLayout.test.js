import { describe, it, expect } from 'vitest';
import {
    getEllipseConfig,
    getScaleFactor,
    computeBubbleBox,
    getPhaseCenter,
    computeCompositionBox,
    fitEllipseScaleX,
    maxEllipseScaleX,
    fitArrowOffset,
    fitTangentEllipse,
    getEllipseConfig as configEllipse,
    ARROW_OUTER_OFFSET,
    MIN_ARROW_OFFSET
} from './phasageLayout';

describe('computeBubbleBox', () => {
    it('applique le correctif de nombre de phases et le réglage utilisateur', () => {
        const ref = computeBubbleBox({ count: 4, bubbleScale: 100 });
        expect(ref.bubbleWidth).toBe(570);
        expect(ref.bubbleHeight).toBe(456);
        const grand = computeBubbleBox({ count: 4, bubbleScale: 150 });
        expect(grand.bubbleHeight).toBe(Math.round(456 * 1.5));
        const six = computeBubbleBox({ count: 6, bubbleScale: 100 });
        expect(six.bubbleHeight).toBe(Math.round(456 * getScaleFactor(6)));
    });

    it('étire le masque selon le rapport H/L, à surface d\'image constante', () => {
        const large = computeBubbleBox({ count: 4, ratio: 50 });
        const haut = computeBubbleBox({ count: 4, ratio: 150 });
        expect(large.clipWidth).toBeGreaterThan(large.clipHeight);
        expect(haut.clipHeight).toBeGreaterThan(computeBubbleBox({ count: 4 }).clipHeight);
        // L'image à l'intérieur ne bouge pas
        expect(large.bubbleWidth).toBe(haut.bubbleWidth);
    });
});

describe('getPhaseCenter', () => {
    it('place toujours la phase 1 à gauche', () => {
        for (const n of [2, 3, 4, 5, 6]) {
            const p1 = getPhaseCenter(0, n);
            expect(p1.x).toBeLessThan(0.5);
            expect(p1.y).toBeCloseTo(0.5, 6);
        }
    });

    it('resserre le placement quand l\'ellipse est réduite', () => {
        const plein = getPhaseCenter(0, 4, 100);
        const reduit = getPhaseCenter(0, 4, 50);
        expect(reduit.x).toBeGreaterThan(plein.x); // plus proche du centre
    });
});

describe('computeCompositionBox', () => {
    const base = { count: 4, containerWidth: 1600, containerHeight: 1000 };

    it('englobe les bulles, ellipse ET débordement compris', () => {
        const { radiusY } = getEllipseConfig(4);
        const { clipHeight } = computeBubbleBox({ count: 4 });
        const box = computeCompositionBox(base);
        // Haut = centre de la bulle haute moins sa demi-hauteur
        const centreHaut = (0.5 - radiusY / 100) * 1000;
        expect(box.top).toBeCloseTo(centreHaut - clipHeight / 2, 6);
        expect(box.height).toBeCloseTo(2 * (radiusY / 100) * 1000 + clipHeight, 6);
    });

    it('grandit avec la taille des bulles', () => {
        const petit = computeCompositionBox({ ...base, bubbleScale: 80 });
        const grand = computeCompositionBox({ ...base, bubbleScale: 130 });
        expect(grand.height).toBeGreaterThan(petit.height);
        expect(grand.width).toBeGreaterThan(petit.width);
    });

    it('reste centré verticalement, y compris en nombre impair de phases', () => {
        for (const n of [2, 3, 4, 5, 6]) {
            const box = computeCompositionBox({ ...base, count: n });
            expect(box.centerY).toBeCloseTo(500, 6);
        }
    });

    it('n\'est pas centré horizontalement en nombre impair : le centre suit la composition', () => {
        const box = computeCompositionBox({ ...base, count: 3 });
        expect(box.centerX).not.toBeCloseTo(800, 1);
    });
});

describe('fitEllipseScaleX', () => {
    const base = { count: 4, containerWidth: 1600, containerHeight: 1000 };

    it('donne à la composition les proportions demandées, tant que le plafond le permet', () => {
        const naturel = computeCompositionBox(base);
        const cible = (naturel.width / naturel.height) * 1.05; // légèrement plus large
        const fx = fitEllipseScaleX({ ...base, targetAspect: cible });
        expect(fx).toBeLessThan(maxEllipseScaleX(base.count));
        const box = computeCompositionBox({ ...base, ellipseScaleX: fx });
        expect(box.width / box.height).toBeCloseTo(cible, 2);
    });

    it('ne dépasse jamais le plafond de tracé', () => {
        const fx = fitEllipseScaleX({ ...base, targetAspect: 1047 / 668 });
        expect(fx).toBeLessThanOrEqual(maxEllipseScaleX(base.count));
    });

    it('écarte les bulles, ne les rapproche jamais', () => {
        // Cible plus étroite que la composition : le réglage utilisateur tient.
        const fx = fitEllipseScaleX({ ...base, ellipseScale: 100, targetAspect: 0.5 });
        expect(fx).toBe(100);
    });

    it('reste borné même sur une cible extrême', () => {
        for (const n of [2, 3, 4, 5, 6]) {
            const fx = fitEllipseScaleX({ ...base, count: n, targetAspect: 50 });
            expect(fx).toBeLessThanOrEqual(maxEllipseScaleX(n));
        }
    });
});

describe('fitArrowOffset', () => {
    const page = { pageWidth: 1600, pageHeight: 1021 };
    const base = { count: 4, containerWidth: 1600, containerHeight: 1021, center: { x: 800, y: 510.5 } };

    it("écarte l'ovale assez pour contourner les bulles", () => {
        const { clipHeight } = computeBubbleBox({ count: 4 });
        const off = fitArrowOffset({ ...base, ...page });
        const demiY = (clipHeight / 2) / base.containerHeight * 100;
        expect(off).toBeGreaterThanOrEqual(demiY);
    });

    it('suit la taille des bulles, sans plancher fixe', () => {
        // Un plancher en % du conteneur ne suit pas les bulles : en dessous d'une
        // certaine taille, l'ovale cessait de rétrécir avec elles.
        const petit = fitArrowOffset({ ...base, ...page, bubbleScale: 50 });
        const grand = fitArrowOffset({ ...base, ...page, bubbleScale: 100 });
        expect(grand / petit).toBeCloseTo(2, 1);
    });

    it('grandit avec la taille des bulles', () => {
        const petit = fitArrowOffset({ ...base, ...page, bubbleScale: 80 });
        const grand = fitArrowOffset({ ...base, ...page, bubbleScale: 140 });
        expect(grand).toBeGreaterThan(petit);
    });

    it('reste au-dessus du minimum absolu', () => {
        const off = fitArrowOffset({ ...base, pageWidth: 100, pageHeight: 100 });
        expect(off).toBeGreaterThanOrEqual(MIN_ARROW_OFFSET);
    });
});

describe('fitTangentEllipse', () => {
    const base = { count: 4, containerWidth: 1600, containerHeight: 1021 };

    // Écart entre deux bulles voisines, dans le repère normalisé où chaque
    // bulle devient un cercle unité : 1 = tangentes, > 1 = un jour entre elles.
    const ecartNormalise = ({ count, containerWidth, containerHeight, ...opts }) => {
        const { ellipseScale, ellipseScaleX } = fitTangentEllipse({ count, containerWidth, containerHeight, ...opts });
        const { clipWidth, clipHeight } = computeBubbleBox({ count, ...opts });
        const a = clipWidth / 2, b = clipHeight / 2;
        const p0 = getPhaseCenter(0, count, ellipseScale, ellipseScaleX);
        const p1 = getPhaseCenter(1, count, ellipseScale, ellipseScaleX);
        const dx = (p1.x - p0.x) * containerWidth / a;
        const dy = (p1.y - p0.y) * containerHeight / b;
        return Math.hypot(dx, dy) / 2;
    };

    it('rend les bulles voisines tangentes, quel que soit leur nombre', () => {
        for (const n of [2, 3, 4, 5, 6]) {
            expect(ecartNormalise({ ...base, count: n })).toBeCloseTo(1, 6);
        }
    });

    it('donne le même écart sur un conteneur large ou étroit', () => {
        const large = ecartNormalise({ ...base, containerWidth: 2400 });
        const etroit = ecartNormalise({ ...base, containerWidth: 1100 });
        expect(large).toBeCloseTo(etroit, 6);
    });

    it('le jeu écarte les bulles sans changer leur régularité', () => {
        expect(ecartNormalise({ ...base, jeu: 1.05 })).toBeCloseTo(1.05, 6);
    });

    it('le réglage utilisateur de l\'ellipse reste un multiplicateur', () => {
        expect(ecartNormalise({ ...base, ellipseScale: 120 })).toBeCloseTo(1.2, 6);
    });
});
