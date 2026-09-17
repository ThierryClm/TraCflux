import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useImportOperations from './useImportOperations';

/**
 * L'import de fichiers, et surtout ce qu'il fait quand il échoue.
 *
 * Les analyseurs eux-mêmes sont testés ailleurs — Excel, DiagFeux, HTM. Ce qui
 * ne l'était pas, c'est l'orchestration : quel analyseur est appelé selon le
 * fichier, et ce qu'il advient du projet ouvert quand l'import tourne mal.
 *
 * C'est le second point qui compte. Un import qui échoue doit laisser le projet
 * en place : remplacer à moitié un carrefour en cours d'étude par les débris
 * d'un fichier illisible serait pire que de refuser l'import.
 */

vi.mock('../utils/excelImporter', () => ({
    importExcelFile: vi.fn()
}));

const fichier = (nom) => ({ name: nom, size: 10 });

const proprietes = (sur = {}) => ({
    importFile: null,
    setImportFile: vi.fn(),
    setImportError: vi.fn(),
    setImportModal: vi.fn(),
    setImportHintDir: vi.fn(),
    htmFile: null,
    setHtmFile: vi.fn(),
    setHtmImportError: vi.fn(),
    importedHTMFiles: [],
    setImportedHTMFiles: vi.fn(),
    setImportHTMModal: vi.fn(),
    cycleLength: 60,
    loadFullState: vi.fn(),
    updateGroupParams: vi.fn(),
    setHasActiveProject: vi.fn(),
    lastImportDirectoryRef: { current: null },
    saveDirectoryHandle: vi.fn(),
    loadDirectoryHandle: vi.fn(),
    recentImportDirs: [],
    addRecentDirectory: vi.fn(),
    addToRecentFiles: vi.fn(),
    ...sur
});

const lancer = async (props) => {
    const { result } = renderHook(() => useImportOperations(props));
    await act(async () => { await result.current.handleImport(); });
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Import — refus explicites', () => {
    it('sans fichier choisi, le dit et ne charge rien', async () => {
        const props = proprietes();
        await lancer(props);
        expect(props.setImportError).toHaveBeenCalledWith('Veuillez sélectionner un fichier');
        expect(props.loadFullState).not.toHaveBeenCalled();
    });

    it('une extension inconnue est refusée, et nomme les formats acceptés', async () => {
        const props = proprietes({ importFile: fichier('plan.txt') });
        await lancer(props);
        const message = props.setImportError.mock.calls.at(-1)[0];
        expect(message).toMatch(/non support/i);
        expect(message).toMatch(/xlsx/);
        expect(props.loadFullState).not.toHaveBeenCalled();
    });
});

describe("Import — un échec ne doit pas emporter le projet ouvert", () => {
    it("un fichier Excel illisible laisse le projet en place", async () => {
        const { importExcelFile } = await import('../utils/excelImporter');
        importExcelFile.mockRejectedValueOnce(new Error('Feuille « Groupes » introuvable'));

        const props = proprietes({ importFile: fichier('carrefour.xlsx') });
        await lancer(props);

        // Le message remonte à l'utilisateur…
        expect(props.setImportError).toHaveBeenCalledWith('Feuille « Groupes » introuvable');
        // …et rien n'a été chargé à moitié.
        expect(props.loadFullState).not.toHaveBeenCalled();
        expect(props.setHasActiveProject).not.toHaveBeenCalled();
    });

    it('la fenêtre d\'import reste ouverte après un échec', async () => {
        const { importExcelFile } = await import('../utils/excelImporter');
        importExcelFile.mockRejectedValueOnce(new Error('illisible'));

        const props = proprietes({ importFile: fichier('carrefour.xls') });
        await lancer(props);

        // setImportModal(false) ne doit pas avoir été appelé : on laisse
        // l'utilisateur devant le message, et non devant un écran vide.
        expect(props.setImportModal).not.toHaveBeenCalledWith(false);
    });
});

describe('Import — un fichier Excel valide', () => {
    const donnees = {
        intersectionName: 'Carrefour importé',
        groups: [{ id: 1, name: 'G1' }, { id: 2, name: 'G2' }],
        cycleLength: 80,
        conflictMatrix: [[0, 5], [5, 0]],
        actionData: [],
        pfTabs: [],
        trafficDatasets: {},
        trafficData: {}
    };

    it('charge le carrefour et le déclare actif', async () => {
        const { importExcelFile } = await import('../utils/excelImporter');
        importExcelFile.mockResolvedValueOnce(donnees);

        const props = proprietes({ importFile: fichier('carrefour.xlsx') });
        await lancer(props);

        expect(props.loadFullState).toHaveBeenCalledTimes(1);
        const etat = props.loadFullState.mock.calls[0][0];
        expect(etat.intersectionName).toBe('Carrefour importé');
        expect(etat.cycleLength).toBe(80);
        expect(etat.groups).toHaveLength(2);
        expect(props.setHasActiveProject).toHaveBeenCalledWith(true);
    });

    it('referme la fenêtre et efface le message quand tout va bien', async () => {
        const { importExcelFile } = await import('../utils/excelImporter');
        importExcelFile.mockResolvedValueOnce(donnees);

        const props = proprietes({ importFile: fichier('carrefour.xlsx') });
        await lancer(props);

        expect(props.setImportModal).toHaveBeenCalledWith(false);
        expect(props.setImportError).toHaveBeenCalledWith('');
    });

    it('reporte le courant lu dans les données de trafic sur les groupes', async () => {
        const { importExcelFile } = await import('../utils/excelImporter');
        importExcelFile.mockResolvedValueOnce({
            ...donnees,
            trafficData: { 1: { courant: 'TàG' }, 2: {} }
        });

        const props = proprietes({ importFile: fichier('carrefour.xlsx') });
        await lancer(props);

        expect(props.updateGroupParams).toHaveBeenCalledWith(1, { courant: 'TàG' });
        expect(props.updateGroupParams).toHaveBeenCalledTimes(1);
    });
});
