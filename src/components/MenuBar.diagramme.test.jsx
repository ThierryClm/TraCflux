import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MenuBar from './MenuBar';
import { SECTIONS_VERROU, definirPrefsVerrou } from '../utils/verrouSaisie';

beforeEach(() => {
    definirPrefsVerrou(null);
});

afterEach(() => {
    vi.useRealTimers();
    definirPrefsVerrou(null);
});

/**
 * La barre a déjà un menu « Diagramme » ; l'entrée du même nom vit dans le
 * déroulant de « Mise en page ». Les recherches sont donc cadrées sur ce
 * déroulant, sans quoi deux boutons répondent.
 */
const trouverDepliantMiseEnPage = () => [...document.querySelectorAll('.menu-dropdown')]
    .find(d => d.textContent.includes('Affichage des paramètres'));

/** Ouvre le menu Mise en page ; un second clic le refermerait, donc on réutilise. */
const menuMiseEnPage = () => {
    const ouvert = trouverDepliantMiseEnPage();
    if (ouvert) return ouvert;
    fireEvent.click(screen.getByRole('button', { name: 'Mise en page' }));
    return trouverDepliantMiseEnPage();
};

const boutonDuMenu = (libelle) =>
    within(menuMiseEnPage()).getByRole('button', { name: new RegExp(`^${libelle}`) });

/** Ouvre Mise en page, puis déplie son entrée Diagramme. */
const ouvrirDiagramme = () => {
    const menu = menuMiseEnPage();
    const entree = within(menu).getByRole('button', { name: /^Diagramme/ }).closest('.menu-item-with-submenu');
    fireEvent.mouseEnter(entree);
    act(() => vi.runAllTimers());
    return entree;
};

/** Déplie une entrée de second niveau (Commentaires, Remarques, Dilatation). */
const deplier = (libelle) => {
    const entree = boutonDuMenu(libelle).closest('.menu-item-with-submenu');
    fireEvent.mouseEnter(entree);
    act(() => vi.runAllTimers());
    return entree;
};

describe('MenuBar — Mise en page ▸ Diagramme', () => {
    it('suit Affichage des paramètres et regroupe les trois réglages du diagramme', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const menu = menuMiseEnPage();
        const libelles = within(menu).getAllByRole('button')
            .map(b => b.textContent.replace('✓', '').replace('▶', '').trim());
        const index = libelles.indexOf('Diagramme');
        expect(index).toBeGreaterThan(-1);
        expect(libelles[index - 1]).toBe('Affichage des paramètres');

        const groupe = ouvrirDiagramme();
        const entrees = within(groupe.querySelector('.submenu-dropdown')).getAllByRole('button')
            .map(b => b.textContent.replace('▶', '').trim());
        expect(entrees).toEqual([
            'Nom des groupes de feu dans...',
            'Commentaires',
            'Remarques',
            'Description des conditions micro',
            'Dilatation (zoom)'
        ]);
    });

    it('ne les laisse plus en tête du menu Mise en page, sauf le nom des groupes', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const menu = menuMiseEnPage();
        const tete = within(menu).getAllByRole('button')
            .map(b => b.textContent.replace(/[✓▶]/g, '').trim());
        expect(tete).not.toContain('Commentaires du diagramme');
        expect(tete).not.toContain('Remarques du diagramme');
        expect(tete).not.toContain('Dilatation du diagramme');
        expect(tete).not.toContain('Description des conditions micro');
        // Le nom des groupes reste au premier niveau, et se retrouve aussi dans Diagramme.
        expect(tete).toContain('Nom des groupes de feu dans...');
    });

    it('garde le nom des groupes au premier niveau, en double', () => {
        vi.useFakeTimers();
        render(<MenuBar layoutOptions={{ showGroupNamesDiagram: true }} />);
        ouvrirDiagramme();
        const occurrences = screen.getAllByRole('button', { name: /^Nom des groupes de feu/ });
        expect(occurrences).toHaveLength(2);
    });

    it('garde le choix des commentaires dans le troisième niveau', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} layoutOptions={{ commentsMode: 'auto' }} />);
        ouvrirDiagramme();
        deplier('Commentaires');
        fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
        expect(onAction).toHaveBeenCalledWith('commentsHide');
    });

    it('garde le curseur de dilatation dans le troisième niveau', () => {
        vi.useFakeTimers();
        const onPixelsPerSecondChange = vi.fn();
        render(<MenuBar pixelsPerSecond={10} onPixelsPerSecondChange={onPixelsPerSecondChange} />);
        ouvrirDiagramme();
        deplier('Dilatation');
        const curseur = screen.getByRole('slider');
        fireEvent.change(curseur, { target: { value: '14' } });
        expect(onPixelsPerSecondChange).toHaveBeenCalledWith(14);
    });
});

describe('MenuBar — Mise en page ▸ Verrouillage saisie', () => {
    const ouvrirVerrouillage = () => {
        const menu = menuMiseEnPage();
        const entree = within(menu).getByRole('button', { name: /^Verrouillage saisie/ }).closest('.menu-item-with-submenu');
        fireEvent.mouseEnter(entree);
        act(() => vi.runAllTimers());
        return entree;
    };

    it('ouvre le sous-menu sur « Tout verrouiller », suivi d’un séparateur', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const entree = ouvrirVerrouillage();
        const depliant = entree.querySelector('.submenu-dropdown');
        const enfants = [...depliant.children].map(el => el.className.includes('menu-separator') ? '—' : el.textContent.replace(/[✓▶]/g, '').trim());
        expect(enfants[0]).toBe('Tout verrouiller');
        expect(enfants[1]).toBe('—');
        expect(enfants[2]).toBe('Propriétés');
    });

    it('envoie l’action qui verrouille toutes les sections', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} />);
        ouvrirVerrouillage();
        fireEvent.click(screen.getByRole('button', { name: 'Tout verrouiller' }));
        expect(onAction).toHaveBeenCalledWith('verrouSaisie:tout');
    });

    it('devient « Tout déverrouiller » quand toutes les sections sont verrouillées', () => {
        vi.useFakeTimers();
        definirPrefsVerrou(Object.fromEntries(SECTIONS_VERROU.map(section => [section, true])));
        render(<MenuBar />);
        ouvrirVerrouillage();
        expect(screen.getByRole('button', { name: 'Tout déverrouiller' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Tout verrouiller' })).not.toBeInTheDocument();
    });
});
