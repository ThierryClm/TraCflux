import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProjectOpenDialog from './ProjectOpenDialog';

const buildProps = (overrides = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    projects: [
        { name: 'Projet A', savedAt: '2026-09-22T14:30:00.000Z', size: 2048 },
        { name: 'Projet B', savedAt: null, size: 0 },
    ],
    selectedProject: null,
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    tip: (value) => value,
    ...overrides,
});

describe('ProjectOpenDialog', () => {
    it('affiche les projets et délègue sélection et double-clic', () => {
        const props = buildProps();
        render(<ProjectOpenDialog {...props} />);

        const project = screen.getByText('Projet A').closest('li');
        fireEvent.click(project);
        fireEvent.doubleClick(project);

        expect(props.onSelect).toHaveBeenCalledWith('Projet A');
        expect(props.onOpen).toHaveBeenCalledWith('Projet A');
        expect(screen.getByText(/2\.0 Ko/)).toBeInTheDocument();
    });

    it('n’autorise le bouton Ouvrir qu’après sélection', () => {
        const props = buildProps();
        const { rerender } = render(<ProjectOpenDialog {...props} />);
        expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled();

        rerender(<ProjectOpenDialog {...buildProps({ selectedProject: 'Projet B', onOpen: props.onOpen })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
        expect(props.onOpen).toHaveBeenCalledWith('Projet B');
    });

    it('présente un état vide refermable', () => {
        const props = buildProps({ projects: [] });
        render(<ProjectOpenDialog {...props} />);

        expect(screen.getByText('Aucun projet sauvegardé')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(props.onClose).toHaveBeenCalledOnce();
    });
});
