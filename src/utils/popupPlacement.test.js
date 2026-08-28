import { describe, it, expect } from 'vitest';
import { partRecouverte, placerSansEscamotage, PAS_CASCADE, RECOUVREMENT_MAX } from './popupPlacement';

// Zone utile d'un écran 1920 × 1080, barre des tâches déduite.
const ECRAN = { left: 0, top: 0, width: 1920, height: 1040 };

// Le cas qui a motivé ce code : les deux fenêtres du tableau d'actions,
// centrées sur un écran 1920 × 1080.
const CONDITIONS = { x: 350, y: 330, w: 1220, h: 420 };
const VARIABLES = { x: 705, y: 380, w: 510, h: 320 };

describe('partRecouverte', () => {
    it('vaut 0 pour deux rectangles disjoints', () => {
        expect(partRecouverte({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 100, h: 100 })).toBe(0);
    });

    it('vaut 0 quand les rectangles ne font que se toucher', () => {
        expect(partRecouverte({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 0, w: 100, h: 100 })).toBe(0);
    });

    it('vaut 1 quand le rectangle est entièrement contenu', () => {
        expect(partRecouverte({ x: 10, y: 10, w: 50, h: 50 }, { x: 0, y: 0, w: 200, h: 200 })).toBe(1);
    });

    it('mesure un recouvrement partiel', () => {
        // Moitié droite recouverte.
        expect(partRecouverte({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 0, w: 100, h: 100 })).toBeCloseTo(0.5, 5);
    });

    it('est asymétrique : elle rapporte à la taille du PREMIER rectangle', () => {
        const petit = { x: 10, y: 10, w: 50, h: 50 };
        const grand = { x: 0, y: 0, w: 200, h: 200 };
        expect(partRecouverte(petit, grand)).toBe(1);
        expect(partRecouverte(grand, petit)).toBeCloseTo(0.0625, 5);
    });

    it('tolère un rectangle dégénéré', () => {
        expect(partRecouverte({ x: 0, y: 0, w: 0, h: 100 }, { x: 0, y: 0, w: 100, h: 100 })).toBe(0);
        expect(partRecouverte(null, { x: 0, y: 0, w: 1, h: 1 })).toBe(0);
    });
});

describe('placerSansEscamotage', () => {
    it('ne bouge pas une fenêtre seule', () => {
        expect(placerSansEscamotage(VARIABLES, [], ECRAN)).toEqual({ x: VARIABLES.x, y: VARIABLES.y });
    });

    it('ne bouge pas une fenêtre qui ne chevauche personne', () => {
        const ailleurs = { x: 1600, y: 900, w: 200, h: 100 };
        expect(placerSansEscamotage(VARIABLES, [ailleurs], ECRAN)).toEqual({ x: VARIABLES.x, y: VARIABLES.y });
    });

    it('dégage les Variables micro de sous les Conditions micro', () => {
        // Le cas réel : Variables entièrement contenue dans Conditions.
        expect(partRecouverte(VARIABLES, CONDITIONS)).toBe(1);

        const place = placerSansEscamotage(VARIABLES, [CONDITIONS], ECRAN);
        expect(place).not.toEqual({ x: VARIABLES.x, y: VARIABLES.y });

        const apres = { ...place, w: VARIABLES.w, h: VARIABLES.h };
        expect(partRecouverte(apres, CONDITIONS)).toBeLessThanOrEqual(RECOUVREMENT_MAX);
    });

    it('laisse la fenêtre entièrement sur l\'écran après décalage', () => {
        const place = placerSansEscamotage(VARIABLES, [CONDITIONS], ECRAN);
        expect(place.x).toBeGreaterThanOrEqual(ECRAN.left);
        expect(place.y).toBeGreaterThanOrEqual(ECRAN.top);
        expect(place.x + VARIABLES.w).toBeLessThanOrEqual(ECRAN.left + ECRAN.width);
        expect(place.y + VARIABLES.h).toBeLessThanOrEqual(ECRAN.top + ECRAN.height);
    });

    it('décale par pas réguliers, en diagonale', () => {
        const place = placerSansEscamotage(VARIABLES, [CONDITIONS], ECRAN);
        const dx = place.x - VARIABLES.x;
        const dy = place.y - VARIABLES.y;
        expect(dx).toBe(dy);                 // cascade diagonale
        expect(dx % PAS_CASCADE).toBe(0);    // multiple du pas
    });

    it('évite plusieurs fenêtres à la fois', () => {
        const premier = placerSansEscamotage(VARIABLES, [CONDITIONS], ECRAN);
        const rectPremier = { ...premier, w: VARIABLES.w, h: VARIABLES.h };
        const second = placerSansEscamotage(VARIABLES, [CONDITIONS, rectPremier], ECRAN);
        const rectSecond = { ...second, w: VARIABLES.w, h: VARIABLES.h };
        expect(partRecouverte(rectSecond, CONDITIONS)).toBeLessThanOrEqual(RECOUVREMENT_MAX);
        expect(partRecouverte(rectSecond, rectPremier)).toBeLessThanOrEqual(RECOUVREMENT_MAX);
    });

    it('renonce plutôt que de pousser la fenêtre hors de l\'écran', () => {
        // Écran minuscule : aucun décalage ne tient, on garde la place initiale.
        const petitEcran = { left: 0, top: 0, width: 560, height: 360 };
        const rect = { x: 20, y: 20, w: 510, h: 320 };
        const dessus = { x: 0, y: 0, w: 560, h: 360 };
        const place = placerSansEscamotage(rect, [dessus], petitEcran);
        expect(place).toEqual({ x: 20, y: 20 });
    });

    it('ne boucle pas indéfiniment face à un recouvrement inévitable', () => {
        const partout = { x: -5000, y: -5000, w: 20000, h: 20000 };
        const place = placerSansEscamotage(VARIABLES, [partout], ECRAN);
        expect(Number.isFinite(place.x)).toBe(true);
        expect(Number.isFinite(place.y)).toBe(true);
    });

    it('tolère une liste d\'occupants vide ou incomplète', () => {
        expect(() => placerSansEscamotage(VARIABLES, [null, { x: 0, y: 0, w: 0, h: 0 }], ECRAN)).not.toThrow();
    });
});
