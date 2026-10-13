import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

/**
 * Synchro BTS et Instant Co en simulation.
 *
 * Ce sont des repères de synchronisation : ils n'agissent pas sur le cycle et
 * ne figurent pas parmi les actions à cocher. Ils restent donc affichés en
 * simulation — ils n'y apparaissaient auparavant que cochés — et à leur
 * instant saisi : un adaptatif qui retire des secondes avant eux ne les
 * déplace pas.
 */

const PPS = 3;

const groupes = [1, 2, 3].map(id => ({
    id,
    name: `G${id}`,
    type: 'VL',
    courant: 'TD',
    minGreen: 5,
    offset: (id - 1) * 20,
    durations: { green: 15, orange: 3, red: 42 }
}));

const ligneVide = { gf: '', fin: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', plage1: '', plage2: '', abrv: '', description: '', micro: '' };

// Adaptatif pleine largeur de 5 à 8 s : le cycle simulé perd 3 secondes,
// avant l'instant des repères.
const adaptatif = { ...ligneVide, id: 1, action: 'Adaptatif vertical', deb: '5', fin: '8' };
const repere = (id, nom) => ({ ...ligneVide, id, action: nom, deb: '30', plage1: '1', plage2: '3', abrv: 'R' });

const dessiner = (actions, cochees) => {
    const simulationResult = calculateSimulatedDiagram(groupes, actions, cochees, 60, []);
    return render(
        <TimelineDiagram
            groups={groupes}
            cycleLength={60}
            pixelsPerSecond={PPS}
            conflicts={[]}
            conflictMatrix={[]}
            actionData={actions}
            simulationResult={simulationResult}
            simulationFilter={new Set(cochees)}
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
};

describe.each([
    ['Synchro BTS', '.synchro-bts-arrows'],
    ['Instant Co', '.instant-co-arrows']
])('%s en simulation', (nom, selecteur) => {
    it('reste affiché sans être coché', () => {
        const { container } = dessiner([adaptatif, repere(2, nom)], []);
        expect(container.querySelector(selecteur)).not.toBeNull();
    });

    it("garde son instant quand un adaptatif coché raccourcit le cycle avant lui", () => {
        const { container } = dessiner([adaptatif, repere(2, nom)], [1]);
        const trait = container.querySelector(`${selecteur} line`);
        expect(trait).not.toBeNull();
        expect(Number(trait.getAttribute('x1'))).toBe(30 * PPS);
    });

    it('disparaît si son instant tombe au-delà du cycle simulé', () => {
        const tardif = { ...repere(2, nom), deb: '58' };
        const { container } = dessiner([adaptatif, tardif], [1]);
        expect(container.querySelector(selecteur)).toBeNull();
    });
});
