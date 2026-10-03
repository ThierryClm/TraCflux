import { Fragment } from 'react';
import TimelineDiagram from '../TimelineDiagram';
import TrafficTable from '../TrafficTable';
import DiagnosticPanel from '../DiagnosticPanel';
import DiagramLegend from '../DiagramLegend';
import PhasageBulle from '../PhasageBulle';
import { APP_NAME, APP_VERSION } from '../../version';
import { actionsSimulables, conflitsSimules } from '../../utils/simulationCalculator';
import { fitBubblesToPage, REF_IMAGE_BOX_HEIGHT, REF_IMAGE_BOX_WIDTH } from '../../utils/phasageLayout';
import { groupesInhibes } from '../../utils/trafficHelpers';
import { LOGO_APP } from '../../utils/logoApp';
import renderArrowSVG from '../../utils/renderArrowSVG';
import { BOX_H, BOX_W, fitDetachedImageBox } from '../../utils/floatingImageBox';

// Le SVG métier est dessiné dans une boîte native de 32 px. L'impression doit
// respecter cette base avant d'appliquer l'échelle enregistrée sur la flèche :
// une largeur forcée à 64 px doublait tous les symboles sur le plan du dossier.
const PRINT_PLAN_ARROW_SIZE = 32;

function PrintPreviewModal({
    isOpen,
    onClose,
    project,
    plans,
    traffic,
    simulation,
    image,
    print,
    actions,
    preferences,
}) {
    const printPreviewModal = isOpen;
    const setPrintPreviewModal = (visible) => { if (!visible) onClose(); };
    const { projectName, intersectionName, projectProperties, groups, conflictMatrix, cycleLength } = project;
    const { pfTabs, activePFId, pfTrafficDatasetMap } = plans;
    const { activeTrafficDataset, trafficDatasets, trafficDatasetNames } = traffic;
    const { simulationName, simulationResultImpression, simulationSelectedActions } = simulation;
    const { intersectionImage, intersectionArrows, imageBrightness, imageContrast, imageNaturalDims } = image;
    const printedImageFrame = fitDetachedImageBox(imageNaturalDims);
    const printedImageArrows = intersectionArrows
        .map(arrow => ({
            ...arrow,
            printX: ((((arrow.x / 100) * BOX_W) - printedImageFrame.x) / printedImageFrame.w) * 100,
            printY: ((((arrow.y / 100) * BOX_H) - printedImageFrame.y) / printedImageFrame.h) * 100,
        }))
        .filter(arrow => (
            arrow.printX >= 0 && arrow.printX <= 100 &&
            arrow.printY >= 0 && arrow.printY <= 100
        ));
    const {
        printType,
        dossierSections,
        dossierPortrait,
        dossierPrintWidth,
        descriptionPrintStyle,
        largeurConditionsImpression,
        microPrintStyle,
        printPreviewPageRef,
        injectDossierFooterStyle,
    } = print;
    const { actionData, microCustomFields } = actions;
    const { tooltipPrefs } = preferences;

    return (
        <>
            {/* Print Preview Modal */}
            {printPreviewModal && (
                <div className="modal-overlay print-preview-overlay" onClick={() => setPrintPreviewModal(false)}>
                    <div className="modal-content print-preview-modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>
                                {printType === 'matrix' && 'Aperçu - Matrice de dégagement'}
                                {printType === 'form' && 'Aperçu - Formulaire'}
                                {printType === 'diagram' && 'Aperçu - Diagramme'}
                                {printType === 'dossier' && 'Aperçu - Dossier complet'}
                            </h3>
                            <button className="modal-close" onClick={() => setPrintPreviewModal(false)} aria-label="Fermer la fenêtre">×</button>
                        </div>
                        <div className="print-preview-container">
                            <div className="print-preview-page" ref={printPreviewPageRef}>
                                {/* Header commun (sauf pour diagramme qui a son propre en-tête) */}
                                {printType !== 'diagram' && printType !== 'dossier' && (
                                    <div className="print-preview-header">
                                        <h2>{intersectionName || 'Sans titre'}</h2>
                                        <p>{groups.length} groupes - Cycle: {cycleLength}s</p>
                                    </div>
                                )}

                                {/* Contenu selon le type */}
                                {printType === 'matrix' && (
                                    <div className="print-preview-matrix">
                                        <table className="preview-matrix-table">
                                            <thead>
                                                <tr>
                                                    <th></th>
                                                    {groups.map(g => (
                                                        <th key={g.id}>{g.id}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups.map((fromGroup, fromIdx) => (
                                                    <tr key={fromGroup.id}>
                                                        <td className="row-header">{fromGroup.id}</td>
                                                        {groups.map((toGroup, toIdx) => (
                                                            <td
                                                                key={toGroup.id}
                                                                className={fromIdx === toIdx ? 'diagonal' : ''}
                                                            >
                                                                {fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : ''}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {printType === 'form' && (
                                    <div className="print-preview-form">
                                        <table className="preview-form-table">
                                            <thead>
                                                <tr>
                                                    <th>GF</th>
                                                    <th>Nom</th>
                                                    <th>Type</th>
                                                    <th>Déc</th>
                                                    <th>V</th>
                                                    <th>J</th>
                                                    <th>R</th>
                                                    <th>Vm</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groups.map(g => (
                                                    <tr key={g.id}>
                                                        <td>{g.id}</td>
                                                        <td>{g.name || ''}</td>
                                                        <td>{g.type || 'VL'}</td>
                                                        <td>{g.offset}</td>
                                                        <td>{g.durations?.green || 0}</td>
                                                        <td>{g.durations?.orange || 0}</td>
                                                        <td>{g.durations?.red || 0}</td>
                                                        <td>{g.minGreen || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Colonne « Action_Micro » : à l'écran, un champ de largeur fixe en
                                    police à chasse fixe, qui replie le texte. À l'impression la cellule
                                    recevait la chaîne entière sur une ligne — la colonne mangeait la page
                                    et les autres se tassaient. On y remet le même repli, exprimé en
                                    caractères (unité ch, exacte en chasse fixe) : largeur de la colonne
                                    écran divisée par la chasse (≈ 0,6 × 16,8 px, la taille du champ). */}
                                {printType === 'diagram' && (() => {
                                    // A4 paysage avec marges 5mm: ~287mm x 200mm
                                    // A4 paysage marges 10mm: ~277mm = ~1047px à 96dpi
                                    // Marge de sécurité pour variations navigateur
                                    const printPageWidth = 960; // A4 paysage avec marges navigateur
                                    // Sidebar: ~325px fixe en CSS (commentaires/remarques masquées)
                                    const printSidebarWidth = 325;
                                    const printTimelineWidth = printPageWidth - printSidebarWidth; // ~635px

                                    // Référence : 100s = pleine largeur timeline
                                    // Cycles <= 100s : même PPS (1 seconde = même largeur)
                                    // Cycles > 100s : PPS réduit pour tenir dans la page
                                    const referenceCycle = 100;
                                    const referencePPS = (printTimelineWidth / referenceCycle) * 0.95;
                                    const optimalPPS = cycleLength <= referenceCycle
                                        ? referencePPS
                                        : printTimelineWidth / cycleLength;

                                    // Scale de sécurité si le diagramme dépasse la page
                                    const estimatedWidth = printSidebarWidth + (cycleLength * optimalPPS);
                                    const printScale = estimatedWidth > printPageWidth
                                        ? printPageWidth / estimatedWidth : 1;

                                    return (
                                    <div className="print-preview-diagram print-preview-landscape" style={
                                        printScale < 1 ? {
                                            transform: `scale(${printScale.toFixed(3)})`,
                                            transformOrigin: 'top left',
                                            width: `${Math.ceil(100 / printScale)}%`
                                        } : {}
                                    }>
                                        {/* En-tête du diagramme */}
                                        <div className="print-diagram-header">
                                            <h3>Diagramme {intersectionName || 'Sans titre'} - {pfTabs.find(pf => pf.id === activePFId)?.name || 'PF1'}</h3>
                                        </div>

                                        {/* Diagramme réel - A4 paysage optimisé */}
                                        <div className="print-diagram-content">
                                            <TimelineDiagram
                                                groups={groups}
                                                globalTime={0}
                                                onGroupClick={() => {}}
                                                pixelsPerSecond={optimalPPS}
                                                conflicts={[]}
                                                conflictMatrix={conflictMatrix}
                                                updateGroupParams={() => {}}
                                                cycleLength={cycleLength}
                                                actionData={actionData}
                                                updateActionRow={() => {}}
                                                startDrag={() => {}}
                                                endDrag={() => {}}
                                                showDependencies={false}
                                                dependencyGap={20}
                                                hoveredActionId={null}
                                                setHoveredActionId={() => {}}
                                                planName={pfTabs.find(pf => pf.id === activePFId)?.name || 'PF1'}
                                                isPrintMode={true}
                                            tooltipsEnabled={tooltipPrefs.diagram}
                                            />
                                        </div>

                                        {/* Conditions de micro-régulation */}
                                        {actionData.filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '').length > 0 && (
                                            <div className="print-actions-section">
                                                <h4>Conditions de micro-régulation</h4>
                                                <table className="print-actions-table" style={{ width: `${largeurConditionsImpression}px` }}>
                                                    <thead>
                                                        <tr>
                                                            <th>GF</th>
                                                            <th>Action</th>
                                                            <th>Description</th>
                                                            <th>Déb</th>
                                                            <th>Fin</th>
                                                            <th>Abrv</th>
                                                            <th>Action_Micro</th>
                                                            <th colSpan="2">Plage</th>
                                                            <th colSpan="4">Action GF</th>
                                                        </tr>
                                                        <tr className="print-actions-subheader">
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th></th>
                                                            <th>1</th>
                                                            <th>2</th>
                                                            <th>1</th>
                                                            <th>2</th>
                                                            <th>3</th>
                                                            <th>4</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {actionData
                                                            .filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '')
                                                            .map(row => (
                                                                <tr key={row.id}>
                                                                    <td>{row.gf}</td>
                                                                    <td>{row.action}</td>
                                                                    <td className="print-desc-cell"><div className="print-desc-wrap" style={descriptionPrintStyle || undefined}>{row.description}</div></td>
                                                                    <td>{row.deb}</td>
                                                                    <td>{row.fin}</td>
                                                                    <td>{row.abrv}</td>
                                                                    <td className="print-micro-cell"><div className="print-micro-wrap" style={microPrintStyle || undefined}>{row.micro}</div></td>
                                                                    <td>{row.plage1}</td>
                                                                    <td>{row.plage2}</td>
                                                                    <td>{row.actGf1}</td>
                                                                    <td>{row.actGf1Gf2}</td>
                                                                    <td>{row.actGf1Gf3}</td>
                                                                    <td>{row.actGf1Gf4}</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Pied de page: chemin du fichier JSON à gauche, date à droite */}
                                        <div className="print-diagram-footer">
                                            <span className="print-footer-path">
                                                {`${APP_NAME} ${APP_VERSION}`}
                                            </span>
                                        </div>
                                    </div>
                                    );
                                })()}

                                {printType === 'dossier' && (() => {
                                    // A4 paysage marges 10mm: largeur utile = 277mm = 1047px à 96dpi.
                                    // On utilise 1035px pour laisser une petite marge de securite (~12 px) :
                                    // 1040px coupait juste le trait droit du cadre du diagramme sur les cycles
                                    // longs (137s observe), 1035px le rend visible sans rogner la largeur utile.
                                    // dossierPrintWidth est mesuré (cf. état plus haut) : il vaut la
                                    // largeur réelle du conteneur d'impression, et non un chiffre figé.
                                    // On lui retire une marge : viser la largeur au pixel près faisait
                                    // tomber la dernière graduation hors de la page sur un cycle long,
                                    // le trait de fin de cycle et la bordure comptant eux aussi.
                                    // Marge de sécurité interne, en pixels. Elle valait 26 — près de
                                    // 7 mm — du temps où la largeur de page était RELEVÉE, donc
                                    // incertaine. Elle est maintenant décidée : 8 px suffisent à
                                    // garder la dernière graduation et la bordure dans la page.
                                    const MARGE_IMPRESSION = 8;
                                    const dossierUsableWidth = dossierPrintWidth - MARGE_IMPRESSION;
                                    // Sidebar TimelineDiagram reelle = 325px (sans commentaires/remarques masques)
                                    // Largeur du bandeau des groupes SUR LA FEUILLE — resserré par
                                    // rapport à l'écran (cf. App.css) : les champs y sont en lecture
                                    // seule et n'ont pas besoin d'une zone de clic. Les deux valeurs
                                    // doivent rester d'accord, sinon la frise est calculée pour une
                                    // place qu'elle n'a pas.
                                    const dossierSidebarReal = 315;
                                    // Réduction propre à la MATRICE, pour qu'elle n'élargisse pas la page.
                                    //
                                    // Sa largeur suit le nombre de groupes : colonne des noms, puis une
                                    // colonne par groupe. Au-delà d'une trentaine, elle dépasse la feuille
                                    // et le navigateur réduit alors tout le document. On la réduit donc
                                    // elle seule, ce qui garde les noms sur une ligne et la matrice sur une
                                    // page — le repli des noms, essayé d'abord, doublait la hauteur des
                                    // lignes et la faisait déborder sur plusieurs feuilles.
                                    // La largeur naturelle est estimée : colonne des noms ≈ 130 px, puis
                                    // 27 px par groupe. Une petite matrice n'est pas touchée.
                                    const largeurMatriceEstimee = 130 + groups.length * 27;
                                    const zoomMatrice = Math.min(1, dossierUsableWidth / largeurMatriceEstimee);
                                    // Même remède pour le tableau des conditions, mais sur une
                                    // largeur MESURÉE et non estimée : ses colonnes sont réglables
                                    // par l'utilisateur. On le réduit au lieu de redistribuer ses
                                    // colonnes — la répartition changeait les retours à la ligne et
                                    // ne donnait plus la présentation du projet.
                                    // Le facteur joue dans les DEUX SENS. Borné à 1, le tableau
                                    // se dimensionnait sur son contenu et laissait une bande vide à
                                    // droite ; sa largeur différant de celle de l'écran, ses retours
                                    // à la ligne tombaient ailleurs. Posé à la largeur de l'écran
                                    // puis mis à l'échelle de la page, il garde exactement la
                                    // composition du projet — `zoom` agrandissant aussi le texte,
                                    // les coupures retombent aux mêmes mots.
                                    // Plafond à 1,5 : au-delà, un tableau étroit à l'écran
                                    // deviendrait démesuré sur la feuille.
                                    const zoomConditions = Math.min(1.5, dossierUsableWidth / largeurConditionsImpression);
                                    const availableWidth = dossierUsableWidth - dossierSidebarReal;
                                    // Cycle de référence de l'échelle homogène, propre au format.
                                    //
                                    // La règle ne change pas : en deçà du cycle de référence, une
                                    // seconde vaut toujours la même largeur — deux dossiers restent
                                    // comparables ; au-delà, on comprime pour remplir la page.
                                    // Seul le seuil s'adapte à la largeur disponible : 277 mm en
                                    // paysage contre 190 en portrait, où l'on vise donc des cycles
                                    // plus courts.
                                    const refCycle = dossierPortrait ? 80 : 120;
                                    const basePPS = cycleLength <= refCycle
                                        ? availableWidth / refCycle
                                        : availableWidth / cycleLength;

                                    // Fonctions de calcul trafic (dupliquées de TrafficTable)
                                    const getTotalGreenTime = (groupId, mainGreenTime) => {
                                        if (!mainGreenTime) return 0;
                                        const lucarneActions = actionData.filter(
                                            action => action.action === 'Seconde lucarne' &&
                                                     parseInt(action.gf) === groupId &&
                                                     action.deb !== '' && action.deb !== null &&
                                                     action.fin !== '' && action.fin !== null
                                        );
                                        let lucarneDuration = 0;
                                        lucarneActions.forEach(lucarne => {
                                            const deb = parseFloat(lucarne.deb);
                                            const fin = parseFloat(lucarne.fin);
                                            if (!isNaN(deb) && !isNaN(fin)) {
                                                let duration = fin - deb;
                                                if (duration < 0) duration += cycleLength;
                                                lucarneDuration += duration;
                                            }
                                        });
                                        return mainGreenTime + lucarneDuration;
                                    };
                                    const calcVUtile = (trafficVol, laneCoef) => {
                                        if (!trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        return Math.round(trafficVol / (1800 * laneCoef / cycleLength));
                                    };
                                    const calcCapacity = (greenTime, vUtile) => {
                                        if (!greenTime || !vUtile || greenTime === 0) return null;
                                        return Math.round((vUtile / greenTime) * 100);
                                    };
                                    const calcDelay = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
                                        const bandeAction = actionData.find(
                                            action => action.action === 'Début de bande passante' &&
                                                     parseInt(action.actGf1) === groupId &&
                                                     action.fin !== '' && action.fin !== null && action.fin !== undefined
                                        );
                                        if (bandeAction) {
                                            const finValue = parseFloat(bandeAction.fin);
                                            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                                                return Math.max(0, Math.round(groupOffset - finValue));
                                            }
                                        }
                                        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        const ratio = trafficVol / (1800 * laneCoef);
                                        if (ratio >= 1) return null;
                                        const denominator = 2 * cycleLength * (1 - ratio);
                                        if (denominator === 0) return null;
                                        const redTime = cycleLength - greenTime;
                                        return Math.round((redTime * redTime) / denominator);
                                    };
                                    const calcQueue = (greenTime, trafficVol, laneCoef, groupId, groupOffset) => {
                                        const bandeAction = actionData.find(
                                            action => action.action === 'Début de bande passante' &&
                                                     parseInt(action.actGf1) === groupId &&
                                                     action.fin !== '' && action.fin !== null && action.fin !== undefined
                                        );
                                        if (bandeAction) {
                                            const finValue = parseFloat(bandeAction.fin);
                                            if (!isNaN(finValue) && groupOffset !== undefined && groupOffset !== null) {
                                                return Math.max(0, Math.round(groupOffset - finValue));
                                            }
                                        }
                                        if (!greenTime || !trafficVol || !laneCoef || !cycleLength || laneCoef === 0) return null;
                                        const redTime = cycleLength - greenTime;
                                        const innerValue = trafficVol * redTime / 3600 / laneCoef;
                                        return (Math.floor(innerValue) + 1) * 6;
                                    };
                                    const parseTrafficVol = (val) => {
                                        if (!val) return 0;
                                        return parseInt(String(val).replace(/c$/i, '')) || 0;
                                    };

                                    const dossierSmallLogos = (projectProperties.logoMoa || projectProperties.logoMoe) ? (
                                        <span className="dossier-header-logos">
                                            {projectProperties.logoMoa && <img src={projectProperties.logoMoa} alt="" />}
                                            {projectProperties.logoMoe && <img src={projectProperties.logoMoe} alt="" />}
                                        </span>
                                    ) : null;

                                    return (
                                    <div className="print-preview-dossier">
                                        {/* Logos : UNE fois par feuille, en haut à droite.
                                            Ils étaient répétés dans le titre de chaque section, donc
                                            plusieurs fois sur une page qui en porte plusieurs. Un élément
                                            en position fixe est réémis par le navigateur sur chaque page
                                            imprimée — la marge de page, elle, n'accepte pas d'image. */}
                                        {dossierSmallLogos && <div className="dossier-logos-page">{dossierSmallLogos}</div>}
                                        {/* 1. Titre du projet avec logos et informations */}
                                        <div className="print-dossier-section print-dossier-title">
                                            <div className="dossier-title-logos">
                                                <div className="dossier-title-logo-left">
                                                    {/* Le logo de l'outil ouvre la rangée ; celui du maître
                                                        d'ouvrage, quand il existe, se place à sa droite. */}
                                                    <img src={LOGO_APP} alt="TraCflux" className="dossier-logo-app" />
                                                    {projectProperties.logoMoa && <img src={projectProperties.logoMoa} alt="" className="dossier-logo-large" />}
                                                </div>
                                                <div className="dossier-title-center">
                                                    <h2>Carrefour {intersectionName || 'Sans titre'}</h2>
                                                    <p className="dossier-title-commune">
                                                        {projectProperties.commune ? `Commune de ${projectProperties.commune}` : (projectName || '')}
                                                    </p>
                                                </div>
                                                <div className="dossier-title-logo-right">
                                                    {projectProperties.logoMoe && <img src={projectProperties.logoMoe} alt="" className="dossier-logo-large" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Plan du carrefour + Propriétés du projet */}
                                        {dossierSections.image && (
                                        <div className="print-dossier-section print-dossier-image-props">
                                            <div className="dossier-image-props-headers">
                                                <h3 className="dossier-image-props-h3-left">Plan du carrefour</h3>
                                                <h3 className="dossier-image-props-h3-right">Propriétés du projet</h3>
                                            </div>
                                            <div className="dossier-image-props-row">
                                            <div className="dossier-image-col">
                                            {intersectionImage ? (
                                                <div className="dossier-image-container">
                                                    <img
                                                        src={intersectionImage}
                                                        alt="Carrefour"
                                                        className="dossier-carrefour-img"
                                                        style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }}
                                                    />
                                                    {printedImageArrows.map(arrow => {
                                                        const group = groups.find(g => String(g.id) === String(arrow.groupId));
                                                        const courant = group?.courant || '';

                                                        return (
                                                            <div
                                                                key={`plan-arrow-${arrow.id}`}
                                                                className="dossier-plan-arrow"
                                                                style={{ left: `${arrow.printX}%`, top: `${arrow.printY}%` }}
                                                            >
                                                                <div
                                                                    className="dossier-plan-arrow-symbol"
                                                                    style={{
                                                                        width: `${PRINT_PLAN_ARROW_SIZE}px`,
                                                                        transform: `rotate(${arrow.rotation || 0}deg) scale(${arrow.scale || 1})`,
                                                                    }}
                                                                >
                                                                    {renderArrowSVG(
                                                                        courant,
                                                                        '#222222',
                                                                        arrow.length || 1,
                                                                        arrow.turnLength || 1,
                                                                        false,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {dossierSections.gfNumbers && (() => {
                                                        // Grouper les flèches par groupId (exclure celles hors image)
                                                        // Estimer la taille rendue de l'image pour le décalage TàD/TàG
                                                        const imgR = imageNaturalDims.width / imageNaturalDims.height;
                                                        const estH = Math.min(480, imageNaturalDims.height);
                                                        const estW = Math.min(estH * imgR, 1000);
                                                        const groupMap = {};
                                                        printedImageArrows.forEach(arrow => {
                                                            if (!arrow.groupId) return;
                                                            if (arrow.x < 0 || arrow.x > 100 || arrow.y < 0 || arrow.y > 100) return;
                                                            const courant = groups.find(g => String(g.id) === String(arrow.groupId))?.courant || '';
                                                            let px = arrow.printX;
                                                            let py = arrow.printY;
                                                            // Pour TàD/TàG, décaler vers le corps (ignorer le retour)
                                                            if (courant === 'TàD' || courant === 'TàG') {
                                                                const sc = arrow.scale || 1;
                                                                const svgSz = PRINT_PLAN_ARROW_SIZE * sc;
                                                                const dxSvg = courant === 'TàD' ? -8 : 8;
                                                                const dySvg = 2;
                                                                const dxPx = (dxSvg / 32) * svgSz;
                                                                const dyPx = (dySvg / 32) * svgSz;
                                                                const rotRad = (arrow.rotation || 0) * Math.PI / 180;
                                                                px += (dxPx * Math.cos(rotRad) - dyPx * Math.sin(rotRad)) / estW * 100;
                                                                py += (dxPx * Math.sin(rotRad) + dyPx * Math.cos(rotRad)) / estH * 100;
                                                            }
                                                            if (!groupMap[arrow.groupId]) groupMap[arrow.groupId] = [];
                                                            groupMap[arrow.groupId].push({ x: px, y: py });
                                                        });
                                                        return Object.entries(groupMap).map(([gId, pts]) => {
                                                            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                                                            const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                                                            const grp = groups.find(g => String(g.id) === gId);
                                                            const isPieton = grp?.courant === 'Piéton';
                                                            // La priorité piéton n'est ni un flux véhicule ni une
                                                            // traversée : elle a sa propre forme, le cercle.
                                                            const isPP = grp?.courant === 'PP';
                                                            return isPieton ? (
                                                                <div
                                                                    key={`gf-${gId}`}
                                                                    className="dossier-gf-label pieton"
                                                                    style={{ left: `${cx}%`, top: `${cy}%` }}
                                                                >
                                                                    <svg viewBox="0 0 26 24" width="26" height="24">
                                                                        <polygon points="13,1 1,23 25,23" fill="rgba(255,255,255,0.85)" stroke="#000" strokeWidth="1"/>
                                                                        <text x="13" y="20" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000">{gId}</text>
                                                                    </svg>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    key={`gf-${gId}`}
                                                                    className={`dossier-gf-label${isPP ? ' pp' : ''}`}
                                                                    style={{ left: `${cx}%`, top: `${cy}%` }}
                                                                >
                                                                    {gId}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="dossier-no-image">(Pas d'image)</p>
                                            )}
                                            </div>
                                            <div className="dossier-props-col">
                                                <table className="dossier-props-table">
                                                    <tbody>
                                                        {projectProperties.idCommune && <tr><td>Id. commune</td><td>{projectProperties.idCommune}</td></tr>}
                                                        {projectProperties.idCarrefour && <tr><td>Id. carrefour</td><td>{projectProperties.idCarrefour}</td></tr>}
                                                        {projectProperties.numeroDossier && <tr><td>N° dossier</td><td>{projectProperties.numeroDossier}</td></tr>}
                                                        {projectProperties.phaseEtude && <tr><td>Phase d'étude</td><td>{
                                                            ({ESQ:'Esquisse',AVP:'Avant-projet',PRO:'Projet',DCE:'Consultation',ACT:'Assistance',EXE:'Exécution',DOE:'Dossier ouvrage'})[projectProperties.phaseEtude] || projectProperties.phaseEtude
                                                        }</td></tr>}
                                                        {projectProperties.moa && <tr><td>Maître d'ouvrage</td><td>{projectProperties.moa}</td></tr>}
                                                        {projectProperties.moe && <tr><td>Concepteur</td><td>{projectProperties.moe}</td></tr>}
                                                        {projectProperties.bureauEtudes && <tr><td>Entreprise</td><td>{projectProperties.bureauEtudes}</td></tr>}
                                                        {projectProperties.auteur && <tr><td>Auteur</td><td>{projectProperties.auteur}</td></tr>}
                                                        {projectProperties.dateCreation && <tr><td>Date de création</td><td>{new Date(projectProperties.dateCreation).toLocaleDateString('fr-FR')}</td></tr>}
                                                        {projectProperties.dateModification && <tr><td>Dernière modif.</td><td>{new Date(projectProperties.dateModification).toLocaleString('fr-FR')}</td></tr>}
                                                        {projectProperties.commentaires && <tr><td>Commentaires</td><td className="dossier-props-comment">{projectProperties.commentaires}</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* 3. Formulaire */}
                                        {dossierSections.formulaire && (
                                        <div className="print-dossier-section print-dossier-form">
                                            <h3>Formulaire</h3>
                                            <table className="preview-form-table">
                                                <thead>
                                                    <tr>
                                                        <th>GF</th>
                                                        <th>Nom</th>
                                                        <th>Type</th>
                                                        <th>Courant</th>
                                                        <th>Mini</th>
                                                        <th>Jaune</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groups.map(g => (
                                                        <tr key={g.id}>
                                                            <td>{g.id}</td>
                                                            <td>{g.name || ''}</td>
                                                            <td>{g.type || 'VL'}</td>
                                                            <td>{g.courant || ''}</td>
                                                            <td>{g.minGreen || 0}</td>
                                                            <td>{g.durations?.orange || 0}</td>
                           ���-���jםw)ښ'-��kz˥���)ڗ^8׭����蠆םn�`z޸�M+z���+a����j�,