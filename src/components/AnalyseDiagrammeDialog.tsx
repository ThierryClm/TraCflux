import { useMemo } from 'react';
import Modal from './Modal';
import type { ActionMicro, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import { analyserDiagramme, ORDRE_NIVEAUX } from '../utils/analyseDiagramme';
import type { NiveauConstat } from '../utils/analyseDiagramme';
import type { SeuilsAnalyse } from '../utils/seuilsAnalyse';
import './AnalyseDiagrammeDialog.css';

interface AnalyseDiagrammeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    planName: string;
    groups: Groupe[];
    cycleLength: number;
    conflictMatrix: Matrice;
    intersectionArrows?: FlecheCarrefour[];
    getTrafficData?: (groupId: number) => { trafficVol?: number | string };
    actionData?: ActionMicro[];
    /** Seuils réglés par l'utilisateur (menu Diagramme ▸ Réglage des seuils...). */
    seuils?: Partial<SeuilsAnalyse>;
    tooltipsEnabled?: boolean;
    /** Rendu dans une fenêtre détachée du navigateur (déplaçable sur un autre écran). */
    detachee?: boolean;
}

const LIBELLES: Record<NiveauConstat, string> = {
    obligation: 'Règles non respectées',
    recommandation: 'Recommandations et points d\'attention',
    information: 'Suggestions'
};

/**
 * Fenêtre « Analyse du diagramme » : les règles et recommandations que le plan
 * de feu actif n'applique pas. Non modale, recalculée à chaque modification.
 * Les règles non respectées (rouge) viennent toujours en premier.
 */
const AnalyseDiagrammeDialog = ({
    isOpen, onClose, planName, groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData, seuils,
    tooltipsEnabled = true, detachee = false
}: AnalyseDiagrammeDialogProps) => {
    const { constats, controles, groupesIgnores } = useMemo(
        () => isOpen
            ? analyserDiagramme({ groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData, seuils })
            : { constats: [], controles: 0, groupesIgnores: 0 },
        [isOpen, groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData, seuils]
    );
    const parNiveau = ORDRE_NIVEAUX
        .map(n => ({
            n,
            liste: constats
                .filter(c => c.niveau === n)
                // Dans l'orange, les points d'attention passent avant les recommandations.
                .sort((a, b) => Number(!!b.pointAttention) - Number(!!a.pointAttention))
        }))
        .filter(x => x.liste.length);

    const corps = (
        <>
            <p className="analyse-resume">
                {constats.length === 0
                    ? `Les ${controles} contrôles sont respectés pour ce plan de feu.`
                    : `${constats.length} point${constats.length > 1 ? 's' : ''} à examiner sur ${controles} contrôles.`}
                {' '}Les règles non respectées, à corriger en priorité, sont en rouge et viennent en premier ;
                les recommandations et points d'attention en orange ; les suggestions en bleu.
                {' '}Règlement : ISR, 6e partie ; recommandations : guide Certu 2010. L'analyse signale, le concepteur décide.
            </p>
            {groupesIgnores > 0 && (
                <p className="analyse-ignores">
                    {groupesIgnores} groupe{groupesIgnores > 1 ? 's' : ''} sans type ou sans vert
                    {groupesIgnores > 1 ? ' sont ignorés' : ' est ignoré'} : l'analyse ne porte que sur les groupes renseignés.
                </p>
            )}
            {parNiveau.map(({ n, liste }) => (
                <section key={n} className={`analyse-niveau analyse-${n}`}>
                    <h4>{LIBELLES[n]} ({liste.length})</h4>
                    <ul>
                        {liste.map(c => (
                            <li key={c.id} data-testid={`constat-${c.id}`}>
                                <div className="analyse-entete">
                                    <span className={`analyse-theme${c.pointAttention ? ' analyse-point-attention' : ''}`}>
                                        {c.pointAttention ? `Point d'attention · ${c.theme}` : c.theme}
                                    </span>
                                    <span className="analyse-message">{c.message}</span>
                                </div>
                                <div className="analyse-suggestion">{c.suggestion}</div>
                                <div className="analyse-source">{c.source}</div>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );

    // Fenêtre détachée : le contenu seul, la fenêtre du navigateur porte le titre.
    if (detachee) {
        return isOpen ? (
            <div className="modal-content analyse-diagramme-dialog analyse-detachee">
                <div className="modal-body">{corps}</div>
            </div>
        ) : null;
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale tooltipsEnabled={tooltipsEnabled}
            className="analyse-diagramme-dialog" title={titreAnalyseDiagramme(planName)}>
            {corps}
        </Modal>
    );
};

export const titreAnalyseDiagramme = (planName: string) => `Analyse du diagramme — ${planName || 'plan actif'}`;

export default AnalyseDiagrammeDialog;
