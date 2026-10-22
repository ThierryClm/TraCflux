import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PhasageBulle from './PhasageBulle';

// Bus B3 : vert principal 0-6 s, seconde lucarne 42-48 s, cycle de 80 s.
const groups = [{ id: 3, name: 'B3 Bus', type: 'B', courant: 'TD', minGreen: 6, offset: 0,
    durations: { green: 6, orange: 3, red: 71 } }];
const fleches = [{ id: 1, groupId: 3, x: 50, y: 50, rotation: 0, scale: 1 }];
const lucarne = (gf) => ({ id: 7, gf, action: 'Seconde lucarne', description: '', deb: 42, fin: 48, abrv: 'Luc2',
    micro: '', plage1: '', plage2: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '' });

const couleurA45s = (props) => {
    const { container } = render(<PhasageBulle groups={groups} cycleLength={80} intersectionImage="data:image/png;base64,AAAA"
        intersectionArrows={fleches} initialCount={1} initialTimes={[45, 0, 0, 0, 0, 0]} {...props} />);
    return container.querySelector('.phase-arrow-symbol').innerHTML;
};

describe('phasage bulle : seconde lucarne', () => {
    it('hors simulation, la seconde lucarne fait partie du plan : flèche verte', () => {
        expect(couleurA45s({ actionData: [lucarne('3')] })).toContain('rgb(0, 180, 0)');
    });

    it('GF enregistré en nombre dans le projet : même résultat', () => {
        expect(couleurA45s({ actionData: [lucarne(3)] })).toContain('rgb(0, 180, 0)');
    });

    it('en simulation, la seconde lucarne non cochée reste au rouge', () => {
        const simulationResult = { simulatedCycleLength: 80, simulatedGroups: groups.map(g => ({ ...g, simulatedOffset: 0, simulatedGreen: 6 })) };
        const html = couleurA45s({ actionData: [lucarne('3')], simulationResult, selectedActions: [] });
        expect(html).not.toContain('rgb(0, 180, 0)');
        expect(couleurA45s({ actionData: [lucarne('3')], simulationResult, selectedActions: [7] })).toContain('rgb(0, 180, 0)');
    });
});
