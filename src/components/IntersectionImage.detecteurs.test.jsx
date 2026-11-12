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
    detecteurModule = true,
    showDetecteurs = true,
    showArrows = false,
    onDetecteursChange = vi.fn(),
    onDisplayOptionChange = vi.fn(),
    onPixelsParMetreChange,
    pixelsParMetre = 10,
    currentTime = 0,
    getTrafficData = () => undefined
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
            detecteurModule={detecteurModule}
            pixelsParMetre={pixelsParMetre}
            onPixelsParMetreChange={onPixelsParMetreChange}
            cycleLength={60}
            isPlaying={false}
            setIsPlaying={vi.fn()}
            currentTime={currentTime}
            setCurrentTime={vi.fn()}
            getTrafficData={getTrafficData}
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

    it('remplit la boucle en orange quand elle est occupée à l’instant affiché', () => {
        const { container } = rendre({
            currentTime: 40,
            getTrafficData: () => ({ trafficVol: 600 })
        });
        const remplissage = container.querySelector('.detecteur-symbol rect');
        expect(remplissage.getAttribute('fill')).toBe('rgba(255, 152, 0, 0.45)');
    });

    it('laisse la boucle vide entre deux véhicules', () => {
        const { container } = rendre({
            currentTime: 1.1,
            getTrafficData: () => ({ trafficVol: 600 })
        });
        const remplissage = container.querySelector('.detecteur-symbol rect');
        expect(remplissage.getAttribute('fill')).toBe('none');
    });

    it('garde les objets détecteurs mais retire leur nom et l’échelle quand le module est désactivé', () => {
        const { container } = rendre({ detecteurModule: false, onPixelsParMetreChange: vi.fn() });
        expect(container.querySelector('.detecteur-marker')).not.toBeNull();
        expect(screen.queryByText('Boucle nord')).toBeNull();
        expect(screen.queryByLabelText('Pixels par mètre')).toBeNull();
    });

    it('affiche l’échelle de l’image dans les paramètres et l’enregistre', () => {
        const onPixelsParMetreChange = vi.fn();
        rendre({ onPixelsParMetreChange, pixelsParMetre: 12 });
        const champ = screen.getByLabelText('Pixels par mètre');
        expect(champ).toHaveValue('12');
        fireEvent.change(champ, { target: { value: '20' } });
        fireEvent.blur(champ);
        expect(onPixelsParMetreChange).toHaveBeenCalledWith(20);
    });

    it('présente les deux familles de cases, courants et détecteurs', () => {
        rendre({ detecteurModule: true });
        expect(screen.getByLabelText('Courant de circulation')).toBeInTheDocument();
        expect(screen.getByLabelText('Numéro GF')).toBeInTheDocument();
        expect(screen.getByLabelText('Nom GF')).toBeInTheDocument();
        expect(screen.getByLabelText('Ajouter une flèche')).toBeInTheDocument();
        expect(screen.getByLabelText('Signaux')).toBeInTheDocument();
        expect(screen.getByLabelText('Détecteur')).toBeInTheDocument();
        expect(screen.getByLabelText('Afficher nom')).toBeInTheDocument();
        expect(screen.getByLabelText('Ajouter')).toBeInTheDocument();
    });

    it('masque tout le calque quand la case Détecteurs est décochée', () => {
        const { container } = rendre({ showDetecteurs: false });
        expect(container.querySelector('.detecteur-marker')).toBeNull();
    });

    it('pose le prochain détecteur de la liste au clic', () => {
        const { area, onDetecteursChange } = rendre({
            detecteurs: [{ ...DETECTEUR, position: null }]
        });
        fireEvent.click(screen.getByLabelText('Ajouter'));
        fireEvent.click(area, { clientX: 50, clientY: 75 });

        expect(onDetecteursChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: 7, position: { x: 25, y: 75 } })
        ]);
    });

    it('ne crée pas de détecteur depuis l’image quand la liste est vide', () => {
        const { area, onDetecteursChange } = rendre({ detecteurs: [] });
        fireEvent.click(screen.getByLabelText('Ajouter'));
        fireEvent.click(area, { clientX: 50, clientY: 75 });
        expect(onDetecteursChange).not.toHaveBeenCalled();
    });

    it('rend les deux modes de placement exclusifs', () => {
        const { onDisplayOptionChange } = rendre({ detecteurs: [{ ...DETECTEUR, position: null }] });
        const ajout = screen.getByLabelText('Ajouter');
        fireEvent.click(ajout);
        expect(ajout).toBeChecked();

        fireEvent.click(screen.getByLabelText('Ajouter une flèche'));
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

    it('permet de choisir le détecteur et son type dans l’éditeur', () => {
        const autre = { ...DETECTEUR, id: 8, nom: 'Radar sud', categorie: 'radar', position: { x: 60, y: 60 } };
        const { container, onDetecteursChange } = rendre({ detecteurs: [DETECTEUR, autre] });
        fireEvent.click(container.querySelectorAll('.detecteur-symbol')[0]);

        const choix = screen.getByLabelText('Choisir le détecteur');
        expect(choix).toHaveValue('7');
        fireEvent.change(choix, { target: { value: '8' } });
        expect(screen.getByLabelText('Choisir le détecteur')).toHaveValue('8');
        expect(screen.getByLabelText(/Type du détecteur dans/)).toHaveValue('radar');

        fireEvent.change(screen.getByLabelText('Choisir le détecteur'), { target: { value: '7' } });
        fireEvent.change(screen.getByLabelText(/Type du détecteur dans/), { target: { value: 'boucleComptage' } });
        const dernier = onDetecteursChange.mock.calls.at(-1)[0];
        expect(dernier.find(d => d.id === 7).categorie).toBe('boucleComptage');
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
