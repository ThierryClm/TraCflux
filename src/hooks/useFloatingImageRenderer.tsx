import { ZoneVerrouSaisie, MentionVerrou, usePrefsVerrou } from '../utils/verrouSaisie';
import { useEffect, useState } from 'react';
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, SetStateAction } from 'react';
import renderFloatingArrowSVG from '../utils/renderArrowSVG';
import avecPriseSurvol from '../utils/priseFleche';
import { BOX_W, BOX_H, fitDetachedImageBox } from '../utils/floatingImageBox';
import { getGroupColorAtTime, isPPLit } from '../utils/groupColorAtTime';
import { auMoinsUnSignal, decalageNumeroSignal, echelleSignal, signalDessinable } from '../utils/aspectSignal';
import SignalModule from '../components/SignalModule';
import type { ActionMicro, CategorieDetecteur, Detecteur, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import { etiquetteDansBoucle, renderDetecteurSVG, tailleDetecteur } from '../utils/detecteursSymboles';
import { CATEGORIES_DETECTEUR, changerCategorie, dimensionDepuisSaisie, dimensionSaisissable, estBoucle, retraitDepuisSaisie, retraitSaisissable } from '../utils/detecteurs';
import { estOccupee, intervallesDetecteur, type Intervalle } from '../utils/animationDetecteurs';
import type { SimulationResult } from '../simulation';
import type { FloatingCrop, ImageDimensions } from './useFloatingImage';
import type { IntersectionDisplayOptions } from './useIntersectionDisplayOptions';
import usePopupWindow from './usePopupWindow';
import useDetectorClock from './useDetectorClock';

interface IntersectionArrow {
    id: number | string;
    groupId?: number | null;
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
    length?: number;
    turnLength?: number;
}

interface FloatingImagePopup {
    renderToPopup: (content: ReactNode) => void;
}

interface FloatingImageRendererOptions {
    showFloatingImage: boolean;
    intersectionImage: string | null | undefined;
    floatingCrop: FloatingCrop;
    setFloatingCrop: Dispatch<SetStateAction<FloatingCrop>>;
    floatingZoom: number;
    setFloatingZoom: Dispatch<SetStateAction<number>>;
    showCropControls: boolean;
    setShowCropControls: Dispatch<SetStateAction<boolean>>;
    intersectionArrows: IntersectionArrow[];
    /** Écriture des flèches et des détecteurs, pour le mode correction. */
    setIntersectionArrows?: (arrows: FlecheCarrefour[]) => void;
    setDetecteurs?: (detecteurs: Detecteur[]) => void;
    detecteurs?: Detecteur[];
    detecteurModule?: boolean;
    pixelsParMetre?: number;
    getTrafficData?: (groupId: number) => { trafficVol?: number | string } | undefined;
    groups: Groupe[];
    imageNaturalDims: ImageDimensions;
    imageFondClair?: boolean;
    selectedActions: number[];
    conflictMatrix: Matrice;
    hoveredArrowGroupId: number | null;
    /** Groupes allumés ensemble : ceux de l'action survolée en simulation. */
    hoveredArrowGroupIds?: number[];
    setHoveredArrowGroupId?: Dispatch<SetStateAction<number | null>>;
    hoveredDiagramTime?: number | null;
    isPlayingSimulation: boolean;
    simulationCurrentTime?: number | null;
    /** Vitesse de lecture, pour l'horloge fine des détecteurs. */
    playbackSpeed?: number;
    simulationResult?: object | null;
    actionData: ActionMicro[];
    cycleLength: number;
    imageBrightness: number;
    imageContrast: number;
    /** Cases numéros / noms de groupe / signal de l'image du carrefour. */
    intersectionDisplay: IntersectionDisplayOptions;
    floatingImagePopup: FloatingImagePopup;
    /** Case « Image du carrefour » de Mise en page → Infobulles. */
    tooltipsEnabled?: boolean;
}

/**
 * Gère le rendu du contenu de la popup "Image du carrefour" :
 * image, contrôles zoom/rognage, numéros de groupes, flèches animées.
 */
const useFloatingImageRenderer = ({
    showFloatingImage,
    intersectionImage,
    floatingCrop, setFloatingCrop,
    floatingZoom, setFloatingZoom,
    showCropControls, setShowCropControls,
    intersectionArrows,
    setIntersectionArrows,
    setDetecteurs,
    detecteurs = [],
    detecteurModule = false,
    pixelsParMetre = 12,
    getTrafficData = () => undefined,
    groups,
    imageNaturalDims,
    imageFondClair = true,
    selectedActions,
    conflictMatrix,
    hoveredArrowGroupId,
    hoveredArrowGroupIds,
    setHoveredArrowGroupId,
    hoveredDiagramTime,
    isPlayingSimulation,
    simulationCurrentTime,
    playbackSpeed = 1,
    simulationResult = null,
    actionData,
    cycleLength,
    imageBrightness,
    imageContrast,
    intersectionDisplay,
    floatingImagePopup,
    tooltipsEnabled = true
}: FloatingImageRendererOptions) => {
    // Même horloge fine que l'image de la page : les boucles s'animent au
    // dixième de seconde, alors que les flèches suivent la seconde du diagramme.
    const cycleAnimation = (simulationResult as SimulationResult | null)?.simulatedCycleLength || cycleLength;
    const detectorTime = useDetectorClock({
        isPlaying: isPlayingSimulation,
        currentTime: simulationCurrentTime ?? 0,
        cycleLength: cycleAnimation,
        playbackSpeed
    });

    // Mode correction : la fenêtre détachée reste un simple miroir tant qu'il
    // n'est pas activé; il ne survit pas à la fermeture de la fenêtre.
    const prefsVerrou = usePrefsVerrou();
    const verrouille = prefsVerrou.image;
    const [modeCorrection, setModeCorrection] = useState(false);
    const [selection, setSelection] = useState<{ type: 'fleche' | 'detecteur'; id: number } | null>(null);

    useEffect(() => {
        if (!showFloatingImage) {
            setModeCorrection(false);
            setSelection(null);
        }
    }, [showFloatingImage]);

    // Réglages de l'élément sélectionné : fenêtre détachée non modale, que l'on
    // peut poser sur un autre écran que l'image. Elle vit avec le mode
    // correction ; la fermer quitte ce mode. Si le navigateur la bloque, le
    // panneau revient à droite de l'image.
    const reglagesPopup = usePopupWindow({
        geometryKey: 'image-reglages',
        sectionVerrou: 'image',
        isOpen: showFloatingImage && !!intersectionImage && modeCorrection && !verrouille,
        onClose: () => {
            setModeCorrection(false);
            setSelection(null);
        },
        title: 'Réglages — Image du carrefour',
        width: 300,
        height: 520
    });

    // Image verrouillée : la correction s'arrête, la fenêtre redevient un miroir.
    useEffect(() => {
        if (verrouille) {
            setModeCorrection(false);
            setSelection(null);
        }
    }, [verrouille]);

    useEffect(() => {
        if (!showFloatingImage || !intersectionImage) return;
        const tip = (text: string) => tooltipsEnabled ? text : undefined;

        const showCurrents = intersectionDisplay.showCurrents !== false;
        const showNums = showCurrents && intersectionDisplay.showGroupNumbers;
        // Même règle que l'image de la page : sans signal renseigné, la case ne pèse sur rien.
        const showSignals = showCurrents && intersectionDisplay.showSignals && auMoinsUnSignal(groups);
        const showNames = showCurrents && intersectionDisplay.showGroupNames && !showSignals;
        const afficherDetecteurs = detecteurModule ? intersectionDisplay.showDetecteurs : true;
        const afficherNomsDetecteurs = detecteurModule && intersectionDisplay.showDetecteurNames !== false;
        // Signal montré à la place de la flèche : case cochée et champ Signal renseigné.
        const signalDe = (group: Groupe | undefined) =>
            showSignals && signalDessinable(group?.signal) ? group?.signal : undefined;

        // Même règle que l'image de la page : un groupe sans début ni fin de
        // vert dans le diagramme ne sert aucun mouvement, sa flèche et son
        // signal sont masqués. En simulation, un groupe escamoté compte comme
        // supprimé, comme dans le diagramme simulé.
        const mouvementServi = (groupId: number) => {
            const simule = (simulationResult as SimulationResult | null)?.simulatedGroups.find(g => g.id === groupId);
            if (simule) return !simule.isEscamoted && (simule.simulatedGreen ?? 0) > 0;
            const group = groups.find(g => g.id === groupId);
            return !!group && (group.durations?.green || 0) > 0;
        };

        // Compute group number centroids
        const groupMap: Record<number, Array<{ x: number; y: number }>> = {};
        intersectionArrows.forEach(arrow => {
            // Pas de numéro sans flèche : le groupe n'est pas servi.
            if (!arrow.groupId || !mouvementServi(arrow.groupId)) return;
            const group = groups.find(g => g.id === arrow.groupId);
            const courant = group?.courant || '';
            let px = arrow.x;
            let py = arrow.y;
            if (signalDe(group)) {
                const { dx, dy } = decalageNumeroSignal(arrow.scale || 1, courant);
                px += dx / 750 * 100;
                py += dy / 530 * 100;
            } else if (courant === 'TàD' || courant === 'TàG') {
                const sc = arrow.scale || 1;
                const svgSize = 96 * sc;
                const dxSvg = courant === 'TàD' ? -8 : 8;
                const dySvg = 2;
                const dxPx = (dxSvg / 32) * svgSize;
                const dyPx = (dySvg / 32) * svgSize;
                const rotRad = (arrow.rotation || 0) * Math.PI / 180;
                px += (dxPx * Math.cos(rotRad) - dyPx * Math.sin(rotRad)) / 750 * 100;
                py += (dxPx * Math.sin(rotRad) + dyPx * Math.cos(rotRad)) / 530 * 100;
            }
            if (!groupMap[arrow.groupId]) groupMap[arrow.groupId] = [];
            groupMap[arrow.groupId].push({ x: px, y: py });
        });

        // Cadre strict de l'image dans la boîte 750×530. Les bandes créées par
        // object-fit: contain sont toujours retirées : une flèche qui déborde
        // hors de l'image ne doit pas les réintroduire dans la fenêtre détachée.
        const { x: cadreX, y: cadreY, w: cadreW, h: cadreH } = fitDetachedImageBox(imageNaturalDims);
        const maxCropX = Math.max(0, Math.floor(cadreW / 2) - 10);
        const maxCropY = Math.max(0, Math.floor(cadreH / 2) - 10);
        const cropL = Math.min(floatingCrop.left, maxCropX);
        const cropR = Math.min(floatingCrop.right, maxCropX);
        const cropT = Math.min(floatingCrop.top, maxCropY);
        const cropB = Math.min(floatingCrop.bottom, maxCropY);

        // Instant affiché, règle commune aux deux fenêtres :
        //   1. animation lancée  → le curseur de lecture, et lui seul. Le survol
        //      ne doit pas détourner l'affichage pendant le déroulement.
        //   2. animation à l'arrêt → le point survolé sur le diagramme,
        //      à défaut la position du curseur.
        // Les flèches montrent donc toujours un instant que l'utilisateur peut
        // situer à l'écran.
        const activeTime = isPlayingSimulation
            ? (simulationCurrentTime ?? 0)
            : (hoveredDiagramTime ?? simulationCurrentTime ?? 0);

        // Animation des boucles, avec le même calcul que l'image de la page.
        const contexteAnimation = {
            cycleLength: cycleAnimation,
            groups,
            arrows: intersectionArrows as FlecheCarrefour[],
            getTrafficData,
            simulationResult: simulationResult as SimulationResult | null,
            actionData,
            selectedActions,
            conflictMatrix,
            pixelsParMetre
        };
        const intervalles = new Map<number, Intervalle[]>();
        detecteurs.forEach(detecteur => {
            if (detecteur.position) intervalles.set(detecteur.id, intervallesDetecteur(detecteur, contexteAnimation));
        });

        const colorContext = {
            groups, simulationResult, cycleLength, actionData, selectedActions, conflictMatrix
        };

        // --- Mode correction : déplacer et régler flèches et détecteurs ---
        const corriger = modeCorrection && !verrouille && !!setIntersectionArrows && !!setDetecteurs;
        const fleches = intersectionArrows as FlecheCarrefour[];
        const flecheSelectionnee = selection?.type === 'fleche' ? fleches.find(a => a.id === selection.id) : undefined;
        const detecteurSelectionne = selection?.type === 'detecteur' ? detecteurs.find(d => d.id === selection.id) : undefined;
        const courantFlecheSelectionnee = flecheSelectionnee
            ? (groups.find(g => g.id === flecheSelectionnee.groupId)?.courant || '')
            : '';
        const AVEC_LONGUEUR = ['Piéton', 'Cycle', 'TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG', 'TD_G_D'];
        const AVEC_RETOUR = ['TàD', 'TàG', 'TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG', 'TD_G_D'];
        const borner = (valeur: number) => Math.max(0, Math.min(100, valeur));
        const tournerDe = (rotation: number, pas: number) => ((rotation + pas) % 360 + 360) % 360;
        const modifierFleche = (id: number, changement: (a: FlecheCarrefour) => FlecheCarrefour) => {
            setIntersectionArrows?.(fleches.map(a => (a.id === id ? changement(a) : a)));
        };
        const modifierDetecteur = (id: number, changement: (d: Detecteur) => Detecteur) => {
            setDetecteurs?.(detecteurs.map(d => (d.id === id ? changement(d) : d)));
        };
        const deplacerDe = (type: 'fleche' | 'detecteur', id: number, dx: number, dy: number) => {
            if (type === 'fleche') {
                modifierFleche(id, a => ({ ...a, x: borner(a.x + dx), y: borner(a.y + dy) }));
            } else {
                modifierDetecteur(id, d => (d.position
                    ? { ...d, position: { x: borner(d.position.x + dx), y: borner(d.position.y + dy) } }
                    : d));
            }
        };
        const demarrerDeplacement = (e: ReactMouseEvent<HTMLDivElement>, type: 'fleche' | 'detecteur', id: number) => {
            if (!corriger || e.button !== 0) return;
            e.stopPropagation();
            // Pas de glisser natif (image, texte) : il avalerait les mouvements.
            e.preventDefault();
            setSelection({ type, id });
            const boite = (e.currentTarget as HTMLElement).closest('.floating-image-inner') as HTMLElement | null;
            if (!boite) return;
            // Les positions sont en pourcentage de la boîte 750 × 530 : le
            // rectangle de l'élément tient compte du zoom de la fenêtre.
            const rect = boite.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const enPourcent = (clientX: number, clientY: number) => ({
                x: ((clientX - rect.left) / rect.width) * 100,
                y: ((clientY - rect.top) / rect.height) * 100
            });
            const depart = enPourcent(e.clientX, e.clientY);
            const origine = type === 'fleche'
                ? fleches.find(a => a.id === id)
                : detecteurs.find(d => d.id === id)?.position;
            if (!origine) return;
            const dx = depart.x - origine.x;
            const dy = depart.y - origine.y;
            const bouger = (ev: MouseEvent) => {
                const p = enPourcent(ev.clientX, ev.clientY);
                if (type === 'fleche') {
                    modifierFleche(id, a => ({ ...a, x: borner(p.x - dx), y: borner(p.y - dy) }));
                } else {
                    modifierDetecteur(id, d => (d.position
                        ? { ...d, position: { x: borner(p.x - dx), y: borner(p.y - dy) } }
                        : d));
                }
            };
            // Le geste se déroule dans la fenêtre détachée : c'est SON document
            // qu'il faut écouter. Écouter celui de la page principale ne
            // recevait aucun mouvement, et rien ne bougeait.
            const doc = (e.currentTarget as HTMLElement).ownerDocument;
            const finir = () => {
                doc.removeEventListener('mousemove', bouger);
                doc.removeEventListener('mouseup', finir);
            };
            doc.addEventListener('mousemove', bouger);
            doc.addEventListener('mouseup', finir);
            (boite.closest('[data-correction]') as HTMLElement | null)?.focus();
        };
        const surToucheCorrection = (e: ReactKeyboardEvent<HTMLDivElement>) => {
            if (!corriger || !selection) return;
            const pas = 0.2;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -pas;
            else if (e.key === 'ArrowRight') dx = pas;
            else if (e.key === 'ArrowUp') dy = -pas;
            else if (e.key === 'ArrowDown') dy = pas;
            else return;
            e.preventDefault();
            e.stopPropagation();
            deplacerDe(selection.type, selection.id, dx, dy);
        };
        const tournerSelection = (type: 'fleche' | 'detecteur', id: number) => {
            if (!corriger) return;
            if (type === 'fleche') modifierFleche(id, a => ({ ...a, rotation: tournerDe(a.rotation || 0, 45) }));
            else modifierDetecteur(id, d => ({ ...d, orientation: tournerDe(d.orientation || 0, 45) }));
        };
        const supprimerFleche = (id: number) => {
            setIntersectionArrows?.(fleches.filter(a => a.id !== id));
            setSelection(null);
        };
        const dupliquerFleche = (id: number) => {
            const originale = fleches.find(a => a.id === id);
            if (!originale || !setIntersectionArrows) return;
            const copie: FlecheCarrefour = {
                ...originale,
                id: Date.now(),
                x: borner(originale.x + 3),
                y: borner(originale.y + 3)
            };
            setIntersectionArrows([...fleches, copie]);
            setSelection({ type: 'fleche', id: copie.id });
        };
        const retirerDetecteurDeImage = (id: number) => {
            setDetecteurs?.(detecteurs.map(d => (d.id === id ? { ...d, position: null } : d)));
            setSelection(null);
        };

        const reglagesFleche = flecheSelectionnee && (
                    <section aria-label="Réglages de la flèche sélectionnée">
                        <fieldset className="arrow-editor">
                            <h4>Modifier la flèche</h4>
                            <div className="editor-row">
                                <label>Groupe:</label>
                                <select
                                    value={flecheSelectionnee.groupId || ''}
                                    onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, groupId: parseInt(e.target.value, 10) }))}
                                >
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            GF{g.id} - {g.name} {g.courant ? `(${g.courant})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="editor-row">
                                <label>Rotation:</label>
                                <div className="rotation-controls">
                                    <button type="button" className="slider-btn minus"
                                        onClick={() => modifierFleche(flecheSelectionnee.id, a => ({ ...a, rotation: tournerDe(a.rotation || 0, -1) }))}
                                        title={tip('-1°')}>−</button>
                                    <input type="range" min="0" max="359" className="rotation-slider"
                                        value={flecheSelectionnee.rotation || 0}
                                        onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, rotation: Number(e.target.value) }))} />
                                    <button type="button" className="slider-btn plus"
                                        onClick={() => modifierFleche(flecheSelectionnee.id, a => ({ ...a, rotation: tournerDe(a.rotation || 0, 1) }))}
                                        title={tip('+1°')}>+</button>
                                    <input type="number" min="0" max="359" className="rotation-input"
                                        value={flecheSelectionnee.rotation || 0}
                                        onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, rotation: tournerDe(Number(e.target.value) || 0, 0) }))} />
                                    <span className="rotation-unit">°</span>
                                </div>
                            </div>
                            <div className="editor-row">
                                <label>Zoom:</label>
                                <div className="scale-controls">
                                    <button type="button" className="slider-btn minus"
                                        onClick={() => modifierFleche(flecheSelectionnee.id, a => ({ ...a, scale: Math.max(0.5, Number(((a.scale || 1) - 0.1).toFixed(1))) }))}
                                        title={tip('-0.1')}>−</button>
                                    <input type="range" min="0.5" max="3" step="0.1" className="scale-slider"
                                        value={flecheSelectionnee.scale || 1}
                                        onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, scale: Number(e.target.value) }))} />
                                    <button type="button" className="slider-btn plus"
                                        onClick={() => modifierFleche(flecheSelectionnee.id, a => ({ ...a, scale: Math.min(3, Number(((a.scale || 1) + 0.1).toFixed(1))) }))}
                                        title={tip('+0.1')}>+</button>
                                    <input type="number" min="0.5" max="3" step="0.1" className="scale-input"
                                        value={flecheSelectionnee.scale || 1}
                                        onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, scale: Number(e.target.value) }))} />
                                    <span className="scale-unit">x</span>
                                </div>
                            </div>
                            {AVEC_LONGUEUR.includes(courantFlecheSelectionnee) && (
                                <div className="editor-row">
                                    <label>Longueur:</label>
                                    <div className="length-controls">
                                        <input type="range" min="1" max="4" step="0.5" className="length-slider"
                                            value={flecheSelectionnee.length || 1}
                                            onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, length: Number(e.target.value) }))} />
                                        <input type="number" min="1" max="4" step="0.5" className="length-input"
                                            value={flecheSelectionnee.length || 1}
                                            onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, length: Number(e.target.value) }))} />
                                        <span className="length-unit">x</span>
                                    </div>
                                </div>
                            )}
                            {AVEC_RETOUR.includes(courantFlecheSelectionnee) && (
                                <div className="editor-row">
                                    <label>Retour:</label>
                                    <div className="turn-length-controls">
                                        <input type="range" min="0" max="1" step="0.1" className="turn-length-slider"
                                            value={flecheSelectionnee.turnLength ?? 1}
                                            onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, turnLength: Number(e.target.value) }))} />
                                        <input type="number" min="0" max="1" step="0.1" className="turn-length-input"
                                            value={flecheSelectionnee.turnLength ?? 1}
                                            onChange={(e) => modifierFleche(flecheSelectionnee.id, a => ({ ...a, turnLength: Number(e.target.value) }))} />
                                        <span className="turn-length-unit">x</span>
                                    </div>
                                </div>
                            )}
                            <button type="button" className="floating-correction-dupliquer" onClick={() => dupliquerFleche(flecheSelectionnee.id)}>
                                Dupliquer
                            </button>
                            <button type="button" className="delete-arrow-btn" onClick={() => supprimerFleche(flecheSelectionnee.id)}>
                                Supprimer
                            </button>
                        </fieldset>
                    </section>
        );
        const reglagesDetecteur = detecteurSelectionne && (
                    <section aria-label="Réglages du détecteur sélectionné">
                        <fieldset className="detecteur-editor">
                            <h4>Modifier le détecteur</h4>
                            <div className="editor-row">
                                <label>Nom:</label>
                                <span>{detecteurSelectionne.nom || `Détecteur ${detecteurSelectionne.id}`}</span>
                            </div>
                            <div className="editor-row">
                                <label>Type:</label>
                                <select
                                    className="detecteur-editor-select"
                                    aria-label="Type du détecteur dans la fenêtre détachée"
                                    value={detecteurSelectionne.categorie}
                                    onChange={(e) => modifierDetecteur(detecteurSelectionne.id, d => changerCategorie(d, e.target.value as CategorieDetecteur))}
                                >
                                    {CATEGORIES_DETECTEUR.map(c => (
                                        <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="editor-row">
                                <label>Rotation:</label>
                                <div className="rotation-controls">
                                    <button type="button" className="slider-btn minus"
                                        onClick={() => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, orientation: tournerDe(d.orientation || 0, -1) }))}
                                        title={tip('-1°')}>−</button>
                                    <input type="range" min="0" max="359" className="rotation-slider"
                                        value={detecteurSelectionne.orientation || 0}
                                        onChange={(e) => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, orientation: Number(e.target.value) }))} />
                                    <button type="button" className="slider-btn plus"
                                        onClick={() => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, orientation: tournerDe(d.orientation || 0, 1) }))}
                                        title={tip('+1°')}>+</button>
                                    <input type="number" min="0" max="359" className="rotation-input"
                                        value={detecteurSelectionne.orientation || 0}
                                        onChange={(e) => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, orientation: tournerDe(Number(e.target.value) || 0, 0) }))} />
                                    <span className="rotation-unit">°</span>
                                </div>
                            </div>
                            {dimensionSaisissable(detecteurSelectionne.categorie) && (
                                <div className="editor-row">
                                    <label>Longueur:</label>
                                    <input
                                        type="number"
                                        className="detecteur-editor-dimension"
                                        aria-label="Longueur du détecteur dans la fenêtre détachée"
                                        value={detecteurSelectionne.dimension ?? ''}
                                        onChange={(e) => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, dimension: dimensionDepuisSaisie(e.target.value, d.categorie) }))}
                                    />
                                    <span className="detecteur-editor-unit">m (largeur 1 m)</span>
                                </div>
                            )}
                            {retraitSaisissable(detecteurSelectionne.categorie) && detecteurSelectionne.categorie !== 'bouclePiedFeu' && (
                                <div className="editor-row">
                                    <label>Retrait de la boucle:</label>
                                    <input
                                        type="number"
                                        className="detecteur-editor-dimension"
                                        aria-label="Retrait de la boucle dans la fenêtre détachée"
                                        placeholder="mesuré sur l'image"
                                        value={detecteurSelectionne.retrait ?? ''}
                                        onChange={(e) => modifierDetecteur(detecteurSelectionne.id, d => ({ ...d, retrait: retraitDepuisSaisie(e.target.value, d.categorie) }))}
                                    />
                                    <span className="detecteur-editor-unit">m</span>
                                </div>
                            )}
                            <button type="button" className="delete-arrow-btn" onClick={() => retirerDetecteurDeImage(detecteurSelectionne.id)}>
                                Retirer de l'image
                            </button>
                        </fieldset>
                    </section>
        );
        const contenuReglages = reglagesFleche || reglagesDetecteur || (
            <div className="floating-correction-vide">
                <p><strong>Aucun élément sélectionné.</strong></p>
                <p>Dans l'image détachée, cliquez sur une flèche ou un détecteur pour le régler ici.</p>
                <ul>
                    <li>Glisser : déplacer l'élément.</li>
                    <li>Flèches du clavier : ajuster sa position.</li>
                    <li>Double-clic : tourner de 45°.</li>
                </ul>
            </div>
        );

        floatingImagePopup.renderToPopup(
            <ZoneVerrouSaisie section="image"><div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '6px 12px', background: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div className="floating-zoom-control">
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.max(0.3, z - 0.1))} title={tip('Réduire')}>−</button>
                        <span className="floating-zoom-value">{Math.round(floatingZoom * 100)}%</span>
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.min(2, z + 0.1))} title={tip('Agrandir')}>+</button>
                    </div>
                    <button
                        className={`floating-crop-btn ${showCropControls ? 'active' : ''}`}
                        onClick={() => setShowCropControls(!showCropControls)}
                        title={tip("Rogner l'image")}
                    >
                        ✂
                    </button>
                    <button
                        type="button"
                        className={`floating-crop-btn floating-correction-btn ${modeCorrection ? 'active' : ''}`}
                        aria-pressed={modeCorrection}
                        disabled={verrouille}
                        onClick={() => {
                            setModeCorrection(valeur => {
                                if (valeur) setSelection(null);
                                return !valeur;
                            });
                        }}
                        title={tip(verrouille
                            ? 'Image verrouillée : correction impossible'
                            : modeCorrection
                                ? 'Quitter le mode correction'
                                : 'Corriger : déplacer et régler les flèches et les détecteurs')}
                    >
                        ✎ Corriger
                    </button>
                    <MentionVerrou section="image" />
                </div>
                {showCropControls && (
                    <div className="floating-crop-controls">
                        <div className="crop-control">
                            <label>Haut</label>
                            <input type="range" min="0" max={maxCropY} value={cropT} onChange={(e) => setFloatingCrop(prev => ({ ...prev, top: parseInt(e.target.value) }))} />
                            <span>{cropT}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Bas</label>
                            <input type="range" min="0" max={maxCropY} value={cropB} onChange={(e) => setFloatingCrop(prev => ({ ...prev, bottom: parseInt(e.target.value) }))} />
                            <span>{cropB}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Gauche</label>
                            <input type="range" min="0" max={maxCropX} value={cropL} onChange={(e) => setFloatingCrop(prev => ({ ...prev, left: parseInt(e.target.value) }))} />
                            <span>{cropL}px</span>
                        </div>
                        <div className="crop-control">
                            <label>Droite</label>
                            <input type="range" min="0" max={maxCropX} value={cropR} onChange={(e) => setFloatingCrop(prev => ({ ...prev, right: parseInt(e.target.value) }))} />
                            <span>{cropR}px</span>
                        </div>
                        <button className="crop-reset-btn" onClick={() => setFloatingCrop({ top: 0, bottom: 0, left: 0, right: 0 })}>Réinitialiser</button>
                    </div>
                )}
                {/* data-fit-scroll : repère lu par usePopupWindow pour absorber
                    un éventuel débordement résiduel dans la taille de la fenêtre. */}
                <div className="floating-image-ligne" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div className="floating-image-content" data-fit-scroll style={{ flex: 1, overflow: 'auto' }}>
                    <div
                        className="floating-image-wrapper"
                        style={{
                            width: Math.max(1, cadreW - cropL - cropR) * floatingZoom,
                            height: Math.max(1, cadreH - cropT - cropB) * floatingZoom
                        }}
                    >
                        <div
                            className={`floating-image-inner ${imageFondClair ? 'fond-clair' : 'fond-sombre'}${corriger ? ' correction' : ''}`}
                            data-correction={corriger ? '' : undefined}
                            tabIndex={corriger ? 0 : undefined}
                            onKeyDown={surToucheCorrection}
                            onClick={() => { if (corriger) setSelection(null); }}
                            style={{
                                // Les marges décalent la boîte AVANT la mise à
                                // l'échelle, qui opère ensuite depuis son coin haut
                                // gauche : un décalage non mis à l'échelle laissait
                                // le cadre à sa place au zoom 100 %, mais le
                                // repoussait de cadreY × (zoom − 1) au-delà — d'où
                                // une bande qui s'ouvrait en haut et un bas tronqué
                                // d'autant, dès qu'on zoomait sur une image bordée
                                // de bandes vides.
                                marginTop: -(cadreY + cropT) * floatingZoom,
                                marginLeft: -(cadreX + cropL) * floatingZoom,
                                width: BOX_W,
                                height: BOX_H,
                                transform: `scale(${floatingZoom})`,
                                transformOrigin: 'top left'
                            }}
                        >
                            <img src={intersectionImage} alt="Carrefour" style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }} />
                            {showNums && Object.entries(groupMap).map(([gId, pts]) => {
                                const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                                const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                                const g = groups.find(gr => gr.id === Number(gId));
                                const isPieton = (g?.courant || '') === 'Piéton';
                                return isPieton ? (
                                    <div key={`fgnum-${gId}`} className="group-number-centroid pieton" style={{ left: `${cx}%`, top: `${cy}%` }}>
                                        <svg viewBox="0 0 20 18" width="20" height="18">
                                            <polygon points="10,1 1,17 19,17" fill="rgba(255,255,255,0.7)" stroke="#000" strokeWidth="1"/>
                                            <text x="10" y="15" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">{gId}</text>
                                        </svg>
                                    </div>
                                ) : (
                                    <div key={`fgnum-${gId}`} className="group-number-centroid" style={{ left: `${cx}%`, top: `${cy}%` }}>
                                        {gId}
                                    </div>
                                );
                            })}
                            {showCurrents && intersectionArrows.map(arrow => {
                                const groupId = arrow.groupId ?? 0;
                                // Un groupe sans vert n'a pas de mouvement à montrer :
                                // sa flèche disparaît, et son signal avec elle.
                                if (!mouvementServi(groupId)) return null;
                                const group = groups.find(g => g.id === groupId);
                                const courant = group?.courant || '';
                                const rotation = arrow.rotation || 0;
                                const scale = arrow.scale || 1;
                                const arrowLength = arrow.length || 1;
                                const turnLength = arrow.turnLength || 1;
                                const isHovered = hoveredArrowGroupId === groupId || !!hoveredArrowGroupIds?.includes(groupId);

                                // Même moteur de couleur que le panneau intégré.
                                // La copie réduite qui vivait ici ignorait les
                                // verts découpés, les groupes escamotés et la
                                // zone de coupure d'un escamotage, et n'employait
                                // les temps simulés que pendant la lecture.
                                const arrowColor = getGroupColorAtTime(groupId, activeTime, colorContext);

                                const isPedestrianOrCycle = courant === 'Piéton' || courant === 'Cycle';
                                const signal = signalDe(group);
                                const ppAllume = isPPLit(groupId, activeTime, colorContext);

                                return (
                                    <div
                                        key={arrow.id}
                                        className={`floating-arrow-marker ${isHovered ? 'hovered' : ''} ${isPedestrianOrCycle ? 'side-label' : ''}${corriger ? ' corrigeable' : ''}${selection?.type === 'fleche' && selection.id === arrow.id ? ' selectionnee' : ''}`}
                                        style={{ left: `${arrow.x}%`, top: `${arrow.y}%` }}
                                        onMouseEnter={() => setHoveredArrowGroupId && setHoveredArrowGroupId(groupId || null)}
                                        onMouseLeave={() => setHoveredArrowGroupId && setHoveredArrowGroupId(null)}
                                        onMouseDown={(e) => demarrerDeplacement(e, 'fleche', Number(arrow.id))}
                                        onClick={(e) => { if (corriger) { e.stopPropagation(); setSelection({ type: 'fleche', id: Number(arrow.id) }); } }}
                                        onDoubleClick={(e) => { if (corriger) { e.stopPropagation(); tournerSelection('fleche', Number(arrow.id)); } }}
                                    >
                                        <div className="arrow-symbol" style={{ transform: signal ? `scale(${echelleSignal(scale, courant)})` : `rotate(${rotation}deg) scale(${scale})` }}>
                                            {signal ? (
                                                <SignalModule code={signal} couleur={arrowColor} temps={activeTime} enLecture={isPlayingSimulation} a13bAllume={ppAllume} courant={courant} />
                                            ) : avecPriseSurvol(renderFloatingArrowSVG(courant, arrowColor, arrowLength, turnLength, ppAllume), scale * floatingZoom)}
                                        </div>
                                        {showNames && group?.name && (
                                            // Contre-échelle : l'étiquette garde sa taille à l'écran quel que
                                            // soit le zoom, si bien que zoomer écarte les flèches sans grossir
                                            // le texte — c'est ce qui dénoue les chevauchements sur un plan dense.
                                            <span
                                                className="arrow-label"
                                                style={{
                                                    transform: isPedestrianOrCycle
                                                        ? `translateY(-50%) scale(${1 / floatingZoom})`
                                                        : `translateX(-50%) scale(${1 / floatingZoom})`
                                                }}
                                            >
                                                {group.name}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {afficherDetecteurs && detecteurs.map(detecteur => {
                                if (!detecteur.position) return null;
                                const taille = tailleDetecteur(detecteur, pixelsParMetre);
                                const dansBoucle = etiquetteDansBoucle(detecteur, taille);
                                const instantBoucles = isPlayingSimulation ? detectorTime : activeTime;
                                const occupe = estOccupee(instantBoucles, intervalles.get(detecteur.id) ?? [], cycleAnimation);
                                return (
                                    <div
                                        key={`fdet-${detecteur.id}`}
                                        className={`detecteur-marker${corriger ? ' corrigeable' : ''}${selection?.type === 'detecteur' && selection.id === detecteur.id ? ' selectionnee' : ''}`}
                                        style={{ left: `${detecteur.position.x}%`, top: `${detecteur.position.y}%` }}
                                        onMouseDown={(e) => demarrerDeplacement(e, 'detecteur', detecteur.id)}
                                        onClick={(e) => { if (corriger) { e.stopPropagation(); setSelection({ type: 'detecteur', id: detecteur.id }); } }}
                                        onDoubleClick={(e) => { if (corriger) { e.stopPropagation(); tournerSelection('detecteur', detecteur.id); } }}
                                    >
                                        <div
                                            className="detecteur-symbol"
                                            style={{
                                                width: taille.largeur,
                                                height: taille.hauteur,
                                                transform: `translate(-50%, -50%) rotate(${detecteur.orientation || 0}deg)`
                                            }}
                                        >
                                            {renderDetecteurSVG(detecteur, pixelsParMetre, occupe)}
                                        </div>
                                        {afficherNomsDetecteurs && (
                                            <span
                                                className={`detecteur-label ${dansBoucle ? 'dans-boucle' : ''} ${estBoucle(detecteur.categorie) && !dansBoucle ? 'au-dessus' : ''}`}
                                                style={dansBoucle
                                                    ? { top: 0, transform: 'translate(-50%, -50%)' }
                                                    : estBoucle(detecteur.categorie)
                                                        ? { top: -(taille.hauteur / 2) - 6 }
                                                        : { top: taille.hauteur / 2 + 4 }}
                                            >
                                                {detecteur.nom}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {corriger && reglagesPopup.bloquee && <aside className="floating-correction-panneau">{contenuReglages}</aside>}
                </div>
            </div></ZoneVerrouSaisie>
        );

        if (corriger && reglagesPopup.popupOpen) {
            reglagesPopup.renderToPopup(
                <ZoneVerrouSaisie section="image">
                    <aside className="floating-correction-panneau en-fenetre">{contenuReglages}</aside>
                </ZoneVerrouSaisie>
            );
        }
    }, [showFloatingImage, intersectionImage, floatingCrop, floatingZoom, showCropControls,
        intersectionArrows, detecteurs, detecteurModule, pixelsParMetre, getTrafficData, groups, imageNaturalDims, imageFondClair, hoveredArrowGroupId, hoveredArrowGroupIds, hoveredDiagramTime,
        selectedActions, conflictMatrix,
        isPlayingSimulation, simulationCurrentTime, detectorTime, simulationResult,
        actionData, cycleLength, imageBrightness, imageContrast,
        intersectionDisplay.showCurrents, intersectionDisplay.showGroupNumbers, intersectionDisplay.showGroupNames,
        intersectionDisplay.showSignals, intersectionDisplay.showDetecteurs, intersectionDisplay.showDetecteurNames,
        modeCorrection, selection, verrouille, setIntersectionArrows, setDetecteurs,
        tooltipsEnabled, detecteurModule, floatingImagePopup.renderToPopup,
        reglagesPopup.renderToPopup, reglagesPopup.popupOpen, reglagesPopup.bloquee]); // eslint-disable-line react-hooks/exhaustive-deps
};

export default useFloatingImageRenderer;
