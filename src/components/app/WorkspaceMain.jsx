import TimelineDiagram from '../TimelineDiagram';
import PhasageBulle from '../PhasageBulle';
import IntersectionImage from '../IntersectionImage';
import ActionTable from '../ActionTable';
import { toast } from '../../utils/toast';

export default function WorkspaceMain({ model }) {
    const {
        actionColWidths, actionData, activePFId, activePfReadOnly, addRecentDirectory,
        biCarrefourSeparator, brouillonPhasage, conflictMatrix, currentRemarques, cycleLength,
        cycleLengthInput, cycleSimulationSpeed, dependencyGap, diagramAreaRef, diagramHeight,
        displayConflicts, dossierReadOnly, draggedTabIndex, endDrag, getGroupState,
        globalTime, groups, handleActionPanelResize, handleDiagramResizeStart, handleResizeStart,
        helpZoneRef, hoveredActionId, hoveredArrowGroupId, hoveredArrowGroupSaturated, hoveredConflict,
        hoveredDiagramTime, hoveredPhasageGroupId, hoveredVUtile, imageBrightness, imageContrast,
        imageFondClair, intersectionArrows, intersectionImage, intersectionName, isPlayingSimulation,
        isResizing, isResizingDiagram, lastImageDirectoryRef, microCustomFields, pfTabs,
        phasageBubbleRatio, phasageBubbleScale, phasageBulleCount, phasageBulleEnabled, phasageBulleModal,
        phasageBulleTimes, phasageBulleVersion, phasageBulleVisibleGroups, phasageEllipseScale, phasageModifie,
        pixelsPerSecond, recentImageDirs, renamePF, reorderActions, reorderPF,
        resetDiagramHeight, saveDirectoryHandle, setActionColWidths, setActivePFId, setBrouillonPhasage,
        setCycleLength, setCycleLengthInput, setDragConflictsFromDiagram, setDraggedTabIndex, setHoveredActionId,
        setHoveredArrowGroupId, setHoveredDiagramTime, setHoveredPhasageGroupId, setImageBrightness, setImageContrast,
        setIntersectionArrows, setIntersectionImage, setIsPlayingSimulation, setPhasageBubbleRatio, setPhasageBubbleScale,
        setPhasageBulleCount, setPhasageBulleEnabled, setPhasageBulleModal, setPhasageBulleTimes, setPhasageBulleVersion,
        setPhasageEllipseScale, setSelectedGroupId, setShowFloatingConditions, setShowFloatingDiagram, setShowFloatingImage,
        setShowFloatingVariables, setSidebarWidth, setSimulationCurrentTime, setSimulationEnabled, showActionDescription,
        showComments, showDependencies, showFloatingConditions, showFloatingDiagram, showFloatingRemarks,
        showFloatingVariables, showGroupNamesDiagram, showMicroOnHover, showRemarks, showWrapFlash,
        sidebarVisible, simulationCurrentTime, simulationEnabled, simulationResult, simulationSelectedActions,
        simulationSpeed, startDrag, tip, tooltipPrefs, updateActionRow,
        updateGroupParams, updateMicroCustomField, updatePFRemarques,
    } = model;
    return (
        <>
                {/* Resizable divider */}
                {sidebarVisible && (
                    <div
                        className={`resize-divider ${isResizing ? 'resizing' : ''}`}
                        onMouseDown={handleResizeStart}
                    />
                )}

                <section className="diagram-area" ref={diagramAreaRef} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* PF Tabs */}
                    <div className="pf-tabs-bar">
                        {pfTabs.map((pf, index) => (
                            <div
                                key={pf.id}
                                className={`pf-tab ${activePFId === pf.id ? 'active' : ''} ${draggedTabIndex === index ? 'dragging' : ''} ${pf.color === '#4CAF50' ? 'pf-validated' : ''} ${pf.color === '#e74c3c' ? 'pf-invalidated' : ''}`}
                                style={{}}
                                draggable="true"
                                onDragStart={(e) => {
                                    setDraggedTabIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedTabIndex !== null && draggedTabIndex !== index) {
                                        reorderPF(draggedTabIndex, index);
                                    }
                                    setDraggedTabIndex(null);
                                }}
                                onDragEnd={() => {
                                    setDraggedTabIndex(null);
                                }}
                                onClick={() => {
                                    setSimulationEnabled(false);
                                    setPhasageBulleEnabled(false);
                                    setActivePFId(pf.id);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const newName = prompt('Nouveau nom de l\'onglet:', pf.name);
                                    if (newName && newName.trim() !== '') {
                                        renamePF(pf.id, newName.trim());
                                    }
                                }}
                                data-pf-tooltip={pf.readOnly
                                    ? '🔒 Importé — lecture seule (référence de comparaison)'
                                    : 'Glissez pour réordonner, double-cliquez pour renommer'}
                            >
                                <span className="pf-tab-name">
                                    {pf.readOnly && <span className="pf-tab-lock">🔒</span>}
                                    {pf.name}
                                </span>
                            </div>
                        ))}
                        <div
                            className={`pf-tab simulation-tab ${simulationEnabled && !phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setPhasageBulleEnabled(false);
                                const newSimState = !simulationEnabled;
                                setSimulationEnabled(newSimState);
                                if (newSimState) {
                                    // Largeur du tableau Données Trafic, désormais
                                    // celui de l'onglet Trafic : GF + Nom + Coef +
                                    // Trafic + V.Utile + Cap.U + Retard + File.
                                    setSidebarWidth(395);
                                }
                            }}
                            title={tip("Activer/désactiver le mode simulation")}
                        >
                            <span className="pf-tab-name">Simulation</span>
                        </div>
                        <div
                            className={`pf-tab phasage-tab ${phasageBulleEnabled ? 'active' : ''}`}
                            onClick={() => {
                                setSimulationEnabled(false);
                                if (!phasageBulleEnabled) {
                                    // Ouvrir la configuration quand on active le phasage bulle
                                    setBrouillonPhasage(null); // repart des valeurs du plan
                                    setPhasageBulleModal(true);
                                }
                                setPhasageBulleEnabled(!phasageBulleEnabled);
                            }}
                            title={tip("Afficher le phasage en bulles")}
                        >
                            <span className="pf-tab-name">Phasage bulle</span>
                        </div>

                        <div className="pf-tabs-spacer"></div>
                    </div>

                    {!phasageBulleEnabled && (
                        <div
                            className="diagram-panel"
                            onMouseEnter={() => { helpZoneRef.current = 'diagramme'; }}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: diagramHeight !== null ? `${diagramHeight}px` : 'auto',
                                minHeight: diagramHeight !== null ? `${diagramHeight}px` : 'auto',
                                maxHeight: diagramHeight !== null ? `${diagramHeight}px` : 'none',
                                // Le défilement appartient désormais au diagramme lui-même
                                // (prop scrollable) : le panneau ne doit pas en ajouter un second.
                                overflow: 'hidden',
                                // Sans hauteur imposée par le séparateur horizontal, on borne le
                                // diagramme à la place disponible : il défile chez lui au lieu de
                                // faire défiler toute la zone centrale, en-têtes compris.
                                '--timeline-max-height': diagramHeight !== null ? undefined : 'calc(100vh - 320px)'
                            }}
                        >
                            <TimelineDiagram
                                scrollable
                                readOnly={dossierReadOnly || activePfReadOnly}
                                groups={groups}
                                globalTime={globalTime}
                                getGroupState={getGroupState}
                                onGroupClick={(g) => setSelectedGroupId(g.id)}
                                pixelsPerSecond={pixelsPerSecond}
                                conflicts={displayConflicts}
                                onDragConflicts={setDragConflictsFromDiagram}
                                conflictMatrix={conflictMatrix}
                                updateGroupParams={updateGroupParams}
                                cycleLength={cycleLength}
                                actionData={actionData}
                                updateActionRow={updateActionRow}
                                startDrag={startDrag}
                                endDrag={endDrag}
                                showDependencies={showDependencies}
                                dependencyGap={dependencyGap}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                                simulationFilter={simulationEnabled ? new Set(simulationSelectedActions) : null}
                                simulationResult={simulationResult}
                                simulationCurrentTime={simulationEnabled ? simulationCurrentTime : null}
                                isPlayingSimulation={simulationEnabled && isPlayingSimulation}
                                playbackTime={isPlayingSimulation ? simulationCurrentTime : null}
                                setIsPlayingSimulation={setIsPlayingSimulation}
                                simulationSpeed={simulationSpeed}
                                cycleSimulationSpeed={cycleSimulationSpeed}
                                setSimulationCurrentTime={setSimulationCurrentTime}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                hoveredArrowGroupSaturated={hoveredArrowGroupSaturated}
                                hoveredConflict={hoveredConflict}
                                setHoveredGroupId={setHoveredArrowGroupId}
                                setHoveredDiagramTime={setHoveredDiagramTime}
                                hoveredVUtile={hoveredVUtile}
                                planName={simulationEnabled ? (pfTabs.find(pf => pf.id === activePFId)?.name || '') : ''}
                                activePFName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                                remarques={currentRemarques}
                                updateRemarques={updatePFRemarques}
                                biCarrefourSeparator={biCarrefourSeparator}
                                cycleLengthInput={cycleLengthInput}
                                setCycleLengthInput={setCycleLengthInput}
                                setCycleLength={setCycleLength}
                                showComments={simulationEnabled ? false : showComments}
                                showRemarks={simulationEnabled ? false : showRemarks}
                                remarquesDetached={showFloatingRemarks}
                                showGroupNames={showGroupNamesDiagram}
                                showMicroOnHover={showMicroOnHover}
                                showWrapFlash={showWrapFlash}
                            tooltipsEnabled={tooltipPrefs.diagram}
                                onDetach={showFloatingDiagram ? null : () => setShowFloatingDiagram(true)}
                            />
                        </div>
                    )}

                    {/* Horizontal resizable divider */}
                    {!phasageBulleEnabled && (
                        <div
                            className={`horizontal-resize-divider ${isResizingDiagram ? 'resizing' : ''}`}
                            onMouseDown={handleDiagramResizeStart}
                            onDoubleClick={resetDiagramHeight}
                            title={tip("Faites glisser pour redimensionner. Double-clic pour réinitialiser.")}
                        >
                            <div className="horizontal-resize-handle"></div>
                        </div>
                    )}

                    <div className="action-panel" onMouseEnter={() => { helpZoneRef.current = 'actions'; }} style={{
                        borderTop: phasageBulleEnabled ? 'none' : 'none',
                        marginTop: phasageBulleEnabled ? 0 : 0,
                        flex: diagramHeight !== null ? '1' : '0 0 auto',
                        overflow: (phasageBulleEnabled || simulationEnabled) ? 'auto' : 'hidden'
                    }}>
                        <div style={{ display: phasageBulleEnabled ? 'block' : 'none', position: 'relative', height: '100%' }}>
                            <PhasageBulle
                                key={phasageBulleVersion}
                                groups={groups}
                                cycleLength={cycleLength}
                                intersectionImage={intersectionImage}
                                intersectionArrows={intersectionArrows.filter(a => phasageBulleVisibleGroups.has(a.groupId))}
                                simulationResult={simulationResult}
                                actionData={actionData}
                                selectedActions={simulationSelectedActions}
                                intersectionName={intersectionName}
                                planName={pfTabs.find(pf => pf.id === activePFId)?.name || ''}
                                initialTimes={phasageBulleTimes}
                                initialCount={phasageBulleCount}
                                hoveredGroupId={hoveredPhasageGroupId}
                                setHoveredGroupId={setHoveredPhasageGroupId}
                                imageBrightness={imageBrightness}
                                imageContrast={imageContrast}
                                initialBubbleScale={phasageBubbleScale}
                                initialEllipseScale={phasageEllipseScale}
                                initialBubbleRatio={phasageBubbleRatio}
                                onBubbleScaleChange={setPhasageBubbleScale}
                                onEllipseScaleChange={setPhasageEllipseScale}
                                onBubbleRatioChange={setPhasageBubbleRatio}
                            />
                            {/* Panneau de configuration flottant en haut à gauche */}
                            {phasageBulleModal && (
                                <div className="phasage-config-panel">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em' }}>
                                            Phases :
                                            <select
                                                value={brouillonPhasage?.count ?? phasageBulleCount}
                                                onChange={(e) => setBrouillonPhasage(b => ({ ...b, count: parseInt(e.target.value) }))}
                                                style={{ padding: '3px' }}
                                            >
                                                {[2, 3, 4, 5, 6].map(n => (
                                                    <option key={n} value={n}>{n}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <span style={{ color: '#888', fontSize: '0.85em' }}>Cycle : {cycleLength}s</span>
                                    </div>
                                    {/* Le plan concerné, nommé pendant la saisie : ces instants sont
                                        propres à chaque plan de feu (cf. phasageBulleTimes, stocké sur
                                        le PF actif), et rien ne le disait à l'écran. */}
                                    <div style={{ color: '#dc4edc', fontSize: '0.8em', marginBottom: '6px' }}>
                                        Phasage du plan {pfTabs.find(p => p.id === activePFId)?.name || ''}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '3px 6px', justifyContent: 'start' }}>
                                        {Array.from({ length: brouillonPhasage?.count ?? phasageBulleCount }, (_, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <span style={{ color: '#dc4edc', fontWeight: 'bold', fontSize: '0.85em' }}>P{i + 1}:</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={cycleLength - 1}
                                                    value={(brouillonPhasage?.times ?? phasageBulleTimes)[i] || 0}
                                                    onChange={(e) => {
                                                        const valeur = Math.max(0, Math.min(cycleLength - 1, parseInt(e.target.value) || 0));
                                                        setBrouillonPhasage(b => {
                                                            const times = [...(b?.times ?? phasageBulleTimes)];
                                                            times[i] = valeur;
                                                            return { count: b?.count ?? phasageBulleCount, times };
                                                        });
                                                    }}
                                                    style={{ width: '30px', padding: '2px', textAlign: 'center' }}
                                                />
                                                <span style={{ color: '#888', fontSize: '0.85em' }}>s</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                            className="modal-btn modal-btn-secondary"
                                            style={{ padding: '3px 10px', fontSize: '0.85em' }}
                                            disabled={!phasageModifie}
                                            title={tip("Abandonner les modifications en cours : les champs retrouvent les valeurs du plan de feu.")}
                                            onClick={() => {
                                                // Le projet n'a rien reçu : il suffit de jeter le brouillon
                                                // pour que les champs repartent des valeurs du plan. Le
                                                // panneau reste ouvert, comme après OK.
                                                setBrouillonPhasage(null);
                                            }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            className="modal-btn modal-btn-primary"
                                            style={{ padding: '3px 10px', fontSize: '0.85em' }}
                                            title={tip("Valider ces valeurs pour le plan de feu courant")}
                                            onClick={() => {
                                                // C'est ce clic, et lui seul, qui écrit dans le projet.
                                                if (brouillonPhasage) {
                                                    setPhasageBulleCount(brouillonPhasage.count);
                                                    setPhasageBulleTimes(brouillonPhasage.times);
                                                }
                                                // Le brouillon revient à null : les champs repartent des
                                                // valeurs du plan, qui sont désormais celles qu'on vient
                                                // de valider. Le panneau reste ouvert — valider n'est pas
                                                // fermer, et on enchaîne souvent plusieurs essais.
                                                setBrouillonPhasage(null);
                                                setPhasageBulleEnabled(true);
                                                setSimulationEnabled(false);
                                                setPhasageBulleVersion(v => v + 1);
                                                const nomPlan = pfTabs.find(p => p.id === activePFId)?.name;
                                                toast.success(nomPlan
                                                    ? `Phasage enregistré pour le plan de feu ${nomPlan}`
                                                    : 'Phasage enregistré pour le plan de feu courant');
                                            }}
                                        >
                                            OK
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: simulationEnabled && !phasageBulleEnabled ? 'contents' : 'none' }}>
                            <IntersectionImage
                                groups={groups}
                                imageData={intersectionImage}
                                onImageChange={setIntersectionImage}
                                arrows={intersectionArrows}
                                onArrowsChange={setIntersectionArrows}
                                cycleLength={cycleLength}
                                simulationResult={simulationResult}
                                isPlaying={isPlayingSimulation}
                                playbackSpeed={simulationSpeed}
                                setIsPlaying={setIsPlayingSimulation}
                                currentTime={simulationCurrentTime}
                                setCurrentTime={setSimulationCurrentTime}
                                hoveredArrowGroupId={hoveredArrowGroupId}
                                setHoveredArrowGroupId={setHoveredArrowGroupId}
                                imageFondClair={imageFondClair}
                                hoveredDiagramTime={hoveredDiagramTime}
                                actionData={actionData}
                                selectedActions={simulationSelectedActions}
                                conflictMatrix={conflictMatrix}
                                lastImageDirectoryRef={lastImageDirectoryRef}
                                saveDirectoryHandle={saveDirectoryHandle}
                                recentImageDirs={recentImageDirs}
                                addRecentDirectory={addRecentDirectory}
                                onShowFloatingImage={() => setShowFloatingImage(true)}
                                intersectionName={intersectionName}
                                imageBrightness={imageBrightness}
                                setImageBrightness={setImageBrightness}
                                imageContrast={imageContrast}
                                setImageContrast={setImageContrast}
                            />
                        </div>
                        <div style={{ display: !phasageBulleEnabled && !simulationEnabled ? 'contents' : 'none' }}>
                            <ActionTable
                                actionData={actionData}
                                updateActionRow={updateActionRow}
                                reorderActions={reorderActions}
                                cycleLength={cycleLength}
                                maxGroup={groups.length}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                                microCustomFields={microCustomFields}
                                updateMicroCustomField={updateMicroCustomField}
                                onResizePanel={handleActionPanelResize}
                                showFloatingConditions={showFloatingConditions}
                                setShowFloatingConditions={setShowFloatingConditions}
                                showFloatingVariables={showFloatingVariables}
                                setShowFloatingVariables={setShowFloatingVariables}
                                showWrapFlash={showWrapFlash}
                                showDescription={showActionDescription}
                                actionColWidths={actionColWidths}
                                setActionColWidths={setActionColWidths}
                            tooltipsEnabled={tooltipPrefs.micro}
                            />
                        </div>
                    </div>
                </section>
        </>
    );
}
