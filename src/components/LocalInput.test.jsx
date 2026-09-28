import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LocalInput from './LocalInput';

describe('LocalInput', () => {
    it('conserve la saisie localement jusqu’au blur', () => {
        const onCommit = vi.fn();
        render(<LocalInput value="A" onCommit={onCommit} />);
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'AB' } });
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('AB');
    });

    it('ne propage pas une valeur inchangée', () => {
        const onCommit = vi.fn();
        render(<LocalInput value="A" onCommit={onCommit} />);
        fireEvent.blur(screen.getByRole('textbox'));
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('se resynchronise avec le parent hors édition', () => {
        const onCommit = vi.fn();
        const { rerender } = render(<LocalInput value="A" onCommit={onCommit} />);
        rerender(<LocalInput value="B" onCommit={onCommit} />);
        expect(screen.getByRole('textbox')).toHaveValue('B');
    });

    it('ne remplace pas la saisie pendant l’édition', () => {
        const onCommit = vi.fn();
        const { rerender } = render(<LocalInput value="A" onCommit={onCommit} />);
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'local' } });
        rerender(<LocalInput value="parent" onCommit={onCommit} />);
        expect(input).toHaveValue('local');
    });

    it('ignore les changements en lecture seule ou désactivé', () => {
        const onCommit = vi.fn();
        const { rerender } = render(<LocalInput value="A" onCommit={onCommit} readOnly />);
        let input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'B' } });
        expect(input).toHaveValue('A');
        rerender(<LocalInput value="A" onCommit={onCommit} disabled />);
        input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'C' } });
        expect(input).toHaveValue('A');
    });

    it('sélectionne la valeur au focus sur demande', () => {
        render(<LocalInput value="A" onCommit={vi.fn()} selectOnFocus />);
        const input = screen.getByRole('textbox');
        const select = vi.spyOn(input, 'select');
        fireEvent.focus(input);
        expect(select).toHaveBeenCalledTimes(1);
    });
});
