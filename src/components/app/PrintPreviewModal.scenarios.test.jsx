import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PrintPreviewModal from './PrintPreviewModal';

/**
 * L'aperçu du dossier : chaque scénario coché suit son plan de feu, précédé
 * de la page de comparaison du plan ; il est recalculé d'après sa version
 * enregistrée, non d'après les cases cochées à l'écran.
 */

const groupes = [1, 2, 3].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, laneCoef: 1,
    offset: (id - 1) * 20, durations: { green: 15, orange: 3, red: 42 }
}));
const ligneVide = { gf: '', fin: '', actGf1: '', actGf1Gf2: '', actGf1Gf3: '', actGf1Gf4: '', plage1: '', plage2: '', abrv: '', description: '', micro: '' };
const actions = [
    { ...ligneVide, id: 1, action: 'Adaptatif vertical', deb: '5', fin: '8' },
    { ...ligneVide, id: 2, action: 'Prolongement', gf: '1', deb: '20', fin: '24' }
];
const plans = [
    { id: 1, name: 'PF1', data: actions, diagram: [], cycleLength: 60,
        simulationName: 'Bus', simulationActions: [2],
        simulationScenarios: [{ nom: 'Bus', actions: [1] }, { nom: 'Soir', actions: [] }] },
    { id: 2, name: 'PF2', data: actions, diagram: [], cycleLength: 60,
        simulationScenarios: [{ nom: 'Creuse', actions: [1] }] }
];

const apercu = (dossierSections) => render(
    <PrintPreviewModal
        isOpen onClose={vi.fn()}
        project={{ projectName: 'P', intersectionName: 'X', projectProperties: {}, groups: groupes, conflictMatrix: [], cycleLength: 60 }}
        plans={{ pfTabs: plans, activePFId: 1, pfTrafficDatasetMap: {} }}
        traffic={{ activeTrafficDataset: 'jeu', trafficDatasets: { jeu: { 1: { trafficVol: 300 }, 2: { trafficVol: 200 }, 3: { trafficVol: 100 } } }, trafficDatasetNames: ['jeu'] }}
        image={{ intersectionImage: null, intersectionArrows: [], imageBrightness: 100, imageContrast: 100, imageNaturalDims: null }}
        print={{ printType: 'dossier', dossierSections, dossierPortrait: false, dossierPrintWidth: 1000,
            descriptionPrintStyle: {}, largeurConditionsImpression: 100, microPrintStyle: {},
            printPreviewPageRef: { current: null }, imprimerApercu: vi.fn() }}
        actions={{ actionData: actions, microCustomFields: [] }}
        preferences={{ tooltipPrefs: {} }}
    />
);

const titres = (container) => [...container.querySelectorAll('h3')].map(h => h.textContent);

describe('Impression multi-scénario — le dossier', () => {
    it('les scénarios suivent leur plan, après sa page de comparaison', () => {
        const { container } = apercu({
            diagram_1: true, diagram_2: true, simulation: true, simulationComparatif: true,
            simulationDiagramme: true, 'scenario:1:Bus': true, 'scenario:1:Soir': true, 'scenario:2:Creuse': true
        });
        const t = titres(container).filter(x => /^(Diagramme du plan|Comparaison|Scénario)/.test(x));
        expect(t.map(x => x.split(' — ')[0].split(' (')[0])).toEqual([
            'Diagramme du plan de feu : PF1',
            'Comparaison des scénarios',
            'Scénario « Bus »',
            'Scénario « Soir »',
            'Diagramme du plan de feu : PF2',
            'Comparaison des scénarios',
            'Scénario « Creuse »'
        ]);
    });

    it("un scénario se calcule sur sa version enregistrée, et s'imprime sans le diagramme de son plan", () => {
        const { container } = apercu({ simulation: true, simulationDiagramme: true, simulationActions: true, 'scenario:1:Bus': true });
        const t = titres(container);
        expect(t.some(x => x.startsWith('Diagramme du plan'))).toBe(false);
        // Adaptatif de 3 s : 60 → 57 s. L'écran coche l'action 2, pas l'action 1.
        expect(t.find(x => x.startsWith('Scénario « Bus »'))).toMatch(/Cycle simulé : 57s \(−3s\)/);
        const coches = [...container.querySelectorAll('.print-simulation-actions tbody tr')].map(tr => tr.className);
        expect(coches).toEqual(['action-cochee', 'action-decochee']);
    });

    it('la comparaison rappelle le plan nominal puis une ligne par scénario', () => {
        const { container } = apercu({ simulation: true, simulationComparatif: true, 'scenario:1:Bus': true, 'scenario:1:Soir': true });
        const lignes = [...container.querySelectorAll('.print-comparatif-scenarios tbody tr')]
            .map(tr => [...tr.cells].slice(0, 4).map(td => td.textContent));
        expect(lignes).toEqual([
            ['Plan nominal (référence)', '—', '60s', '—'],
            ['Bus', '1', '57s (−3)', '0'],
            ['Soir', '0', '60s', '0']
        ]);
        const reserve = container.querySelector('.print-comparatif-scenarios tbody tr').cells[4].textContent;
        expect(reserve).toMatch(/^GF\d$/);
    });

    it('les options communes valent pour tous les scénarios', () => {
        const { container } = apercu({ simulation: true, simulationDiagramme: false, simulationConflits: true, 'scenario:1:Bus': true, 'scenario:2:Creuse': true });
        const t = titres(container);
        expect(t.filter(x => x.startsWith('Scénario'))).toEqual([]);
        expect(t.filter(x => x.startsWith('Conflits'))).toHaveLength(2);
    });
});
