import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useFileOperations from './useFileOperations';

/**
 * Ce que le fichier projet contient réellement.
 *
 * C'est le chemin le plus lourd de conséquence du dépôt : une défaillance ici
 * ne dégrade pas l'affichage, elle perd le travail de quelqu'un. Il n'avait
 * aucun test.
 *
 * L'assertion centrale est celle de la SYMÉTRIE : le fichier ne doit rien
 * porter que `getFullState` — donc le cache localStorage — ne porte pas. Tant
 * qu'elle tient, les deux enregistrements disent la même chose ; c'est leur
 * divergence qui a produit, une par une, les pertes de septembre 2026.
 *
 * Elle protège aussi le ménage qui reste à faire : `useFileOperations` ajoute
 * encore à la main six clés que `getFullState` fournit désormais. Le jour où
 * ce bloc redondant sera supprimé, ce test dira si le fichier est resté
 * identique.
 */

// L'état canonique, tel que le hook central le produit.
const etatComplet = () => ({
    projectName: 'Essai',
    intersectionName: 'Carrefour témoin',
    groups: [{ id: 1, name: 'G1', type: 'VL', durations: { green: 20, orange: 3, red: 37 } }],
    cycleLength: 60,
    conflictMatrix: [[0]],
    pfTabs: [{ id: 1, name: 'PF1' }],
    activePFId: 1,
    dossierSections: { image: true },
    diagramHeight: 640,
    floatingCrop: { top: 4, bottom: 8, left: 2, right: 6 },
    floatingCropBasis: 'image',
    floatingZoom: 1.4,
    layoutOptions: {
        showParameters: false, showComments: true, showRemarks: false,
        showActionDescription: true, showFloatingForm: true, showFloatingMatrix: false,
        showFloatingTraffic: true, showFloatingImage: false, showFloatingConditions: true,
        showFloatingVariables: false, showFloatingRemarks: true
    },
    directoryNames: { open: 'Études', save: 'Études', import: null, image: null, greenWave: null }
});

// Un jeu de propriétés complet : le hook en attend une soixantaine, toutes
// inertes ici sauf celles que le chemin d'enregistrement consulte.
const proprietes = (sur = {}) => {
    const ref = () => ({ current: null });
    const p = {
        projectName: 'Essai',
        diagramHeight: 640,
        floatingCrop: { top: 4, bottom: 8, left: 2, right: 6 },
        floatingZoom: 1.4,
        showComments: true,
        showRemarks: false,
        showActionDescription: true,
        sidebarVisible: false,
        showFloatingForm: true,
        showFloatingMatrix: false,
        showFloatingTraffic: true,
        showFloatingImage: false,
        showFloatingConditions: true,
        showFloatingVariables: false,
        showFloatingRemarks: true,
        dossierSections: { image: true },
        getFullState: () => etatComplet(),
        loadFullState: vi.fn(),
        saveProject: vi.fn(),
        isDirty: false,
        hasUnsavedChanges: false,
        projectModifiedSkip: ref(),
        lastOpenDirectoryRef: ref(),
        lastSaveDirectoryRef: ref(),
        lastImportDirectoryRef: ref(),
        lastImageDirectoryRef: ref(),
        lastGreenWaveDirectoryRef: ref(),
        saveDirectoryHandle: vi.fn(),
        loadDirectoryHandle: vi.fn(),
        recentOpenDirs: [{ name: 'Études' }],
        recentSaveDirs: [{ name: 'Études' }],
        recentImportDirs: [],
        recentImageDirs: [],
        recentGreenWaveDirs: [],
        addRecentDirectory: vi.fn(),
        askConfirm: vi.fn(async () => true),
        showAlert: vi.fn(async () => {})
    };
    // Tous les poseurs d'état : inertes, mais ils doivent exister.
    ['setSelectedProject', 'setOpenModal', 'setCurrentProjectPath', 'setProjectModified',
        'setHasUnsavedChanges', 'setDiagramHeight', 'resetDiagramHeight', 'setFloatingCrop',
        'setFloatingZoom', 'markLegacyCrop', 'setShowComments', 'setShowRemarks',
        'setIntersectionName', 'setShowActionDescription', 'setSidebarVisible',
        'setShowFloatingForm', 'setShowFloatingMatrix', 'setShowFloatingTraffic',
        'setShowFloatingImage', 'setShowFloatingConditions', 'setShowFloatingVariables',
        'setShowFloatingRemarks', 'setHasActiveProject', 'setDossierSections']
        .forEach(nom => { p[nom] = vi.fn(); });
    return { ...p, ...sur };
};

