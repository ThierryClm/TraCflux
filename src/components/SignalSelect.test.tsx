import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SignalSelect from './SignalSelect';
import { definirPrefsVerrou } from '../utils/verrouSaisie';

afterEach(() => {
    act(() => definirPrefsVerrou());
});

const props = {
    value: 'R14tg',
    type: 'V',
    courant: 'TàG',
    label: 'Signal du groupe 1',
    title: 'Signal tricolore directionnel, tourne-à-gauche',
    tooltipsEnabled: true,
};

const ouvrir = () => {
    const champ = screen.getByRole('combobox', { name: props.label });
    fireEvent.click(champ);
    return { champ, liste: screen.getByRole('listbox') };
};

describe('SignalSelect — mêmes pictogrammes que sur le carrefour', () => {
    it('montre le dessin choisi et permet de choisir un code illustré dans la liste', async () => {
        const onChange = vi.fn();
        render(<SignalSelect {...props} onChange={onChange} />);
        const user = userEvent.setup();
        const champ = screen.getByRole('combobox', { name: props.label });
        await user.click(champ);
        const liste = screen.getByRole('listbox');
        expect(champ.querySelector('svg')).toHaveAttribute('data-forme', 'tg');
        const direct = within(liste).getByRole('option', { name: /^R14d\s/ });
        expect(direct.querySelector('svg')).toHaveAttribute('data-forme', 'd');
        expect(within(liste).getByRole('option', { name: /^R14tg\s/ })).toHaveAttribute('aria-selected', 'true');
        await user.click(direct);
        expect(onChange).toHaveBeenCalledWith('R14d');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(champ).toHaveAttribute('aria-expanded', 'false');
        expect(champ).toHaveFocus();
    });

    it.each([
        ['R18tg', 'B', 'barre-g'],
        ['R25', '', 'stop'],
        ['A13b', 'PP', 'a13b'],
        ['R19', 'CY', 'cycle-direction'],
    ])('%s conserve sa forme distinctive et son pictogramme allumé', (value, type, forme) => {
        render(<SignalSelect {...props} value={value} type={type} onChange={vi.fn()} />);
        const champ = screen.getByRole('combobox', { name: props.label });
        const svg = champ.querySelector('svg');
        expect(svg).toHaveAttribute('data-forme', forme);
        expect(svg?.innerHTML).not.toContain('rgb(120, 120, 120)');
    });

    it('garde un code inconnu lisible, sans lui inventer de dessin', () => {
        const onChange = vi.fn();
        render(<SignalSelect {...props} value="R99" onChange={onChange} />);
        const { champ, liste } = ouvrir();
        expect(champ).toHaveValue('R99');
        expect(champ.querySelector('svg')).toBeNull();
        expect(within(liste).getByRole('option', { name: /^R99/ })).toHaveAttribute('aria-selected', 'true');
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('SignalSelect — navigation et verrouillage', () => {
    it('parcourt au clavier sans enregistrer avant Entrée ; Échap annule le choix en cours', () => {
        const onChange = vi.fn();
        render(<SignalSelect {...props} onChange={onChange} />);
        const champ = screen.getByRole('combobox', { name: props.label });
        champ.focus();
        fireEvent.keyDown(champ, { key: 'ArrowDown' });
        expect(champ).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(champ, { key: 'End' });
        const liste = screen.getByRole('listbox');
        const derniere = within(liste).getAllByRole('option').at(-1)!;
        expect(champ).toHaveAttribute('aria-activedescendant', derniere.id);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.keyDown(champ, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
        expect(champ).toHaveFocus();
        fireEvent.keyDown(champ, { key: 'ArrowDown' });
        fireEvent.keyDown(champ, { key: 'Home' });
        fireEvent.keyDown(champ, { key: 'Enter' });
        expect(onChange).toHaveBeenCalledWith('');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('ferme par Tab sans modifier le signal', () => {
        const onChange = vi.fn();
        render(<SignalSelect {...props} onChange={onChange} />);
        const { champ } = ouvrir();
        fireEvent.keyDown(champ, { key: 'ArrowDown' });
        fireEvent.keyDown(champ, { key: 'Tab' });
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('ferme la liste et bloque le choix quand la configuration est verrouillée', () => {
        const onChange = vi.fn();
        render(<SignalSelect {...props} onChange={onChange} />);
        const { champ } = ouvrir();
        act(() => definirPrefsVerrou({ configuration: true }));
        expect(champ).toBeDisabled();
        expect(screen.queryByRole('listbox')).toBeNull();
        fireEvent.click(champ);
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
        act(() => definirPrefsVerrou());
        expect(champ).not.toBeDisabled();
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('ferme au changement de type et ne rouvre pas une ancienne liste au retour', () => {
        const onChange = vi.fn();
        const { rerender } = render(<SignalSelect {...props} onChange={onChange} />);
        ouvrir();
        rerender(<SignalSelect {...props} type="B" onChange={onChange} />);
        expect(screen.queryByRole('listbox')).toBeNull();
        rerender(<SignalSelect {...props} onChange={onChange} />);
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('respecte les champs désactivés et le dossier en lecture seule', () => {
        const onChange = vi.fn();
        const { rerender } = render(<SignalSelect {...props} disabled onChange={onChange} />);
        const champ = screen.getByRole('combobox', { name: props.label });
        expect(champ).toBeDisabled();
        rerender(<div className="dossier-readonly"><SignalSelect {...props} onChange={onChange} /></div>);
        fireEvent.click(screen.getByRole('combobox', { name: props.label }));
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('ouvre le portail dans sa fenêtre détachée et y ferme sur un clic extérieur', () => {
        const cadre = document.createElement('iframe');
        document.body.appendChild(cadre);
        const doc = cadre.contentDocument!;
        const racine = doc.createElement('div');
        doc.body.appendChild(racine);
        const { unmount } = render(<SignalSelect {...props} onChange={vi.fn()} />, { container: racine });
        try {
            const champ = within(doc.body).getByRole('combobox', { name: props.label });
            fireEvent.click(champ);
            const liste = within(doc.body).getByRole('listbox');
            expect(liste.ownerDocument).toBe(doc);
            expect(racine.contains(liste)).toBe(false);
            expect(document.body.contains(liste)).toBe(false);
            fireEvent.pointerDown(doc.body);
            expect(within(doc.body).queryByRole('listbox')).toBeNull();
        } finally {
            unmount();
            cadre.remove();
        }
    });
});
