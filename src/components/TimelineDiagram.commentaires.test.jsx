import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimelineDiagram from './TimelineDiagram';

const group = {
    id: 1,
    name: 'G1',
    type: 'VL',
    courant: 'TD',
    minGreen: 5,
    offset: 0,
    durations: { green: 20, orange: 3, red: 37 },
    comment: '<span style="color: rgb(76, 175, 80); font-size: 24px">Priorité</span>'
};

const renderDiagram = (updateGroupParams) => render(
    <TimelineDiagram
        groups={[group]}
        cycleLength={60}
        pixelsPerSecond={3}
        conflicts={[]}
        conflictMatrix={[]}
        actionData={[]}
        cycleLengthInput="60"
        setCycleLengthInput={() => {}}
        setCycleLength={() => {}}
        onGroupClick={() => {}}
        updateGroupParams={updateGroupParams}
        updateActionRow={() => {}}
        setHoveredActionId={() => {}}
        startDrag={() => {}}
        endDrag={() => {}}
        showRemarks={false}
    />
);

describe('Diagramme — réinitialisation des commentaires', () => {
    it('retire couleur et taille du commentaire actif en conservant son texte', () => {
        const updateGroupParams = vi.fn();
        const { container } = renderDiagram(updateGroupParams);
        const editable = container.querySelector('.input-comment');

        fireEvent.focus(editable);
        fireEvent.mouseDown(screen.getByRole('button', {
            name: 'Réinitialiser la couleur et la taille du commentaire actif'
        }));

        expect(editable.innerHTML).toBe('Priorité');
        expect(updateGroupParams).toHaveBeenCalledWith(1, { comment: 'Priorité' });
    });
});
