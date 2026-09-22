import { useMemo } from 'react';
import { calculateSimulatedDiagram, actionsSimulables, conflitsSimules } from '../utils/simulationCalculator';
import './SimulationPanel.css';

const SimulationPanel = ({
    actionData,
    selectedActions,
    onToggle,
    onSelectAll,
    onDeselectAll,
    groups,
    cycleLength,
    conflictMatrix,
    hoveredActionId,
    setHoveredActionId,
    setHoveredConflict,
    scenarioName = '',
    onScenarioNameChange = null
}) => {
    // Les actions retenues par la simulation (liste partagée, cf. en-tête).
    const activeActions = actionsSimulables(actionData);

    const selectedCount = activeActions.filter(a => selectedActions.includes(a.id)).length;

    // Calculate simulated diagram and conflicts
    const simulationResult = useMemo(() => {
        return calculateSimulatedDiagram(
            groups,
            actionData,
            selectedActions,
            cycleLength,
            conflictMatrix
        );
    }, [groups, actionData, selectedActions, cycleLength, conflictMatrix]);

    const { simulatedCycleLength, conflicts: rawConflicts, removedPeriods, contractions } = simulationResult;

    // Helper: adjust a time position based on AV contractions only
    // EP removedPeriods are in the post-AV timeline, so we only apply AV contractions
    const adjustForAVContractions = (time) => {
        if (!contractions || contractions.length === 0) return time;
        let adjusted = time;
        for (const c of contractions) {
            if (c.source !== 'Adaptatif vertical') continue;
            if (adjusted >= c.fin) {
                adjusted -= (c.fin - c.deb);
            } else if (adjusted > c.deb) {
                adjusted = c.deb;
            }
        }
        return adjusted;
    };

    // Determine which actions are "erased" (their adjusted deb or [deb,fin] is inside a removed period)
    const erasedActionIds = useMemo(() => {
        if (!removedPeriods || removedPeriods.length === 0) return new Set();
        const erased = new Set();
        activeActions.forEach(action => {
            if (action.deb === '') return;
            // Escamotage de phase never grayed (it's the contracting action)
            if (action.action === 'Escamotage de phase') return;
            const rawDeb = parseInt(action.deb) || 0;
            const hasFin = action.fin !== '';
            const rawFin = hasFin ? (parseInt(action.fin) || 0) : rawDeb;
            // Adaptatif vertical can only be grayed by Escamotage de phase zones (not its own)
            const isAV = action.action === 'Adaptatif vertical';
            for (const period of removedPeriods) {
                if (isAV && period.source !== 'Escamotage de phase') continue;
                // For EP removedPeriods: adjust action values by AV contractions only
                // For AV removedPeriods: use original action values (AV zones are in original timeline)
                let deb, fin;
                if (period.source === 'Escamotage de phase') {
                    deb = adjustForAVContractions(rawDeb);
                    fin = adjustForAVContractions(rawFin);
                } else {
                    deb = rawDeb;
                    fin = rawFin;
                }
                if (!hasFin) {
                    // Action with deb only (e.g. "Point de repos"): erased if deb is inside the zone
                    if (deb >= period.deb && deb < period.fin) {
                        erased.add(action.id);
                        break;
                    }
                } else {
                    // Action with [deb, fin]: erased only if BOTH deb AND fin are inside the zone
                    if (deb >= period.deb && deb < period.fin && fin > period.deb && fin <= period.fin) {
                        erased.add(action.id);
                        break;
                    }
                }
            }
        });
        return erased;
    }, [activeActions, removedPeriods, contractions]);

    // Les conflits du diagramme simulé, cf. conflitsSimules en tête de module.
    const conflicts = useMemo(
        () => conflitsSimules(rawConflicts, actionData, selectedActions),
        [rawConflicts, actionData, selectedActions]);

    return (
        <div className="simulation-panel">
            <div className="simulation-header">
                <h3>Simulation</h3>
                <span className="simulation-count">
                    {selectedCount}/{activeActions.length} actions
                </span>
            </div>

            {/* Nom du scénario. Il appartient au plan de feu et le suit : c'est
                lui qui titre la section imprimée, et qui permet de retrouver,
                d'une séance à l'autre, ce que cette combinaison d'actions
                voulait démontrer. */}
            <label className="simulation-scenario">
                <span className="simulation-scenario-label">Scénario</span>
                <input
                    type="text"
                    className="simulation-scenario-input"
                    value={scenarioName}
                    maxLength={60}
                    placeholder="ex. Escamotage bus phase 1"
                    onChange={(e) => onScenarioNameChange && onScenarioNameChange(e.target.value)}
                    disabled={!onScenarioNameChange}
                    title="Nom de cette combinaison d'actions. Enregistré avec le plan de feu, il titre la section Simulation du dossier imprimé."
                />
            </label>

            <div className="simulation-controls">
                <button
                    className="sim-btn"
                    onClick={onSelectAll}
                    title="Cocher toutes les actions"
                >
                    Tout cocher
                </button>
                <button
                    className="sim-btn"
                    onClick={onDeselectAll}
                    title="Décocher toutes les actions"
                >
                    Tout décocher
                </button>
            </div>

            {/* Simulation info */}
            <div className="simulation-info">
                <div className="sim-info-item">
                    <span className="sim-info-label">Cycle simulé:</span>
                    <span className="sim-info-value">{simulatedCycleLength}s</span>
                    {simulatedCycleLength !== cycleLength && (
                        <span className="sim-info-delta">
                            ({simulatedCycleLength - cycleLength > 0 ? '+' : ''}{simulatedCycleLength - cycleLength}s)
                        </span>
                    )}
                </div>
            </div>

            {/* Actions list */}
            <div className="simulation-list-header">Actions</div>
            <div className="simulation-list">
                {activeActions.length === 0 ? (
                    <p className="no-actions">Aucune action définie dans le tableau des actions.</p>
                ) : (
                    activeActions.map(action => {
                        const isChecked = selectedActions.includes(action.id);
                        const isModifying = ['Escamotage de phase', 'Ouverture anticipée', 'Adaptatif vertical'].includes(action.action);
                        const isHovered = hoveredActionId === action.id;
                        const isErased = erasedActionIds.has(action.id);
                        return (
                            <label
                                key={action.id}
                                className={`simulation-item ${isChecked ? 'checked' : ''} ${isModifying ? 'modifying' : ''} ${isHovered ? 'hovered' : ''} ${isErased ? 'erased' : ''}`}
                                onMouseEnter={() => setHoveredActionId(action.id)}
                                onMouseLeave={() => setHoveredActionId(null)}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onToggle(action.id)}
                                />
                                {action.gf && (
                                    <span className="sim-gf">GF{action.gf}</span>
                                )}
                                <span className="sim-action-type">{action.action}</span>
                                {action.deb !== '' && action.fin !== '' && (
                                    <span className="sim-time">{action.deb}-{action.fin}s</span>
                                )}
                                {action.deb !== '' && action.fin === '' && (
                                    <span className="sim-time">{action.deb}s</span>
                                )}
                                {action.description && (
                                    <span className="sim-desc" title={action.description}>
                                        {action.description.length > 15
                                            ? action.description.slice(0, 15) + '...'
                                            : action.description}
                                    </span>
                                )}
                            </label>
                        );
                    })
                )}
            </div>

            {/* Conflicts display - below actions */}
            {conflicts.length > 0 && (
                <div className="simulation-conflicts">
                    <div className="conflicts-header">
                        <span className="conflicts-icon">!</span>
                        <span className="conflicts-title">{conflicts.length} Conflit{conflicts.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="conflicts-list">
                        {conflicts.map((c, i) => (
                            <div
                                key={i}
                                className="conflict-item"
                                onMouseEnter={() => setHoveredConflict?.({ from: c.from, to: c.to, isConflict: true })}
                                onMouseLeave={() => setHoveredConflict?.(null)}
                            >
                                <span className="conflict-groups">GF{c.from} - GF{c.to}</span>
                                <span className="conflict-message">{c.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {conflicts.length === 0 && selectedCount > 0 && (
                <div className="simulation-valid">
                    <span className="valid-icon">OK</span>
                    <span>Aucun conflit</span>
                </div>
            )}

        </div>
    );
};

export default SimulationPanel;
