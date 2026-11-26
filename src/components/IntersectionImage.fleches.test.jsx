import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntersectionImage from './IntersectionImage';

const groupe = (id, green) => ({
    id,
    name: `GF${id}`,
    type: 'VL',
    minGreen: 6,
    offset: 10,
    durations: { green, orange: 3, red: 10 },
    courant: 'TD'
});
const fleche = (groupId) => ({ id: groupId * 10, groupId, x: 10 * groupId, y: 10 * groupId });

const rendre = ({ groups, arrows = groups.map(g => fleche(g.id)), simulationResult = null, displayOptions = {} }) => render(
    <IntersectionImage
        groups={groups}
        imageData="data:image/png;base64,AA=="
        onImageChange={vi.fn()}
        arrows={arrows}
        onArrowsChange={vi.fn()}
        cycleLength={60}
        currentTime={0}
        simulationResult={simulationResult}
        actionData={[]}
        selectedActions={[]}
        conflictMatrix={[]}
        displayOptions={{ showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals: false, showDetecteurs: true, showDetecteurNames: true, ...displayOptions }}
    />
);

const marqueurs = (container) => container.querySelectorAll('.arrow-marker');

describe('IntersectionImage — flèches des groupes sans vert', () => {
    it('garde les flèches des groupes qui ont un début et une fin', () => {
        const { container } = rendre({ groups: [groupe(1, 30), groupe(2, 20)] });
        expect(marqueurs(container)).toHaveLength(2);
        expect(screen.getByTitle(/^GF1 /)).toBeInTheDocument();
        expect(screen.getByTitle(/^GF2 /)).toBeInTheDocument();
    });

    it('masque la flèche d’un groupe sans vert dans le diagramme', () => {
        const { container } = rendre({ groups: [groupe(1, 30), groupe(2, 0)] });
        expect(marqueurs(container)).toHaveLength(1);
        expect(screen.getByTitle(/^GF1 /)).toBeInTheDocument();
        expect(screen.queryByTitle(/^GF2 /)).toBeNull();
    });

    it('masque aussi le numéro du groupe qui n’a plus de flèche', () => {
        const { container } = rendre({ groups: [groupe(1, 30), groupe(2, 0)] });
        const numeros = [...container.querySelectorAll('.group-number-centroid')].map(el => el.textContent);
        expect(numeros).toEqual(['1']);
    });

    it('rappelle le groupe à poser à côté du curseur', () => {
        const { container } = rendre({ groups: [groupe(1, 30), groupe(2, 20)], arrows: [fleche(1)],
            displayOptions: { showArrows: true } });
        expect(container.querySelector('.ajout-repere')).toHaveTextContent('GF2');
    });

    it('cache une flèche dont le groupe n’existe plus', () => {
        const { container } = rendre({ groups: [groupe(1, 30)], arrows: [fleche(1), fleche(7)] });
        expect(marqueurs(container)).toHaveLength(1);
    });

    it('en simulation, masque la flèche d’un groupe escamoté', () => {
        const simulationResult = {
            simulatedCycleLength: 60,
            simulatedGroups: [{ id: 2, simulatedGreen: 0, simulatedOffset: 10, isEscamoted: true }]
        };
        const { container } = rendre({ groups: [groupe(1, 30), groupe(2, 30)], simulationResult });
        expect(marqueurs(container)).toHaveLength(1);
        expect(screen.getByTitle(/^GF1 /)).toBeInTheDocument();
        expect(screen.queryByTitle(/^GF2 /)).toBeNull();
    });

    it('fait revenir la flèche dès que le vert est rétabli', () => {
        const { container, rerender } = rendre({ groups: [groupe(1, 30), groupe(2, 0)] });
        expect(marqueurs(container)).toHaveLength(1);
        rerender(
            <IntersectionImage
                groups={[groupe(1, 30), groupe(2, 12)]}
                imageData="data:image/png;base64,AA=="
                onImageChange={vi.fn()}
                arrows={[fleche(1), fleche(2)]}
                onArrowsChange={vi.fn()}
                cycleLength={60}
                currentTime={0}
                actionData={[]}
                selectedActions={[]}
                conflictMatrix={[]}
                displayOptions={{ showGroupNumbers: true, showGroupNames: true, showArrows: false, showSignals: false, showDetecteurs: true, showDetecteurNames: true }}
            />
        );
        expect(container.querySelectorAll('.arrow-marker')).toHaveLength(2);
    });

    it('en vue Signaux, masque aussi le feu d’un groupe sans vert', () => {
        const { container } = rendre({
            groups: [{ ...groupe(2, 0), signal: 'R14tg' }],
            displayOptions: { showSignals: true, showCurrents: false }
        });
        expect(marqueurs(container)).toHaveLength(0);
        expect(screen.queryByRole('img', { name: 'Signal R14tg' })).toBeNull();
    });

    it('en vue Signaux, garde le feu d’un groupe qui a un vert', () => {
        const { container } = rendre({
            groups: [{ ...groupe(2, 20), signal: 'R14tg' }],
            displayOptions: { showSignals: true, showCurrents: false }
        });
        expect(marqueurs(container)).toHaveLength(1);
        expect(screen.getByRole('img', { name: 'Signal R14tg' })).toBeInTheDocument();
    });
});
