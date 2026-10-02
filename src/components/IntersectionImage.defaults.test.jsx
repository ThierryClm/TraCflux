import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntersectionImage from './IntersectionImage';

const renderImage = ({ groups, arrows = [] }) => {
    const onArrowsChange = vi.fn();
    const result = render(
        <IntersectionImage
            groups={groups}
            imageData="data:image/png;base64,AA=="
            onImageChange={vi.fn()}
            arrows={arrows}
            onArrowsChange={onArrowsChange}
            cycleLength={60}
            simulationResult={null}
            isPlaying={false}
            setIsPlaying={vi.fn()}
            currentTime={0}
            setCurrentTime={vi.fn()}
            actionData={[]}
            selectedActions={[]}
            conflictMatrix={[]}
            imageBrightness={100}
            setImageBrightness={vi.fn()}
            imageContrast={100}
            setImageContrast={vi.fn()}
        />
    );

    const area = result.container.querySelector('.intersection-image-area');
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });

    return { area, onArrowsChange };
};

describe('IntersectionImage — valeurs des nouvelles flèches', () => {
    it('applique le retour métier lors du clic d’ajout', () => {
        const { area, onArrowsChange } = renderImage({
            groups: [{ id: 1, name: 'Droite', courant: 'TàD' }]
        });

        fireEvent.click(area, { clientX: 100, clientY: 50 });

        expect(onArrowsChange).toHaveBeenCalledOnce();
        expect(onArrowsChange.mock.calls[0][0]).toEqual([
            expect.objectContaining({ groupId: 1, x: 50, y: 50, turnLength: 0.4 })
        ]);
    });

    it('préserve les flèches existantes quand une flèche composée est ajoutée', () => {
        const existingArrow = {
            id: 10,
            groupId: 1,
            x: 20,
            y: 30,
            rotation: 0,
            turnLength: 0.8,
            length: 3
        };
        const { area, onArrowsChange } = renderImage({
            groups: [
                { id: 1, name: 'Existante', courant: 'TàG' },
                { id: 2, name: 'Composée', courant: 'TD_G_D' }
            ],
            arrows: [existingArrow]
        });

        fireEvent.click(area, { clientX: 100, clientY: 50 });

        const updatedArrows = onArrowsChange.mock.calls[0][0];
        expect(updatedArrows[0]).toBe(existingArrow);
        expect(updatedArrows[0]).toEqual(expect.objectContaining({ turnLength: 0.8, length: 3 }));
        expect(updatedArrows[1]).toEqual(expect.objectContaining({ groupId: 2, turnLength: 0.5 }));
    });
});
