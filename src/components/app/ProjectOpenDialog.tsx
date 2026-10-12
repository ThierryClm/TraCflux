import CustomTooltip from '../CustomTooltip';
import Modal from '../Modal';

interface SavedProjectSummary {
    name: string;
    savedAt?: string | null;
    size?: number | null;
}

interface ProjectOpenDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projects: SavedProjectSummary[];
    selectedProject: string | null;
    onSelect: (name: string) => void;
    onOpen: (name: string | null) => void;
}

// Les projets listés sont les sauvegardes automatiques du navigateur : elles
// reflètent le dernier travail fait sur ce poste, pas forcément la version
// partagée du projet.
export const INFO_RESTAURATION =
    'Ces projets sont les dernières versions enregistrées automatiquement sur ce poste, ' +
    'issues de votre propre travail.\n' +
    'Avant de reprendre l\'un d\'eux, vérifiez qu\'il n\'a pas été modifié entre-temps ' +
    'par un autre utilisateur (par exemple dans la version partagée sur le réseau).';

const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatSize = (bytes?: number | null) => {
    if (!bytes) return '-';
    return `${(bytes / 1024).toFixed(1)} Ko`;
};

export default function ProjectOpenDialog({
    isOpen,
    onClose,
    projects,
    selectedProject,
    onSelect,
    onOpen,
}: ProjectOpenDialogProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={(
                <span className="titre-avec-info">
                    Ouvrir un projet
                    {/* Affichée même infobulles désactivées : on survole ce bouton pour la lire. */}
                    <CustomTooltip text={INFO_RESTAURATION}>
                        <span className="bouton-info" role="img" aria-label={INFO_RESTAURATION} tabIndex={0}>i</span>
                    </CustomTooltip>
                </span>
            )}
            overlayClassName="modal-menu-overlay"
        >
            {projects.length > 0 ? (
                <>
                    <div className="project-list-container">
                        <ul className="project-list">
                            {projects.map((project) => (
                                <li
                                    key={project.name}
                                    className={selectedProject === project.name ? 'selected' : ''}
                                    onClick={() => onSelect(project.name)}
                                    onDoubleClick={() => onOpen(project.name)}
                                >
                                    <span className="project-icon"></span>
                                    <div className="project-info-modal">
                                        <span className="project-name">{project.name}</span>
                                        <span className="project-details-modal">{formatDate(project.savedAt)} - {formatSize(project.size)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={onClose}>
                            Annuler
                        </button>
                        <button
                            className="modal-btn modal-btn-primary"
                            onClick={() => onOpen(selectedProject)}
                            disabled={!selectedProject}
                        >
                            Ouvrir
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="no-projects">Aucun projet sauvegardé</p>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={onClose}>
                            Fermer
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
}
