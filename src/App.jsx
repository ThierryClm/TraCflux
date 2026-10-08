import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTrafficLight } from './hooks/useTrafficLight';
import { MAX_PF, mergePfFromProject } from './utils/pfHelpers';
import { useAuth } from './hooks/useAuth';
import TimelineDiagram from './components/TimelineDiagram';
import ToastContainer from './components/ToastContainer';
import { toast, getToastPrefs, setToastPref } from './utils/toast';
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
import { APP_VERSION, APP_NAME } from './version';
import { buildExportFilename } from './utils/exportFilename';
import { safeShowOpenFilePicker } from './utils/filePicker';
import { isInviteVisible, noteWelcomeView, noteProjectSeen } from './utils/welcomeInvite';
import { isExampleSession, exitExampleSession } from './utils/exampleMode';
import LoginModal from './components/LoginModal';
import UserManagerModal from './components/UserManagerModal';
import ExternalLinksModal from './components/ExternalLinksModal';
import PropertiesPanel from './components/PropertiesPanel';
import { calculateSimulatedDiagram } from './utils/simulationCalculator';
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
import useFloatingImage from './hooks/useFloatingImage';
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
import { lireMiseEnPage, appliquerMiseEnPage } from './utils/miseEnPageProjet';

function App() {
    const askConfirm = useConfirm();
    const showAlert = useAlert();
    // Champs de projet portés par d'autres modules que le modèle : ils doivent
    // voyager avec le dossier plutôt que rester des préférences d'application.
    // Réf parce que ces modules sont créés plus bas ; elle n'est lue qu'à
    // l'enregistrement et à l'ouverture.
    const champsProjetRef = useRef({ lire: () => ({}), ecrire: () => {} });

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
        getGroupState,
        updateGroupParams,
        moveGroupToPosition,
        saveProject,
        loadProject,
        getAllSaves,
        getProjectData,
        deleteSave,
        getFullState,
        loadFullState: loadFullStateRaw,
        resetToNewProject,
        actionData,
        updateActionRow,
        reorderActions,
        microCustomFields,
        updateMicroCustomField,
        phasageBulleCount,
        phasageBulleTimes,
        setPhasageBulleCount,
        setPhasageBulleTimes,
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
        updateSimulationName,
        toggleSimulationAction,
        selectAllSimulationActions,
        deselectAllSimulationActions,
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

    const [dragConflictsFromDiagram, setDragConflictsFromDiagram] = useState(null);

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
                const sourceGfId = parseInt(action.gf?.toString().replace(/[Gg]/g, '').trim()) || 0;
                const targetGfId = parseInt(action.actGf1?.toString().replace(/[Gg]/g, '').trim()) || 0;
                return (sourceGfId === c.from && targetGfId === c.to) ||
                       (sourceGfId === c.to && targetGfId === c.from);
            });
            return !isInhibitedByEscamotage;
        });
    }, [conflicts, simulationEnabled, simulationSelectedActions, actionData]);

    // Further filter: separate conflicts involving groups with phaseFlag (aiguillage/escamotage)
    const activeConflicts = useMemo(() => {
        return filteredConflicts.filter(c => {
            const fromGroup = groups.find(g => g.id === c.from);
            const toGroup = groups.find(g => g.id === c.to);
            return !fromGroup?.phaseFlag;
        });
    }, [filteredConflicts, groups]);

    // During drag, use drag conflicts from TimelineDiagram; otherwise use normal conflicts
    const displayConflicts = dragConflictsFromDiagram || filteredConflicts;
    const displayActiveConflicts = useMemo(() => {
        return (dragConflictsFromDiagram || activeConflicts).filter ?
            (dragConflictsFromDiagram || filteredConflicts).filter(c => {
                const fromGroup = groups.find(g => g.id === c.from);
                return !fromGroup?.phaseFlag;
            }) : activeConflicts;
    }, [dragConflictsFromDiagram, filteredConflicts, activeConflicts, groups]);

    // Check if a conflict's first group has phaseFlag (for grayed display)
    const isConflictGrayed = useCallback((c) => {
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

    // État pour le modal de gestion des utilisateurs
    const [showUserManager, setShowUserManager] = useState(false);

    const [selectedGroupId, setSelectedGroupId] = useState(null);
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
    const [hoveredActionId, setHoveredActionId] = useState(null);
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
    // Preferences "Infobulles..." (Mise en page). 6 sections, toutes
    // cochees par defaut. Persiste au niveau de l'application (localStorage).
    const [tooltipPrefs, setTooltipPrefsState] = useState(() => {
        try {
            const raw = localStorage.getItem('tracflux.tooltips');
            const def = { main: true, config: true, diagram: true, matrix: true, traffic: true, micro: true };
            if (!raw) return def;
            const parsed = JSON.parse(raw);
            return { ...def, ...parsed };
        } catch {
            return { main: true, config: true, diagram: true, matrix: true, traffic: true, micro: true };
        }
    });
    const setTooltipPref = useCallback((key) => {
        setTooltipPrefsState(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try { localStorage.setItem('tracflux.tooltips', JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);
    // Helper local : utilise tooltipPrefs.main pour les title= de App.jsx.
    const tip = (text) => tooltipPrefs.main ? text : undefined;
    const [showSaveReminder, setShowSaveReminder] = useState(() => {
        const saved = localStorage.getItem('showSaveReminder');
        return saved === null ? true : saved === 'true';
    });
    // Au lancement, l'app est « vide » : pas de projet chargé, l'interface
    // principale est masquée et seul le menu reste accessible. Devient true
    // dès que l'utilisateur déclenche « Nouveau projet » ou ouvre un projet.
    const [hasActiveProject, setHasActiveProject] = useState(false);
    // Invitation « projet exemple » sur l'écran d'accueil : visible tant que
    // l'utilisateur est un nouvel arrivant (cf. utils/welcomeInvite).
    // Figée au montage pour que la décision ne change pas en cours de rendu.
    const [showExampleInvite] = useState(() => isInviteVisible('diagram'));
    // Projet exemple : modifiable mais non enregistrable (cf. utils/exampleMode).
    const [isExample, setIsExample] = useState(() => isExampleSession());
    const leaveExampleMode = useCallback(() => {
        if (isExampleSession()) { exitExampleSession(); setIsExample(false); }
    }, []);
    // Tout chargement de VRAI projet (Ouvrir, Restaurer, Dupliquer, import…)
    // passe par ce wrapper et quitte le mode exemple. Seul l'effet de
    // chargement de l'exemple appelle loadFullStateRaw et reste en mode
    // exemple.
    const loadFullState = useCallback((...args) => {
        leaveExampleMode();
        return loadFullStateRaw(...args);
    }, [loadFullStateRaw, leaveExampleMode]);
    const welcomeViewNoted = useRef(false);
    const projectSeenNoted = useRef(false);
    const projectNameInputRef = useRef(null);
    // Référence vers la fenêtre Onde verte ouverte (single instance).
    // Permet de ré-utiliser la même fenêtre au lieu d'en ouvrir une nouvelle
    // à chaque clic. Si la fenêtre est fermée par l'utilisateur, .closed
    // passe à true et on ouvre une nouvelle.
    const greenWaveWindowRef = useRef(null);

    // Ouvre la fenêtre Onde verte à l'URL fournie, ou y bascule le focus si
    // elle est déjà ouverte. Si l'URL diffère, navigue dedans (l'auto-save
    // ayant déjà persisté l'état courant).
    const openOrFocusGreenWave = (url) => {
        try {
            if (greenWaveWindowRef.current && !greenWaveWindowRef.current.closed) {
                // Fenêtre déjà ouverte : focus + navigation si URL différente
                try {
                    if (greenWaveWindowRef.current.location.href !== url) {
                        greenWaveWindowRef.current.location.href = url;
                    }
                } catch {
                    // Cross-origin (improbable, même origine) : on tente la nav directe
                    greenWaveWindowRef.current.location = url;
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
    // Anchor à atteindre dans la modale d'aide (alimenté par l'URL ?openHelp=…).
    // Passé à <HelpContent /> via la prop initialAnchor.
    const [helpAnchor, setHelpAnchor] = useState(null);
    const [aboutModal, setAboutModal] = useState(false);
    const [diagnosticModal, setDiagnosticModal] = useState(false);
    const [capacityCompareModal, setCapacityCompareModal] = useState(false);
    const [diagnosticIncludeProject, setDiagnosticIncludeProject] = useState(false);
    // Noms masqués par défaut : un rapport est destiné à une issue publique,
    // et ces noms désignent une commune et des rues réelles.
    const [diagnosticMaskNames, setDiagnosticMaskNames] = useState(true);
    const [diagnosticRefresh, setDiagnosticRefresh] = useState(0);
    const printPreviewPageRef = useRef(null);

    // Intersection image animation state
    const {
        isPlayingSimulation, setIsPlayingSimulation,
        simulationCurrentTime, setSimulationCurrentTime,
        hoveredDiagramTime, setHoveredDiagramTime,
        simulationSpeed, cycleSimulationSpeed
    } = useSimulationUI();
    const [hoveredArrowGroupId, setHoveredArrowGroupId] = useState(null);
    const [hoveredArrowGroupSaturated, setHoveredArrowGroupSaturated] = useState(false);
    const [hoveredConflict, setHoveredConflict] = useState(null); // {from, to} for conflict hover
    const [isSaving, setIsSaving] = useState(false);

    // Track whether project has been modified (for "Nouveau projet" menu)
    const { projectModified, setProjectModified, resetModified: resetProjectModified, projectModifiedSkip, hasUnsavedChanges, isDirty, setHasUnsavedChanges } =
        useProjectModification([groups, actionData, cycleLength, conflictMatrix, projectProperties, intersectionName, capacityCompareSelection, capacityCompareDataset]);

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

    // Floating conditions & variables states (lifted from ActionTable for menu control)
    // Persistés au niveau application (localStorage) — préférence d'espace de
    // travail qui ne voyage pas avec le projet.
    const [showFloatingConditions, setShowFloatingConditions] = useState(() => {
        try { return localStorage.getItem('floating_conditions_visible') === 'true'; } catch { return false; }
    });
    const [showFloatingVariables, setShowFloatingVariables] = useState(() => {
        try { return localStorage.getItem('floating_variables_visible') === 'true'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('floating_conditions_visible', String(showFloatingConditions)); } catch {}
    }, [showFloatingConditions]);
    useEffect(() => {
        try { localStorage.setItem('floating_variables_visible', String(showFloatingVariables)); } catch {}
    }, [showFloatingVariables]);

    // Miroir de présentation du diagramme (fenêtre détachée, lecture seule).
    const [showFloatingDiagram, setShowFloatingDiagram] = useState(() => {
        try { return localStorage.getItem('floating_diagram_visible') === 'true'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('floating_diagram_visible', String(showFloatingDiagram)); } catch {}
    }, [showFloatingDiagram]);

    // Liste des conflits détachée (mise en évidence sur un écran).
    const [showFloatingConflicts, setShowFloatingConflicts] = useState(() => {
        try { return localStorage.getItem('floating_conflicts_visible') === 'true'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('floating_conflicts_visible', String(showFloatingConflicts)); } catch {}
    }, [showFloatingConflicts]);

    // Affichage du panneau « Réserve de capacité » sous le tableau trafic
    // (préférence d'espace de travail, cochée par défaut ; menu Mise en page).
    const [showCapacityReserve, setShowCapacityReserve] = useState(() => {
        try { return localStorage.getItem('show_capacity_reserve') !== 'false'; } catch { return true; }
    });
    useEffect(() => {
        try { localStorage.setItem('show_capacity_reserve', String(showCapacityReserve)); } catch {}
    }, [showCapacityReserve]);

    // V.Utile hover state: { groupId, vUtile } when hovering V.Utile cell
    const [hoveredVUtile, setHoveredVUtile] = useState(null);

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
    const [tailleComparateur, setTailleComparateur] = useState(null);
    const noterTailleComparateur = useCallback((taille) => {
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

    // Le scénario du plan actif, recalculé POUR L'IMPRESSION.
    //
    // Distinct du précédent, et à dessein. Celui-ci n'existe que pendant que
    // l'onglet Simulation est ouvert — c'est ce qui fait basculer le diagramme
    // à l'écran en mode simulé, et il ne doit surtout pas le faire en dehors.
    // Mais depuis que le scénario est enregistré avec son plan de feu, il reste
    // imprimable une fois l'onglet refermé : sans cette seconde lecture, il
    // aurait fallu rouvrir l'onglet Simulation avant chaque tirage, et la case
    // « Scénario » serait restée grise alors qu'un scénario est bel et bien là.
    const simulationResultImpression = useMemo(() => {
        if (!simulationSelectedActions || simulationSelectedActions.length === 0) return null;
        return calculateSimulatedDiagram(
            groups, actionData, simulationSelectedActions, cycleLength, conflictMatrix
        );
    }, [groups, actionData, simulationSelectedActions, cycleLength, conflictMatrix]);

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

    // Repli de la colonne « Action_Micro » à l'impression, en caractères.
    //
    // Il ne se DÉDUIT pas : une estimation de la chasse à partir de la taille de
    // police donnait 41 caractères là où l'écran en met 57, et les équations se
    // coupaient ailleurs. On MESURE donc le champ tel qu'il est rendu — largeur
    // utile divisée par la largeur d'un caractère, exacte en chasse fixe — et
    // l'unité ch reporte ce compte à l'impression, quelle que soit la taille du
    // texte imprimé. Les lignes se coupent alors aux mêmes endroits.
    // Largeur du conteneur d'impression du dossier, en px CSS.
    //
    // La mise en page d'impression a son propre gabarit : ni le papier converti
    // en pixels CSS (1047), ni la largeur de la fenêtre. Sur ce poste, la mesure
    // relevée pendant le rendu d'impression donne 1683 px — c'est la valeur de
    // départ, corrigée automatiquement ailleurs par la mesure ci-dessous.
    //
    // Cette mesure ne se prend QUE lorsque le média d'impression est actif :
    // « beforeprint » se déclenche encore sur la mise en page d'écran et
    // renvoyait la largeur de la fenêtre, sans rapport avec la feuille.
    // Orientation du dossier imprimé. Le paysage reste la valeur par défaut :
    // c'est lui qui donne au diagramme la largeur nécessaire pour un cycle long.
    const [dossierPortrait, setDossierPortrait] = useState(() => {
        try { return localStorage.getItem('dossier_orientation') === 'portrait'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem('dossier_orientation', dossierPortrait ? 'portrait' : 'paysage'); } catch { /* quota */ }
    }, [dossierPortrait]);

    // Largeur de la feuille, DÉCIDÉE et non relevée.
    //
    // Elle était mesurée pendant l'impression (`documentElement.clientWidth`) et
    // mise en cache. Or une mesure ne sert qu'à l'impression SUIVANTE : en
    // changeant d'orientation on repartait d'une valeur par défaut, d'où deux
    // tirages nécessaires avant d'obtenir la bonne proportion du diagramme.
    //
    // Le relevé valait exactement la largeur de la feuille entière — 1122 px pour
    // les 297 mm d'une A4 paysage, soit 96 px par pouce. On peut donc la calculer
    // plutôt que l'attendre, ce qui supprime le décalage d'un tirage.
    // Zone utile, marges de la feuille déduites : 297 - 2 × 10 en paysage,
    // 210 - 2 × 10 en portrait. On y donnait auparavant la largeur de la feuille
    // ENTIÈRE, si bien que le diagramme débordait de 13 mm dans la marge.
    const dossierPrintWidth = (dossierPortrait ? 190 : 277) * (96 / 25.4);

    // Saisie du phasage bulle : brouillon, validé au clic sur OK.
    //
    // Les instants et le nombre de phases s'écrivaient à chaque frappe. « Annuler »
    // ne restaurait donc rien et « OK » ne validait rien : les deux se contentaient
    // de fermer le panneau. Le brouillon rend ces deux boutons conformes à leur nom.
    // null = rien de modifié : le panneau affiche alors les valeurs du plan.
    const [brouillonPhasage, setBrouillonPhasage] = useState(null);

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

    const [microPrintStyle, setMicroPrintStyle] = useState(null);

    // Même recette pour la Description, devenue multiligne : sans report de la
    // largeur d'écran, l'impression replie où elle veut, et sans `pre-wrap`
    // (cf. App.css) les sauts de ligne saisis disparaissent purement.
    //
    // Nuance par rapport à Action_Micro : cette colonne n'a pas de calque
    // d'affichage à mesurer, on mesure donc la zone de saisie elle-même. Elle
    // réserve de quoi loger un caractère de plus, si bien qu'un mot en bout de
    // ligne peut se placer autrement qu'à l'écran.
    const [descriptionPrintStyle, setDescriptionPrintStyle] = useState(null);
    const [largeurTableauConditions, setLargeurTableauConditions] = useState(0);
    /**
     * Relève sur l'écran les largeurs dont l'impression a besoin.
     *
     * Trois mesures, un seul relevé : la largeur totale du tableau des
     * conditions — qui sert à le réduire en portrait — et les largeurs utiles
     * des colonnes Action_Micro et Description, reportées telles quelles à
     * l'impression pour que le navigateur y replie le texte aux mêmes endroits
     * qu'à l'écran.
     *
     * Elle ne se contente plus de tourner au montage. Le tableau n'est pas
     * toujours monté à cet instant — un projet chargé ensuite, l'onglet
     * Simulation ou Phasage actif — et plus rien ne relançait la mesure : la
     * largeur restait à zéro, le tableau partait à l'impression à sa largeur
     * d'écran, sans réduction. Plus large que la feuille en portrait, il
     * faisait alors rétrécir TOUT le document par le navigateur, diagramme
     * compris. Elle est donc aussi appelée à l'ouverture de la boîte
     * d'impression, où le tableau est à coup sûr en place.
     */
    const mesurerColonnesImpression = useCallback(() => {
        const tableau = document.querySelector('.action-table');
        if (tableau?.offsetWidth) setLargeurTableauConditions(tableau.offsetWidth);

        /** Largeur intérieure d'un champ, rembourrage déduit. */
        const utileDe = (champ) => {
            const style = window.getComputedStyle(champ);
            return {
                style,
                utile: champ.clientWidth
                    - (parseFloat(style.paddingLeft) || 0)
                    - (parseFloat(style.paddingRight) || 0)
            };
        };

        // Action_Micro : on mesure le calque d'affichage, pas la zone de saisie.
        // C'est lui que l'utilisateur lit (le texte de la zone de saisie est
        // transparent), et sa largeur de repli est la bonne au pixel près. La
        // zone de saisie, elle, réserve de quoi loger un caractère de plus —
        // d'où le « et » qui montait d'une ligne à l'impression.
        const champMicro = document.querySelector('.action-table .micro-highlight-backdrop')
            || document.querySelector('.action-table .input-micro');
        if (champMicro) {
            const { style, utile } = utileDe(champMicro);
            // Même largeur ET même police : c'est le navigateur qui replie, avec
            // les mêmes données qu'à l'écran, donc aux mêmes endroits. Compter
            // les caractères était une approximation — 62 par ligne à
            // l'impression contre 57 à l'écran — et l'équation se coupait
            // ailleurs, ce qui est précisément ce qu'il faut éviter ici.
            if (utile > 0) setMicroPrintStyle({
                width: `${Math.round(utile)}px`,
                fontFamily: style.fontFamily,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight
            });
        }

        // Description : pas de calque d'affichage, on mesure la zone de saisie.
        const champDesc = document.querySelector('.action-table .input-desc');
        if (champDesc) {
            const { style, utile } = utileDe(champDesc);
            // Pas de fontFamily : à l'écran ce champ est en monospace, comme
            // tout `select` et `textarea` du tableau, mais à l'impression il
            // doit s'aligner sur la colonne Action, en proportionnelle. Le
            // repli peut donc différer d'un mot de celui de l'écran ; la
            // largeur, elle, est respectée.
            if (utile > 0) setDescriptionPrintStyle({
                width: `${Math.round(utile)}px`,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight
            });
        }
    }, []);

    // La mesure se refait au montage et à chaque redimensionnement de colonne.
    // Pas de printType dans les dépendances : il est déclaré plus bas, et le
    // citer ici plantait le module au chargement (accès avant initialisation).
    useEffect(() => {
        mesurerColonnesImpression();
    }, [mesurerColonnesImpression, actionColWidths?.micro, actionColWidths?.description,
        activeTab, simulationEnabled, phasageBulleEnabled]);
    /**
     * Largeur du tableau des conditions à retenir pour l'impression.
     *
     * La mesure d'écran est la bonne valeur — elle porte les colonnes telles que
     * l'utilisateur les a réglées. Mais elle suppose le tableau monté, ce qu'il
     * n'est pas lorsqu'on imprime depuis l'onglet Simulation ou Phasage. Sans
     * repli, le tableau partait alors à sa largeur naturelle, débordait la
     * feuille en portrait, et le navigateur réduisait TOUT le document —
     * diagramme compris, aux trois quarts de sa taille.
     *
     * Le repli reconstruit cette largeur à partir des trois colonnes réglables
     * et d'une constante pour les dix autres, relevée à 343 px sur le tableau
     * par défaut (961 px pour 160 + 420 + 38 de colonnes réglables). Une
     * approximation suffit : elle ne sert qu'à décider d'un facteur de
     * réduction, et quelques pixels d'écart ne se voient pas.
     */
    const LARGEUR_COLONNES_FIXES = 343;
    const largeurConditionsImpression = largeurTableauConditions > 0
        ? largeurTableauConditions
        : LARGEUR_COLONNES_FIXES
            + (actionColWidths?.description ?? 160)
            + (actionColWidths?.micro ?? 420)
            + (actionColWidths?.abrv ?? 38);

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

    const {
        darkMode, setDarkMode,
        colorTheme, setColorTheme,
        showComments, setShowComments,
        showRemarks, setShowRemarks,
        showGroupNamesForm, setShowGroupNamesForm,
        showGroupNamesMatrix, setShowGroupNamesMatrix,
        showGroupNamesDiagram, setShowGroupNamesDiagram,
        showActionDescription, setShowActionDescription
    } = useDarkMode();
    const { recentFiles, setRecentFiles, addToRecentFiles, getRecentDirectories, getRecentDirectoriesForMenu } = useRecentFiles();
    const [selectedProject, setSelectedProject] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [importError, setImportError] = useState('');
    const [importHintDir, setImportHintDir] = useState('');
    const [showExportPfModal, setShowExportPfModal] = useState(false);
    const [showCopyMatrixModal, setShowCopyMatrixModal] = useState(false);
    const [importPfData, setImportPfData] = useState(null); // { name, state } du projet à fusionner
    const diagfeuxInputRef = useRef(null);
    const projectPfInputRef = useRef(null);

    // Import des plans de feux d'un autre projet : lecture + validation, puis
    // ouverture de la modale d'options (lecture seule).
    const handleProjectPfFileSelect = async (e) => {
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
    const handleImportProjectPf = (selectedIds, readOnly) => {
        if (!importPfData) return;
        const ids = new Set(selectedIds);
        const filteredImported = {
            ...importPfData.state,
            pfTabs: importPfData.state.pfTabs.filter(p => ids.has(p.id))
        };
        const { state, warnings, error, addedCount } = mergePfFromProject(getFullState(), filteredImported, { readOnly });
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
    const handleDiagfeuxFileSelect = async (e) => {
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

    // Green wave data states
    const [selectedGreenWave, setSelectedGreenWave] = useState(null);
    const [greenWaveData, setGreenWaveData] = useState(null);
    const [greenWaveListKey, setGreenWaveListKey] = useState(0);

    // Project path
    const [currentProjectPath, setCurrentProjectPath] = useState('');

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
        moveAfterGroup, N���-���jםw)ښ'-��kz˥���)ڗ_:������蠆םn�`z޸�M+z���+a����j�,