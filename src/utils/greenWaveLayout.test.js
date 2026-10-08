import { describe, it, expect } from 'vitest';
import { computeLeftPadding, truncateName, MIN_PADDING_LEFT, LABEL_GAP, AXIS_TITLE_SPACE } from './greenWaveLayout';

const measure = (text) => text.length * 10;

describe('computeLeftPadding', () => {
    it('garde la marge historique pour des libellés courts', () => {
        expect(computeLeftPadding(['Carrefour 1', 'G1 - Nord'], measure)).toBe(MIN_PADDING_LEFT);
        expect(computeLeftPadding([], measure)).toBe(MIN_PADDING_LEFT);
    });

    it('élargit la marge pour afficher entièrement le plus long libellé', () => {
        const long = 'Car 26057_1 Alpes-Provence_Patriotes_De…';
        expect(computeLeftPadding(['G1 - A', long], measure))
            .toBe(long.length * 10 + LABEL_GAP + AXIS_TITLE_SPACE);
    });
});

describe('truncateName', () => {
    it('coupe au-delà de 40 caractères avec une ellipse', () => {
        expect(truncateName('a'.repeat(45))).toBe('a'.repeat(40) + '…');
        expect(truncateName('court')).toBe('court');
        expect(truncateName(undefined)).toBe('');
    });
});
