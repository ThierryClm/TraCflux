import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import SimulationPanel from './SimulationPanel';
import { definirPrefsVerrou } from '../utils/verrouSaisie';

afterEach(() => act(() => definirPrefsVerrou()));

const dessiner = (props = {}) => {
    const onToggle = vi.fn(), onCompenserBts = vi.fn(), onSurvolAction = vi.fn(), onChoisirScenario = vi.fn();
    const rendu = render(<SimulationPanel
        groups={[{ id: 1, name: 'Nord', type: 'V', courant: 'TD', offset: 0, minGreen: 6, durations: { green: 20, orange: 3, red: 37 } }]}
        cycleLength={60} conflictMatrix={[]} selectedActions={[]}
        actionData={[{ id: 1, action: 'Escamotage', gf: '1', deb: '10', fin: '20' }, { id: 2, action: 'Synchro BTS', gf: '', deb: '30', fin: '' }]}
        hoveredActionId={null} setHoveredActionId={() => {}} onSurvolAction={onSurvolAction}
        onToggle={onToggle} onCompenserBts={onCompenserBts}
        scenarioName="Pointe" scenarios={[{ nom: 'Pointe', actions: [] }, { nom: 'Creuse', actions: [2] }]}
        onChoisirScenario={onChoisirScenario} {...props}
    />);
    return { ...rendu, onToggle, onCompenserBts, onSurvolAction, onChoisirScenario };
};

it('garde le choix des scénarios sous verrou, sans modifier leurs cases ni la compensation BTS', async () => {
    const user = userEvent.setup();
    const { container, onToggle, onCompenserBts, onSurvolAction, onChoisirScenario } = dessiner();
    fireEvent.click(container.querySelector('.simulation-scenario-select'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    act(() => definirPrefsVerrou({ scenarios: true }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(container.querySelector('.mention-verrou')).toHaveTextContent('(verrouillé)');
    expect(container.querySelector('.simulation-scenario-fleche')).toBeInTheDocument();
    for (const champ of container.querySelectorAll('input, .sim-btn')) expect(champ).toBeDisabled();
    await user.click(container.querySelector('.simulation-scenario-select'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nouveau scénario…' })).toBeDisabled();
    await user.click(screen.getByRole('option', { name: /Tout coché/ }));
    expect(onChoisirScenario).toHaveBeenLastCalledWith('Tout coché');
    await user.click(container.querySelector('.simulation-scenario-select'));
    await user.click(screen.getByRole('option', { name: /Creuse/ }));
    expect(onChoisirScenario).toHaveBeenLastCalledWith('Creuse');
    expect(screen.queryByRole('listbox')).toBeNull();
    for (const champ of screen.getAllByRole('checkbox')) await user.click(champ);
    await user.click(screen.getByRole('button', { name: 'Enregistrer…' }));
    expect(screen.queryByText('Enregistrer le scénario')).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
    expect(onCompenserBts).not.toHaveBeenCalled();
    fireEvent.mouseEnter(container.querySelector('.simulation-item'));
    expect(onSurvolAction).toHaveBeenLastCalledWith(1);

    act(() => definirPrefsVerrou());
    expect(container.querySelector('.simulation-scenario-fleche')).toBeInTheDocument();
    await user.click(container.querySelector('.simulation-item input'));
    await user.click(screen.getByRole('checkbox', { name: /Compenser/ }));
    expect(onToggle).toHaveBeenCalledWith(1);
    expect(onCompenserBts).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Supprimer…' })).toBeEnabled();
});

it('un scénario modifié avant le verrou peut être quitté sans autoriser son enregistrement', async () => {
    const user = userEvent.setup();
    const { container, onChoisirScenario } = dessiner({ selectedActions: [1] });
    act(() => definirPrefsVerrou({ scenarios: true }));
    await user.click(container.querySelector('.simulation-scenario-select'));
    await user.click(screen.getByRole('option', { name: /Tout décoché/ }));
    expect(screen.getByText(/Abandonner ces modifications pour ouvrir/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Créer un scénario…' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onChoisirScenario).not.toHaveBeenCalled();
    await user.click(container.querySelector('.simulation-scenario-select'));
    await user.click(screen.getByRole('option', { name: /Tout décoché/ }));
    await user.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(onChoisirScenario).toHaveBeenCalledWith('Tout décoché');
    expect(container.querySelector('.simulation-item input')).toBeDisabled();
});

it('ferme un dialogue de scénario ouvert au moment du verrouillage et ne le rouvre pas ensuite', () => {
    dessiner();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer…' }));
    expect(screen.getByText('Enregistrer le scénario')).toBeInTheDocument();
    act(() => definirPrefsVerrou({ scenarios: true }));
    expect(screen.queryByText('Enregistrer le scénario')).toBeNull();
    act(() => definirPrefsVerrou());
    expect(screen.queryByText('Enregistrer le scénario')).toBeNull();
});
