import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SimulationPanel from './SimulationPanel';

/**
 * Survoler une action à cocher signale l'action, pour allumer ses flèches
 * dans l'image du carrefour ; sortir de l'action, ou quitter l'onglet, les
 * éteint.
 */

const groupes = [1, 2].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5,
    offset: (id - 1) * 30, durations: { green: 20, orange: 3, red: 37 }
}));
const actions = [{ id: 7, action: 'Escamotage', gf: '2', deb: '30', fin: '40', description: '', plage1: '', plage2: '', actGf1: '' }];

const panneau = (onSurvolAction) => render(
    <SimulationPanel
        actionData={actions} selectedActions={[]} onToggle={() => {}}
        groups={groupes} cycleLength={60} conflictMatrix={[]}
        hoveredActionId={null} setHoveredActionId={() => {}}
        onSurvolAction={onSurvolAction}
    />
);

describe('Simulation — survol d\'une action', () => {
    it('entrer puis sortir de l\'action la signale puis l\'efface', () => {
        const onSurvolAction = vi.fn();
        const { container } = panneau(onSurvolAction);
        const item = container.querySelector('.simulation-item');
        fireEvent.mouseEnter(item);
        expect(onSurvolAction).toHaveBeenLastCalledWith(7);
        fireEvent.mouseLeave(item);
        expect(onSurvolAction).toHaveBeenLastCalledWith(null);
    });

    it('quitter l\'onglet pendant le survol éteint les flèches', () => {
        const onSurvolAction = vi.fn();
        const { container, unmount } = panneau(onSurvolAction);
        fireEvent.mouseEnter(container.querySelector('.simulation-item'));
        unmount();
        expect(onSurvolAction).toHaveBeenLastCalledWith(null);
    });
});
