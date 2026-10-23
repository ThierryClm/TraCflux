import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useBooleenMemorise, usePrefsInfobulles } from './hooks/usePreferencesEspaceTravail';
import { useImpressionDossier, useMiseEnPageImpression } from './hooks/useImpressionDossier';
import { recalerCurseur } from './simulation/curseur';
import { useTrafficLight } from './hooks/useTrafficLight';
import { MAX_PF, mergePfFromProject } from './utils/pfHelpers';
import { useAuth } from './hooks/useAuth';
import TimelineDiagram from './components/TimelineDiagram';
import ToastContainer from './components/ToastContainer';
import { toast, getToastPrefs, setToastPref } from './utils/toast';
import { groupesSurlignesParAction } from './utils/groupesAction';
import GroupTable from './components/GroupTable';
import TrafficTable from './components/TrafficTable';
import IntergreenMatrix from './components/IntergreenMatrix';
import CapacityComparison from './components/CapacityComparison';
import ConflictList from './components/ConflictList';
import DiagnosticPanel from './components/DiagnosticPanel';
import ExportPfModal from './components/ExportPfModal';
import ImportPfModal from './components/ImportPfModal';
import CopyMatrixModal from './components/CopyMatrixModal';
import DiagramLegend from './components/DiagramLegend';
import { parseDiagfeux } from './utils/diagfeuxImporter';
import MenuBar from './components/MenuBar';
import { useConfirm, useAlert } from './components/ConfirmProvider';
import { buildExportFilename } from './utils/exportFilename';
import { isExampleSession } from './utils/exampleMode';
import { useModeExemple, useChargementDemarrage } from './hooks/useModeExemple';
import LoginModal from './components/LoginModal';
import UserManagerModal from './components/UserManagerModal';
import ExternalLinksModal from './components/ExternalLinksModal';
import PropertiesPanel from './components/PropertiesPanel';
import { calculateSimulatedDiagram, sectionsScenariosInitiales } from './simulation';
import usePopupWindow from './hooks/usePopupWindow';
import useFloatingLegend from './hooks/useFloatingLegend';
import useFloatingMatrix from './hooks/useFloatingMatrix';
import useDarkMode from './hooks/useDarkMode';
import useRecentDirectories from './hooks/useRecentDirectories';
import useUILayout from './hooks/useUILayout';
import useProjectModification from './hooks/useProjectModification';
import usePhasageBulleUI from './hooks/usePhasageBulleUI';
import useRecentFiles from './hooks/useRecentFiles';
import useSimulationUI from './hooks/useSimulationUI';
import useDialogState from './hooks/useDialogState';
import useDialoguesApp from './hooks/useDialoguesApp';
import useFloatingImage from './hooks/useFloatingImage';
import useIntersectionDisplayOptions from './hooks/useIntersectionDisplayOptions';
import { CROP_BASIS, DEFAULT_CROP, DEFAULT_ZOOM } from './utils/floatingImageBox';
import useDirectoryHandles from './hooks/useDirectoryHandles';
import useFloatingImageRenderer from './hooks/useFloatingImageRenderer';
import useFloatingForm from './hooks/useFloatingForm';
import useFloatingProperties from './hooks/useFloatingProperties';
import useFloatingDiagnostic from './hooks/useFloatingDiagnostic';
import useFloatingTraffic from './hooks/useFloatingTraffic';
import useFloatingRemarks from './hooks/useFloatingRemarks';
import RemarquesEditor from './components/RemarquesEditor';
import useFileOperations from './hooks/useFileOperations';
import useImportOperations from './hooks/useImportOperations';
import WelcomeScreen from './components/app/WelcomeScreen';
import ProjectHeader from './components/app/ProjectHeader';
import DossierPrintDialog from './components/app/DossierPrintDialog';
import PrintPreviewModal from './components/app/PrintPreviewModal';
import DiagramEditDialogs from './components/app/DiagramEditDialogs';
import ProjectOpenDialog from './components/app/ProjectOpenDialog';
import ImportDialogs from './components/app/ImportDialogs';
import GreenWaveDialogs from './components/app/GreenWaveDialogs';
import WorkspaceSidebar from './components/app/WorkspaceSidebar';
import WorkspaceMain from './components/app/WorkspaceMain';
import SupportDialogs from './components/app/SupportDialogs';

import './components/GroupTable.css';
import './components/IntergreenMatrix.css';
import './App.css';
import { lireMiseEnPage, appliquerMiseEnPage, affichageCommentairesRemarques } from './utils/miseEnPageProjet';
import { estAffiche, planACommentaires, planADescriptions, texteRenseigne } from './utils/modeAffichage';
import { entier } from './utils/entier';
import type { ChampsProjet } from './hooks/useTrafficLight';
import type { GreenWaveProjectSource, SavedGreenWave } from './types/greenWave';
import type { CreatedIntersection } from './components/CreateGreenWaveDialog';
import type { TrafficConflict } from './utils/conflictUtils';
import type { HoveredConflict } from './components/ConflictList';
import type { VertUtileSurvole } from './components/TimelineDiagram';
import SuggestionCycleDialog from './components/SuggestionCycleDialog';
import NouveauPlanDialog from './components/NouveauPlanDialog';

/** Options d'un export PNG de section (cf. exportSectionAsPng). */
interface OptionsExportPng {
    /** Prépare la vue avant la capture ; renvoie de quoi la restaurer. */
    beforeCapture?: () => (() => void) | void;
    /** Capturer le diagramme sur toute sa largeur, au-delà de la zone visible. */
    fullTimeline?: boolean;
    /** Retouche du DOM cloné, juste avant la capture. */
    onCloneExtra?: (clonedDoc: Document, clonedEl: HTMLElement | null) => void;
}

/** Sections de l'application dont les infobulles peuvent être coupées. */

