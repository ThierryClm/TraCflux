import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import HelpContent from './HelpContent';
import MenuBar from './MenuBar';
import { allerAuMenu } from '../utils/renvoiMenu';
import { toast } from '../utils/toast';

const OPTIONS = { tooltipPrefs: {}, toastPrefs: {} };

const dessiner = (props = {}) => render(
    <>
        <MenuBar hasPermission={() => true} hasActiveProject layoutOptions={OPTIONS} onAction={() => {}} />
        <HelpContent {...props} />
    </>
);

const renvoi = (container, selecteur, chemin) => container.querySelector(`[${selecteur}="${chemin}"]`);

describe("Renvois de l'aide", () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
        vi.spyOn(window, 'focus').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('chaque renvoi de menu conduit à une entrée qui existe', () => {
        const { container } = dessiner();
        const chemins = [...container.querySelectorAll('[data-aide-menu]')].map(lien => lien.dataset.aideMenu);
        expect(chemins.length).toBeGreaterThan(20);
        const introuvables = chemins.filter(chemin => !act(() => allerAuMenu(chemin)));
        expect(introuvables).toEqual([]);
    });

    it('chaque renvoi de section conduit à un titre qui existe', () => {
        const { container } = dessiner();
        const titres = [...container.querySelectorAll('h3, h4')].map(titre => titre.textContent.trim());
        const renvois = [...container.querySelectorAll('[data-aide-section]')].map(lien => lien.dataset.aideSection);
        expect(renvois.length).toBeGreaterThan(5);
        expect(renvois.filter(titre => !titres.includes(titre))).toEqual([]);
    });

    it('amène à la section visée', () => {
        const { container } = dessiner();
        const cible = [...container.querySelectorAll('h4')].find(titre => titre.textContent === 'Import DiagFeux');
        Element.prototype.scrollIntoView.mockClear();
        fireEvent.click(renvoi(container, 'data-aide-section', 'Import DiagFeux'));
        expect(Element.prototype.scrollIntoView.mock.contexts).toContain(cible);
    });

    it('déplie le menu et signale l\'entrée, sans fermer l\'aide détachée', () => {
        const { container } = dessiner();
        fireEvent.click(renvoi(container, 'data-aide-menu', 'Mise en page → Infobulles → Formulaire'));
        const menus = container.querySelector('.menu-bar');
        expect(within(menus).getByText('Page principale')).toBeInTheDocument();
        expect(menus.querySelector('.menu-repere')).toHaveTextContent('Formulaire');
        expect(window.focus).toHaveBeenCalled();
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('referme l\'aide affichée dans la page, qui recouvrirait le menu', () => {
        const onFermer = vi.fn();
        const { container } = dessiner({ onFermer });
        fireEvent.click(renvoi(container, 'data-aide-menu', 'Mise en page → Options de contraste'));
        expect(onFermer).toHaveBeenCalled();
    });

    it('sans projet, annonce que le menu est inactif et laisse l\'aide ouverte', () => {
        const info = vi.spyOn(toast, 'info');
        const onFermer = vi.fn();
        const { container } = render(
            <>
                <MenuBar hasPermission={() => true} layoutOptions={OPTIONS} onAction={() => {}} />
                <HelpContent onFermer={onFermer} />
            </>
        );
        fireEvent.click(renvoi(container, 'data-aide-menu', 'Mise en page → Options de contraste'));
        expect(info).toHaveBeenCalledWith(expect.stringContaining('Mise en page'));
        expect(onFermer).not.toHaveBeenCalled();
        expect(container.querySelector('.menu-repere')).toBeNull();
    });

    it('reste un simple texte sans barre de menus', () => {
        const { container } = render(<HelpContent />);
        expect(container.querySelector('.help-content')).toHaveClass('sans-menu');
    });
});
