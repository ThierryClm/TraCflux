import { describe, it, expect } from 'vitest';
import { dansCadreTiers, adapterSelecteursDansCadreTiers, acceptDesTypes, ouvrirParSelecteurClassique } from './cadreTiers';

const fenetre = ({ cadre, tiers }) => {
    const natif = () => {};
    const f = { showOpenFilePicker: natif, showSaveFilePicker: natif, document };
    f.self = f;
    if (!cadre) f.top = f;
    else f.top = tiers
        ? { get location() { throw new DOMException('Blocked a frame', 'SecurityError'); } }
        : { location: { href: 'https://tracflux.com/' } };
    return { f, natif };
};

const optionsJson = { types: [{ description: 'Fichiers Projet', accept: { 'application/json': ['.json'] } }], multiple: false };

describe('cadre d\'un autre site', () => {
    it('page normale ou cadre de même origine : sélecteurs natifs gardés', () => {
        for (const cas of [{ cadre: false }, { cadre: true, tiers: false }]) {
            const { f, natif } = fenetre(cas);
            expect(dansCadreTiers(f)).toBe(false);
            expect(adapterSelecteursDansCadreTiers(f)).toBe(false);
            expect(f.showOpenFilePicker).toBe(natif);
        }
    });

    it('cadre d\'un autre site : Ouvrir par le sélecteur classique, Enregistrer masqué', () => {
        const { f, natif } = fenetre({ cadre: true, tiers: true });
        expect(dansCadreTiers(f)).toBe(true);
        expect(adapterSelecteursDansCadreTiers(f)).toBe(true);
        expect(typeof f.showOpenFilePicker).toBe('function');
        expect(f.showOpenFilePicker).not.toBe(natif);
        expect(f.showSaveFilePicker).toBeUndefined();
        expect('showDirectoryPicker' in f).toBe(false);
    });

    it('les types demandés deviennent l\'attribut accept', () => {
        expect(acceptDesTypes(optionsJson)).toBe('application/json,.json');
        expect(acceptDesTypes()).toBe('');
    });

    it('le fichier choisi revient sous la forme d\'un handle lisible', async () => {
        const promesse = ouvrirParSelecteurClassique(optionsJson);
        const champ = document.body.querySelector('input[type=file]');
        expect(champ.accept).toBe('application/json,.json');
        const fichier = new File(['{"a":1}'], 'Carrefour.json', { type: 'application/json' });
        Object.defineProperty(champ, 'files', { value: [fichier] });
        champ.dispatchEvent(new Event('change'));
        const [handle] = await promesse;
        expect(handle.name).toBe('Carrefour.json');
        expect(await (await handle.getFile()).text()).toBe('{"a":1}');
        expect(document.body.querySelector('input[type=file]')).toBeNull();
    });

    it('annuler la sélection rejette en AbortError, comme l\'API', async () => {
        const promesse = ouvrirParSelecteurClassique(optionsJson);
        document.body.querySelector('input[type=file]').dispatchEvent(new Event('cancel'));
        await expect(promesse).rejects.toMatchObject({ name: 'AbortError' });
    });
});
