import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportDialogs from './SupportDialogs';

const mocks = vi.hoisted(() => ({
    buildDiagnosticReport: vi.fn(() => 'rapport technique'),
    downloadDiagnosticReport: vi.fn(),
    buildErrorJournal: vi.fn(() => 'journal'),
    buildDiagnosticJSON: vi.fn(() => ({ ok: true })),
    downloadDiagnosticJSON: vi.fn(),
    getInterceptedEntries: vi.fn(() => []),
    clearInterceptedEntries: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('../MicroVariablesDialog', () => ({ default: () => null }));
vi.mock('../HelpContent', () => ({ default: ({ initialAnchor }) => <div>Aide {initialAnchor}</div> }));
vi.mock('../../utils/diagnostics', () => ({
    buildDiagnosticReport: mocks.buildDiagnosticReport,
    downloadDiagnosticReport: mocks.downloadDiagnosticReport,
    buildErrorJournal: mocks.buildErrorJournal,
    buildDiagnosticJSON: mocks.buildDiagnosticJSON,
    downloadDiagnosticJSON: mocks.downloadDiagnosticJSON,
}));
vi.mock('../../utils/errorInterceptor', () => ({
    getInterceptedEntries: mocks.getInterceptedEntries,
    clearInterceptedEntries: mocks.clearInterceptedEntries,
}));
vi.mock('../../utils/toast', () => ({
    toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

const buildModel = (overrides = {}) => ({
    microVariablesModal: false,
    setMicroVariablesModal: vi.fn(),
    tooltipPrefs: { main: true },
    optionsModal: false,
    setOptionsModal: vi.fn(),
    helpModal: false,
    setHelpModal: vi.fn(),
    helpAnchor: 'diagramme',
    aboutModal: false,
    setAboutModal: vi.fn(),
    diagnosticModal: false,
    setDiagnosticModal: vi.fn(),
    diagnosticRefresh: 0,
    setDiagnosticRefresh: vi.fn(),
    diagnosticIncludeProject: false,
    setDiagnosticIncludeProject: vi.fn(),
    diagnosticMaskNames: true,
    setDiagnosticMaskNames: vi.fn(),
    intersectionName: 'Carrefour test',
    projectName: 'Projet test',
    groups: [],
    pfTabs: [],
    activePFId: null,
    cycleLength: 60,
    actionData: [],
    conflictMatrix: [],
    intersectionImage: null,
    imageNaturalDims: null,
    dossierReadOnly: false,
    activePfReadOnly: false,
    matricesLocked: false,
    tip: (value) => value,
    ...overrides,
});

describe('SupportDialogs', () => {
    it('isole la légende des actions et sa fermeture', () => {
        const model = buildModel({ optionsModal: true });
        render(<SupportDialogs model={model} />);

        expect(screen.getByText('Escamotage de phase')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(model.setOptionsModal).toHaveBeenCalledWith(false);
    });

    it('affiche l’aide à l’ancre demandée', () => {
        render(<SupportDialogs model={buildModel({ helpModal: true })} />);
        expect(screen.getByText('Aide diagramme')).toBeInTheDocument();
    });

    it('construit et télécharge les deux formats de diagnostic', () => {
        const model = buildModel({ diagnosticModal: true });
        render(<SupportDialogs model={model} />);

        expect(screen.getByDisplayValue('rapport technique')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Télécharger .txt' }));
        fireEvent.click(screen.getByRole('button', { name: 'Télécharger .json' }));

        expect(mocks.downloadDiagnosticReport).toHaveBeenCalledWith('rapport technique', 'diagnostic');
        expect(mocks.downloadDiagnosticJSON).toHaveBeenCalledWith({ ok: true }, 'diagnostic');
    });
});
