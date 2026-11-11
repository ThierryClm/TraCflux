import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuBar from './MenuBar';

afterEach(() => {
    vi.useRealTimers();
});

/** Ouvre Diagramme, puis déplie le sous-menu Scénarios. */
const ouvrirScenarios = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Diagramme' }));
    const entree = screen.getByRole('button', { name: /Scénarios/ }).closest('.menu-item-with-submenu');
    fireEvent.mouseEnter(entree);
    act(() => vi.runAllTimers());
    return entree;
};

describe('MenuBar — menu Diagramme ▸ Scénarios', () => {
    it('est grisé tant qu’aucun plan de feu n’a de scénario enregistré', () => {
        vi.useFakeTimers();
        render(<MenuBar scenariosPlans={[{ id: 1, nom: 'PF1', scenarios: [] }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Diagramme' }));
        const bouton = screen.getByRole('button', { name: /Scénarios/ });
        expect(bouton).toBeDisabled();
        // Grisé, il ne se déplie pas.
        fireEvent.mouseEnter(bouton.closest('.menu-item-with-submenu'));
        act(() => vi.runAllTimers());
        expect(screen.queryByText('Nuit')).not.toBeInTheDocument();
    });

    it('suit l’entrée Assistant conception', () => {
        vi.useFakeTimers();
        render(<MenuBar scenariosPlans={[{ id: 1, nom: 'PF1', scenarios: ['Nuit'] }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Diagramme' }));
        const libelles = screen.getAllByRole('button').map(b => b.textContent.trim());
        const index = libelles.findIndex(l => l.startsWith('Scénarios'));
        expect(index).toBeGreaterThan(-1);
        expect(libelles[index - 1]).toMatch(/^Assistant conception/);
    });

    it('liste les scénarios préparés et envoie plan + nom', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} scenariosPlans={[{ id: 3, nom: 'PF1', scenarios: ['Nuit', 'Pointe'] }]} />);
        ouvrirScenarios();
        const nuit = screen.getByRole('button', { name: 'Nuit' });
        expect(within(nuit.closest('.submenu-dropdown')).getByRole('button', { name: 'Pointe' })).toBeInTheDocument();
        fireEvent.click(nuit);
        expect(onAction).toHaveBeenCalledWith('scenario:3:Nuit');
    });

    it('précise le plan de feu seulement quand ils sont plusieurs', () => {
        vi.useFakeTimers();
        render(<MenuBar scenariosPlans={[
            { id: 1, nom: 'PF1', scenarios: ['Nuit'] },
            { id: 2, nom: 'PF2', scenarios: ['Pointe'] }
        ]} />);
        ouvrirScenarios();
        expect(screen.getByRole('button', { name: 'PF1 — Nuit' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'PF2 — Pointe' })).toBeInTheDocument();
    });
});
