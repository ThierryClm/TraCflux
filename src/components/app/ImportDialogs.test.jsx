import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImportDialogs from './ImportDialogs';

const buildProps = (overrides = {}) => ({
    spreadsheet: {
        isOpen: false,
        onClose: vi.fn(),
        hintDirectory: '',
        onFileSelect: vi.fn(),
        file: null,
        error: '',
        onImport: vi.fn(),
    },
    html: {
        isOpen: false,
        onClose: vi.fn(),
        onFileSelect: vi.fn(),
        file: null,
        error: '',
        onImport: vi.fn(),
    },
    recent: {
        files: [],
        directories: [],
        formatDate: vi.fn((value) => value),
        onFileClick: vi.fn(),
    },
    tip: (value) => value,
    ...overrides,
});

describe('ImportDialogs', () => {
    it('présente le contexte et les éléments récents de l’import tableur', () => {
        const recent = {
            files: [{ name: 'trafic.xlsx', timestamp: 'hier' }],
            directories: ['C:/Projets/Trafic'],
            formatDate: vi.fn(() => '22/09/2026'),
            onFileClick: vi.fn(),
        };
        const spreadsheet = {
            ...buildProps().spreadsheet,
            isOpen: true,
            hintDirectory: 'C:/Projets/Trafic',
            file: { name: 'nouveau.xlsx' },
            error: 'Colonne manquante',
        };
        render(<ImportDialogs {...buildProps({ spreadsheet, recent })} />);

        expect(screen.getAllByText('C:/Projets/Trafic')).toHaveLength(2);
        expect(screen.getByText(/Fichier sélectionné : nouveau\.xlsx/)).toBeInTheDocument();
        expect(screen.getByText('Colonne manquante')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /trafic\.xlsx/i }));
        expect(recent.onFileClick).toHaveBeenCalledWith(recent.files[0]);
    });

    it('délègue la sélection et bloque l’import sans fichier', () => {
        const spreadsheet = { ...buildProps().spreadsheet, isOpen: true };
        render(<ImportDialogs {...buildProps({ spreadsheet })} />);

        const input = screen.getByLabelText(/sélectionner un fichier CSV ou Excel/i);
        const file = new File(['data'], 'trafic.csv', { type: 'text/csv' });
        fireEvent.change(input, { target: { files: [file] } });

        expect(spreadsheet.onFileSelect).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    });

    it('importe un fichier HTM sélectionné', () => {
        const html = {
            ...buildProps().html,
            isOpen: true,
            file: { name: 'carrefour.htm' },
        };
        render(<ImportDialogs {...buildProps({ html })} />);

        expect(screen.getByText(/Fichier sélectionné : carrefour\.htm/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Importer et ouvrir' }));
        expect(html.onImport).toHaveBeenCalledOnce();
    });
});
