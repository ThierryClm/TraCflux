import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../utils/simulationCalculator';

/**
 * Accolade d'une fermeture anticipée en simulation, quand un adaptatif
 * vertical PARTIEL est coché avant elle.
 *
 * Repris du plan ACTUEL du projet exemple : l'adaptatif vertical de GF2
 * (11-15 s, plage GF1 à GF7) raccourcit de 4 s les groupes de sa plage. La
 * fermeture anticipée de GF4 (16-28 s) est entièrement après la zone : elle
 * doit reculer de 4 s, à 12-24 s. Son début était repoussé à 15 s.
 */

const PPS = 10;

const groupe = (id, offset, green) => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset,
    durations: { green, orange: 3, red: 70 - green - 3 }
});

const groupes = [groupe(1, 37, 29), groupe(2, 1, 14), groupe(3, 1, 14), groupe(4, 0, 28)];

const action = (id, nom, gf, deb, fin, extra = {}) => ({
    id, action: nom, gf: String(gf), deb: String(deb), fin: String(fin),
    actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    plage1: '', plage2: '', abrv: '', description: '', micro: '', ...extra
});

const actions = [
    action(1, 'Adaptatif vertical', 2, 11, 15, { plage1: '1', plage2: '4' }),
    action(2, 'Fermeture anticipée', 4, 16, 28, { actGf1: '1', abrv: 'si BP' })
];

const matrice = groupes.map(() => groupes.map(() => ''));

const accoladeDuGf4 = (cochees) => {
    const simulationResult = calculateSimulatedDiagram(groupes, actions, cochees, 70, matrice);
    const { container } = render(
        <TimelineDiagram
            groups={groupes}
            cycleLength={70}
            pixelsPerSecond={PPS}
            conflicts={[]}
            conflictMatrix={matrice}
            actionData={actions}
            simulationResult={simulationResult}
            simulationFilter={new Set(cochees)}
            cycleLengthInput="70"
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
    const ligne = container.querySelectorAll('.timeline-row-track')[3];
    const accolade = ligne.querySelector('.brace-marker');
    const debut = parseFloat(accolade.style.left) / PPS;
    return { debut, fin: debut + parseFloat(accolade.style.width) / PPS };
};

describe('Accolade de fermeture anticipée et adaptatif vertical partiel', () => {
    it("sans simulation, l'accolade est à sa place", () => {
        expect(accoladeDuGf4([])).toEqual({ debut: 16, fin: 28 });
    });

    it("recule de la durée de l'adaptatif quand elle est après la zone", () => {
        expect(accoladeDuGf4([1])).toEqual({ debut: 12, fin: 24 });
    });
});
