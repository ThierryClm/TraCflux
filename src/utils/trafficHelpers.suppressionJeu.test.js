import { describe, it, expect } from 'vitest';
import { planSuppressionJeu } from './trafficHelpers';

const plans = [{ id: 1, name: 'PF1' }, { id: 2, name: 'PF2' }, { id: 3, name: 'PF3' }];
const jeux = { HPS: { 1: { trafficVol: 300 } }, Vide: { 1: { trafficVol: 0 } }, HC: { 1: { trafficVol: 100 } } };

describe('Supprimer un jeu de trafic — ce que cela implique', () => {
    it('nomme les plans qui l\'utilisent et le jeu qui le remplace, porteur de trafic', () => {
        const r = planSuppressionJeu('HC', ['Vide', 'HC', 'HPS', 'Projection'], plans, { 1: 'HC', 2: 'HPS' }, jeux, [1]);
        expect(r).toEqual({ plans: ['PF1'], remplacement: 'HPS' });
    });

    it('un plan sans jeu mémorisé utilise celui de son nom', () => {
        expect(planSuppressionJeu('PF3', ['PF3', 'HPS'], plans, {}, jeux, [1]).plans).toEqual(['PF3']);
    });

    it('sans autre jeu porteur de trafic, le premier autre de la liste', () => {
        expect(planSuppressionJeu('HPS', ['HPS', 'Vide'], plans, {}, jeux, [1]).remplacement).toBe('Vide');
    });

    it('refuse Projection, toujours proposé, et le dernier jeu de la liste', () => {
        expect(planSuppressionJeu('Projection', ['HPS', 'Projection'], plans, {}, jeux, [1]).refus).toMatch(/Projection/);
        expect(planSuppressionJeu('HPS', ['HPS'], plans, {}, jeux, [1]).refus).toMatch(/seul jeu/);
    });
});
