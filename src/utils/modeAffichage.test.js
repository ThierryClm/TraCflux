import { describe, it, expect } from 'vitest';
import { estAffiche, lireModeAffichage, planACommentaires, texteRenseigne } from './modeAffichage';

describe('modeAffichage', () => {
    it('Automatique : affiché seulement si le plan en contient', () => {
        expect(estAffiche('auto', true)).toBe(true);
        expect(estAffiche('auto', false)).toBe(false);
        expect(estAffiche('afficher', false)).toBe(true);
        expect(estAffiche('masquer', true)).toBe(false);
    });

    it('un commentaire fait d’espaces ne compte pas', () => {
        expect(planACommentaires([{ comment: '  ' }, {}])).toBe(false);
        expect(planACommentaires([{ comment: '' }, { comment: 'G2 prioritaire' }])).toBe(true);
        expect(texteRenseigne('\n ')).toBe(false);
        expect(texteRenseigne(undefined)).toBe(false);
    });

    it('lit le mode, sinon l’ancien booléen, sinon rien', () => {
        expect(lireModeAffichage({ remarksMode: 'auto', showRemarks: false }, 'remarks')).toBe('auto');
        expect(lireModeAffichage({ showRemarks: false }, 'remarks')).toBe('masquer');
        expect(lireModeAffichage({}, 'comments')).toBeUndefined();
        expect(lireModeAffichage(undefined, 'comments')).toBeUndefined();
    });
});
