import { describe, it, expect } from 'vitest';
import {
    computeLeftPadding, computeRightPadding, computeTickSpace, truncateName,
    MIN_PADDING_LEFT, MIN_PADDING_RIGHT, LABEL_GAP, AXIS_TITLE_SPACE, TICK_LABEL_OFFSET
} from './greenWaveLayout';

const measure = (text) => text.length * 10;

describe('computeLeftPadding', () => {
    it('garde la marge historique pour des libellés courts', () => {
        expect(computeLeftPadding(['Carrefour 1', 'G1 - Nord'], 30, measure)).toBe(MIN_PADDING_LEFT);
        expect(computeLeftPadding([], 0, measure)).toBe(MIN_PADDING_LEFT);
    });

    it('élargit la marge pour le plus long libellé et la colonne des chiffres', () => {
        const long = 'Car 26057_1 Alpes-Provence_Patriotes_De…';
        expect(computeLeftPadding(['G1 - A', long], 40, measure))
            .toBe(long.length * 10 + LABEL_GAP + 40 + AXIS_TITLE_SPACE);
    });
});

describe('computeTickSpace / computeRightPadding', () => {
    it('réserve la largeur du plus long chiffre de graduation', () => {
        expect(computeTickSpace([0, 100, -1400], measure)).toBe(TICK_LABEL_OFFSET + 50);
    });

    it('limite la marge droite au rappel des chiffres', () => {
        expect(computeRightPadding(42)).toBe(44);
        expect(computeRightPadding(0)).toBe(MIN_PADDING_RIGHT);
    });
});

describe('truncateName', () => {
    it('coupe au-delà de 40 caractères avec une ellipse', () => {
        expect(truncateName('a'.repeat(45))).toBe('a'.repeat(40) + '…');
        expect(truncateName('court')).toBe('court');
        expect(truncateName(undefined)).toBe('');
    });
});
