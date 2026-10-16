import { describe, it, expect } from 'vitest';
import { scenariosAImprimer, sectionsScenariosInitiales, optionScenario, cleScenarioImpression } from './impressionScenarios';

const pf = (id, extra = {}) => ({ id, name: `PF${id}`, data: [], diagram: [], ...extra });

describe('Scénarios au dossier imprimé', () => {
    it('la première sélection coche le scénario choisi de chaque plan, jamais un scénario fixe', () => {
        const sections = sectionsScenariosInitiales([
            pf(1, { simulationName: 'Bus', simulationScenarios: [{ nom: 'Bus', actions: [] }] }),
            pf(2, { simulationName: 'Tout coché' }),
            pf(3)
        ]);
        expect(sections).toMatchObject({ simulation: true, simulationComparatif: true, simulationDiagramme: true, 'scenario:1:Bus': true });
        expect(Object.keys(sections).filter(k => k.startsWith('scenario:'))).toEqual(['scenario:1:Bus']);
        expect(sectionsScenariosInitiales([pf(2, { simulationName: 'Tout décoché' })]).simulation).toBe(false);
    });

    it('sans case Scénarios, rien ne s\'imprime', () => {
        const p = pf(1, { simulationScenarios: [{ nom: 'Bus', actions: [] }] });
        expect(scenariosAImprimer({ [cleScenarioImpression(1, 'Bus')]: true }, p, 1)).toEqual([]);
        expect(scenariosAImprimer({ simulation: true, [cleScenarioImpression(1, 'Bus')]: true }, p, 1).map(s => s.nom)).toEqual(['Bus']);
    });

    it("un dossier d'avant le multi-scénario imprime le scénario choisi du plan actif, seul", () => {
        const p1 = pf(1, { simulationName: 'Bus', simulationScenarios: [{ nom: 'Bus', actions: [] }, { nom: 'Soir', actions: [] }] });
        const p2 = pf(2, { simulationName: 'Creuse', simulationScenarios: [{ nom: 'Creuse', actions: [] }] });
        expect(scenariosAImprimer({ simulation: true }, p1, 1).map(s => s.nom)).toEqual(['Bus']);
        expect(scenariosAImprimer({ simulation: true }, p2, 1)).toEqual([]);
        expect(optionScenario({ simulation: true }, 'simulationDiagramme')).toBe(true);
        expect(optionScenario({ simulation: true }, 'simulationComparatif')).toBe(false);
    });
});
