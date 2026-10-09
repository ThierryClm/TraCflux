import Modal from '../Modal';

interface AddCarrefourModalProps {
    isOpen: boolean;
    candidates: string[];
    selected: string | null;
    onSelect: (name: string) => void;
    /** Ajoute le dossier double-cliqué, ou à défaut le dossier sélectionné. */
    onConfirm: (name?: string) => void;
    onClose: () => void;
}

/**
 * Sélecteur de dossier pour « + Ajouter un carrefour ». Remplace l'ancien
 * window.prompt natif, invisible dans une fenêtre détachée et bloqué dans
 * certains contextes PWA.
 */
const AddCarrefourModal = ({ isOpen, candidates, selected, onSelect, onConfirm, onClose }: AddCarrefourModalProps) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Ajouter un carrefour à l'onde verte"
    >
        {candidates.length > 0 ? (
            <>
                <div className="project-list-container">
                    <ul className="project-list">
                        {candidates.map(name => (
                            <li
                                key={name}
                                className={selected === name ? 'selected' : ''}
                                onClick={() => onSelect(name)}
                                onDoubleClick={() => onConfirm(name)}
                            >
                                <span className="project-icon"></span>
                                <div className="project-info-modal">
                                    <span className="project-name">{name}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="modal-actions">
                    <button
                        className="modal-btn modal-btn-secondary"
                        onClick={onClose}
                    >
                        Annuler
                    </button>
                    <button
                        className="modal-btn modal-btn-primary"
                        onClick={() => onConfirm()}
                        disabled={!selected}
                    >
                        Ajouter
                    </button>
                </div>
            </>
        ) : null}
    </Modal>
);

export default AddCarrefourModal;
