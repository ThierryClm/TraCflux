import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

/**
 * Une action, une abréviation.
 *
 * Le diagramme pose un libellé générique — `.bar-label` — à `Déb`, sur la barre
 * du groupe, pour toutes les actions sauf celles qui placent elles-mêmes le
 * leur : ouverture anticipée, escamotage de phase, adaptatif vertical. La liste
 * d'exclusion est une liste écrite à la main, et deux familles y manquaient :
 * « Priorité piétons » et « Flèche d'anticipation » affichaient donc leur
 * abréviation DEUX fois sur la même barre, le générique à `Déb` et le leur au
 * centre.
 *
 * Ces tests fixent l'invariant plutôt que la liste : quelle que soit la
 * famille, une action ne montre son abréviation qu'une fois.
 */

const groupes = [1, 2, 3].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, offset: 0,
    durations: { green: 30, orange: 3, red: 27 }
}));

const ABREVIATION = 'ZzQ';   // improbable ailleurs dans le rendu

const action = (nom, extra = {}) => ({
    id: 5, action: nom, gf: '1', deb: '10', fin: '30', actGf1: '2',
    actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '',
    plage1: '1', plage2: '3', abrv: ABREVIATION,
    description: '', micro: '', ...extra
});

const dessiner = (uneAction) => render(
    <TimelineDiagram
        groups={groupes}
        cycleLength={60}
        pixelsPerSecond={6}
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
    />
);

/** Les éléments terminaux qui portent exactement l'abréviation. */
const porteurs = (container) =>
    [...container.querySelectorAll('*')]
        .filter(el => el.children.length === 0 && el.textContent.trim() === ABREVIATION);

// Les familles dont l'abréviation vit SUR la barre du groupe. Les trois
// familles dessinées en flèches sous le diagramme — point de repos, synchro
// BTS, instant CO — portent légitimement un second libellé sous leur flèche :
// il est ailleurs, pas en double au même endroit, et il est le seul repère à
// proximité du tracé. Elles ne relèvent donc pas de cet invariant.
const FAMILLES = [
    'Priorité piétons',
    "Flèche d'anticipation",
    'Ouverture anticipée',
    'Escamotage de phase',
    'Adaptatif vertical',
    'Seconde lucarne',
    'Fermeture anticipée',
    'Signal aide conduite',
    'Contrôle de flot'
];

describe('Abréviations — une action, une abréviation', () => {
    FAMILLES.forEach(nom => {
        it(`${nom} ne l'affiche qu'une fois`, () => {
            const { container } = dessiner(action(nom));
            const vus = porteurs(container);
            expect(
                vus.length,
                `${nom} affiche ${vus.length} fois son abréviation `
                + `(classes : ${vus.map(e => e.className || e.tagName).join(' | ')})`
            ).toBe(1);
        });
    });

    it('la priorité piéton porte son abréviation sur la barre, à Déb', () => {
        const { container } = dessiner(action('Priorité piétons'));
        const [porteur] = porteurs(container);
        expect(porteur.className).toContain('bar-label');
        // Déb = 10 s à 6 px/s, plus le retrait de 2 px du libellé générique.
        expect(porteur.style.left).toBe('62px');
    });

    it("la flèche d'anticipation suit la même règle", () => {
        const { container } = dessiner(action("Flèche d'anticipation"));
        const [porteur] = porteurs(container);
        expect(porteur.className).toContain('bar-label');
        expect(porteur.style.left).toBe('62px');
    });

    it("sans abréviation saisie, rien ne s'affiche", () => {
        const { container } = dessiner(action('Priorité piétons', { abrv: '' }));
        expect(porteurs(container)).toHaveLength(0);
    });
});
