import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import TimelineDiagram from './TimelineDiagram';
import { calculateSimulatedDiagram } from '../simulation';

/**
 * Cadres pleine largeur (escamotage de phase, adaptatif sans plage) en
 * simulation, plan ACTUEL du projet exemple.
 *
 * Règle validée par Thierry : un cadre pleine largeur recule avec un
 * adaptatif partiel. En bicarrefour, le cadre est coupé à la séparation et
 * seul le morceau de la section concernée recule.
 *
 * Les cadres dessinés sont ceux des actions NON cochées ; les actions cochées
 * sont appliquées et font reculer ces cadres.
 */

const PPS = 10;

const exemple = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'Carrefour_Exemple.json'), 'utf8'));
const plan = exemple.pfTabs.find(pf => pf.name === 'ACTUEL');
const groupes = exemple.groups.map(g => {
    const ligne = plan.diagram.find(d => d.groupId === g.id);
    return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
});

// Identifiants des actions du plan ACTUEL
const ESCAMOTAGE_PHASE = 1;     // 20-32 s, tous les groupes
const ADAPTATIF_GF2 = 5;        // 11-15 s, plage GF1 à GF7
const ADAPTATIF_GF8 = 8;        // 7-11 s, plage GF8 à GF13
const ADAPTATIF_GF10 = 11;      // 44-48 s, sans plage

/** Morceaux du cadre, de haut en bas : « deb-fin » en secondes. */
const cadres = (selecteur, cochees, separateur) => {
    const simulationResult = calculateSimulatedDiagram(groupes, plan.data, cochees, plan.cycleLength, plan.conflictMatrix);
    const { container } = render(
        <TimelineDiagram
            groups={groupes}
            cycleLength={plan.cycleLength}
            pixelsPerSecond={PPS}
            conflicts={[]}
            conflictMatrix={plan.conflictMatrix}
            actionData={plan.data}
            simulationResult={simulationResult}
            simulationFilter={new Set(cochees)}
            biCarrefourSeparator={separateur}
            cycleLengthInput={String(plan.cycleLength)}
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
    return [...container.querySelectorAll(selecteur)]
        .sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top))
        .map(el => {
            const deb = parseFloat(el.style.left) / PPS;
            return `${deb}-${deb + parseFloat(el.style.width) / PPS}`;
        });
};

const escamotage = (cochees, separateur = exemple.biCarrefourSeparator) =>
    cadres('.escamotage-overlay', cochees, separateur);

describe('Cadre pleine largeur en bicarrefour (séparation sous GF7)', () => {
    it('reste en un seul morceau sans adaptatif partiel', () => {
        expect(escamotage([])).toEqual(['20-32']);
    });

    it("seul le morceau du carrefour de l'adaptatif GF2 recule", () => {
        expect(escamotage([ADAPTATIF_GF2])).toEqual(['16-28', '20-32']);
    });

    it("seul le morceau du carrefour de l'adaptatif GF8 recule", () => {
        expect(escamotage([ADAPTATIF_GF8])).toEqual(['20-32', '16-28']);
    });

    it('reculant chacun de 4 s, les deux carrefours gardent un cadre en un seul morceau', () => {
        expect(escamotage([ADAPTATIF_GF2, ADAPTATIF_GF8])).toEqual(['16-28']);
    });

    it("le cadre d'un adaptatif sans plage est coupé de même", () => {
        const morceaux = cadres('.adaptatif-overlay', [ADAPTATIF_GF2], exemple.biCarrefourSeparator);
        // GF8 (plage GF8-13) n'est pas coché : son cadre reste en place
        expect(morceaux).toContain('40-44');
        expect(morceaux).toContain('44-48');
        expect(morceaux).toContain('7-11');
    });

    it("le libellé n'est porté que par le morceau du bas", () => {
        const simulationResult = calculateSimulatedDiagram(groupes, plan.data, [ADAPTATIF_GF2], plan.cycleLength, plan.conflictMatrix);
        const { container } = render(
            <TimelineDiagram
                groups={groupes} cycleLength={plan.cycleLength} pixelsPerSecond={PPS} conflicts={[]}
                conflictMatrix={plan.conflictMatrix} actionData={plan.data} simulationResult={simulationResult}
                simulationFilter={new Set([ADAPTATIF_GF2])} biCarrefourSeparator={exemple.biCarrefourSeparator}
                cycleLengthInput={String(plan.cycleLength)} setCycleLengthInput={() => {}} setCycleLength={() => {}}
                onGroupClick={() => {}} updateGroupParams={() => {}} updateActionRow={() => {}}
                setHoveredActionId={() => {}} startDrag={() => {}} endDrag={() => {}}
            />
        );
        const morceaux = [...container.querySelectorAll('.escamotage-overlay')]
            .sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
        expect(morceaux).toHaveLength(2);
        expect(morceaux.map(m => m.querySelector('.escamotage-label') !== null)).toEqual([false, plan.data.find(a => a.id === ESCAMOTAGE_PHASE).abrv !== '']);
    });
});

