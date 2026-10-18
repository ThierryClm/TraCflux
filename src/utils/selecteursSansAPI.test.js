import { describe, it, expect, vi, afterEach } from 'vitest';
import { adapterSelecteursSansAPI, enregistrerParTelechargement } from './selecteursSansAPI';
import { writeTextToFileHandle } from './writeFileHandle';

const optionsJson = { suggestedName: 'Carrefour.json', types: [{ description: 'Fichier Projet JSON', accept: { 'application/json': ['.json'] } }] };

const { createObjectURL, revokeObjectURL } = URL;
afterEach(() => { vi.restoreAllMocks(); URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL; });

describe('navigateur sans fenêtres Ouvrir / Enregistrer', () => {
    it('Chrome, Edge : fenêtres natives gardées', () => {
        const natif = () => {};
        const f = { showOpenFilePicker: natif, showSaveFilePicker: natif, document };
        expect(adapterSelecteursSansAPI(f)).toEqual([]);
        expect(f.showOpenFilePicker).toBe(natif);
        expect(f.showSaveFilePicker).toBe(natif);
    });

    it('Firefox, Safari : les deux fenêtres sont remplacées', () => {
        const f = { document };
        expect(adapterSelecteursSansAPI(f)).toEqual(['showOpenFilePicker', 'showSaveFilePicker']);
        expect(typeof f.showOpenFilePicker).toBe('function');
        expect(typeof f.showSaveFilePicker).toBe('function');
    });

    it('cadre tiers : Enregistrer, masqué par cadreTiers, passe au téléchargement', () => {
        const ouvrir = () => {};
        const f = { showOpenFilePicker: ouvrir, showSaveFilePicker: undefined, document };
        expect(adapterSelecteursSansAPI(f)).toEqual(['showSaveFilePicker']);
        expect(f.showOpenFilePicker).toBe(ouvrir);
    });

    it('Ouvrir passe par le sélecteur de fichier classique', () => {
        const f = { document };
        adapterSelecteursSansAPI(f);
        const promesse = f.showOpenFilePicker({ types: optionsJson.types });
        const champ = document.body.querySelector('input[type=file]');
        expect(champ.accept).toBe('application/json,.json');
        champ.dispatchEvent(new Event('cancel'));
        return expect(promesse).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('Enregistrer télécharge le contenu écrit, sous le nom proposé', async () => {
        const creer = vi.fn(() => 'blob:essai');
        URL.createObjectURL = creer;
        URL.revokeObjectURL = vi.fn();
        const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            expect(this.download).toBe('Carrefour.json');
            expect(this.getAttribute('href')).toBe('blob:essai');
        });
        const handle = await enregistrerParTelechargement(optionsJson);
        expect(handle.name).toBe('Carrefour.json');
        await writeTextToFileHandle(handle, '{"a":1}');
        expect(clic).toHaveBeenCalledTimes(1);
        const blob = creer.mock.calls[0][0];
        expect(blob.type).toBe('application/json');
        expect(await blob.text()).toBe('{"a":1}');
        // Relu par la vérification « fichier non vide » des appelants.
        expect(await (await handle.getFile()).text()).toBe('{"a":1}');
        expect(document.body.querySelector('a')).toBeNull();
    });
});
