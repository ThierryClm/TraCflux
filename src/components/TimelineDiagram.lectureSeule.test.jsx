import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

/**
 * Le contrat de lecture seule — celui du miroir détaché.
 *
 * Trois propriétés qui se sont contredites trois fois en une semaine :
 *
 *  1. rien n'est modifiable ;
 *  2. les poignées de glissement restent PRÉSENTES, car ce sont elles qui
 *     captent le survol des incrustations sourdes à la souris — les retirer
 *     éteignait le surlignage et l'infobulle dans la fenêtre détachée ;
 *  3. le titre disparaît quand le bandeau de la fenêtre le porte, mais
 *     seulement dans ce cas — le diagramme imprimé n'a pas de bouton
 *     « Détacher » non plus, et doit garder son titre.
 *
 * Les masquer visuellement relève du CSS (`opacity: 0`) ; les tests ci-dessous
 * gardent ce qui se vérifie ici : leur présence et le refus d'éditer.
 */

const groupes = [1, 2].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset: 0,
    durations: { green: 20, orange: 3, red: 37 }
}));

const actionAdaptatif = {
    id: 3, action: 'Adaptatif vertical', gf: '1', deb: '10', fin: '30',
    actGf1: '2', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    plage1: '1', plage2: '2', abrv: 'AV', description: '', micro: ''
};

const dessiner = (props = {}) => {
    const startDrag = vi.fn();
    const rendu = render(
        <TimelineDiagram
            groups={groupes}
            cycleLength={60}
            pixelsPerSecond={3}
            conflicts={[]}
            conflictMatrix={[]}
            actionData={[actionAdaptatif]}
            cycleLengthInput="60"
            setCycleLengthInput={() => {}}
            setCycleLength={() => {}}
            onGroupClick={() => {}}
            updateGroupParams={() => {}}
            updateActionRow={() => {}}
            setHoveredActionId={() => {}}
            startDrag={startDrag}
            endDrag={() => {}}
            {...props}
        />
    );
    return { ...rendu, startDrag };
};

describe('Diagramme — contrat de lecture seule', () => {
    it('le conteneur se déclare en lecture seule', () => {
        const { container } = dessiner({ readOnly: true });
        expect(container.querySelector('.timeline-container.read-only')).not.toBeNull();
        expect(dessiner().container.querySelector('.timeline-container.read-only')).toBeNull();
    });

    it('les poignées restent présentes : ce sont elles qui captent le survol', () => {
        const { container } = dessiner({ readOnly: true });
        expect(container.querySelectorAll('.action-drag-handle').length).toBeGreaterThan(0);
    });

    it('mais le glissement est refusé', () => {
        const { container, startDrag } = dessiner({ readOnly: true });
        fireEvent.mouseDown(container.querySelector('.action-drag-handle'));
        expect(startDrag).not.toHaveBeenCalled();
    });

    it('alors qu\'il est accepté dans le diagramme éditable', () => {
        const { container, startDrag } = dessiner();
        fireEvent.mouseDown(container.querySelector('.action-drag-handle'));
        expect(startDrag).toHaveBeenCalled();
    });

    it('le survol reste actif : une incrustation s\'allume comme ailleurs', () => {
        const { container } = dessiner({ readOnly: true, hoveredActionId: 3 });
        expect(container.querySelectorAll('.adaptatif-overlay.highlighted').length).toBeGreaterThan(0);
    });
});

describe('Diagramme — titre porté par le bandeau de la fenêtre', () => {
    it('le titre est affiché par défaut', () => {
        const { container } = dessiner();
        expect(container.querySelector('.diagram-title')).not.toBeNull();
    });

    it('il disparaît quand la fenêtre le porte', () => {
        const { container } = dessiner({ titreEnBandeau: true });
        expect(container.querySelector('.diagram-title')).toBeNull();
    });

    it('la lecture seule À ELLE SEULE ne retire pas le titre — le dossier imprimé en dépend', () => {
        const { container } = dessiner({ readOnly: true });
        expect(container.querySelector('.diagram-title')).not.toBeNull();
    });
});
