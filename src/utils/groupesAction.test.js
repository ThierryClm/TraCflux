import { describe, it, expect } from 'vitest';
import { groupesSurlignesParAction } from './groupesAction';

const action = (champs) => ({ action: 'Fermeture anticipée', gf: '', plage1: '', plage2: '', deb: '', fin: '', actGf1: '', ...champs });
const groupe = (id, offset, green) => ({ id, offset, durations: { green, orange: 3, red: 0 } });

// Plan ACTUEL du carrefour exemple, cycle 80 s : début et durée de vert.
const actuel = [
    groupe(1, 37, 39), groupe(2, 1, 14), groupe(3, 1, 14), groupe(4, 0, 28),
    groupe(5, 22, 10), groupe(6, 22, 10), groupe(7, 5, 28), groupe(8, 79, 16)
];

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

    it('adaptatif vertical : seuls les groupes de la plage dont le vert tombe dans la zone', () => {
        // ACTUEL, GF2 adaptatif 11-15 s, plage GF1 à GF7 : GF1 (37-76) et GF5, GF6 (22-32) sont hors zone.
        const av = action({ action: 'Adaptatif vertical', gf: '2', plage1: '1', plage2: '7', deb: '11', fin: '15' });
        expect(groupesSurlignesParAction(av, actuel, 80)).toEqual([2, 3, 4, 7]);
    });

    it('zone sans plage : tous les groupes, vert qui passe la fin du cycle compris', () => {
        // Escamotage de phase 0-1 s : GF4 (0-28) et GF8 (79 → 15, passe la fin
        // du cycle) ; GF2 et GF3 ne commencent qu'à 1 s.
        const ep = action({ action: 'Escamotage de phase', gf: '0', deb: '0', fin: '1' });
        expect(groupesSurlignesParAction(ep, actuel, 80)).toEqual([4, 8]);
        // Zone qui passe elle-même la fin du cycle : 79 → 1.
        expect(groupesSurlignesParAction({ ...ep, deb: '79', fin: '1' }, actuel, 80)).toEqual([4, 8]);
    });

    it('le groupe de l\'action hors zone ne s\'allume pas', () => {
        const av = action({ action: 'Adaptatif vertical', gf: '1', plage1: '1', plage2: '3', deb: '11', fin: '15' });
        expect(groupesSurlignesParAction(av, actuel, 80)).toEqual([2, 3]);
    });

    it('rien sans action ni groupe', () => {
        expect(groupesSurlignesParAction(null)).toEqual([]);
        expect(groupesSurlignesParAction(action({}))).toEqual([]);
    });
});
