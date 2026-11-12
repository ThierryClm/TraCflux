import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WorkspaceSidebar from './WorkspaceSidebar';
import userEvent from '@testing-library/user-event';
import { definirPrefsVerrou } from '../../utils/verrouSaisie';

afterEach(() => act(() => definirPrefsVerrou()));

vi.mock('../SimulationPanel', () => ({ default: () => <div data-testid="simulation-panel" /> }));
vi.mock('../TrafficTable', () => ({ default: () => <div data-testid="traffic-table" /> }));
vi.mock('../PropertiesPanel', () => ({ default: ({ tooltipsEnabled }) => <div data-testid="properties-panel" data-infobulles={String(tooltipsEnabled)} /> }));
vi.mock('../GroupTable', () => ({ default: ({ tooltipsEnabled }) => <div data-testid="group-table" data-infobulles={String(tooltipsEnabled)} /> }));
vi.mock('../IntergreenMatrix', () => ({
    default: ({ setMatrixValue }) => (
        <div data-testid="matrix" data-has-setter={String(typeof setMatrixValue === 'function')} />
    ),
}));
vi.mock('../DiagnosticPanel', () => ({ default: () => <div data-testid="diagnostic" /> }));
vi.mock('../ConflictList', () => ({ default: () => <div data-testid="conflicts" /> }));

const buildModel = (overrides = {}) => ({
    sidebarVisible: true,
    phasageBulleEnabled: false,
    sidebarWidth: 450,
    groups: [
        { id: 1, name: 'Nord', courant: 'VL', type: 'VL' },
        { id: 2, name: 'Sud', courant: 'VL', type: 'VL' },
        { id: 3, name: 'Est', courant: 'Piéton', type: 'Piéton' },
    ],
    intersectionArrows: [{ groupId: 1 }, { groupId: 3 }],
    phasageBulleVisibleGroups: new Set([1]),
    hoveredPhasageGroupId: null,
    setHoveredPhasageGroupId: vi.fn(),
    togglePhasageBulleGroup: vi.fn(),
    setPhasageBulleVisibleGroups: vi.fn(),
    tip: (value) => value,
    simulationEnabled: false,
    actionData: [],
    simulationSelectedActions: [],
    toggleSimulationAction: vi.fn(),
    cycleLength: 60,
    conflictMatrix: [],
    setMatrixValue: vi.fn(),
    hoveredActionId: null,
    setHoveredActionId: vi.fn(),
    setHoveredConflict: vi.fn(),
    simulationName: '',
    simulationScenarios: [],
    infoSuppressionJeuTrafic: vi.fn(),
    supprimerJeuTrafic: vi.fn(),
    choisirScenarioSimulation: vi.fn(),
    creerScenarioSimulation: vi.fn(),
    enregistrerScenarioSimulation: vi.fn(),
    supprimerScenarioSimulation: vi.fn(),
    activeTrafficDataset: 'default',
    setActiveTrafficDataset: vi.fn(),
    updateTrafficData: vi.fn(),
    getTrafficData: vi.fn(),
    updateGroupParams: vi.fn(),
    setHoveredArrowGroupId: vi.fn(),
    hoveredArrowGroupId: null,
    setHoveredArrowGroupSaturated: vi.fn(),
    trafficDatasetNames: {},
    setHoveredVUtile: vi.fn(),
    copyTrafficDataset: vi.fn(),
    addCustomTrafficDataset: vi.fn(),
    simulationResult: null,
    setShowFloatingTraffic: vi.fn(),
    tooltipPrefs: { traffic: true, config: true, form: true, matrix: true },
    activeTab: 'properties',
    setActiveTab: vi.fn(),
    setSidebarWidth: vi.fn(),
    intersectionName: 'Carrefour',
    setIntersectionName: vi.fn(),
    projectProperties: {},
    updateProjectProperty: vi.fn(),
    appCommunes: [],
    appMoaLogos: [],
    appMoeLogos: [],
    setShowFloatingProperties: vi.fn(),
    showGroupNamesForm: true,
    setShowFloatingForm: vi.fn(),
    startDrag: vi.fn(),
    endDrag: vi.fn(),
    activePFId: 'pf-1',
    pfTabs: [{ id: 'pf-1', name: 'PF1' }],
    biCarrefourSeparator: null,
    showGroupNamesMatrix: true,
    matricesLocked: false,
    setShowFloatingMatrix: vi.fn(),
    showCapacityReserve: false,
    showFloatingDiagnostic: false,
    setShowFloatingDiagnostic: vi.fn(),
    displayConflicts: [],
    isConflictGrayed: vi.fn(),
    showFloatingConflicts: false,
    setShowFloatingConflicts: vi.fn(),
    recentOpenDirs: [],
    recentSaveDirs: [],
    recentImportDirs: [],
    helpZoneRef: { current: null },
    ...overrides,
});

