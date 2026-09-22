import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GreenWaveDialogs from './GreenWaveDialogs';

vi.mock('../CreateGreenWaveDialog', () => ({ default: () => null }));
vi.mock('../GreenWaveViewer', () => ({ default: () => null }));

const buildProps = (openOverrides = {}) => ({
    openDialog: {
        isOpen: true,
        onClose: vi.fn(),
        savedGreenWaves: [{
            name: 'Axe principal',
            intersections: [{ id: 1 }, { id: 2 }],
            speedUp: 45,
            savedAt: '2026-09-22T12:00:00Z',
        }],
        selectedName: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onDelete: vi.fn(),
        formatDate: vi.fn(() => '22/09/2026'),
        ...openOverrides,
    },
    createDialog: {
        isOpen: false,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        getAllSaves: vi.fn(),
        loadProjectData: vi.fn(),
    },
    viewer: { isOpen: false, onClose: vi.fn(), intersections: [] },
    tip: (value) => value,
});

describe('GreenWaveDialogs', () => {
    it('ouvre directement l’onde verte double-cliquée', () => {
        const props = buildProps();
        render(<GreenWaveDialogs {...props} />);

        expect(screen.getByText(/2 carrefours • 45 km\/h/)).toBeInTheDocument();
        fireEvent.doubleClick(screen.getByText('Axe principal'));
        expect(props.openDialog.onOpen).toHaveBeenCalledWith('Axe principal');
    });

    it('supprime sans sélectionner ni ouvrir la ligne', () => {
        const props = buildProps();
        render(<GreenWaveDialogs {...props} />);

        fireEvent.click(screen.getByRole('button', { name: 'Supprimer Axe principal' }));
        expect(props.openDialog.onDelete).toHaveBeenCalledWith('Axe principal');
        expect(props.openDialog.onSelect).not.toHaveBeenCalled();
    });

    it('désactive l’ouverture sans sélection et affiche l’état vide', () => {
        const props = buildProps({ savedGreenWaves: [] });
        render(<GreenWaveDialogs {...props} />);

        expect(screen.getByText('Aucune onde verte sauvegardée.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled();
    });
});
