import SimulationPanel from '../SimulationPanel';
import TrafficTable from '../TrafficTable';
import PropertiesPanel from '../PropertiesPanel';
import GroupTable from '../GroupTable';
import IntergreenMatrix from '../IntergreenMatrix';
import DiagnosticPanel from '../DiagnosticPanel';
import ConflictList from '../ConflictList';

export default function WorkspaceSidebar({ model }) {
    const {
        sidebarVisible,
        phasageBulleEnabled,
        sidebarWidth,
        groups,
        intersectionArrows,
        phasageBulleVisibleGroups,
        hoveredPhasageGroupId,
        setHoveredPhasageGroupId,
        togglePhasageBulleGroup,
        setPhasageBulleVisibleGroups,
        tip,
        simulationEnabled,
        actionData,
        simulationSelectedActions,
        toggleSimulationAction,
        selectAllSimulationActions,
        deselectAllSimulationActions,
        cycleLength,
        conflictMatrix,
        hoveredActionId,
        setHoveredActionId,
        setHoveredConflict,
        simulationName,
        updateSimulationName,
        activeTrafficDataset,
        setActiveTrafficDataset,
        updateTrafficData,
        getTrafficData,
        updateGroupParams,
        setHoveredArrowGroupId,
        hoveredArrowGroupId,
        setHoveredArrowGroupSaturated,
        trafficDatasetNames,
        setHoveredVUtile,
        copyTrafficDataset,
        addCustomTrafficDataset,
        simulationResult,
        setShowFloatingTraffic,
        tooltipPrefs,
        activeTab,
        setActiveTab,
        setSidebarWidth,
        intersectionName,
        setIntersectionName,
        projectProperties,
        updateProjectProperty,
        appCommunes,
        appMoaLogos,
        appMoeLogos,
        setShowFloatingProperties,
        showGroupNamesForm,
        setShowFloatingForm,
        startDrag,
        endDrag,
        activePFId,
        pfTabs,
        biCarrefourSeparator,
        showGroupNamesMatrix,
        matricesLocked,
        setShowFloatingMatrix,
        showCapacityReserve,
        showFloatingDiagnostic,
        setShowFloatingDiagnostic,
        displayConflicts,
        isConflictGrayed,
        showFloatingConflicts,
        setShowFloatingConflicts,
        recentOpenDirs,
        recentSaveDirs,
        recentImportDirs,
        helpZoneRef,
    } = model;

    return (
                <aside className={`sidebar${sidebarVisible ? '' : ' repliee'}`} style={{
                    width: sidebarVisible ? `${phasageBulleEnabled ? Math.min(sidebarWidth, 350) : sidebarWidth}px` : '0px',
                    minWidth: sidebarVisible ? (phasageBulleEnabled ? '200px' : '300px') : '0px',
                    padding: sidebarVisible ? '1rem' : '0',
                    overflow: 'hidden'
                }}>
                    {phasageBulleEnabled ? (
                        <div className="phasage-bulle-sidebar">
                            <div className="sidebar-header">
                                <h3>Groupe de feux</h3>
                                <p className="sidebar-subtitle">Sélectionnez les groupes à afficher</p>
                            </div>
                            <div className="phasage-group-list">
                                {groups.map(g => {
                                    const hasArrow = intersectionArrows.some(a => a.groupId === g.id);
                                    const isVisible = phasageBulleVisibleGroups.has(g.id);
                                    return (
                                        <label
                                            key={g.id}
                                            className={`phasage-group-item ${isVisible ? 'checked' : ''} ${!hasArrow ? 'no-arrow' : ''} ${hoveredPhasageGroupId === g.id ? 'hovered' : ''}`}
                                            onMouseEnter={() => hasArrow && setHoveredPhasageGroupId(g.id)}
                                            onMouseLeave={() => setHoveredPhasageGroupId(null)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isVisible}
                                                onChange={() => togglePhasageBulleGroup(g.id)}
                                                disabled={!hasArrow}
                                            />
                                            <span className="phasage-group-id">GF{g.id}</span>
                                            <span className="phasage-group-name">{g.name || '-'}</span>
                                            <span className="phasage-group-courant">{g.courant || '-'}</span>
                                            {!hasArrow && (
                                                <span className="phasage-no-arrow-hint" title={tip("Aucune flèche définie pour ce groupe")}>∅</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="phasage-group-actions">
                                <button
                                    className="phasage-btn-select-all"
                                    onClick={() => {
                                        const allArrowGroups = new Set(intersectionArrows.map(a => a.groupId));
                                        setPhasageBulleVisibleGroups(allArrowGroups);
                                    }}
                                >
                                    Tout cocher
                                </button>
                                <button
                                    className="phasage-btn-deselect-all"
                                    onClick={() => setPhasageBulleVisibleGroups(new Set())}
                                >
                                    Tout décocher
                                </button>
                            </div>
                        </div>
                    ) : simulationEnabled ? (
                        <>
                            <SimulationPanel
                                actionData={actionData}
                                selectedActions={simulationSelectedActions}
                                onToggle={toggleSimulationAction}
                                onSelectAll={selectAllSimulationActions}
                                onDeselectAll={deselectAllSimulationActions}
                                groups={groups}
                                cycleLength={cycleLength}
                                conflictMatrix={conflictMatrix}
                                hoveredActionId={hoveredActionId}
                                setHoveredActionId={setHoveredActionId}
                                setHoveredConflict={setHoveredConflict}
                                scenarioName={simulationName}
                                onScenarioNameChange={updateSimulationName}
                            />
                            {/* Même tableau que l'onglet Trafic, aux mêmes formules :
                                seuls les temps changent (diagramme simulé), et la
                                saisie est fermée. Le panneau en portait une copie
                                réduite, aux colonnes et aux calculs divergents. */}
                            <div onMouseEnter={() => { helpZoneRef.current = 'trafic'; }}>
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
                                    setHoveredVUtile={setHoveredVUtile}
                                    copyTrafficDataset={copyTrafficDataset}
                                    addCustomTrafficDataset={addCustomTrafficDataset}
                                    actionData={actionData}
                                    simulationSelectedActions={simulationSelectedActions}
                                    simulationResult={simulationResult}
                                    readOnly
                                    onDetach={() => setShowFloatingTraffic(v => !v)}
                                    tooltipsEnabled={tooltipPrefs.traffic}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="sidebar-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('properties');
                                        setSidebarWidth(450);
                                    }}
                                >
                                    Propriétés
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('config');
                                        setSidebarWidth(450);
                                    }}
                                >
                                    Configuration
                                    {groups.length > 0 && groups.every(g => !g.type || g.type === '') && (
                                        <span className="tab-warning-icon" title={tip("Formulaire non renseigné")} role="img" aria-label="Formulaire non renseigné"> ⚠</span>
                                    )}
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('matrix');
                                        // Calculate optimal width for matrix:
                                        // Find longest group name to calculate Nom column width
                                        const maxNameLength = Math.max(3, ...groups.map(g => (g.name || '').length));
                                        const nomColWidth = Math.max(70, maxNameLength * 7); // ~7px per character at 0.75em font-size
                                        // Row header (24px) + Nom col (variable) + data cells (19px each with border) + first header col (19px) + padding (51px)
                                        const matrixWidth = 24 + nomColWidth + (groups.length * 19) + 19 + 51;
                                        setSidebarWidth(Math.min(1200, Math.max(300, matrixWidth)));
                                    }}
                                >
                                    Matrice
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveTab('traffic');
                                        // Set width to display full traffic table (optimized)
                                        // Grp(28) + Nom(160) + inputs(38*6) + padding
                                        setSidebarWidth(520);
                                    }}
                                >
                                    Trafic
                                </button>
                            </div>

                            {activeTab === 'properties' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'properties'; }}>
                                    <PropertiesPanel
                                        intersectionName={intersectionName}
                                        setIntersectionName={setIntersectionName}
                                        projectProperties={projectProperties}
                                        updateProjectProperty={updateProjectProperty}
                                        appCommunes={appCommunes}
                                        appMoaLogos={appMoaLogos}
                                        appMoeLogos={appMoeLogos}
                                        onDetach={() => setShowFloatingProperties(v => !v)}
                                        tooltipsEnabled={tooltipPrefs.config}
                                    />
                                </div>
                            )}

                            {activeTab === 'config' && (
                                <>
                                    <div onMouseEnter={() => { helpZoneRef.current = 'config-groupes'; }}>
                                    <GroupTable
                                        groups={groups}
                                        updateGroupParams={updateGroupParams}
                                        cycleLength={cycleLength}
                                        showGroupNames={showGroupNamesForm}
                                        onDetach={() => setShowFloatingForm(v => !v)}
                                        hoveredGroupId={hoveredArrowGroupId}
                                        startDrag={startDrag}
                                        endDrag={endDrag}
                                    tooltipsEnabled={tooltipPrefs.config}
                                    />
                                    </div>
                                    <div style={{ marginTop: '2rem' }} onMouseEnter={() => { helpZoneRef.current = 'matrice'; }}>
                                        <IntergreenMatrix
                                            conflictMatrix={conflictMatrix}
                                            setMatrixValue={setMatrixValue}
                                            groups={groups}
                                            cycleLength={cycleLength}
                                            actionData={actionData}
                                            activePFId={activePFId}
                                            pfTabs={pfTabs}
                                            biCarrefourSeparator={biCarrefourSeparator}
                                            onCellHover={setHoveredConflict}
                                            showGroupNames={showGroupNamesMatrix}
                                            locked={matricesLocked}
                                            onDetach={() => setShowFloatingMatrix(v => !v)}
                                            hoveredGroupId={hoveredArrowGroupId}
                                        tooltipsEnabled={tooltipPrefs.matrix}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'matrix' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'matrice'; }}>
                                <IntergreenMatrix
                                    conflictMatrix={conflictMatrix}
                                    setMatrixValue={setMatrixValue}
                                    groups={groups}
                                    cycleLength={cycleLength}
                                    actionData={actionData}
                                    activePFId={activePFId}
                                    pfTabs={pfTabs}
                                    biCarrefourSeparator={biCarrefourSeparator}
                                    onCellHover={setHoveredConflict}
                                    showGroupNames={showGroupNamesMatrix}
                                    locked={matricesLocked}
                                    onDetach={() => setShowFloatingMatrix(v => !v)}
                                    hoveredGroupId={hoveredArrowGroupId}
                                tooltipsEnabled={tooltipPrefs.matrix}
                                />
                                </div>
                            )}

                            {activeTab === 'traffic' && (
                                <div onMouseEnter={() => { helpZoneRef.current = 'trafic'; }}>
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
                                    setHoveredVUtile={setHoveredVUtile}
                                    copyTrafficDataset={copyTrafficDataset}
                                    addCustomTrafficDataset={addCustomTrafficDataset}
                                    actionData={actionData}
                                    simulationSelectedActions={simulationSelectedActions}
                                    onDetach={() => setShowFloatingTraffic(v => !v)}
                                tooltipsEnabled={tooltipPrefs.traffic}
                                />
                                {showCapacityReserve && (
                                    <DiagnosticPanel
                                        groups={groups}
                                        cycleLength={cycleLength}
                                        getTrafficData={getTrafficData}
                                        actionData={actionData}
                                        activeTrafficDataset={activeTrafficDataset}
                                        onDetach={showFloatingDiagnostic ? null : () => setShowFloatingDiagnostic(true)}
                                        tip={tip}
                                    />
                                )}
                                </div>
                            )}

                            {displayConflicts.length > 0 && (
                                <ConflictList
                                    conflicts={displayConflicts}
                                    groups={groups}
                                    isConflictGrayed={isConflictGrayed}
                                    setHoveredConflict={setHoveredConflict}
                                    onDetach={showFloatingConflicts ? null : () => setShowFloatingConflicts(true)}
                                    tip={tip}
                                />
                            )}

                            {/* Répertoires mémorisés */}
                            {(recentOpenDirs.length > 0 || recentSaveDirs.length > 0) && (
                                <div className="directories-info">
                                    <h4>Répertoires mémorisés</h4>
                                    {recentOpenDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Ouvrir:</span>
                                            <span className="dir-value" title={tip(recentOpenDirs[0].name)}>{recentOpenDirs[0].name}</span>
                                        </div>
                                    )}
                                    {recentSaveDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Enregistrer:</span>
                                            <span className="dir-value" title={tip(recentSaveDirs[0].name)}>{recentSaveDirs[0].name}</span>
                                        </div>
                                    )}
                                    {recentImportDirs.length > 0 && (
                                        <div className="dir-row">
                                            <span className="dir-label">Importer:</span>
                                            <span className="dir-value" title={tip(recentImportDirs[0].name)}>{recentImportDirs[0].name}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </aside>
    );
}
