import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuBar from './MenuBar';

afterEach(() => vi.useRealTimers());

const ouvrirDiagramme = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Diagramme' }));
    act(() => vi.runAllTimers());
};

describe('MenuBar — Diagramme sur un projet sans valeurs', () => {
    it('grise Analyse du diagramme tant qu’aucun vert n’est renseigné', () => {
        vi.useFakeTimers();
        render(<MenuBar diagrammeSansValeur />);
        ouvrirDiagramme();
        const analyse = screen.getByRole('button', { name: /Analyse du diagramme/ });
        expect(analyse).toBeDisabled();
        expect(analyse).toHaveAttribute('title', expect.stringContaining('pas encore de valeurs'));
    });

    it('active Analyse du diagramme dès qu’une valeur existe', () => {
        vi.useFakeTimers();
        render(<MenuBar diagrammeSansValeur={false} />);
        ouvrirDiagramme();
        expect(screen.getByRole('button', { name: /Analyse du diagramme/ })).toBeEnabled();
    });

    it('grise Matrice quand aucune case n’est renseignée', () => {
        vi.useFakeTimers();
        render(<MenuBar matriceVide />);
        ouvrirDiagramme();
        const matrice = screen.getByRole('button', { name: /^Matrice/ });
        expect(matrice).toBeDisabled();
        expect(matrice).toHaveAttribute('title', expect.stringContaining('Matrice vide'));
    });

    it('laisse Matrice active dès qu’une case est renseignée', () => {
        vi.useFakeTimers();
        render(<MenuBar matriceVide={false} />);
        ouvrirDiagramme();
        expect(screen.getByRole('button', { name: /^Matrice/ })).toBeEnabled();
    });

    it('grise Supprimer le diagramme actif quand il n’y a qu’un plan de feu', () => {
        vi.useFakeTimers();
        render(<MenuBar pfCount={1} />);
        ouvrirDiagramme();
        const supprimer = screen.getByRole('button', { name: 'Supprimer le diagramme actif' });
        expect(supprimer).toBeDisabled();
        expect(supprimer).toHaveAttribute('title', expect.stringContaining('deux plans de feu'));
    });

    it('l’active dès qu’il y a deux plans de feu', () => {
        vi.useFakeTimers();
        render(<MenuBar pfCount={2} />);
        ouvrirDiagramme();
        expect(screen.getByRole('button', { name: 'Supprimer le diagramme actif' })).toBeEnabled();
    });
});
