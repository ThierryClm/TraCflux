import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceSidebar from './WorkspaceSidebar';

vi.mock('../SimulationPanel', () => ({ default: () => <div data-testid="simulation-panel" /> }));
vi.mock('../TrafficTable', () => ({ default: () => <div data-testid="traffic-table" /> }));
vi.mock('../PropertiesPanel', () => ({ default: () => <div data-testid="properties-panel" /> }));
vi.mock('../GroupTable', () => ({ default: () => <div data-testid="group-table" /> }));
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
    selectAllSimulationActions: vi.fn(),
    deselectAllSimulationActions: vi.fn(),
    cycleLength: 60,
    conflictMatrix: [],
    setMatrixValue: vi.fn(),
    hoveredActionId: null,
    setHoveredActionId: vi.fn(),
    setHoveredConflict: vi.fn(),
    simulationName: '',
    updateSimulationName: vi.fn(),
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
    tooltipPrefs: { traffic: true, config: true, matrix: true },
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
});
