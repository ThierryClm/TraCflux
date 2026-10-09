import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MouseEvent } from 'react';
import { safeShowSaveFilePicker, safeShowOpenFilePicker } from './utils/filePicker';
import { writeTextToFileHandle } from './utils/writeFileHandle';
import usePopupWindow, { setMainModalActive } from './hooks/usePopupWindow';
import useDirectoryHandles from './hooks/useDirectoryHandles';
import useGreenWaveGeometry from './hooks/useGreenWaveGeometry';
import useSyncedColorTheme from './hooks/useSyncedColorTheme';
import GreenWaveMenuBar from './components/GreenWaveMenuBar';
import CreateGreenWaveDialog, { type CreatedIntersection } from './components/CreateGreenWaveDialog';
import HelpContent from './components/HelpContent';
import Modal from './components/Modal';
import RelinkDossierDialog from './components/RelinkDossierDialog';
import AddCarrefourModal from './components/greenwave/AddCarrefourModal';
import GreenWaveAboutModal from './components/greenwave/GreenWaveAboutModal';
import GreenWaveDataPanel, { type DistanceField, type GreenWaveDirection } from './components/greenwave/GreenWaveDataPanel';
import GreenWaveDiagram, { type SpeedLineDrag } from './components/greenwave/GreenWaveDiagram';
import GreenWaveLegend from './components/greenwave/GreenWaveLegend';
import GreenWaveRestoreModal from './components/greenwave/GreenWaveRestoreModal';
import { useConfirm, useAlert } from './components/ConfirmProvider';
import { toast } from './utils/toast';
import { printGreenWave } from './utils/greenWavePrint';
import { applyPfDiagram } from './utils/greenWaveRelink';
import { computeBandwidth } from './utils/greenWaveBandwidth';
import {
    listCachedProjectNamesByUse, listCachedProjectSaves, listRecentGreenWaves, readCachedProject,
    readSavedGreenWaves, slimIntersectionsForExport, writeSavedGreenWaves, type RecentGreenWave
} from './utils/greenWaveStorage';
import { takeGreenWaveFromIndexedDB } from './utils/greenWaveTransfer';
import { isInviteVisible, noteWelcomeView, noteProjectSeen } from './utils/welcomeInvite';
import { isExampleSession, exitExampleSession } from './utils/exampleMode';
import type {
    GreenWaveIntersection, GreenWavePf, GreenWavePfParams, GreenWaveProjectSource, GreenWaveSettings, SavedGreenWave
} from './types/greenWave';
import './components/GreenWaveViewer.css';

// Bornes des distances de carrefour : [-9999 ; +9999] m. Les valeurs
// négatives permettent de placer des carrefours au sud d'un point 0
// (carrefour central par ex.) sans devoir décaler tous les existants.
const DISTANCE_MIN = -9999;
const DISTANCE_MAX = 9999;
const clampDistance = (value: string): number => {
    const n = parseInt(value);
    if (isNaN(n)) return 0;
    return Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, n));
};

/** Relit un dossier du cache pour un carrefour ; garde ses données en cas d'échec. */
const reloadProjectData = (intersection: GreenWaveIntersection) => {
    const projectRaw = localStorage.getItem(`traffic_project_${intersection.projectName}`);

    let newGroups = intersection.groups;
    let newCycleLength = intersection.cycleLength;
    let newPfTabs = intersection.pfTabs;

    if (projectRaw) {
        try {
            const projectData: GreenWaveProjectSource = JSON.parse(projectRaw);
            if (projectData.groups) {
                newGroups = projectData.groups;
            }
            if (projectData.cycleLength) {
                newCycleLength = projectData.cycleLength;
            }
            if (projectData.pfTabs) {
                newPfTabs = projectData.pfTabs;
            }
        } catch (e) {
            console.error(`Failed to load project data for ${intersection.projectName}`, e);
        }
    }
    return { newGroups, newCycleLength, newPfTabs };
};

