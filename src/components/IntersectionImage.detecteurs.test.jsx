import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntersectionImage from './IntersectionImage';

const GROUPE = {
    id: 1,
    name: 'Nord',
    type: 'V',
    courant: 'TD',
    minGreen: 6,
    offset: 0,
    durations: { green: 30, orange: 3, red: 27 }
};

const DETECTEUR = {
    id: 7,
    nom: 'Boucle nord',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 5,
    position: { x: 25, y: 40 },
    orientation: 0,
    note: ''
};

const rendre = ({
    detecteurs = [DETECTEUR],
    showDetecteurs = true,
    showArrows = false,
    onDetecteursChange = vi.fn(),
    onDisplayOptionChange = vi.fn(),
    pixelsParMetre = 10
} = {}) => {
    const result = render(
        <IntersectionImage
            groups={[GROUPE]}
            imageData="data:image/png;base64,AA=="
            onImageChange={vi.fn()}
            arrows={[]}
            onArrowsChange={vi.fn()}
            detecteurs={detecteurs}
            onDetecteursChange={onDetecteursChange}
            pixelsParMetre={pixelsParMetre}
            cycleLength={60}
            isPlaying={false}
            setIsPlaying={vi.fn()}
            currentTime={0}
            setCurrentTime={vi.fn()}
            actionData={[]}
            selectedActions={[]}
            conflictMatrix={[]}
            displayOptions={{ showGroupNumbers: false, showGroupNames: false, showArrows, showSignals: false, showDetecteurs }}
            onDisplayOptionChange={onDisplayOptionChange}
        />
    );
    const area = result.container.querySelector('.intersection-image-area');
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    return { ...result, area, onDetecteursChange, onDisplayOptionChange };
};

describe('IntersectionImage — calque des détecteurs', () => {
    it('dessine le détecteur posé, avec son nom et sa longueur en mètres', () => {
        const { container } = rendre();
        const marqueur = container.querySelector('.detecteur-marker');
        expect(marqueur).not.toBeNull();
        expect(marqueur.style.left).toBe('25%');
        expect(marqueur.style.top).toBe('40%');
        const etiquette = screen.getByText('Boucle nord');
        expect(etiquette).toHaveClass('dans-boucle');
        expect(etiquette).toHaveStyle({ top: '0px' });
        const symbole = container.querySelector('.detecteur-symbol');
        expect(symbole.style.width).toBe('10px');
        expect(symbole.style.height).toBe('50px');
    });

    it('pose le nom juste au-dessus d’une boucle courte', () => {
        rendre({ detecteurs: [{ ...DETECTEUR, dimension: 2 }] });
        const etiquette = screen.getByText('Boucle nord');
        expect(etiquette).toHaveClass('au-dessus');
        expect(etiquette).not.toHaveClass('dans-boucle');
        expect(etiquette.style.top).toBe('-16px');
    });

    it('masque tout le calque quand la case Détecteurs est décochée', () => {
        const { container } = rendre({ showDetecteurs: false });
        expect(container.querySelector('.detecteur-marker')).toBeNull();
    });

    it('ajoute un détecteur au clic quand la case est cochée', () => {
        const { area, onDetecteursChange } = rendre({ detecteurs: [] });
        fireEvent.click(screen.getByLabelText('Ajouter un détecteur'));
        fireEvent.click(area, { clientX: 50, clientY: 75 });

        expect(onDetecteursChange).toHaveBeenCalledWith([
            expect.objectContaining({
                nom: 'Détecteur 1',
                categorie: 'bouclePiedFeu',
                position: { x: 25, y: 75 }
            })
        ]);
    });

    it('rend les deux modes de placement exclusifs', () => {
        const { onDisplayOptionChange } = rendre({ detecteurs: [] });
        const ajout = screen.getByLabelText('Ajouter un détecteur');
        fireEvent.click(ajout);
        expect(ajout).toBeChecked();

        fireEvent.click(screen.getByLabelText('Ajouter un courant de circulation'));
        expect(ajout).not.toBeChecked();
        expect(onDisplayOptionChange).toHaveBeenCalledWith('showArrows', true);
    });

    it('sélectionne le détecteur et tourne le symbole depuis l’éditeur', () => {
        const { container, onDetecteursChange } = rendre();
        fireEvent.click(container.querySelector('.detecteur-symbol'));
        expect(screen.getByText('Modifier le détecteur')).toBeInTheDocument();
        expect(screen.getByText('Boucle de pied de feu')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('+1°'));
        expect(onDetecteursChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: 7, orientation: 1 })
        ]);
    });

    it('retire le symbole de l’image sans supprimer le détecteur', () => {
        const { container, onDetecteursChange } = rendre();
        fireEvent.click(container.querySelector('.detecteur-symbol'));
        fireEvent.click(screen.getByRole('button', { name: /Retirer de l.image/ }));
        expect(onDetecteursChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: 7, position: null })
        ]);
    });
});
