import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SimulationPanel from './SimulationPanel';
import {
    scenariosDuPlan, choisirScenario, quitterScenario, creerScenario, enregistrerScenario, supprimerScenario
} from '../simulation';

/**
 * La liste des scénarios de l'onglet Simulation : Tout cocher, Tout décocher,
 * les scénarios du plan, Nouveau scénario ; et les fenêtres qui valident un
 * titre, une suppression, ou l'abandon de modifications.
 *
 * Le banc tient un plan de feu comme le fait useTrafficLight, avec les mêmes
 * fonctions pures.
 */

const groupes = [1, 2].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5,
    offset: (id - 1) * 30, durations: { green: 20, orange: 3, red: 37 }
}));

const ligne = (id, action) => ({ id, action, gf: '', deb: '', fin: '', description: '' });
const actions = [ligne(1, 'Escamotage de phase'), ligne(2, 'Adaptatif vertical'), ligne(3, 'Prolongement')];

const Banc = ({ initial }) => {
    const [pf, setPf] = useState({ id: 1, name: 'PF1', data: actions, diagram: [], ...initial });
    const maj = (f) => setPf(p => { const c = f(p); return c ? { ...p, simulationScenarios: scenariosDuPlan(p), ...c } : p; });
    const cochees = pf.simulationActions || [];
    return (
        <>
            <SimulationPanel
                actionData={actions}
                selectedActions={cochees}
                onToggle={(id) => maj(() => ({ simulationActions: cochees.includes(id) ? cochees.filter(x => x !== id) : [...cochees, id] }))}
                onSelectAll={() => maj(() => ({ simulationActions: [1, 2, 3] }))}
                onDeselectAll={() => maj(() => ({ simulationActions: [] }))}
                groups={groupes}
                cycleLength={60}
                conflictMatrix={[]}
                hoveredActionId={null}
                setHoveredActionId={() => {}}
                scenarioName={pf.simulationName || ''}
                scenarios={scenariosDuPlan(pf)}
                onChoisirScenario={(nom) => maj(p => nom ? choisirScenario(p, nom) : quitterScenario(p))}
                onCreerScenario={(t) => maj(p => creerScenario(p, t))}
                onEnregistrerScenario={(t) => maj(p => enregistrerScenario(p, t))}
                onSupprimerScenario={() => maj(p => supprimerScenario(p))}
            />
            <output data-testid="plan">{JSON.stringify({ nom: pf.simulationName || '', cochees, scenarios: scenariosDuPlan(pf) })}</output>
        </>
    );
};

const etat = () => JSON.parse(screen.getByTestId('plan').textContent);
const ouvrirListe = () => fireEvent.click(screen.getByRole('button', { name: /Sans titre|▾/ }));
const liste = () => screen.getByRole('listbox');
const caseDe = (nom) => screen.getByText(nom, { selector: '.sim-action-type' }).closest('label').querySelector('input');

describe('Scénarios de simulation — la liste', () => {
    it('propose Tout cocher, Tout décocher, les scénarios puis Nouveau scénario', () => {
        render(<Banc initial={{ simulationScenarios: [{ nom: 'Pointe', actions: [1] }, { nom: 'Creuse', actions: [1, 2] }] }} />);
        ouvrirListe();
        const lignes = [...liste().querySelectorAll('button')].map(b => b.textContent);
        expect(lignes).toEqual(['Tout cocher', 'Tout décocher', 'Creuse2', 'Pointe1', '+ Nouveau scénario…']);
    });

    it('Tout cocher reste dans le scénario choisi et le marque modifié', () => {
        render(<Banc initial={{ simulationName: 'Pointe', simulationActions: [1], simulationScenarios: [{ nom: 'Pointe', actions: [1] }] }} />);
        expect(screen.queryByLabelText('modifié')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Pointe/ }));
        fireEvent.click(within(liste()).getByText('Tout cocher'));
        expect(etat()).toMatchObject({ nom: 'Pointe', cochees: [1, 2, 3] });
        expect(screen.getByLabelText('modifié')).toBeTruthy();
    });

    it('Nouveau scénario demande un titre et prend les cases cochées', () => {
        render(<Banc initial={{ simulationActions: [2] }} />);
        expect(screen.getByText('Enregistrer…').closest('button').disabled).toBe(true);
        ouvrirListe();
        fireEvent.click(within(liste()).getByText('+ Nouveau scénario…'));
        fireEvent.change(screen.getByPlaceholderText(/Escamotage bus/), { target: { value: 'Heure creuse' } });
        fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
        expect(etat()).toEqual({ nom: 'Heure creuse', cochees: [2], scenarios: [{ nom: 'Heure creuse', actions: [2] }] });
    });

    it('un titre déjà pris est refusé', () => {
        render(<Banc initial={{ simulationScenarios: [{ nom: 'Pointe', actions: [] }] }} />);
        ouvrirListe();
        fireEvent.click(within(liste()).getByText('+ Nouveau scénario…'));
        fireEvent.change(screen.getByPlaceholderText(/Escamotage bus/), { target: { value: 'pointe' } });
        expect(screen.getByText(/s'appelle déjà/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Créer' }).disabled).toBe(true);
    });
});

