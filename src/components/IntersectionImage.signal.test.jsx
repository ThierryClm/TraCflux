import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntersectionImage from './IntersectionImage';

const GROUPES = [
    { id: 1, name: 'Nord', courant: 'TàG', signal: 'R14tg', offset: 0, durations: { green: 30, orange: 3, red: 27 } },
    { id: 2, name: 'Sud', courant: 'TD', signal: '', offset: 0, durations: { green: 30, orange: 3, red: 27 } }
];
const FLECHES = [
    { id: 1, groupId: 1, x: 20, y: 20, rotation: 90, scale: 2 },
    { id: 2, groupId: 2, x: 60, y: 60, rotation: 45 }
];

const renderImage = ({ showSignals, onDisplayOptionChange = vi.fn(), onArrowsChange = vi.fn(), isPlaying = false }) => render(
    <IntersectionImage
        groups={GROUPES}
        imageData="data:image/png;base64,AA=="
        onImageChange={vi.fn()}
        arrows={FLECHES}
        onArrowsChange={onArrowsChange}
        cycleLength={60}
        isPlaying={isPlaying}
        currentTime={0}
        actionData={[]}
        selectedActions={[]}
        conflictMatrix={[]}
        displayOptions={{ showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals }}
        onDisplayOptionChange={onDisplayOptionChange}
    />
);

const marqueur = (container, index) => container.querySelectorAll('.arrow-marker')[index];

describe('IntersectionImage — case Signal', () => {
    it('garde les flèches tant que la case est décochée', () => {
        renderImage({ showSignals: false });
        expect(screen.queryByRole('img', { name: /^Signal/ })).toBeNull();
    });

    it('remplace la flèche du groupe qui a un signal, et de lui seul', () => {
        const { container } = renderImage({ showSignals: true });
        const signal = screen.getByRole('img', { name: 'Signal R14tg' });
        expect(marqueur(container, 0).contains(signal)).toBe(true);
        expect(signal.dataset.forme).toBe('tg');
        expect(marqueur(container, 1).querySelector('[role="img"]')).toBeNull();
        expect(marqueur(container, 1).querySelector('svg')).not.toBeNull();
    });

    it("suit l'échelle de la flèche, réduite de moitié, mais jamais sa rotation", () => {
        const { container } = renderImage({ showSignals: true });
        expect(marqueur(container, 0).querySelector('.arrow-symbol').style.transform).toBe('scale(1)');
        expect(marqueur(container, 1).querySelector('.arrow-symbol').style.transform).toContain('rotate(45deg)');
    });

    it('prend la couleur de l’état du groupe', () => {
        renderImage({ showSignals: true });
        expect(screen.getByRole('img', { name: 'Signal R14tg' }).innerHTML).toContain('rgb(0, 255, 0)');
    });

    it("place l'étiquette d'un piéton sous le signal, plus à côté", () => {
        const groupes = [{ ...GROUPES[0], courant: 'Piéton', signal: 'R12' }, { ...GROUPES[1], courant: 'Piéton' }];
        const { container } = render(
            <IntersectionImage
                groups={groupes} imageData="data:image/png;base64,AA==" onImageChange={vi.fn()} arrows={FLECHES}
                onArrowsChange={vi.fn()} cycleLength={60} currentTime={0} actionData={[]} selectedActions={[]} conflictMatrix={[]}
                displayOptions={{ showGroupNumbers: false, showGroupNames: true, showArrows: false, showSignals: true }}
            />
        );
        expect(marqueur(container, 0).classList.contains('side-label')).toBe(false);
        expect(marqueur(container, 1).classList.contains('side-label')).toBe(true);
    });

    it('la case enregistre le choix', () => {
        const onDisplayOptionChange = vi.fn();
        renderImage({ showSignals: false, onDisplayOptionChange });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Signal' }));
        expect(onDisplayOptionChange).toHaveBeenCalledWith('showSignals', true);
    });

    it('écarte le numéro de groupe du pictogramme', () => {
        const { container } = renderImage({ showSignals: true });
        const numeros = container.querySelectorAll('.group-number-centroid');
        expect(numeros[0].textContent).toBe('1');
        expect(parseFloat(numeros[0].style.left)).toBeGreaterThan(20);
        expect(parseFloat(numeros[0].style.top)).toBeLessThan(20);
        expect(numeros[1].style.left).toBe('60%');
    });

    it('le double-clic ne tourne pas une flèche que le signal cache', () => {
        const onArrowsChange = vi.fn();
        const { container } = renderImage({ showSignals: true, onArrowsChange });
        fireEvent.doubleClick(marqueur(container, 0));
        expect(onArrowsChange).not.toHaveBeenCalled();
    });

    it("n'offre plus la rotation sur un signal, et la rend à la flèche voisine", () => {
        const { container } = renderImage({ showSignals: true });
        fireEvent.click(marqueur(container, 0));
        expect(screen.getByRole('heading', { name: 'Modifier le signal' })).toBeTruthy();
        expect(screen.queryByText('Rotation:')).toBeNull();
        fireEvent.click(marqueur(container, 1));
        expect(screen.getByRole('heading', { name: 'Modifier la flèche' })).toBeTruthy();
        expect(screen.getByText('Rotation:')).toBeTruthy();
    });
});
