import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDialoguesApp from './useDialoguesApp';

describe('états des fenêtres de dialogue', () => {
    it('tout est fermé au démarrage ; les noms du rapport de diagnostic sont masqués par défaut', () => {
        const { result } = renderHook(() => useDialoguesApp());
        const r = result.current;
        for (const ferme of ['showUserManager', 'aboutModal', 'diagnosticModal', 'capacityCompareModal', 'showExportPfModal', 'showCopyMatrixModal', 'diagnosticIncludeProject']) {
            expect(r[ferme]).toBe(false);
        }
        for (const vide of ['helpAnchor', 'selectedProject', 'importFile', 'importPfData', 'selectedGreenWave', 'greenWaveData']) {
            expect(r[vide]).toBeNull();
        }
        expect(r.diagnosticMaskNames).toBe(true);
        expect(r.importError).toBe('');
        expect(r.diagnosticRefresh).toBe(0);
    });

    it('chaque état garde sa valeur d\'un rendu à l\'autre', () => {
        const { result } = renderHook(() => useDialoguesApp());
        act(() => { result.current.setAboutModal(true); result.current.setHelpAnchor('help-onde-verte'); });
        expect(result.current.aboutModal).toBe(true);
        expect(result.current.helpAnchor).toBe('help-onde-verte');
    });
});
