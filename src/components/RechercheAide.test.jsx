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
        expect(within(liste).getByText('Chapitre 7 — Onde verte')).toBeInTheDocument();
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

describe('flèches sans recherche', () => {
    const ouvrirRubrique = (nom) => {
        const sommaire = document.getElementById('help-sommaire');
        // Deux rubriques de l'aide s'appellent « Présentation » : la première suffit.
        fireEvent.click(within(sommaire).getAllByRole('link', { name: nom })[0]);
    };
    const totalRubriques = () => {
        const texte = screen.getByText(/^Rubrique 1 \/ \d+$/).textContent;
        return Number(texte.split('/ ')[1]);
    };

    it('restent grisées tant qu’aucune rubrique n’a été ouverte', () => {
        render(<HelpContent />);
        expect(screen.getByRole('button', { name: 'Occurrence précédente' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Occurrence suivante' })).toBeDisabled();
        expect(screen.queryByText(/^Rubrique \d+ \/ \d+$/)).toBeNull();
    });

    it('passent d’une rubrique à l’autre après un clic dans le sommaire', () => {
        const defiler = vi.spyOn(Element.prototype, 'scrollIntoView');
        render(<HelpContent />);
        ouvrirRubrique('Présentation');
        const precedente = screen.getByRole('button', { name: 'Rubrique précédente' });
        const suivante = screen.getByRole('button', { name: 'Rubrique suivante' });
        expect(precedente).toBeDisabled();
        expect(suivante).toBeEnabled();
        const total = totalRubriques();
        expect(total).toBeGreaterThan(2);

        fireEvent.click(suivante);
        expect(screen.getByText(`Rubrique 2 / ${total}`)).toBeInTheDocument();
        expect(precedente).toBeEnabled();
        // La rubrique rejointe est bien la deuxième du texte.
        expect(defiler.mock.instances.at(-1).textContent).toContain('Interface principale');

        for (let i = 2; i < total; i++) fireEvent.click(suivante);
        expect(screen.getByText(`Rubrique ${total} / ${total}`)).toBeInTheDocument();
        expect(suivante).toBeDisabled();
        expect(precedente).toBeEnabled();

        fireEvent.click(precedente);
        expect(screen.getByText(`Rubrique ${total - 1} / ${total}`)).toBeInTheDocument();
        defiler.mockRestore();
    });

    it('un clic sur un chapitre place les flèches sur sa première rubrique', () => {
        render(<HelpContent />);
        const sommaire = document.getElementById('help-sommaire');
        const chapitre = within(sommaire).getByRole('link', { name: /^Chapitre 2 / });
        fireEvent.click(chapitre);
        // La première rubrique du chapitre 2 suit celles du chapitre 1.
        expect(screen.getByText(/^Rubrique \d+ \/ \d+$/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rubrique suivante' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Rubrique précédente' })).toBeEnabled();
    });

    it('la recherche reprend la main dès qu’un mot est saisi', () => {
        render(<HelpContent />);
        ouvrirRubrique('Présentation');
        chercher('escamotage');
        expect(screen.getByRole('button', { name: 'Occurrence précédente' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Rubrique suivante' })).toBeNull();
        expect(screen.queryByText(/^Rubrique \d+ \/ \d+$/)).toBeNull();
        expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument();
    });

    it('effacer la recherche retrouve la navigation par rubriques', () => {
        render(<HelpContent />);
        ouvrirRubrique('Interface principale');
        const champ = chercher('escamotage');
        fireEvent.keyDown(champ, { key: 'Escape' });
        expect(champ.value).toBe('');
        act(() => { vi.advanceTimersByTime(200); });
        expect(screen.getByRole('button', { name: 'Rubrique suivante' })).toBeEnabled();
        expect(screen.getByText(/^Rubrique 2 \/ \d+$/)).toBeInTheDocument();
    });
});
