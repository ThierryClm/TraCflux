import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SimulationPanel from './SimulationPanel';
import TimelineFloatingOverlays from './timeline/TimelineFloatingOverlays';

/**
 * Case « Actions micro » de Mise en page → Infobulles : elle couvre tout le
 * panneau Simulation et la bulle d'une action survolée dans le diagramme.
 */

const groupes = [1, 2].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5,
    offset: (id - 1) * 30, durations: { green: 20, orange: 3, red: 37 }
}));
const actions = [{ id: 1, action: 'Escamotage de phase', gf: '1', deb: '10', fin: '20', description: 'Escamotage long' }];

const panneau = (props = {}) => render(
    <SimulationPanel
        actionData={actions}
        selectedActions={[]}
        onToggle={() => {}}
        groups={groupes}
        cycleLength={60}
        conflictMatrix={[]}
        hoveredActionId={null}
        setHoveredActionId={() => {}}
        {...props}
    />
);

describe('infobulles « Actions micro »', () => {
    it('le panneau Simulation porte ses infobulles par défaut', () => {
        panneau();
        expect(screen.getByRole('button', { name: 'Enregistrer…' })).toHaveAttribute('title');
        expect(screen.getByText('Escamotage long')).toHaveAttribute('title', 'Escamotage long');
    });

    it('case décochée : plus aucune infobulle dans le panneau Simulation', () => {
        const { container } = panneau({ tooltipsEnabled: false });
        expect(screen.getByRole('button', { name: 'Enregistrer…' })).not.toHaveAttribute('title');
        expect(screen.getByRole('button', { name: 'Supprimer…' })).not.toHaveAttribute('title');
        expect(screen.getByText('Escamotage long')).not.toHaveAttribute('title');
        expect(container.querySelectorAll('[title]')).toHaveLength(0);
    });

    it('case décochée : pas de bulle pour l\'action survolée dans le diagramme', () => {
        const bulle = { actionId: 1, showMicro: false, x: 10, y: 10 };
        const props = { actionData: actions, actionTooltip: bulle, cycleLength: 60, dragState: null, microVariableNames: [] };
        const { container, rerender } = render(<TimelineFloatingOverlays {...props} />);
        expect(container.querySelector('.action-hover-tooltip')).not.toBeNull();

        rerender(<TimelineFloatingOverlays {...props} actionTooltipsEnabled={false} />);
        expect(container.querySelector('.action-hover-tooltip')).toBeNull();
    });
});
