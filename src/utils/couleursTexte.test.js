import { describe, expect, it } from 'vitest';
import { texteBrut, vertFluo, VERT_TEXTE } from './couleursTexte';

describe('couleurs des commentaires et remarques', () => {
    it('l’ancien vert passe au vert fluo à l’affichage, sous ses deux écritures', () => {
        expect(vertFluo('<span style="color: #4CAF50">a</span><span style="color: rgb(76, 175, 80);">b</span>'))
            .toBe(`<span style="color: ${VERT_TEXTE}">a</span><span style="color: ${VERT_TEXTE};">b</span>`);
        expect(vertFluo('<span style="color: rgb(244, 67, 54)">rouge</span>')).toContain('rgb(244, 67, 54)');
        expect(vertFluo(undefined)).toBe('');
    });
    it('texte brut : ni balises ni style, entités décodées', () => {
        expect(texteBrut('<span style="color: #4CAF50">Prolongé uniquement par Renoir</span>')).toBe('Prolongé uniquement par Renoir');
        expect(texteBrut('a&nbsp;&amp;&nbsp;b')).toBe('a & b');
        expect(texteBrut('<span></span>')).toBe('');
    });
});
