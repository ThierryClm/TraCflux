import { useEffect } from 'react';
import renderFloatingArrowSVG from '../utils/renderArrowSVG';
import { BOX_W, BOX_H, fitImageBox } from '../utils/floatingImageBox';
import { getGroupColorAtTime } from '../utils/groupColorAtTime';

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
    groups,
    imageNaturalDims,
    selectedActions,
    conflictMatrix,
    hoveredArrowGroupId,
    hoveredDiagramTime,
    isPlayingSimulation,
    simulationCurrentTime,
    simulationResult,
    actionData,
    cycleLength,
    imageBrightness,
    imageContrast,
    floatingImagePopup
}) => {
    useEffect(() => {
        if (!showFloatingImage || !intersectionImage) return;

        const showNums = JSON.parse(localStorage.getItem('intersection_showGroupNumbers') ?? 'true');
        const showNames = JSON.parse(localStorage.getItem('intersection_showGroupNames') ?? 'true');

        // Compute group number centroids
        const groupMap = {};
        intersectionArrows.forEach(arrow => {
            if (!arrow.groupId) return;
            const group = groups.find(g => g.id === arrow.groupId);
            const courant = group?.courant || '';
            let px = arrow.x;
            let py = arrow.y;
            if (courant === 'TàD' || courant === 'TàG') {
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

        // Cadre utile de l'image dans la boîte 750×530. L'image est centrée en
        // « contain » : hors survol, les bandes vides encadraient la photo et la
        // fenêtre détachée s'ouvrait bien plus grande que l'image, ascenseurs
        // compris. On les retire du cadrage sans toucher aux coordonnées des
        // flèches, qui restent en % de la boîte de référence.
        const { dispW, dispH, padX, padY } = fitImageBox(imageNaturalDims);
        const maxCropX = Math.max(0, Math.floor(dispW / 2) - 10);
        const maxCropY = Math.max(0, Math.floor(dispH / 2) - 10);
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

        const colorContext = {
            groups, simulationResult, cycleLength, actionData, selectedActions, conflictMatrix
        };

        floatingImagePopup.renderToPopup(
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '6px 12px', background: '#2a2a2a', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div className="floating-zoom-control">
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.max(0.3, z - 0.1))} title="Réduire">−</button>
                        <span className="floating-zoom-value">{Math.round(floatingZoom * 100)}%</span>
                        <button className="floating-zoom-btn" onClick={() => setFloatingZoom(z => Math.min(2, z + 0.1))} title="Agrandir">+</button>
                    </div>
                    <button
                        className={`floating-crop-btn ${showCropControls ? 'active' : ''}`}
                        onClick={() => setShowCropControls(!showCropControls)}
                        title="Rogner l'image"
                    >
                        ✂
                    </button>
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
                <div className="floating-image-content" data-fit-scroll style={{ flex: 1, overflow: 'auto' }}>
                    <div
                        className="floating-image-wrapper"
                        style={{
                            width: Math.max(1, dispW - cropL - cropR) * floatingZoom,
                            height: Math.max(1, dispH - cropT - cropB) * floatingZoom
                        }}
                    >
                        <div
                            className="floating-image-inner"
                            style={{
                                marginTop: -(padY + cropT),
                                marginLeft: -(padX + cropL),
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
                            {intersectionArrows.map(arrow => {
                                const group = groups.find(g => g.id === arrow.groupId);
                                const courant = group?.courant || '';
                                const rotation = arrow.rotation || 0;
                                const scale = arrow.scale || 1;
                                const arrowLength = arrow.length || 1;
                                const turnLength = arrow.turnLength || 1;
                                const isHovered = hoveredArrowGroupId === arrow.groupId;

                                // Même moteur de couleur que le panneau intégré.
                                // La copie réduite qui vivait ici ignorait les
                                // verts découpés, les groupes escamotés et la
                                // zone de coupure d'un escamotage, et n'employait
                                // les temps simulés que pendant la lecture.
                                const arrowColor = getGroupColorAtTime(arrow.groupId, activeTime, colorContext);

                                const isPedestrianOrCycle = courant === 'Piéton' || courant === 'Cycle';

                                return (
                                    <div
                                        key={arrow.id}
                                        className={`floating-arrow-marker ${isHovered ? 'hovered' : ''} ${isPedestrianOrCycle ? 'side-label' : ''}`}
                                        style={{ left: `${arrow.x}%`, top: `${arrow.y}%` }}
                                    >
                                        <div className="arrow-symbol" style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}>
                                            {renderFloatingArrowSVG(courant, arrowColor, arrowLength, turnLength)}
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
                        </div>
                    </div>
                </div>
            </div>
        );
    }, [showFloatingImage, intersectionImage, floatingCrop, floatingZoom, showCropControls,
        intersectionArrows, groups, imageNaturalDims, hoveredArrowGroupId, hoveredDiagramTime,
        selectedActions, conflictMatrix,
        isPlayingSimulation, simulationCurrentTime, simulationResult,
        actionData, cycleLength, imageBrightness, imageContrast, floatingImagePopup.renderToPopup]); // eslint-disable-line react-hooks/exhaustive-deps
};

export default useFloatingImageRenderer;
