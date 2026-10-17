import { describe, it, expect } from 'vitest';
import { groupesSurlignesParAction } from './groupesAction';

const action = (champs) => ({ gf: '', plage1: '', plage2: '', actGf1: '', ...champs });

describe('groupes allumés au survol d\'une action', () => {
    it('le groupe de l\'action', () => {
        expect(groupesSurlignesParAction(action({ gf: '9' }))).toEqual([9]);
        expect(groupesSurlignesParAction(action({ gf: 'G10' }))).toEqual([10]);
    });

    it('le groupe et sa plage, dans les deux sens', () => {
        expect(groupesSurlignesParAction(action({ gf: '2', plage1: '1', plage2: '4' }))).toEqual([2, 1, 3, 4]);
        expect(groupesSurlignesParAction(action({ gf: '2', plage1: '7', plage2: '5' }))).toEqual([2, 5, 6, 7]);
        expect(groupesSurlignesParAction(action({ gf: '2', plage1: '6' }))).toEqual([2, 6]);
    });

    it('pas les groupes des colonnes « Action GF »', () => {
        expect(groupesSurlignesParAction(action({ gf: '1', actGf1: '2', actGf1Gf2: '3' }))).toEqual([1]);
    });

    it('rien sans action ni groupe', () => {
        expect(groupesSurlignesParAction(null)).toEqual([]);
        expect(groupesSurlignesParAction(action({}))).toEqual([]);
    });
});
