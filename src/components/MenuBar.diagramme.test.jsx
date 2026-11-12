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
 * La barre a déjà un menu « Diagramme » ; les entrées du même nom vivent dans
 * le déroulant de « Mise en page ». Les recherches sont donc cadrées dessus.
 */
const trouverDepliantMiseEnPage = () => [...document.querySelectorAll('.menu-dropdown')]
    .find(d => d.textContent.includes('Détachement'));

/** Ouvre le menu Mise en page ; un second clic le refermerait, donc on réutilise. */
const menuMiseEnPage = () => {
    const ouvert = trouverDepliantMiseEnPage();
    if (ouvert) return ouvert;
    fireEvent.click(screen.getByRole('button', { name: 'Mise en page' }));
    return trouverDepliantMiseEnPage();
};

const boutonDuMenu = (libelle) =>
    within(menuMiseEnPage()).getByRole('button', { name: new RegExp(`^${libelle}`) });

/** Déplie une entrée de premier niveau (Configuration, Diagramme, Matrice…). */
const deplier = (libelle) => {
    const entree = boutonDuMenu(libelle).closest('.menu-item-with-submenu');
    fireEvent.mouseEnter(entree);
    act(() => vi.runAllTimers());
    return entree;
};

const libellesDe = (entree) => within(entree.querySelector('.submenu-dropdown')).getAllByRole('button')
    .map(b => b.textContent.replace(/[✓▶]/g, '').trim());

describe('MenuBar — Mise en page, trois groupes', () => {
    it('s’ouvre sur Configuration, puis Diagramme, puis Matrice', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const menu = menuMiseEnPage();
        const tete = within(menu).getAllByRole('button')
            .map(b => b.textContent.replace(/[✓▶]/g, '').trim());
        expect(tete.slice(0, 3)).toEqual(['Configuration', 'Diagramme', 'Matrice']);
    });

    it('range Affichage, Nom des GFx du formulaire, Réserve de capacité et Détecteur dans Configuration', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const configuration = deplier('Configuration');
        expect(libellesDe(configuration)).toEqual(['Affichage', 'Nom des GFx', 'Réserve de capacité', 'Détecteur']);
    });

    it('garde Nom des GFx du diagramme dans Diagramme, devant les autres réglages', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const diagramme = deplier('Diagramme');
        expect(libellesDe(diagramme)).toEqual([
            'Nom des GFx',
            'Commentaires',
            'Remarques',
            'Description des conditions micro',
            'Dilatation (zoom)'
        ]);
    });

    it('place Matrice après Diagramme, au-dessus du séparateur', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const menu = menuMiseEnPage();
        const enfants = [...menu.children].map(el => el.className.includes('menu-separator')
            ? '—'
            : el.textContent.replace(/[✓▶]/g, '').trim());
        expect(enfants).toEqual([
            'Configuration', 'Diagramme', 'Matrice', '—',
            'Détachement', '—',
            'Options de contraste', 'Verrouillage saisie...', 'Infobulles', 'Notifications'
        ]);
    });

    it('ne garde plus l’ancien sous-menu à trois sections', () => {
        vi.useFakeTimers();
        render(<MenuBar />);
        const menu = menuMiseEnPage();
        const tete = within(menu).getAllByRole('button')
            .map(b => b.textContent.replace(/[✓▶]/g, '').trim());
        expect(tete).not.toContain('Nom des groupes de feu dans...');
        expect(tete).not.toContain('Affichage des paramètres');
        expect(tete).not.toContain('Panneau Réserve de capacité');
    });

    it('donne à chaque case Nom des GFx la section qu’elle commande', () => {
        vi.useFakeTimers();
        const onAction = vi.fn();
        render(<MenuBar onAction={onAction} />);

        const configuration = deplier('Configuration');
        fireEvent.click(within(configuration.querySelector('.submenu-dropdown')).getByRole('button', { name: /Nom des GFx/ }));
        expect(onAction).toHaveBeenLastCalledWith('toggleGroupNamesForm');

        const diagramme = deplier('Diagramme');
        fireEvent.click(within(diagramme.querySelector('.submenu-dropdown')).getByRole('button', { name: /Nom des GFx/ }));
        expect(onAction).toHaveBeenLastCalledWith('toggleGroupNamesDiagram');

        const matrice = deplier('Matrice');
        fireEvent.click(within(matrice.querySelector('.submenu-dropdown')).getByRole('button', { name: /Nom des GFx/ }));
        expect(onAction).toHaveBeenLastCalledWith('toggleGroupNamesMatrix');
    });

    it('garde le curseur de dilatation au troisième niveau', () => {
        vi.useFakeTimers();
        const onPixelsPerSecondChange = vi.fn();
        render(<MenuBar pixelsPerSecond={10} onPixelsPerSecondChange={onPixelsPerSecondChange} />);
        const diagramme = deplier('Diagramme');
        const dilatation = within(diagramme.querySelector('.submenu-dropdown'))
            .getByRole('button', { name: /^Dilatation/ }).closest('.menu-item-with-submenu');
        fireEvent.mouseEnter(dilatation);
        act(() => vi.runAllTimers());
        fireEvent.change(screen.getByRole('slider'), { target: { value: '14' } });
        expect(onPixelsPerSecondChange).toHaveBeenCalledWith(14);
    });
});

describe('MenuBar — Mise en page ▸ Verrouillage saisie', () => {
    const ouvrirVerrouillage = () => {
        const entree = boutonDuMenu('Verrouillage saisie').closest('.menu-item-with-submenu');
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
