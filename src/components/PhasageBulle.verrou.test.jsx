import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import PhasageBulle from './PhasageBulle';
import { definirPrefsVerrou } from '../utils/verrouSaisie';

afterEach(() => act(() => definirPrefsVerrou()));

it('bloque les trois curseurs du phasage et les rend utilisables au déverrouillage', async () => {
    const modifier = vi.fn(), user = userEvent.setup();
    render(<PhasageBulle groups={[]} intersectionArrows={[]} cycleLength={60}
        onBubbleScaleChange={modifier} onBubbleRatioChange={modifier} onEllipseScaleChange={modifier} />);
    act(() => definirPrefsVerrou({ phasages: true }));
    expect(screen.getByText('(verrouillé)')).toBeInTheDocument();
    const curseurs = screen.getAllByRole('slider');
    for (const curseur of curseurs) {
        expect(curseur).toBeDisabled();
        await user.click(curseur);
        await user.keyboard('{ArrowRight}');
        expect(curseur).toHaveValue('100');
    }
    expect(modifier).not.toHaveBeenCalled();
    act(() => definirPrefsVerrou());
    expect(screen.queryByText('(verrouillé)')).toBeNull();
    for (const curseur of curseurs) {
        expect(curseur).toBeEnabled();
        fireEvent.change(curseur, { target: { value: '110' } });
    }
    expect(modifier).toHaveBeenCalledTimes(3);
});
