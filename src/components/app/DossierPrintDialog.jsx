function DossierPrintDialog({
    isOpen,
    onClose,
    portrait,
    setPortrait,
    sections,
    setSections,
    plans,
    simulationResult,
    intersectionImage,
    intersectionArrows,
    onExportPdf,
    onPrint,
    tip,
}) {
    const dossierDialog = isOpen;
    const setDossierDialog = (visible) => { if (!visible) onClose(); };
    const dossierPortrait = portrait;
    const setDossierPortrait = setPortrait;
    const dossierSections = sections;
    const setDossierSections = setSections;
    const pfTabs = plans;
    const simulationResultImpression = simulationResult;
    const handleDossierExportPDF = onExportPdf;
    const handleDossierConfirm = onPrint;

    return (
        <>
            {/* Dialog sélection sections dossier */}
            {dossierDialog && (
                <div className="modal-overlay modal-menu-overlay" onClick={() => setDossierDialog(false)}>
                    <div className="modal-content dossier-dialog" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Imprimer le dossier</h3>
                            <button className="modal-close" onClick={() => setDossierDialog(false)} aria-label="Fermer la fenêtre">&times;</button>
                        </div>
                        <div className="dossier-dialog-body">
                            {/* Orientation de la feuille. Le paysage reste par défaut : c'est
                                lui qui donne au diagramme la largeur d'un cycle long. */}
                            <div className="dossier-orientation">
                                <span className="dossier-orientation-titre">Format</span>
                                <div className="dossier-orientation-choix">
                                    <button
                                        type="button"
                                        className={!dossierPortrait ? 'actif' : ''}
                                        onClick={() => setDossierPortrait(false)}
                                        title={tip("A4 paysage : 277 mm utiles, la largeur qu'exige un diagramme de cycle long.")}
                                    >Paysage</button>
                                    <button
                                        type="button"
                                        className={dossierPortrait ? 'actif' : ''}
                                        onClick={() => setDossierPortrait(true)}
                                        title={tip("A4 portrait : 190 mm utiles seulement, mais 280 mm de hauteur pour les tableaux.")}
                                    >Portrait</button>
                                </div>
                            </div>
                            <label>
                                <input type="checkbox" checked={dossierSections.image || false}
                                    onChange={e => setDossierSections(s => ({...s, image: e.target.checked}))} />
                                Image du carrefour
                            </label>
                            {dossierSections.image && intersectionArrows.length > 0 && (
                            <label className="dossier-checkbox-indent">
                                <input type="checkbox" checked={dossierSections.gfNumbers || false}
                                    onChange={e => setDossierSections(s => ({...s, gfNumbers: e.target.checked}))} />
                                Numéro des groupes de feu
                            </label>
                            )}
                            <label>
                                <input type="checkbox" checked={dossierSections.formulaire || false}
                                    onChange={e => setDossierSections(s => ({...s, formulaire: e.target.checked}))} />
                                Formulaire
                            </label>
                            <label>
                                <input type="checkbox" checked={dossierSections.securiteMatrix || false}
                                    onChange={e => setDossierSections(s => ({...s, securiteMatrix: e.target.checked}))} />
                                Matrice de sécurité
                            </label>
                            <label>
                                <input type="checkbox" checked={dossierSections.matrice || false}
                                    onChange={e => setDossierSections(s => ({...s, matrice: e.target.checked}))} />
                                Matrice des temps intervers
                            </label>
                            <label>
                                <input type="checkbox" checked={dossierSections.legende || false}
                                    onChange={e => setDossierSections(s => ({...s, legende: e.target.checked}))} />
                                Légende
                            </label>
                            {pfTabs.map(pf => {
                                const isValidated = pf.color === '#4CAF50';
                                const isInvalidated = pf.color === '#e74c3c';
                                const pfChecked = dossierSections[`diagram_${pf.id}`] || false;
                                return (
                                <div key={pf.id} className="dossier-pf-group">
                                    <label className={isValidated ? 'dossier-pf-validated' : isInvalidated ? 'dossier-pf-invalidated' : ''}>
                                        <input type="checkbox" checked={pfChecked}
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setDossierSections(s => ({
                                                    ...s,
                                                    [`diagram_${pf.id}`]: checked,
                                                    [`conditionsMicro_${pf.id}`]: checked,
                                                    [`variablesMicro_${pf.id}`]: checked,
                                                    [`phasageBulle_${pf.id}`]: checked,
                                                    [`traficCapacite_${pf.id}`]: checked,
                                                    [`reserveCapacite_${pf.id}`]: checked,
                                                }));
                                            }} />
                                        Diagramme {pf.name}
                                    </label>
                                    {pfChecked && (
                                    <div className="dossier-pf-suboptions">
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`conditionsMicro_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`conditionsMicro_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`conditionsMicro_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Conditions de micro-régulation
                                        </label>
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`variablesMicro_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`variablesMicro_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`variablesMicro_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Variables micro
                                        </label>
                                        {intersectionArrows.length > 0 && intersectionImage && (
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`phasageBulle_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`phasageBulle_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`phasageBulle_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Phasage bulle
                                        </label>
                                        )}
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`traficCapacite_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`traficCapacite_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`traficCapacite_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Données de trafic et calcul de capacité
                                        </label>
                                        <label>
                                            <input type="checkbox" checked={dossierSections[`reserveCapacite_${pf.id}`] || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => {
                                                    if (v) return {...s, [`reserveCapacite_${pf.id}`]: true};
                                                    const u = {...s}; pfTabs.forEach(p => { if (s[`diagram_${p.id}`]) u[`reserveCapacite_${p.id}`] = false; }); return u;
                                                }); }} />
                                            Réserve de capacité
                                        </label>
                                    </div>
                                    )}
                                </div>
                                );
                            })}
                            {/* Simulation — le diagramme tel que la simulation le recalcule.
                                Un scénario nommé sur le plan actif coche la case à
                                l'ouverture de cette boîte : l'avoir nommé vaut intention de
                                l'imprimer. Sans aucune action cochée il n'y a rien à
                                imprimer ; la case reste alors visible mais inerte, avec la
                                raison en infobulle, plutôt que de disparaître de la liste. */}
                            {(() => {
                                const simDispo = !!simulationResultImpression;
                                const simCochee = (dossierSections.simulation || false) && simDispo;
                                return (
                            <div className="dossier-pf-group">
                                <label
                                    className={simDispo ? '' : 'dossier-option-indisponible'}
                                    title={tip(simDispo
                                        ? "Imprime le diagramme recalculé par le scénario du plan actif, avec son cycle simulé."
                                        : "Cochez des actions dans l'onglet Simulation pour pouvoir inclure un scénario.")}
                                >
                                    <input type="checkbox" checked={simCochee} disabled={!simDispo}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setDossierSections(s => ({
                                                ...s,
                                                simulation: checked,
                                                simulationActions: checked,
                                                simulationConflits: checked,
                                                simulationTrafic: checked,
                                                simulationReserve: checked,
                                            }));
                                        }} />
                                    Scénario
                                </label>
                                {simCochee && (
                                <div className="dossier-pf-suboptions">
                                    <label>
                                        <input type="checkbox" checked={dossierSections.simulationActions || false}
                                            onChange={e => { const v = e.target.checked; setDossierSections(s => ({...s, simulationActions: v})); }} />
                                        Liste des actions
                                    </label>
                                    <label>
                                        <input type="checkbox" checked={dossierSections.simulationConflits || false}
                                            onChange={e => { const v = e.target.checked; setDossierSections(s => ({...s, simulationConflits: v})); }} />
                                        Liste des conflits
                                    </label>
                                    <label>
                                        <input type="checkbox" checked={dossierSections.simulationTrafic || false}
                                            onChange={e => { const v = e.target.checked; setDossierSections(s => ({...s, simulationTrafic: v})); }} />
                                        Données de trafic et calcul de capacité
                                    </label>
                                    <label>
                                        <input type="checkbox" checked={dossierSections.simulationReserve || false}
                                            onChange={e => { const v = e.target.checked; setDossierSections(s => ({...s, simulationReserve: v})); }} />
                                        Réserve de capacité
                                    </label>
                                </div>
                                )}
                            </div>
                                );
                            })()}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setDossierDialog(false)}>Annuler</button>
                            <button className="btn-confirm" onClick={handleDossierExportPDF}>Exporter PDF</button>
                            <button className="btn-confirm" onClick={handleDossierConfirm}>Imprimer</button>
                        </div>
                    </div>
                </div>
            )}


        </>
    );
}

export default DossierPrintDialog;
