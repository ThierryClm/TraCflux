import type { Dispatch, SetStateAction } from 'react';
import {
    OPTIONS_SCENARIO, cleScenarioImpression, scenariosAImprimer, scenariosDuPlan,
    planImprime, calculerScenario, optionScenario
} from '../../simulation';
import type { ActionMicro, Groupe, Matrice, PlanDeFeu } from '../../types/projet';
import { commentairesDuPlan, imprimerCommentaires, imprimerRemarques, remarquesRenseignees } from '../../utils/commentairesPlan';

type DossierSections = Record<string, boolean>;

/** De quoi recalculer un scénario, pour son résumé dans la liste. */
interface ContexteScenarios {
    activePFId: number;
    groups: Groupe[];
    cycleLength: number;
    actionData: ActionMicro[];
    conflictMatrix: Matrice;
}

interface DossierPrintDialogProps {
    isOpen: boolean;
    onClose: () => void;
    portrait: boolean;
    setPortrait: (value: boolean) => void;
    sections: DossierSections;
    setSections: Dispatch<SetStateAction<DossierSections>>;
    plans: PlanDeFeu[];
    contexteScenarios: ContexteScenarios;
    intersectionImage: string | null;
    intersectionArrows: unknown[];
    onExportPdf: () => void;
    onPrint: () => void;
    tip: (label: string) => string | undefined | undefined;
}

