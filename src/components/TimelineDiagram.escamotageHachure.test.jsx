import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

/**
 * Vert escamotable en simulation, repris de l'aiguillage du carrefour exemple
 * (plan PF_Aiguillage) : GF9 s'escamote lui-même sur son vert 16-27 s.
 * Non coché, le vert reste visible sous des hachures ; coché, l'escamotage a
 * lieu et le vert disparaît. Cochée, la plage vient à la fois de la simulation
 * et de l'escamotage de groupe : elle n'est dessinée qu'une fois.
 */

const PPS = 10;

const groupe = (id, offset, green) => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset,
    durations: { green, orange: 3, red: 46 - green - 3 }
});

const groupes = [groupe(1, 16, 11), groupe(2, 31, 8)];

const action = (id, nom, gf, deb, fin, extra = {}) => ({
    id, action: nom, gf: String(gf), deb: String(deb), fin: String(fin),
    actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    plage1: '', plage2: '', abrv: '', description: '', micro: '', ...extra
});

const actions = [action(1, 'Escamotage', 1, 16, 27, { actGf1: '1' })];
const matrice = groupes.map(() => groupes.map(() => ''));

const coupesDuGf1 = (cochees) => {
    const simulationResult = calculateSimulatedDiagram(groupes, actions, cochees, 46, matrice);
    const { container } = render(
        <TimelineDiagram
            groups={groupes}
            cycleLength={46}
            pixelsPerSecond={PPS}
            conflicts={[]}
            conflictMatrix={matrice}
            actionData={actions}
            simulationResult={simulationResult}
            simulationFilter={new Set(cochees)}
            cycleLengthInput="46"
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
    const ligne = container.querySelectorAll('.timeline-row-track')[0];
    return [...ligne.querySelectorAll('.green-cut-overlay')].map(c => ({
        debut: parseFloat(c.style.left) / PPS,
        fin: (parseFloat(c.style.left) + parseFloat(c.style.width)) / PPS,
        escamote: c.classList.contains('escamote')
    }));
};

describe('Vert escamoté en simulation', () => {
    it("non coché : le vert reste visible, hachuré", () => {
        expect(coupesDuGf1([])).toEqual([{ debut: 16, fin: 27, escamote: false }]);
    });

    it("coché : l'escamotage a lieu, le vert disparaît — dessiné une seule fois", () => {
        expect(coupesDuGf1([1])).toEqual([{ debut: 16, fin: 27, escamote: true }]);
    });
});