/** Intercepte l'écriture disque et rend ce qui a été écrit. */
const interceptantLEcriture = () => {
    const ecrit = { contenu: null };
    window.showSaveFilePicker = vi.fn(async () => ({
        name: 'Essai.json',
        createWritable: async () => ({
            write: async (c) => { ecrit.contenu = c; },
            close: async () => {}
        })
    }));
    return ecrit;
};

beforeEach(() => {
    vi.restoreAllMocks();
});

describe('Fichier projet — ce qui est écrit', () => {
    it('le contenu est du JSON, et porte le nom du projet', async () => {
        const ecrit = interceptantLEcriture();
        const { result } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await result.current.handleSaveFileWithPicker(); });

        expect(ecrit.contenu).not.toBeNull();
        const paquet = JSON.parse(ecrit.contenu);
        expect(paquet.intersectionName).toBe('Carrefour témoin');
    });

    it("le fichier ne porte rien que l'état canonique ne porte", async () => {
        // La symétrie : tout ce qui part dans le fichier doit aussi partir
        // dans le cache, qui n'écrit que getFullState.
        const ecrit = interceptantLEcriture();
        const { result } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await result.current.handleSaveFileWithPicker(); });

        const duFichier = Object.keys(JSON.parse(ecrit.contenu)).sort();
        const duCache = Object.keys(etatComplet()).sort();
        const enTrop = duFichier.filter(k => !duCache.includes(k));
        expect(
            enTrop,
            `le fichier porte ${enTrop.join(', ')} que le cache ignore : rouvrir depuis la liste les perdra`
        ).toEqual([]);
    });

    it('les réglages de mise en page arrivent intacts', async () => {
        const ecrit = interceptantLEcriture();
        const { result } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await result.current.handleSaveFileWithPicker(); });

        const paquet = JSON.parse(ecrit.contenu);
        expect(paquet.diagramHeight).toBe(640);
        expect(paquet.floatingZoom).toBe(1.4);
        expect(paquet.floatingCrop).toEqual({ top: 4, bottom: 8, left: 2, right: 6 });
        expect(paquet.layoutOptions.showParameters).toBe(false);
        expect(paquet.layoutOptions.showFloatingRemarks).toBe(true);
        expect(paquet.dossierSections).toEqual({ image: true });
    });

    // Le second chemin d'enregistrement, celui d'un répertoire récent — en
    // pratique le plus emprunté. Il construit son paquet dans un bloc distinct,
    // jumeau du premier : deux blocs à garder d'accord, donc deux à tester.
    it("l'enregistrement dans un répertoire récent écrit la même chose", async () => {
        const ecrit = interceptantLEcriture();
        const { result } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await result.current.handleSaveFileToRecentDir(0); });

        expect(ecrit.contenu, "rien n'a été écrit").not.toBeNull();
        const paquet = JSON.parse(ecrit.contenu);
        const enTrop = Object.keys(paquet).filter(k => !Object.keys(etatComplet()).includes(k));
        expect(enTrop, `le fichier porte ${enTrop.join(', ')} que le cache ignore`).toEqual([]);
        expect(paquet.diagramHeight).toBe(640);
        expect(paquet.layoutOptions.showFloatingRemarks).toBe(true);
        expect(paquet.dossierSections).toEqual({ image: true });
    });

    it('les deux chemins écrivent un contenu identique', async () => {
        const a = interceptantLEcriture();
        const { result: r1 } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await r1.current.handleSaveFileWithPicker(); });
        const parSelecteur = a.contenu;

        const b = interceptantLEcriture();
        const { result: r2 } = renderHook(() => useFileOperations(proprietes()));
        await act(async () => { await r2.current.handleSaveFileToRecentDir(0); });

        expect(JSON.parse(b.contenu)).toEqual(JSON.parse(parSelecteur));
    });

    it("sans l'API du navigateur, on retombe sur l'enregistrement en cache", async () => {
        delete window.showSaveFilePicker;
        const saveProject = vi.fn();
        vi.spyOn(window, 'prompt').mockReturnValue('Repli');
        const { result } = renderHook(() => useFileOperations(proprietes({ saveProject })));
        await act(async () => { await result.current.handleSaveFileWithPicker(); });
        expect(saveProject).toHaveBeenCalledWith('Repli');
    });
});