function DossierPrintDialog({
    isOpen,
    onClose,
    portrait,
    setPortrait,
    sections,
    setSections,
    plans,
    contexteScenarios,
    intersectionImage,
    intersectionArrows,
    onExportPdf,
    onPrint,
    tip,
}: DossierPrintDialogProps) {
    const dossierDialog = isOpen;
    const setDossierDialog = (visible: boolean) => { if (!visible) onClose(); };
    const dossierPortrait = portrait;
    const setDossierPortrait = setPortrait;
    const dossierSections = sections;
    const setDossierSections = setSections;
    const pfTabs = plans;

    // Les scénarios enregistrés, plan par plan — « Tout coché » et « Tout
    // décoché » n'en sont pas : ils ne s'impriment pas.
    const plansAvecScenarios = pfTabs
        .map(pf => ({ pf, scenarios: scenariosDuPlan(pf) }))
        .filter(p => p.scenarios.length > 0);
    const plansSansScenario = pfTabs.filter(pf => scenariosDuPlan(pf).length === 0);
    /** Les scénarios cochés, plan par plan, tels que l'aperçu les imprimera. */
    const coches = new Set(plansAvecScenarios.flatMap(({ pf }) =>
        scenariosAImprimer(dossierSections, pf, contexteScenarios.activePFId)
            .map(sc => cleScenarioImpression(pf.id, sc.nom))));
    const toutesLesCles = plansAvecScenarios.flatMap(({ pf, scenarios }) =>
        scenarios.map(sc => cleScenarioImpression(pf.id, sc.nom)));

    // Chaque case s'écrit avec toutes les autres : un dossier d'avant
    // l'impression multi-scénario n'a qu'une case globale, que l'aperçu lit
    // comme le scénario choisi du plan actif ; la première case touchée fige
    // cette lecture en choix explicites.
    const ecrireCoches = (nouvelles: Set<string>) => setDossierSections(s => ({
        ...s,
        ...Object.fromEntries(toutesLesCles.map(cle => [cle, nouvelles.has(cle)])),
        simulation: nouvelles.size > 0
    }));
    const basculerScenario = (cle: string) => {
        const nouvelles = new Set(coches);
        if (nouvelles.has(cle)) nouvelles.delete(cle); else nouvelles.add(cle);
        ecrireCoches(nouvelles);
    };

    const resumeScenario = (pf: PlanDeFeu, sc: { nom: string; actions: number[] }) => {
        const plan = planImprime(pf, contexteScenarios);
        const c = calculerScenario(sc, plan, contexteScenarios.conflictMatrix);
        const ecart = c.cycleSimule - plan.cycleLength;
        return `${c.actions.length} action${c.actions.length > 1 ? 's' : ''} · ${c.cycleSimule} s${ecart ? ` (${ecart > 0 ? '+' : '−'}${Math.abs(ecart)} s)` : ''}`;
    };
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
                                                    [`commentaires_${pf.id}`]: checked,
                                                    [`remarques_${pf.id}`]: checked,
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
                                        {/* Commentaires des groupes et remarques du plan : proposés
                                            seulement quand le plan en a. */}
                                        {commentairesDuPlan(pf, contexteScenarios).length > 0 && (
                                        <label>
                                            <input type="checkbox" checked={imprimerCommentaires(dossierSections, pf.id)}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => ({ ...s, [`commentaires_${pf.id}`]: v })); }} />
                                            Commentaires
                                        </label>
                                        )}
                                        {remarquesRenseignees(pf) && (
                                        <label>
                                            <input type="checkbox" checked={imprimerRemarques(dossierSections, pf.id)}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => ({ ...s, [`remarques_${pf.id}`]: v })); }} />
                                            Remarques
                                        </label>
                                        )}
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
                            {/* Scénarios — les scénarios enregistrés de chaque plan, chacun
                                recalculé sur son plan. Ils s'impriment à la suite de leur plan
                                de feu, avec les mêmes options de contenu pour tous, et une page
                                de comparaison par plan. Sans aucun scénario enregistré, la case
                                reste visible mais inerte, avec la raison en infobulle. */}
                            <div className="dossier-pf-group dossier-scenarios">
                                <label
                                    className={plansAvecScenarios.length ? '' : 'dossier-option-indisponible'}
                                    title={tip(plansAvecScenarios.length
                                        ? "Coche ou décoche tous les scénarios. Chacun s'imprime à la suite de son plan de feu, recalculé d'après sa version enregistrée."
                                        : "Enregistre des scénarios dans l'onglet Simulation pour pouvoir les imprimer.")}
                                >
                                    <input type="checkbox" checked={coches.size > 0} disabled={!plansAvecScenarios.length}
                                        onChange={e => ecrireCoches(e.target.checked ? new Set(toutesLesCles) : new Set())} />
                                    Scénarios
                                </label>
                                {plansAvecScenarios.length > 0 && (
                                <div className="dossier-pf-suboptions">
                                    {plansAvecScenarios.map(({ pf, scenarios }) => (
                                        <div key={pf.id} className="dossier-scenarios-plan">
                                            <div className="dossier-scenarios-plan-nom">{pf.name}</div>
                                            {scenarios.map(sc => {
                                                const cle = cleScenarioImpression(pf.id, sc.nom);
                                                return (
                                                    <label key={cle} className="dossier-scenario-ligne">
                                                        <input type="checkbox" checked={coches.has(cle)}
                                                            onChange={() => basculerScenario(cle)} />
                                                        <span className="dossier-scenario-nom">{sc.nom}</span>
                                                        <span className="dossier-scenario-resume">{resumeScenario(pf, sc)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {plansSansScenario.length > 0 && (
                                        <div className="dossier-scenarios-aucun">
                                            {plansSansScenario.map(pf => pf.name).join(', ')} : aucun scénario enregistré
                                        </div>
                                    )}
                                    {coches.size > 0 && (<>
                                        <div className="dossier-scenarios-titre">Pour chaque scénario coché</div>
                                        {OPTIONS_SCENARIO.map(([cle, libelle]) => (
                                            <label key={cle}>
                                                <input type="checkbox" checked={optionScenario(dossierSections, cle)}
                                                    onChange={e => { const v = e.target.checked; setDossierSections(s => ({ ...s, [cle]: v })); }} />
                                                {libelle}
                                            </label>
                                        ))}
                                        <label className="dossier-scenarios-comparatif"
                                            title={tip("Une page par plan de feu : une ligne par scénario coché, la première rappelant le plan nominal — cycle, conflits, courant dimensionnant, degré de saturation et réserve.")}>
                                            <input type="checkbox" checked={dossierSections.simulationComparatif || false}
                                                onChange={e => { const v = e.target.checked; setDossierSections(s => ({ ...s, simulationComparatif: v })); }} />
                                            Tableau comparatif des scénarios
                                        </label>
                                    </>)}
                                </div>
                                )}
                            </div>
                            {/* Comparateur de capacité : le tableau tel que réglé dans sa
                                fenêtre — plans, scénarios, jeu de trafic et V.Utile —, en fin
                                de dossier. */}
                            <label title={tip("Le tableau du comparateur de capacité, avec les plans de feu, scénarios, jeu de trafic et colonnes choisis dans sa fenêtre (menu Diagramme → Capacité des plans de feu).")}>
                                <input type="checkbox" checked={dossierSections.comparateurCapacite || false}
                                    onChange={e => { const v = e.target.checked; setDossierSections(s => ({ ...s, comparateurCapacite: v })); }} />
                                Capacité des plans de feu et scénarios
                            </label>
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
