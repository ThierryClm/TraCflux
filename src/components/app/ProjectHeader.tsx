import type { RefObject } from 'react';
import { MAX_GROUPS } from '../../utils/pfHelpers';
import { PERMISSIONS } from '../../hooks/useAuth';
import { toast } from '../../utils/toast';

type PermissionLevel = keyof typeof PERMISSIONS;
type PlanId = number;

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
}

interface ProjectHeaderProps {
    project: {
        projectName: string | null;
        setProjectName: (value: string) => void;
        isDirty: boolean;
        projectNameInputRef: RefObject<HTMLInputElement | null>;
    };
    groupCount: {
        groups: Array<{ id: number }>;
        groupCountInput: string;
        setGroupCountInput: (value: string) => void;
        setGroupCount: (value: number) => void;
        askConfirm: (options: ConfirmOptions) => Promise<boolean>;
    };
    history: {
        undo: () => unknown;
        redo: () => unknown;
        canUndo: boolean;
        canRedo: boolean;
    };
    dependencies: {
        showDependencies: boolean;
        setShowDependencies: (value: boolean) => void;
        dependencyGap: number;
        setDependencyGap: (value: number) => void;
        conflicts: unknown[];
    };
    plan: {
        pfTabs: Array<{ id: PlanId; color?: string | null }>;
        activePFId: PlanId;
        setPFColor: (id: PlanId, color: string | null) => void;
    };
    account: {
        accountsEnabled: boolean;
        currentUser: {
            username: string;
            permissions: PermissionLevel;
            isAdmin: boolean;
        } | null;
        logout: () => void;
    };
    help: {
        helpZoneRef: { current: string | null };
        tip: (label: string) => string | undefined;
    };
    example: boolean;
    readOnly: boolean;
}

