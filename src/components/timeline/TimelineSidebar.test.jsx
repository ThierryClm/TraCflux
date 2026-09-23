import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimelineSidebar from './TimelineSidebar';

const group = {
    id: 1,
    name: 'Avenue Nord',
    type: 'V',
    da: 'N1',
    minGreen: 8,
    offset: 10,
    durations: { green: 20, orange: 3, red: 27 }
};

const renderSidebar = (props = {}) => {
    const componentProps = {
        cycleLength: 60,
        effectiveCycleLength: 60,
        escamotageGroupIds: new Set(),
        groups: [group],
        handleEndChange: vi.fn(),
        handleNameMouseEnter: vi.fn(),
        handleNameMouseLeave: vi.fn(),
        handlePhaseFlagKeyDown: vi.fn(),
        handleStartChange: vi.fn(),
        onGroupClick: vi.fn(),
        showGroupNames: true,
        showWrapFlash: true,
        updateGroupParams: vi.fn(),
        ...props
    };
    const result = render(<TimelineSidebar {...componentProps} />);
    return { ...result, ...componentProps };
};

describe('TimelineSidebar', () => {
    it('affiche les colonnes et sélectionne un groupe', () => {
        const { container, onGroupClick } = renderSidebar();

        expect(screen.getByText('Avenue Nord')).toBeInTheDocument();
        expect(screen.getByText('Déb')).toBeInTheDocument();
        fireEvent.click(container.querySelector('.row-label-container'));
        expect(onGroupClick).toHaveBeenCalledWith(group);
    });

    it('délègue le raccourci de phase et les survols du nom', () => {
        const { container, handleNameMouseEnter, handleNameMouseLeave, handlePhaseFlagKeyDown } = renderSidebar();
        const row = container.querySelector('.row-label-container');
        const name = container.querySelector('.label-name-wrapper');

        fireEvent.keyDown(row, { key: 'a', altKey: true });
        expect(handlePhaseFlagKeyDown).toHaveBeenCalledWith(expect.anything(), 1, undefined);
        fireEvent.mouseEnter(name);
        fireEvent.mouseLeave(name);
        expect(handleNameMouseEnter).toHaveBeenCalledWith(1);
        expect(handleNameMouseLeave).toHaveBeenCalledOnce();
    });

    it('délègue les modifications du code trajet et des bornes', () => {
        const { container, handleEndChange, handleStartChange, updateGroupParams } = renderSidebar();
        const da = container.querySelector('.input-da');
        const timeInputs = container.querySelectorAll('input.input-time-sm[type="text"]');

        fireEvent.change(da, { target: { value: 'ABC' } });
        fireEvent.blur(da);
        expect(updateGroupParams).toHaveBeenCalledWith(1, { da: 'AB' });

        fireEvent.change(timeInputs[0], { target: { value: '12' } });
        fireEvent.blur(timeInputs[0]);
        expect(handleStartChange).toHaveBeenCalledWith(1, '12');

        fireEvent.change(timeInputs[1], { target: { value: '35' } });
        fireEvent.blur(timeInputs[1]);
        expect(handleEndChange).toHaveBeenCalledWith(1, '35', 10);
    });

    it('affiche les valeurs simulées et verrouille les champs', () => {
        const { container } = renderSidebar({
            effectiveCycleLength: 70,
            simulationResult: {
                simulatedGroups: [{ id: 1, simulatedOffset: 15, simulatedGreen: 25 }]
            }
        });
        const values = Array.from(container.querySelectorAll('input')).map((input) => input.value);

        expect(values).toEqual(['N1', '15', '40', '25']);
        expect(Array.from(container.querySelectorAll('input')).every((input) => input.disabled || input.readOnly)).toBe(true);
    });
});
