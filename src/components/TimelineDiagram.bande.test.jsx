import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

// Un carrefour minimal et une action « Début de bande passante » renseignée.
const groupes = [1, 2, 3].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset: 0,
    durations: { green: 20, orange: 3, red: 37 }
}));

const action = {
    id: 42, gf: '1', action: 'Début de bande passante',
    deb: '10', fin: '30', actGf1: '3', abrv: 'BP',
    plage1: '', plage2: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    description: '', micro: ''
};

const poser = (hoveredActionId, surSurvol = () => {}) => render(
    <TimelineDiagram
        groups={groupes}
        cycleLength={60}
        pixelsPerSecond={3}
        conflicts={[]}
        conflictMatrix={[]}
        actionData={[action]}
        hoveredActionId={hoveredActionId}
        cycleLengthInput="60"
        setCycleLengthInput={() => {}}
        setCycleLength={() => {}}
        onGroupClick={() => {}}
        updateGroupParams={() => {}}
        updateActionRow={() => {}}
        setHoveredActionId={surSurvol}
        startDrag={() => {}}
        endDrag={() => {}}
    />
);

describe('Bande passante — surlignage depuis les conditions micro', () => {
    it('les flèches sont dessinées', () => {
        const { container } = poser(null);
        expect(container.querySelectorAll('.debut-bande-arrows').length).toBeGreaterThan(0);
    });

    it("survoler l'action pose la classe qui épaissit le trait", () => {
        const { container } = poser(42);
        const surlignees = container.querySelectorAll('.debut-bande-arrows.highlighted');
        expect(surlignees.length).toBeGreaterThan(0);
    });

    it('le tracé offre une prise au survol, plus large que ses 0,7 px', () => {
        const { container } = poser(null);
        // La classe n'est pas décorative : c'est elle qui exclut la prise des
        // règles de tracé, lesquelles la ramèneraient à 0,7 px et pointillée.
        const prises = container.querySelectorAll('.debut-bande-arrows path.bande-prise');
        expect(prises.length).toBeGreaterThan(0);
        expect(Number(prises[0].getAttribute('stroke-width'))).toBeGreaterThan(5);
    });

    it('la prise est continue : un seul segment, sans trou', () => {
        // dashedPath émet une suite de tirets de 5 px séparés de 5 px. La
        // doublure doit suivre la trajectoire, pas les tirets : sinon une
        // moitié du trajet ne répond pas, quelle que soit son épaisseur.
        const { container } = poser(null);
        const prise = container.querySelector('.debut-bande-arrows path.bande-prise');
        expect((prise.getAttribute('d').match(/M/g) || []).length).toBe(1);
    });

    it("survoler le tracé signale l'action, pour allumer sa condition micro", () => {
        const vus = [];
        const { container } = poser(null, (id) => vus.push(id));
        fireEvent.mouseOver(container.querySelector('.debut-bande-arrows'));
        expect(vus).toContain(42);
    });
});
