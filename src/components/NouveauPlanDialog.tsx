import { useState } from 'react';
import Modal from './Modal';

export interface NouveauPlanDialogProps {
    isOpen: boolean;
    onClose: () => void;
    planName: string;
    /** Jeux de trafic qui contiennent déjà des données. */
    jeuxAvecDonnees: string[];
    jeuActif: string;
    /** Associe le jeu choisi au nouveau plan. */
    onAssocier: (jeu: string) => void;
    onSuggererCycle: () => void;
    onOuvrirTrafic: () => void;
}

/**
 * Après « Diagramme → Nouveau plan de feu… » : propose le jeu de trafic du
 * nouveau plan, ou invite à saisir le trafic quand il n'y en a encore aucun.
 * Première étape de l'assistant ; la suivante est la suggestion de cycle.
 */
const NouveauPlanDialog = ({
    isOpen, onClose, planName, jeuxAvecDonnees, jeuActif, onAssocier, onSuggererCycle, onOuvrirTrafic,
}: NouveauPlanDialogProps) => {
    const defaut = jeuxAvecDonnees.includes(jeuActif) ? jeuActif : (jeuxAvecDonnees[0] ?? '');
    const [jeu, setJeu] = useState(defaut);
    // Jeu déjà associé depuis l'ouverture : la fenêtre reste ouverte pour
    // enchaîner sur la suggestion de cycle, ou pour être fermée.
    const [associe, setAssocie] = useState<string | null>(null);
    const [ouverte, setOuverte] = useState(isOpen);
    if (ouverte !== isOpen) {
        setOuverte(isOpen);
        if (isOpen) { setJeu(defaut); setAssocie(null); }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale className="nouveau-plan" title={`Nouveau plan de feu — ${planName}`}>
            <p style={{ marginTop: 0 }}>
                Le plan <b>{planName}</b> est créé, avec les mêmes groupes et la même matrice : les verts (Déb, Fin),
                les DA, les conditions et les variables micro sont vides.
            </p>
            {jeuxAvecDonnees.length > 0 ? (
                <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Jeu de trafic de ce plan :
                        <select value={jeu} onChange={e => setJeu(e.target.value)} aria-label="Jeu de trafic du nouveau plan">
                            {jeuxAvecDonnees.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <p className="sc-note" style={{ fontSize: '0.85em', opacity: 0.8 }}>
                        {associe === jeu
                            ? <>Jeu <b>{jeu}</b> associé au plan. Étape suivante : la suggestion de durée du cycle.</>
                            : 'Étape suivante : la suggestion de durée du cycle, à partir de ce trafic et des groupes déterminants de chaque phase.'}
                    </p>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={onClose}>Fermer</button>
                        <button className="modal-btn modal-btn-secondary" disabled={associe === jeu}
                            onClick={() => { onAssocier(jeu); setAssocie(jeu); }}>
                            Associer ce jeu
                        </button>
                        <button className="modal-btn modal-btn-primary" onClick={() => { if (associe !== jeu) onAssocier(jeu); onClose(); onSuggererCycle(); }}>
                            {associe === jeu ? 'Suggérer le cycle…' : 'Associer et suggérer le cycle…'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p>
                        Aucune donnée de trafic n'est encore saisie. Renseignez les débits dans l'onglet <b>Trafic</b> :
                        l'« Assistant conception » (menu Diagramme) s'en servira.
                    </p>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn-secondary" onClick={onClose}>Plus tard</button>
                        <button className="modal-btn modal-btn-primary" onClick={() => { onClose(); onOuvrirTrafic(); }}>Ouvrir l'onglet Trafic</button>
                    </div>
                </>
            )}
        </Modal>
    );
};

export default NouveauPlanDialog;
