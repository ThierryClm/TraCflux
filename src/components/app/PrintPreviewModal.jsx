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
                                                    {dossierSections.gfNumbers && (() => {
                                                        // Grouper les flèches par groupId (exclure celles hors image)
                                                        // Estimer la taille rendue de l'image pour le décalage TàD/TàG
                                                        const imgR = imageNaturalDims.width / imageNaturalDims.height;
                                                        const estH = Math.min(480, imageNaturalDims.height);
                                                        const estW = Math.min(estH * imgR, 1000);
                                                        const groupMap = {};
                                                        intersectionArrows.forEach(arrow => {
                                                            if (!arrow.groupId) return;
                                                            if (arrow.x < 0 || arrow.x > 100 || arrow.y < 0 || arrow.y > 100) return;
                                                            const courant = groups.find(g => String(g.id) === String(arrow.groupId))?.courant || '';
                                                            let px = arrow.x;
                                                            let py = arrow.y;
                                                            // Pour TàD/TàG, décaler vers le corps (ignorer le retour)
                                                            if (courant === 'TàD' || courant === 'TàG') {
                                                                const sc = arrow.scale || 1;
                                                                const svgSz = 96 * sc;
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
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 4a. Matrice de sécurité */}
                                        {dossierSections.securiteMatrix && (
                                        <div className="print-dossier-section print-dossier-matrix" style={zoomMatrice < 1 ? { zoom: zoomMatrice.toFixed(3) } : undefined}>
                                            <h3>Matrice de sécurité</h3>
                                            <table className="preview-matrix-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th className="col-name-header">Nom</th>
                                                        {groups.map(g => (
                                                            <th key={g.id}>{g.id}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const pf1Matrix = pfTabs?.find(pf => pf.id === 1)?.conflictMatrix || null;
                                                        const isComparing = activePFId !== 1 && pf1Matrix && pf1Matrix.length > 0;
                                                        return groups.map((fromGroup, fromIdx) => (
                                                        <tr key={fromGroup.id}>
                                                            <td className="row-header">{fromGroup.id}</td>
                                                            <td className="row-name">{fromGroup.name || ''}</td>
                                                            {groups.map((toGroup, toIdx) => {
                                                                const rawVal = fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : '';
                                                                let val = '';
                                                                if (rawVal !== '' && rawVal != null) {
                                                                    const numVal = parseInt(rawVal);
                                                                    if (!isNaN(numVal)) {
                                                                        const fromType = fromGroup.type;
                                                                        const isVehicle = (fromType === 'V' || fromType === 'VL' || fromType === 'B' || fromType === 'TC');
                                                                        val = isVehicle ? Math.max(0, numVal - (fromGroup.durations?.orange || 0)) : numVal;
                                                                    }
                                                                }
                                                                let color = null;
                                                                if (isComparing && fromIdx !== toIdx && val !== '') {
                                                                    const pf1RawVal = pf1Matrix[fromIdx]?.[toIdx];
                                                                    if (pf1RawVal !== '' && pf1RawVal != null) {
                                                                        const pf1Num = parseInt(pf1RawVal);
                                                                        if (!isNaN(pf1Num)) {
                                                                            const fromType = fromGroup.type;
                                                                            const isVehicle = (fromType === 'V' || fromType === 'VL' || fromType === 'B' || fromType === 'TC');
                                                                            const ref = isVehicle ? Math.max(0, pf1Num - (fromGroup.durations?.orange || 0)) : pf1Num;
                                                                            if (val > ref) color = '#f44336';
                                                                            else if (val < ref) color = '#4caf50';
                                                                        }
                                                                    }
                                                                }
                                                                return (
                                                                <td
                                                                    key={toGroup.id}
                                                                    className={fromIdx === toIdx ? 'diagonal' : ''}
                                                                    style={color ? { color, fontWeight: 'bold' } : undefined}
                                                                >
                                                                    {val}
                                                                </td>
                                                                );
                                                            })}
                                                        </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 4b. Matrice des temps interverts */}
                                        {dossierSections.matrice && (
                                        <div className="print-dossier-section print-dossier-matrix" style={zoomMatrice < 1 ? { zoom: zoomMatrice.toFixed(3) } : undefined}>
                                            <h3>Matrice des temps interverts</h3>
                                            <table className="preview-matrix-table">
                                                <thead>
                                                    <tr>
                                                        <th></th>
                                                        <th className="col-name-header">Nom</th>
                                                        {groups.map(g => (
                                                            <th key={g.id}>{g.id}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const pf1Matrix = pfTabs?.find(pf => pf.id === 1)?.conflictMatrix || null;
                                                        const isComparing = activePFId !== 1 && pf1Matrix && pf1Matrix.length > 0;
                                                        return groups.map((fromGroup, fromIdx) => (
                                                        <tr key={fromGroup.id}>
                                                            <td className="row-header">{fromGroup.id}</td>
                                                            <td className="row-name">{fromGroup.name || ''}</td>
                                                            {groups.map((toGroup, toIdx) => {
                                                                const val = fromIdx !== toIdx ? (conflictMatrix[fromIdx]?.[toIdx] || '') : '';
                                                                let color = null;
                                                                if (isComparing && fromIdx !== toIdx && val !== '') {
                                                                    const pf1Val = pf1Matrix[fromIdx]?.[toIdx];
                                                                    const curr = parseInt(val) || 0;
                                                                    const ref = (pf1Val === '' || pf1Val == null) ? 0 : parseInt(pf1Val);
                                                                    if (curr > ref) color = '#f44336';
                                                                    else if (curr < ref) color = '#4caf50';
                                                                }
                                                                return (
                                                                <td
                                                                    key={toGroup.id}
                                                                    className={fromIdx === toIdx ? 'diagonal' : ''}
                                                                    style={color ? { color, fontWeight: 'bold' } : undefined}
                                                                >
                                                                    {val}
                                                                </td>
                                                                );
                                                            })}
                                                        </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        {/* 4c. Légende du diagramme */}
                                        {dossierSections.legende && (
                                        <div className="print-dossier-section print-dossier-legend">
                                            <h3>Légende du diagramme</h3>
                                            <DiagramLegend />
                                        </div>
                                        )}

                                        {/* 5-8. Pour chaque PF coché : diagramme + conditions micro + trafic/capacité + variables micro */}
                                        {pfTabs.filter(pf => dossierSections[`diagram_${pf.id}`]).map(pf => {
                                            // Durée de cycle propre au PF (ou globale si PF actif)
                                            const pfCycleLength = pf.id === activePFId ? cycleLength : (pf.cycleLength || cycleLength);
                                            // Appliquer les données diagramme du PF aux groupes
                                            const pfGroups = pf.id === activePFId
                                                ? groups
                                                : groups.map(g => {
                                                    const pfDiag = pf.diagram?.find(d => d.groupId === g.id);
                                                    return pfDiag ? {
                                                        ...g,
                                                        offset: pfDiag.offset !== undefined ? pfDiag.offset : g.offset,
                                                        durations: { ...g.durations, green: pfDiag.greenDuration !== undefined ? pfDiag.greenDuration : g.durations.green },
                                                        da: pfDiag.da !== undefined ? pfDiag.da : g.da,
                                                        phaseFlag: pfDiag.phaseFlag !== undefined ? pfDiag.phaseFlag : g.phaseFlag
                                                    } : g;
                                                });
                                            const pfActionData = pf.id === activePFId ? actionData : (pf.data || []);
                                            const pfDataset = pfTrafficDatasetMap[pf.id]
                                                || (trafficDatasetNames.includes(pf.name) ? pf.name : activeTrafficDataset);
                                            const pfMicroFields = pf.id === activePFId ? microCustomFields : (pf.microCustomFields || []);
                                            // PPS de base pour ce PF (basé sur son propre cycleLength)
                                            const pfBasePPS = pfCycleLength <= refCycle
                                                ? availableWidth / refCycle
                                                : availableWidth / pfCycleLength;
                                            // Calcul du scale optimisé pour remplir la page
                                            const diagramPageHeight = 648;
                                            // Sans le titre interne (display:none): RULER_HEIGHT(50) + 1px border + groups*31 + 30px grid-bottom + SVG labels/flèches en bas + marge
                                            const diagramRenderedHeight = 50 + 1 + pfGroups.length * 31 + 90;

                                            // Zoom 15% pour agrandir les lignes, limité par la hauteur de page
                                            // Plus d'agrandissement des lignes.
                                            //
                                            // Le diagramme était calculé pour la largeur utile puis agrandi
                                            // de 15 %, sa largeur d'élément étant divisée d'autant pour
                                            // compenser. Sur la feuille il sortait à la largeur AVANT
                                            // agrandissement : la mise à l'échelle ne s'y appliquait pas, et
                                            // il manquait donc un septième de la page. Une compensation dont
                                            // on ne maîtrise pas l'effet vaut moins que quelques pixels de
                                            // hauteur de ligne.
                                            const rowZoom = 1;
                                            const maxScale = diagramPageHeight / diagramRenderedHeight;
                                            const combinedScale = Math.min(rowZoom, maxScale);
                                            // UNE SECONDE VAUT LA MÊME LARGEUR SUR TOUTES LES PAGES.
                                            //
                                            // C'est la raison d'être du cycle de référence : deux plans de feu se
                                            // comparent à l'œil d'une page à l'autre. Rendre la largeur TOTALE
                                            // proportionnelle au cycle — colonne des noms comprise — détruit cette
                                            // propriété, la colonne étant de largeur fixe : la seconde y vaut
                                            // 5,3 px à 46 s et 9,7 px à 120 s. C'est ce qui donnait cinq plans à
                                            // cinq échelles différentes.
                                            //
                                            // La proportion porte donc sur la TIMELINE seule : à 120 s elle
                                            // remplit la largeur restante, en deçà elle en occupe la fraction
                                            // correspondante, et la colonne s'ajoute à côté.
                                            const largeurColonneVisuelle = dossierSidebarReal * combinedScale;
                                            const timelineDispo = dossierUsableWidth - largeurColonneVisuelle;
                                            // px par seconde à l'écran de la feuille, avant mise à l'échelle
                                            const ppsVisuel = pfCycleLength <= refCycle
                                                ? timelineDispo / refCycle
                                                : timelineDispo / pfCycleLength; // cycle long : réduit pour tenir
                                            const pfPPS = ppsVisuel / combinedScale;
                                            const targetWidth = largeurColonneVisuelle + pfCycleLength * ppsVisuel;
                                            return (
                                        <Fragment key={pf.id}>
                                        {/* Diagramme */}
                                        <div className="print-dossier-section print-dossier-diagram">
                                            <h3>Diagramme du plan de feu : {pf.name} — Cycle : {pfCycleLength}s</h3>
                                            <div style={{
                                                height: `${Math.ceil(diagramRenderedHeight * combinedScale)}px`,
                                                overflow: 'hidden',
                                                background: '#fff'
                                            }}>
                                                <div className="print-diagram-content dossier-diagram-content" style={{
                                                    width: `${Math.ceil(dossierSidebarReal + pfCycleLength * pfPPS)}px`,
                                                    transform: combinedScale !== 1 ? `scale(${combinedScale.toFixed(3)})` : 'none',
                                                    transformOrigin: 'top left'
                                                }}>
                                                    <TimelineDiagram
                                                        groups={pfGroups}
                                                        globalTime={0}
                                                        onGroupClick={() => {}}
                                                        pixelsPerSecond={pfPPS}
                                                        conflicts={[]}
                                                        conflictMatrix={conflictMatrix}
                                                        updateGroupParams={() => {}}
                                                        cycleLength={pfCycleLength}
                                                        actionData={pfActionData}
                                                        updateActionRow={() => {}}
                                                        startDrag={() => {}}
                                                        endDrag={() => {}}
                                                        showDependencies={false}
                                                        dependencyGap={20}
                                                        hoveredActionId={null}
                                                        setHoveredActionId={() => {}}
                                                        planName={pf.name}
                                                        isPrintMode={true}
                                                        /* La colonne des commentaires et le bloc des remarques
                                                           n'étaient pas désactivés : invisibles à l'impression,
                                                           ils occupaient tout de même 270 px de large. La mise en
                                                           page dépassait alors la feuille et le navigateur
                                                           réduisait tout le document — ce que seul le diagramme,
                                                           dimensionné en pixels, laissait voir. Le dossier imprime
                                                           les remarques dans son propre bloc, juste en dessous. */
                                                        showComments={false}
                                                        showRemarks={false}
                                                    tooltipsEnabled={tooltipPrefs.diagram}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Remarques du PF (si non vides) */}
                                        {(() => {
                                            const pfRemarques = pf.remarques || '';
                                            const textOnly = pfRemarques.replace(/<[^>]*>/g, '').trim();
                                            return textOnly ? (
                                                <div className="print-dossier-remarques">
                                                    <strong>Remarques :</strong> <span dangerouslySetInnerHTML={{ __html: pfRemarques }} />
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Conditions micro pour ce PF */}
                                        {dossierSections[`conditionsMicro_${pf.id}`] && pfActionData.filter(row => row.gf || row.action || row.description || row.deb !== '' || row.fin !== '').length > 0 && (
                                            <div className="print-dossier-section print-dossier-actions">
                                                <h3>Conditions de micro-régulation - {pf.name}</h3>
                                                {/* La mise à l'échelle n'englobe QUE le tableau. Posée sur
                                                    la section, elle réduisait aussi le bandeau de titre —
                                                    14 mm ramenés à 7 ou 8 selon la largeur des colonnes —
                                                    et le contenu démarrait plus ou moins haut d'un plan de
                                                    feu à l'autre. */}
                                                <div style={zoomConditions !== 1 ? { zoom: zoomConditions.toFixed(3) } : undefined}>
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
                                                            <th></th><th></th><th></th><th></th><th></th><th></th><th></th>
                                                            <th>1</th><th>2</th><th>1</th><th>2</th><th>3</th><th>4</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pfActionData
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
                                            </div>
                                        )}

                                        {/* Variables micro pour ce PF */}
                                        {dossierSections[`variablesMicro_${pf.id}`] && pfMicroFields.some(f => f && f.trim()) && (
                                            <div className="print-dossier-section print-dossier-variables">
                                                <h3>Variables micro - {pf.name}</h3>
                                                <div className="dossier-variables-list">
                                                    {pfMicroFields.map((field, index) => (
                                                        field && field.trim() ? (
                                                            <p key={index}>{field}</p>
                                                        ) : null
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Phasage bulle pour ce PF (si image + flèches existent) */}
                                        {dossierSections[`phasageBulle_${pf.id}`] && intersectionArrows.length > 0 && intersectionImage && (() => {
                                            const bulleCount = pf.phasageBulleCount || 4;
                                            const bulleCycleLength = pf.id === activePFId ? cycleLength : (pf.cycleLength || cycleLength);
                                            // Le dessin est composé DIRECTEMENT à la taille de la page.
                                            //
                                            // Il l'était auparavant dans un canevas de 1600 px, ramené ensuite
                                            // à la feuille par une mise à l'échelle, un décalage de recentrage
                                            // et une contre-échelle pour les étiquettes. Chaque couche
                                            // rattrapait la précédente, et leur composition n'était plus
                                            // prévisible : mesures justes à chaque étape, page fausse au bout.
                                            //
                                            // Il ne reste qu'une inconnue — la taille de bulle — résolue pour
                                            // que le dessin remplisse la page, bulles tangentes entre elles et
                                            // arcs les contournant. Plus rien n'est mis à l'échelle après coup.
                                            // Géométrie de la feuille : DÉCIDÉE, jamais mesurée.
                                            //
                                            // Une A4 paysage mesure 297 × 210 mm ; les marges de @page en
                                            // retirent 10 mm de chaque côté et 7 mm en bas, soit 277 × 193 mm
                                            // imprimables. On y réserve un bandeau haut pour le titre et les
                                            // logos, une marge basse, et le dessin occupe le reste. Ces trois
                                            // valeurs sont fixées ici ET dans App.css, qui donne au conteneur
                                            // exactement cette taille : le dessin est donc calculé pour la
                                            // boîte où il sera posé, sans écart possible.
                                            //
                                            // Auparavant la page était reconstituée : largeur relevée pendant
                                            // une impression et mise en cache, rapport théorique, hauteur de
                                            // titre forfaitaire, coefficients de marge et de prudence. Six
                                            // sources qui ne s'accordaient jamais, et un relevé qui ne servait
                                            // qu'à l'impression SUIVANTE — d'où un dessin toujours calé sur la
                                            // page précédente, et la dernière bulle rognée par le conteneur.
                                            // En millimètres il n'y a plus rien à relever : px et mm sont deux
                                            // unités absolues du même système, le navigateur fait la
                                            // conversion, et une impression à 80 % réduit tout ensemble.
                                            // Paysage : 297 - 2 × 10 mm de marge ; 148 mm est un maximum
                                            // vérifié par impression réelle (à 150, 4 phases débordent).
                                            // Portrait : 210 - 20 de marge, et la composition y est
                                            // contrainte par la largeur, non par la hauteur.
                                            const PAGE_MM_W = dossierPortrait ? 190 : 277;
                                            const PAGE_MM_H = dossierPortrait ? 240 : 148;
                                            // La composition se calcule DIRECTEMENT en millimètres et
                                            // s'exprime en millimètres : plus aucune conversion vers les
                                            // pixels, dont le rapport au millimètre n'est pas celui qu'on
                                            // croit dans le rendu d'impression.
                                            const PAGE_W = PAGE_MM_W;
                                            const PAGE_H = PAGE_MM_H;
                                            const dessin = fitBubblesToPage({
                                                count: bulleCount,
                                                ratio: pf.phasageBubbleRatio ?? 100,
                                                ellipseScale: pf.phasageEllipseScale ?? 100,
                                                pageWidth: PAGE_W,
                                                pageHeight: PAGE_H,
                                                jeu: 1.02 // un cheveu de jour entre bulles voisines
                                            });
                                            // Image ratio: hide ellipse if very elongated
                                            const imgRatio = imageNaturalDims.width / imageNaturalDims.height;
                                            const hideOvals = imgRatio > 1.5 || imgRatio < (1 / 1.5);
                                            // Visible image bounds within bubble (object-fit: contain).
                                            // Rapport du cadre où le plan est posé. C'est celui de l'image du
                                            // carrefour, dont la bulle reprend la forme : l'écrire à part le
                                            // laissait mentir dès que ce cadre changeait.
                                            const bubbleAspect = REF_IMAGE_BOX_WIDTH / REF_IMAGE_BOX_HEIGHT;
                                            let arrowXMin = 0, arrowXMax = 100, arrowYMin = 0, arrowYMax = 100;
                                            if (imgRatio > bubbleAspect) {
                                                const visH = (bubbleAspect / imgRatio) * 100;
                                                arrowYMin = (100 - visH) / 2;
                                                arrowYMax = 100 - arrowYMin;
                                            } else {
                                                const visW = (imgRatio / bubbleAspect) * 100;
                                                arrowXMin = (100 - visW) / 2;
                                                arrowXMax = 100 - arrowXMin;
                                            }
                                            return (
                                            <div className="print-dossier-section print-dossier-phasage dossier-phasage-centered">
                                                <h3>Phasage bulle - {pf.name}</h3>
                                                <div className={`dossier-phasage-content ${hideOvals ? 'phasage-hide-ovals' : ''}`}>
                                                    <PhasageBulle
                                                        groups={pfGroups}
                                                        cycleLength={bulleCycleLength}
                                                        intersectionImage={intersectionImage}
                                                        intersectionArrows={intersectionArrows.filter(a => a.x >= arrowXMin && a.x <= arrowXMax && a.y >= arrowYMin && a.y <= arrowYMax)}
                                                        actionData={pfActionData}
                                                        selectedActions={[]}
                                                        intersectionName={intersectionName}
                                                        planName={pf.name}
                                                        initialTimes={pf.phasageBulleTimes || [0, 0, 0, 0, 0, 0]}
                                                        initialCount={bulleCount}
                                                        imageBrightness={imageBrightness}
                                                        imageContrast={imageContrast}
                                                        initialBubbleScale={dessin.bubbleScale}
                                                        initialEllipseScale={dessin.ellipseScale}
                                                        initialBubbleRatio={pf.phasageBubbleRatio ?? 100}
                                                        ellipseScaleX={dessin.ellipseScaleX}
                                                        arrowOffsetX={dessin.arrowOffsetX}
                                                        arrowOffsetY={dessin.arrowOffsetY}
                                                        unite="mm"
                                                    />
                                                </div>
                                            </div>
                                            );
                                        })()}

                                        {/* Données de trafic et calcul de capacité pour ce PF */}
                                        {dossierSections[`traficCapacite_${pf.id}`] && (
                                            <div className="print-dossier-section print-dossier-traffic">
                                                <h3>Données de trafic et calcul de capacité - {pf.name}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Données de trafic : {pfDataset}</h3>
                                                {/* Le même composant qu'à l'écran, en lecture seule.
                                                    Ce tableau était recopié à la main, et la copie avait
                                                    divergé : elle ajoutait les groupes non-VL porteurs de
                                                    données trafic — que l'écran n'affiche pas — et calculait
                                                    avec le cycle et les actions du plan ACTIF, non de celui
                                                    qu'elle imprimait, d'où des capacités différentes d'une
                                                    page à l'autre pour les mêmes groupes. */}
                                                <TrafficTable
                                                    groups={pfGroups}
                                                    cycleLength={pfCycleLength}
                                                    activeTrafficDataset={pfDataset}
                                                    setActiveTrafficDataset={() => {}}
                                                    updateTrafficData={() => {}}
                                                    getTrafficData={(id) => (trafficDatasets[pfDataset] || {})[id] || {}}
                                                    updateGroupParams={() => {}}
                                                    trafficDatasetNames={trafficDatasetNames}
                                                    copyTrafficDataset={() => {}}
                                                    addCustomTrafficDataset={() => {}}
                                                    actionData={pfActionData}
                                                    simulationSelectedActions={[]}
                                                    readOnly
                                                    tooltipsEnabled={false}
                                                />
                                            </div>
                                        )}

                                        {/* Réserve de capacité (même calcul que le panneau à l'écran) */}
                                        {dossierSections[`reserveCapacite_${pf.id}`] && (
                                            <div className="print-dossier-section print-dossier-reserve">
                                                <h3>Réserve de capacité - {pf.name}</h3>
                                                {/* Même jeu de données que le tableau ci-dessus.
                                                    Il lisait le jeu ACTIF à l'écran, et sans la reprise du
                                                    nom du plan : sur un projet dont le jeu porte le nom du
                                                    plan, le tableau trouvait les volumes et la réserve
                                                    réclamait de les saisir, juste en dessous. */}
                                                <DiagnosticPanel
                                                    groups={pfGroups}
                                                    cycleLength={pfCycleLength}
                                                    getTrafficData={(id) => (trafficDatasets[pfDataset] || {})[id] || {}}
                                                    actionData={pfActionData}
                                                    activeTrafficDataset={pfDataset}
                                                    hideTitle={true}
                                                />
                                            </div>
                                        )}
                                        </Fragment>
                                            );
                                        })}

                                        {/* Scénario — le plan tel que les actions cochées le
                                            recalculent. Il porte sur le plan de feu ACTIF, seul
                                            dépositaire du scénario, et s'imprime que l'onglet
                                            Simulation soit ouvert ou non. Les temps changent, les
                                            formules non — le tableau de trafic est le composant de
                                            l'écran, nourri du diagramme simulé. */}
                                        {dossierSections.simulation && simulationResultImpression && (() => {
                                            const simu = simulationResultImpression;
                                            const simCycle = simu.simulatedCycleLength || cycleLength;
                                            const simPfName = pfTabs.find(pf => pf.id === activePFId)?.name || '';
                                            const simScenario = (simulationName || '').trim();
                                            // Mêmes règles d'échelle que les diagrammes ci-dessus :
                                            // une seconde vaut la même largeur d'une page à l'autre,
                                            // le cycle simulé se compare donc à l'œil au cycle du plan.
                                            const diagramPageHeight = 648;
                                            const diagramRenderedHeight = 50 + 1 + groups.length * 31 + 90;
                                            const combinedScale = Math.min(1, diagramPageHeight / diagramRenderedHeight);
                                            const largeurColonneVisuelle = dossierSidebarReal * combinedScale;
                                            const timelineDispo = dossierUsableWidth - largeurColonneVisuelle;
                                            const ppsVisuel = simCycle <= refCycle
                                                ? timelineDispo / refCycle
                                                : timelineDispo / simCycle;
                                            const simPPS = ppsVisuel / combinedScale;
                                            // Les groupes aux temps simulés, pour la réserve de capacité :
                                            // DiagnosticPanel calcule à partir des durées de vert des
                                            // groupes, il faut donc les lui donner déjà simulées.
                                            const groupesSimules = groups.map(g => {
                                                const sim = simu.simulatedGroups?.find(sg => sg.id === g.id);
                                                if (!sim) return g;
                                                return {
                                                    ...g,
                                                    offset: sim.simulatedOffset ?? g.offset,
                                                    durations: { ...g.durations, green: sim.simulatedGreen ?? g.durations.green }
                                                };
                                            });
                                            const actionsRetenues = actionsSimulables(actionData);
                                            return (
                                        <Fragment key="simulation">
                                            <div className="print-dossier-section print-dossier-diagram">
                                                {/* Le nom du scénario, quand il est renseigné, titre la
                                                    section : c'est lui qui dit ce que cette combinaison
                                                    d'actions démontre. À défaut, on s'en tient au plan. */}
                                                <h3>Simulation{simScenario ? ` : ${simScenario}` : ''}{simPfName ? ` — plan de feu ${simPfName}` : ''} — Cycle simulé : {simCycle}s{simCycle !== cycleLength ? ` (${simCycle - cycleLength > 0 ? '+' : ''}${simCycle - cycleLength}s)` : ''}</h3>
                                                <div style={{
                                                    height: `${Math.ceil(diagramRenderedHeight * combinedScale)}px`,
                                                    overflow: 'hidden',
                                                    background: '#fff'
                                                }}>
                                                    <div className="print-diagram-content dossier-diagram-content" style={{
                                                        width: `${Math.ceil(dossierSidebarReal + simCycle * simPPS)}px`,
                                                        transform: combinedScale !== 1 ? `scale(${combinedScale.toFixed(3)})` : 'none',
                                                        transformOrigin: 'top left'
                                                    }}>
                                                        <TimelineDiagram
                                                            groups={groups}
                                                            globalTime={0}
                                                            onGroupClick={() => {}}
                                                            pixelsPerSecond={simPPS}
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
                                                            simulationFilter={new Set(simulationSelectedActions)}
                                                            simulationResult={simu}
                                                            planName={simPfName}
                                                            isPrintMode={true}
                                                            showComments={false}
                                                            showRemarks={false}
                                                            tooltipsEnabled={tooltipPrefs.diagram}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Liste des actions, avec la coche de chacune : c'est le
                                                choix de scénario qui explique le diagramme ci-dessus. */}
                                            {dossierSections.simulationActions && actionsRetenues.length > 0 && (
                                                <div className="print-dossier-section print-dossier-actions">
                                                    <h3>Actions retenues{simScenario ? ` : ${simScenario}` : ''}{simPfName ? ` - ${simPfName}` : ''}</h3>
                                                    <table className="print-simulation-actions">
                                                        <thead>
                                                            <tr>
                                                                <th className="col-coche">Simulée</th>
                                                                <th className="col-gf">GF</th>
                                                                <th className="col-action">Action</th>
                                                                <th className="col-temps">Temps</th>
                                                                <th className="col-micro">Action_Micro</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {actionsRetenues.map(action => {
                                                                const cochee = simulationSelectedActions.includes(action.id);
                                                                const temps = action.deb === '' ? ''
                                                                    : (action.fin === '' ? `${action.deb}s` : `${action.deb}-${action.fin}s`);
                                                                return (
                                                                    <tr key={action.id} className={cochee ? 'action-cochee' : 'action-decochee'}>
                                                                        <td className="col-coche">{cochee ? '\u2612' : '\u2610'}</td>
                                                                        <td className="col-gf">{action.gf ? `GF${action.gf}` : ''}</td>
                                                                        <td className="col-action">{action.action}</td>
                                                                        <td className="col-temps">{temps}</td>
                                                                        {/* Même rendu que le tableau des conditions du plan :
                                                                            largeur et police relevées à l'écran, le navigateur
                                                                            replie donc aux mêmes endroits. */}
                                                                        <td className="col-micro print-micro-cell">
                                                                            <div className="print-micro-wrap" style={microPrintStyle || undefined}>{action.micro}</div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Liste des conflits du diagramme simulé — la même que le
                                                panneau à l'écran, escamotages cochés déduits. */}
                                            {dossierSections.simulationConflits && (() => {
                                                const conflits = conflitsSimules(
                                                    simu.conflicts || [], actionData, simulationSelectedActions);
                                                return (
                                                <div className="print-dossier-section print-dossier-conflits">
                                                    <h3>Conflits{simScenario ? ` : ${simScenario}` : ''}{simPfName ? ` - ${simPfName}` : ''} : {conflits.length}</h3>
                                                    {conflits.length === 0 ? (
                                                        <p className="print-conflits-aucun">Aucun conflit sur le diagramme simulé.</p>
                                                    ) : (
                                                        <table className="print-simulation-conflits">
                                                            <thead>
                                                                <tr>
                                                                    <th className="col-gf">Groupes</th>
                                                                    <th className="col-motif">Conflit</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {conflits.map((c, i) => (
                                                                    <tr key={i}>
                                                                        <td className="col-gf">GF{c.from} - GF{c.to}</td>
                                                                        <td className="col-motif">{c.message}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                                );
                                            })()}

                                            {dossierSections.simulationTrafic && (
                                                <div className="print-dossier-section print-dossier-traffic">
                                                    <h3>Données de trafic et calcul de capacité - Simulation&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Données de trafic : {activeTrafficDataset}</h3>
                                                    <TrafficTable
                                                        groups={groups}
                                                        cycleLength={cycleLength}
                                                        activeTrafficDataset={activeTrafficDataset}
                                                        setActiveTrafficDataset={() => {}}
                                                        updateTrafficData={() => {}}
                                                        getTrafficData={(id) => (trafficDatasets[activeTrafficDataset] || {})[id] || {}}
                                                        updateGroupParams={() => {}}
                                                        trafficDatasetNames={trafficDatasetNames}
                                                        copyTrafficDataset={() => {}}
                                                        addCustomTrafficDataset={() => {}}
                                                        actionData={actionData}
                                                        simulationSelectedActions={simulationSelectedActions}
                                                        simulationResult={simu}
                                                        readOnly
                                                        tooltipsEnabled={false}
                                                    />
                                                </div>
                                            )}

                                            {dossierSections.simulationReserve && (
                                                <div className="print-dossier-section print-dossier-reserve">
                                                    <h3>Réserve de capacité - Simulation</h3>
                                                    <DiagnosticPanel
                                                        groups={groupesSimules}
                                                        cycleLength={simCycle}
                                                        getTrafficData={(id) => (trafficDatasets[activeTrafficDataset] || {})[id] || {}}
                                                        actionData={actionData}
                                                        activeTrafficDataset={activeTrafficDataset}
                                                        inhibitedGroups={groupesInhibes(actionData, simulationSelectedActions)}
                                                        hideTitle={true}
                                                    />
                                                </div>
                                            )}
                                        </Fragment>
                                            );
                                        })()}

                                        {/* Le pied de page est géré par @page margin boxes (injecté dynamiquement) */}
                                    </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setPrintPreviewModal(false)}>
                                Annuler
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={() => {
                                    // Ajouter la classe pour l'impression AVANT d'imprimer
                                    document.body.classList.add(`print-${printType}`);
                                    // Injecter le footer dynamique si dossier
                                    const footerStyle = printType === 'dossier' ? injectDossierFooterStyle() : null;
                                    // Imprimer avec le modal ouvert
                                    window.print();
                                    // Retirer le footer dynamique et la classe après l'impression
                                    if (footerStyle) footerStyle.remove();
                                    document.body.classList.remove(`print-${printType}`);
                                }}
                            >
                                Imprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </>
    );
}

export default PrintPreviewModal;
