import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineDiagram from './TimelineDiagram';

/**
 * Le contrat de surlignage du diagramme.
 *
 * Quatorze familles d'incrustations s'allument quand on survole l'action de
 * micro-régulation correspondante. Toutes reposent sur la même mécanique :
 * `hoveredActionId === action.id` pose la classe `highlighted`, qu'une règle
 * CSS vise ensuite.
 *
 * Cette mécanique se rompt silencieusement. En septembre 2026, le tracé des
 * bandes passantes est passé de <line> à <path> sans que la règle CSS suive :
 * la classe était bien posée, elle ne visait plus rien, et le surlignage était
 * mort depuis des semaines sans que rien ne le signale.
 *
 * D'où ces tests, qui vérifient les deux moitiés du contrat pour chaque
 * famille : l'incrustation est dessinée, et elle porte la classe au survol.
 */

const groupes = [1, 2, 3, 4].map(id => ({
    id,
    name: `G${id}`,
    type: id === 4 ? 'P' : 'VL',
    courant: id === 4 ? 'Piéton' : 'TD',
    minGreen: 5,
    offset: 0,
    durations: { green: 20, orange: 3, red: 37 }
}));

// Une action renseignée de partout : chaque famille n'exige qu'un
// sous-ensemble de ces champs, et les remplir tous évite treize variantes.
const action = (nom, extra = {}) => ({
    id: 7,
    action: nom,
    gf: '1',
    deb: '10',
    fin: '30',
    actGf1: '2',
    actGf1Gf2: '',
    actGf1Gf3: '',
    actGf1Gf4: '',
    plage1: '1',
    plage2: '3',
    abrv: 'AB',
    description: '',
    micro: '',
    ...extra
});

const dessiner = (uneAction, hoveredActionId = null) => render(
    <TimelineDiagram
        groups={groupes}
        cycleLength={60}
        pixelsPerSecond={3}
        conflicts={[]}
        conflictMatrix={[]}
        actionData={[uneAction]}
        hoveredActionId={hoveredActionId}
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

// nom de l'action de micro-régulation → sélecteur de son incrustation
const FAMILLES = [
    ['Seconde lucarne', '.cycle-block.lucarne'],
    ['Ouverture anticipée', '.ouverture-anticipee'],
    ['Fermeture anticipée', '.brace-marker'],
    ['Adaptatif vertical', '.adaptatif-overlay'],
    ['Escamotage de phase', '.escamotage-overlay'],
    ['Escamotage', '.escamotage-group-hover'],
    ['Signal aide conduite', '.signa-wrapper'],
    ['Contrôle de flot', '.controle-flot-wrapper'],
    ['Point de repos', '.point-repos-arrows'],
    ['Synchro BTS', '.synchro-bts-arrows'],
    ['Instant Co', '.instant-co-arrows'],
    ['Priorité piétons', '.priorite-pietons-wrapper'],
    ["Flèche d'anticipation", '.fleche-anticipation-wrapper'],
    ['Début de bande passante', '.debut-bande-arrows'],
    ['Fin de bande passante', '.fin-bande-arrows']
];

describe('Diagramme — chaque incrustation est dessinée', () => {
    FAMILLES.forEach(([nom, selecteur]) => {
        it(`${nom} dessine ${selecteur}`, () => {
            const { container } = dessiner(action(nom));
            expect(container.querySelectorAll(selecteur).length).toBeGreaterThan(0);
        });
    });
});

describe("Diagramme — survoler l'action allume son incrustation", () => {
    FAMILLES.forEach(([nom, selecteur]) => {
        it(`${nom} : ${selecteur} reçoit la classe highlighted`, () => {
            const { container } = dessiner(action(nom), 7);
            expect(container.querySelectorAll(`${selecteur}.highlighted`).length).toBeGreaterThan(0);
        });
    });

    it('sans survol, aucune incrustation n\'est allumée', () => {
        FAMILLES.forEach(([nom, selecteur]) => {
            const { container } = dessiner(action(nom), null);
            expect(container.querySelectorAll(`${selecteur}.highlighted`).length).toBe(0);
        });
    });

    it("survoler une AUTRE action n'allume rien", () => {
        const { container } = dessiner(action('Adaptatif vertical'), 999);
        expect(container.querySelectorAll('.adaptatif-overlay.highlighted').length).toBe(0);
    });
});
