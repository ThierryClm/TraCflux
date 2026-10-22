import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import HelpContent from './HelpContent';

// jsdom ne calcule pas de mise en page.
beforeAll(() => {
    Range.prototype.getBoundingClientRect ??= () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.useRealTimers());

const chercher = (mot) => {
    vi.useFakeTimers();
    const champ = screen.getByRole('searchbox', { name: "Rechercher dans l'aide" });
    fireEvent.change(champ, { target: { value: mot } });
    act(() => { vi.advanceTimersByTime(200); });
    return champ;
};

describe("recherche dans l'aide", () => {
    it('compte les occurrences et passe de l’une à l’autre', () => {
        render(<HelpContent />);
        const champ = chercher('escamotage');
        const compteur = screen.getByText(/^1 \/ \d+$/);
        const total = Number(compteur.textContent.split('/ ')[1]);
        expect(total).toBeGreaterThan(5);
        const precedente = screen.getByRole('button', { name: 'Occurrence précédente' });
        const suivante = screen.getByRole('button', { name: 'Occurrence suivante' });
        // Sur la première, la flèche du haut est grisée.
        expect(precedente).toBeDisabled();
        fireEvent.click(suivante);
        expect(compteur.textContent).toBe(`2 / ${total}`);
        expect(precedente).toBeEnabled();
        fireEvent.keyDown(champ, { key: 'Enter', shiftKey: true });
        fireEvent.keyDown(champ, { key: 'Enter', shiftKey: true });
        expect(compteur.textContent).toBe(`1 / ${total}`);
        // Jusqu'à la dernière : la flèche du bas se grise, Entrée n'y revient pas au début.
        for (let i = 0; i < total + 2; i++) fireEvent.keyDown(champ, { key: 'Enter' });
        expect(compteur.textContent).toBe(`${total} / ${total}`);
        expect(suivante).toBeDisabled();
        expect(precedente).toBeEnabled();
    });

    it("à l'ouverture de l'aide, le curseur est dans le champ de recherche", () => {
        render(<HelpContent />);
        expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    });

    it('déroule la liste des chapitres et sections qui contiennent le mot', () => {
        render(<HelpContent />);
        chercher('onde verte');
        fireEvent.click(screen.getByRole('button', { name: /^Chapitres \(\d+\)/ }));
        const liste = screen.getByRole('listbox', { name: 'Chapitres qui contiennent ce mot' });
        expect(within(liste).getByText('Chapitre 2 — Onde verte')).toBeInTheDocument();
        const section = within(liste).getByRole('button', { name: /Création d'une onde verte/ });
        fireEvent.click(section);
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('sans résultat, le dit ; Échap efface la recherche', () => {
        render(<HelpContent />);
        const champ = chercher('zzqx');
        expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Chapitres/ })).toBeDisabled();
        fireEvent.keyDown(champ, { key: 'Escape' });
        expect(champ.value).toBe('');
    });

    it('le texte cherché ne vient pas du sommaire', () => {
        render(<HelpContent />);
        chercher('Glossaire');
        // Le titre du chapitre et celui de sa section ; pas les liens du sommaire.
        fireEvent.click(screen.getByRole('button', { name: /^Chapitres/ }));
        const liste = screen.getByRole('listbox');
        expect(within(liste).getByText('Titre du chapitre')).toBeInTheDocument();
    });

    it('les raccourcis de l’application ne partent pas du champ de recherche', () => {
        const surTouche = vi.fn();
        window.addEventListener('keydown', surTouche);
        render(<HelpContent />);
        const champ = screen.getByRole('searchbox');
        fireEvent.keyDown(champ, { key: 'z', ctrlKey: true });
        expect(surTouche).not.toHaveBeenCalled();
        window.removeEventListener('keydown', surTouche);
    });

    it('Ctrl+F place le curseur dans la recherche', () => {
        render(<HelpContent />);
        document.activeElement.blur();
        fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
        expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    });
});
