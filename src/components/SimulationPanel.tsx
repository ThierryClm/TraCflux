import { useEffect, useMemo, useRef, useState } from 'react';
import {
    calculateSimulatedDiagram, actionsSimulables, conflitsSimules,
    actionsDuScenario, scenarioModifie, titreScenarioRefuse, normaliserTitreScenario, LONGUEUR_TITRE_SCENARIO
} from '../simulation';
import type { ActionMicro, Groupe, Matrice, ScenarioSimulation } from '../types/projet';
import Modal from './Modal';
import './SimulationPanel.css';

interface HoveredConflict {
    from: number;
    to: number;
    isConflict: boolean;
}

interface SimulationPanelProps {
    actionData: ActionMicro[];
    selectedActions: number[];
    onToggle: (actionId: number) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    groups: Groupe[];
    cycleLength: number;
    conflictMatrix: Matrice;
    hoveredActionId: number | null;
    setHoveredActionId: (actionId: number | null) => void;
    setHoveredConflict?: (conflict: HoveredConflict | null) => void;
    /** Titre du scénario choisi ; vide = « Sans titre ». */
    scenarioName?: string;
    scenarios?: ScenarioSimulation[];
    onChoisirScenario?: (nom: string) => void;
    onCreerScenario?: (titre: string) => void;
    onEnregistrerScenario?: (titre: string) => void;
    onSupprimerScenario?: () => void;
}

/** La fenêtre ouverte par la liste ou les boutons du scénario. */
type Dialogue =
    | { type: 'nouveau' }
    | { type: 'enregistrer' }
    | { type: 'supprimer' }
    /** Changer de scénario alors que le choisi a des modifications. */
    | { type: 'quitter'; vers: string };

