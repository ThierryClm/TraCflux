import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CapacityComparison from './CapacityComparison';
import { colonnesComparaison, cleScenarioComparaison, planComparable, PAR_PLAN } from '../utils/comparaisonCapacite';

const groups = [
    { id: 1, name: 'Nord', type: 'V', laneCoef: 1, offset: 0, minGreen: 6, durations: { green: 40, orange: 3, red: 47 } },
    { id: 2, name: 'Sud', type: 'V', laneCoef: 1, offset: 50, minGreen: 6, durations: { green: 30, orange: 3, red: 57 } },
];
const ligne = { gf: '', plage1: '', plage2: '', actGf1: '', description: '' };
const pfTabs = [
    { id: 1, name: 'HPM', cycleLength: 90, diagram: [], data: [{ ...ligne, id: 11, action: 'Adaptatif vertical', deb: 10, fin: 20 }],
        simulationScenarios: [{ nom: 'Avec AV', actions: [11] }] },
    { id: 2, name: 'Nuit', cycleLength: 60, diagram: [], data: [] },
];
const trafficDatasets = { HPM: { 1: { trafficVol: 400 }, 2: { trafficVol: 300 } }, Nuit: {} };
const trafic = { trafficDatasets, pfTrafficDatasetMap: { 1: 'HPM', 2: 'Nuit' }, activeTrafficDataset: 'HPM', trafficDatasetNames: ['HPM', 'Nuit'] };
const actif = { activePFId: 1, groups, cycleLength: 90, actionData: pfTabs[0].data };

describe('comparaisonCapacite', () => {
    it('un plan sans trafic n’est pas comparable avec son propre jeu, il l’est avec un jeu unique', () => {
        expect(planComparable(pfTabs[1], PAR_PLAN, trafic)).toBe(false);
        expect(planComparable(pfTabs[1], 'HPM', trafic)).toBe(true);
    });
    it('colonnes : le plan, puis ses scénarios cochés, recalculés sur le diagramme simulé', () => {
        const cols = colonnesComparaison(pfTabs, { pfIds: null, scenarios: [cleScenarioComparaison(1, 'Avec AV')], choixJeu: PAR_PLAN }, trafic, actif, []);
        expect(cols.map(c => c.cle)).toEqual(['1', '1:Avec AV']);
        expect(cols[1].cycle).toBe(80);
        expect(cols[1].verts[1]).toBe(30);
    });
    it('jeu unique : le plan de nuit redevient comparable', () => {
        const cols = colonnesComparaison(pfTabs, { pfIds: null, scenarios: [], choixJeu: 'HPM' }, trafic, actif, []);
        expect(cols.map(c => c.pf.name)).toEqual(['HPM', 'Nuit']);
    });
});

describe('CapacityComparison', () => {
    const rendre = (props = {}) => render(<CapacityComparison pfTabs={pfTabs} groups={groups} trafficDatasets={trafficDatasets}
        pfTrafficDatasetMap={{ 1: 'HPM', 2: 'Nuit' }} activeTrafficDataset="HPM" trafficDatasetNames={['HPM', 'Nuit']}
        activePFId={1} cycleLength={90} actionData={pfTabs[0].data} {...props} />);

    it('liste déroulante : plans à cocher, scénarios en retrait, plan sans trafic grisé', () => {
        const setScenarios = vi.fn();
        rendre({ setSelectedScenarios: setScenarios });
        fireEvent.click(screen.getByRole('button', { name: /plans? de feu comparés?/ }));
        expect(screen.getByLabelText('HPM')).not.toBeDisabled();
        expect(screen.getByLabelText('Nuit')).toBeDisabled();
        expect(screen.getByLabelText('Avec AV').closest('label')).toHaveClass('cc-scenario-checkbox');
        fireEvent.click(screen.getByLabelText('Avec AV'));
        expect(setScenarios).toHaveBeenCalledWith(['1:Avec AV']);
    });

    it('V.Utile : colonne affichée ou masquée', () => {
        const { unmount } = rendre();
        expect(screen.queryAllByText('V.Utile').length).toBeGreaterThan(0);
        unmount();
        rendre({ afficherVUtile: false });
        expect(screen.queryAllByText('V.Utile')).toHaveLength(0);
        expect(screen.getByLabelText('Afficher le V.Utile')).not.toBeChecked();
    });
});
