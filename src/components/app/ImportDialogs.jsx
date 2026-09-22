import Modal from '../Modal';

const fileInputStyle = {
    display: 'block',
    marginTop: '10px',
    padding: '10px',
    border: '1px dashed #555',
    borderRadius: '4px',
    backgroundColor: '#2a2a2a',
    color: '#ddd',
    cursor: 'pointer',
    width: '100%',
};

const formatInfoStyle = {
    color: '#888',
    fontSize: '0.8em',
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
};

function SpreadsheetImportDialog({ dialog, recent, tip }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Importer un fichier')}>
            {dialog.hintDirectory && (
                <div style={{ backgroundColor: '#2a3a2a', border: '1px solid #4a6a4a', borderRadius: '4px', padding: '10px', marginBottom: '15px', fontSize: '0.9em' }}>
                    <span style={{ color: '#8f8' }}>Répertoire suggéré :</span>
                    <div style={{ color: '#aaa', marginTop: '5px', wordBreak: 'break-all' }}>{dialog.hintDirectory}</div>
                </div>
            )}
            <div className="form-row">
                <label>
                    Sélectionner un fichier CSV ou Excel :
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={dialog.onFileSelect} style={fileInputStyle} />
                </label>
            </div>

            {recent.files.length > 0 && (
                <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '10px' }}>Fichiers récents (cliquez pour réimporter) :</h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '5px' }}>
                        {recent.files.map((file, index) => (
                            <button
                                type="button"
                                key={`${file.name}-${file.timestamp ?? index}`}
                                onClick={() => recent.onFileClick(file)}
                                className="recent-import-file"
                                style={{ display: 'block', width: '100%', padding: '8px 10px', margin: '2px 0', backgroundColor: '#2a2a2a', borderRadius: '3px', fontSize: '0.85em', cursor: 'pointer', border: 0, borderLeft: '3px solid #4a9eff', textAlign: 'left' }}
                            >
                                <div style={{ color: '#ddd', fontWeight: '500' }}>{file.name}</div>
                                <div style={{ color: '#888', fontSize: '0.9em', marginTop: '2px' }}>{recent.formatDate(file.timestamp)}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {recent.directories.length > 0 && (
                <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '10px' }}>Répertoires récents :</h4>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '5px' }}>
                        {recent.directories.map((directory) => (
                            <div key={directory} style={{ padding: '6px 10px', margin: '2px 0', backgroundColor: '#2a2a2a', borderRadius: '3px', fontSize: '0.8em', color: '#999', borderLeft: '3px solid #6a6a6a' }}>
                                {directory}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {dialog.file && <p style={{ color: '#8f8', fontSize: '0.9em', marginTop: '10px' }}>Fichier sélectionné : {dialog.file.name}</p>}
            {dialog.error && <p style={{ color: '#f66', fontSize: '0.9em', marginTop: '10px' }}>{dialog.error}</p>}
            <div style={formatInfoStyle}>
                <strong>Format supporté :</strong>
                <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
                    <li><strong>Excel (.xlsx/.xls)</strong> avec structure :
                        <ul style={{ marginTop: '5px', fontSize: '0.95em' }}>
                            <li>Feuille "Formulaire" : Configuration des groupes (A6, B6, C6, D6, E6... puis A8, B8, C8...)</li>
                            <li>6ème feuille : Matrice de dégagement</li>
                            <li>Feuilles 6, 7, 8... : Onglets PF1, PF2, PF3... (diagrammes et tableaux d'actions)</li>
                            <li>Feuille "Trafic" : Données de trafic (E6, E8, E10...)</li>
                        </ul>
                    </li>
                </ul>
            </div>
            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={dialog.onClose}>Annuler</button>
                <button className="modal-btn modal-btn-primary" onClick={dialog.onImport} disabled={!dialog.file}>OK</button>
            </div>
        </Modal>
    );
}

function HtmImportDialog({ dialog, tip }) {
    return (
        <Modal isOpen={dialog.isOpen} onClose={dialog.onClose} title={tip('Importer un fichier HTM')}>
            <div className="form-row">
                <label>
                    Sélectionner un fichier HTM :
                    <input type="file" accept=".htm,.html" onChange={dialog.onFileSelect} style={fileInputStyle} />
                </label>
            </div>
            {dialog.file && <p style={{ color: '#8f8', fontSize: '0.9em', marginTop: '10px' }}>Fichier sélectionné : {dialog.file.name}</p>}
            {dialog.error && <p style={{ color: '#f66', fontSize: '0.9em', marginTop: '10px' }}>{dialog.error}</p>}
            <div style={formatInfoStyle}>
                <strong>Format HTM attendu :</strong><br />
                <span style={{ fontSize: '0.9em' }}>Le fichier doit contenir un tableau avec les données des groupes de feu (nom, durée vert, orange, etc.)</span>
            </div>
            <div className="modal-actions">
                <button className="modal-btn modal-btn-secondary" onClick={dialog.onClose}>Annuler</button>
                <button className="modal-btn modal-btn-primary" onClick={dialog.onImport} disabled={!dialog.file}>Importer et ouvrir</button>
            </div>
        </Modal>
    );
}

export default function ImportDialogs({ spreadsheet, html, recent, tip }) {
    return (
        <>
            <SpreadsheetImportDialog dialog={spreadsheet} recent={recent} tip={tip} />
            <HtmImportDialog dialog={html} tip={tip} />
        </>
    );
}