function ProjectHeader({
    project,
    groupCount,
    history,
    dependencies,
    plan,
    account,
    help,
    example,
    readOnly,
}: ProjectHeaderProps) {
    const { projectName, setProjectName, isDirty, projectNameInputRef } = project;
    const { groups, groupCountInput, setGroupCountInput, setGroupCount, askConfirm } = groupCount;
    const { undo, redo, canUndo, canRedo } = history;
    const { showDependencies, setShowDependencies, dependencyGap, setDependencyGap, conflicts } = dependencies;
    const { pfTabs, activePFId, setPFColor } = plan;
    const { accountsEnabled, currentUser, logout } = account;
    const { helpZoneRef, tip } = help;
    const isExample = example;
    const dossierReadOnly = readOnly;
    const displayActiveConflicts = conflicts;
    const permissionLabel = currentUser
        ? PERMISSIONS[currentUser.permissions]?.label
        : undefined;

    return (
        <>

            {isExample && (
                <div className="example-banner" role="status">
                    🧪 Projet exemple — librement modifiable, mais <strong>non enregistrable</strong> (sauvegarde et stockage désactivés). Faites <strong>Fichier → Nouveau projet</strong> pour démarrer le vôtre.
                </div>
            )}
            {dossierReadOnly && (
                <div className="readonly-banner" role="status">
                    🔒 Dossier en <strong>lecture seule</strong> — les données d'entrée sont verrouillées et la sauvegarde est désactivée, pour préserver l'intégrité du dossier transmis. Consultation, simulation et fenêtres détachées restent disponibles.
                </div>
            )}
            <header className="app-header" onMouseEnter={() => { helpZoneRef.current = 'interface'; }}>
                <div className="header-inputs">
                    <input
                        ref={projectNameInputRef}
                        className="input-name"
                        type="text"
                        value={projectName || ''}
                        onChange={(e) => setProjectName(e.currentTarget.value)}
                        placeholder="Nom du projet"
                        title={tip("Nom du projet (utilisé pour la sauvegarde)")}
                    />
                    {isDirty && (
                        <span
                            className="unsaved-indicator"
                            title={tip("Modifications non sauvegardées")}
                            aria-label="Modifications non sauvegardées"
                        >*</span>
                    )}
                    <label className="gfx-label">
                        GFx
                        <input
                            type="number"
                            min="1" max={MAX_GROUPS}
                            value={groupCountInput}
                            onChange={(e) => setGroupCountInput(e.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            onBlur={async () => {
                                const newCount = parseInt(groupCountInput, 10);
                                if (!isNaN(newCount) && newCount >= 1 && newCount <= MAX_GROUPS && newCount !== groups.length) {
                                    const isReduce = newCount < groups.length;
                                    const ok = await askConfirm({
                                        title: isReduce ? 'Réduire le nombre de groupes' : 'Ajouter des groupes',
                                        message: isReduce
                                            ? `Réduire de ${groups.length} à ${newCount} groupes de feu supprimera les paramètres des groupes supprimés sur l'ensemble des plans de feu.\n\nConfirmer ?`
                                            : `L'ajout de groupes de feux s'appliquera pour l'ensemble des plans de feu.\n\nConfirmer ?`,
                                        confirmLabel: 'Confirmer',
                                        danger: isReduce,
                                    });
                                    if (ok) {
                                        setGroupCount(newCount);
                                    } else {
                                        setGroupCountInput(groups.length.toString());
                                    }
                                } else {
                                    setGroupCountInput(groups.length.toString());
                                }
                            }}
                            className="input-count"
                        />
                    </label>
                </div>

                <div className="header-actions">
                    <button
                        className="undo-btn"
                        onClick={() => { if (undo() !== false) toast.info('Action annulée'); }}
                        disabled={!canUndo}
                        title={tip("Annuler (Ctrl+Z)")}
                    >
                        ↶ Annuler
                    </button>
                    <button
                        className="undo-btn"
                        onClick={() => { if (redo() !== false) toast.info('Action rétablie'); }}
                        disabled={!canRedo}
                        title={tip("Refaire (Ctrl+Y)")}
                    >
                        ↷ Refaire
                    </button>
                    <button
                        className={`toggle-btn ${showDependencies ? 'active' : ''}`}
                        onClick={() => setShowDependencies(!showDependencies)}
                        title={tip("Afficher/masquer les temps de dégagement")}
                    >
                        ⟷ Dépendance
                    </button>
                    {showDependencies && (
                        <input
                            type="number"
                            min="1"
                            max="99"
                            value={dependencyGap}
                            onChange={(e) => {
                                const val = parseInt(e.currentTarget.value, 10) || 20;
                                setDependencyGap(Math.max(1, Math.min(99, val)));
                            }}
                            className="input-dependency-gap"
                            title={tip("Écart maximum pour afficher les dépendances (secondes)")}
                        />
                    )}
                </div>

                <div className="status-bar">
                    {displayActiveConflicts.length > 0 ? (
                        <div className="status-error">
                            {displayActiveConflicts.length} CONFLITS !
                        </div>
                    ) : (
                        <button
                            className={`toggle-btn validate-btn ${pfTabs.find(pf => pf.id === activePFId)?.color === '#4CAF50' ? 'validated' : ''} ${pfTabs.find(pf => pf.id === activePFId)?.color === '#e74c3c' ? 'invalidated' : ''}`}
                            onClick={(e) => {
                                const activePF = pfTabs.find(pf => pf.id === activePFId);
                                if (e.ctrlKey && !activePF?.color) {
                                    // Ctrl+clic depuis neutre → invalidé (rouge)
                                    setPFColor(activePFId, '#e74c3c');
                                } else if (activePF?.color) {
                                    // Clic simple sur validé ou invalidé → neutre
                                    setPFColor(activePFId, null);
                                } else {
                                    // Clic simple sur neutre → validé (vert)
                                    setPFColor(activePFId, '#4CAF50');
                                }
                            }}
                            title={tip("Clic: valider / Ctrl+clic: invalider")}
                        >
                            {pfTabs.find(pf => pf.id === activePFId)?.color === '#e74c3c' ? 'Invalidé'
                            : pfTabs.find(pf => pf.id === activePFId)?.color === '#4CAF50' ? 'Validé'
                            : 'Valider'}
                        </button>
                    )}
                </div>

                {accountsEnabled && (<div className="user-info">
                    <span className="user-name" title={tip(`Permissions: ${permissionLabel || 'Inconnues'}`)}>
                        {currentUser?.username}
                        {currentUser?.isAdmin && ' (Admin)'}
                    </span>
                    {/* Le visiteur d'un projet exemple n'a pas de compte : lui offrir
                        « Déconnexion » le renverrait sur l'écran de création de compte,
                        justement ce que la session exemple évite. */}
                    {!isExample && (
                        <button
                            className="logout-btn"
                            onClick={logout}
                            title={tip("Se déconnecter")}
                        >
                            Déconnexion
                        </button>
                    )}
                </div>)}
            </header>


        </>
    );
}

export default ProjectHeader;
