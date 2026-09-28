import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiagramEditDialogs from './DiagramEditDialogs';

const closedDialog = () => ({ isOpen: false, onClose: vi.fn() });

const buildProps = (overrides = {}) => ({
    groups: [
        { id: 1, name: 'Nord' },
        { id: 2, name: 'Sud' },
        { id: 3, name: '' },
    ],
    cycleLength: 60,
    tip: (value) => value,
    slide: closedDialog(),
    insert: closedDialog(),
    reduce: closedDialog(),
    moveGroup: closedDialog(),
    biCarrefour: closedDialog(),
    ...overrides,
});

describe('DiagramEditDialogs', () => {
    it('délègue les valeurs du glissement puis sa validation', () => {
        const slide = {
            isOpen: true,
            onClose: vi.fn(),
            fromGroup: 1,
            onFromGroupChange: vi.fn(),
            toGroup: 2,
            onToGroupChange: vi.fn(),
            value: 4,
            onValueChange: vi.fn(),
            touched: true,
            onConfirm: vi.fn(),
        };
        render(<DiagramEditDialogs {...buildProps({ slide })} />);

        fireEvent.change(screen.getByLabelText(/du groupe/i), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText(/au groupe/i), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText(/décalage/i), { target: { value: '-5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

        expect(slide.onFromGroupChange).toHaveBeenCalledWith(2);
        expect(slide.onToGroupChange).toHaveBeenCalledWith(3);
        expect(slide.onValueChange).toHaveBeenCalledWith(-5);
        expect(slide.onConfirm).toHaveBeenCalledOnce();
    });

    it('garde les actions insertion et réduction inactives sans modification', () => {
        const insert = {
            isOpen: true,
            onClose: vi.fn(),
            start: 10,
            onStartChange: vi.fn(),
            duration: 5,
            onDurationChange: vi.fn(),
            touched: false,
            onConfirm: vi.fn(),
        };
        const { rerender } = render(<DiagramEditDialogs {...buildProps({ insert })} />);
        expect(screen.getByRole('button', { name: 'Insérer' })).toBeDisabled();

        const reduce = {
            isOpen: true,
            onClose: vi.fn(),
            start: 15,
            onStartChange: vi.fn(),
            duration: 5,
            onDurationChange: vi.fn(),
            touched: false,
            onConfirm: vi.fn(),
        };
        rerender(<DiagramEditDialogs {...buildProps({ reduce })} />);
        expect(screen.getByRole('button', { name: 'Réduire' })).toBeDisabled();
    });

    it('exclut le groupe déplacé des positions cibles', () => {
        const moveGroup = {
            isOpen: true,
            onClose: vi.fn(),
            groupId: '2',
            onGroupChange: vi.fn(),
            afterGroupId: '1',
            onAfterGroupChange: vi.fn(),
            touched: true,
            onConfirm: vi.fn(),
        };
        render(<DiagramEditDialogs {...buildProps({ moveGroup })} />);

        const target = screen.getByLabelText(/insérer après/i);
        expect(target).not.toHaveTextContent('Sud');
        expect(target).toHaveTextContent('Nord');
        fireEvent.click(screen.getByRole('button', { name: 'Déplacer' }));
        expect(moveGroup.onConfirm).toHaveBeenCalledOnce();
    });

    it('ne propose pas le dernier groupe comme séparation bi-carrefour', () => {
        const biCarrefour = {
            isOpen: true,
            onClose: vi.fn(),
            groupId: '1',
            onGroupChange: vi.fn(),
            touched: true,
            onConfirm: vi.fn(),
        };
        render(<DiagramEditDialogs {...buildProps({ biCarrefour })} />);

        const select = screen.getByLabelText(/séparation après/i);
        expect(select).toHaveTextContent('Nord');
        expect(select).toHaveTextContent('Sud');
        expect(select).not.toHaveTextContent('Groupe 3');
        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        expect(biCarrefour.onConfirm).toHaveBeenCalledOnce();
    });
});
