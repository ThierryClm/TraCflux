import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DossierPrintDialog from './DossierPrintDialog';
import { scenariosAImprimer, sectionsScenariosInitiales } from '../../simulation';

/**
 * « Imprimer le dossier » : la case Scénarios liste les scénarios enregistrés,
 * plan par plan — sans Tout coché ni Tout décoché, qui ne sont que des
 * facilités de coche — avec des options communes et la comparaison.
 */

const groupes = [1, 2].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5,
    offset: (id - 1) * 30, durations: { green: 20, orange: 3, red: 37 }
}));
const actions = [
    { id: 1, action: 'Escamotage de phase', gf: '', deb: '', fin: '' },
    { id: 2, action: 'Prolongement', gf: '', deb: '', fin: '' }
];
const plans = [
    { id: 1, name: 'PF1', data: actions, diagram: [], simulationName: 'Bus', simulationActions: [1],
        simulationScenarios: [{ nom: 'Bus', actions: [1] }, { nom: 'Soir', actions: [1, 2] }] },
    { id: 2, name: 'PF2', data: actions, diagram: [], simulationScenarios: [{ nom: 'Creuse', actions: [2] }] },
    { id: 3, name: 'PF3', data: actions, diagram: [] }
];

const Banc = ({ initiales }) => {
    const [sections, setSections] = useState(initiales);
    return (
        <>
            <DossierPrintDialog
                isOpen onClose={vi.fn()} portrait={false} setPortrait={vi.fn()}
                sections={sections} setSections={setSections} plans={plans}
                contexteScenarios={{ activePFId: 1, groups: groupes, cycleLength: 60, actionData: actions, conflictMatrix: [] }}
                intersectionImage={null} intersectionArrows={[]} onExportPdf={vi.fn()} onPrint={vi.fn()} tip={(t) => t}
            />
            <output data-testid="imprimes">{JSON.stringify(plans.map(pf => scenariosAImprimer(sections, pf, 1).map(s => s.nom)))}</output>
        </>
    );
};
const imprimes = () => JSON.parse(screen.getByTestId('imprimes').textContent);

describe('Impression multi-scénario — la boîte', () => {
    it('propose les scénarios enregistrés de chaque plan, sans les scénarios fixes', () => {
        render(<Banc initiales={sectionsScenariosInitiales(plans)} />);
        expect(screen.getByLabelText(/^Bus/)).toBeTruthy();
        expect(screen.getByLabelText(/^Soir/)).toBeTruthy();
        expect(screen.getByLabelText(/^Creuse/)).toBeTruthy();
        expect(screen.queryByText('Tout coché')).toBeNull();
        expect(screen.getByText('PF3 : aucun scénario enregistré')).toBeTruthy();
    });

    it("à la première ouverture, seul le scénario choisi de chaque plan est coché", () => {
        render(<Banc initiales={sectionsScenariosInitiales(plans)} />);
        expect(imprimes()).toEqual([['Bus'], [], []]);
        expect(screen.getByLabelText('Tableau comparatif des scénarios').checked).toBe(true);
    });

    it('la case Scénarios coche puis décoche tout', () => {
        render(<Banc initiales={sectionsScenariosInitiales(plans)} />);
        fireEvent.click(screen.getByLabelText('Scénarios'));
        expect(imprimes()).toEqual([[], [], []]);
        fireEvent.click(screen.getByLabelText('Scénarios'));
        expect(imprimes()).toEqual([['Bus', 'Soir'], ['Creuse'], []]);
    });

    it('un dossier enregistré avant le multi-scénario garde son scénario, puis passe aux choix explicites', () => {
        render(<Banc initiales={{ simulation: true, simulationActions: true }} />);
        expect(imprimes()).toEqual([['Bus'], [], []]);
        fireEvent.click(screen.getByLabelText(/^Creuse/));
        expect(imprimes()).toEqual([['Bus'], ['Creuse'], []]);
        expect(screen.getByLabelText('Diagramme simulé').checked, 'le diagramme s\'imprimait toujours').toBe(true);
    });

    it('le résumé donne les actions et le cycle simulé', () => {
        render(<Banc initiales={sectionsScenariosInitiales(plans)} />);
        expect(screen.getByLabelText(/^Bus/).closest('label').textContent).toMatch(/1 action · \d+ s/);
    });
});
