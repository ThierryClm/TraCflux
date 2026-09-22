import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomeScreen from './WelcomeScreen';
import ProjectHeader from './ProjectHeader';
import DossierPrintDialog from './DossierPrintDialog';
import PrintPreviewModal from './PrintPreviewModal';

const tip = (value) => value;

const buildHeaderProps = (overrides = {}) => ({
    project: {
        projectName: 'Carrefour test',
        setProjectName: vi.fn(),
        isDirty: false,
        projectNameInputRef: { current: null },
    },
    groupCount: {
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
        groupCountInput: '3',
        setGroupCountInput: vi.fn(),
        setGroupCount: vi.fn(),
        askConfirm: vi.fn().mockResolvedValue(true),
    },
    history: { undo: vi.fn(), redo: vi.fn(), canUndo: true, canRedo: true },
    dependencies: {
        showDependencies: false,
        setShowDependencies: vi.fn(),
        dependencyGap: 20,
        setDependencyGap: vi.fn(),
        conflicts: [],
    },
    plan: {
        pfTabs: [{ id: 'pf-1', name: 'PF1', color: null }],
        activePFId: 'pf-1',
        setPFColor: vi.fn(),
    },
    account: { accountsEnabled: false, currentUser: null, logout: vi.fn() },
    help: { helpZoneRef: { current: null }, tip },
    example: false,
    readOnly: false,
    ...overrides,
});

const buildPreviewProps = (overrides = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    project: {
        projectName: 'Projet test',
        intersectionName: 'Intersection test',
        projectProperties: {},
        groups: [{ id: 1, name: 'Nord', durations: { green: 20, orange: 3, red: 37 } }],
        conflictMatrix: [[0]],
        cycleLength: 60,
    },
    plans: { pfTabs: [{ id: 'pf-1', name: 'PF1' }], activePFId: 'pf-1', pfTrafficDatasetMap: {} },
    traffic: { activeTrafficDataset: 'default', trafficDatasets: {}, trafficDatasetNames: {} },
    simulation: { simulationName: '', simulationResultImpression: null, simulationSelectedActions: [] },
    image: {
        intersectionImage: null,
        intersectionArrows: [],
        imageBrightness: 100,
        imageContrast: 100,
        imageNaturalDims: null,
    },
    print: {
        printType: 'matrix',
        dossierSections: {},
        dossierPortrait: false,
        dossierPrintWidth: 1000,
        descriptionPrintStyle: {},
        largeurConditionsImpression: 100,
        microPrintStyle: {},
        printPreviewPageRef: { current: null },
        injectDossierFooterStyle: vi.fn(),
    },
    actions: { actionData: [], microCustomFields: [] },
    preferences: { tooltipPrefs: {} },
    ...overrides,
});

describe('WelcomeScreen', () => {
    it('propose le projet exemple uniquement sur l’accueil', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const { rerender } = render(<WelcomeScreen hasActiveProject={false} showExampleInvite />);

        fireEvent.click(screen.getByRole('button', { name: /découvrir avec un projet exemple/i }));
        expect(open).toHaveBeenCalledWith(expect.stringContaining('?example=carrefour'), '_blank');

        rerender(<WelcomeScreen hasActiveProject showExampleInvite />);
        expect(screen.queryByText(/commencez par/i)).not.toBeInTheDocument();
        open.mockRestore();
    });
});

describe('ProjectHeader', () => {
    it('confirme une réduction du nombre de groupes avant de l’appliquer', async () => {
        const props = buildHeaderProps();
        props.groupCount.groupCountInput = '2';
        render(<ProjectHeader {...props} />);

        fireEvent.blur(screen.getByRole('spinbutton'));

        await waitFor(() => expect(props.groupCount.askConfirm).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Réduire le nombre de groupes', danger: true }),
        ));
        expect(props.groupCount.setGroupCount).toHaveBeenCalledWith(2);
    });

    it('affiche les états exemple, lecture seule et modifications non sauvegardées', () => {
        const props = buildHeaderProps({ example: true, readOnly: true });
        props.project.isDirty = true;
        render(<ProjectHeader {...props} />);

        expect(screen.getByText(/projet exemple/i)).toBeInTheDocument();
        expect(screen.getByText(/dossier en/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/modifications non sauvegardées/i)).toBeInTheDocument();
    });

    it('délègue l’affichage des dépendances et la validation du plan', () => {
        const props = buildHeaderProps();
        render(<ProjectHeader {...props} />);

        fireEvent.click(screen.getByRole('button', { name: /dépendance/i }));
        expect(props.dependencies.setShowDependencies).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByRole('button', { name: 'Valider' }), { ctrlKey: true });
        expect(props.plan.setPFColor).toHaveBeenCalledWith('pf-1', '#e74c3c');
    });
});

describe('DossierPrintDialog', () => {
    const renderDialog = (overrides = {}) => {
        const props = {
            isOpen: true,
            onClose: vi.fn(),
            portrait: false,
            setPortrait: vi.fn(),
            sections: {},
            setSections: vi.fn(),
            plans: [{ id: 'pf-1', name: 'PF1' }],
            simulationResult: null,
            intersectionImage: null,
            intersectionArrows: [],
            onExportPdf: vi.fn(),
            onPrint: vi.fn(),
            tip,
            ...overrides,
        };
        render(<DossierPrintDialog {...props} />);
        return props;
    };

    it('ne rend rien quand le dialogue est fermé', () => {
        renderDialog({ isOpen: false });
        expect(screen.queryByRole('heading', { name: /imprimer le dossier/i })).not.toBeInTheDocument();
    });

    it('regroupe les options d’un plan quand son diagramme est coché', () => {
        const props = renderDialog();
        fireEvent.click(screen.getByLabelText('Diagramme PF1'));

        const updater = props.setSections.mock.calls[0][0];
        expect(updater({})).toMatchObject({
            'diagram_pf-1': true,
            'conditionsMicro_pf-1': true,
            'variablesMicro_pf-1': true,
            'phasageBulle_pf-1': true,
            'traficCapacite_pf-1': true,
            'reserveCapacite_pf-1': true,
        });
    });

    it('expose séparément l’export PDF et l’impression', () => {
        const props = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Exporter PDF' }));
        fireEvent.click(screen.getByRole('button', { name: 'Imprimer' }));

        expect(props.onExportPdf).toHaveBeenCalledOnce();
        expect(props.onPrint).toHaveBeenCalledOnce();
        expect(screen.getByLabelText('Scénario')).toBeDisabled();
    });
});

describe('PrintPreviewModal', () => {
    beforeEach(() => {
        document.body.className = '';
    });

    it('affiche un aperçu matriciel minimal et se ferme par la croix', () => {
        const props = buildPreviewProps();
        render(<PrintPreviewModal {...props} />);

        expect(screen.getByRole('heading', { name: /aperçu - matrice/i })).toBeInTheDocument();
        expect(screen.getByText('Intersection test')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /fermer la fenêtre/i }));
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('encadre window.print avec la classe correspondant au type', () => {
        const print = vi.spyOn(window, 'print').mockImplementation(() => {});
        render(<PrintPreviewModal {...buildPreviewProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Imprimer' }));

        expect(print).toHaveBeenCalledOnce();
        expect(document.body).not.toHaveClass('print-matrix');
        print.mockRestore();
    });
});
