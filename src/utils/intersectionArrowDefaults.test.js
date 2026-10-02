import { describe, expect, it } from 'vitest';
import { getNewIntersectionArrowDefaults } from './intersectionArrowDefaults';

describe('getNewIntersectionArrowDefaults', () => {
    it.each(['TàD', 'TàG'])(
        'applique un retour de 0,4 aux nouvelles flèches %s',
        (courant) => {
            expect(getNewIntersectionArrowDefaults(courant)).toEqual({ turnLength: 0.4 });
        }
    );

    it.each(['TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG', 'TD_G_D'])(
        'applique un retour de 0,5 aux nouvelles flèches composées %s',
        (courant) => {
            expect(getNewIntersectionArrowDefaults(courant)).toEqual({ turnLength: 0.5 });
        }
    );

    it.each(['Piéton', 'Cycle'])(
        'applique une longueur de 2 aux nouvelles flèches %s',
        (courant) => {
            expect(getNewIntersectionArrowDefaults(courant)).toEqual({ length: 2 });
        }
    );

    it('ne force aucune dimension pour les autres courants', () => {
        expect(getNewIntersectionArrowDefaults('TD')).toEqual({});
        expect(getNewIntersectionArrowDefaults('')).toEqual({});
    });

});
