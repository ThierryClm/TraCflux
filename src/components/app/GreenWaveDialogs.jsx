import CreateGreenWaveDialog from '../CreateGreenWaveDialog';
import GreenWaveViewer from '../GreenWaveViewer';

function OpenGreenWaveDialog({ dialog, tip }) {
    if (!dialog.isOpen) return null;

    return (
        <div className="modal-overlay" onClick={dialog.onClose}>
            <div className="modal-content open-greenwave-modal" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <h3>Ouvrir une onde verte</h3>
                    <button className="modal-close" onClick={dialog.onClose} aria-label="Fermer la fenêtre">×</button>
                </div>
                <div className="modal-body">
                    {dialog.savedGreenWaves.length > 0 ? (
                        <div className="project-list">
                            {dialog.savedGreenWaves.map((greenWave) => (
                                <div
                                    key={greenWave.name}
                                    className={`project-item ${dialog.selectedName === greenWave.name ? 'selected' : ''}`}
                                    onClick={() => dialog.onSelect(greenWave.name)}
                                    onDoubleClick={() => dialog.onOpen(greenWave.name)}
                                >
                                    <div className="project-icon green-wave-icon"></div>
                                    <div className="project-info">
                                        <span className="project-name">{greenWave.name}</span>
                                        <span className="project-details">
                                            {greenWave.intersections?.length || 0} carrefours • {greenWave.speedUp || greenWave.speed || 50} km/h
                                            {greenWave.savedAt && ` • ${dialog.formatDate(greenWave.savedAt)}`}
                                        </span>
                                    </div>
                                    <button
                                        className="btn-delete-item"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            dialog.onDelete(greenWave.name);
                                        }}
                                        title={tip('Supprimer')}
                                        aria-label={`Supprimer ${greenWave.name}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-projects">Aucune onde verte sauvegardée.</p>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={dialog.onClose}>Annuler</button>
                    <button className="btn-confirm" onClick={() => dialog.onOpen(dialog.selectedName)} disabled={!dialog.selectedName}>Ouvrir</button>
                </div>
            </div>
        </div>
    );
}

export default function GreenWaveDialogs({ openDialog, createDialog, viewer, tip }) {
    return (
        <>
            <OpenGreenWaveDialog dialog={openDialog} tip={tip} />
            <CreateGreenWaveDialog
                isOpen={createDialog.isOpen}
                onClose={createDialog.onClose}
                onConfirm={createDialog.onConfirm}
                getAllSaves={createDialog.getAllSaves}
                loadProjectData={createDialog.loadProjectData}
            />
            <GreenWaveViewer
                isOpen={viewer.isOpen}
                onClose={viewer.onClose}
                intersections={viewer.intersections}
            />
        </>
    );
}
