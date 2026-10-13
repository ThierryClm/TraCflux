import { describe, it, expect } from 'vitest';
import {
    scenariosDuPlan, scenarioChoisi, scenarioModifie, titreScenarioRefuse,
    creerScenario, enregistrerScenario, supprimerScenario, choisirScenario, quitterScenario,
    scenariosFixes, TOUT_COCHE, TOUT_DECOCHE
} from './scenarios';

const actions = [
    { id: 1, action: 'Escamotage de phase' },
    { id: 2, action: 'Adaptatif vertical' },
    { id: 3, action: 'Instant Co' },
    { id: 4, action: 'Prolongement' }
];

const plan = (extra = {}) => ({ id: 1, name: 'PF1', data: actions, diagram: [], ...extra });

describe('Scénarios de simulation', () => {
    it("l'ancien scénario unique figure dans la liste, sans doublon", () => {
        const pf = plan({ simulationName: 'Bus', simulationActions: [1] });
        expect(scenariosDuPlan(pf)).toEqual([{ nom: 'Bus', actions: [1] }]);
        const deja = plan({ simulationName: 'bus', simulationActions: [2], simulationScenarios: [{ nom: 'Bus', actions: [1] }] });
        expect(scenariosDuPlan(deja)).toEqual([{ nom: 'Bus', actions: [1] }]);
    });

    it('la liste est triée par ordre alphabétique, accents et casse compris', () => {
        const pf = plan({ simulationScenarios: [{ nom: 'pointe', actions: [] }, { nom: 'Été', actions: [] }, { nom: 'Bus', actions: [] }] });
        expect(scenariosDuPlan(pf).map(s => s.nom)).toEqual(['Bus', 'Été', 'pointe']);
    });

    it('modifié : seules comptent les actions simulables encore présentes', () => {
        const sc = { nom: 'A', actions: [1, 99] };
        expect(scenarioModifie(sc, [1], actions)).toBe(false);
        expect(scenarioModifie(sc, [1, 3], actions), 'Instant Co est hors simulation').toBe(false);
        expect(scenarioModifie(sc, [1, 2], actions)).toBe(true);
        expect(scenarioModifie(sc, [], actions)).toBe(true);
        expect(scenarioModifie(null, [1], actions)).toBe(false);
    });

    it('un titre vide ou déjà pris est refusé, sauf le sien quand on renomme', () => {
        const liste = [{ nom: 'Bus', actions: [] }];
        expect(titreScenarioRefuse('  ', liste)).toMatch(/titre/);
        expect(titreScenarioRefuse('BUS', liste)).toMatch(/déjà/);
        expect(titreScenarioRefuse('Bus', liste, 'Bus')).toBeNull();
        expect(titreScenarioRefuse('Tram', liste)).toBeNull();
    });

    it('créer prend les cases cochées et choisit le nouveau scénario', () => {
        const pf = plan({ simulationActions: [1, 2] });
        expect(creerScenario(pf, ' Pointe ')).toEqual({
            simulationScenarios: [{ nom: 'Pointe', actions: [1, 2] }],
            simulationName: 'Pointe',
            simulationActions: [1, 2]
        });
        expect(creerScenario(plan({ simulationScenarios: [{ nom: 'Pointe', actions: [] }] }), 'pointe')).toBeNull();
    });

    it('enregistrer met à jour ou renomme le scénario choisi', () => {
        const pf = plan({ simulationName: 'A', simulationActions: [2], simulationScenarios: [{ nom: 'A', actions: [1] }, { nom: 'B', actions: [] }] });
        expect(enregistrerScenario(pf, 'A').simulationScenarios).toEqual([{ nom: 'A', actions: [2] }, { nom: 'B', actions: [] }]);
        const renomme = { ...pf, ...enregistrerScenario(pf, 'C') };
        expect(renomme.simulationName).toBe('C');
        expect(scenariosDuPlan(renomme)).toEqual([{ nom: 'B', actions: [] }, { nom: 'C', actions: [2] }]);
        expect(enregistrerScenario(pf, 'b'), 'B existe déjà').toBeNull();
    });

    it('choisir recharge les cases ; quitter et supprimer les laissent en place', () => {
        const pf = plan({ simulationName: 'A', simulationActions: [2], simulationScenarios: [{ nom: 'A', actions: [1] }, { nom: 'B', actions: [4] }] });
        expect(choisirScenario(pf, 'B')).toMatchObject({ simulationName: 'B', simulationActions: [4] });
        expect(choisirScenario(pf, 'Z')).toBeNull();
        expect(quitterScenario(pf)).toMatchObject({ simulationName: '', simulationActions: [2] });
        expect(supprimerScenario(pf)).toEqual({
            simulationScenarios: [{ nom: 'B', actions: [4] }],
            simulationName: '',
            simulationActions: [2]
        });
        expect(scenarioChoisi(plan())).toBeNull();
        expect(supprimerScenario(plan())).toBeNull();
    });

    it('Tout coché et Tout décoché : composés du tableau, hors simulation exclue', () => {
        expect(scenariosFixes(actions)).toEqual([
            { nom: TOUT_COCHE, actions: [1, 2, 4] },
            { nom: TOUT_DECOCHE, actions: [] }
        ]);
        expect(choisirScenario(plan({ simulationActions: [2] }), 'Tout coché'))
            .toMatchObject({ simulationName: TOUT_COCHE, simulationActions: [1, 2, 4] });
        expect(choisirScenario(plan({ simulationActions: [2] }), 'Tout décoché'))
            .toMatchObject({ simulationName: TOUT_DECOCHE, simulationActions: [] });
    });

    it('un scénario fixe ne s\'enregistre ni ne se supprime', () => {
        const pf = plan({ simulationName: TOUT_COCHE, simulationActions: [1] });
        expect(scenarioChoisi(pf).nom).toBe(TOUT_COCHE);
        expect(enregistrerScenario(pf, TOUT_COCHE)).toBeNull();
        expect(supprimerScenario(pf)).toBeNull();
        expect(scenariosDuPlan(pf), "n'entre pas dans la liste enregistrée").toEqual([]);
        expect(titreScenarioRefuse('TOUT DÉCOCHÉ', [])).toMatch(/réservé/);
    });

    it('un scénario déjà enregistré sous un titre réservé est gardé, renommé', () => {
        const pf = plan({ simulationScenarios: [{ nom: 'tout coché', actions: [1] }] });
        expect(scenariosDuPlan(pf)).toEqual([{ nom: 'tout coché (2)', actions: [1] }]);
    });
});