describe('Cadre pleine largeur hors bicarrefour', () => {
    it('recule en un seul morceau avec un adaptatif partiel', () => {
        expect(escamotage([ADAPTATIF_GF2], null)).toEqual(['16-28']);
    });

    it("deux adaptatifs partiels de plages distinctes ne s'additionnent pas", () => {
        expect(escamotage([ADAPTATIF_GF2, ADAPTATIF_GF8], null)).toEqual(['16-28']);
    });
});

describe('Cadre qui chevauche la fin du cycle, cycle réduit par des adaptatifs', () => {
    // PF1_120 : escamotage de phase 102-8 non coché, adaptatifs 38-46, 73-76 et
    // 11-16 cochés (cycle 104). La première partie du cadre s'arrête à la
    // nouvelle fin de cycle, plus à 120 s.
    it('le cadre va de 86 s à 104 s, puis de 0 à 8 s', () => {
        const pf1 = exemple.pfTabs.find(pf => pf.name === 'PF1_120');
        const groupesPf1 = exemple.groups.map(g => {
            const ligne = pf1.diagram.find(d => d.groupId === g.id);
            return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
        });
        const cochees = [8, 9, 10];
        const simulationResult = calculateSimulatedDiagram(groupesPf1, pf1.data, cochees, pf1.cycleLength, pf1.conflictMatrix);
        const { container } = render(
            <TimelineDiagram groups={groupesPf1} cycleLength={pf1.cycleLength} pixelsPerSecond={PPS} conflicts={[]}
                conflictMatrix={pf1.conflictMatrix} actionData={pf1.data} simulationResult={simulationResult}
                simulationFilter={new Set(cochees)} biCarrefourSeparator={null}
                cycleLengthInput="120" setCycleLengthInput={() => {}} setCycleLength={() => {}}
                onGroupClick={() => {}} updateGroupParams={() => {}} updateActionRow={() => {}}
                setHoveredActionId={() => {}} startDrag={() => {}} endDrag={() => {}} />
        );
        const parties = [...container.querySelectorAll('.escamotage-overlay')].map(el => {
            const deb = parseFloat(el.style.left) / PPS;
            return `${deb}-${deb + parseFloat(el.style.width) / PPS}`;
        });
        expect(parties).toEqual(['86-104', '0-8']);
    });
});

describe('Adaptatif qui chevauche la fin du cycle', () => {
    // PF1_120, adaptatif GF8 déplacé à 115-5 s et coché (cycle 110) : le cadre
    // de l'escamotage 102-8, non coché, recule de 5 s et s'arrête à 110 s.
    it("le cadre de l'escamotage va de 97 à 110 s, puis de 0 à 3 s", () => {
        const pf1 = exemple.pfTabs.find(pf => pf.name === 'PF1_120');
        const groupesPf1 = exemple.groups.map(g => {
            const ligne = pf1.diagram.find(d => d.groupId === g.id);
            return { ...g, offset: ligne.offset, durations: { ...g.durations, green: ligne.greenDuration } };
        });
        const actions = pf1.data.map(a => (a.id === 10 ? { ...a, deb: '115', fin: '5' } : a));
        const simulationResult = calculateSimulatedDiagram(groupesPf1, actions, [10], pf1.cycleLength, pf1.conflictMatrix);
        const { container } = render(
            <TimelineDiagram groups={groupesPf1} cycleLength={pf1.cycleLength} pixelsPerSecond={PPS} conflicts={[]}
                conflictMatrix={pf1.conflictMatrix} actionData={actions} simulationResult={simulationResult}
                simulationFilter={new Set([10])} biCarrefourSeparator={null}
                cycleLengthInput="120" setCycleLengthInput={() => {}} setCycleLength={() => {}}
                onGroupClick={() => {}} updateGroupParams={() => {}} updateActionRow={() => {}}
                setHoveredActionId={() => {}} startDrag={() => {}} endDrag={() => {}} />
        );
        const parties = [...container.querySelectorAll('.escamotage-overlay')].map(el => {
            const deb = parseFloat(el.style.left) / PPS;
            return `${deb}-${deb + parseFloat(el.style.width) / PPS}`;
        });
        expect(parties).toEqual(['97-110', '0-3']);
    });
});
