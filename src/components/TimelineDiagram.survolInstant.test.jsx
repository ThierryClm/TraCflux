import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

/**
 * L'instant survolé anime l'image du carrefour en simulation. Il se suit sur
 * tout le diagramme, cadres d'action compris : passer sur un cadre (adaptatif
 * vertical, escamotage de phase, point de repos…) ne doit pas l'effacer, sans
 * quoi l'image revenait à ses couleurs par défaut.
 */

const groupes = [1, 2, 3].map(id => ({
    id,
    name: `G${id}`,
    type: 'VL',
    courant: 'TD',
    minGreen: 5,
    offset: 0,
    durations: { green: 20, orange: 3, red: 37 }
}));

const action = (nom) => ({
    id: 7, action: nom, gf: '1', deb: '10', fin: '30', actGf1: '2',
    actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', plage1: '1', plage2: '3',
    abrv: 'AB', description: '', micro: ''
});

const dessiner = (uneAction, setHoveredDiagramTime) => render(
    <TimelineDiagram
        groups={groupes}
        cycleLength={60}
        pixelsPerSecond={3}
        conflicts={[]}
        conflictMatrix={[]}
        actionData={[uneAction]}
        cycleLengthInput="60"
        setCycleLengthInput={() => {}}
        setCycleLength={() => {}}
        onGroupClick={() => {}}
        updateGroupParams={() => {}}
        updateActionRow={() => {}}
        setHoveredActionId={() => {}}
        startDrag={() => {}}
        endDrag={() => {}}
        setHoveredDiagramTime={setHoveredDiagramTime}
    />
);

const CADRES = [
    ['Adaptatif vertical', '.adaptatif-overlay'],
    ['Escamotage de phase', '.escamotage-overlay'],
    ['Point de repos', '.point-repos-arrows']
];

describe("Diagramme — l'instant survolé traverse les cadres d'action", () => {
    CADRES.forEach(([nom, selecteur]) => {
        it(`${nom} : survoler le cadre donne l'instant sous la souris`, () => {
            const suivi = vi.fn();
            const { container } = dessiner(action(nom), suivi);
            const cadre = container.querySelector(selecteur);
            expect(cadre).not.toBeNull();
            // jsdom place tout en x = 0 : 45 px à 3 px/s = seconde 15.
            fireEvent.mouseMove(cadre, { clientX: 45 });
            expect(suivi).toHaveBeenLastCalledWith(15);
        });
    });

    it("quitter une ligne pour un cadre n'efface pas l'instant", () => {
        const suivi = vi.fn();
        const { container } = dessiner(action('Adaptatif vertical'), suivi);
        const ligne = container.querySelector('.timeline-row-track');
        const cadre = container.querySelector('.adaptatif-overlay');
        fireEvent.mouseMove(ligne, { clientX: 30 });
        // La souris passe de la ligne au cadre posé par-dessus.
        fireEvent.mouseOut(ligne, { relatedTarget: cadre });
        fireEvent.mouseOver(cadre, { relatedTarget: ligne });
        expect(suivi).not.toHaveBeenCalledWith(null);
        expect(suivi).toHaveBeenLastCalledWith(10);
    });

    it("sortir du diagramme efface l'instant", () => {
        const suivi = vi.fn();
        const { container } = dessiner(action('Adaptatif vertical'), suivi);
        fireEvent.mouseLeave(container.querySelector('.timeline-track-container'));
        expect(suivi).toHaveBeenLastCalledWith(null);
    });
});