const rien = () => {};

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
    scenarios = [],
    onChoisirScenario = rien,
    onCreerScenario = rien,
    onEnregistrerScenario = rien,
    onSupprimerScenario = rien
}: SimulationPanelProps) => {
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

    // --- Scénarios ---------------------------------------------------------
    const scenarioActif = useMemo(
        () => scenarios.find(sc => sc.nom === scenarioName) || null,
        [scenarios, scenarioName]);
    const modifie = scenarioModifie(scenarioActif, selectedActions, actionData);

    const [menuOuvert, setMenuOuvert] = useState(false);
    const [dialogue, setDialogue] = useState<Dialogue | null>(null);
    const [titre, setTitre] = useState('');
    const zoneScenarioRef = useRef<HTMLDivElement>(null);

    // La liste se referme au clic ailleurs ou sur Échap.
    useEffect(() => {
        if (!menuOuvert) return;
        const dehors = (e: MouseEvent) => {
            if (!zoneScenarioRef.current?.contains(e.target as Node)) setMenuOuvert(false);
        };
        const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOuvert(false); };
        document.addEventListener('mousedown', dehors);
        document.addEventListener('keydown', echap);
        return () => {
            document.removeEventListener('mousedown', dehors);
            document.removeEventListener('keydown', echap);
        };
    }, [menuOuvert]);

    const ouvrir = (d: Dialogue) => {
        setMenuOuvert(false);
        setTitre(d.type === 'enregistrer' ? scenarioName : '');
        setDialogue(d);
    };
    const fermer = () => setDialogue(null);

    const choisirLigne = (nom: string) => {
        setMenuOuvert(false);
        if (nom === scenarioName) return;
        // Rien ne se perd sans qu'on l'ait décidé.
        if (modifie) ouvrir({ type: 'quitter', vers: nom });
        else onChoisirScenario(nom);
    };

    // Le titre tapé : changé, il renomme le scénario ou en crée une copie.
    const titreNet = normaliserTitreScenario(titre);
    const renomme = dialogue?.type === 'enregistrer' && titreNet !== scenarioName;
    const refus = dialogue?.type === 'nouveau'
        ? titreScenarioRefuse(titre, scenarios)
        : dialogue?.type === 'enregistrer'
            ? titreScenarioRefuse(titre, scenarios, scenarioName)
            : null;
    const refusCopie = renomme ? titreScenarioRefuse(titre, scenarios) : null;

    const valider = (action: 'creer' | 'enregistrer') => {
        if (action === 'creer' ? (refus || refusCopie) : refus) return;
        if (action === 'creer') onCreerScenario(titreNet);
        else onEnregistrerScenario(titreNet);
        fermer();
    };

    // Helper: adjust a time position based on AV contractions only
    // EP removedPeriods are in the post-AV timeline, so we only apply AV contractions
    const adjustForAVContractions = (time: number) => {
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
        if (!removedPeriods || removedPeriods.length === 0) return new Set<number>();
        const erased = new Set<number>();
        activeActions.forEach(action => {
            if (action.deb === '') return;
            // Escamotage de phase never grayed (it's the contracting action)
            if (action.action === 'Escamotage de phase') return;
            const rawDeb = parseInt(String(action.deb ?? '')) || 0;
            const hasFin = action.fin !== '';
            const rawFin = hasFin ? (parseInt(String(action.fin ?? '')) || 0) : rawDeb;
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

            {/* Le scénario choisi, puis la liste : Tout cocher, Tout décocher,
                les scénarios du plan, Nouveau scénario. La liste s'ouvre
                par-dessus le panneau. Les cases cochées ne mettent à jour le
                scénario qu'à l'enregistrement : le ● le signale en attendant. */}
            <div className="simulation-scenario" ref={zoneScenarioRef}>
                <span className="simulation-scenario-label">Scénario</span>
                <button
                    type="button"
                    className={`simulation-scenario-select${scenarioActif ? '' : ' sans-titre'}`}
                    aria-haspopup="listbox"
                    aria-expanded={menuOuvert}
                    onClick={() => setMenuOuvert(o => !o)}
                    title="Choisir, créer ou modifier un scénario. Les scénarios sont enregistrés avec le plan de feu ; celui choisi titre la section Simulation du dossier imprimé."
                >
                    <span className="simulation-scenario-nom">{scenarioActif ? scenarioActif.nom : 'Sans titre'}</span>
                    {modifie && <span className="simulation-scenario-modifie" aria-label="modifié">●</span>}
                    <span className="simulation-scenario-fleche">{menuOuvert ? '▴' : '▾'}</span>
                </button>
                {menuOuvert && (
                    <div className="simulation-scenario-menu" role="listbox">
                        <button type="button" className="scenario-ligne commande"
                            onClick={() => { setMenuOuvert(false); onSelectAll(); }}>Tout cocher</button>
                        <button type="button" className="scenario-ligne commande"
                            onClick={() => { setMenuOuvert(false); onDeselectAll(); }}>Tout décocher</button>
                        <div className="scenario-separateur">Scénarios du plan de feu</div>
                        {scenarios.length === 0 && (
                            <div className="scenario-vide">Aucun scénario enregistré</div>
                        )}
                        {scenarios.map(sc => (
                            <button
                                key={sc.nom}
                                type="button"
                                role="option"
                                aria-selected={sc.nom === scenarioName}
                                className={`scenario-ligne${sc.nom === scenarioName ? ' choisi' : ''}`}
                                onClick={() => choisirLigne(sc.nom)}
                            >
                                <span className="scenario-coche">{sc.nom === scenarioName ? '✓' : ''}</span>
                                <span className="scenario-nom">{sc.nom}</span>
                                <span className="scenario-compte" title="Actions cochées">{actionsDuScenario(sc, actionData).length}</span>
                            </button>
                        ))}
                        <div className="scenario-separateur" />
                        <button type="button" className="scenario-ligne nouveau"
                            onClick={() => ouvrir({ type: 'nouveau' })}>+ Nouveau scénario…</button>
                    </div>
                )}
            </div>
            {modifie && (
                <div className="simulation-scenario-note">● modifié depuis le dernier enregistrement</div>
            )}

            <div className="simulation-controls">
                <button
                    className="sim-btn"
                    onClick={() => ouvrir({ type: 'enregistrer' })}
                    disabled={!scenarioActif}
                    title={scenarioActif ? 'Enregistrer les cases cochées dans ce scénario, le renommer ou en créer une copie' : 'Choisis un scénario dans la liste, ou crée-le avec « Nouveau scénario… »'}
                >
                    Enregistrer…
                </button>
                <button
                    className="sim-btn"
                    onClick={() => ouvrir({ type: 'supprimer' })}
                    disabled={!scenarioActif}
                    title={scenarioActif ? 'Retirer ce scénario de la liste' : 'Aucun scénario choisi'}
                >
                    Supprimer…
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


            <Modal
                isOpen={!!dialogue}
                onClose={fermer}
                className="simulation-scenario-dialog"
                title={dialogue?.type === 'nouveau' ? 'Nouveau scénario'
                    : dialogue?.type === 'enregistrer' ? 'Enregistrer le scénario'
                    : dialogue?.type === 'supprimer' ? 'Supprimer le scénario ?'
                    : 'Modifications non enregistrées'}
            >
                <div onKeyDown={(e) => { if (e.key === 'Escape') fermer(); }}>
                    {(dialogue?.type === 'nouveau' || dialogue?.type === 'enregistrer') && (
                        <form onSubmit={(e) => { e.preventDefault(); valider(dialogue.type === 'nouveau' ? 'creer' : 'enregistrer'); }}>
                            <label className="scenario-dialog-champ">
                                <span>Titre</span>
                                <input
                                    type="text"
                                    autoFocus
                                    value={titre}
                                    maxLength={LONGUEUR_TITRE_SCENARIO}
                                    placeholder="ex. Escamotage bus phase 1"
                                    onChange={(e) => setTitre(e.target.value)}
                                />
                            </label>
                            <p className="scenario-dialog-resume">
                                {selectedCount} action{selectedCount > 1 ? 's' : ''} cochée{selectedCount > 1 ? 's' : ''} · cycle simulé {simulatedCycleLength}s
                            </p>
                            {refus && titre !== '' && <p className="scenario-dialog-refus">{refus}</p>}
                            {renomme && !refus && (
                                <p className="scenario-dialog-aide">
                                    Titre modifié : « Renommer » remplace « {scenarioName} », « Créer une copie » le garde.
                                </p>
                            )}
                            <div className="scenario-dialog-boutons">
                                <button type="button" className="scenario-btn" onClick={fermer}>Annuler</button>
                                {dialogue.type === 'nouveau' && (
                                    <button type="submit" className="scenario-btn principal" disabled={!!refus}>Créer</button>
                                )}
                                {dialogue.type === 'enregistrer' && renomme && (
                                    <button type="button" className="scenario-btn" disabled={!!(refus || refusCopie)}
                                        onClick={() => valider('creer')}>Créer une copie</button>
                                )}
                                {dialogue.type === 'enregistrer' && (
                                    <button type="submit" className="scenario-btn principal" disabled={!!refus}>
                                        {renomme ? 'Renommer' : 'Enregistrer'}
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                    {dialogue?.type === 'supprimer' && (
                        <>
                            <p className="scenario-dialog-texte">« {scenarioName} » sera retiré de la liste.</p>
                            <p className="scenario-dialog-aide">Les cases cochées restent en place.</p>
                            <div className="scenario-dialog-boutons">
                                <button type="button" className="scenario-btn" onClick={fermer}>Annuler</button>
                                <button type="button" className="scenario-btn danger" autoFocus
                                    onClick={() => { onSupprimerScenario(); fermer(); }}>Supprimer</button>
                            </div>
                        </>
                    )}
                    {dialogue?.type === 'quitter' && (
                        <>
                            <p className="scenario-dialog-texte">
                                « {scenarioName} » a été modifié. L'enregistrer avant d'ouvrir « {dialogue.vers} » ?
                            </p>
                            <div className="scenario-dialog-boutons">
                                <button type="button" className="scenario-btn" onClick={fermer}>Annuler</button>
                                <button type="button" className="scenario-btn"
                                    onClick={() => { onChoisirScenario(dialogue.vers); fermer(); }}>Abandonner</button>
                                <button type="button" className="scenario-btn principal" autoFocus
                                    onClick={() => { onEnregistrerScenario(scenarioName); onChoisirScenario(dialogue.vers); fermer(); }}>Enregistrer</button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SimulationPanel;