const GreenWavePage = () => {
    const askConfirm = useConfirm();
    const showAlert = useAlert();
    useSyncedColorTheme();

    const [intersections, setIntersections] = useState<GreenWaveIntersection[] | null>(null);
    // Sélecteur de projet pour le « + Ajouter un carrefour » du tableau des
    // données saisies. Modale React (l'ancien window.prompt natif était
    // invisible dans la popup détachée et bloqué en mode PWA installé).
    const [addCarrefourModalOpen, setAddCarrefourModalOpen] = useState(false);
    const [addCarrefourCandidates, setAddCarrefourCandidates] = useState<string[]>([]);
    const [addCarrefourSelected, setAddCarrefourSelected] = useState<string | null>(null);
    // Carrefour dont on change le dossier relié (index dans intersections).
    const [relinkIdx, setRelinkIdx] = useState<number | null>(null);

    // Réclame le premier plan tant que la modale est ouverte : ramène la
    // fenêtre principale devant et suspend le retour-au-premier-plan des
    // fenêtres détachées, sinon la modale est masquée derrière la popup.
    useEffect(() => {
        setMainModalActive(addCarrefourModalOpen || relinkIdx !== null);
        return () => setMainModalActive(false);
    }, [addCarrefourModalOpen, relinkIdx]);
    // Invitation « onde verte exemple » (cf. utils/welcomeInvite) — figée
    // au montage. Compteurs propres au module Onde verte.
    const [showExampleInvite] = useState(() => isInviteVisible('greenwave'));
    // Onde verte exemple : modifiable mais non enregistrable.
    const [gwIsExample, setGwIsExample] = useState(() => isExampleSession());
    const gwLeaveExample = useCallback(() => {
        if (isExampleSession()) { exitExampleSession(); setGwIsExample(false); }
    }, []);
    const gwWelcomeViewNoted = useRef(false);
    const gwProjectSeenNoted = useRef(false);
    const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(1);
    const [speedUp, setSpeedUp] = useState(50); // km/h - vitesse montante
    const [speedDown, setSpeedDown] = useState(50); // km/h - vitesse descendante
    const [greenWaveName, setGreenWaveName] = useState('');
    const [speedLineOffsetUp, setSpeedLineOffsetUp] = useState(0); // Offset horizontal ligne montante (en secondes)
    const [speedLineOffsetDown, setSpeedLineOffsetDown] = useState(0); // Offset horizontal ligne descendante (en secondes)
    const [dragging, setDragging] = useState<SpeedLineDrag>(null);
    const [displayCycles, setDisplayCycles] = useState(2); // Number of cycles to display (2 or 3)
    const [showSpeedLines, setShowSpeedLines] = useState(true); // Affichage des lignes directrices
    // Paramètres par plan de feux, indexés par son nom.
    const [pfParams, setPfParams] = useState<Record<string, GreenWavePfParams>>({});
    // Nom du fichier d'origine sur disque (sans .json) — propagé depuis
    // l'app principale via sessionStorage, sert à pré-remplir la boîte de
    // dialogue « Enregistrer dans le réseau » avec le bon nom de fichier
    // (au cas où le greenWaveName interne diffère, ex. ancien fichier dont
    // le champ JSON name n'incluait pas le préfixe « Onde verte »).
    const [loadedFileName, setLoadedFileName] = useState('');
    // Modale « À propos » de la fenêtre Onde verte (équivalent simplifié
    // de la modale de l'app principale).
    const [showAboutModal, setShowAboutModal] = useState(false);
    // Modale de création d'une nouvelle onde verte directement dans la
    // fenêtre courante (réutilise CreateGreenWaveDialog de l'app principale).
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    // Modale « Restaurer un projet récent... » : liste des ondes vertes
    // présentes dans localStorage (alimenté par l'auto-save).
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoreList, setRestoreList] = useState<RecentGreenWave[]>([]);
    const [selectedRestoreName, setSelectedRestoreName] = useState<string | null>(null);
    // Modale d'aide : on affiche le même composant HelpContent que l'app
    // principale, focalisé sur le chapitre Onde verte. Pas de nouvel onglet.
    const [showHelpModal, setShowHelpModal] = useState(false);
    // Suivi des modifications non sauvegardées (équivalent isDirty de l'app
    // principale). Devient true au premier changement utilisateur, repasse à
    // false sur sauvegarde, ouverture, création. Sert à demander confirmation
    // avant d'écraser le travail en cours.
    const [gwIsDirty, setGwIsDirty] = useState(false);
    // Garde-fou pour ignorer les changements de state pendant le chargement
    // (qui ne sont pas des modifications utilisateur).
    const isApplyingSettingsRef = useRef(false);

    // Détachement du tableau des données saisies dans une fenêtre popup
    // pour libérer l'espace écran sous le diagramme. Persisté en localStorage.
    const [showFloatingDataTable, setShowFloatingDataTable] = useState(() => {
        return localStorage.getItem('greenwave_floating_datatable') === 'true';
    });
    useEffect(() => {
        localStorage.setItem('greenwave_floating_datatable', String(showFloatingDataTable));
    }, [showFloatingDataTable]);
    const dataTablePopup = usePopupWindow({
        geometryKey: 'greenWaveDataTable',
        isOpen: showFloatingDataTable,
        onClose: () => setShowFloatingDataTable(false),
        title: 'Tableau des données saisies — Onde verte',
        width: 1260,
        height: 500
    });
    const dataTableIsDetached = showFloatingDataTable && dataTablePopup.popupOpen;

    // Dernier répertoire d'enregistrement des ondes vertes, mémorisé dans IndexedDB.
    const { lastGreenWaveDirectoryRef, saveDirectoryHandle } = useDirectoryHandles();

    // Get current PF name from first intersection
    const getCurrentPfName = useCallback(() => {
        if (!intersections || intersections.length === 0) return 'PF1';
        const firstIntersection = intersections[0];
        const selectedPfId = firstIntersection.selectedPfId || 1;
        const selectedPf = firstIntersection.pfTabs?.find(pf => pf.id === selectedPfId);
        return selectedPf?.name || 'PF1';
    }, [intersections]);

    // Réglages des lignes de vitesse, enregistrés pour le plan de feux courant.
    const currentPfParams = (): GreenWavePfParams => ({
        speedUp,
        speedDown,
        offsetUp: speedLineOffsetUp,
        offsetDown: speedLineOffsetDown,
        showSpeedLines
    });

    // Auto-save de l'onde verte dans localStorage (clé `savedGreenWaves[name]`).
    // Comportement aligné sur l'auto-save du module Diagramme de Feux :
    // - Ne déclenche pas tant qu'aucun nom n'est défini (pas de "Sans titre"
    //   qui pollue la liste « Restaurer un projet récent »).
    // - Skip si un chargement est en cours (isApplyingSettingsRef true).
    // - Debounce de 1,5 s : on n'écrit pas en localStorage à chaque keystroke.
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!intersections || intersections.length === 0) return;
        if (!greenWaveName) return;
        if (isApplyingSettingsRef.current) return;
        // Onde verte exemple : aucune persistance localStorage.
        if (isExampleSession()) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            try {
                const greenWaveData: SavedGreenWave = {
                    name: greenWaveName,
                    intersections,
                    speedUp,
                    speedDown,
                    speedLineOffsetUp,
                    speedLineOffsetDown,
                    showSpeedLines,
                    pfParams,
                    pixelsPerSecond,
                    pixelsPerMeter,
                    displayCycles,
                    savedAt: new Date().toISOString()
                };
                const savedGreenWaves = readSavedGreenWaves();
                savedGreenWaves[greenWaveName] = greenWaveData;
                writeSavedGreenWaves(savedGreenWaves);
            } catch (e) {
                console.error('Auto-save onde verte a échoué', e);
            }
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [intersections, greenWaveName, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown, showSpeedLines, pfParams, pixelsPerSecond, pixelsPerMeter, displayCycles]);

    // Appliquer les settings chargés. Pendant l'application, le flag
    // isApplyingSettingsRef neutralise la détection de modifications pour
    // éviter que le chargement ne fasse passer gwIsDirty à true.
    const applySettings = useCallback((settings: GreenWaveSettings | null | undefined) => {
        if (!settings) return;
        isApplyingSettingsRef.current = true;
        if (settings.name) setGreenWaveName(settings.name);
        if (settings.speedUp) setSpeedUp(settings.speedUp);
        else if (settings.speed) setSpeedUp(settings.speed);
        if (settings.speedDown) setSpeedDown(settings.speedDown);
        else if (settings.speed) setSpeedDown(settings.speed);
        if (settings.pixelsPerSecond) setPixelsPerSecond(settings.pixelsPerSecond);
        if (settings.pixelsPerMeter) setPixelsPerMeter(settings.pixelsPerMeter);
        if (settings.speedLineOffsetUp !== undefined) setSpeedLineOffsetUp(settings.speedLineOffsetUp);
        if (settings.speedLineOffsetDown !== undefined) setSpeedLineOffsetDown(settings.speedLineOffsetDown);
        if (settings.showSpeedLines !== undefined) setShowSpeedLines(settings.showSpeedLines);
        if (settings.pfParams) setPfParams(settings.pfParams);
        if (settings.displayCycles) setDisplayCycles(settings.displayCycles);
        if (settings.loadedFileName) setLoadedFileName(settings.loadedFileName);
        if (settings.name) {
            // Évite le double préfixe « Onde Verte » dans le titre de l'onglet :
            // si le nom enregistré commence déjà par « onde verte » (insensible
            // à la casse, espaces et tirets initiaux), on l'affiche tel quel ;
            // sinon on ajoute le préfixe pour le contexte.
            const nameLower = settings.name.toLowerCase().trimStart();
            const startsWithPrefix = /^ondes?\s*vertes?\b/.test(nameLower);
            document.title = startsWithPrefix
                ? settings.name
                : `Onde Verte - ${settings.name}`;
        }
        // À la fin de l'application des settings, relâche le garde-fou et
        // marque le projet comme propre. setTimeout 0 pour laisser React
        // batcher les setState et le useEffect dépendant s'exécuter avant.
        setTimeout(() => {
            isApplyingSettingsRef.current = false;
            setGwIsDirty(false);
        }, 0);
    }, []);

    // Ouverture de la modale « Restaurer un projet récent ». Lit les ondes
    // vertes présentes dans `localStorage.savedGreenWaves`, filtre celles
    // qui n'ont pas la signature attendue (champ intersections), trie par
    // date de sauvegarde décroissante.
    const openRestoreModal = () => {
        try {
            setRestoreList(listRecentGreenWaves());
            setSelectedRestoreName(null);
            setShowRestoreModal(true);
        } catch (e) {
            console.error('Failed to read savedGreenWaves', e);
            showAlert({ title: 'Erreur', message: "Impossible de lire la liste des ondes vertes récentes." });
        }
    };

    // Chargement d'une onde verte depuis la liste « Restaurer un projet récent ».
    // Demande confirmation si la session courante a des modifications non
    // sauvegardées, puis applique les settings et restaure les intersections.
    const handleRestoreSelected = async (name: string) => {
        try {
            const data = readSavedGreenWaves()[name];
            if (!data || !Array.isArray(data.intersections)) {
                showAlert({ title: 'Entrée invalide', message: "Cet enregistrement n'est pas une onde verte exploitable." });
                return;
            }
            if (gwIsDirty) {
                const ok = await askConfirm({
                    title: 'Modifications non enregistrées',
                    message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et restaurer le projet sélectionné ?",
                    confirmLabel: 'Continuer',
                    danger: true,
                });
                if (!ok) return;
            }
            setShowRestoreModal(false);
            gwLeaveExample(); // restaurer un projet : on quitte l'exemple
            isApplyingSettingsRef.current = true;
            setIntersections(data.intersections);
            applySettings(data);
        } catch (e) {
            console.error('Restore failed', e);
            showAlert({ title: 'Erreur de restauration', message: `Erreur lors de la restauration : ${e.message}` });
        }
    };

    // Save green wave data to file system (network)
    const handleSaveGreenWaveToFile = async () => {
        if (!intersections) return;
        // Onde verte exemple : non enregistrable (l'entrée de menu est
        // déjà grisée — filet de sécurité pour les autres déclencheurs).
        if (isExampleSession()) {
            toast.info('Onde verte exemple : non enregistrable. Faites « Fichier → Nouveau » pour démarrer la vôtre.');
            return;
        }

        if (!window.showSaveFilePicker) {
            showAlert({ title: 'Navigateur non compatible', message: 'Votre navigateur ne supporte pas la sauvegarde de fichiers (File System Access API). Le cache navigateur est mis à jour automatiquement, mais l\'export en fichier .json n\'est pas disponible sur ce navigateur.' });
            return;
        }

        // Save current PF params before saving
        const updatedPfParams = { ...pfParams, [getCurrentPfName()]: currentPfParams() };
        setPfParams(updatedPfParams);

        const greenWaveData: SavedGreenWave = {
            name: greenWaveName || 'Onde verte',
            // Allège l'export : sans matrices d'intervert ni lignes d'action
            // vides. Les données en mémoire restent complètes.
            intersections: slimIntersectionsForExport(intersections),
            speedUp,
            speedDown,
            speedLineOffsetUp,
            speedLineOffsetDown,
            showSpeedLines,
            pfParams: updatedPfParams,
            pixelsPerSecond,
            pixelsPerMeter,
            displayCycles,
            savedAt: new Date().toISOString()
        };

        try {
            // Priorité au nom du fichier d'origine pour préserver le
            // préfixe « Onde verte - » qui peut différer du greenWaveName
            // interne (cas des anciens fichiers où JSON.name était stocké
            // sans le préfixe alors que le fichier sur disque le contenait).
            const suggestedFileName = loadedFileName || greenWaveName || 'onde_verte';
            const options: FilePickerOptionsLike = {
                suggestedName: `${suggestedFileName}.json`,
                types: [{
                    description: 'Fichier Onde Verte JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            };

            // Utiliser le dernier répertoire si disponible
            if (lastGreenWaveDirectoryRef.current) {
                options.startIn = lastGreenWaveDirectoryRef.current;
            }

            const fileHandle = await safeShowSaveFilePicker(options);

            // Write the file
            const jsonContent = JSON.stringify(greenWaveData, null, 2);
            await writeTextToFileHandle(fileHandle, jsonContent);

            // Vérifier que le fichier n'est pas vide après sauvegarde
            try {
                const savedFile = await fileHandle.getFile();
                const savedContent = await savedFile.text();
                if (!savedContent || savedContent.trim() === '') {
                    showAlert({ title: 'Sauvegarde vide', message: 'Attention : le fichier semble vide après la sauvegarde.\n\nVeuillez réessayer.' });
                    return;
                }
            } catch (verifyError) {
                console.warn('Impossible de vérifier le fichier sauvegardé:', verifyError);
            }

            // Mémoriser le répertoire parent
            try {
                // Le répertoire renvoyé par getParent est un vrai
                // FileSystemDirectoryHandle, seulement décrit ici a minima.
                const dirHandle = await fileHandle.getParent?.() as FileSystemDirectoryHandle | null | undefined;
                if (dirHandle) {
                    lastGreenWaveDirectoryRef.current = dirHandle;
                    await saveDirectoryHandle('lastGreenWaveDirectory', dirHandle);
                }
            } catch {
                // getParent n'est pas toujours disponible
            }

            // Synchronise le titre affiché sur le nom du fichier sauvegardé :
            // c'est le comportement attendu après un « Enregistrer sous » avec
            // renommage. Au passage, on purge l'éventuelle entrée localStorage
            // de l'ancien nom pour éviter d'avoir un doublon (ancien + nouveau)
            // dans la liste des ondes vertes sauvegardées.
            const savedName = fileHandle.name.replace(/\.json$/i, '');
            const previousName = greenWaveName;
            setGreenWaveName(savedName);
            if (previousName && previousName !== savedName) {
                try {
                    const cache = readSavedGreenWaves();
                    if (cache[previousName]) {
                        delete cache[previousName];
                        writeSavedGreenWaves(cache);
                    }
                } catch { /* ignore */ }
            }
            // Mémorise le nouveau nom de fichier (au cas où l'utilisateur
            // l'a modifié dans la boîte de dialogue) pour que la prochaine
            // sauvegarde le re-suggère.
            setLoadedFileName(savedName);
            setGwIsDirty(false);

            toast.success(`Onde verte enregistrée dans « ${fileHandle.name} »`);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur sauvegarde fichier:', e);
                showAlert({ title: 'Erreur de sauvegarde', message: 'Erreur lors de la sauvegarde du fichier : ' + e.message });
            }
        }
    };

    // Synchronise les données de l'onde verte depuis les projets sauvegardés.
    // Unidirectionnel : projets -> onde verte. Seuls les projets encore présents
    // dans le cache localStorage peuvent être rafraîchis (cf. MAX_CACHED_PROJECTS).
    const handleSyncGreenWave = () => {
        if (!intersections) return;

        const synced: string[] = [];
        const notSynced: string[] = [];
        const updatedIntersections = intersections.map(intersection => {
            // Try to load project data from localStorage
            const projectKey = `traffic_project_${intersection.projectName}`;
            const projectRaw = localStorage.getItem(projectKey);

            if (projectRaw) {
                try {
                    const projectData: GreenWaveProjectSource = JSON.parse(projectRaw);
                    if (projectData.groups) {
                        // Get pfTabs and actionData from the selected plan de feu
                        const pfTabs: GreenWavePf[] = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
                        const selectedPfId = intersection.selectedPfId || pfTabs[0]?.id || 1;
                        const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);

                        // Use PF-specific cycleLength if available
                        const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || intersection.cycleLength;

                        synced.push(intersection.projectName);
                        return {
                            ...intersection,
                            intersectionName: projectData.intersectionName || intersection.intersectionName,
                            // Décalages et verts propres au plan de feux retenu
                            groups: applyPfDiagram(projectData.groups, selectedPf),
                            cycleLength: pfCycleLength,
                            pfTabs: pfTabs,
                            actionData: selectedPf?.data || []
                        };
                    }
                } catch (e) {
                    console.error(`Failed to sync project ${intersection.projectName}`, e);
                }
            }
            notSynced.push(intersection.projectName);
            return intersection;
        });

        setIntersections(updatedIntersections);

        // Fenêtre récapitulative : carrefours synchronisés / non synchronisés + limite
        const lines: string[] = [];
        if (synced.length > 0) {
            lines.push(`${synced.length} carrefour(s) synchronisé(s) :`);
            synced.forEach(name => lines.push(`  - ${name}`));
        }
        if (notSynced.length > 0) {
            if (lines.length) lines.push('');
            lines.push(`${notSynced.length} carrefour(s) non synchronisé(s) :`);
            notSynced.forEach(name => lines.push(`  - ${name}`));
            lines.push('');
            lines.push("Ces carrefours n'ont pas de projet disponible dans le cache du navigateur : seuls les projets récemment ouverts ou enregistrés y sont conservés. Pour les rafraîchir, ouvrez puis enregistrez leur projet dans le module principal, puis relancez la synchronisation.");
        }
        if (lines.length === 0) {
            lines.push('Aucun carrefour à synchroniser.');
        }

        showAlert({ title: "Synchronisation de l'onde verte", message: lines.join('\n') });
    };

    // Détection des modifications non sauvegardées : à chaque changement d'un
    // état surveillé (et hors période de chargement applySettings), on bascule
    // gwIsDirty à true. La remise à false se fait dans handleSaveGreenWaveToFile,
    // applySettings, handleCreateGreenWaveLocal.
    useEffect(() => {
        if (isApplyingSettingsRef.current) return;
        if (intersections === null) return; // pas encore de projet chargé
        setGwIsDirty(true);
    }, [intersections, speedUp, speedDown, speedLineOffsetUp, speedLineOffsetDown,
        pixelsPerSecond, pixelsPerMeter, displayCycles, showSpeedLines, pfParams]);

    // Load data on mount — sessionStorage par défaut, IndexedDB si &idb=1
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const greenWaveId = urlParams.get('id');
        if (!greenWaveId) {
            // Lancement du module sans projet pré-chargé : titre minimal
            // pour l'écran d'accueil. Sera remplacé par « Onde Verte - <nom> »
            // dès qu'un projet est chargé via Fichier > Nouveau ou Ouvrir.
            document.title = 'Onde verte';
            return;
        }

        const useIDB = urlParams.has('idb');

        if (!useIDB) {
            // Lecture depuis sessionStorage
            const savedData = sessionStorage.getItem(`greenwave_${greenWaveId}`);
            if (savedData) {
                try {
                    const data: GreenWaveIntersection[] = JSON.parse(savedData);
                    setIntersections(data);
                    document.title = `Onde Verte - ${data.length} carrefours`;
                } catch (e) {
                    console.error('Failed to load green wave data', e);
                }
            }
            const savedSettings = sessionStorage.getItem(`greenwave_settings_${greenWaveId}`);
            if (savedSettings) {
                try {
                    applySettings(JSON.parse(savedSettings));
                } catch (e) {
                    console.error('Failed to load green wave settings', e);
                }
            }
        } else {
            // Lecture depuis IndexedDB (fallback gros fichiers)
            takeGreenWaveFromIndexedDB(greenWaveId)
                .then(({ intersections: data, settings }) => {
                    if (data) {
                        setIntersections(data);
                        document.title = `Onde Verte - ${data.length} carrefours`;
                    }
                    if (settings) applySettings(settings);
                })
                .catch(e => console.error('Failed to load green wave data from IndexedDB', e));
        }
    }, [applySettings]);

    // Brouillons de saisie des champs distance : permet à l'utilisateur de
    // taper "-" puis les chiffres sans que la chaîne intermédiaire (invalide
    // côté nombre) écrase la valeur du modèle à 0. Clé : `${idx}.g1|g2`.
    // L'entrée est vidée au blur (commit) ; à ce moment, l'input réaffiche la
    // valeur clampée du modèle.
    const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});

    // Surbrillance dirigée tableau → barre uniquement : hover sur les cellules
    // GF montant / GF descendant du tableau met en valeur la barre correspondante
    // (toutes ses répétitions de cycle) dans le diagramme. Le sens inverse
    // (hover barre → cellules) n'est pas géré car la zone de drag transparente
    // des bandes passantes intercepte le hover des barres quand elles se croisent.
    const [hoveredOndeVerteCell, setHoveredOndeVerteCell] = useState<{ idx: number; direction: GreenWaveDirection } | null>(null);
    const isOndeVerteHovered = (idx: number, direction: GreenWaveDirection) =>
        hoveredOndeVerteCell?.idx === idx && hoveredOndeVerteCell?.direction === direction;

    // Saisie d'une distance : g1 = GF descendant (distance), g2 = GF montant (distanceG2).
    const updateDistance = (intersectionIdx: number, field: DistanceField, value: string) => {
        setDistanceDrafts(prev => ({ ...prev, [`${intersectionIdx}.${field}`]: value }));
        const n = parseInt(value);
        if (!isNaN(n)) {
            const key = field === 'g1' ? 'distance' : 'distanceG2';
            setIntersections(prev => {
                const updated = [...prev!];
                updated[intersectionIdx] = { ...updated[intersectionIdx], [key]: clampDistance(value) };
                return updated;
            });
        }
    };

    // Au blur, retire le brouillon : l'input réaffiche alors la valeur clampée
    // du modèle (les valeurs invalides — "-" seul, "" — laissent le modèle inchangé).
    const commitDistanceDraft = (intersectionIdx: number, which: DistanceField) => {
        setDistanceDrafts(prev => {
            const next = { ...prev };
            delete next[`${intersectionIdx}.${which}`];
            return next;
        });
    };

    // Update selected plan de feu for an intersection
    // Also reloads groups, cycleLength and green durations from the saved project
    const updateSelectedPf = (intersectionIdx: number, pfId: number) => {
        setIntersections(prev => {
            const updated = [...prev!];
            const intersection = updated[intersectionIdx];

            // Try to load fresh data from the saved project
            const { newGroups, newCycleLength, newPfTabs } = reloadProjectData(intersection);
            const selectedPf = newPfTabs?.find(pf => pf.id === pfId);

            // Use PF-specific cycleLength if available, otherwise fallback to project cycleLength
            const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

            updated[intersectionIdx] = {
                ...intersection,
                selectedPfId: pfId,
                // Décalages et verts propres au plan de feux retenu
                groups: applyPfDiagram(newGroups, selectedPf),
                cycleLength: pfCycleLength,
                pfTabs: newPfTabs,
                actionData: selectedPf?.data || []
            };
            return updated;
        });
    };

    // Update the selected group of an intersection: selectedGroup1 = descendant, selectedGroup2 = montant
    const updateSelectedGroup = (intersectionIdx: number, key: 'selectedGroup1' | 'selectedGroup2', groupId: number) => {
        setIntersections(prev => {
            const updated = [...prev!];
            updated[intersectionIdx] = { ...updated[intersectionIdx], [key]: groupId };
            return updated;
        });
    };

    // Change PF for all intersections based on a reference PF
    // Tries to match by name first, then by cycle length
    const handleGlobalPfChange = (referencePfId: number) => {
        if (!intersections || intersections.length === 0) return;

        const firstIntersection = intersections[0];
        const referencePf = firstIntersection.pfTabs?.find(pf => pf.id === referencePfId);
        if (!referencePf) return;

        // Save current PF params before switching
        const updatedPfParams = { ...pfParams, [getCurrentPfName()]: currentPfParams() };
        setPfParams(updatedPfParams);

        const referencePfName = referencePf.name;
        const referenceCycleLength = referencePf.cycleLength || firstIntersection.cycleLength;

        // Load params for the new PF (if they exist)
        const newPfParamsData = updatedPfParams[referencePfName];
        if (newPfParamsData) {
            setSpeedUp(newPfParamsData.speedUp ?? 50);
            setSpeedDown(newPfParamsData.speedDown ?? 50);
            setSpeedLineOffsetUp(newPfParamsData.offsetUp ?? 0);
            setSpeedLineOffsetDown(newPfParamsData.offsetDown ?? 0);
            setShowSpeedLines(newPfParamsData.showSpeedLines ?? true);
        } else {
            // Reset to defaults if no saved params for this PF
            setSpeedLineOffsetUp(0);
            setSpeedLineOffsetDown(0);
            setShowSpeedLines(true);
        }

        setIntersections(prev => {
            return prev!.map(intersection => {
                // Load fresh data from localStorage for this intersection
                const { newGroups, newCycleLength, newPfTabs } = reloadProjectData(intersection);

                // Find matching PF: first by name, then by cycle length
                let matchingPf = newPfTabs?.find(pf => pf.name === referencePfName);

                if (!matchingPf) {
                    // Try to find first PF with matching cycle length
                    matchingPf = newPfTabs?.find(pf => {
                        const pfCycle = pf.cycleLength || newCycleLength;
                        return pfCycle === referenceCycleLength;
                    });
                }

                // Fallback to first PF if no match found
                if (!matchingPf && newPfTabs && newPfTabs.length > 0) {
                    matchingPf = newPfTabs[0];
                }

                const selectedPfId = matchingPf?.id || 1;
                const selectedPf = newPfTabs?.find(pf => pf.id === selectedPfId);

                // Use PF-specific cycleLength if available
                const pfCycleLength = selectedPf?.cycleLength || newCycleLength;

                return {
                    ...intersection,
                    selectedPfId: selectedPfId,
                    // Décalages et verts propres au plan de feux retenu
                    groups: applyPfDiagram(newGroups, selectedPf),
                    cycleLength: pfCycleLength,
                    pfTabs: newPfTabs,
                    actionData: selectedPf?.data || []
                };
            });
        });
    };

    // Charge un projet par son nom et l'ajoute comme nouveau carrefour à
    // l'onde verte. Sortie : appelé soit depuis la modale de sélection, soit
    // (futur) depuis tout autre déclencheur.
    const addIntersectionFromProject = (selectedProject: string | null) => {
        if (!selectedProject) return;
        const projectKey = `traffic_project_${selectedProject}`;
        const projectRaw = localStorage.getItem(projectKey);
        if (!projectRaw) {
            showAlert({ title: 'Chargement impossible', message: `Impossible de charger le projet « ${selectedProject} ».` });
            return;
        }

        try {
            const projectData: GreenWaveProjectSource = JSON.parse(projectRaw);
            const pfTabs: GreenWavePf[] = projectData.pfTabs || [{ id: 1, name: 'PF1', data: [] }];
            const selectedPfId = pfTabs[0]?.id || 1;
            const selectedPf = pfTabs.find(pf => pf.id === selectedPfId);
            const pfCycleLength = selectedPf?.cycleLength || projectData.cycleLength || 90;

            // Get groups with PF-specific data if available
            const groups = applyPfDiagram(projectData.groups || [], selectedPf);

            // Calculate default distance (last intersection distance + 100m or 0)
            const lastDistance = intersections && intersections.length > 0
                ? Math.max(...intersections.map(i => i.distance))
                : 0;
            const newDistance = lastDistance + 100;

            // Create new intersection object
            const newIntersection: GreenWaveIntersection = {
                projectName: selectedProject,
                intersectionName: projectData.intersectionName || undefined,
                groups: groups,
                cycleLength: pfCycleLength,
                pfTabs: pfTabs,
                selectedPfId: selectedPfId,
                selectedGroup1: groups[0]?.id || 1,
                selectedGroup2: groups[0]?.id || 1,
                distance: newDistance,
                distanceG2: newDistance,
                actionData: selectedPf?.data || []
            };

            setIntersections(prev => [...(prev || []), newIntersection]);
        } catch (e) {
            console.error('Failed to load project data', e);
            showAlert({ title: 'Erreur de chargement', message: `Erreur lors du chargement du projet « ${selectedProject} ».` });
        }
    };

    // Add a new intersection from saved projects — ouvre la modale de
    // sélection, sur les dossiers du cache dans leur ordre d'usage.
    const addIntersection = () => {
        const availableProjects = listCachedProjectNamesByUse();

        if (availableProjects.length === 0) {
            showAlert({ title: 'Aucun projet', message: 'Aucun projet sauvegardé disponible.' });
            return;
        }

        setAddCarrefourCandidates(availableProjects);
        setAddCarrefourSelected(availableProjects[0]);
        setAddCarrefourModalOpen(true);
    };

    // Confirme la sélection depuis la modale.
    const confirmAddCarrefour = (name?: string) => {
        const target = name || addCarrefourSelected;
        setAddCarrefourModalOpen(false);
        setAddCarrefourSelected(null);
        addIntersectionFromProject(target);
    };

    const closeAddCarrefour = () => {
        setAddCarrefourModalOpen(false);
        setAddCarrefourSelected(null);
    };

    // Move intersection up or down in the list
    const moveIntersection = (index: number, direction: 'up' | 'down') => {
        setIntersections(prev => {
            if (!prev) return prev;
            const newList = [...prev].map(item => ({ ...item }));
            const targetIndex = direction === 'up' ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= newList.length) return prev;

            // Swap intersections (each keeps its own distance)
            [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
            return newList;
        });
    };

    // Calculate speed line slope (meters per second)
    const speedUpMps = (speedUp * 1000) / 3600; // Convert km/h to m/s - ascending
    const speedDownMps = (speedDown * 1000) / 3600; // Convert km/h to m/s - descending

    const geometry = useGreenWaveGeometry(intersections, displayCycles, pixelsPerSecond, pixelsPerMeter);
    const { cycleLength, diagramWidth, diagramHeight } = geometry;

    // Calculate bandwidth corridors (ascending and descending)
    const bandwidthData = useMemo(
        () => computeBandwidth(intersections, speedUpMps, speedDownMps, cycleLength),
        [intersections, speedUpMps, speedDownMps, cycleLength]
    );

    // Drag handlers for speed lines
    const [dragStartX, setDragStartX] = useState(0);
    const [initialOffset, setInitialOffset] = useState(0);

    const handleSpeedLineMouseDown = (direction: 'up' | 'down', e: MouseEvent<SVGLineElement>) => {
        e.preventDefault();
        setDragging(direction);
        setDragStartX(e.clientX);
        setInitialOffset(direction === 'up' ? speedLineOffsetUp : speedLineOffsetDown);
    };

    const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
        if (!dragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaSeconds = deltaX / pixelsPerSecond;
        if (dragging === 'up') {
            setSpeedLineOffsetUp(initialOffset + deltaSeconds);
        } else if (dragging === 'down') {
            setSpeedLineOffsetDown(initialOffset + deltaSeconds);
        }
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    // Titre du projet de chaque carrefour, lu dans le dossier en cache pour
    // les ondes vertes enregistrées avant que le titre ne soit conservé.
    // Clé : la liste des noms de fichiers, pour ne relire le cache qu'au
    // changement de dossier et non à chaque saisie de distance.
    const projectNamesKey = intersections?.map(i => i.projectName).join('\n') ?? '';
    const cachedTitles = useMemo(() => {
        const titles: Record<string, string | null> = {};
        intersections?.forEach(intersection => {
            if (intersection.intersectionName || intersection.projectName in titles) return;
            try {
                const raw = localStorage.getItem(`traffic_project_${intersection.projectName}`);
                titles[intersection.projectName] = raw ? JSON.parse(raw).intersectionName || null : null;
            } catch {
                titles[intersection.projectName] = null;
            }
        });
        return titles;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectNamesKey]);

    // Tableau des données saisies — élément partagé entre le rendu inline
    // (sous le diagramme) et la fenêtre popup détachée. Le bouton Détacher
    // n'apparaît que dans le rendu inline (pas dans la popup déjà détachée).
    const dataPanel = (
        <GreenWaveDataPanel
            intersections={intersections}
            cachedTitles={cachedTitles}
            distanceDrafts={distanceDrafts}
            isHovered={isOndeVerteHovered}
            onHover={setHoveredOndeVerteCell}
            showDetachButton={!dataTableIsDetached}
            onDetach={() => {
                setShowFloatingDataTable(true);
                dataTablePopup.retryOpen();
            }}
            onAddIntersection={addIntersection}
            onMove={moveIntersection}
            onRelink={setRelinkIdx}
            onSelectPf={updateSelectedPf}
            onSelectGroupUp={(idx, groupId) => updateSelectedGroup(idx, 'selectedGroup2', groupId)}
            onSelectGroupDown={(idx, groupId) => updateSelectedGroup(idx, 'selectedGroup1', groupId)}
            onDistanceChange={updateDistance}
            onDistanceCommit={commitDistanceDraft}
        />
    );

    // Synchronise la popup détachée avec le contenu du tableau : re-rendu
    // à chaque update pour rester en phase avec l'inline.
    useEffect(() => {
        if (dataTableIsDetached) {
            dataTablePopup.renderToPopup(dataPanel);
        }
    });

    // Impression de l'onde verte. « Imprimer… » et « Exporter PDF… »
    // partagent ce rendu ; l'export PDF invite seulement à choisir
    // « Enregistrer au format PDF » et propose un nom de fichier.
    const handlePrintGreenWave = ({ pdf = false }: { pdf?: boolean } = {}) => {
        printGreenWave({ diagramWidth, diagramHeight, speedUp, speedDown, bandwidthData, greenWaveName, pdf });
    };

    // Création d'une nouvelle onde verte : remplace le contenu de la fenêtre
    // courante (philosophie « une seule session Onde verte à la fois »,
    // cohérente avec le module Diagramme). Si le projet courant a des
    // modifications non sauvegardées, on demande confirmation avant
    // d'écraser.
    const handleCreateGreenWaveLocal = async (newIntersections: CreatedIntersection[]) => {
        gwLeaveExample(); // créer une onde verte : on quitte l'exemple
        if (gwIsDirty) {
            const ok = await askConfirm({
                title: 'Modifications non enregistrées',
                message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et créer une nouvelle onde verte ?",
                confirmLabel: 'Continuer',
                danger: true,
            });
            // L'utilisateur annule : ne ferme pas le dialogue, lui laisse
            // l'opportunité d'annuler complètement la création.
            if (!ok) return;
        }
        isApplyingSettingsRef.current = true;
        setIntersections(newIntersections);
        setGreenWaveName('');
        setLoadedFileName('');
        setSpeedLineOffsetUp(0);
        setSpeedLineOffsetDown(0);
        setPfParams({});
        setShowCreateDialog(false);
        document.title = 'Onde Verte';
        setTimeout(() => {
            isApplyingSettingsRef.current = false;
            setGwIsDirty(false);
        }, 0);
    };

    // Ouvre une onde verte lue en fichier : réglages repris du fichier,
    // nom à défaut tiré du nom de fichier.
    const loadGreenWaveData = (data: SavedGreenWave, settings: GreenWaveSettings) => {
        isApplyingSettingsRef.current = true;
        setIntersections(data.intersections);
        applySettings(settings);
    };

    const settingsFromFile = (data: Partial<SavedGreenWave>, name: string, loadedFile: string): GreenWaveSettings => ({
        name,
        loadedFileName: loadedFile,
        speedUp: data.speedUp,
        speedDown: data.speedDown,
        speedLineOffsetUp: data.speedLineOffsetUp,
        speedLineOffsetDown: data.speedLineOffsetDown,
        showSpeedLines: data.showSpeedLines,
        pfParams: data.pfParams,
        pixelsPerSecond: data.pixelsPerSecond,
        pixelsPerMeter: data.pixelsPerMeter,
        displayCycles: data.displayCycles
    });

    // Chargement de l'onde verte exemple fournie (?example=ondeverte).
    // Fenêtre neuve (écran d'accueil ou FAQ) : aucune session à écraser.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('example') !== 'ondeverte') return;
        (async () => {
            try {
                const res = await fetch('./Onde%20verte_Exemple.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: SavedGreenWave = await res.json();
                if (!data || !Array.isArray(data.intersections)) {
                    throw new Error("Données d'onde verte invalides");
                }
                gwLeaveExample(); // ouvrir un fichier : on quitte l'exemple
                loadGreenWaveData(data, settingsFromFile(data, data.name || 'Onde verte exemple', 'Onde verte_Exemple'));
                document.title = `Onde Verte - ${data.name || 'exemple'}`;
                window.history.replaceState({}, '', `${window.location.pathname}?greenwave`);
            } catch (e) {
                console.error("Échec du chargement de l'onde verte exemple", e);
                showAlert({ title: 'Erreur', message: "Impossible de charger l'onde verte exemple." });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-effacement de l'invitation « onde verte exemple ».
    // Vue d'accueil : seulement si rien n'est auto-chargé (ni ?id ni
    // ?example=ondeverte).
    useEffect(() => {
        if (gwWelcomeViewNoted.current) return;
        const p = new URLSearchParams(window.location.search);
        if (p.has('id') || p.get('example') === 'ondeverte') return;
        gwWelcomeViewNoted.current = true;
        noteWelcomeView('greenwave');
    }, []);

    // Onde verte vue : à la première fois où des intersections sont chargées
    // dans ce montage (Nouveau, Ouvrir, exemple…). L'exemple compte.
    useEffect(() => {
        if (intersections && !gwProjectSeenNoted.current) {
            gwProjectSeenNoted.current = true;
            noteProjectSeen('greenwave');
        }
    }, [intersections]);

    // Ouverture d'un fichier .json d'onde verte : remplace le contenu de la
    // fenêtre courante (philosophie « une seule session Onde verte à la
    // fois »). Si le projet courant a des modifications non sauvegardées,
    // on demande confirmation avant d'écraser.
    const handleOpenGreenWaveFile = async () => {
        if (!window.showOpenFilePicker) {
            showAlert({ title: 'Navigateur non compatible', message: "Votre navigateur ne supporte pas l'ouverture de fichiers. Utilisez l'application principale." });
            return;
        }
        try {
            const [fileHandle] = await safeShowOpenFilePicker({
                types: [{ description: 'Fichier Onde Verte JSON', accept: { 'application/json': ['.json'] } }],
                multiple: false
            });
            const file = await fileHandle.getFile();
            const content = await file.text();
            if (!content || !content.trim()) {
                showAlert({ title: 'Fichier vide', message: 'Le fichier est vide.' });
                return;
            }
            const data = JSON.parse(content);
            if (!data || typeof data !== 'object') {
                showAlert({ title: 'Fichier invalide', message: 'Le fichier ne contient pas un objet JSON valide.' });
                return;
            }
            // Détection croisée : un fichier projet de carrefour (champs
            // groups / pfTabs / conflictMatrix) ne peut pas être ouvert ici.
            const looksLikeCarrefour = Array.isArray(data.groups) || Array.isArray(data.pfTabs) || Array.isArray(data.conflictMatrix);
            if (!Array.isArray(data.intersections)) {
                if (looksLikeCarrefour) {
                    showAlert({
                        title: 'Fichier incompatible',
                        message: "Ce fichier est un projet de carrefour, pas une onde verte. Pour l'ouvrir, utilisez le module Diagramme de Feux (fenêtre principale, Fichier → Ouvrir un projet)."
                    });
                } else {
                    showAlert({ title: 'Fichier invalide', message: "Le fichier ne contient pas de données d'onde verte valides." });
                }
                return;
            }
            // Confirmation si la fenêtre courante a des modifs non sauvées.
            // (Check fait après validation pour éviter une question inutile
            // si le fichier choisi n'est pas exploitable.)
            if (gwIsDirty) {
                const ok = await askConfirm({
                    title: 'Modifications non enregistrées',
                    message: "L'onde verte courante a des modifications non enregistrées qui seront perdues.\n\nContinuer et ouvrir le fichier sélectionné ?",
                    confirmLabel: 'Continuer',
                    danger: true,
                });
                if (!ok) return;
            }
            const fileName = file.name.replace(/\.json$/i, '');
            // Toujours charger dans la fenêtre courante (une session à la fois).
            loadGreenWaveData(data, settingsFromFile(data, data.name || fileName, fileName));
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Erreur ouverture fichier onde verte:', e);
                showAlert({ title: "Erreur d'ouverture", message: "Erreur lors de l'ouverture du fichier : " + e.message });
            }
        }
    };

    // Aiguillage des actions du menu : Nouveau et Ouvrir restent dans la
    // fenêtre courante (création/ouverture sans nouvel onglet). L'aide
    // s'ouvre dans une modale, sur le chapitre Onde verte.
    const handleMenuAction = (action: string) => {
        switch (action) {
            case 'new':
                setShowCreateDialog(true);
                break;
            case 'open':
                handleOpenGreenWaveFile();
                break;
            case 'restoreRecent':
                openRestoreModal();
                break;
            case 'saveFile':
                handleSaveGreenWaveToFile();
                break;
            case 'print':
                handlePrintGreenWave();
                break;
            case 'exportPdf':
                handlePrintGreenWave({ pdf: true });
                break;
            case 'close':
                window.close();
                break;
            case 'sync':
                handleSyncGreenWave();
                break;
            case 'about':
                setShowAboutModal(true);
                break;
            case 'help':
                setShowHelpModal(true);
                break;
            default:
                break;
        }
    };

    const menuBar = (
        <GreenWaveMenuBar
            onAction={handleMenuAction}
            pixelsPerSecond={pixelsPerSecond}
            onPixelsPerSecondChange={setPixelsPerSecond}
            pixelsPerMeter={pixelsPerMeter}
            onPixelsPerMeterChange={setPixelsPerMeter}
            displayCycles={displayCycles}
            onDisplayCyclesChange={setDisplayCycles}
            showSpeedLines={showSpeedLines}
            onShowSpeedLinesChange={setShowSpeedLines}
            hasActiveProject={!!intersections && intersections.length > 0}
            isExampleProject={intersections ? gwIsExample : undefined}
        />
    );

    // Modales communes à l'écran d'accueil et à la fenêtre de travail.
    const createDialog = (
        <CreateGreenWaveDialog
            isOpen={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onConfirm={handleCreateGreenWaveLocal}
            getAllSaves={listCachedProjectSaves}
            loadProjectData={readCachedProject}
        />
    );
    // Aide : modale locale qui réutilise le composant HelpContent partagé avec
    // l'app principale, focalisée sur le chapitre Onde verte à l'ouverture.
    const helpModal = (
        <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Aide - TraCflux" className="modal-wide">
            <HelpContent initialAnchor="help-onde-verte" />
        </Modal>
    );
    const restoreModal = showRestoreModal && (
        <GreenWaveRestoreModal
            entries={restoreList}
            selectedName={selectedRestoreName}
            onSelect={setSelectedRestoreName}
            onRestore={handleRestoreSelected}
            onClose={() => setShowRestoreModal(false)}
        />
    );

    if (!intersections) {
        // Distinction entre « chargement en cours » (URL contient ?id=...) et
        // « aucune onde verte ouverte » (URL sans id). Dans le second cas,
        // on affiche un écran d'accueil avec la barre de menu accessible
        // pour que l'utilisateur déclenche Fichier > Nouveau ou Ouvrir.
        const gwParams = new URLSearchParams(window.location.search);
        const hasUrlId = gwParams.has('id') || gwParams.get('example') === 'ondeverte';
        if (hasUrlId) {
            return (
                <div className="green-wave-page">
                    <div className="green-wave-loading">
                        Chargement des données...
                    </div>
                </div>
            );
        }
        return (
            <div className="green-wave-page">
                {menuBar}
                <div className="gw-welcome-screen">
                    <p className="gw-welcome-hint">
                        Aucune onde verte ouverte.<br/>
                        Choisissez <strong>Fichier → Nouveau</strong> pour en créer une à partir de vos projets sauvegardés,
                        ou <strong>Fichier → Ouvrir</strong> pour charger un fichier <code>.json</code> existant.
                    </p>
                    {showExampleInvite && (
                    <p className="gw-welcome-hint">
                        Première visite ?{' '}
                        <button
                            type="button"
                            className="welcome-example-link"
                            onClick={() => window.open(`${window.location.pathname}?greenwave&example=ondeverte`, '_blank')}
                        >
                            Découvrir avec une onde verte exemple
                        </button>
                        {' '}(s'ouvre dans une nouvelle fenêtre).
                    </p>
                    )}
                </div>

                {/* Modales nécessaires sur l'écran d'accueil pour pouvoir
                    déclencher Nouveau / Aide en ligne / À propos. */}
                {createDialog}
                {helpModal}
                {showAboutModal && <GreenWaveAboutModal onClose={() => setShowAboutModal(false)} />}
                {restoreModal}
            </div>
        );
    }

    return (
        <div className="green-wave-page">
            {menuBar}
            {gwIsExample && (
                <div className="example-banner" role="status">
                    🧪 Onde verte exemple — librement modifiable, mais <strong>non enregistrable</strong> (sauvegarde et stockage désactivés). Faites <strong>Fichier → Nouveau</strong> pour démarrer la vôtre.
                </div>
            )}
            <div className="green-wave-page-header">
                <h1>
                    Onde Verte
                    {greenWaveName && <span className="folder-name">- {greenWaveName}</span>}
                </h1>
                {intersections?.[0]?.pfTabs && intersections[0].pfTabs.length > 0 && (
                    <select
                        className="green-wave-pf-select"
                        value={intersections[0].selectedPfId || 1}
                        onChange={(e) => handleGlobalPfChange(parseInt(e.target.value))}
                        title="Changer le plan de feu pour tous les carrefours (par nom ou durée de cycle)"
                    >
                        {intersections[0].pfTabs.map(pf => (
                            <option key={pf.id} value={pf.id}>
                                {pf.name}{pf.cycleLength ? ` (${pf.cycleLength}s)` : ''}
                            </option>
                        ))}
                    </select>
                )}
                <div className="green-wave-controls">
                    <label style={{ color: '#8BC34A' }}>
                        V. mont :
                        <input
                            type="number"
                            value={speedUp}
                            onChange={(e) => setSpeedUp(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                    <label style={{ color: '#FF9800' }}>
                        V. desc :
                        <input
                            type="number"
                            value={speedDown}
                            onChange={(e) => setSpeedDown(parseInt(e.target.value) || 50)}
                            min="10"
                            max="130"
                            style={{ width: '40px' }}
                        />
                        km/h
                    </label>
                </div>
            </div>

            <div className="green-wave-diagram-scroll">
                <GreenWaveDiagram
                    intersections={intersections}
                    geometry={geometry}
                    bandwidthData={bandwidthData}
                    displayCycles={displayCycles}
                    pixelsPerSecond={pixelsPerSecond}
                    speedUpMps={speedUpMps}
                    speedDownMps={speedDownMps}
                    showSpeedLines={showSpeedLines}
                    speedLineOffsetUp={speedLineOffsetUp}
                    speedLineOffsetDown={speedLineOffsetDown}
                    dragging={dragging}
                    onSpeedLineMouseDown={handleSpeedLineMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    isHovered={isOndeVerteHovered}
                />
            </div>

            <GreenWaveLegend speedUp={speedUp} speedDown={speedDown} bandwidthData={bandwidthData} />

            {/* Parameters panel — rendu inline ou en popup détachée */}
            {!dataTableIsDetached && dataPanel}

            {/* Modale « À propos » de la fenêtre Onde verte */}
            {showAboutModal && <GreenWaveAboutModal onClose={() => setShowAboutModal(false)} showCredits />}

            {/* Création d'une nouvelle onde verte dans la fenêtre courante */}
            {createDialog}

            {helpModal}

            <AddCarrefourModal
                isOpen={addCarrefourModalOpen}
                candidates={addCarrefourCandidates}
                selected={addCarrefourSelected}
                onSelect={setAddCarrefourSelected}
                onConfirm={confirmAddCarrefour}
                onClose={closeAddCarrefour}
            />

            {/* Changement du dossier relié à un carrefour */}
            <RelinkDossierDialog
                intersection={relinkIdx !== null ? intersections[relinkIdx] ?? null : null}
                onClose={() => setRelinkIdx(null)}
                onConfirm={(updated) => {
                    const idx = relinkIdx;
                    setRelinkIdx(null);
                    setIntersections(prev => prev!.map((it, i) => (i === idx ? updated : it)));
                }}
                listProjects={() => listCachedProjectSaves().map(save => save.name)}
                loadProjectData={readCachedProject}
            />

            {restoreModal}
        </div>
    );
};

export default GreenWavePage;
