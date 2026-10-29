import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DossierPrintDialog from './DossierPrintDialog';
import { commentairesDuPlan, imprimerCommentaires, imprimerRemarques, remarquesRenseignees } from '../../utils/commentairesPlan';

/**
 * « Imprimer le projet » : sous chaque plan de feu, les cases Commentaires et
 * Remarques, proposées seulement quand le plan en a.
 */
const groupes = [
    { id: 1, name: 'Nord', type: 'V', comment: 'Détecteur HS', commentColor: 'red', offset: 0, minGreen: 6, durations: { green: 20, orange: 3, red: 37 } },
    { id: 2, name: 'Sud', type: 'V', comment: '', offset: 30, minGreen: 6, durations: { green: 20, orange: 3, red: 37 } },
];
const plans = [
    { id: 1, name: 'PF1', data: [], diagram: [], remarques: 'Ligne 1<div>Ligne 2</div>' },
    { id: 2, name: 'PF2', data: [], diagram: [{ groupId: 1, comment: '' }, { groupId: 2, comment: 'Pointe du soir' }], remarques: '<br>' },
    { id: 3, name: 'PF3', data: [], diagram: [{ groupId: 1, comment: '' }], remarques: '' },
];
const actif = { activePFId: 1, groups: groupes };

describe('commentaires et remarques d’un plan', () => {
    it('plan actif : commentaires des groupes à l’écran ; autres plans : leur diagramme', () => {
        expect(commentairesDuPlan(plans[0], actif)).toEqual([{ groupId: 1, texte: 'Détecteur HS', couleur: 'red' }]);
        expect(commentairesDuPlan(plans[1], actif)).toEqual([{ groupId: 2, texte: 'Pointe du soir', couleur: '' }]);
        expect(commentairesDuPlan(plans[2], actif)).toEqual([]);
    });
    it('remarques renseignées : texte visible, balises seules ignorées', () => {
        expect(plans.map(remarquesRenseignees)).toEqual([true, false, false]);
    });
    it('dossier enregistré avant ces cases : remarques imprimées, commentaires non', () => {
        expect(imprimerRemarques({}, 1)).toBe(true);
        expect(imprimerCommentaires({}, 1)).toBe(false);
    });
});

const Banc = () => {
    const [sections, setSections] = useState({});
    return (
        <>
            <DossierPrintDialog
                isOpen onClose={vi.fn()} portrait={false} setPortrait={vi.fn()}
                sections={sections} setSections={setSections} plans={plans}
                contexteScenarios={{ ...actif, cycleLength: 60, actionData: [], conflictMatrix: [] }}
                intersectionImage={null} intersectionArrows={[]} onExportPdf={vi.fn()} onPrint={vi.fn()} tip={(t) => t}
            />
            <output data-testid="sections">{JSON.stringify(sections)}</output>
        </>
    );
};

describe('Imprimer le projet — cases Commentaires et Remarques', () => {
    it('proposées sous le plan seulement quand il en a, cochées avec lui', () => {
        render(<Banc />);
        const blocs = () => screen.getAllByText(/^Diagramme PF/).map(l => l.closest('.dossier-pf-group'));
        ['Diagramme PF1', 'Diagramme PF2', 'Diagramme PF3'].forEach(n => fireEvent.click(screen.getByLabelText(n)));
        const [pf1, pf2, pf3] = blocs();
        expect(within(pf1).getByLabelText('Commentaires')).toBeChecked();
        expect(within(pf1).getByLabelText('Remarques')).toBeChecked();
        expect(within(pf2).getByLabelText('Commentaires')).toBeChecked();
        expect(within(pf2).queryByLabelText('Remarques')).toBeNull();
        expect(within(pf3).queryByLabelText('Commentaires')).toBeNull();
        expect(within(pf3).queryByLabelText('Remarques')).toBeNull();
        // Juste sous la case du plan : avant les conditions de micro-régulation.
        const libelles = [...pf1.querySelectorAll('.dossier-pf-suboptions label')].map(l => l.textContent.trim());
        expect(libelles.slice(0, 3)).toEqual(['Commentaires', 'Remarques', 'Conditions de micro-régulation']);
        fireEvent.click(within(pf1).getByLabelText('Remarques'));
        expect(JSON.parse(screen.getByTestId('sections').textContent).remarques_1).toBe(false);
    });
});

describe('Imprimer le projet — sections vides grisées', () => {
    it('image, phasage, variables micro, trafic et réserve : en place, grisés et décochés quand vides', () => {
        const trafic = { trafficDatasets: { HPM: { 1: { trafficVol: 300 } }, Vide: {} }, pfTrafficDatasetMap: { 1: 'HPM', 2: 'Vide' }, activeTrafficDataset: 'Vide', trafficDatasetNames: ['HPM', 'Vide'] };
        const Banc2 = () => {
            const [sections, setSections] = useState({ image: true });
            return (
                <DossierPrintDialog
                    isOpen onClose={vi.fn()} portrait={false} setPortrait={vi.fn()}
                    sections={sections} setSections={setSections}
                    plans={[{ ...plans[0], phasageBulleTimes: [0, 0, 0, 0], microCustomFields: [''] }, { ...plans[1], phasageBulleTimes: [0, 20, 0, 0] }]}
                    contexteScenarios={{ ...actif, cycleLength: 60, actionData: [], conflictMatrix: [], microCustomFields: ['TMAB = 10'] }}
                    trafic={trafic}
                    intersectionImage={null} intersectionArrows={[]} onExportPdf={vi.fn()} onPrint={vi.fn()} tip={(t) => t}
                />
            );
        };
        render(<Banc2 />);
        const image = screen.getByLabelText('Image du carrefour');
        expect(image).toBeDisabled();
        expect(image).not.toBeChecked();
        fireEvent.click(screen.getByLabelText('Diagramme PF1'));
        fireEvent.click(screen.getByLabelText('Diagramme PF2'));
        const [pf1, pf2] = screen.getAllByText(/^Diagramme PF/).map(l => l.closest('.dossier-pf-group'));
        // PF1 (plan actif) : variables de l'écran, trafic HPM ; pas d'image donc pas de phasage.
        expect(within(pf1).getByLabelText('Variables micro')).toBeChecked();
        expect(within(pf1).getByLabelText('Phasage bulle')).toBeDisabled();
        expect(within(pf1).getByLabelText('Phasage bulle')).not.toBeChecked();
        expect(within(pf1).getByLabelText('Données de trafic et calcul de capacité')).toBeChecked();
        // PF2 : ni variables ni trafic.
        for (const nom of ['Variables micro', 'Données de trafic et calcul de capacité', 'Réserve de capacité']) {
            expect(within(pf2).getByLabelText(nom)).toBeDisabled();
            expect(within(pf2).getByLabelText(nom)).not.toBeChecked();
        }
    });
});
