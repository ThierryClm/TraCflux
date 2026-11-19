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
const FLECHE = { id: 11, groupId: 1, x: 60, y: 30, rotation: 0 };

const rendre = () => render(
    <IntersectionImage
        groups={[GROUPE]}
        imageData="data:image/png;base64,AA=="
        onImageChange={vi.fn()}
        arrows={[FLECHE]}
        onArrowsChange={vi.fn()}
        detecteurs={[DETECTEUR]}
        onDetecteursChange={vi.fn()}
        detecteurModule
        pixelsParMetre={10}
        cycleLength={60}
        isPlaying={false}
        setIsPlaying={vi.fn()}
        currentTime={0}
        setCurrentTime={vi.fn()}
        actionData={[]}
        selectedActions={[]}
        conflictMatrix={[]}
        displayOptions={{ showGroupNumbers: false, showGroupNames: false, showArrows: false, showSignals: false, showDetecteurs: true }}
    />
);

describe('IntersectionImage — sélection du panneau de droite', () => {
    it('montre le détecteur quand on clique sa boucle', () => {
        const { container } = rendre();
        fireEvent.click(container.querySelector('.detecteur-marker'));
        expect(screen.getByText('Modifier le détecteur')).toBeInTheDocument();
        expect(screen.queryByText('Modifier la flèche')).toBeNull();
    });

    it('passe à l’éditeur de la flèche quand on clique une flèche', () => {
        const { container } = rendre();
        fireEvent.click(container.querySelector('.detecteur-marker'));
        fireEvent.click(container.querySelector('.arrow-marker'));

        expect(screen.queryByText('Modifier le détecteur')).toBeNull();
        expect(screen.getByText('Modifier la flèche')).toBeInTheDocument();
    });

    it('revient au détecteur en cliquant de nouveau sa boucle', () => {
        const { container } = rendre();
        fireEvent.click(container.querySelector('.arrow-marker'));
        fireEvent.click(container.querySelector('.detecteur-marker'));
        expect(screen.getByText('Modifier le détecteur')).toBeInTheDocument();
        expect(screen.queryByText('Modifier la flèche')).toBeNull();
    });
});
