import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TimelineGridBackground, { TimelineEmptyState } from './TimelineGridBackground';

const groups = [{
    id: 1,
    type: 'V',
    durations: { green: 20 }
}];

const renderGrid = (props = {}) => render(
    <TimelineGridBackground
        groups={groups}
        isPlayingSimulation={false}
        pixelsPerSecond={2}
        playbackTime={null}
        rowTotalHeight={31}
        rulerHeight={50}
        simulationCurrentTime={null}
        simulationResult={null}
        timeWindow={20}
        tooltipsEnabled
        {...props}
    />
);

describe('TimelineGridBackground', () => {
    it('dessine la grille et les repères du cycle', () => {
        const { container } = renderGrid();

        expect(container.querySelectorAll('.grid-line')).toHaveLength(21);
        expect(container.querySelectorAll('.grid-10s')).toHaveLength(2);
        expect(container.querySelector('.grid-cycle-end')).not.toBeNull();
        expect(container.querySelectorAll('.ruler-tick')).toHaveLength(5);
    });

    it('normalise l’avancement de lecture dans le cycle', () => {
        const { container } = renderGrid({ playbackTime: -2 });
        expect(container.querySelector('.ruler-playback')).toHaveStyle({ width: '36px' });
    });

    it('affiche les points de repos et la tête de lecture', () => {
        const { container } = renderGrid({
            isPlayingSimulation: true,
            simulationCurrentTime: 7,
            simulationResult: { restPoints: [{ deb: 3, duration: 4, originalDeb: 5 }] }
        });

        expect(screen.getByText('Repos')).toBeInTheDocument();
        expect(container.querySelector('.rest-point-band')).toHaveStyle({ left: '6px', width: '8px', height: '112px' });
        expect(container.querySelector('.simulation-playhead.playing')).toHaveStyle({ left: '14px', height: '112px' });
        expect(screen.getByText('7s')).toBeInTheDocument();
    });

    it('guide la configuration quand aucun vert n’est défini', () => {
        render(
            <TimelineEmptyState
                groups={[{ id: 1, type: '', durations: { green: 0 } }]}
                conflictMatrix={[['']]}
                tooltipsEnabled
            />
        );

        expect(screen.getByText('Diagramme vide')).toBeInTheDocument();
        expect(screen.getByText(/Renseigner le formulaire des groupes/)).toBeInTheDocument();
        expect(screen.getByText(/Renseigner la matrice des temps interverts/)).toBeInTheDocument();
    });
});
