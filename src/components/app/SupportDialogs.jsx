import Modal from '../Modal';
import MicroVariablesDialog from '../MicroVariablesDialog';
import HelpContent from '../HelpContent';
import { APP_VERSION, APP_NAME, APP_DESCRIPTION } from '../../version';
import {
    buildDiagnosticReport,
    downloadDiagnosticReport,
    buildErrorJournal,
    buildDiagnosticJSON,
    downloadDiagnosticJSON,
} from '../../utils/diagnostics';
import { getInterceptedEntries, clearInterceptedEntries } from '../../utils/errorInterceptor';
import { toast } from '../../utils/toast';

export default function SupportDialogs({ model }) {
    const {
        aboutModal, actionData, activePFId, activePfReadOnly, conflictMatrix,
        cycleLength, diagnosticIncludeProject, diagnosticMaskNames, diagnosticModal, diagnosticRefresh,
        dossierReadOnly, groups, helpAnchor, helpModal, imageNaturalDims,
        intersectionImage, intersectionName, matricesLocked, microVariablesModal, optionsModal,
        pfTabs, projectName, setAboutModal, setDiagnosticIncludeProject, setDiagnosticMaskNames,
        setDiagnosticModal, setDiagnosticRefresh, setHelpModal, setMicroVariablesModal, setOptionsModal,
        tip, tooltipPrefs,
    } = model;
    return (
        <>
            {/* Fenêtre « Variables Priorité Bus » (référence éditable, persistée) */}
            <MicroVariablesDialog
                isOpen={microVariablesModal}
                onClose={() => setMicroVariablesModal(false)}
                tooltipsEnabled={tooltipPrefs.main}
            />

            {/* Modal Options - Légende des actions */}
            <Modal isOpen={optionsModal} onClose={() => setOptionsModal(false)} title={tip("Options - Légende des actions")}>
                <div className="legend-container">
                    <div className="legend-item">
                        <div className="legend-preview legend-adaptatif"></div>
                        <span>Adaptatif vertical</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-escamotage"></div>
                        <span>Escamotage de phase</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-ouverture"></div>
                        <span>Ouverture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-fermeture"></div>
                        <span>Fermeture anticipée</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-signa">
                            <div className="legend-signa-orange"></div>
                            <div className="legend-signa-blue"></div>
                        </div>
                        <span>Signal aide conduite</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-debut"></div>
                        <span>Début de bande passante</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-preview legend-bande-fin"></div>
                        <span>Fin de bande passante</span>
                    </div>
                </div>
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button className="modal-btn modal-btn-primary" onClick={() => setOptionsModal(false)}>
                        Fermer
                    </button>
                </div>
            </Modal>

            {/* Modal Aide en ligne */}
            <Modal isOpen={helpModal} onClose={() => setHelpModal(false)} title={tip("Aide - TraCflux")} className="modal-wide">
                <HelpContent initialAnchor={helpAnchor} />
            </Modal>

            {/* Comparateur de capacité : rendu dans une fenêtre détachée
                (usePopupWindow ci-dessus), non modale et déplaçable. */}

            {/* Modal À propos */}
            <Modal isOpen={aboutModal} onClose={() => setAboutModal(false)} title={tip(`À propos — ${APP_NAME}`)}>
                <div style={{ padding: '10px 4px', textAlign: 'center', position: 'relative' }}>
                    <img
                        src="./logo.svg"
                        alt=""
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '8px',
                            width: '80px',
                            height: '80px',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                    />
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '8px' }}>
                        {APP_NAME}
                    </div>
                    <div style={{ fontSize: '1.1em', color: '#aaa', marginBottom: '4px' }}>
                        Version {APP_VERSION}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                        {APP_DESCRIPTION}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '16px 0' }} />
                    <div style={{ fontSize: '0.85em', color: '#888', lineHeight: '1.6' }}>
                        <div>Développée avec <strong>React</strong> + <strong>Vite</strong></div>
                        <div style={{ marginTop: '8px' }}>© 2026 Thierry Colmon</div>
                        <div style={{ marginTop: '12px' }}>
                            Licence{' '}
                            <a
                                href="https://www.gnu.org/licenses/agpl-3.0.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#4ecdc4' }}
                            >
                                GNU AGPL v3
                            </a>
                        </div>
                        <div style={{ marginTop: '4px' }}>
                            Code source :{' '}
                            <a
                                href="https://github.com/ThierryClm/TraCflux"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#4ecdc4' }}
                            >
                                github.com/ThierryClm/TraCflux
                            </a>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal Rapport de diagnostic */}
            <Modal isOpen={diagnosticModal} onClose={() => setDiagnosticModal(false)} title={tip("Rapport de diagnostic")} className="modal-wide">
                {(() => {
                    // diagnosticRefresh is read here so the modal re-renders when the journal is cleared
                    void diagnosticRefresh;
                    const report = buildDiagnosticReport({
                        intersectionName,
                        projectName,
                        groups,
                        pfTabs,
                        activePFId,
                        cycleLength,
                        actionData,
                        conflictMatrix,
                        intersectionImage,
                        imageNaturalDims,
                        dossierReadOnly,
                        activePfReadOnly,
                        matricesLocked,
                        includeProject: diagnosticIncludeProject,
                        maskNames: diagnosticMaskNames
                    });
                    const journalEntries = getInterceptedEntries();
                    const journalCount = journalEntries.length;
                    const hasErrors = journalEntries.some(e => e.type === 'error' || e.type === 'runtime' || e.type === 'promise');
                    return (
                        <div style={{ padding: '8px 4px' }}>
                            <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '12px' }}>
                                Ce rapport contient des informations techniques utiles pour signaler un bug.
                                Aucune donnée n'est envoyée — le contenu reste sur votre poste. Vous pouvez le
                                copier dans le presse-papiers ou le télécharger comme fichier texte.
                                {' '}<strong>Une issue GitHub est publique</strong> : les noms de projet
                                et de carrefour sont masqués par défaut, car ils désignent une commune
                                et des rues réelles.
                            </div>
                            <div style={{
                                fontSize: '0.85em',
                                marginBottom: '10px',
                                padding: '6px 10px',
                                background: hasErrors ? '#3a2020' : journalCount > 0 ? '#3a3320' : '#203a20',
                                border: `1px solid ${hasErrors ? '#8a4a4a' : journalCount > 0 ? '#8a8a4a' : '#4a8a4a'}`,
                                borderRadius: '4px',
                                color: '#e0e0e0'
                            }}>
                                Journal d'erreurs : <strong>{journalCount}</strong> entrée(s) interceptée(s) depuis l'ouverture de l'application.
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={diagnosticIncludeProject}
                                    onChange={(e) => setDiagnosticIncludeProject(e.target.checked)}
                                />
                                Inclure le projet en cours (données détaillées — ne pas partager si sensibles)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={diagnosticMaskNames}
                                    onChange={(e) => setDiagnosticMaskNames(e.target.checked)}
                                />
                                Masquer les noms de projet et de carrefour (recommandé pour une issue publique)
                            </label>
                            <textarea
                                readOnly
                                value={report}
                                style={{
                                    width: '100%',
                                    height: '360px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    background: '#1a1a2e',
                                    color: '#e0e0e0',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    resize: 'vertical'
                                }}
                            />
                            <div className="modal-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    onClick={() => setDiagnosticModal(false)}
                                >
                                    Fermer
                                </button>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    disabled={journalCount === 0}
                                    title={tip(journalCount === 0 ? 'Aucune entrée à copier' : 'Copier uniquement le journal d\'erreurs')}
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(buildErrorJournal());
                                            toast.success(`Journal copié (${journalCount} entrée${journalCount > 1 ? 's' : ''})`);
                                        } catch (e) {
                                            toast.error('Copie impossible : ' + e.message);
                                        }
                                    }}
                                >
                                    Copier le journal ({journalCount})
                                </button>
                                <button
                                    className="modal-btn modal-btn-secondary"
                                    disabled={journalCount === 0}
                                    title={tip(journalCount === 0 ? 'Journal déjà vide' : 'Vider le journal — utile pour repartir propre avant de reproduire un bug')}
                                    onClick={() => {
                                        const n = journalCount;
                                        clearInterceptedEntries();
                                        setDiagnosticRefresh(v => v + 1);
                                        toast.success(`Journal vidé (${n} entrée${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''})`);
                                    }}
                                >
                                    Vider le journal
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(report);
                                            toast.success('Rapport copié dans le presse-papiers');
                                        } catch (e) {
                                            toast.error('Copie impossible : ' + e.message);
                                        }
                                    }}
                                >
                                    Copier le rapport
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    onClick={() => {
                                        downloadDiagnosticReport(report, 'diagnostic');
                                        toast.success('Rapport téléchargé (.txt)');
                                    }}
                                >
                                    Télécharger .txt
                                </button>
                                <button
                                    className="modal-btn modal-btn-primary"
                                    title={tip("Version structurée (JSON) — plus facile à parser ou analyser")}
                                    onClick={() => {
                                        const obj = buildDiagnosticJSON({
                                            intersectionName,
                                            projectName,
                                            groups,
                                            pfTabs,
                                            activePFId,
                                            cycleLength,
                                            actionData,
                                            conflictMatrix,
                                            intersectionImage,
                                            imageNaturalDims,
                                            dossierReadOnly,
                                            activePfReadOnly,
                                            matricesLocked,
                                            includeProject: diagnosticIncludeProject,
                                            maskNames: diagnosticMaskNames
                                        });
                                        downloadDiagnosticJSON(obj, 'diagnostic');
                                        toast.success('Rapport téléchargé (.json)');
                                    }}
                                >
                                    Télécharger .json
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>


        </>
    );
}