describe('WorkspaceSidebar', () => {
    it('gère la sélection des groupes du phasage bulle', () => {
        const model = buildModel({ phasageBulleEnabled: true });
        render(<WorkspaceSidebar model={model} />);

        const unavailable = screen.getByRole('checkbox', { name: /Sud/i });
        expect(unavailable).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Tout cocher' }));
        expect(model.setPhasageBulleVisibleGroups).toHaveBeenCalledWith(new Set([1, 3]));
        fireEvent.click(screen.getByRole('button', { name: 'Tout décocher' }));
        expect(model.setPhasageBulleVisibleGroups).toHaveBeenCalledWith(new Set());
    });

    it('affiche le mode simulation avec le tableau trafic en lecture seule', () => {
        render(<WorkspaceSidebar model={buildModel({ simulationEnabled: true })} />);
        expect(screen.getByTestId('simulation-panel')).toBeInTheDocument();
        expect(screen.getByTestId('traffic-table')).toBeInTheDocument();
    });

    it('paramètres masqués : le panneau se replie, sauf en simulation', () => {
        const { container, unmount } = render(<WorkspaceSidebar model={buildModel({ sidebarVisible: false })} />);
        expect(container.querySelector('aside.sidebar').classList.contains('repliee')).toBe(true);
        unmount();
        const simu = render(<WorkspaceSidebar model={buildModel({ sidebarVisible: false, simulationEnabled: true })} />);
        const aside = simu.container.querySelector('aside.sidebar');
        expect(aside.classList.contains('repliee')).toBe(false);
        expect(aside.style.width).not.toBe('0px');
        expect(screen.getByTestId('simulation-panel')).toBeInTheDocument();
    });

    it('centralise le changement d’onglet et le calcul de largeur de la matrice', () => {
        const model = buildModel();
        render(<WorkspaceSidebar model={model} />);

        fireEvent.click(screen.getByRole('button', { name: 'Matrice' }));
        expect(model.setActiveTab).toHaveBeenCalledWith('matrix');
        expect(model.setSidebarWidth).toHaveBeenCalledWith(300);
    });

    it('transmet la modification de matrice dans les onglets de configuration', () => {
        const model = buildModel({ activeTab: 'config' });
        render(<WorkspaceSidebar model={model} />);

        expect(screen.getByTestId('matrix')).toHaveAttribute('data-has-setter', 'true');
    });

    it('les infobulles du formulaire se règlent indépendamment de la configuration', () => {
        const model = buildModel({ activeTab: 'config', tooltipPrefs: { config: false, form: true } });
        const { rerender } = render(<WorkspaceSidebar model={model} />);
        expect(screen.getByTestId('group-table')).toHaveAttribute('data-infobulles', 'true');
        rerender(<WorkspaceSidebar model={{ ...model, activeTab: 'properties' }} />);
        expect(screen.getByTestId('properties-panel')).toHaveAttribute('data-infobulles', 'false');
        const inverse = { ...model, tooltipPrefs: { config: true, form: false } };
        rerender(<WorkspaceSidebar model={inverse} />);
        expect(screen.getByTestId('group-table')).toHaveAttribute('data-infobulles', 'false');
        rerender(<WorkspaceSidebar model={{ ...inverse, activeTab: 'properties' }} />);
        expect(screen.getByTestId('properties-panel')).toHaveAttribute('data-infobulles', 'true');
    });
});

it('verrouille les groupes du phasage, conserve le survol et respecte les groupes sans flèche au déverrouillage', async () => {
    const user = userEvent.setup();
    const model = buildModel({ phasageBulleEnabled: true });
    const { container } = render(<WorkspaceSidebar model={model} />);
    act(() => definirPrefsVerrou({ phasages: true }));
    const cases = screen.getAllByRole('checkbox');
    for (const champ of cases) expect(champ).toBeDisabled();
    await user.click(screen.getByText('Tout décocher'));
    expect(model.setPhasageBulleVisibleGroups).not.toHaveBeenCalled();
    fireEvent.mouseEnter(container.querySelector('.phasage-group-item'));
    expect(model.setHoveredPhasageGroupId).toHaveBeenCalledWith(1);
    act(() => definirPrefsVerrou());
    expect(cases[0]).toBeEnabled();
    expect(cases[1]).toBeDisabled();
    expect(cases[2]).toBeEnabled();
    fireEvent.click(cases[0]);
    expect(model.togglePhasageBulleGroup).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Tout décocher'));
    expect(model.setPhasageBulleVisibleGroups).toHaveBeenCalledWith(new Set());
});

it('masque l’onglet Détecteurs quand le module est désactivé', () => {
    const { rerender } = render(
        <WorkspaceSidebar model={buildModel({ detecteurModule: false, detecteurs: [], setDetecteurs: vi.fn() })} />
    );
    expect(screen.queryByRole('button', { name: 'Détecteurs' })).toBeNull();

    rerender(<WorkspaceSidebar model={buildModel({ detecteurModule: true, detecteurs: [], setDetecteurs: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Détecteurs' })).toBeInTheDocument();
});
