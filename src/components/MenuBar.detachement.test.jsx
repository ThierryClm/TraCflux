import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuBar from './MenuBar';

afterEach(() => {
    vi.useRealTimers();
});

const ouvrirDetachement = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Mise en page' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Détachement/ }).closest('.menu-item-with-submenu'));
    act(() => vi.runAllTimers());
    return screen.getByRole('button', { name: /Détachement/ }).closest('.menu-item-with-submenu');
};

describe('MenuBar — menu Détachement', () => {
    it('propose la fenêtre Détecteurs et envoie son action', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} layoutOptions={{ detecteurModule: true }} />);
        const entree = ouvrirDetachement();
        const bouton = within(entree).getByRole('button', { name: 'Détecteurs' });
        expect(bouton).toBeEnabled();
        fireEvent.click(bouton);
        expect(onAction).toHaveBeenCalledWith('toggleFloatingDetecteurs');
    });

    it('grise la fenêtre Détecteurs quand le module est coupé', () => {
        vi.useFakeTimers();
        render(<MenuBar layoutOptions={{ detecteurModule: false }} />);
        const entree = ouvrirDetachement();
        expect(within(entree).getByRole('button', { name: 'Détecteurs' })).toBeDisabled();
    });
});
