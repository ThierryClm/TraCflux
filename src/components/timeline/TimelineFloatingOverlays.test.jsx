import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TimelineFloatingOverlays from './TimelineFloatingOverlays';

const renderOverlays = (props = {}) => render(
    <TimelineFloatingOverlays
        actionData={[]}
        actionTooltip={null}
        cycleLength={60}
        dragState={null}
        microVariableNames={[]}
        {...props}
    />
);

describe('TimelineFloatingOverlays', () => {
    it('affiche la valeur normalisée pendant le glissement d’un groupe', () => {
        renderOverlays({
            dragState: { groupId: 1, initialValue: 58, deltaSeconds: 5, mouseX: 10, mouseY: 20 }
        });

        expect(screen.getByText('3s')).toBeInTheDocument();
    });

    it('affiche la valeur courante pendant le glissement d’une action', () => {
        renderOverlays({
            dragState: { showTooltip: true, currentValue: 17.6, mouseX: 10, mouseY: 20 }
        });

        expect(screen.getByText('18s')).toBeInTheDocument();
    });

    it('décrit une fermeture anticipée et ses groupes cibles', () => {
        renderOverlays({
            actionData: [{
                id: 5,
                action: 'Fermeture anticipée',
                deb: '10',
                fin: '20',
                actGf1: 'GF2',
                actGf1Gf2: '3'
            }],
            actionTooltip: { actionId: 5, showMicro: false, x: 0, y: 0 }
        });

        expect(screen.getByText('seconde 10 à 20')).toBeInTheDocument();
        expect(screen.getByText('glissement sur GF2 et GF3')).toBeInTheDocument();
    });

    it('affiche les variables micro enrichies après temporisation', () => {
        renderOverlays({
            actionData: [{ id: 7, action: 'Action', deb: '2', fin: '4', micro: 'SI CAPTEUR ALORS' }],
            actionTooltip: { actionId: 7, showMicro: true, x: 0, y: 0 },
            microVariableNames: ['CAPTEUR']
        });

        expect(document.querySelector('.action-hover-tooltip-micro')).toHaveTextContent('SI CAPTEUR ALORS');
    });
});
