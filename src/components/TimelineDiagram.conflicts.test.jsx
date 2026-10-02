import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

const groups = [
    {
        id: 1,
        name: 'G1',
        type: 'VL',
        courant: 'TD',
        minGreen: 5,
        offset: 0,
        durations: { green: 20, orange: 3, red: 37 }
    },
    {
        id: 2,
        name: 'G2',
        type: 'VL',
        courant: 'TD',
        minGreen: 5,
        offset: 30,
        durations: { green: 20, orange: 3, red: 37 }
    }
];

const renderConflict = (isConflict) => render(
    <TimelineDiagram
        groups={groups}
        cycleLength={60}
        pixelsPerSecond={3}
        conflicts={[]}
        conflictMatrix={[
            [0, 5],
            [0, 0]
        ]}
        actionData={[]}
        hoveredConflict={{ from: 1, to: 2, isConflict }}
        cycleLengthInput="60"
        setCycleLengthInput={() => {}}
        setCycleLength={() => {}}
        onGroupClick={() => {}}
        updateGroupParams={() => {}}
        updateActionRow={() => {}}
        setHoveredActionId={() => {}}
        startDrag={() => {}}
        endDrag={() => {}}
    />
);

describe('Diagramme — survol des conflits', () => {
    it('dessine un conflit majeur en rouge, épais et pointillé', () => {
        const { container } = renderConflict(true);
        const arrow = container.querySelector('.dependency-arrows line');

        expect(arrow).toHaveAttribute('stroke', 'red');
        expect(arrow).toHaveAttribute('stroke-width', '3');
        expect(arrow).toHaveAttribute('stroke-dasharray', '6,3');
        expect(arrow).toHaveAttribute('opacity', '0.9');
        expect(arrow).toHaveAttribute('marker-end', 'url(#dep-arrowhead-conflict)');
    });

    it('conserve le style discret pour un conflit potentiel', () => {
        const { container } = renderConflict(false);
        const arrow = container.querySelector('.dependency-arrows line');

        expect(arrow).toHaveAttribute('stroke', '#999');
        expect(arrow).toHaveAttribute('stroke-width', '1');
        expect(arrow).not.toHaveAttribute('stroke-dasharray');
        expect(arrow).toHaveAttribute('opacity', '0.6');
        expect(arrow).toHaveAttribute('marker-end', 'url(#dep-arrowhead)');
    });
});