function App() {
    const askConfirm = useConfirm();
    const showAlert = useAlert();
    // Champs de projet portés par d'autres modules que le modèle : ils doivent
    // voyager avec le dossier plutôt que rester des préférences d'application.
    // Réf parce que ces modules sont créés plus bas ; elle n'est lue qu'à
    // l'enregistrement et à l'ouverture.
    const champsProjetRef = useRef<ChampsProjet>({ lire: () => ({}), ecrire: () => {} });

    const {
        intersectionName,
        setIntersectionName,
        groups,
        setGroupCount,
        cycleLength,
        setCycleLength,
        setMatrixValue,
        conflictMatrix,
        conflicts,
        globalTime,
        updateGroupParams,
        moveGroupToPosition,
        saveProject,
        loadProject,
        getAllSaves,
        getProjectData,
        getFullState,
        loadFullState: loadFullStateRaw,
        resetToNewProject,
        actionData,
        updateActionRow,
        ajouterActions,
        reorderActions,
        microCustomFields,
        updateMicroCustomField,
        phasageBulleCount,
        phasageBulleTimes,
        setPhasageBulleCount,
        setPhasageBulleTimes,
        phasageCycle,
        setPhasageCycle,
        phasageBubbleScale,
        phasageEllipseScale,
        setPhasageBubbleScale,
        setPhasageEllipseScale,
        phasageBubbleRatio,
        setPhasageBubbleRatio,
        pfTabs,
        activePFId,
        setActivePFId,
        duplicatePF,
        nouveauPF,
        deletePF,
        renamePF,
        setPFColor,
        updatePFRemarques,
        reorderPF,
        currentRemarques,
        undo,
        redo,
        canUndo,
        canRedo,
        startDrag,
        endDrag,
        slideAllGroups,
        insertTime,
        reduceTime,
        simulationEnabled,
        setSimulationEnabled,
        simulationSelectedActions,
        simulationName,
        simulationScenarios,
        choisirScenarioSimulation,
        creerScenarioSimulation,
        enregistrerScenarioSimulation,
        supprimerScenarioSimulation,
        toggleSimulationAction,
        intersectionImage,
        setIntersectionImage,
        intersectionArrows,
        setIntersectionArrows,
        imageBrightness,
        setImageBrightness,
        imageContrast,
        setImageContrast,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        trafficDatasets,
        trafficDatasetNames,
        trafficDatasetSourceNames,
        copyTrafficDataset,
        addCustomTrafficDataset,
        infoSuppressionJeuTrafic,
        supprimerJeuTrafic,
        pfTrafficDatasetMap,
        capacityCompareSelection,
        setCapacityCompareSelection,
        capacityCompareDataset,
        setCapacityCompareDataset,
        dependencyGap,
        setDependencyGap,
        biCarrefourSeparator,
        setBiCarrefourSeparator,
        matricesLocked,
        setMatricesLocked,
        dossierReadOnly,
        activePfReadOnly,
        applyMergedPf,
        copyMatrixFromPF,
        actionColWidths,
        setActionColWidths,
        externalLinks,
        setExternalLinks,
        projectProperties,
        updateProjectProperty,
        projectName,
        setProjectName,
        appCommunes,
        appMoaLogos,
        appMoeLogos
    } = useTrafficLight({ askConfirm, showAlert, champsProjetRef });

    // Update yellow/orange duration for VL and B groups when horsAgglomeration changes
    useEffect(() => {
        const orangeValue = projectProperties.horsAgglomeration ? 5 : 3;
        groups.forEach(g => {
            if ((g.type === 'V' || g.type === 'VL' || g.type === 'B' || g.type === 'TC') && g.durations.orange !== orangeValue) {
                updateGroupParams(g.id, { durations: { orange: orangeValue } });
            }
        });
    }, [projectProperties.horsAgglomeration]); // eslint-disable-line react-hooks/exhaustive-deps

    const [dragConflictsFromDiagram, setDragConflictsFromDiagram] = useState<TrafficConflict[] | null>(null);

    // Filter conflicts to exclude those managed by SELECTED Escamotage actions (in simulation mode)
    const filteredConflicts = useMemo(() => {
        if (!simulationEnabled || !simulationSelectedActions || simulationSelectedActions.length === 0) {
            return conflicts;
        }

        // Get selected Escamotage actions
        const selectedEscamotageGroup = actionData.filter(action =>
            action.action === 'Escamotage' && action.gf && action.actGf1 &&
            simulationSelectedActions.includes(action.id)
        );

        if (selectedEscamotageGroup.length === 0) {
            return conflicts;
        }

        // Filter out conflicts that are managed by selected Escamotage actions
        return conflicts.filter(c => {
            const isInhibitedByEscamotage = selectedEscamotageGroup.some(action => {
                const sourceGfId = entier(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const targetGfId = entier(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                return (sourceGfId === c.from && targetGfId === c.to) ||
                       (sourceGfId === c.to && targetGfId === c.from);
            });
            return !isInhibitedByEscamotage;
        });
    }, [conflicts, simulationEnabled, simulationSelectedActions, actionData]);

    // Further filter: separate conflicts involving groups with phaseFlag (aiguillage/escamotage)

    // During drag, use drag conflicts from TimelineDiagram; otherwise use normal conflicts
    const displayConflicts = dragConflictsFromDiagram || filteredConflicts;
    const displayActiveConflicts = useMemo(() => {
        return (dragConflictsFromDiagram || filteredConflicts).filter(c => {
            const fromGroup = groups.find(g => g.id === c.from);
            return !fromGroup?.phaseFlag;
        });
    }, [dragConflictsFromDiagram, filteredConflicts, groups]);

    // Check if a conflict's first group has phaseFlag (for grayed display)
    const isConflictGrayed = useCallback((c: { from: number }) => {
        const fromGroup = groups.find(g => g.id === c.from);
        return !!fromGroup?.phaseFlag;
    }, [groups]);

    // Authentification
    const {
        currentUser,
        isAuthenticated,
        isLoading: authLoading,
        hasUsers,
        login,
        logout,
        createUser,
        updateUser,
        deleteUser,
        resetPassword,
        hasPermission,
        accountsEnabled,
        activerComptes,
        desactiverComptes,
        getUsersList,
        exportUsersToFile,
        importUsersFromFile
    } = useAuth();

    // États des fenêtres de dialogue (utilisateurs, aide, diagnostic,
    // comparateur, ouverture et import de projets, onde verte).
    const {
        showUserManager, setShowUserManager,
        helpAnchor, setHelpAnchor,
        aboutModal, setAboutModal,
        diagnosticModal, setDiagnosticModal,
        capacityCompareModal, setCapacityCompareModal,
        diagnosticIncludeProject, setDiagnosticIncludeProject,
        diagnosticMaskNames, setDiagnosticMaskNames,
        diagnosticRefresh, setDiagnosticRefresh,
        selectedProject, setSelectedProject,
        importFile, setImportFile,
        importError, setImportError,
        importHintDir, setImportHintDir,
        showExportPfModal, setShowExportPfModal,
        showCopyMatrixModal, setShowCopyMatrixModal,
        importPfData, setImportPfData,
        selectedGreenWave, setSelectedGreenWave,
        greenWaveData, setGreenWaveData,
        setGreenWaveListKey
    } = useDialoguesApp();

    const [, setSelectedGroupId] = useState<number | null>(null);
    const {
        pixelsPerSecond, setPixelsPerSecond,
        activeTab, setActiveTab,
        sidebarWidth, setSidebarWidth,
        isResizing,
        splitViewRef,
        sidebarVisible, setSidebarVisible,
        handleResizeStart,
        diagramHeight, setDiagramHeight,
        isResizingDiagram,
        diagramAreaRef,
        resetDiagramHeight,
        handleDiagramResizeStart,
        handleActionPanelResize
    } = useUILayout();
    const [showDependencies, setShowDependencies] = useState(false);
    const [hoveredActionId, setHoveredActionId] = useState<number | null>(null);
    const [showMicroOnHover, setShowMicroOnHover] = useState(true);
    const [toastPrefs, setToastPrefsState] = useState(getToastPrefs());
    const [openPropertiesOnNewProject, setOpenPropertiesOnNewProject] = useState(() => {
        const saved = localStorage.getItem('openPropertiesOnNewProject');
        return saved === null ? true : saved === 'true';
    });
    const [showWrapFlash, setShowWrapFlash] = useState(() => {
        const saved = localStorage.getItem('showWrapFlash');
        return saved === null ? true : saved === 'true';
    });
    // Préférences « Infobulles... » (Mise en page), mémorisées dans le navigateur.
    const { tooltipPrefs, setTooltipPref } = usePrefsInfobulles();
    // Helper local : utilise tooltipPrefs.main pour les title= de App.tsx.
    const tip = (text: string | undefined) => tooltipPrefs.main ? text : undefined;
    const [showSaveReminder, setShowSaveReminder] = useState(() => {
        const saved = localStorage.getItem('showSaveReminder');
        return saved === null ? true : saved === 'true';
    });
    // Au lancement, l'app est « vide » : pas de projet chargé, l'interface
    // principale est masquée et seul le menu reste accessible. Devient true
    // dès que l'utilisateur déclenche « Nouveau projet » ou ouvre un projet.
    const [hasActiveProject, setHasActiveProject] = useState(false);
    // Projet exemple et invitation de l'écran d'accueil (cf. hooks/useModeExemple).
    const { showExampleInvite, isExample, leaveExampleMode, loadFullState } = useModeExemple(loadFullStateRaw);
    const projectNameInputRef = useRef<HTMLInputElement>(null);
    // Référence vers la fenêtre Onde verte ouverte (single instance).
    // Permet de ré-utiliser la même fenêtre au lieu d'en ouvrir une nouvelle
    // à chaque clic. Si la fenêtre est fermée par l'utilisateur, .closed
    // passe à true et on ouvre une nouvelle.
    const greenWaveWindowRef = useRef<Window | null>(null);

    // Ouvre la fenêtre Onde verte à l'URL fournie, ou y bascule le focus si
    // elle est déjà ouverte. Si l'URL diffère, navigue dedans (l'auto-save
    // ayant déjà persisté l'état courant).
    const openOrFocusGreenWave = (url: string) => {
        try {
            if (greenWaveWindowRef.current && !greenWaveWindowRef.current.closed) {
                // Fenêtre déjà ouverte : focus + navigation si URL différente
                try {
                    if (greenWaveWindowRef.current.location.href !== url) {
                        greenWaveWindowRef.current.location.href = url;
                    }
                } catch {
                    // Cross-origin (improbable, même origine) : on tente la nav directe
                    greenWaveWindowRef.current.location.href = url;
                }
                greenWaveWindowRef.current.focus();
                return;
            }
        } catch {
            // ref invalide, on rouvre
        }
        const w = window.open(url, 'tracflux-onde-verte');
        if (w) greenWaveWindowRef.current = w;
    };
    const printPreviewPageRef = useRef<HTMLDivElement>(null);

    // Intersection image animation state
    const {
        isPlayingSimulation, setIsPlayingSimulation,
        simulationCurrentTime, setSimulationCurrentTime,
        hoveredDiagramTime, setHoveredDiagramTime,
        simulationSpeed, cycleSimulationSpeed
    } = useSimulationUI();
    const [hoveredArrowGroupId, setHoveredArrowGroupId] = useState<number | null>(null);
    // Action survolée dans le panneau de simulation : ses flèches (groupe et
    // plage) s'allument dans l'image du carrefour.
    const [survolActionSimulation, setSurvolActionSimulation] = useState<number | null>(null);
    const [hoveredArrowGroupSaturated, setHoveredArrowGroupSaturated] = useState(false);
    const [hoveredConflict, setHoveredConflict] = useState<HoveredConflict | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const {
        darkMode, colorTheme, setColorTheme,
        commentsMode, setCommentsMode,
        remarksMode, setRemarksMode,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram,
        descriptionMode, setDescriptionMode
    } = useDarkMode();
    // Affichage effectif pour le plan de feux courant : en mode automatique,
    // seulement si ce plan a des commentaires (resp. une remarque).
    const showComments = estAffiche(commentsMode, planACommentaires(groups));
    const showRemarks = estAffiche(remarksMode, texteRenseigne(currentRemarques));
    // Colonne Description des conditions : en automatique, seulement si une
    // condition du plan courant a une description.
    const showActionDescription = estAffiche(descriptionMode, planADescriptions(actionData));
    // Une description proposée d'office (point de repos) ne doit pas rester
    // invisible : Masquer passe en Automatique, les autres choix sont gardés.
    const revelerDescription = useCallback(() => {
        setDescriptionMode(mode => (mode === 'masquer' ? 'auto' : mode));
    }, [setDescriptionMode]);

    // Cases d'affichage de l'image du carrefour (numéros, noms, ajout de
    // flèches) : enregistrées avec le projet, cf. champsProjetRef. Leur
    // changement compte comme une modification du projet.
    const { intersectionDisplay, setIntersectionDisplayOption } = useIntersectionDisplayOptions();

    // Track whether project has been modified (for "Nouveau projet" menu)
    const { projectModified, setProjectModified, projectModifiedSkip, hasUnsavedChanges, isDirty, setHasUnsavedChanges, absorbDerivedChanges } =
        useProjectModification([groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName, capacityCompareSelection, capacityCompareDataset, intersectionDisplay,
            // Enregistrés dans le projet : les changer est une modification.
            commentsMode, remarksMode, descriptionMode]);

    // Passer d'un plan de feux à un autre n'est pas une modification du projet :
    // l'écran recharge les groupes, le cycle, la matrice et les actions du plan
    // choisi, et ces recopies ne doivent pas faire apparaître l'astérisque.
    const selectActivePF = useCallback((pfId: number) => {
        if (pfId !== activePFId) absorbDerivedChanges();
        setActivePFId(pfId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePFId, setActivePFId]);

    // Update document title (browser tab) to reflect project name and unsaved status.
    // Sur l'écran d'accueil (aucun projet ouvert), on affiche juste
    // « Diagramme de Feux » sans le nom de carrefour par défaut. C'est
    // hasActiveProject qui fait foi : intersectionName reste à
    // « Nouveau Carrefour » par défaut, ce qui ne reflète pas l'absence
    // de projet ouvert.
    useEffect(() => {
        if (!hasActiveProject) {
            document.title = 'Diagramme de Feux';
            return;
        }
        const prefix = isDirty ? '* ' : '';
        const name = projectName || intersectionName;
        document.title = `${prefix}${name} — Diagramme de Feux`;
    }, [hasActiveProject, projectName, intersectionName, isDirty]);

    // Deep link vers une section de l'aide : si l'URL contient
    // ?openHelp=ondeVerte (ouvert depuis la fenêtre Onde verte), on ouvre
    // automatiquement la modale d'aide et on délègue le scroll vers le
    // chapitre Onde verte à <HelpContent /> via la prop initialAnchor.
    // L'anchor ciblé est <h3 id="help-onde-verte">.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const target = params.get('openHelp');
        if (!target) return;
        const anchorId = target === 'ondeVerte' ? 'help-onde-verte' : null;
        setHelpAnchor(anchorId);
        setHelpModal(true);
    }, []);

    // Save reminder: when isDirty becomes true, start a 10-minute inactivity timer.
    // Any new modification resets the timer. On timeout, show a discreet toast.
    useEffect(() => {
        if (!showSaveReminder || !isDirty) return;
        const timer = setTimeout(() => {
            toast.info('Pensez à sauvegarder vos modifications');
        }, 10 * 60 * 1000); // 10 minutes
        return () => clearTimeout(timer);
    }, [isDirty, projectName, intersectionName, groups, actionData, cycleLength, conflictMatrix, projectProperties, showSaveReminder]);

    // Nom du PF actif, repris dans le titre de chaque fenêtre détachée.
    const activePFName = pfTabs.find(pf => pf.id === activePFId)?.name || '';

    // Floating matrix state
    const {
        showFloatingMatrix,
        setShowFloatingMatrix,
        matrixPopup
    } = useFloatingMatrix(groups.length, activePFName, matricesLocked);

    // Floating form state
    const {
        showFloatingForm,
        setShowFloatingForm,
        formPopup
    } = useFloatingForm(groups.length, activePFName);

    // Floating properties state
    const {
        showFloatingProperties,
        setShowFloatingProperties,
        propertiesPopup
    } = useFloatingProperties(activePFName);

    // Floating diagnostic state
    const {
        showFloatingDiagnostic,
        setShowFloatingDiagnostic,
        diagnosticPopup
    } = useFloatingDiagnostic(activePFName);

    // Floating traffic state
    const {
        showFloatingTraffic,
        setShowFloatingTraffic,
        trafficPopup
    } = useFloatingTraffic(groups.length, activePFName);

    // Floating remarques state (notes du PF actif, projection sur 2e écran)
    const {
        showFloatingRemarks,
        setShowFloatingRemarks,
        remarquesPopup
    } = useFloatingRemarks(activePFName);

    // Légende : état d'affichage. Le drag interne n'est plus nécessaire depuis
    // qu'elle est une vraie fenêtre détachée (usePopupWindow, déplaçable sur un
    // autre écran) — cf. legendPopup ci-dessous.
    const {
        showFloatingLegend,
        setShowFloatingLegend
    } = useFloatingLegend();

    // Fenêtres des conditions et des variables (remontées d'ActionTable pour
    // le menu), miroir du diagramme, liste des conflits détachée, panneau
    // « Réserve de capacité » (coché par défaut ; menu Mise en page).
    // Persistés au niveau application (localStorage) — préférence d'espace de
    // travail qui ne voyage pas avec le projet.
    const [showFloatingConditions, setShowFloatingConditions] = useBooleenMemorise('floating_conditions_visible', false);
    const [showFloatingVariables, setShowFloatingVariables] = useBooleenMemorise('floating_variables_visible', false);
    const [showFloatingDiagram, setShowFloatingDiagram] = useBooleenMemorise('floating_diagram_visible', false);
    const [showFloatingConflicts, setShowFloatingConflicts] = useBooleenMemorise('floating_conflicts_visible', false);
    const [showCapacityReserve, setShowCapacityReserve] = useBooleenMemorise('show_capacity_reserve', true);

    // V.Utile hover state: { groupId, vUtile } when hovering V.Utile cell
    const [hoveredVUtile, setHoveredVUtile] = useState<VertUtileSurvole | null>(null);

    // Phasage bulle state (phasageBulleCount and phasageBulleTimes come from useTrafficLight hook - saved per PF)
    const {
        phasageBulleEnabled, setPhasageBulleEnabled,
        phasageBulleModal, setPhasageBulleModal,
        phasageBulleVisibleGroups, setPhasageBulleVisibleGroups,
        phasageBulleVersion, setPhasageBulleVersion,
        hoveredPhasageGroupId, setHoveredPhasageGroupId,
        togglePhasageBulleGroup
    } = usePhasageBulleUI(intersectionArrows);

    // Floating image state (visibilité, recadrage, zoom, popup)
    const {
        showFloatingImage, setShowFloatingImage, openFloatingImage,
        floatingCrop, setFloatingCrop, markLegacyCrop,
        showCropControls, setShowCropControls,
        floatingZoom, setFloatingZoom,
        imageNaturalDims,
        imageFondClair,
        floatingImagePopup
    } = useFloatingImage(intersectionImage, intersectionName, activePFName, intersectionArrows);

    // Rognage et zoom de l'image détachée décrivent UN cadrage sur UNE image :
    // ils suivent le projet, jamais le navigateur. Tout changement de projet
    // qui ne porte pas son propre cadrage repart donc du cadrage neutre.
    const resetFloatingImageFraming = useCallback(() => {
        setFloatingCrop({ ...DEFAULT_CROP });
        setFloatingZoom(DEFAULT_ZOOM);
        markLegacyCrop(false);
    }, [setFloatingCrop, setFloatingZoom, markLegacyCrop]);

    // Taille du contenu du comparateur, annoncée par le composant lui-même à
    // chaque mise en page. La fenêtre s'y ajuste, au lieu de rester au gabarit
    // fixe qui laissait un grand vide sous un tableau court.
    const [tailleComparateur, setTailleComparateur] = useState<{ width: number; height: number } | null>(null);
    const noterTailleComparateur = useCallback((taille: { width: number; height: number }) => {
        // Le seuil coupe la boucle : redimensionner la fenêtre relance une mise
        // en page, donc une mesure, à un ou deux pixels près.
        setTailleComparateur(prec => (prec
            && Math.abs(prec.width - taille.width) < 4
            && Math.abs(prec.height - taille.height) < 4) ? prec : taille);
    }, []);

    // Fenêtre détachée (non modale, déplaçable) du comparateur de capacité.
    const capacityComparisonPopup = usePopupWindow({
        geometryKey: 'capacityComparison',
        isOpen: capacityCompareModal,
        onClose: () => setCapacityCompareModal(false),
        title: 'Comparer la capacité des plans de feu',
        width: 920,
        height: 620,
        contentSize: capacityCompareModal ? tailleComparateur : null
    });

    // Miroir de présentation du diagramme (fenêtre détachée, lecture seule).
    // Liste des conflits en fenêtre détachée.
    const conflictsPopup = usePopupWindow({
        geometryKey: 'conflicts',
        isOpen: showFloatingConflicts,
        onClose: () => setShowFloatingConflicts(false),
        title: `Conflits${activePFName ? ` — ${activePFName}` : ''}`,
        width: 460,
        height: 420
    });

    // Légende du diagramme en fenêtre détachée (déplaçable sur un autre écran).
    const legendPopup = usePopupWindow({
        geometryKey: 'legend',
        isOpen: showFloatingLegend,
        onClose: () => setShowFloatingLegend(false),
        title: 'Légende du diagramme',
        width: 380,
        height: 580
    });

    // Diagram arrow style
    const [diagramArrowStyle, setDiagramArrowStyle] = useState('solid');



    // Hors simulation, rien : le panneau peut disparaître sous la souris sans
    // recevoir la fin du survol.
    const flechesActionSimulation = useMemo(
        () => !simulationEnabled || survolActionSimulation === null
            ? []
            : groupesSurlignesParAction(actionData.find(a => a.id === survolActionSimulation), groups, cycleLength),
        [simulationEnabled, survolActionSimulation, actionData, groups, cycleLength]);

    // Calculate simulated diagram when in simulation mode
    const simulationResult = useMemo(() => {
        if (!simulationEnabled) return null;
        return calculateSimulatedDiagram(
            groups,
            actionData,
            simulationSelectedActions,
            cycleLength,
            conflictMatrix
        );
    }, [simulationEnabled, groups, actionData, simulationSelectedActions, cycleLength, conflictMatrix]);

    // Quand la simulation change (case cochée ou décochée, scénario, durée de
    // repos), le curseur reste au même instant du cycle d'origine
    // (cf. simulation/curseur). Avant l'affichage, pour qu'il ne saute pas.
    const simulationPrecedente = useRef<{ resultat: typeof simulationResult; plan: number | null }>({ resultat: null, plan: null });
    useLayoutEffect(() => {
        const { resultat: avant, plan } = simulationPrecedente.current;
        simulationPrecedente.current = { resultat: simulationResult, plan: activePFId };
        if (!avant || !simulationResult || plan !== activePFId) return;
        if (avant.journal === simulationResult.journal) return;
        setSimulationCurrentTime(t => recalerCurseur(t, avant.journal, simulationResult.journal, simulationResult.simulatedCycleLength));
    }, [simulationResult, activePFId, setSimulationCurrentTime]);

    // Déclaré APRÈS simulationResult : son titre affiche le cycle simulé,
    // et un `const` n'est pas accessible avant son initialisation.
    const diagramPopup = usePopupWindow({
        geometryKey: 'diagram',
        isOpen: showFloatingDiagram,
        onClose: () => setShowFloatingDiagram(false),
        // Le miroir n'affiche plus sa ligne de titre : elle est ici, donc
        // lisible aussi dans la barre du navigateur et sur une fenêtre reléguée
        // en arrière-plan. Le cycle suit la simulation quand elle tourne.
        title: `Diagramme${simulationEnabled && simulationName ? ` (${simulationName})` : ''}${activePFName ? ` — ${activePFName}` : ''} · Cycle ${(simulationEnabled && simulationResult?.simulatedCycleLength) || cycleLength} s`,
        width: 1180,
        height: 620
    });

    // Local input states for validation on Enter/blur
    const [groupCountInput, setGroupCountInput] = useState(groups.length.toString());
    const [cycleLengthInput, setCycleLengthInput] = useState(cycleLength.toString());
    // Suggestion de durée du cycle (menu Diagramme) : possible dès que le plan
    // affiché a du trafic dans son jeu.
    const [suggestionCycleModal, setSuggestionCycleModal] = useState(false);
    // Nouveau plan de feu (menu Diagramme) : choix du jeu de trafic du plan créé.
    const [nouveauPlanModal, setNouveauPlanModal] = useState(false);
    const jeuxAvecDonnees = useMemo(() => trafficDatasetNames.filter(n =>
        Object.values(trafficDatasets[n] || {}).some(d => (Number(d?.trafficVol) || 0) > 0)), [trafficDatasetNames, trafficDatasets]);
    const traficRenseigne = useMemo(() => groups.some(g => (Number(getTrafficData(g.id)?.trafficVol) || 0) > 0), [groups, getTrafficData]);

    // Mise en page du dossier imprimé : orientation, largeur de la feuille,
    // largeurs relevées sur le tableau des conditions (cf. hooks/useImpressionDossier).
    const {
        dossierPortrait, setDossierPortrait, dossierPrintWidth,
        microPrintStyle, descriptionPrintStyle, mesurerColonnesImpression, largeurConditionsImpression
    } = useMiseEnPageImpression({ actionColWidths, activeTab, simulationEnabled, phasageBulleEnabled });

    // Saisie du phasage bulle : brouillon, validé au clic sur OK.
    //
    // Les instants et le nombre de phases s'écrivaient à chaque frappe. « Annuler »
    // ne restaurait donc rien et « OK » ne validait rien : les deux se contentaient
    // de fermer le panneau. Le brouillon rend ces deux boutons conformes à leur nom.
    // null = rien de modifié : le panneau affiche alors les valeurs du plan.
    const [brouillonPhasage, setBrouillonPhasage] = useState<{ count: number; times: number[] } | null>(null);

    // Y a-t-il quelque chose à abandonner ? Le brouillon naît au premier
    // événement de saisie, y compris quand la valeur retapée est la même :
    // sa seule existence ne suffit donc pas, il faut le comparer au plan.
    const phasageModifie = (() => {
        if (!brouillonPhasage) return false;
        const count = brouillonPhasage.count ?? phasageBulleCount;
        if (count !== phasageBulleCount) return true;
        const times = brouillonPhasage.times ?? phasageBulleTimes;
        // Seuls les instants des phases affichées comptent : ceux au-delà du
        // nombre de phases ne sont ni visibles ni utilisés.
        for (let i = 0; i < count; i++) {
            if ((times[i] || 0) !== (phasageBulleTimes[i] || 0)) return true;
        }
        return false;
    })();

    // Synchronize traffic dataset with active PF tab (only when no saved mapping)
    useEffect(() => {
        if (pfTabs && pfTabs.length > 0 && activePFId) {
            // Si une association PF→dataset est sauvegardée, le wrapper setActivePFId s'en charge
            if (pfTrafficDatasetMap[activePFId]) return;
            // Sinon, fallback : associer au nom du PF si c'est un dataset connu
            const activePF = pfTabs.find(pf => pf.id === activePFId);
            if (activePF && trafficDatasetNames.includes(activePF.name)) {
                setActiveTrafficDataset(activePF.name);
            }
        }
    }, [activePFId, pfTabs, trafficDatasetNames, setActiveTrafficDataset, pfTrafficDatasetMap]);

    // Sync local inputs when actual values change (e.g., after undo/redo or project load)
    useEffect(() => {
        setGroupCountInput(groups.length.toString());
    }, [groups.length]);

    useEffect(() => {
        setCycleLengthInput(cycleLength.toString());
    }, [cycleLength]);

    const { recentFiles, addToRecentFiles, getRecentDirectories, getRecentDirectoriesForMenu } = useRecentFiles();
    const diagfeuxInputRef = useRef<HTMLInputElement>(null);
    const projectPfInputRef = useRef<HTMLInputElement>(null);

    // Import des plans de feux d'un autre projet : lecture + validation, puis
    // ouverture de la modale d'options (lecture seule).
    const handleProjectPfFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || !Array.isArray(parsed.pfTabs) || parsed.pfTabs.length === 0) {
                showAlert({ title: 'Import impossible', message: 'Ce fichier ne contient pas de plans de feux exploitables.' });
                return;
            }
            setImportPfData({ name: file.name.replace(/\.json$/i, ''), state: parsed });
        } catch (err) {
            showAlert({ title: 'Import impossible', message: 'Fichier illisible : ' + (err?.message || err) });
        }
    };

    // Applique la fusion une fois les options confirmées dans la modale.
    const handleImportProjectPf = (selectedIds: number[], readOnly: boolean) => {
        if (!importPfData) return;
        const ids = new Set(selectedIds);
        const filteredImported = {
            ...importPfData.state,
            pfTabs: importPfData.state.pfTabs.filter(p => ids.has(p.id))
        };
        const { state, warnings, error, addedCount = 0 } = mergePfFromProject(getFullState(), filteredImported, { readOnly });
        setImportPfData(null);
        if (error) {
            showAlert({ title: 'Import des plans de feux impossible', message: error });
            return;
        }
        applyMergedPf(state);
        toast.success(`${addedCount} plan${addedCount > 1 ? 's' : ''} de feux importé${addedCount > 1 ? 's' : ''}${readOnly ? ' (lecture seule)' : ''}`);
        if (warnings && warnings.length) {
            showAlert({ title: 'Import — points à vérifier', message: warnings.map(w => '• ' + w).join('\n') });
        }
    };

    // Import d'un projet DiagFeux (.xml) : parse -> loadFullState + avertissements.
    const handleDiagfeuxFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = '';
        if (!file) return;
        {
            const reserve = "L'importateur DiagFeux est en cours de développement : il n'a pas encore été confronté à un fichier .dfe réel, et le résultat demande vérification.";
            const ok = await askConfirm({
                title: 'Importer un projet DiagFeux',
                message: hasActiveProject
                    ? 'Le projet courant sera remplacé par le projet DiagFeux importé.\n\n' + reserve
                    : reserve,
                confirmLabel: 'Importer',
                danger: hasActiveProject
            });
            if (!ok) return;
        }
        try {
            const text = await file.text();
            const { state, warnings, error } = parseDiagfeux(text);
            if (error || !state) {
                showAlert({ title: 'Import DiagFeux impossible', message: error || 'Données illisibles.' });
                return;
            }
            loadFullState(state);
            resetFloatingImageFraming();
            setHasActiveProject(true);
            setCurrentProjectPath(file.name);
            setProjectModified(true);
            projectModifiedSkip.current = true;
            setHasUnsavedChanges(false);
            toast.success(`Projet DiagFeux importé : ${state.projectName}`);
            if (warnings.length) {
                showAlert({
                    title: 'Import DiagFeux — points à vérifier',
                    message: 'Import réalisé. À contrôler :\n\n' + warnings.map(w => '• ' + w).join('\n')
                });
            }
        } catch (err) {
            showAlert({ title: 'Import DiagFeux', message: 'Erreur : ' + (err?.message || err) });
        }
    };

    // Nom du fichier projet ouvert ou enregistré (repris en bas des pages du dossier imprimé)
    const [currentProjectPath, setCurrentProjectPath] = useState<string | null>('');

    // Modal and dialog states
    const {
        openModal, setOpenModal,
        slideModal, setSlideModal,
        insertModal, setInsertModal,
        reduceModal, setReduceModal,
        optionsModal, setOptionsModal,
        microVariablesModal, setMicroVariablesModal,
        helpModal, setHelpModal,
        helpZoneRef,
        importModal, setImportModal,
        slideValue, setSlideValue,
        slideFromGroup, setSlideFromGroup,
        slideToGroup, setSlideToGroup,
        slideTouched, setSlideTouched,
        insertStart, setInsertStart,
        insertDuration, setInsertDuration,
        insertTouched, setInsertTouched,
        reduceStart, setReduceStart,
        reduceDuration, setReduceDuration,
        reduceTouched, setReduceTouched,
        biCarrefourModal, setBiCarrefourModal,
        biCarrefourGroupId, setBiCarrefourGroupId,
        biCarrefourTouched, setBiCarrefourTouched,
        moveGroupModal, setMoveGroupModal,
        groupToMove, setGroupToMove,
        moveAfterGroup, setMoveAfterGroup,
        moveGroupTouched, setMoveGroupTouched,
        importHTMModal, setImportHTMModal,
        htmFile, setHtmFile,
        htmImportError, setHtmImportError,
        importedHTMFiles, setImportedHTMFiles,
        showExternalLinksModal, setShowExternalLinksModal,
        printPreviewModal, setPrintPreviewModal,
        printType, setPrintType,
        dossierDialog, setDossierDialog,
        dossierSections, setDossierSections,
        createGreenWaveModal, setCreateGreenWaveModal,
        openGreenWaveModal, setOpenGreenWaveModal,
        greenWaveViewer, setGreenWaveViewer,
        draggedTabIndex, setDraggedTabIndex
    } = useDialogState();

    // Les cases à cocher du dossier appartiennent au projet : on branche leur
    // lecture et leur écriture sur la sérialisation, plutôt que d'en faire une
    // préférence d'application commune à tous les carrefours.
    // File System Access API - handles de répertoires via IndexedDB
    const {
        lastOpenDirectoryRef,
        lastSaveDirectoryRef,
        lastImportDirectoryRef,
        lastImageDirectoryRef,
        lastGreenWaveDirectoryRef,
        saveDirectoryHandle,
        loadDirectoryHandle
    } = useDirectoryHandles();

    // Liste des 5 derniers répertoires par type (pour affichage dans les menus)
    const {
        recentOpenDirs,
        recentImportDirs,
        recentImageDirs,
        recentSaveDirs,
        recentGreenWaveDirs,
        addRecentDirectory
    } = useRecentDirectories();

    // Les réglages de mise en page appartiennent au projet : cases du dossier
    // d'impression, hauteur du diagramme, cadrage et zoom de l'image détachée,
    // options d'affichage, répertoires de travail. Ils ne vivent pas dans
    // useTrafficLight, d'où cette réf : getFullState la lit au moment
    // d'enregistrer, si bien que le fichier ET le cache les portent — c'est ce
    // second qui les perdait. Posé ici, après les hooks de répertoires, parce
    // qu'il lui faut leurs références.
    champsProjetRef.current = {
        lire: () => ({
            dossierSections,
            ...lireMiseEnPage({
                diagramHeight, floatingCrop, floatingZoom,
                sidebarVisible, commentsMode, remarksMode, descriptionMode,
                showFloatingForm, showFloatingMatrix, showFloatingTraffic,
                showFloatingImage, showFloatingConditions, showFloatingVariables,
                showFloatingRemarks,
                showImageGroupNumbers: intersectionDisplay.showGroupNumbers,
                showImageGroupNames: intersectionDisplay.showGroupNames,
                showImageArrows: intersectionDisplay.showArrows,
                directoryNames: {
                    open: lastOpenDirectoryRef.current?.name || recentOpenDirs[0]?.name || null,
                    save: lastSaveDirectoryRef.current?.name || recentSaveDirs[0]?.name || null,
                    import: lastImportDirectoryRef.current?.name || recentImportDirs[0]?.name || null,
                    image: lastImageDirectoryRef.current?.name || recentImageDirs[0]?.name || null,
                    greenWave: lastGreenWaveDirectoryRef.current?.name || recentGreenWaveDirs[0]?.name || null
                }
            })
        }),
        ecrire: (etat) => appliquerMiseEnPage(etat, {
            setDiagramHeight, resetDiagramHeight,
            setFloatingCrop, setFloatingZoom, markLegacyCrop,
            setSidebarVisible, setCommentsMode, setRemarksMode, setDescriptionMode,
            setShowFloatingForm, setShowFloatingMatrix, setShowFloatingTraffic,
            setShowFloatingImage, setShowFloatingConditions, setShowFloatingVariables,
            setShowFloatingRemarks, setDossierSections,
            setShowImageGroupNumbers: (v) => setIntersectionDisplayOption('showGroupNumbers', v),
            setShowImageGroupNames: (v) => setIntersectionDisplayOption('showGroupNames', v),
            setShowImageArrows: (v) => setIntersectionDisplayOption('showArrows', v)
        })
    };

    const {
        handleOpenFileWithPicker,
        handleOpenFileFromRecentDir,
        handleSaveFileWithPicker,
        handleSaveFileToRecentDir,
        handleExportPfSubset
    } = useFileOperations({
        projectName, diagramHeight, floatingCrop, floatingZoom,
        setSelectedProject, setOpenModal, setCurrentProjectPath, setProjectModified,
        projectModifiedSkip, hasUnsavedChanges, setHasUnsavedChanges,
        isDirty,
        setDiagramHeight, resetDiagramHeight, setFloatingCrop, setFloatingZoom, markLegacyCrop,
        setCommentsMode, setRemarksMode, setIntersectionName,
        // Layout options sauvegardées au niveau projet
        commentsMode, remarksMode, descriptionMode, sidebarVisible,
        setDescriptionMode, setSidebarVisible,
        // Flags de détachement (niveau projet : dimensions des popups
        // dépendent du nombre de groupes, donc liées au projet)
        showFloatingForm, setShowFloatingForm,
        showFloatingMatrix, setShowFloatingMatrix,
        showFloatingTraffic, setShowFloatingTraffic,
        showFloatingImage, setShowFloatingImage,
        showFloatingConditions, setShowFloatingConditions,
        showFloatingVariables, setShowFloatingVariables,
        showFloatingRemarks, setShowFloatingRemarks,
        setHasActiveProject,
        loadFullState, getFullState, saveProject,
        dossierSections, setDossierSections,
        lastOpenDirectoryRef, lastSaveDirectoryRef, lastImportDirectoryRef,
        lastImageDirectoryRef,
        saveDirectoryHandle, loadDirectoryHandle,
        recentOpenDirs, recentSaveDirs, recentImportDirs, recentImageDirs, recentGreenWaveDirs,
        addRecentDirectory,
        askConfirm, showAlert
    });

    // Get all saved green waves (sorted by most recent first)
    const getSavedGreenWaves = () => {
        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves: Record<string, SavedGreenWave> = JSON.parse(saved);
                return Object.keys(greenWaves)
                    // Le nom enregistré dans l'onde verte prime sur sa clé.
                    .map(name => Object.assign({ name }, greenWaves[name]))
                    .sort((a, b) => {
                        // Sort by savedAt date, most recent first
                        const dateA = a.savedAt ? new Date(a.savedAt) : new Date(0);
                        const dateB = b.savedAt ? new Date(b.savedAt) : new Date(0);
                        return dateB.getTime() - dateA.getTime();
                    });
            }
        } catch (e) {
            console.error('Failed to get saved green waves', e);
        }
        return [];
    };

    // Format date for display
    const formatDate = (isoString: string | number | null | undefined) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '';
        }
    };

    // Delete a saved green wave
    const deleteGreenWave = async (name: string) => {
        const ok = await askConfirm({
            title: 'Supprimer l\'onde verte',
            message: `Êtes-vous sûr de vouloir supprimer l'onde verte « ${name} » ?`,
            confirmLabel: 'Supprimer',
            danger: true,
        });
        if (!ok) return;
        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                delete greenWaves[name];
                localStorage.setItem('savedGreenWaves', JSON.stringify(greenWaves));
                if (selectedGreenWave === name) {
                    setSelectedGreenWave(null);
                }
                // Force list refresh
                setGreenWaveListKey(prev => prev + 1);
            }
        } catch (e) {
            console.error('Failed to delete green wave', e);
        }
    };

    // Chargements au démarrage (?duplicate, ?example) et comptage de
    // l'invitation « projet exemple » (cf. hooks/useModeExemple).
    useChargementDemarrage({
        loadFullState, loadFullStateRaw,
        setProjectModified, projectModifiedSkip, setHasUnsavedChanges,
        setFloatingCrop, setFloatingZoom, markLegacyCrop,
        hasActiveProject, setHasActiveProject,
    });

    // Impression du dossier dans un onglet indépendant (cf. hooks/useImpressionDossier).
    const { imprimerApercu, handleDossierConfirm, handleDossierExportPDF } = useImpressionDossier({
        dossierPortrait, setDossierDialog, setPrintType, setPrintPreviewModal,
        // Sans fichier (projet restauré du cache, exemple), le nom du projet en tient lieu.
        nomCarrefour: intersectionName, nomFichier: currentProjectPath || projectName
    });

    // Capture la première occurrence du sélecteur en PNG. Le suffixe sert à
    // construire un nom de fichier explicite ; errorLabel s'affiche dans le
    // toast si l'élément n'est pas dans le DOM (typiquement parce que la vue
    // correspondante n'est pas active à l'écran).
    //
    // Le rendu force toujours :
    //   - le thème CLAIR (noir sur fond blanc), pour économiser l'encre à
    //     l'impression et homogénéiser les exports indépendamment du thème
    //     actif dans l'app
    //   - la classe png-export-clean qui retire les overflows scroll
    //     (matrice, action-table) et masque les fenêtres latérales du
    //     diagramme (commentaires, remarques) — voir TimelineDiagram.css
    // Les modifications sont appliquées sur le DOM cloné (via html2canvas
    // onclone), donc invisibles à l'écran de l'utilisateur.
    // Helper : attend qu'un élément existe dans le DOM (utile après setState
    // qui change la vue rendue). Poll toutes les 50ms jusqu'à timeout.
    const waitForElement = async (selector: string, timeoutMs = 1000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const el = document.querySelector<HTMLElement>(selector);
            if (el) return el;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    };

    // opts.beforeCapture : callback synchrone qui prépare la vue (par exemple
    // setActiveTab('traffic')) et retourne une fonction de restauration appelée
    // après la capture. On attend que le sélecteur cible soit présent dans le
    // DOM avant de capturer.
    const exportSectionAsPng = async (selector: string, suffix: string, errorLabel: string, opts: OptionsExportPng = {}) => {
        let restore: (() => void) | null | void = null;
        if (opts.beforeCapture) {
            restore = opts.beforeCapture();
        }

        try {
            const el = opts.beforeCapture
                ? await waitForElement(selector, 1500)
                : document.querySelector<HTMLElement>(selector);
            if (!el) {
                toast.error(`${errorLabel} introuvable — vérifiez que la vue correspondante est affichée`);
                return;
            }
            const pfName = pfTabs.find(pf => pf.id === activePFId)?.name || '';
            const filename = buildExportFilename(intersectionName, `${pfName}_${suffix}`);
            toast.info('Export PNG en cours...');
            const {
                exportElementAsPNG,
                getTimelineCaptureDimensions,
                materializeFormControlValues
            } = await import('./utils/exportHelpers');

            const captureOptions = opts.fullTimeline
                ? getTimelineCaptureDimensions(el)
                : { width: 0, height: 0 };

            const onclone = (clonedDoc: Document) => {
                const themeClasses = ['high-contrast-mode', 'amber-mode',
                                       'daltonian-mode', 'sepia-mode', 'blue-night-mode'];
                themeClasses.forEach(c => clonedDoc.body.classList.remove(c));
                clonedDoc.body.classList.add('light-mode');
                clonedDoc.body.classList.add('png-export-clean');
                const clonedEl = clonedDoc.querySelector<HTMLElement>(selector);
                materializeFormControlValues(el, clonedEl);

                if (opts.fullTimeline && clonedEl && captureOptions.width > 0) {
                    clonedEl.style.width = `${captureOptions.width}px`;
                    clonedEl.style.maxWidth = 'none';
                    const layout = clonedEl.querySelector<HTMLElement>('.timeline-layout');
                    if (layout) {
                        layout.style.width = `${captureOptions.width}px`;
                        layout.style.maxWidth = 'none';
                        layout.style.overflow = 'visible';
                    }
                }
                // Hook personnalisé fourni par l'appelant : permet par exemple
                // de remplacer un en-tête par un titre formaté avant capture.
                if (opts.onCloneExtra) opts.onCloneExtra(clonedDoc, clonedEl);
            };

            const result = await exportElementAsPNG(el, filename, {
                onclone,
                backgroundColor: '#ffffff',
                ...(captureOptions.width > 0 ? {
                    width: captureOptions.width,
                    windowWidth: captureOptions.width
                } : {}),
                ...(captureOptions.height > 0 ? {
                    height: captureOptions.height,
                    windowHeight: captureOptions.height
                } : {})
            });
            if (result?.clipboardSuccess) {
                toast.success(`📥 Téléchargé : ${filename}.png  •  📋 Copié dans le presse-papiers (Ctrl+V)`);
            } else {
                toast.success(`📥 Téléchargé : ${filename}.png  •  Presse-papiers non disponible`);
            }
        } catch (e) {
            console.error('Erreur export PNG:', e);
            toast.error('Échec de l\'export PNG : ' + e.message);
        } finally {
            if (restore) restore();
        }
    };

    // Menu action handler
    const handleMenuAction = async (action: string) => {
        switch (action) {
            case 'new': {
                // Confirmation uniquement s'il y a des modifications à perdre.
                // Pas de confirmation sur écran d'accueil ou projet inchangé.
                const okNew = !isDirty || await askConfirm({
                    title: 'Nouveau projet',
                    message: 'Créer un nouveau projet ? Les modifications non enregistrées seront perdues.',
                    confirmLabel: 'Créer',
                    danger: true,
                });
                if (okNew) {
                    leaveExampleMode(); // un nouveau projet n'est plus l'exemple
                    resetToNewProject();
                    setActiveTab(openPropertiesOnNewProject ? 'properties' : 'config');
                    resetDiagramHeight();
                    setSidebarVisible(true);
                    resetFloatingImageFraming();
                    setGroupCountInput('8');
                    setCycleLengthInput('60');
                    setCurrentProjectPath('');
                    setProjectModified(false);
                    projectModifiedSkip.current = true;
                    setHasUnsavedChanges(false); // nettoie l'astérisque + enclenche le bypass d'isLoading
                    // Décoche tous les détachements (un nouveau projet repart
                    // d'un espace de travail propre — l'utilisateur détache à
                    // la demande selon ses besoins).
                    setShowFloatingProperties(false);
                    setShowFloatingForm(false);
                    setShowFloatingMatrix(false);
                    setShowFloatingTraffic(false);
                    setShowFloatingImage(false);
                    setShowFloatingConditions(false);
                    setShowFloatingVariables(false);
                    setShowFloatingRemarks(false);
                    setShowFloatingDiagram(false);
                    setShowFloatingConflicts(false);
                    setShowFloatingDiagnostic(false);
                    // Active l'interface principale : on quitte l'écran d'accueil.
                    setHasActiveProject(true);
                    toast.success('Nouveau projet créé');
                    // Place focus on project name input after render
                    setTimeout(() => {
                        if (projectNameInputRef.current) {
                            projectNameInputRef.current.focus();
                            projectNameInputRef.current.select();
                        }
                    }, 100);
                }
                break;
            }
            case 'open':
                handleOpenFileWithPicker();
                break;
            case 'openLocalStorage':
                setSelectedProject(null);
                setOpenModal(true);
                break;
            case 'save':
                // Filet de sécurité pour le raccourci clavier (l'entrée de
                // menu est déjà grisée en mode exemple).
                if (isExampleSession()) {
                    toast.info('Projet exemple : non enregistrable. Faites « Nouveau projet » pour démarrer le vôtre.');
                    break;
                }
                (async () => {
                    setIsSaving(true);
                    try { await handleSaveFileWithPicker(); }
                    finally { setIsSaving(false); }
                })();
                break;
            case 'exportPngFormulaire':
                exportSectionAsPng('.group-table-container', 'Formulaire', 'Formulaire des groupes');
                break;
            case 'exportPngDiagramme':
                exportSectionAsPng('.timeline-container', 'Diagramme', 'Diagramme', { fullTimeline: true });
                break;
            case 'exportPngMatrice':
                exportSectionAsPng('.matrix-container-inline', 'Matrice', 'Matrice interverts');
                break;
            case 'exportPngMicroRegulation':
                exportSectionAsPng('.action-table', 'MicroRegulation', 'Tableau des conditions de micro-régulation');
                break;
            case 'exportPngImageCarrefour':
                // Cible la zone d'image elle-même (sans le header avec titre/boutons)
                exportSectionAsPng('.intersection-image-area', 'Carrefour', 'Image du carrefour');
                break;
            case 'exportPngCapaciteUtilisee': {
                // Titre principal sur la première ligne ; mention du trafic
                // sur une seconde ligne en plus petit. Si le jeu de trafic
                // n'a pas de nom (« Associé à » vide), seule la première
                // ligne est affichée.
                const pfName = pfTabs.find(pf => pf.id === activePFId)?.name || '';
                // Le jeu actif est désigné par son nom. On le cherchait comme
                // une clé dans la LISTE des noms, ce qui ne renvoyait jamais
                // rien : le sous-titre n'apparaissait jamais.
                const datasetName = trafficDatasetNames.includes(activeTrafficDataset) ? activeTrafficDataset : '';
                const titleLine1 = `Capacité utilisée par groupe de feu — Diagramme ${pfName}`;
                const titleLine2 = datasetName ? `avec le trafic ${datasetName}` : '';
                exportSectionAsPng('.traffic-table-container', 'Capacite', 'Tableau de capacité utilisée', {
                    onCloneExtra: (clonedDoc) => {
                        const header = clonedDoc.querySelector<HTMLElement>('.traffic-header');
                        if (header) {
                            header.innerHTML = '';
                            // .traffic-header est un flex en ligne : on force
                            // l'empilement vertical pour que le sous-titre
                            // apparaisse SOUS le titre, pas à côté.
                            header.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; padding: 8px 0;';
                            const title = clonedDoc.createElement('h3');
                            title.textContent = titleLine1;
                            title.style.cssText = 'margin: 0; font-size: 1.1em; font-weight: bold; color: #000;';
                            header.appendChild(title);
                            if (titleLine2) {
                                const subtitle = clonedDoc.createElement('div');
                                subtitle.textContent = titleLine2;
                                subtitle.style.cssText = 'margin: 4px 0 8px 0; font-size: 0.9em; color: #333;';
                                header.appendChild(subtitle);
                            }
                        }
                    }
                });
                break;
            }
            case 'exportPngPhasageBulle':
                exportSectionAsPng('.phasage-bulle-container', 'PhasageBulle', 'Phasage bulle');
                break;
            case 'printDossier':
                // Relever les largeurs d'écran MAINTENANT : le tableau des
                // conditions est encore monté derrière la boîte, et c'est sa
                // largeur qui décide de la réduction en portrait.
                mesurerColonnesImpression();
                // Ouvrir le dialog de sélection des sections
                // Initialiser uniquement si vide (premier accès), sinon conserver les choix
                setDossierSections(prev => {
                    // Une fois posés, les choix de l'utilisateur font foi : une
                    // case décochée le reste, et s'enregistre ainsi avec le
                    // projet. Seul le premier accès propose une sélection.
                    if (Object.keys(prev).length > 0) return prev;
                    // Le scénario choisi de chaque plan vaut intention de
                    // l'imprimer : sa case naît cochée.
                    return {
                        image: true,
                        gfNumbers: true,
                        formulaire: true,
                        securiteMatrix: false,
                        matrice: true,
                        ...sectionsScenariosInitiales(pfTabs),
                        ...Object.fromEntries(pfTabs.flatMap(pf => {
                            const checked = pf.color === '#4CAF50';
                            return [
                                [`diagram_${pf.id}`, checked],
                                [`conditionsMicro_${pf.id}`, checked],
                                [`variablesMicro_${pf.id}`, checked],
                                [`phasageBulle_${pf.id}`, checked],
                                [`traficCapacite_${pf.id}`, checked],
                                [`reserveCapacite_${pf.id}`, checked],
                            ];
                        })),
                    };
                });
                setDossierDialog(true);
                break;
            case 'close':
                window.close();
                break;
            case 'duplicate': {
                const newId = duplicatePF();
                if (newId) {
                    toast.success(`PF dupliqué en PF${newId}`);
                } else {
                    toast.error(`Limite de ${MAX_PF} plans de feux atteinte. Supprimez-en un avant d'en ajouter un nouveau.`);
                }
                break;
            }
            case 'deleteActiveDiagram':
                if (pfTabs.length > 1) {
                    const activePF = pfTabs.find(pf => pf.id === activePFId);
                    const tabName = activePF?.name || `PF${activePFId}`;
                    if (await askConfirm({
                        title: 'Supprimer le plan de feu',
                        message: `Êtes-vous sûr de vouloir supprimer l'onglet « ${tabName} » ?\n\nCette action est irréversible.`,
                        confirmLabel: 'Supprimer',
                        danger: true,
                    })) {
                        deletePF(activePFId);
                        toast.success(`${tabName} supprimé`);
                    }
                } else {
                    toast.error('Impossible de supprimer le dernier onglet.');
                }
                break;
            case 'moveGroup':
                if (groups.length > 1) {
                    setGroupToMove(groups[0]?.id?.toString() || '');
                    setMoveAfterGroup('0');
                    setMoveGroupTouched(false);
                    setMoveGroupModal(true);
                } else {
                    showAlert({ title: 'Action impossible', message: 'Il faut au moins 2 groupes pour effectuer un déplacement.' });
                }
                break;
            case 'biCarrefour':
                if (groups.length > 1) {
                    setBiCarrefourGroupId(groups[0]?.id?.toString() || '');
                    setBiCarrefourTouched(false);
                    setBiCarrefourModal(true);
                } else {
                    showAlert({ title: 'Action impossible', message: 'Il faut au moins 2 groupes pour intégrer un bi-carrefour.' });
                }
                break;
            case 'uniCarrefour':
                setBiCarrefourSeparator(null);
                break;
            case 'lockMatrices':
                setMatricesLocked(prev => !prev);
                break;
            case 'slide':
                setSlideValue(0);
                setSlideFromGroup(groups[0]?.id || 1);
                setSlideToGroup(groups[groups.length - 1]?.id || 1);
                setSlideTouched(false);
                setSlideModal(true);
                break;
            case 'insert':
                setInsertStart(0);
                setInsertDuration(5);
                setInsertTouched(false);
                setInsertModal(true);
                break;
            case 'reduce':
                setReduceStart(0);
                setReduceDuration(5);
                setReduceTouched(false);
                setReduceModal(true);
                break;
            case 'options':
                setOptionsModal(true);
                break;
            case 'microVariables':
                setMicroVariablesModal(true);
                break;
            case 'toggleLegend':
                setShowFloatingLegend(v => !v);
                break;
            case 'toggleMicroOnHover':
                setShowMicroOnHover(v => !v);
                break;
            case 'toggleToastSuccess':
            case 'toggleToastError':
            case 'toggleToastInfo': {
                const type = action === 'toggleToastSuccess' ? 'success' : action === 'toggleToastError' ? 'error' : 'info';
                const newVal = !toastPrefs[type];
                setToastPref(type, newVal);
                setToastPrefsState({ ...toastPrefs, [type]: newVal });
                break;
            }
            case 'toggleOpenPropertiesOnNewProject': {
                const newVal = !openPropertiesOnNewProject;
                setOpenPropertiesOnNewProject(newVal);
                localStorage.setItem('openPropertiesOnNewProject', String(newVal));
                break;
            }
            case 'toggleShowWrapFlash': {
                const newVal = !showWrapFlash;
                setShowWrapFlash(newVal);
                localStorage.setItem('showWrapFlash', String(newVal));
                break;
            }
            case 'toggleTooltipsMain':    setTooltipPref('main');    break;
            case 'toggleTooltipsConfig':  setTooltipPref('config');  break;
            case 'toggleTooltipsDiagram': setTooltipPref('diagram'); break;
            case 'toggleTooltipsMatrix':  setTooltipPref('matrix');  break;
            case 'toggleTooltipsTraffic': setTooltipPref('traffic'); break;
            case 'toggleTooltipsMicro':   setTooltipPref('micro');   break;
            case 'toggleSaveReminder': {
                const newVal = !showSaveReminder;
                setShowSaveReminder(newVal);
                localStorage.setItem('showSaveReminder', String(newVal));
                break;
            }
            case 'help':
                setHelpModal(true);
                break;
            case 'newPF': {
                const newId = nouveauPF();
                if (newId) setNouveauPlanModal(true);
                else toast.error(`Limite de ${MAX_PF} plans de feux atteinte. Supprimez-en un avant d'en ajouter un nouveau.`);
                break;
            }
            case 'cycleSuggestion':
                setSuggestionCycleModal(true);
                break;
            case 'compareCapacity':
                setCapacityCompareModal(true);
                break;
            case 'import':
                handleImportExcelDirect();
                break;
            case 'importDiagfeux':
                diagfeuxInputRef.current?.click();
                break;
            case 'importProjectPf':
                projectPfInputRef.current?.click();
                break;
            case 'exportPfSubset':
                setShowExportPfModal(true);
                break;
            case 'copyMatrixFromPf':
                setShowCopyMatrixModal(true);
                break;
            case 'browseImport':
                setImportFile(null);
                setImportError('');
                // Use the most recent directory as hint
                const recentDirs = getRecentDirectories();
                setImportHintDir(recentDirs.length > 0 ? recentDirs[0] : '');
                setImportModal(true);
                break;
            case 'importHTM':
                setHtmFile(null);
                setHtmImportError('');
                setImportHTMModal(true);
                break;
            case 'credit':
                setAboutModal(true);
                break;
            case 'diagnosticReport':
                setDiagnosticIncludeProject(false);
                setDiagnosticModal(true);
                break;
            case 'toggleParameters':
                setSidebarVisible(v => !v);
                break;
            case 'commentsShow':
                setCommentsMode('afficher');
                break;
            case 'commentsHide':
                setCommentsMode('masquer');
                break;
            case 'commentsAuto':
                setCommentsMode('auto');
                break;
            case 'remarksShow':
                setRemarksMode('afficher');
                break;
            case 'remarksHide':
                setRemarksMode('masquer');
                break;
            case 'remarksAuto':
                setRemarksMode('auto');
                break;
            case 'themeDark':
                setColorTheme('dark');
                break;
            case 'themeLight':
                setColorTheme('light');
                break;
            case 'themeHighContrast':
                setColorTheme('high-contrast');
                break;
            case 'themeAmber':
                setColorTheme('amber');
                break;
            case 'themeDaltonian':
                setColorTheme('daltonian');
                break;
            case 'themeSepia':
                setColorTheme('sepia');
                break;
            case 'themeBlueNight':
                setColorTheme('blue-night');
                break;
            case 'toggleGroupNamesForm':
                setShowGroupNamesForm(v => !v);
                break;
            case 'toggleGroupNamesMatrix':
                setShowGroupNamesMatrix(v => !v);
                break;
            case 'toggleGroupNamesDiagram':
                setShowGroupNamesDiagram(v => !v);
                break;
            case 'descriptionShow':
                setDescriptionMode('afficher');
                break;
            case 'descriptionHide':
                setDescriptionMode('masquer');
                break;
            case 'descriptionAuto':
                setDescriptionMode('auto');
                break;
            case 'enableAccounts':
                (async () => {
                    const ok = await askConfirm({
                        title: 'Activer les comptes utilisateurs',
                        message: "Destiné aux postes partagés : chacun ouvrira une session avec ses droits. Vous allez créer le compte administrateur. Les comptes restent locaux à cet ordinateur, rien n'est envoyé sur un réseau.",
                        confirmLabel: 'Activer'
                    });
                    if (ok) activerComptes();
                })();
                break;
            case 'disableAccounts':
                (async () => {
                    const ok = await askConfirm({
                        title: 'Désactiver les comptes utilisateurs',
                        message: "L'application s'ouvrira sans demander de connexion. Les comptes déjà créés sont conservés et seront retrouvés si vous les réactivez.",
                        confirmLabel: 'Désactiver',
                        danger: true
                    });
                    if (ok) desactiverComptes();
                })();
                break;
            case 'toggleFloatingImage':
                setShowFloatingImage(v => !v);
                break;
            case 'toggleFloatingMatrix':
                setShowFloatingMatrix(v => !v);
                break;
            case 'toggleFloatingForm':
                setShowFloatingForm(v => !v);
                break;
            case 'toggleFloatingProperties':
                setShowFloatingProperties(v => !v);
                break;
            case 'toggleFloatingDiagnostic':
                setShowFloatingDiagnostic(v => !v);
                break;
            case 'toggleCapacityReserve':
                setShowCapacityReserve(v => !v);
                break;
            case 'toggleFloatingDiagram':
                setShowFloatingDiagram(v => !v);
                break;
            case 'toggleFloatingConflicts':
                setShowFloatingConflicts(v => !v);
                break;
            case 'toggleFloatingConditions':
                setShowFloatingConditions(v => !v);
                break;
            case 'toggleFloatingVariables':
                setShowFloatingVariables(v => !v);
                break;
            case 'toggleFloatingTraffic':
                setShowFloatingTraffic(v => !v);
                break;
            case 'toggleFloatingRemarks':
                setShowFloatingRemarks(v => !v);
                break;
            case 'externalLinks':
                setShowExternalLinksModal(true);
                break;
            // Green wave actions
            // Lance le module Onde verte dans un nouvel onglet, sans projet
            // chargé. La création / ouverture se fait depuis le menu Fichier
            // de la fenêtre Onde verte qui prend le relais.
            case 'launchGreenWave':
                openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave`);
                break;
            case 'closeGreenWave':
                setGreenWaveViewer(false);
                setGreenWaveData(null);
                break;
            default:
                // Handle opening imported HTM files
                if (action.startsWith('openImportedFile:')) {
                    const fileId = action.replace('openImportedFile:', '');
                    const file = importedHTMFiles.find(f => f.id === fileId);
                    if (file && file.data) {
                        loadFullState({
                            projectName: file.name,
                            intersectionName: file.name,
                            groups: file.data.groups || [],
                            cycleLength: file.data.cycleLength || cycleLength
                        });
                        resetFloatingImageFraming();
                    }
                } else if (action.startsWith('importFromDir:')) {
                    // Import from recent directory
                    const dirIndex = parseInt(action.replace('importFromDir:', ''));
                    const dirs = getRecentDirectoriesForMenu();
                    if (dirs[dirIndex]) {
                        setImportFile(null);
                        setImportError('');
                        setImportHintDir(dirs[dirIndex].path);
                        setImportModal(true);
                    }
                } else if (action.startsWith('openFromRecentDir:')) {
                    // Open file from recent directory
                    const dirIndex = parseInt(action.replace('openFromRecentDir:', ''));
                    if (recentOpenDirs[dirIndex]) {
                        handleOpenFileFromRecentDir(dirIndex);
                    }
                } else if (action.startsWith('importFromRecentDir:')) {
                    // Import Excel from recent directory
                    const dirIndex = parseInt(action.replace('importFromRecentDir:', ''));
                    if (recentImportDirs[dirIndex]) {
                        handleImportExcelFromRecentDir(dirIndex);
                    }
                } else if (action.startsWith('saveToRecentDir:')) {
                    // Save to recent directory
                    const dirIndex = parseInt(action.replace('saveToRecentDir:', ''));
                    if (recentSaveDirs[dirIndex]) {
                        (async () => {
                            setIsSaving(true);
                            try { await handleSaveFileToRecentDir(dirIndex); }
                            finally { setIsSaving(false); }
                        })();
                    }
                } else {
                    console.log('Action non implémentée:', action);
                }
        }
    };

    // IndexedDB pour données greenwave (localStorage trop limité en taille)
    const openGreenWaveDB = useCallback(() => {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('DiagrammeFeux_GreenWave', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('data')) {
                    db.createObjectStore('data');
                }
            };
        });
    }, []);

    const saveGreenWaveToIDB = useCallback(async (key: string, value: unknown) => {
        const db = await openGreenWaveDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(['data'], 'readwrite');
            const store = tx.objectStore('data');
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }, [openGreenWaveDB]);

    // Handle green wave creation - opens in new tab
    const handleCreateGreenWave = async (intersections: CreatedIntersection[]) => {
        const greenWaveId = Date.now().toString();
        let useIDB = false;

        try {
            sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(intersections));
        } catch {
            // Quota dépassé : fallback IndexedDB
            await saveGreenWaveToIDB(`greenwave_${greenWaveId}`, intersections);
            useIDB = true;
        }

        openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`);
        setCreateGreenWaveModal(false);
    };

    // Handle opening a saved green wave
    const handleOpenSavedGreenWave = async (greenWaveName = selectedGreenWave) => {
        if (!greenWaveName) return;

        try {
            const saved = localStorage.getItem('savedGreenWaves');
            if (saved) {
                const greenWaves = JSON.parse(saved);
                const greenWaveData = greenWaves[greenWaveName];

                if (greenWaveData && greenWaveData.intersections) {
                    const greenWaveId = Date.now().toString();
                    let useIDB = false;

                    try {
                        sessionStorage.setItem(`greenwave_${greenWaveId}`, JSON.stringify(greenWaveData.intersections));
                        sessionStorage.setItem(`greenwave_settings_${greenWaveId}`, JSON.stringify({
                            name: greenWaveName,
                            speed: greenWaveData.speed,
                            speedUp: greenWaveData.speedUp,
                            speedDown: greenWaveData.speedDown,
                            speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                            speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                            pixelsPerSecond: greenWaveData.pixelsPerSecond,
                            pixelsPerMeter: greenWaveData.pixelsPerMeter
                        }));
                    } catch {
                        await saveGreenWaveToIDB(`greenwave_${greenWaveId}`, greenWaveData.intersections);
                        await saveGreenWaveToIDB(`greenwave_settings_${greenWaveId}`, {
                            name: greenWaveName,
                            speed: greenWaveData.speed,
                            speedUp: greenWaveData.speedUp,
                            speedDown: greenWaveData.speedDown,
                            speedLineOffsetUp: greenWaveData.speedLineOffsetUp,
                            speedLineOffsetDown: greenWaveData.speedLineOffsetDown,
                            pixelsPerSecond: greenWaveData.pixelsPerSecond,
                            pixelsPerMeter: greenWaveData.pixelsPerMeter
                        });
                        useIDB = true;
                    }

                    openOrFocusGreenWave(`${window.location.origin}${window.location.pathname}?greenwave&id=${greenWaveId}${useIDB ? '&idb=1' : ''}`);
                    setOpenGreenWaveModal(false);
                    setSelectedGreenWave(null);
                }
            }
        } catch (e) {
            console.error('Failed to open green wave', e);
            showAlert({ title: 'Erreur', message: "Erreur lors de l'ouverture de l'onde verte." });
        }
    };

    // Handle opening green wave from file system

    const openSavedProject = async (projectNameToOpen: string | null, confirmationMessage: string) => {
        if (!projectNameToOpen) return;

        // Garde-fou : si le projet courant a des modifications non
        // sauvegardées, demander confirmation avant de l'écraser.
        if (isDirty) {
            const ok = await askConfirm({
                title: 'Modifications non enregistrées',
                message: confirmationMessage,
                confirmLabel: 'Continuer',
                danger: true,
            });
            if (!ok) return;
        }

        const data = loadProject(projectNameToOpen) || null;
        if (data) {
            // Restauré du cache : aucun fichier ouvert. Le nom du fichier du projet
            // précédent ne doit pas passer en bas des pages du dossier.
            setCurrentProjectPath('');
            // loadProject ne passe pas par le wrapper loadFullState : sans cet
            // appel, un projet restauré depuis une fenêtre exemple restait
            // en mode exemple (Sauvegarder grisé, aucune sauvegarde auto).
            leaveExampleMode();
            // Un projet tout juste rouvert depuis le cache n'a aucune
            // modification : même remise à zéro que l'ouverture d'un fichier.
            // Sans elle, l'installation de ses données comptait comme une
            // modification et l'astérisque apparaissait aussitôt.
            // setHasUnsavedChanges(false) ignore les changements des 300 ms
            // suivantes, le temps que le chargement se pose. Le drapeau de saut
            // est baissé : resté levé (après « Nouveau projet », par exemple),
            // il ne serait pas consommé pendant cette fenêtre et absorberait la
            // première modification de l'utilisateur.
            setProjectModified(true); // active « Nouveau projet » dans le menu
            projectModifiedSkip.current = false;
            setHasUnsavedChanges(false); // pas de modifications non sauvegardées
        }
        setOpenModal(false);
        setSelectedProject(null);
        setFloatingCrop(data?.floatingCrop !== undefined ? data.floatingCrop : { ...DEFAULT_CROP });
        setFloatingZoom(data?.floatingZoom !== undefined ? data.floatingZoom : DEFAULT_ZOOM);
        markLegacyCrop(data?.floatingCrop !== undefined && data?.floatingCropBasis !== CROP_BASIS);
        // Le cache navigateur ne porte ni la hauteur du diagramme ni l'état
        // du panneau : sans remise à zéro, ils restaient hérités du projet
        // précédemment ouvert.
        if (data?.diagramHeight !== undefined && data.diagramHeight !== null) {
            setDiagramHeight(data.diagramHeight);
        } else {
            resetDiagramHeight();
        }
        setSidebarVisible(typeof data?.layoutOptions?.showParameters === 'boolean'
            ? data.layoutOptions.showParameters
            : true);
        // Commentaires et remarques : le réglage enregistré dans le projet
        // l'emporte. Recalculer à chaque ouverture faisait perdre le choix de
        // l'utilisateur.
        if (data && typeof data === 'object') {
            const affichage = affichageCommentairesRemarques(data);
            setCommentsMode(affichage.commentsMode);
            setRemarksMode(affichage.remarksMode);
        }
        setHasActiveProject(true);
    };

    // Handle project selection from open modal
    const handleOpenProject = (projectNameToOpen = selectedProject) => {
        return openSavedProject(
            projectNameToOpen,
            `Le projet courant a des modifications non enregistrées qui seront perdues.\n\nContinuer et ouvrir « ${projectNameToOpen} » ?`,
        );
    };

    // Handle slide confirmation
    const handleSlide = () => {
        if (slideValue !== 0) {
            slideAllGroups(slideValue, slideFromGroup, slideToGroup);
        }
        setSlideModal(false);
    };

    // Handle insert confirmation
    const handleInsert = () => {
        if (insertDuration > 0) {
            insertTime(insertStart, insertDuration);
        }
        setInsertModal(false);
    };

    // Handle reduce confirmation
    const handleReduce = () => {
        if (reduceDuration > 0 && reduceStart + reduceDuration <= cycleLength) {
            reduceTime(reduceStart, reduceDuration);
        }
        setReduceModal(false);
    };

    // Handle file selection for import
    const {
        handleFileSelect,
        handleImportExcelDirect,
        handleImportExcelFromRecentDir,
        handleImport,
        handleHTMFileSelect,
        handleHTMImport
    } = useImportOperations({
        importFile, setImportFile, setImportError, setImportModal, setImportHintDir,
        htmFile, setHtmFile, setHtmImportError, importedHTMFiles, setImportedHTMFiles, setImportHTMModal,
        cycleLength, loadFullState, updateGroupParams,
        setHasActiveProject,
        lastImportDirectoryRef,
        saveDirectoryHandle, loadDirectoryHandle,
        recentImportDirs, addRecentDirectory,
        addToRecentFiles
    });

    // Keyboard shortcuts (Ctrl+Z/Y, Ctrl+N/O/S)
    const handleMenuActionRef = useRef(handleMenuAction);
    handleMenuActionRef.current = handleMenuAction;
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (undo() !== false) toast.info('Action annulée');
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (redo() !== false) toast.info('Action rétablie');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isInput) {
                e.preventDefault();
                handleMenuActionRef.current('new');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                handleMenuActionRef.current('open');
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleMenuActionRef.current('save');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Render floating image content into popup window
    useFloatingImageRenderer({
        showFloatingImage, intersectionImage,
        floatingCrop, setFloatingCrop,
        floatingZoom, setFloatingZoom,
        showCropControls, setShowCropControls,
        intersectionArrows, groups, imageNaturalDims, imageFondClair,
        selectedActions: simulationSelectedActions, conflictMatrix,
        hoveredArrowGroupId, hoveredArrowGroupIds: flechesActionSimulation, setHoveredArrowGroupId, hoveredDiagramTime,
        isPlayingSimulation,
        simulationCurrentTime, simulationResult,
        actionData, cycleLength,
        imageBrightness, imageContrast,
        intersectionDisplay,
        floatingImagePopup
    });

    // Render matrix into popup window
    useEffect(() => {
        if (!showFloatingMatrix) return;
        matrixPopup.renderToPopup(
            <div style={{ padding: '0 12px 12px', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                <IntergreenMatrix
                    titreEnBandeau
                    conflictMatrix={conflictMatrix}
                    setMatrixValue={setMatrixValue}
                    groups={groups}
                    cycleLength={cycleLength}
                    actionData={actionData}
                    activePFId={activePFId}
                    pfTabs={pfTabs}
                    biCarrefourSeparator={biCarrefourSeparator}
                    onCellHover={() => {}}
                    showGroupNames={showGroupNamesMatrix}
                    locked={matricesLocked}
                    hoveredGroupId={hoveredArrowGroupId}
                tooltipsEnabled={tooltipPrefs.matrix}
                />
            </div>
        );
    }, [showFloatingMatrix, conflictMatrix, groups, cycleLength, actionData, activePFId,
        pfTabs, biCarrefourSeparator, showGroupNamesMatrix, matricesLocked, hoveredArrowGroupId, matrixPopup.renderToPopup]);

    // Render form into popup window
    useEffect(() => {
        if (!showFloatingForm) return;
        formPopup.renderToPopup(
            <div style={{ padding: '0 12px 12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <GroupTable
                    groups={groups}
                    updateGroupParams={updateGroupParams}
                    cycleLength={cycleLength}
                    showGroupNames={showGroupNamesForm}
                    titreEnBandeau
                    hoveredGroupId={hoveredArrowGroupId}
                tooltipsEnabled={tooltipPrefs.config}
                />
            </div>
        );
    }, [showFloatingForm, groups, cycleLength, showGroupNamesForm, hoveredArrowGroupId, formPopup.renderToPopup, updateGroupParams]);

    // Render properties into popup window
    useEffect(() => {
        if (!showFloatingProperties) return;
        propertiesPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <PropertiesPanel
                    intersectionName={intersectionName}
                    setIntersectionName={setIntersectionName}
                    projectProperties={projectProperties}
                    updateProjectProperty={updateProjectProperty}
                    appCommunes={appCommunes}
                    appMoaLogos={appMoaLogos}
                    appMoeLogos={appMoeLogos}
                    tooltipsEnabled={tooltipPrefs.config}
                />
            </div>
        );
    }, [showFloatingProperties, intersectionName, setIntersectionName, projectProperties, updateProjectProperty, appCommunes, appMoaLogos, appMoeLogos, tooltipPrefs, propertiesPopup.renderToPopup]);

    // Render diagnostic into popup window
    useEffect(() => {
        if (!showFloatingDiagnostic) return;
        diagnosticPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <DiagnosticPanel
                    detached
                    groups={groups}
                    cycleLength={cycleLength}
                    getTrafficData={getTrafficData}
                    actionData={actionData}
                    activeTrafficDataset={activeTrafficDataset}
                    tip={tip}
                />
            </div>
        );
    }, [showFloatingDiagnostic, groups, cycleLength, getTrafficData, actionData, activeTrafficDataset, diagnosticPopup.renderToPopup]);

    // Render remarques (notes du PF actif) into popup window
    useEffect(() => {
        if (!showFloatingRemarks) return;
        remarquesPopup.renderToPopup(
            <RemarquesEditor
                remarques={currentRemarques}
                updateRemarques={updatePFRemarques}
                groupCount={groups.length}
                popupMode={true}
            />
        );
    }, [showFloatingRemarks, currentRemarques, updatePFRemarques, groups.length, remarquesPopup.renderToPopup]);

    useEffect(() => {
        if (!showFloatingLegend) return;
        legendPopup.renderToPopup(
            <div className="floating-legend-content">
                <DiagramLegend />
            </div>
        );
        // Ajuste la fenêtre à la taille réelle de la légende (nombre de lignes),
        // une fois le contenu mis en page — évite l'espace mort sous la dernière
        // ligne comme le rognage quand la fenêtre est trop courte.
        const popup = legendPopup.popupWindow.current;
        if (!popup || popup.closed) return;
        const raf = popup.requestAnimationFrame(() => {
            if (popup.closed) return;
            const el = popup.document.querySelector('.floating-legend-content');
            if (!el) return;
            const chromeW = popup.outerWidth - popup.innerWidth;
            const chromeH = popup.outerHeight - popup.innerHeight;
            const targetW = Math.min(560, Math.max(360, Math.ceil(el.scrollWidth) + 4));
            const targetH = Math.ceil(el.scrollHeight) + 4;
            popup.resizeTo(targetW + chromeW, targetH + chromeH);
        });
        return () => { if (!popup.closed) popup.cancelAnimationFrame(raf); };
    }, [showFloatingLegend, legendPopup.renderToPopup]);

    // Render capacity comparison into its detached popup window
    useEffect(() => {
        if (!capacityCompareModal) return;
        capacityComparisonPopup.renderToPopup(
            <CapacityComparison
                pfTabs={pfTabs}
                groups={groups}
                trafficDatasets={trafficDatasets}
                pfTrafficDatasetMap={pfTrafficDatasetMap}
                activeTrafficDataset={activeTrafficDataset}
                trafficDatasetNames={trafficDatasetNames}
                selectedPfIds={capacityCompareSelection}
                setSelectedPfIds={setCapacityCompareSelection}
                datasetChoice={capacityCompareDataset}
                setDatasetChoice={setCapacityCompareDataset}
                onContentSize={noterTailleComparateur}
            />
        );
    }, [capacityCompareModal, pfTabs, groups, trafficDatasets, pfTrafficDatasetMap, activeTrafficDataset, trafficDatasetNames, capacityCompareSelection, setCapacityCompareSelection, capacityCompareDataset, setCapacityCompareDataset, noterTailleComparateur, capacityComparisonPopup.renderToPopup]);

    // Render read-only diagram mirror into its detached popup (présentation).
    // Reflète le diagramme du PF actif en direct (offsets, verts, simulation)
    // sans permettre l'édition (readOnly) : tous les setters sont neutralisés.
    useEffect(() => {
        if (!showFloatingDiagram) return;
        const noop = () => {};
        diagramPopup.renderToPopup(
            <div style={{ padding: '8px', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                <TimelineDiagram
                    titreEnBandeau
                    scrollable
                    readOnly
                    groups={groups}
                    globalTime={globalTime}
                    pixelsPerSecond={pixelsPerSecond}
                    conflicts={displayConflicts}
                    conflictMatrix={conflictMatrix}
                    cycleLength={cycleLength}
                    actionData={actionData}
                    simulationFilter={simulationEnabled ? new Set(simulationSelectedActions) : null}
                    simulationResult={simulationResult}
                    simulationCurrentTime={simulationEnabled ? simulationCurrentTime : null}
                    isPlayingSimulation={simulationEnabled && isPlayingSimulation}
                    playbackTime={isPlayingSimulation ? simulationCurrentTime : null}
                    hoveredActionId={hoveredActionId}
                    hoveredArrowGroupId={hoveredArrowGroupId}
                    hoveredArrowGroupSaturated={hoveredArrowGroupSaturated}
                    hoveredConflict={hoveredConflict}
                    hoveredVUtile={hoveredVUtile}
                    planName={simulationEnabled ? activePFName : ''}
                    activePFName={activePFName}
                    biCarrefourSeparator={biCarrefourSeparator}
                    showComments={false}
                    showRemarks={false}
                    showGroupNames={showGroupNamesDiagram}
                    showMicroOnHover={showMicroOnHover}
                    showWrapFlash={false}
                    tooltipsEnabled={tooltipPrefs.diagram}
                    cycleLengthInput={String(cycleLength)}
                    setCycleLengthInput={noop}
                    onGroupClick={noop}
                    updateGroupParams={noop}
                    updateActionRow={noop}
                    startDrag={noop}
                    endDrag={noop}
                    setHoveredActionId={setHoveredActionId}
                    setHoveredGroupId={setHoveredArrowGroupId}
                    setHoveredDiagramTime={noop}
                    setIsPlayingSimulation={noop}
                    setSimulationCurrentTime={noop}
                    setCycleLength={noop}
                    onDragConflicts={noop}
                    updateRemarques={noop}
                />
            </div>
        );
    }, [showFloatingDiagram, groups, globalTime, pixelsPerSecond, displayConflicts, conflictMatrix, cycleLength, actionData, simulationEnabled, simulationSelectedActions, simulationResult, simulationCurrentTime, isPlayingSimulation, hoveredActionId, hoveredArrowGroupId, hoveredArrowGroupSaturated, hoveredConflict, hoveredVUtile, activePFName, biCarrefourSeparator, showGroupNamesDiagram, showMicroOnHover, tooltipPrefs, diagramPopup.renderToPopup]);

    // Render conflicts list into popup window
    useEffect(() => {
        if (!showFloatingConflicts) return;
        conflictsPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <ConflictList
                    detached
                    conflicts={displayConflicts}
                    groups={groups}
                    isConflictGrayed={isConflictGrayed}
                    setHoveredConflict={setHoveredConflict}
                />
            </div>
        );
    }, [showFloatingConflicts, displayConflicts, groups, isConflictGrayed, setHoveredConflict, conflictsPopup.renderToPopup]);

    // Render traffic table into popup window
    useEffect(() => {
        if (!showFloatingTraffic) return;
        trafficPopup.renderToPopup(
            <div style={{ padding: '12px', height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
                <TrafficTable
                    groups={groups}
                    cycleLength={cycleLength}
                    activeTrafficDataset={activeTrafficDataset}
                    setActiveTrafficDataset={setActiveTrafficDataset}
                    updateTrafficData={updateTrafficData}
                    getTrafficData={getTrafficData}
                    updateGroupParams={updateGroupParams}
                    setHoveredGroupId={setHoveredArrowGroupId}
                    hoveredGroupId={hoveredArrowGroupId}
                    setHoveredGroupSaturated={setHoveredArrowGroupSaturated}
                    trafficDatasetNames={trafficDatasetNames}
                    trafficDatasetSourceNames={trafficDatasetSourceNames}
                    setHoveredVUtile={setHoveredVUtile}
                    copyTrafficDataset={copyTrafficDataset}
                    addCustomTrafficDataset={addCustomTrafficDataset}
                    infoSuppressionJeu={infoSuppressionJeuTrafic}
                    supprimerJeu={supprimerJeuTrafic}
                    actionData={actionData}
                    simulationSelectedActions={simulationSelectedActions}
                    simulationResult={simulationResult}
                    readOnly={simulationEnabled}
                tooltipsEnabled={tooltipPrefs.traffic}
                />
            </div>
        );
    }, [showFloatingTraffic, groups, cycleLength, activeTrafficDataset, actionData,
        simulationSelectedActions, simulationResult, simulationEnabled, hoveredArrowGroupId,
        trafficPopup.renderToPopup, updateTrafficData,
        getTrafficData, updateGroupParams, trafficDatasetNames, trafficDatasetSourceNames, copyTrafficDataset, addCustomTrafficDataset,
        infoSuppressionJeuTrafic, supprimerJeuTrafic]);

    // Afficher l'écran de connexion si non authentifié
    // Écran de connexion seulement si les comptes sont activés sur ce poste.
    // Par défaut ils ne le sont pas : on entre directement dans l'application.
    if (accountsEnabled && !isAuthenticated) {
        return (
            <LoginModal
                onLogin={login}
                onCreateUser={createUser}
                hasUsers={hasUsers()}
                isLoading={authLoading}
            />
        );
    }

    return (
        <div className={`app-container${(dossierReadOnly || activePfReadOnly) ? ' dossier-readonly' : ''}`}>
            <MenuBar
                    onAction={handleMenuAction}
                    arrowStyle={diagramArrowStyle}
                    onArrowStyleChange={setDiagramArrowStyle}
                    importedFiles={importedHTMFiles}
                    recentDirectories={getRecentDirectoriesForMenu()}
                    recentOpenDirs={recentOpenDirs}
                    recentImportDirs={recentImportDirs}
                    recentSaveDirs={recentSaveDirs}
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    hasActiveProject={hasActiveProject}
                    onManageUsers={() => setShowUserManager(true)}
                    accountsEnabled={accountsEnabled}
                    biCarrefourSeparator={biCarrefourSeparator}
                    layoutOptions={{ showParameters: sidebarVisible, showComments, showRemarks, commentsMode, remarksMode, darkMode, colorTheme, showGroupNamesForm, showGroupNamesMatrix, showGroupNamesDiagram, showActionDescription, descriptionMode, projectModified, showFloatingImage, hasIntersectionImage: !!intersectionImage, showFloatingMatrix, showFloatingForm, showFloatingProperties, showFloatingTraffic, showFloatingConditions, showFloatingVariables, showFloatingRemarks, showFloatingDiagram, showFloatingConflicts, showFloatingDiagnostic, showFloatingLegend, showCapacityReserve, matricesLocked, dossierReadOnly, hasMultiplePf: pfTabs.length > 1, toastPrefs, openPropertiesOnNewProject, showWrapFlash, showSaveReminder, phasageBulleEnabled, simulationEnabled, activeTab, isExampleProject: isExample, tooltipPrefs }}
                    pixelsPerSecond={pixelsPerSecond}
                    onPixelsPerSecondChange={setPixelsPerSecond}
                    showMicroOnHover={showMicroOnHover}
                    initialOpenMenu={!hasActiveProject ? 'fichier' : null}
                    pfCount={pfTabs.length}
                    traficRenseigne={traficRenseigne}
                />
            <WelcomeScreen
                hasActiveProject={hasActiveProject}
                showExampleInvite={showExampleInvite}
            />
            {hasActiveProject && (<>
            <ProjectHeader
                project={{ projectName, setProjectName, isDirty, projectNameInputRef }}
                groupCount={{ groups, groupCountInput, setGroupCountInput, setGroupCount, askConfirm }}
                history={{ undo, redo, canUndo, canRedo }}
                dependencies={{
                    showDependencies,
                    setShowDependencies,
                    dependencyGap,
                    setDependencyGap,
                    conflicts: displayActiveConflicts,
                }}
                plan={{ pfTabs, activePFId, setPFColor }}
                account={{ accountsEnabled, currentUser, logout }}
                help={{ helpZoneRef, tip }}
                example={isExample}
                readOnly={dossierReadOnly}
            />
            <main className="split-view" ref={splitViewRef}>
                <WorkspaceSidebar
                    model={{
                        sidebarVisible, phasageBulleEnabled, sidebarWidth, groups, intersectionArrows,
                        phasageBulleVisibleGroups, hoveredPhasageGroupId, setHoveredPhasageGroupId, togglePhasageBulleGroup, setPhasageBulleVisibleGroups,
                        tip, simulationEnabled, actionData, simulationSelectedActions, toggleSimulationAction,
                        cycleLength, conflictMatrix, setMatrixValue, hoveredActionId,
                        setHoveredActionId, setSurvolActionSimulation, setHoveredConflict, simulationName, simulationScenarios, choisirScenarioSimulation,
                        creerScenarioSimulation, enregistrerScenarioSimulation, supprimerScenarioSimulation, activeTrafficDataset,
                        setActiveTrafficDataset, updateTrafficData, getTrafficData, updateGroupParams, setHoveredArrowGroupId,
                        hoveredArrowGroupId, setHoveredArrowGroupSaturated, trafficDatasetNames, trafficDatasetSourceNames, setHoveredVUtile, copyTrafficDataset,
                        addCustomTrafficDataset, infoSuppressionJeuTrafic, supprimerJeuTrafic, simulationResult, setShowFloatingTraffic, tooltipPrefs, activeTab,
                        setActiveTab, setSidebarWidth, intersectionName, setIntersectionName, projectProperties,
                        updateProjectProperty, appCommunes, appMoaLogos, appMoeLogos, setShowFloatingProperties,
                        showGroupNamesForm, setShowFloatingForm, activePFId,
                        pfTabs, biCarrefourSeparator, showGroupNamesMatrix, matricesLocked, setShowFloatingMatrix,
                        showCapacityReserve, showFloatingDiagnostic, setShowFloatingDiagnostic, displayConflicts, isConflictGrayed,
                        showFloatingConflicts, setShowFloatingConflicts, recentOpenDirs, recentSaveDirs, recentImportDirs,
                        helpZoneRef,
                    }}
                />

                <WorkspaceMain
                    model={{
                        actionColWidths, actionData, activePFId, activePfReadOnly, addRecentDirectory,
                        biCarrefourSeparator, brouillonPhasage, conflictMatrix, currentRemarques, cycleLength,
                        cycleLengthInput, cycleSimulationSpeed, dependencyGap, diagramAreaRef, diagramHeight,
                        displayConflicts, dossierReadOnly, draggedTabIndex, endDrag,
                        globalTime, groups, handleActionPanelResize, handleDiagramResizeStart, handleResizeStart,
                        helpZoneRef, hoveredActionId, hoveredArrowGroupId, flechesActionSimulation, hoveredArrowGroupSaturated, hoveredConflict,
                        hoveredDiagramTime, hoveredPhasageGroupId, hoveredVUtile, imageBrightness, imageContrast,
                        imageFondClair, intersectionArrows, intersectionDisplay, intersectionImage, intersectionName, isPlayingSimulation,
                        isResizing, isResizingDiagram, lastImageDirectoryRef, microCustomFields, pfTabs,
                        phasageBubbleRatio, phasageBubbleScale, phasageBulleCount, phasageBulleEnabled, phasageBulleModal,
                        phasageBulleTimes, phasageBulleVersion, phasageBulleVisibleGroups, phasageEllipseScale, phasageModifie,
                        pixelsPerSecond, recentImageDirs, renamePF, reorderActions, reorderPF,
                        resetDiagramHeight, saveDirectoryHandle, setActionColWidths, setActivePFId: selectActivePF, setBrouillonPhasage,
                        setCycleLength, setCycleLengthInput, setDragConflictsFromDiagram, setDraggedTabIndex, setHoveredActionId,
                        setHoveredArrowGroupId, setHoveredDiagramTime, setHoveredPhasageGroupId, setImageBrightness, setImageContrast,
                        setIntersectionArrows, setIntersectionDisplayOption, setIntersectionImage, setIsPlayingSimulation, setPhasageBubbleRatio, setPhasageBubbleScale,
                        setPhasageBulleCount, setPhasageBulleEnabled, setPhasageBulleModal, setPhasageBulleTimes, setPhasageBulleVersion,
                        setPhasageEllipseScale, setSelectedGroupId, setShowFloatingConditions, setShowFloatingDiagram, openFloatingImage,
                        setShowFloatingVariables, setSidebarWidth, setSimulationCurrentTime, setSimulationEnabled, showActionDescription, revelerDescription,
                        showComments, showDependencies, showFloatingConditions, showFloatingDiagram, showFloatingRemarks,
                        showFloatingVariables, showGroupNamesDiagram, showMicroOnHover, showRemarks, showWrapFlash,
                        sidebarVisible, simulationCurrentTime, simulationEnabled, simulationResult, simulationSelectedActions,
                        simulationSpeed, startDrag, tip, tooltipPrefs, updateActionRow,
                        updateGroupParams, updateMicroCustomField, updatePFRemarques,
                    }}
                />
            </main>
            </>)}

            <ProjectOpenDialog
                isOpen={openModal}
                onClose={() => setOpenModal(false)}
                projects={getAllSaves()}
                selectedProject={selectedProject}
                onSelect={setSelectedProject}
                onOpen={handleOpenProject}
            />

            <DiagramEditDialogs
                groups={groups}
                cycleLength={cycleLength}
                tip={tip}
                slide={{
                    isOpen: slideModal,
                    onClose: () => setSlideModal(false),
                    fromGroup: slideFromGroup,
                    onFromGroupChange: (value) => { setSlideFromGroup(value); setSlideTouched(true); },
                    toGroup: slideToGroup,
                    onToGroupChange: (value) => { setSlideToGroup(value); setSlideTouched(true); },
                    value: slideValue,
                    onValueChange: (value) => { setSlideValue(value); setSlideTouched(true); },
                    touched: slideTouched,
                    onConfirm: handleSlide,
                }}
                insert={{
                    isOpen: insertModal,
                    onClose: () => setInsertModal(false),
                    start: insertStart,
                    onStartChange: (value) => { setInsertStart(value); setInsertTouched(true); },
                    duration: insertDuration,
                    onDurationChange: (value) => { setInsertDuration(value); setInsertTouched(true); },
                    touched: insertTouched,
                    onConfirm: handleInsert,
                }}
                reduce={{
                    isOpen: reduceModal,
                    onClose: () => setReduceModal(false),
                    start: reduceStart,
                    onStartChange: (value) => { setReduceStart(value); setReduceTouched(true); },
                    duration: reduceDuration,
                    onDurationChange: (value) => { setReduceDuration(value); setReduceTouched(true); },
                    touched: reduceTouched,
                    onConfirm: handleReduce,
                }}
                moveGroup={{
                    isOpen: moveGroupModal,
                    onClose: () => setMoveGroupModal(false),
                    groupId: groupToMove,
                    onGroupChange: (value) => { setGroupToMove(value); setMoveGroupTouched(true); },
                    afterGroupId: moveAfterGroup,
                    onAfterGroupChange: (value) => { setMoveAfterGroup(value); setMoveGroupTouched(true); },
                    touched: moveGroupTouched,
                    onConfirm: () => {
                        moveGroupToPosition(parseInt(groupToMove), parseInt(moveAfterGroup));
                        setMoveGroupTouched(false);
                    },
                }}
                biCarrefour={{
                    isOpen: biCarrefourModal,
                    onClose: () => setBiCarrefourModal(false),
                    groupId: biCarrefourGroupId,
                    onGroupChange: (value) => { setBiCarrefourGroupId(value); setBiCarrefourTouched(true); },
                    touched: biCarrefourTouched,
                    onConfirm: () => {
                        setBiCarrefourSeparator(parseInt(biCarrefourGroupId));
                        setBiCarrefourModal(false);
                    },
                }}
            />

            <NouveauPlanDialog
                isOpen={nouveauPlanModal}
                onClose={() => setNouveauPlanModal(false)}
                planName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                jeuxAvecDonnees={jeuxAvecDonnees}
                jeuActif={activeTrafficDataset}
                onAssocier={setActiveTrafficDataset}
                onSuggererCycle={() => setSuggestionCycleModal(true)}
                onOuvrirTrafic={() => { setSidebarVisible(true); setActiveTab('traffic'); }}
            />
            <SuggestionCycleDialog
                isOpen={suggestionCycleModal}
                onClose={() => setSuggestionCycleModal(false)}
                planName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                groups={groups}
                conflictMatrix={conflictMatrix}
                cycleLength={cycleLength}
                getTrafficData={getTrafficData}
                trafficDatasetName={activeTrafficDataset}
                phasageCycle={phasageCycle}
                setPhasageCycle={setPhasageCycle}
                setCycleLength={setCycleLength}
                setPhasageBulleCount={setPhasageBulleCount}
                setPhasageBulleTimes={setPhasageBulleTimes}
                updateGroupParams={updateGroupParams}
                intersectionArrows={intersectionArrows}
                ajouterActions={ajouterActions}
                readOnly={dossierReadOnly || activePfReadOnly}
            />
            <SupportDialogs
                model={{
                        aboutModal, actionData, activePFId, activePfReadOnly, conflictMatrix,
                        cycleLength, diagnosticIncludeProject, diagnosticMaskNames, diagnosticModal, diagnosticRefresh,
                        dossierReadOnly, groups, helpAnchor, helpModal, imageNaturalDims,
                        intersectionImage, intersectionName, matricesLocked, microVariablesModal, optionsModal,
                        pfTabs, projectName, setAboutModal, setDiagnosticIncludeProject, setDiagnosticMaskNames,
                        setDiagnosticModal, setDiagnosticRefresh, setHelpModal, setMicroVariablesModal, setOptionsModal,
                        tip, tooltipPrefs,
                }}
            />

            <ImportDialogs
                spreadsheet={{
                    isOpen: importModal,
                    onClose: () => setImportModal(false),
                    hintDirectory: importHintDir,
                    onFileSelect: handleFileSelect,
                    file: importFile,
                    error: importError,
                    onImport: handleImport,
                }}
                html={{
                    isOpen: importHTMModal,
                    onClose: () => setImportHTMModal(false),
                    onFileSelect: handleHTMFileSelect,
                    file: htmFile,
                    error: htmImportError,
                    onImport: handleHTMImport,
                }}
                recent={{
                    files: recentFiles,
                    directories: getRecentDirectories(),
                    formatDate,
                    onFileClick: (file) => showAlert({
                        title: 'Re-sélection du fichier nécessaire',
                        message: `Pour réimporter « ${file.name} », veuillez le sélectionner à nouveau via le bouton ci-dessus.\n\nPour des raisons de sécurité, le navigateur ne permet pas d'accéder directement aux fichiers précédemment sélectionnés.`,
                    }),
                }}
                tip={tip}
            />

            <GreenWaveDialogs
                openDialog={{
                    isOpen: openGreenWaveModal,
                    onClose: () => setOpenGreenWaveModal(false),
                    savedGreenWaves: getSavedGreenWaves(),
                    selectedName: selectedGreenWave,
                    onSelect: setSelectedGreenWave,
                    onOpen: handleOpenSavedGreenWave,
                    onDelete: deleteGreenWave,
                    formatDate,
                }}
                createDialog={{
                    isOpen: createGreenWaveModal,
                    onClose: () => setCreateGreenWaveModal(false),
                    onConfirm: handleCreateGreenWave,
                    getAllSaves,
                    // Le cache ne contient que des projets enregistrés au format courant.
                    loadProjectData: (name: string) => getProjectData(name) as GreenWaveProjectSource | null,
                }}
                viewer={{
                    isOpen: greenWaveViewer,
                    onClose: () => setGreenWaveViewer(false),
                    intersections: greenWaveData,
                }}
                tip={tip}
            />

            {/* Modal Phasage bulle supprimé - remplacé par panneau flottant dans la zone phasage bulle */}

            <DossierPrintDialog
                isOpen={dossierDialog}
                onClose={() => setDossierDialog(false)}
                portrait={dossierPortrait}
                setPortrait={setDossierPortrait}
                sections={dossierSections}
                setSections={setDossierSections}
                plans={pfTabs}
                contexteScenarios={{ activePFId, groups, cycleLength, actionData, conflictMatrix }}
                intersectionImage={intersectionImage}
                intersectionArrows={intersectionArrows}
                onExportPdf={handleDossierExportPDF}
                onPrint={handleDossierConfirm}
                tip={tip}
            />

            <PrintPreviewModal
                isOpen={printPreviewModal}
                onClose={() => setPrintPreviewModal(false)}
                project={{ projectName, intersectionName, projectProperties, groups, conflictMatrix, cycleLength }}
                plans={{ pfTabs, activePFId, pfTrafficDatasetMap }}
                traffic={{ activeTrafficDataset, trafficDatasets, trafficDatasetNames }}
                image={{ intersectionImage, intersectionArrows, imageBrightness, imageContrast, imageNaturalDims }}
                print={{
                    printType,
                    dossierSections,
                    dossierPortrait,
                    dossierPrintWidth,
                    descriptionPrintStyle,
                    largeurConditionsImpression,
                    microPrintStyle,
                    printPreviewPageRef,
                    imprimerApercu,
                }}
                actions={{ actionData, microCustomFields }}
                preferences={{ tooltipPrefs }}
            />

            {/* User Manager Modal */}
            <UserManagerModal
                isOpen={showUserManager}
                onClose={() => setShowUserManager(false)}
                currentUser={currentUser}
                getUsersList={getUsersList}
                createUser={createUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
                resetPassword={resetPassword}
                exportUsersToFile={exportUsersToFile}
                importUsersFromFile={importUsersFromFile}
            />

            {/* External Links Modal */}
            <ExternalLinksModal
                isOpen={showExternalLinksModal}
                onClose={() => setShowExternalLinksModal(false)}
                links={externalLinks}
                onLinksChange={setExternalLinks}
            />

            {/* La légende est désormais rendue dans une fenêtre détachée
                (legendPopup / usePopupWindow) — voir l'effet renderToPopup. */}
            {isSaving && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        background: '#222',
                        color: '#4ecdc4',
                        border: '1px solid #4ecdc4',
                        borderRadius: '8px',
                        padding: '20px 40px',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>
                        Sauvegarde en cours...
                    </div>
                </div>
            )}
            {showExportPfModal && (
                <ExportPfModal
                    pfTabs={pfTabs}
                    activePFId={activePFId}
                    onExport={(ids, readOnly) => { setShowExportPfModal(false); handleExportPfSubset(ids, readOnly); }}
                    onClose={() => setShowExportPfModal(false)}
                />
            )}
            {importPfData && (
                <ImportPfModal
                    name={importPfData.name}
                    pfTabs={importPfData.state.pfTabs}
                    onImport={handleImportProjectPf}
                    onClose={() => setImportPfData(null)}
                />
            )}
            {showCopyMatrixModal && (
                <CopyMatrixModal
                    pfTabs={pfTabs}
                    activePFId={activePFId}
                    onCopy={(sourceId) => {
                        setShowCopyMatrixModal(false);
                        const srcName = pfTabs.find(p => p.id === sourceId)?.name || '';
                        if (copyMatrixFromPF(sourceId)) {
                            toast.success(`Matrice copiée depuis « ${srcName} »`);
                        } else {
                            showAlert({ title: 'Copie impossible', message: 'La matrice n\'a pas pu être copiée (tailles différentes ou plan en lecture seule).' });
                        }
                    }}
                    onClose={() => setShowCopyMatrixModal(false)}
                />
            )}
            <input
                ref={projectPfInputRef}
                type="file"
                accept=".json"
                onChange={handleProjectPfFileSelect}
                style={{ display: 'none' }}
            />

            {/* Import DiagFeux : input caché déclenché par le menu Importer.
                Les projets DiagFeux portent l'extension .dfe (contenu XML) ;
                on accepte aussi .xml pour les fichiers déjà renommés/exportés. */}
            <input
                ref={diagfeuxInputRef}
                type="file"
                accept=".dfe,.xml"
                onChange={handleDiagfeuxFileSelect}
                style={{ display: 'none' }}
            />
            <ToastContainer />
        </div>
    )
}

export default App