describe('Scénarios de simulation — enregistrer, renommer, copier, supprimer', () => {
    const initial = { simulationName: 'Pointe', simulationActions: [1], simulationScenarios: [{ nom: 'Pointe', actions: [1] }] };

    it('Enregistrer met à jour les cases du scénario', () => {
        render(<Banc initial={initial} />);
        fireEvent.click(caseDe('Adaptatif vertical'));
        fireEvent.click(screen.getByText('Enregistrer…'));
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(etat().scenarios).toEqual([{ nom: 'Pointe', actions: [1, 2] }]);
        expect(screen.queryByLabelText('modifié')).toBeNull();
    });

    it('un titre changé propose Renommer ou Créer une copie', () => {
        render(<Banc initial={initial} />);
        fireEvent.click(screen.getByText('Enregistrer…'));
        fireEvent.change(screen.getByDisplayValue('Pointe'), { target: { value: 'Pointe du soir' } });
        fireEvent.click(screen.getByRole('button', { name: 'Créer une copie' }));
        expect(etat().scenarios.map(s => s.nom)).toEqual(['Pointe', 'Pointe du soir']);
        expect(etat().nom).toBe('Pointe du soir');

        fireEvent.click(screen.getByText('Enregistrer…'));
        fireEvent.change(screen.getByDisplayValue('Pointe du soir'), { target: { value: 'Soir' } });
        fireEvent.click(screen.getByRole('button', { name: 'Renommer' }));
        expect(etat().scenarios.map(s => s.nom)).toEqual(['Pointe', 'Soir']);
    });

    it('Supprimer demande confirmation et laisse les cases cochées', () => {
        render(<Banc initial={initial} />);
        fireEvent.click(screen.getByText('Supprimer…'));
        expect(screen.getByText('« Pointe » sera retiré de la liste.')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
        expect(etat()).toEqual({ nom: '', cochees: [1], scenarios: [] });
    });
});

describe('Scénarios de simulation — changer de scénario avec des modifications', () => {
    const initial = {
        simulationName: 'Pointe', simulationActions: [1],
        simulationScenarios: [{ nom: 'Pointe', actions: [1] }, { nom: 'Creuse', actions: [3] }]
    };
    const versCreuse = () => {
        fireEvent.click(caseDe('Adaptatif vertical'));
        fireEvent.click(screen.getByRole('button', { name: /Pointe/ }));
        fireEvent.click(within(liste()).getByText('Creuse'));
    };

    it('sans modification, le scénario s\'ouvre directement', () => {
        render(<Banc initial={initial} />);
        fireEvent.click(screen.getByRole('button', { name: /Pointe/ }));
        fireEvent.click(within(liste()).getByText('Creuse'));
        expect(etat()).toMatchObject({ nom: 'Creuse', cochees: [3] });
    });

    it('Annuler reste sur le scénario modifié', () => {
        render(<Banc initial={initial} />);
        versCreuse();
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
        expect(etat()).toMatchObject({ nom: 'Pointe', cochees: [1, 2] });
    });

    it('Abandonner ouvre l\'autre sans enregistrer', () => {
        render(<Banc initial={initial} />);
        versCreuse();
        fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
        expect(etat()).toMatchObject({ nom: 'Creuse', cochees: [3] });
        expect(etat().scenarios.find(s => s.nom === 'Pointe').actions).toEqual([1]);
    });

    it('Enregistrer garde les modifications puis ouvre l\'autre', () => {
        render(<Banc initial={initial} />);
        versCreuse();
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(etat()).toMatchObject({ nom: 'Creuse', cochees: [3] });
        expect(etat().scenarios.find(s => s.nom === 'Pointe').actions).toEqual([1, 2]);
    });
});
