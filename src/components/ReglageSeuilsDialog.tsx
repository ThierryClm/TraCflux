import { useEffect, useState } from 'react';
import Modal from './Modal';
import { SEUILS_ANALYSE_DEFAUT } from '../utils/seuilsAnalyse';
import type { SeuilsAnalyse } from '../utils/seuilsAnalyse';
import './ReglageSeuilsDialog.css';

export const TITRE_REGLAGE_SEUILS = 'Réglage des seuils de l\'analyse';
const INFOBULLE_TITRE_SEUILS = 'Seuil enregistré au niveau application. Si l\'on modifie une valeur de seuil, cela régénère l\'analyse du diagramme si la fenêtre est ouverte.';

interface ReglageSeuilsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    seuils: SeuilsAnalyse;
    /** Enregistre les seuils pour l'application entière. */
    onEnregistrer: (seuils: SeuilsAnalyse) => void;
    tooltipsEnabled?: boolean;
    /** Rendu dans une fenêtre détachée du navigateur (déplaçable sur un autre écran). */
    detachee?: boolean;
}

type Brouillon = Record<keyof SeuilsAnalyse, number | ''>;

interface Champ {
    cle: keyof SeuilsAnalyse;
    label: string;
    unite: string;
    aide: string;
}

interface Groupe {
    titre: string;
    champs: Champ[];
}

/** Ce que règle chaque seuil, dans l'ordre où l'analyse les emploie. */
const GROUPES: Groupe[] = [
    {
        titre: 'Durées de vert',
        champs: [
            { cle: 'vertMiniReglementaire', label: 'Vert minimum réglementaire', unite: 's', aide: 'En dessous, la règle ISR n’est pas respectée (6 s).' },
            { cle: 'vertConfort', label: 'Vert de confort', unite: 's', aide: 'Valeur conseillée au-dessus du minimum, plus perceptible.' },
            { cle: 'vertCapacite', label: 'Vert rationnel en capacité', unite: 's', aide: 'En dessous, l’analyse signale le vert comme peu rationnel en capacité.' },
            { cle: 'vertPietonSouhaite', label: 'Vert piéton souhaité', unite: 's', aide: 'En dessous, l’analyse suggère d’allonger le vert piéton. À 6 s, seuls les verts insuffisants sont signalés, en rouge.' },
            { cle: 'vertLong', label: 'Vert long', unite: 's', aide: 'Au-delà, le vert n’écoule plus de trafic utile et allonge l’attente.' }
        ]
    },
    {
        titre: 'Attentes',
        champs: [
            { cle: 'attenteMaxi', label: 'Attente maximale de tout usager', unite: 's', aide: 'Attente réglementaire, tous courants (120 s).' },
            { cle: 'attenteMaxiTC', label: 'Attente maximale des transports en commun', unite: 's', aide: 'Dérogation ponctuelle aux feux R17/R18 (240 s).' },
            { cle: 'attentePietonMaxi', label: 'Attente piétonne maximale (tolérance)', unite: 's', aide: 'Attente C − V d’un piéton arrivé au rouge ; 50 s par défaut.' },
            { cle: 'retardPietonMaxi', label: 'Retard moyen piéton signalé', unite: 's', aide: 'Retard moyen (C − V)² / 2C au-delà duquel l’analyse recommande d’agir.\nLe guide Certu juge 20 s anormalement long ; 30 s par défaut pour limiter les signalements.' }
        ]
    },
    {
        titre: 'Cycle et traversées',
        champs: [
            { cle: 'cycleMini', label: 'Cycle minimum', unite: 's', aide: 'En dessous, le cycle est jugé trop court pour la sécurité (40 s).' },
            { cle: 'traverseeSansRefuge', label: 'Traversée sans refuge', unite: 'm', aide: 'Au-delà, un îlot refuge est recommandé (12 m).' }
        ]
    },
    {
        titre: 'Capacité',
        champs: [
            { cle: 'capaciteReserveFaible', label: 'Capacité utilisée importante', unite: '%', aide: 'Suggestion de surveiller le courant. Même seuil que les couleurs du tableau Trafic (75 %).' },
            { cle: 'capaciteUtiliseeAlerte', label: 'Capacité utilisée — alerte', unite: '%', aide: 'Point d’attention, affiché en orange (85 %).' },
            { cle: 'capaciteUtiliseeSaturee', label: 'Capacité utilisée — saturation', unite: '%', aide: 'Le courant n’écoule plus toute sa demande (100 %).' }
        ]
    },
    {
        titre: 'Tourne-à-gauche (TàG)',
        champs: [
            { cle: 'tagStockageNaturel', label: 'TàG — stockage naturel', unite: 'uvp/h', aide: 'En dessous, il s’écoule au cœur du carrefour, en phase commune (100).' },
            { cle: 'tagPhaseProtegee', label: 'TàG — phase protégée', unite: 'uvp/h', aide: 'Au-delà, une voie dédiée et/ou une phase protégée deviennent nécessaires (150).' },
            { cle: 'tagOppositionParVoie', label: 'Trafic d’en face par voie', unite: 'uvp/h', aide: 'En zone charnière, la phase spéciale reste évitable sous cette valeur (400 à 500).' },
            { cle: 'tagProduitCritique', label: 'Produit TàG × trafic d’en face', unite: '', aide: 'Au-delà, la protection devient nécessaire, même sous 150 uvp/h (50 000).' }
        ]
    }
];

