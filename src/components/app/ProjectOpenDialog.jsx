import Modal from '../Modal';

const formatDate = (isoString) => {
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

const formatSize = (bytes) => {
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
    tip,
}) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={tip('Ouvrir un projet')} overlayClassName="modal-menu-overlay">
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
