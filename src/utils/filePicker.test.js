import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isFilePickerActive, safeShowOpenFilePicker, safeShowSaveFilePicker } from './filePicker';

beforeEach(() => {
    vi.restoreAllMocks();
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
});

describe('filePicker', () => {
    it('transmet les options et rend le résultat du sélecteur d’ouverture', async () => {
        const handles = [{ name: 'projet.json' }];
        window.showOpenFilePicker = vi.fn().mockResolvedValue(handles);
        const options = { multiple: false };
        await expect(safeShowOpenFilePicker(options)).resolves.toBe(handles);
        expect(window.showOpenFilePicker).toHaveBeenCalledWith(options);
        expect(isFilePickerActive()).toBe(false);
    });

    it('transmet les options au sélecteur de sauvegarde', async () => {
        const handle = { name: 'projet.json' };
        window.showSaveFilePicker = vi.fn().mockResolvedValue(handle);
        await expect(safeShowSaveFilePicker({ suggestedName: 'projet.json' })).resolves.toBe(handle);
        expect(isFilePickerActive()).toBe(false);
    });

    it('reste verrouillé pendant une sélection et refuse un second dialogue', async () => {
        let finish;
        window.showOpenFilePicker = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        window.showSaveFilePicker = vi.fn();
        const pending = safeShowOpenFilePicker({});
        expect(isFilePickerActive()).toBe(true);
        await expect(safeShowSaveFilePicker({})).rejects.toMatchObject({ name: 'AbortError' });
        expect(window.showSaveFilePicker).not.toHaveBeenCalled();
        finish([]);
        await pending;
        expect(isFilePickerActive()).toBe(false);
    });

    it('libère le verrou après une annulation native', async () => {
        const error = new DOMException('Annulé', 'AbortError');
        window.showOpenFilePicker = vi.fn().mockRejectedValue(error);
        await expect(safeShowOpenFilePicker({})).rejects.toBe(error);
        expect(isFilePickerActive()).toBe(false);
    });
});