const versBrouillon = (seuils: SeuilsAnalyse): Brouillon =>
    (Object.keys(SEUILS_ANALYSE_DEFAUT) as (keyof SeuilsAnalyse)[])
        .reduce((b, cle) => ({ ...b, [cle]: seuils[cle] }), {} as Brouillon);

const versSeuils = (b: Brouillon): SeuilsAnalyse => {
    const s = { ...SEUILS_ANALYSE_DEFAUT };
    (Object.keys(s) as (keyof SeuilsAnalyse)[]).forEach(cle => {
        const v = b[cle];
        if (typeof v === 'number' && Number.isFinite(v)) s[cle] = Math.round(v);
    });
    return s;
};

/** Incohérences entre seuils, qui rendraient l'analyse contradictoire. */
const incoherences = (b: Brouillon): string[] => {
    const s = versSeuils(b);
    const messages: string[] = [];
    if (s.vertConfort < s.vertMiniReglementaire) messages.push('Le vert de confort ne peut pas être inférieur au vert minimum réglementaire.');
    if (s.vertCapacite < s.vertConfort) messages.push('Le vert rationnel en capacité ne peut pas être inférieur au vert de confort.');
    if (s.capaciteUtiliseeAlerte < s.capaciteReserveFaible) messages.push('Le seuil d’alerte de capacité ne peut pas être inférieur au seuil de réserve faible.');
    if (s.capaciteUtiliseeSaturee < s.capaciteUtiliseeAlerte) messages.push('Le seuil de saturation ne peut pas être inférieur au seuil d’alerte.');
    if (s.tagPhaseProtegee <= s.tagStockageNaturel) messages.push('Le seuil de phase protégée doit être supérieur au seuil de stockage naturel.');
    return messages;
};

/**
 * « Réglage des seuils... » (menu Diagramme ▸ Options) : les valeurs que
 * l'analyse du diagramme compare aux données du projet. Le réglage vaut pour
 * l'application entière, tous projets confondus.
 */
const ReglageSeuilsDialog = ({
    isOpen, onClose, seuils, onEnregistrer, tooltipsEnabled = true, detachee = false
}: ReglageSeuilsDialogProps) => {
    const tip = (text: string) => (tooltipsEnabled ? text : undefined);
    const [brouillon, setBrouillon] = useState<Brouillon>(() => versBrouillon(seuils));

    // Repart des seuils en vigueur à chaque ouverture (brouillon local).
    useEffect(() => {
        if (isOpen) setBrouillon(versBrouillon(seuils));
    }, [isOpen, seuils]);

    const modifier = (cle: keyof SeuilsAnalyse, valeur: string) =>
        setBrouillon(b => ({ ...b, [cle]: valeur === '' ? '' : Number(valeur) }));
    const problemes = incoherences(brouillon);

    const appliquer = () => {
        if (problemes.length) return;
        onEnregistrer(versSeuils(brouillon));
        // La fenêtre reste ouverte : on règle plusieurs seuils à la suite.
    };

    const corps = (
        <>
            {GROUPES.map(groupe => (
                <fieldset key={groupe.titre} className="reglage-seuils-groupe">
                    <legend>{groupe.titre}</legend>
                    {groupe.champs.map(champ => (
                        <label key={champ.cle} className="reglage-seuils-champ">
                            <span className="reglage-seuils-label">{champ.label}</span>
                            <span className="reglage-seuils-saisie">
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={brouillon[champ.cle]}
                                    aria-label={champ.label}
                                    title={tip(champ.aide)}
                                    onChange={e => modifier(champ.cle, e.target.value)}
                                />
                                {champ.unite && <span className="reglage-seuils-unite">{champ.unite}</span>}
                            </span>
                            <span className="reglage-seuils-aide">{champ.aide}</span>
                        </label>
                    ))}
                </fieldset>
            ))}

            {problemes.length > 0 && (
                <ul className="reglage-seuils-erreurs" role="alert">
                    {problemes.map(m => <li key={m}>{m}</li>)}
                </ul>
            )}

            <div className="modal-actions">
                <button
                    className="modal-btn modal-btn-secondary"
                    onClick={() => setBrouillon(versBrouillon(SEUILS_ANALYSE_DEFAUT))}
                    title={tip('Rétablir les valeurs par défaut, puis Enregistrer pour les appliquer')}
                >
                    Réinitialiser
                </button>
                <span className="reglage-seuils-spacer" />
                <button className="modal-btn modal-btn-secondary" onClick={onClose}>
                    Annuler
                </button>
                <button
                    className="modal-btn modal-btn-primary"
                    onClick={appliquer}
                    disabled={problemes.length > 0}
                    title={tip(problemes.length ? 'Corrigez les seuils incohérents pour appliquer' : 'Appliquer ces seuils à l’analyse, sans fermer la fenêtre')}
                >
                    Appliquer
                </button>
            </div>
        </>
    );

    // Fenêtre détachée : le contenu seul, la fenêtre du navigateur porte le titre.
    if (detachee) {
        return isOpen ? (
            <div className="modal-content reglage-seuils-modal reglage-seuils-detachee">
                <div className="modal-body">
                    <h3 className="reglage-seuils-titre-detache" title={tip(INFOBULLE_TITRE_SEUILS)}>
                        {TITRE_REGLAGE_SEUILS}
                    </h3>
                    {corps}
                </div>
            </div>
        ) : null;
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale tooltipsEnabled={tooltipsEnabled}
            title={<span title={tip(INFOBULLE_TITRE_SEUILS)}>{TITRE_REGLAGE_SEUILS}</span>}
            className="reglage-seuils-modal">
            {corps}
        </Modal>
    );
};

export default ReglageSeuilsDialog;
