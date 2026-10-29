import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PrintPreviewModal from './PrintPreviewModal';

/** Dossier : les commentaires des groupes, une ligne « GF x : » chacun, et les remarques du plan. */
const groupes = [1, 2, 3].map(id => ({
    id, name: `G${id}`, type: 'VL', courant: 'TD', minGreen: 5, laneCoef: 1,
    comment: id === 2 ? '<span style="color: #4CAF50">Boucle à remplacer</span>' : '',
    offset: (id - 1) * 20, durations: { green: 15, orange: 3, red: 42 }
}));
const plans = [
    { id: 1, name: 'PF1', data: [], diagram: [], cycleLength: 60, remarques: 'Première ligne<div>Seconde ligne</div>' },
    { id: 2, name: 'PF2', data: [], diagram: [{ groupId: 3, offset: 40, greenDuration: 15, comment: 'Nuit seulement' }], cycleLength: 60, remarques: '' }
];

const apercu = (dossierSections) => render(
    <PrintPreviewModal
        isOpen onClose={vi.fn()}
        project={{ projectName: 'P', intersectionName: 'X', projectProperties: {}, groups: groupes, conflictMatrix: [], cycleLength: 60 }}
        plans={{ pfTabs: plans, activePFId: 1, pfTrafficDatasetMap: {} }}
        traffic={{ activeTrafficDataset: 'jeu', trafficDatasets: { jeu: {} }, trafficDatasetNames: ['jeu'] }}
        image={{ intersectionImage: null, intersectionArrows: [], imageBrightness: 100, imageContrast: 100, imageNaturalDims: null }}
        print={{ printType: 'dossier', dossierSections, dossierPortrait: false, dossierPrintWidth: 1000,
            descriptionPrintStyle: {}, largeurConditionsImpression: 100, colonnesConditionsImpression: [], microPrintStyle: {},
            printPreviewPageRef: { current: null }, imprimerApercu: vi.fn() }}
        actions={{ actionData: [], microCustomFields: [] }}
        preferences={{ tooltipPrefs: {} }}
        comparateur={{ pfIds: null, scenarios: [], choixJeu: '__per_pf__', afficherVUtile: true }}
    />
);

const lignes = (container) => [...container.querySelectorAll('.print-commentaire-ligne')].map(d => d.textContent);

describe('Dossier : commentaires et remarques des plans de feu', () => {
    it('une ligne « GF x : » par groupe commenté, propre à chaque plan', () => {
        const { container } = apercu({ diagram_1: true, diagram_2: true, commentaires_1: true, commentaires_2: true });
        expect(lignes(container)).toEqual(['GF 2 : Boucle à remplacer', 'GF 2 : Boucle à remplacer', 'GF 3 : Nuit seulement']);
    });

    it('cases décochées : ni commentaires ni remarques', () => {
        const { container } = apercu({ diagram_1: true, commentaires_1: false, remarques_1: false });
        expect(lignes(container)).toEqual([]);
        expect(container.querySelector('.print-dossier-remarques')).toBeNull();
    });

    it('remarques imprimées avec leurs sauts de ligne', () => {
        const { container } = apercu({ diagram_1: true, remarques_1: true });
        const bloc = container.querySelector('.print-dossier-remarques');
        expect(bloc.querySelector('div').textContent).toBe('Seconde ligne');
    });
});
