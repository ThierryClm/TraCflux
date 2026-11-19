import { useMemo } from 'react';
import Modal from './Modal';
import type { ActionMicro, FlecheCarrefour, Groupe, Matrice } from '../types/projet';
import { analyserDiagramme } from '../utils/analyseDiagramme';
import type { NiveauConstat } from '../utils/analyseDiagramme';
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
    tooltipsEnabled?: boolean;
}

const LIBELLES: Record<NiveauConstat, string> = {
    obligation: 'Règle non respectée',
    recommandation: 'Recommandation non appliquée',
    information: 'Suggestion'
};
const ORDRE: NiveauConstat[] = ['obligation', 'recommandation', 'information'];

/**
 * Fenêtre « Analyse du diagramme » : les règles et recommandations que le plan
 * de feu actif n'applique pas. Non modale, recalculée à chaque modification.
 */
const AnalyseDiagrammeDialog = ({
    isOpen, onClose, planName, groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData, tooltipsEnabled = true
}: AnalyseDiagrammeDialogProps) => {
    const { constats, controles } = useMemo(
        () => isOpen
            ? analyserDiagramme({ groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData })
            : { constats: [], controles: 0 },
        [isOpen, groups, cycleLength, conflictMatrix, intersectionArrows, getTrafficData, actionData]
    );
    const parNiveau = ORDRE.map(n => ({ n, liste: constats.filter(c => c.niveau === n) })).filter(x => x.liste.length);

    return (
        <Modal isOpen={isOpen} onClose={onClose} nonModale tooltipsEnabled={tooltipsEnabled}
            className="analyse-diagramme-dialog" title={`Analyse du diagramme — ${planName || 'plan actif'}`}>
            <p className="analyse-resume">
                {constats.length === 0
                    ? `Les ${controles} contrôles sont respectés pour ce plan de feu.`
                    : `${constats.length} point${constats.length > 1 ? 's' : ''} à examiner sur ${controles} contrôles.`}
                {' '}Règlement : ISR, 6e partie ; recommandations : guide Certu 2010. L'analyse signale, le concepteur décide.
            </p>
            {parNiveau.map(({ n, liste }) => (
                <section key={n} className={`analyse-niveau analyse-${n}`}>
                    <h4>{LIBELLES[n]} ({liste.length})</h4>
                    <ul>
                        {liste.map(c => (
                            <li key={c.id} data-testid={`constat-${c.id}`}>
                                <div className="analyse-entete">
                                    <span className="analyse-theme">{c.theme}</span>
                                    <span className="analyse-message">{c.message}</span>
                                </div>
                                <div className="analyse-suggestion">{c.suggestion}</div>
                                <div className="analyse-source">{c.source}</div>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </Modal>
    );
};

export default AnalyseDiagrammeDialog;
