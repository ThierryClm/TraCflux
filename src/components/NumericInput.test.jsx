import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NumericInput from './NumericInput';

const renderInput = (props = {}) => {
    const onCommit = props.onCommit || vi.fn();
    render(<NumericInput value={12} onCommit={onCommit} aria-label="nombre" {...props} />);
    return { input: screen.getByRole('textbox'), onCommit };
};

afterEach(() => {
    vi.useRealTimers();
});

describe('NumericInput', () => {
    it('filtre les caractères non numériques sans effacer la valeur existante', () => {
        const { input } = renderInput();
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '12x' } });
        expect(input).toHaveValue('12');
        expect(input).toHaveClass('numeric-input-rejected');
    });

    it('accepte une valeur vide quand elle est autorisée', () => {
        const { input, onCommit } = renderInput();
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('');
    });

    it('restaure la valeur précédente quand une valeur est requise', () => {
        const { input, onCommit } = renderInput({ allowEmpty: false });
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '' } });
        expect(input).toHaveAttribute('title', 'Valeur requise');
        fireEvent.blur(input);
        expect(input).toHaveValue('12');
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('signale les bornes sans empêcher la saisie', () => {
        const { input } = renderInput({ min: 10, max: 20 });
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '9' } });
        expect(input).toHaveClass('numeric-input-error');
        expect(input).toHaveAttribute('title', 'Valeur minimum : 10');
        fireEvent.change(input, { target: { value: '21' } });
        expect(input).toHaveAttribute('title', 'Valeur maximum : 20');
    });

    it('ne propage la valeur qu’au blur et seulement si elle a changé', () => {
        const { input, onCommit } = renderInput();
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '34' } });
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith('34');
    });

    it('reste synchronisé avec la prop hors édition', () => {
        const onCommit = vi.fn();
        const { rerender } = render(<NumericInput value={12} onCommit={onCommit} />);
        const input = screen.getByRole('textbox');
        rerender(<NumericInput value={18} onCommit={onCommit} />);
        expect(input).toHaveValue('18');
    });

    it('préserve la saisie locale pendant une édition', () => {
        const onCommit = vi.fn();
        const { rerender } = render(<NumericInput value={12} onCommit={onCommit} />);
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '15' } });
        rerender(<NumericInput value={99} onCommit={onCommit} />);
        expect(input).toHaveValue('15');
    });

    it('respecte le mode lecture seule', () => {
        const { input, onCommit } = renderInput({ readOnly: true });
        fireEvent.change(input, { target: { value: '99' } });
        fireEvent.blur(input);
        expect(input).toHaveValue('12');
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('sélectionne le contenu au focus sur demande', () => {
        const { input } = renderInput({ selectOnFocus: true });
        const select = vi.spyOn(input, 'select');
        fireEvent.focus(input);
        expect(select).toHaveBeenCalledTimes(1);
    });

    it('affiche temporairement le retour de bouclage', () => {
        vi.useFakeTimers();
        const { input } = renderInput({ wrapAt: 60, showWrapFlash: true });
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '60' } });
        fireEvent.blur(input);
        expect(input).toHaveClass('numeric-input-wrapped');
        act(() => vi.advanceTimersByTime(600));
        expect(input).not.toHaveClass('numeric-input-wrapped');
    });

    it('transmet les attributs natifs utiles', () => {
        const onClick = vi.fn();
        const { input } = renderInput({ disabled: true, placeholder: 'Durée', maxLength: 3, onClick });
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('placeholder', 'Durée');
        expect(input).toHaveAttribute('maxlength', '3');
    });
});
