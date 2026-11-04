import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuBar from './MenuBar';

afterEach(() => {
    vi.useRealTimers();
});

const ouvrirInfobulles = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Mise en page' }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Infobulles/ }).closest('.menu-item-with-submenu'));
    act(() => vi.runAllTimers());
};

describe('MenuBar — infobulles du formulaire', () => {
    it('propose Formulaire coché par défaut après Configuration et envoie son action propre', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} layoutOptions={{ tooltipPrefs: { config: false } }} />);
        ouvrirInfobulles();
        const formulaire = screen.getByRole('button', { name: /Formulaire/ });
        const sousMenu = formulaire.closest('.submenu-dropdown');
        const libelles = within(sousMenu).getAllByRole('button').map(b => b.textContent.replace('✓', '').trim());
        expect(libelles.indexOf('Formulaire')).toBe(libelles.indexOf('Configuration') + 1);
        expect(formulaire).toHaveClass('checked');
        expect(within(sousMenu).getByRole('button', { name: 'Configuration' })).not.toHaveClass('checked');
        fireEvent.click(formulaire);
        expect(onAction).toHaveBeenCalledWith('toggleTooltipsForm');
        expect(formulaire).toBeInTheDocument();
    });

    it('reflète le choix Formulaire décoché sans changer Configuration', () => {
        vi.useFakeTimers();
        render(<MenuBar layoutOptions={{ tooltipPrefs: { config: true, form: false } }} />);
        ouvrirInfobulles();
        const formulaire = screen.getByRole('button', { name: /Formulaire/ });
        expect(formulaire).not.toHaveClass('checked');
        const sousMenu = formulaire.closest('.submenu-dropdown');
        expect(within(sousMenu).getByRole('button', { name: /Configuration/ })).toHaveClass('checked');
    });
});
