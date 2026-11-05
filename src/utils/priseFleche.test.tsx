import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import avecPriseSurvol from './priseFleche';
import renderArrowSVG from './renderArrowSVG';

const prises = (courant: string, echelle = 1) => {
    const { container } = render(avecPriseSurvol(renderArrowSVG(courant, '#00ff00'), echelle));
    return [...container.querySelectorAll('.fleche-prise')];
};

describe('avecPriseSurvol', () => {
    it('double chaque trait de la flèche par une prise invisible', () => {
        const traits = prises('TD');
        expect(traits.map(trait => trait.tagName)).toEqual(['line', 'polyline']);
        traits.forEach(trait => expect(trait.getAttribute('stroke')).toBe('transparent'));
    });

    it('donne aux doublures des clés distinctes de celles du tracé', () => {
        const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
        prises('TD_G_D');
        expect(erreur).not.toHaveBeenCalled();
        erreur.mockRestore();
    });

    it('garde le tracé visible intact', () => {
        const { container } = render(avecPriseSurvol(renderArrowSVG('TD', '#00ff00'), 1));
        expect(container.querySelectorAll('[stroke="#00ff00"]')).toHaveLength(2);
    });

    it('double aussi les branches regroupées et le triangle PP', () => {
        expect(prises('TD_G_D')).toHaveLength(6);
        expect(prises('PP').map(trait => trait.tagName)).toEqual(['polygon']);
    });

    it('garde la même épaisseur à l\'écran quelle que soit l\'échelle', () => {
        const epaisseur = (echelle: number) => Number(prises('TD', echelle)[0].getAttribute('stroke-width'));
        expect(epaisseur(2)).toBeCloseTo(epaisseur(1) / 2);
    });
});
