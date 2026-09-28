import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimelineHeader from './TimelineHeader';

const renderHeader = (props = {}) => {
    const componentProps = {
        activePFName: 'PF1',
        cycleLength: 60,
        cycleLengthInput: '60',
        isPlayingSimulation: false,
        simulationCurrentTime: 0,
        simulationSpeed: 1,
        tooltipsEnabled: true,
        onDetach: vi.fn(),
        setCycleLength: vi.fn(),
        setCycleLengthInput: vi.fn(),
        setIsPlayingSimulation: vi.fn(),
        setSimulationCurrentTime: vi.fn(),
        ...props
    };
    const result = render(
        <TimelineHeader {...componentProps} />
    );
    return { ...result, ...componentProps };
};

describe('TimelineHeader', () => {
    it('affiche le plan actif et permet de détacher le diagramme', () => {
        const { onDetach } = renderHeader();

        expect(screen.getByText('Diagramme - PF1')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Détacher' }));
        expect(onDetach).toHaveBeenCalledOnce();
    });

    it('ne rend rien quand le titre est porté par le bandeau', () => {
        const { container } = renderHeader({ titreEnBandeau: true });
        expect(container).toBeEmptyDOMElement();
    });

    it('valide une nouvelle durée de cycle', () => {
        const { setCycleLength } = renderHeader();
        const input = screen.getByRole('textbox', { name: /Cycle/ });

        fireEvent.change(input, { target: { value: '75' } });
        fireEvent.blur(input);

        expect(setCycleLength).toHaveBeenCalledWith(75);
    });

    it('affiche les commandes et pilote la lecture de simulation', () => {
        const { setIsPlayingSimulation, setSimulationCurrentTime } = renderHeader({
            planName: 'Plan test',
            setIsPlayingSimulation: vi.fn(),
            setSimulationCurrentTime: vi.fn(),
            simulationCurrentTime: 12,
            simulationResult: { simulatedCycleLength: 70 }
        });

        fireEvent.click(screen.getByRole('button', { name: 'Lancer la simulation' }));
        expect(setIsPlayingSimulation).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la simulation' }));
        expect(setIsPlayingSimulation).toHaveBeenCalledWith(false);
        expect(setSimulationCurrentTime).toHaveBeenCalledWith(0);
        expect(screen.getByText('12s / 70s')).toBeInTheDocument();
    });

    it('masque les actions interdites en lecture seule', () => {
        renderHeader({ planName: 'Plan test', readOnly: true, setIsPlayingSimulation: vi.fn() });

        expect(screen.queryByRole('button', { name: 'Détacher' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Lancer la simulation' })).not.toBeInTheDocument();
        expect(screen.getByText('Cycle 60 secondes')).toBeInTheDocument();
    });
});
