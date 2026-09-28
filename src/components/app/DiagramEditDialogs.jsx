import Modal from '../Modal';

function DialogActions({ onClose, confirmLabel, onConfirm, disabled }) {
    return (
        <div className="modal-actions">
            <button className="modal-btn modal-btn-secondary" onClick={onClose}>
                Annuler
            </button>
            <button className="modal-btn modal-btn-primary" onClick={onConfirm} disabled={disabled}>
                {confirmLabel}
            </button>
        </div>
    );
}

function SlideDialog({ groups, tip, dialog }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Glisser le diagramme')} overlayClassName="modal-menu-overlay modal-compact-overlay">
            <div className="form-row">
                <label>
                    Du groupe :
                    <select value={dialog.fromGroup} onChange={(event) => dialog.onFromGroupChange(parseInt(event.target.value))} style={{ marginLeft: '10px', padding: '5px' }} title={tip('Premier groupe de la plage à décaler')}>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name || `Groupe ${group.id}`}</option>)}
                    </select>
                </label>
            </div>
            <div className="form-row">
                <label>
                    Au groupe :
                    <select value={dialog.toGroup} onChange={(event) => dialog.onToGroupChange(parseInt(event.target.value))} style={{ marginLeft: '10px', padding: '5px' }} title={tip('Dernier groupe de la plage à décaler')}>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name || `Groupe ${group.id}`}</option>)}
                    </select>
                </label>
            </div>
            <div className="form-row">
                <label>
                    Décalage (secondes) :
                    <input type="number" value={dialog.value} onChange={(event) => dialog.onValueChange(parseInt(event.target.value) || 0)} title={tip('Positif : décale vers la droite / Négatif : décale vers la gauche')} />
                </label>
            </div>
            <DialogActions onClose={dialog.onClose} confirmLabel="Appliquer" onConfirm={dialog.onConfirm} disabled={!dialog.touched} />
        </Modal>
    );
}

function InsertDialog({ cycleLength, tip, dialog }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Insérer une plage')} overlayClassName="modal-menu-overlay modal-compact-overlay">
            <div className="form-row">
                <label>
                    À partir de la seconde :
                    <input type="number" min="0" max={cycleLength} value={dialog.start} onChange={(event) => dialog.onStartChange(parseInt(event.target.value) || 0)} title={tip(`Les groupes après cette seconde seront décalés. Cycle: ${cycleLength}s`)} />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Durée à insérer (s) :
                    <input type="number" min="1" value={dialog.duration} onChange={(event) => dialog.onDurationChange(parseInt(event.target.value) || 1)} title={tip(`Le cycle passera de ${cycleLength}s à ${cycleLength + dialog.duration}s`)} />
                </label>
            </div>
            <DialogActions onClose={dialog.onClose} confirmLabel="Insérer" onConfirm={dialog.onConfirm} disabled={!dialog.touched} />
        </Modal>
    );
}

function ReduceDialog({ cycleLength, tip, dialog }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Réduire une plage')} overlayClassName="modal-menu-overlay modal-compact-overlay">
            <div className="form-row">
                <label>
                    À partir de la seconde :
                    <input type="number" min="0" max={cycleLength - 1} value={dialog.start} onChange={(event) => dialog.onStartChange(parseInt(event.target.value) || 0)} title={tip(`Les groupes après cette position seront décalés. Cycle: ${cycleLength}s`)} />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Durée à supprimer (s) :
                    <input type="number" min="1" max={cycleLength - dialog.start} value={dialog.duration} onChange={(event) => dialog.onDurationChange(parseInt(event.target.value) || 1)} title={tip(`Le cycle passera de ${cycleLength}s à ${Math.max(1, cycleLength - dialog.duration)}s`)} />
                </label>
            </div>
            <DialogActions onClose={dialog.onClose} confirmLabel="Réduire" onConfirm={dialog.onConfirm} disabled={!dialog.touched} />
        </Modal>
    );
}

function MoveGroupDialog({ groups, tip, dialog }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Déplacer un groupe de feu')} overlayClassName="modal-menu-overlay modal-compact-overlay">
            <div className="form-row">
                <label>
                    Groupe à déplacer :
                    <select value={dialog.groupId} onChange={(event) => dialog.onGroupChange(event.target.value)} style={{ marginLeft: '10px', padding: '5px' }} title={tip('Sélectionnez le groupe à repositionner')}>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name || `Groupe ${group.id}`}</option>)}
                    </select>
                </label>
            </div>
            <div className="form-row">
                <label>
                    Insérer après :
                    <select value={dialog.afterGroupId} onChange={(event) => dialog.onAfterGroupChange(event.target.value)} style={{ marginLeft: '10px', padding: '5px' }} title={tip('Met à jour la matrice, le diagramme et le tableau des actions')}>
                        <option value="0">Au début (première position)</option>
                        {groups.filter((group) => group.id.toString() !== dialog.groupId).map((group) => <option key={group.id} value={group.id}>{group.name || `Groupe ${group.id}`}</option>)}
                    </select>
                </label>
            </div>
            <DialogActions onClose={dialog.onClose} confirmLabel="Déplacer" onConfirm={dialog.onConfirm} disabled={!dialog.touched} />
        </Modal>
    );
}

function BiCarrefourDialog({ groups, tip, dialog }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Intégrer un bi-Carrefour')} overlayClassName="modal-menu-overlay modal-compact-overlay">
            <div className="form-row">
                <label>
                    Séparation après le groupe :
                    <select value={dialog.groupId} onChange={(event) => dialog.onGroupChange(event.target.value)} style={{ marginLeft: '10px', padding: '5px' }} title={tip('Une ligne de séparation sera affichée dans la matrice et le diagramme après ce groupe')}>
                        {groups.slice(0, -1).map((group) => <option key={group.id} value={group.id}>{group.name || `Groupe ${group.id}`}</option>)}
                    </select>
                </label>
            </div>
            <DialogActions onClose={dialog.onClose} confirmLabel="OK" onConfirm={dialog.onConfirm} disabled={!dialog.touched} />
        </Modal>
    );
}

export default function DiagramEditDialogs({ groups, cycleLength, tip, slide, insert, reduce, moveGroup, biCarrefour }) {
    return (
        <>
            <SlideDialog groups={groups} tip={tip} dialog={slide} />
            <InsertDialog cycleLength={cycleLength} tip={tip} dialog={insert} />
            <ReduceDialog cycleLength={cycleLength} tip={tip} dialog={reduce} />
            <MoveGroupDialog groups={groups} tip={tip} dialog={moveGroup} />
            <BiCarrefourDialog groups={groups} tip={tip} dialog={biCarrefour} />
        </>
    );
}
