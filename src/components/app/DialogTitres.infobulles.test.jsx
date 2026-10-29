import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiagramEditDialogs from './DiagramEditDialogs';
import SupportDialogs from './SupportDialogs';

/**
 * Le titre d'une fenêtre (prop `title` de Modal, affichée en <h3>) est un
 * texte visible, pas une infobulle : décocher « Page principale » dans
 * Mise en page → Infobulles ne doit pas l'effacer.
 */

// `tip` de App.tsx quand la case « Page principale » est décochée.
const tipDecoche = () => undefined;

const ferme = () => ({ isOpen: false, onClose: vi.fn() });

describe('titres de fenêtres et case « Page principale » décochée', () => {
    it('DiagramEditDialogs garde le titre « Glisser le diagramme »', () => {
        const slide = {
            isOpen: true, onClose: vi.fn(),
            fromGroup: 1, onFromGroupChange: vi.fn(),
            toGroup: 1, onToGroupChange: vi.fn(),
            value: 0, onValueChange: vi.fn(),
            touched: false, onConfirm: vi.fn(),
        };
        render(
            <DiagramEditDialogs
                groups={[{ id: 1, name: 'Nord' }]}
                cycleLength={60}
                tip={tipDecoche}
                slide={slide}
                insert={ferme()}
                reduce={ferme()}
                moveGroup={ferme()}
                biCarrefour={ferme()}
            />
        );
        expect(screen.getByRole('heading', { name: 'Glisser le diagramme' })).toBeInTheDocument();
        // Les infobulles des champs, elles, disparaissent bien.
        expect(screen.getByLabelText(/du groupe/i)).not.toHaveAttribute('title');
    });

    it('SupportDialogs garde le titre de la légende des actions', () => {
        render(
            <SupportDialogs
                model={{
                    aboutModal: false, actionData: [], activePFId: 1, activePfReadOnly: false, conflictMatrix: [],
                    cycleLength: 60, diagnosticIncludeProject: false, diagnosticMaskNames: false, diagnosticModal: false,
                    diagnosticRefresh: 0, dossierReadOnly: false, groups: [], helpAnchor: null, helpModal: false,
                    imageNaturalDims: null, intersectionImage: null, intersectionName: '', matricesLocked: false,
                    microVariablesModal: false, optionsModal: true, pfTabs: [], projectName: null,
                    setAboutModal: vi.fn(), setDiagnosticIncludeProject: vi.fn(), setDiagnosticMaskNames: vi.fn(),
                    setDiagnosticModal: vi.fn(), setDiagnosticRefresh: vi.fn(), setHelpModal: vi.fn(),
                    setMicroVariablesModal: vi.fn(), setOptionsModal: vi.fn(),
                    tip: tipDecoche, tooltipPrefs: { main: false },
                }}
            />
        );
        expect(screen.getByRole('heading', { name: 'Options - Légende des actions' })).toBeInTheDocument();
    });
});
