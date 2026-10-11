import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copieAvecAncetres, documentImpression, echapperHtml, ouvrirOngletImpression } from './ongletImpression';

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { vi.restoreAllMocks(); });

describe('copieAvecAncetres', () => {
    it('garde la chaîne des ancêtres, sans leurs autres enfants', () => {
        document.body.innerHTML = `
            <div id="root" class="app">
                <header>Menu</header>
                <div class="modal-overlay print-preview-overlay"><p>Dossier</p></div>
            </div>`;
        const doc = new DOMParser().parseFromString(
            copieAvecAncetres(document.querySelector('.print-preview-overlay')), 'text/html');
        expect(doc.querySelector('#root.app > .print-preview-overlay p').textContent).toBe('Dossier');
        expect(doc.querySelector('header')).toBeNull();
    });

    it('fige les valeurs saisies dans les champs', () => {
        document.body.innerHTML = `<div class="a">
            <input value="init"><input type="checkbox"><textarea></textarea>
            <select><option>A</option><option>B</option></select></div>`;
        const racine = document.querySelector('.a');
        racine.querySelector('input').value = 'saisi';
        racine.querySelector('input[type=checkbox]').checked = true;
        racine.querySelector('textarea').value = 'note';
        racine.querySelector('select').selectedIndex = 1;

        const doc = new DOMParser().parseFromString(copieAvecAncetres(racine), 'text/html');
        expect(doc.querySelector('input').getAttribute('value')).toBe('saisi');
        expect(doc.querySelector('input[type=checkbox]').hasAttribute('checked')).toBe(true);
        expect(doc.querySelector('textarea').textContent).toBe('note');
        expect(doc.querySelectorAll('option')[1].hasAttribute('selected')).toBe(true);
    });

    it('ne modifie pas la page', () => {
        document.body.innerHTML = '<div id="root"><div class="x"></div></div>';
        copieAvecAncetres(document.querySelector('.x'));
        expect(document.body.innerHTML).toBe('<div id="root"><div class="x"></div></div>');
    });
});

describe('documentImpression', () => {
    it('assemble un document qui s’imprime puis se ferme', () => {
        const style = document.createElement('style');
        style.textContent = '@media print { .y { color: red; } }';
        document.head.appendChild(style);

        const html = documentImpression('<div class="y">Contenu</div>', {
            titre: 'Carrefour <A>', classesBody: 'light-mode print-dossier print-portrait'
        });
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(doc.title).toBe('Carrefour <A>');
        expect(doc.querySelector('base').getAttribute('href')).toBe(document.baseURI);
        expect([...doc.body.classList]).toEqual(['light-mode', 'print-dossier', 'print-portrait']);
        expect(doc.head.textContent).toContain('.y');
        expect(doc.querySelector('.y').textContent).toBe('Contenu');
        expect(doc.querySelector('script').textContent).toContain('window.print()');
        style.remove();
    });

    it('échappe les caractères spéciaux', () => {
        expect(echapperHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    });
});

describe('ouvrirOngletImpression', () => {
    it('ouvre le document sans lien avec TraCflux', () => {
        const ouvrir = vi.spyOn(window, 'open').mockReturnValue(null);
        URL.createObjectURL = vi.fn(() => 'blob:essai');
        URL.revokeObjectURL = vi.fn();
        ouvrirOngletImpression('<p>x</p>');
        expect(ouvrir).toHaveBeenCalledWith('blob:essai', '_blank', 'noopener');
    });
});
