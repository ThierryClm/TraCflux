import { useRef, useState, useCallback, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import CustomTooltip from './CustomTooltip';
import RemarquesEditor from './RemarquesEditor';
import TimelineFloatingOverlays from './timeline/TimelineFloatingOverlays';
import TimelineGridBackground, { TimelineEmptyState } from './timeline/TimelineGridBackground';
import TimelineHeader from './timeline/TimelineHeader';
import TimelineRow from './timeline/TimelineRow';
import TimelineSidebar from './timeline/TimelineSidebar';
import { createTimelineGeometry } from './timeline/timelineGeometry';
import { createTimelineSimulation } from './timeline/timelineSimulation';
import { useTimelineDrag } from './timeline/useTimelineDrag';
import type { ContexteIncrustations } from './timeline/incrustations/contexteIncrustations';
import IncrustationAdaptatifVertical from './timeline/incrustations/IncrustationAdaptatifVertical';
import FlechesFermetureAnticipee from './timeline/incrustations/FlechesFermetureAnticipee';
import IncrustationEscamotageDePhase from './timeline/incrustations/IncrustationEscamotageDePhase';
import IncrustationEscamotageGroupe from './timeline/incrustations/IncrustationEscamotageGroupe';
import IncrustationSignalAideConduite from './timeline/incrustations/IncrustationSignalAideConduite';
import IncrustationControleDeFlot from './timeline/incrustations/IncrustationControleDeFlot';
import FlechesPointDeRepos from './timeline/incrustations/FlechesPointDeRepos';
import FlechesSynchroBts from './timeline/incrustations/FlechesSynchroBts';
import FlechesInstantCo from './timeline/incrustations/FlechesInstantCo';
import BarrePrioritePietons from './timeline/incrustations/BarrePrioritePietons';
import BarreFlecheAnticipation from './timeline/incrustations/BarreFlecheAnticipation';
import BarresGroupesFlPp from './timeline/incrustations/BarresGroupesFlPp';
import FlechesDebutBandePassante from './timeline/incrustations/FlechesDebutBandePassante';
import FlechesFinBandePassante from './timeline/incrustations/FlechesFinBandePassante';
import FlechesDependances from './timeline/incrustations/FlechesDependances';
import { useMicroVariables } from './MicroVariablesProvider';
import { resetTextFormatting } from '../utils/resetTextFormatting';
import { entier } from '../utils/entier';
import type { ActionMicro, DrapeauPhase, Groupe, Matrice } from '../types/projet';
import type { SimulationResult } from '../simulation';
import type { TrafficConflict } from '../utils/conflictUtils';
import type { ParametresGroupe } from '../hooks/useTrafficLight';
import type { TimelineActionTooltip } from './timeline/timelineTypes';
import './TimelineDiagram.css';

/** Vert utile survolé dans le tableau de capacité, à reporter sur la barre du groupe. */
export interface VertUtileSurvole {
    groupId: number;
    vUtile: number;
    capacityValue: number | null;
}

export interface TimelineDiagramProps {
    groups: Groupe[];
    /** Reçu de l'appelant, non utilisé par le diagramme. */
    globalTime?: number;
    onGroupClick?: (group: Groupe) => void;
    pixelsPerSecond?: number;
    conflicts: TrafficConflict[];
    conflictMatrix?: Matrice;
    updateGroupParams: (groupId: number, params: ParametresGroupe) => void;
    cycleLength: number;
    actionData?: ActionMicro[];
    updateActionRow?: (rowId: number, field: 'deb' | 'fin', value: string) => void;
    startDrag?: () => void;
    endDrag?: () => void;
    showDependencies?: boolean;
    dependencyGap?: number;
    hoveredActionId?: number | null;
    setHoveredActionId?: (id: number | null) => void;
    /** Actions cochées dans le scénario de simulation ; null hors simulation. */
    simulationFilter?: Set<number> | null;
    simulationResult?: SimulationResult | null;
    simulationCurrentTime?: number | null;
    isPlayingSimulation?: boolean;
    playbackTime?: number | null;
    setIsPlayingSimulation?: (value: boolean) => void;
    setSimulationCurrentTime?: (value: number) => void;
    simulationSpeed?: number;
    cycleSimulationSpeed?: (() => void) | null;
    hoveredArrowGroupId?: number | null;
    hoveredArrowGroupSaturated?: boolean;
    /** Conflit survolé dans la matrice ; isConflict distingue conflit avéré et potentiel. */
    hoveredConflict?: { from: number; to: number; isConflict?: boolean } | null;
    setHoveredGroupId?: ((id: number | null) => void) | null;
    setHoveredDiagramTime?: ((time: number | null) => void) | null;
    hoveredVUtile?: VertUtileSurvole | null;
    planName?: string;
    activePFName?: string;
    remarques?: string;
    updateRemarques?: ((remarques: string) => void) | null;
    biCarrefourSeparator?: number | null;
    showComments?: boolean;
    showRemarks?: boolean;
    showGroupNames?: boolean;
    showMicroOnHover?: boolean;
    showWrapFlash?: boolean;
    cycleLengthInput?: string | number;
    setCycleLengthInput?: (value: string) => void;
    setCycleLength?: (value: number) => void;
    onDragConflicts?: (conflicts: TrafficConflict[] | null) => void;
    remarquesDetached?: boolean;
    tooltipsEnabled?: boolean;
    readOnly?: boolean;
    onDetach?: (() => void) | null;
    scrollable?: boolean;
    titreEnBandeau?: boolean;
}

const TimelineDiagram = ({ groups, globalTime, onGroupClick = () => {}, pixelsPerSecond = 3, conflicts, conflictMatrix = [], updateGroupParams, cycleLength, actionData = [], updateActionRow, startDrag, endDrag, showDependencies = false, dependencyGap = 20, hoveredActionId, setHoveredActionId = () => {}, simulationFilter = null, simulationResult = null, simulationCurrentTime = null, isPlayingSimulation = false, playbackTime = null, setIsPlayingSimulation, setSimulationCurrentTime, simulationSpeed = 1, cycleSimulationSpeed = null, hoveredArrowGroupId = null, hoveredArrowGroupSaturated = false, hoveredConflict = null, setHoveredGroupId: setHoveredGroupIdProp = null, setHoveredDiagramTime = null, hoveredVUtile = null, planName = '', activePFName = '', remarques = '', updateRemarques = null, biCarrefourSeparator = null, showComments = true, showRemarks = true, showGroupNames = true, showMicroOnHover = true, showWrapFlash = true, cycleLengthInput, setCycleLengthInput, setCycleLength, onDragConflicts, remarquesDetached = false, tooltipsEnabled = true, readOnly = false, onDetach = null, scrollable = false, titreEnBandeau = false }: TimelineDiagramProps) => {
    const tip = (text: string | undefined) => tooltipsEnabled ? text : undefined;
    const { names: microVariableNames } = useMicroVariables();
    const containerRef = useRef<HTMLDivElement>(null);
    const activeCommentRef = useRef<HTMLElement | null>(null);
    // Whether the mouse is currently over the diagram container (not the action table)
    // Used to suppress the action tooltip when hovering actions via the ActionTable rows
    const [isMouseInDiagram, setIsMouseInDiagram] = useState(false);

    // Hovered group id for showing dependencies only for that group
    const [hoveredGroupIdLocal, setHoveredGroupIdLocal] = useState<number | null>(null);
    // Use local state for internal logic, but also call prop setter if provided
    const hoveredGroupId = hoveredGroupIdLocal;
    const setHoveredGroupId = useCallback((id: number | null) => {
        setHoveredGroupIdLocal(id);
        if (setHoveredGroupIdProp) {
            setHoveredGroupIdProp(id);
        }
    }, [setHoveredGroupIdProp]);
    // Action tooltip: info at 2s + micro condition at 4s
    const [actionTooltip, setActionTooltip] = useState<TimelineActionTooltip | null>(null);
    const tooltipTimer1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipTimer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
    const actionTooltipMouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (tooltipTimer1Ref.current) { clearTimeout(tooltipTimer1Ref.current); tooltipTimer1Ref.current = null; }
        if (tooltipTimer2Ref.current) { clearTimeout(tooltipTimer2Ref.current); tooltipTimer2Ref.current = null; }
        setActionTooltip(null);

        // Only show the tooltip when the mouse is in the diagram,
        // not when the hover comes from the ActionTable (to avoid redundancy with the micro field)
        if (!hoveredActionId || !isMouseInDiagram) return;

        const action = actionData.find(a => a.id === hoveredActionId);
        if (!action) return;

        // Capture mouse position at hover start (fixed top-left corner)
        const pos = { ...actionTooltipMouseRef.current };

        // After 0.5s: show tooltip with action name + seconds
        tooltipTimer1Ref.current = setTimeout(() => {
            setActionTooltip({ actionId: action.id, showMicro: false, x: pos.x, y: pos.y });
        }, 500);

        // After 3s: enrich with micro text if enabled and available
        if (showMicroOnHover && action.micro) {
            tooltipTimer2Ref.current = setTimeout(() => {
                setActionTooltip(prev => prev && prev.actionId === hoveredActionId ? { ...prev, showMicro: true } : prev);
            }, 3000);
        }

        return () => {
            if (tooltipTimer1Ref.current) { clearTimeout(tooltipTimer1Ref.current); tooltipTimer1Ref.current = null; }
            if (tooltipTimer2Ref.current) { clearTimeout(tooltipTimer2Ref.current); tooltipTimer2Ref.current = null; }
        };
    }, [hoveredActionId, showMicroOnHover, actionData, isMouseInDiagram]);

    // Position du curseur, pour poser l'infobulle.
    //
    // Relevée par React sur le conteneur lui-même, et non par un écouteur sur
    // `document` : ce composant est aussi rendu dans une fenêtre détachée, où
    // `document` désigne encore la fenêtre principale. L'écouteur s'y posait
    // donc sur le mauvais document — position jamais mise à jour, et surtout
    // aucune trace du survol dans la fenêtre où se trouvait réellement le
    // curseur. Passer par l'événement React supprime la question : il est
    // délivré dans la fenêtre qui porte le diagramme, quelle qu'elle soit.
    const suivreCurseur = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
        actionTooltipMouseRef.current = { x: e.clientX, y: e.clientY };
        // Filet : si un re-rendu a avalé le mouseenter, le premier mouvement
        // rétablit l'état. Sans lui, l'infobulle restait muette dans la
        // fenêtre détachée alors que le surlignage, lui, fonctionnait.
        setIsMouseInDiagram(true);
    }, []);

    // Phase flag tooltip (aiguillage/escamotage)
    const [phaseFlagTooltipId, setPhaseFlagTooltipId] = useState<number | null>(null);
    const phaseFlagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleNameMouseEnter = useCallback((groupId: number) => {
        phaseFlagTimerRef.current = setTimeout(() => {
            setPhaseFlagTooltipId(groupId);
        }, 5000);
    }, []);

    const handleNameMouseLeave = useCallback(() => {
        if (phaseFlagTimerRef.current) {
            clearTimeout(phaseFlagTimerRef.current);
            phaseFlagTimerRef.current = null;
        }
        setPhaseFlagTooltipId(null);
    }, []);

    const resetActiveCommentFormatting = useCallback((e: ReactMouseEvent) => {
        e.preventDefault();
        const editable = activeCommentRef.current;
        if (!editable) return;

        const groupId = Number(editable.dataset.groupId);
        const comment = resetTextFormatting(editable);
        editable.focus({ preventScroll: true });
        updateGroupParams(groupId, { comment });
    }, [updateGroupParams]);

    // Handle Alt+A / Alt+E to toggle phaseFlag
    const handlePhaseFlagKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>, groupId: number, currentFlag?: DrapeauPhase) => {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            updateGroupParams(groupId, { phaseFlag: currentFlag === 'a' ? '' : 'a' });
        } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
            e.preventDefault();
            updateGroupParams(groupId, { phaseFlag: currentFlag === 'e' ? '' : 'e' });
        }
    }, [updateGroupParams]);

    const {
        effectiveCycleLength,
        getShiftedActionPosition,
        getSimulatedGroup
    } = createTimelineSimulation({
        groups,
        cycleLength,
        simulationResult
    });

    // Morceaux d'un cadre pleine largeur (escamotage de phase, adaptatif sans
    // plage). Un tel cadre recule avec les adaptatifs partiels : chaque ligne
    // recule des adaptatifs dont la plage la contient, et un morceau prend le
    // recul le plus fort de ses lignes. En bicarrefour, le cadre est dessiné en
    // deux morceaux joints, un par carrefour, dès que leurs positions diffèrent.
    const morceauxPleineLargeur = (origDeb: number, origFin: number, actionType: string, actionId: number) => {
        const morceau = (premierIdx: number, dernierIdx: number) => {
            const positions = groups.slice(premierIdx, dernierIdx + 1).map(g =>
                getShiftedActionPosition(origDeb, origFin, null, actionType, null, actionId, { premier: g.id, dernier: g.id })
            );
            const visibles = positions.filter(p => !p.hidden);
            const retenue = visibles.length
                ? visibles.reduce((plusRecule, p) => (p.deb < plusRecule.deb ? p : plusRecule))
                : getShiftedActionPosition(origDeb, origFin, null, actionType, null, actionId);
            return { ...retenue, premierIdx, dernierIdx };
        };
        const separateurIdx = biCarrefourSeparator != null ? groups.findIndex(g => g.id === biCarrefourSeparator) : -1;
        if (separateurIdx >= 0 && separateurIdx < groups.length - 1) {
            const haut = morceau(0, separateurIdx);
            const bas = morceau(separateurIdx + 1, groups.length - 1);
            if (haut.deb !== bas.deb || haut.fin !== bas.fin || haut.hidden !== bas.hidden) return [haut, bas];
        }
        return [morceau(0, groups.length - 1)];
    };

    const TIME_WINDOW = effectiveCycleLength || 100;
    const totalWidth = TIME_WINDOW * pixelsPerSecond;
    const {
        activeConflicts,
        dragState,
        handleActionDragStart,
        handleDragStart,
        handleEndChange,
        handleStartChange
    } = useTimelineDrag({
        actionData,
        conflictMatrix,
        conflicts,
        cycleLength,
        endDrag,
        groups,
        onDragConflicts,
        pixelsPerSecond,
        readOnly,
        startDrag,
        updateActionRow,
        updateGroupParams
    });
    // Helper to get actions for a specific group
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const getActionsForGroup = (groupId: number) => {
        return actionData.filter(action => {
            const gf = action.gf?.toString().replace(/[Gg]/g, '').trim();
            return gf === groupId.toString() && action.deb !== '' && action.fin !== '' &&
                (!simulationFilter || !simulationFilter.has(action.id));
        });
    };

    // Get SELECTED "Escamotage de phase" actions (for hiding overlays and arrows within their range)
    const selectedEscamotageDePhase = simulationFilter ? actionData.filter(action =>
        action.action === 'Escamotage de phase' && action.deb !== '' && action.fin !== '' &&
        simulationFilter.has(action.id)
    ) : [];

    // Get SELECTED "Adaptatif vertical" actions (for hiding arrows within their range)
    const selectedAdaptatifVertical = simulationFilter ? actionData.filter(action =>
        action.action === 'Adaptatif vertical' && action.deb !== '' && action.fin !== '' &&
        simulationFilter.has(action.id)
    ) : [];

    // Helper to check if a time range overlaps with any selected Escamotage de phase or Adaptatif vertical
    const isWithinSelectedEscamotageOrAdaptatif = (deb: number, fin: number) => {
        const allSelectedZones = [...selectedEscamotageDePhase, ...selectedAdaptatifVertical];
        if (allSelectedZones.length === 0) return false;
        for (const zone of allSelectedZones) {
            const zoneDeb = entier(zone.deb) || 0;
            const zoneFin = entier(zone.fin) || 0;
            // Check if ranges overlap (handling wrap-around)
            if (zoneDeb <= zoneFin) {
                // Normal case: zone doesn't wrap
                if (deb >= zoneDeb && deb < zoneFin) return true;
                if (fin > zoneDeb && fin <= zoneFin) return true;
                if (deb <= zoneDeb && fin >= zoneFin) return true;
            } else {
                // Zone wraps around cycle
                if (deb >= zoneDeb || deb < zoneFin) return true;
                if (fin > zoneDeb || fin <= zoneFin) return true;
            }
        }
        return false;
    };

    // Helper to check if a time range overlaps with any selected Escamotage de phase only
    const isWithinSelectedEscamotage = (deb: number, fin: number) => {
        if (selectedEscamotageDePhase.length === 0) return false;
        for (const escamotage of selectedEscamotageDePhase) {
            const escDeb = entier(escamotage.deb) || 0;
            const escFin = entier(escamotage.fin) || 0;
            // Check if ranges overlap (handling wrap-around)
            if (escDeb <= escFin) {
                // Normal case: escamotage doesn't wrap
                if (deb >= escDeb && deb < escFin) return true;
                if (fin > escDeb && fin <= escFin) return true;
                if (deb <= escDeb && fin >= escFin) return true;
            } else {
                // Escamotage wraps around cycle
                if (deb >= escDeb || deb < escFin) return true;
                if (fin > escDeb || fin <= escFin) return true;
            }
        }
        return false;
    };

    // Get all "Adaptatif vertical" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase
    const adaptatifActions = actionData.filter(action => {
        if (action.action !== 'Adaptatif vertical' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Ne pas masquer les AV par les EP — ils sont décalés, pas supprimés
        return true;
    });

    // Get all "Fermeture anticipée" actions with arrows and braces
    // In simulation mode: show overlay and arrows when action is UNCHECKED (inverted logic)
    // Arrows and braces are inseparable - they appear/disappear together
    // Also hide if within a SELECTED Escamotage de phase
    const fermetureActions = actionData.filter(action => {
        if (action.action !== 'Fermeture anticipée' || action.deb === '' || action.fin === '') return false;
        if (!(action.actGf1 || action.actGf1Gf2 || action.actGf1Gf3 || action.actGf1Gf4)) return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = entier(action.deb) || 0;
        const fin = entier(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    // Get all "Escamotage de phase" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const escamotageActions = actionData.filter(action =>
        action.action === 'Escamotage de phase' && action.deb !== '' && action.fin !== '' &&
        (!simulationFilter || !simulationFilter.has(action.id))
    );

    // Get all "Escamotage" actions (linked to specific group via actGf1)
    // No deb/fin required - arrows are calculated from group times and intergreen
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Note: actGf1 is optional - if not set, rectangle is shown on source group without arrows
    const escamotageGroupActions = actionData.filter(action =>
        action.action === 'Escamotage' && action.gf &&
        (!simulationFilter || !simulationFilter.has(action.id))
    );

    // Get SELECTED "Escamotage" actions (for cutting target group bar when checked)
    const selectedEscamotageGroup = simulationFilter ? actionData.filter(action =>
        action.action === 'Escamotage' && action.gf && action.actGf1 &&
        simulationFilter.has(action.id)
    ) : [];

    // Groupes impliqués dans des actions "Escamotage" (GF source + actGf cibles) → afficher "e" automatiquement
    const escamotageGroupIds = new Set<number>();
    actionData.forEach(action => {
        if (action.action === 'Escamotage' && action.gf) {
            const gfId = entier(action.gf.toString().replace(/[Gg]/g, '').trim());
            if (gfId) escamotageGroupIds.add(gfId);
            [action.actGf1, action.actGf1Gf2, action.actGf1Gf3, action.actGf1Gf4].forEach(actGf => {
                if (actGf) {
                    const id = parseInt(actGf.toString().replace(/[Gg]/g, '').trim());
                    if (id) escamotageGroupIds.add(id);
                }
            });
        }
    });

    // Precompute shifted zone ranges for brace truncation (SELECTED/checked zones only - simulation mode)
    const braceZoneRanges: { deb: number; fin: number; rawDeb: number; rawFin: number; plage1?: number; plage2?: number; isPartial?: boolean }[] = [];
    selectedEscamotageDePhase.forEach(a => {
        const zDeb = entier(a.deb) || 0;
        const zFin = entier(a.fin) || 0;
        const shifted = getShiftedActionPosition(zDeb, zFin, null, 'Escamotage de phase', null, a.id);
        if (!shifted.hidden) {
            braceZoneRanges.push({ deb: shifted.deb, fin: shifted.fin, rawDeb: zDeb, rawFin: zFin });
        }
    });
    selectedAdaptatifVertical.forEach(a => {
        const zDeb = entier(a.deb) || 0;
        const zFin = entier(a.fin) || 0;
        const plage1 = entier(a.plage1) || 0;
        const plage2 = entier(a.plage2) || 0;
        const avPlage = (plage1 > 0 && plage2 > 0) ? { plage1, plage2 } : null;
        const shifted = getShiftedActionPosition(zDeb, zFin, null, 'Adaptatif vertical', avPlage, a.id);
        if (!shifted.hidden) {
            braceZoneRanges.push({ deb: shifted.deb, fin: shifted.fin, rawDeb: zDeb, rawFin: zFin, plage1, plage2, isPartial: !!avPlage });
        }
    });

    // Get all "Signal aide conduite" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    const signaActions = actionData.filter(action => {
        if (action.action !== 'Signal aide conduite') return false;
        if (action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        const deb = entier(action.deb) || 0;
        const fin = entier(action.fin) || 0;
        if (deb === fin) return false;
        // Only show if orange zone exists (fin - 5 > deb)
        if (fin - 5 <= deb) return false;
        return true;
    });

    // Get all "Contrôle de flot" actions
    // Shows: intermittent yellow/gray from DEB to minGreen, then orange for orange duration, then red to FIN
    const controleFlotActions = actionData.filter(action => {
        if (action.action !== 'Contrôle de flot') return false;
        if (action.gf === '' || action.gf === undefined) return false;
        if (action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        const deb = entier(action.deb) || 0;
        const fin = entier(action.fin) || 0;
        if (deb >= fin) return false;
        return true;
    });

    // Get all "Point de repos" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const pointReposActions = actionData.filter(action => {
        if (action.action !== 'Point de repos') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(entier(action.plage1)) || entier(action.plage1) < 1)
            ? 1
            : action.plage1,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(entier(action.plage2)) || entier(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Synchro BTS" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const synchroBtsActions = actionData.filter(action => {
        if (action.action !== 'Synchro BTS') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(entier(action.plage1)) || entier(action.plage1) < 1)
            ? 1
            : action.plage1,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(entier(action.plage2)) || entier(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Instant Co" actions
    // In simulation mode: show overlay ONLY when action is CHECKED (normal logic - hidden by default)
    // If plage1 is not set, default to 1 (first group)
    // If plage2 is not set, default to groups.length (total number of groups)
    const instantCoActions = actionData.filter(action => {
        if (action.action !== 'Instant Co') return false;
        if (action.deb === '' || action.deb === undefined) return false;
        if (simulationFilter && !simulationFilter.has(action.id)) return false;
        return true;
    }).map(action => ({
        ...action,
        plage1: (action.plage1 === '' || action.plage1 === undefined || isNaN(entier(action.plage1)) || entier(action.plage1) < 1)
            ? 1
            : action.plage1,
        plage2: (action.plage2 === '' || action.plage2 === undefined || isNaN(entier(action.plage2)) || entier(action.plage2) < 1)
            ? groups.length
            : action.plage2
    }));

    // Get all "Priorité piétons" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const prioritePietonsActions = actionData.filter(action => {
        if (action.action !== 'Priorité piétons') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Ne pas masquer : les contractions décalent cette action via getShiftedActionPosition
        return true;
    });

    // Get all "Flèche d'anticipation" actions (same representation as Priorité piétons)
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const flecheAnticipationActions = actionData.filter(action => {
        if (action.action !== "Flèche d'anticipation") return false;
        if (action.gf === '' || action.deb === '' || action.fin === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Ne pas masquer : les contractions décalent cette action via getShiftedActionPosition
        return true;
    });

    // Get all "Début de bande passante" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const debutBandeActions = actionData.filter(action => {
        if (action.action !== 'Début de bande passante') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '' || action.actGf1 === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = entier(action.deb) || 0;
        const fin = entier(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    // Get all "Fin de bande passante" actions
    // In simulation mode: show overlay when action is UNCHECKED (inverted logic)
    // Also hide if within a SELECTED Escamotage de phase or Adaptatif vertical
    const finBandeActions = actionData.filter(action => {
        if (action.action !== 'Fin de bande passante') return false;
        if (action.gf === '' || action.deb === '' || action.fin === '' || action.actGf1 === '') return false;
        if (simulationFilter && simulationFilter.has(action.id)) return false;
        // Hide if within a selected Escamotage de phase or Adaptatif vertical
        const deb = entier(action.deb) || 0;
        const fin = entier(action.fin) || 0;
        if (isWithinSelectedEscamotageOrAdaptatif(deb, fin)) return false;
        return true;
    });

    const ROW_HEIGHT = 30; // Height of each row in pixels
    const RULER_HEIGHT = 50; // Height of the ruler
    const ROW_TOTAL_HEIGHT = ROW_HEIGHT + 1; // Row height + 1px border
    const svgHeight = RULER_HEIGHT + 1 + groups.length * ROW_TOTAL_HEIGHT + 30;

    const { dashedPath, doesGroupWrap, getGroupEndPos, getGroupRowY, getGroupStartPos } = createTimelineGeometry({
        cycleLength,
        effectiveCycleLength,
        groups,
        rowHeight: ROW_HEIGHT,
        rowTotalHeight: ROW_TOTAL_HEIGHT,
        rulerHeight: RULER_HEIGHT,
        simulationResult
    });

    // Socle commun passé aux incrustations d'actions (timeline/incrustations)
    const contexteIncrustations: ContexteIncrustations = {
        groups,
        pixelsPerSecond,
        cycleLength,
        effectiveCycleLength,
        RULER_HEIGHT,
        ROW_HEIGHT,
        ROW_TOTAL_HEIGHT,
        svgHeight,
        totalWidth,
        hoveredActionId,
        setHoveredActionId,
        dragState,
        handleActionDragStart,
        getShiftedActionPosition
    };

    return (<>
        <div
            className={`timeline-container ${dragState ? 'dragging' : ''}${readOnly ? ' read-only' : ''}${scrollable ? ' scrollable' : ''}`}
            ref={containerRef}
            onMouseEnter={() => setIsMouseInDiagram(true)}
            onMouseMove={suivreCurseur}
            onMouseLeave={() => setIsMouseInDiagram(false)}
        >
            <TimelineHeader
                activePFName={activePFName}
                cycleLength={cycleLength}
                cycleLengthInput={cycleLengthInput}
                cycleSimulationSpeed={cycleSimulationSpeed}
                isPlayingSimulation={isPlayingSimulation}
                onDetach={onDetach}
                planName={planName}
                readOnly={readOnly}
                setCycleLength={setCycleLength}
                setCycleLengthInput={setCycleLengthInput}
                setIsPlayingSimulation={setIsPlayingSimulation}
                setSimulationCurrentTime={setSimulationCurrentTime}
                simulationCurrentTime={simulationCurrentTime}
                simulationResult={simulationResult}
                simulationSpeed={simulationSpeed}
                titreEnBandeau={titreEnBandeau}
                tooltipsEnabled={tooltipsEnabled}
            />
            <div className="timeline-layout">
                <TimelineSidebar
                    biCarrefourSeparator={biCarrefourSeparator}
                    cycleLength={cycleLength}
                    effectiveCycleLength={effectiveCycleLength}
                    escamotageGroupIds={escamotageGroupIds}
                    groups={groups}
                    handleEndChange={handleEndChange}
                    handleNameMouseEnter={handleNameMouseEnter}
                    handleNameMouseLeave={handleNameMouseLeave}
                    handlePhaseFlagKeyDown={handlePhaseFlagKeyDown}
                    handleStartChange={handleStartChange}
                    hoveredArrowGroupId={hoveredArrowGroupId}
                    hoveredArrowGroupSaturated={hoveredArrowGroupSaturated}
                    onGroupClick={onGroupClick}
                    phaseFlagTooltipId={phaseFlagTooltipId}
                    readOnly={readOnly}
                    showGroupNames={showGroupNames}
                    showWrapFlash={showWrapFlash}
                    simulationResult={simulationResult}
                    updateGroupParams={updateGroupParams}
                />

                <div className="timeline-scroll-area" style={{ width: `${totalWidth}px`, position: 'relative' }}>
                    <TimelineEmptyState
                        conflictMatrix={conflictMatrix}
                        groups={groups}
                        tooltipsEnabled={tooltipsEnabled}
                    />
                    {/* L'instant survolé, qui anime l'image du carrefour, se suit sur
                        tout le conteneur : lignes ET cadres d'action posés par-dessus
                        (adaptatif vertical, escamotage de phase, point de repos…).
                        Suivi ligne par ligne, il s'effaçait dès que la souris entrait
                        sur un cadre, que la ligne prenait pour une sortie. */}
                    <div
                        className="timeline-track-container"
                        style={{ width: `${totalWidth}px` }}
                        onMouseMove={setHoveredDiagramTime ? (e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const time = Math.floor(x / pixelsPerSecond);
                            setHoveredDiagramTime(Math.max(0, Math.min(time, effectiveCycleLength - 1)));
                        } : undefined}
                        onMouseLeave={setHoveredDiagramTime ? () => setHoveredDiagramTime(null) : undefined}
                    >
                        <TimelineGridBackground
                            groups={groups}
                            isPlayingSimulation={isPlayingSimulation}
                            pixelsPerSecond={pixelsPerSecond}
                            playbackTime={playbackTime}
                            rowTotalHeight={ROW_TOTAL_HEIGHT}
                            rulerHeight={RULER_HEIGHT}
                            simulationCurrentTime={simulationCurrentTime}
                            simulationResult={simulationResult}
                            timeWindow={TIME_WINDOW}
                            tooltipsEnabled={tooltipsEnabled}
                        />

                        {/* Rows */}
                        {groups.map((group) => (
                            <TimelineRow
                                key={group.id}
                                ctx={contexteIncrustations}
                                group={group}
                                TIME_WINDOW={TIME_WINDOW}
                                activeConflicts={activeConflicts}
                                biCarrefourSeparator={biCarrefourSeparator}
                                braceZoneRanges={braceZoneRanges}
                                conflictMatrix={conflictMatrix}
                                getActionsForGroup={getActionsForGroup}
                                getSimulatedGroup={getSimulatedGroup}
                                handleDragStart={handleDragStart}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                hoveredArrowGroupSaturated={hoveredArrowGroupSaturated}
                                hoveredVUtile={hoveredVUtile}
                                onGroupClick={onGroupClick}
                                selectedEscamotageGroup={selectedEscamotageGroup}
                                setHoveredGroupId={setHoveredGroupId}
                                simulationResult={simulationResult}
                            />
                        ))}

                        <IncrustationAdaptatifVertical
                            ctx={contexteIncrustations}
                            adaptatifActions={adaptatifActions}
                            morceauxPleineLargeur={morceauxPleineLargeur}
                        />

                        <FlechesFermetureAnticipee
                            ctx={contexteIncrustations}
                            doesGroupWrap={doesGroupWrap}
                            fermetureActions={fermetureActions}
                            getGroupEndPos={getGroupEndPos}
                            getGroupRowY={getGroupRowY}
                            getGroupStartPos={getGroupStartPos}
                            getSimulatedGroup={getSimulatedGroup}
                            simulationResult={simulationResult}
                        />

                        <IncrustationEscamotageDePhase
                            ctx={contexteIncrustations}
                            escamotageActions={escamotageActions}
                            morceauxPleineLargeur={morceauxPleineLargeur}
                        />

                        <IncrustationEscamotageGroupe
                            ctx={contexteIncrustations}
                            conflictMatrix={conflictMatrix}
                            escamotageGroupActions={escamotageGroupActions}
                        />

                        <IncrustationSignalAideConduite ctx={contexteIncrustations} signaActions={signaActions} />

                        <IncrustationControleDeFlot
                            ctx={contexteIncrustations}
                            controleFlotActions={controleFlotActions}
                        />

                        <FlechesPointDeRepos ctx={contexteIncrustations} pointReposActions={pointReposActions} />

                        <FlechesSynchroBts ctx={contexteIncrustations} synchroBtsActions={synchroBtsActions} />

                        <FlechesInstantCo ctx={contexteIncrustations} instantCoActions={instantCoActions} />

                        <BarrePrioritePietons
                            ctx={contexteIncrustations}
                            prioritePietonsActions={prioritePietonsActions}
                        />

                        <BarreFlecheAnticipation
                            ctx={contexteIncrustations}
                            flecheAnticipationActions={flecheAnticipationActions}
                        />

                        <BarresGroupesFlPp ctx={contexteIncrustations} getSimulatedGroup={getSimulatedGroup} />

                        <FlechesDebutBandePassante
                            ctx={contexteIncrustations}
                            dashedPath={dashedPath}
                            debutBandeActions={debutBandeActions}
                        />

                        <FlechesFinBandePassante
                            ctx={contexteIncrustations}
                            dashedPath={dashedPath}
                            finBandeActions={finBandeActions}
                        />

                        <FlechesDependances
                            ctx={contexteIncrustations}
                            actionData={actionData}
                            conflictMatrix={conflictMatrix}
                            dependencyGap={dependencyGap}
                            hoveredConflict={hoveredConflict}
                            hoveredGroupId={hoveredGroupId}
                            showDependencies={showDependencies}
                            simulationFilter={simulationFilter}
                            simulationResult={simulationResult}
                        />
                    </div>
                </div>

                {/* Comments column - not printable */}
                {showComments && <div className="timeline-comments no-print">
                    {/* Header for comments */}
                    <div className="comments-header">
                        <span>Commentaire</span>
                        <CustomTooltip text="Couleur verte (+)"><span className="comment-color-btn comment-color-plus" role="button" aria-label="Colorer le texte sélectionné en vert">+</span></CustomTooltip>
                        <CustomTooltip text="Couleur rouge (-)"><span className="comment-color-btn comment-color-minus" role="button" aria-label="Colorer le texte sélectionné en rouge">−</span></CustomTooltip>
                        <CustomTooltip text="Réinitialiser la couleur et la taille du commentaire actif"><span
                            className="comment-reset-btn"
                            role="button"
                            aria-label="Réinitialiser la couleur et la taille du commentaire actif"
                            onMouseDown={resetActiveCommentFormatting}
                        >Réinit.</span></CustomTooltip>
                    </div>

                    {/* Comment input for each group */}
                    {groups.map(g => (
                        <div key={g.id} className="comment-row">
                            <div
                                className="input-comment"
                                data-group-id={g.id}
                                contentEditable
                                suppressContentEditableWarning
                                dangerouslySetInnerHTML={{ __html: g.comment || '' }}
                                onFocus={(e) => { activeCommentRef.current = e.currentTarget; }}
                                onBlur={(e) => {
                                    const html = e.currentTarget.innerHTML;
                                    // Extract text to check length
                                    const text = e.currentTarget.textContent || '';
                                    if (text.length <= 50) {
                                        updateGroupParams(g.id, { comment: html });
                                    } else {
                                        // Truncate and save
                                        e.currentTarget.textContent = text.slice(0, 50);
                                        updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === '+' || e.key === '-') {
                                        e.preventDefault();
                                        const color = e.key === '+' ? '#4CAF50' : '#F44336';
                                        const selection = window.getSelection();

                                        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                                            // Has selection - wrap selection in colored span
                                            const range = selection.getRangeAt(0);
                                            const selectedText = range.toString();
                                            if (selectedText) {
                                                const span = document.createElement('span');
                                                span.style.color = color;
                                                range.surroundContents(span);
                                                // Save updated HTML
                                                updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                            }
                                        } else {
                                            // No selection - color entire content or toggle back to white
                                            const content = e.currentTarget.textContent || '';
                                            if (content) {
                                                // Check if content is already entirely wrapped in a colored span
                                                const firstChild = e.currentTarget.firstChild as HTMLElement | null;
                                                const isEntirelyColored = firstChild &&
                                                    firstChild.nodeType === 1 &&
                                                    firstChild.tagName === 'SPAN' &&
                                                    firstChild.style.color &&
                                                    e.currentTarget.childNodes.length === 1;

                                                if (isEntirelyColored) {
                                                    // Toggle back to white (remove color)
                                                    e.currentTarget.innerHTML = content;
                                                } else {
                                                    e.currentTarget.innerHTML = `<span style="color: ${color}">${content}</span>`;
                                                }
                                                updateGroupParams(g.id, { comment: e.currentTarget.innerHTML });
                                            }
                                        }
                                    }
                                }}
                                data-tooltip="Commentaire (50 caractères max) - Sélectionnez du texte puis + pour vert, - pour rouge"
                            />
                        </div>
                    ))}
                </div>}

                {/* Remarques column - not printable, hidden when detached into a popup */}
                {showRemarks && !remarquesDetached && (
                    <RemarquesEditor
                        remarques={remarques}
                        updateRemarques={updateRemarques ?? undefined}
                        groupCount={groups.length}
                    />
                )}
            </div>
        </div>
        <TimelineFloatingOverlays
            actionData={actionData}
            actionTooltip={actionTooltip}
            cycleLength={cycleLength}
            dragState={dragState}
            microVariableNames={microVariableNames}
        />
    </>);
};

export default TimelineDiagram;
