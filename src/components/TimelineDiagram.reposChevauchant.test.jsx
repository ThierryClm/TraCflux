import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

/**
 * Point de repos sur un vert qui chevauche la fin du cycle.
 *
 * Plan PF_Aiguillage du projet exemple (cycle 46), point de repos GF2 à 5 s.
 * GF2 (45 + 9 s) déborde sur le cycle suivant jusqu'à 8 s : il est vert à
 * 5 s, sa fin de vert recule de 10 s, et l'accolade de sa fermeture
 * anticipée (4-8 s) la suit jusqu'au bout — sans être décalée une seconde fois.
 */

const PPS = 10;
const POINT_REPOS_GF2 = 3;

const projet = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'Carrefour_Exemple.json'), 'utf8'));
const plan = projet.pfTabs.find(p => p.name === 'PF_Aiguillage');
const groupes = projet.groups.map(g => {
    const l = plan.diagram.find(d => d.groupId === g.id);
    return { ...g, offset: l.offset, durations: { ...g.durations, green: l.greenDuration } };
});

const ligne = (() => {
    const simulationResult = calculateSimulatedDiagram(groupes, plan.data, [POINT_REPOS_GF2], plan.cycleLength, plan.conflictMatrix);
    const { container } = render(
        <TimelineDiagram groups={groupes} cycleLength={plan.cycleLength} pixelsPerSecond={PPS} conflicts={[]}
            conflictMatrix={plan.conflictMatrix} actionData={plan.data} simulationResult={simulationResult}
            simulationFilter={new Set([POINT_REPOS_GF2])} biCarrefourSeparator={projet.biCarrefourSeparator}
            cycleLengthInput={String(plan.cycleLength)} setCycleLengthInput={() => {}} setCycleLength={() => {}}
            onGroupClick={() => {}} updateGroupParams={() => {}} updateActionRow={() => {}}
            setHoveredActionId={() => {}} startDrag={() => {}} endDrag={() => {}} />
    );
    const lignes = container.querySelectorAll('.timeline-row-track');
    return (id) => {
        const l = lignes[id - 1];
        // Fin de vert : bord droit de la dernière barre verte (partie reprise au début du cycle)
        const vert = [...l.querySelectorAll('.phase-bar.green')].pop();
        const finDeVert = parseFloat(vert.closest('.cycle-block').style.left) / PPS + parseFloat(vert.style.width) / PPS;
        const accolade = l.querySelector('.brace-marker');
        const debut = parseFloat(accolade.style.left) / PPS;
        return { finDeVert, accolade: `${debut}-${debut + parseFloat(accolade.style.width) / PPS}` };
    };
})();

describe('Point de repos et vert qui chevauche la fin du cycle', () => {
    it('GF2 : la fin de vert recule de 10 s et l\'accolade finit avec elle', () => {
        expect(ligne(2)).toEqual({ finDeVert: 18, accolade: '4-18' });
    });

    it('GF3 et GF4, chevauchants eux aussi', () => {
        expect(ligne(3)).toEqual({ finDeVert: 15, accolade: '0-15' });
        expect(ligne(4)).toEqual({ finDeVert: 16, accolade: '4-16' });
    });

    it('GF7, qui ne chevauche pas, reste juste', () => {
        expect(ligne(7)).toEqual({ finDeVert: 20, accolade: '18-20' });
    });
});
