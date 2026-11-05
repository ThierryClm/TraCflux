import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

const PPS = 3;
const groupes = [1, 2, 3, 4].map(id => ({
    id,
    name: `G${id}`,
    type: 'VL',
    courant: 'TD',
    minGreen: 5,
    offset: (id - 1) * 15,
    durations: { green: 10, orange: 3, red: 47 }
}));

const action = (nom, plage1, plage2, deb = '30') => ({
    id: 7, action: nom, gf: '', deb, fin: '', plage1: String(plage1), plage2: String(plage2), abrv: 'A'
});

const dessiner = (actions, surcharge = {}) => render(
    <TimelineDiagram
        groups={groupes}
        cycleLength={60}
        pixelsPerSecond={PPS}
        conflicts={[]}
        conflictMatrix={[]}
        actionData={actions}
        cycleLengthInput="60"
        setCycleLengthInput={() => {}}
        setCycleLength={() => {}}
        onGroupClick={() => {}}
        updateGroupParams={() => {}}
        updateActionRow={() => {}}
        setHoveredActionId={() => {}}
        startDrag={() => {}}
        endDrag={() => {}}
        {...surcharge}
    />
);

describe.each([
    ['Point de repos', '.fleche-regle-repos', '.point-repos-arrows'],
    ['Synchro BTS', '.fleche-regle-bts', '.synchro-bts-arrows'],
    ['Instant Co', '.fleche-regle-instant-co', '.instant-co-arrows']
])('%s : flèche du haut dans la barre des secondes', (nom, selecteur, flecheBas) => {
    it('loge dans la barre, à son instant, même pour une plage qui commence plus bas', () => {
        const { container } = dessiner([action(nom, 3, 4)]);
        const trait = container.querySelector(`.timeline-ruler ${selecteur} line`);
        expect(trait).not.toBeNull();
        expect(Number(trait.getAttribute('x1'))).toBe(30 * PPS);
        expect(Number(trait.getAttribute('y2'))).toBeLessThan(50);
    });

    it('tient entière sous les graduations, dans la barre', () => {
        const { container } = dessiner([action(nom, 1, 4)]);
        const ordonnees = container.querySelector(`${selecteur} polygon`).getAttribute('points')
            .split(' ').map(point => Number(point.split(',')[1]));
        expect(Math.max(...ordonnees)).toBeLessThan(50);
    });

    it('laisse une seule flèche dans le diagramme, sous la plage', () => {
        const { container } = dessiner([action(nom, 3, 3)]);
        const traits = container.querySelectorAll(`${flecheBas} line`);
        expect(traits).toHaveLength(1);
        expect(Number(traits[0].getAttribute('y1'))).toBeGreaterThan(50 + 1 + 3 * 31);
    });

    it('à l\'impression, descend la flèche du bas sous le diagramme, quelle que soit la plage', () => {
        const { container } = dessiner([action(nom, 1, 2)], { flechesBasAuPied: true });
        expect(Number(container.querySelector(`${flecheBas} line`).getAttribute('y2'))).toBe(50 + 1 + 4 * 31 + 2);
    });

    it('allume le survol et lance le glissement depuis la barre', () => {
        const survol = vi.fn();
        const debut = vi.fn();
        const { container } = dessiner([action(nom, 2, 3)], { setHoveredActionId: survol, startDrag: debut });
        const prise = container.querySelector(`${selecteur} rect`);
        fireEvent.mouseEnter(prise);
        expect(survol).toHaveBeenCalledWith(7);
        fireEvent.mouseDown(prise, { clientX: 90 });
        expect(debut).toHaveBeenCalled();
    });

    it('s\'allume quand l\'action est survolée', () => {
        const { container } = dessiner([action(nom, 1, 2)], { hoveredActionId: 7 });
        expect(container.querySelector(`${selecteur}.highlighted`)).not.toBeNull();
    });

    it('disparaît avec une plage hors des groupes', () => {
        const { container } = dessiner([action(nom, 1, 9)]);
        expect(container.querySelector(selecteur)).toBeNull();
    });
});

it('la flèche du haut disparaît avec le repère au-delà du cycle simulé', () => {
    const adaptatif = { id: 1, action: 'Adaptatif vertical', gf: '', deb: '5', fin: '8', plage1: '', plage2: '' };
    const synchro = { ...action('Synchro BTS', '1', '2', '58'), id: 2 };
    const actions = [adaptatif, synchro];
    const simulationResult = calculateSimulatedDiagram(groupes, actions, [1], 60, []);
    const { container } = dessiner(actions, { simulationResult, simulationFilter: new Set([1]) });
    expect(container.querySelector('.synchro-bts-arrows')).toBeNull();
    expect(container.querySelector('.fleche-regle-bts')).toBeNull();
});
