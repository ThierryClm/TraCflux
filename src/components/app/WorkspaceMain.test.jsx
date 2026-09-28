import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceMain from './WorkspaceMain';

vi.mock('../TimelineDiagram', () => ({ default: () => <div data-testid="timeline" /> }));
vi.mock('../PhasageBulle', () => ({ default: () => <div data-testid="phasage" /> }));
vi.mock('../IntersectionImage', () => ({ default: () => <div data-testid="intersection" /> }));
vi.mock('../ActionTable', () => ({ default: () => <div data-testid="actions" /> }));

const buildModel = (overrides = {}) => ({
    sidebarVisible: true,
    isResizing: false,
    handleResizeStart: vi.fn(),
    diagramAreaRef: { current: null },
    pfTabs: [
        { id: 'pf-1', name: 'PF1', color: null },
        { id: 'pf-2', name: 'PF2', color: '#4CAF50' },
    ],
    activePFId: 'pf-1',
    draggedTabIndex: null,
    setDraggedTabIndex: vi.fn(),
    reorderPF: vi.fn(),
    setSimulationEnabled: vi.fn(),
    setPhasageBulleEnabled: vi.fn(),
    setActivePFId: vi.fn(),
    renamePF: vi.fn(),
    simulationEnabled: false,
    phasageBulleEnabled: false,
    setSidebarWidth: vi.fn(),
    setBrouillonPhasage: vi.fn(),
    setPhasageBulleModal: vi.fn(),
    tip: (value) => value,
    helpZoneRef: { current: null },
    diagramHeight: null,
    groups: [],
    simulationSelectedActions: [],
    phasageBulleCount: 2,
    phasageBulleTimes: [0, 30],
    brouillonPhasage: null,
    phasageModifie: false,
    intersectionArrows: [],
    phasageBulleVisibleGroups: new Set(),
    tooltipPrefs: {},
    showFloatingDiagram: false,
    simulationCurrentTime: 0,
    isPlayingSimulation: false,
    phasageBulleModal: false,
    cycleLength: 60,
    actionData: [],
    microCustomFields: [],
    recentImageDirs: [],
    currentRemarques: '',
    ...overrides,
});

describe('WorkspaceMain', () => {
    it('active un plan et quitte les modes spéciaux', () => {
        const model = buildModel();
        render(<WorkspaceMain model={model} />);

        fireEvent.click(screen.getByText('PF2'));
        expect(model.setSimulationEnabled).toHaveBeenCalledWith(false);
        expect(model.setPhasageBulleEnabled).toHaveBeenCalledWith(false);
        expect(model.setActivePFId).toHaveBeenCalledWith('pf-2');
    });

    it('active la simulation et ajuste le panneau latéral', () => {
        const model = buildModel();
        render(<WorkspaceMain model={model} />);

        fireEvent.click(screen.getByText('Simulation'));
        expect(model.setPhasageBulleEnabled).toHaveBeenCalledWith(false);
        expect(model.setSimulationEnabled).toHaveBeenCalledWith(true);
        expect(model.setSidebarWidth).toHaveBeenCalledWith(395);
    });

    it('ouvre la configuration du phasage bulle avant de l’activer', () => {
        const model = buildModel();
        render(<WorkspaceMain model={model} />);

        fireEvent.click(screen.getByText('Phasage bulle'));
        expect(model.setSimulationEnabled).toHaveBeenCalledWith(false);
        expect(model.setBrouillonPhasage).toHaveBeenCalledWith(null);
        expect(model.setPhasageBulleModal).toHaveBeenCalledWith(true);
        expect(model.setPhasageBulleEnabled).toHaveBeenCalledWith(true);
    });
});
