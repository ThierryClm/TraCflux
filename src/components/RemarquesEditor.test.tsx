import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import RemarquesEditor from './RemarquesEditor';

const ControlledEditor = () => {
    const [remarques, setRemarques] = useState('Texte de test');
    return (
        <RemarquesEditor
            remarques={remarques}
            updateRemarques={setRemarques}
            groupCount={8}
        />
    );
};

const FormattedControlledEditor = () => {
    const [remarques, setRemarques] = useState(
        '<span style="color: rgb(244, 67, 54); font-size: 22px">Texte</span><br>Suite'
    );
    return (
        <RemarquesEditor
            remarques={remarques}
            updateRemarques={setRemarques}
            groupCount={8}
        />
    );
};

const selectFirstWord = (editable: HTMLElement) => {
    const text = editable.firstChild;
    const selection = window.getSelection();
    if (!text || !selection) throw new Error('Éditeur non sélectionnable');

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.mouseUp(editable);
};

const getEditable = (container: HTMLElement) => {
    const editable = container.querySelector<HTMLElement>('.input-remarques');
    if (!editable) throw new Error('Éditeur de remarques introuvable');
    editable.style.fontSize = '14px';
    return editable;
};

describe('RemarquesEditor', () => {
    it('enchaîne agrandir et réduire sans demander une nouvelle sélection', () => {
        const { container } = render(<ControlledEditor />);
        const editable = getEditable(container);
        selectFirstWord(editable);

        fireEvent.mouseDown(screen.getByRole('button', { name: 'Agrandir la taille du texte sélectionné' }));
        expect(editable.querySelector<HTMLSpanElement>('span')?.style.fontSize).toBe('16px');
        expect(window.getSelection()?.toString()).toBe('Texte');

        fireEvent.mouseDown(screen.getByRole('button', { name: 'Agrandir la taille du texte sélectionné' }));
        expect(editable.querySelector<HTMLSpanElement>('span')?.style.fontSize).toBe('18px');

        fireEvent.mouseDown(screen.getByRole('button', { name: 'Réduire la taille du texte sélectionné' }));
        expect(editable.querySelector<HTMLSpanElement>('span')?.style.fontSize).toBe('16px');
        expect(editable.textContent).toBe('Texte de test');
    });

    it('conserve la sélection après une couleur pour permettre le redimensionnement', () => {
        const { container } = render(<ControlledEditor />);
        const editable = getEditable(container);
        selectFirstWord(editable);

        fireEvent.mouseDown(screen.getByRole('button', { name: 'Colorer le texte sélectionné en vert' }));
        fireEvent.mouseDown(screen.getByRole('button', { name: 'Agrandir la taille du texte sélectionné' }));

        const formatted = editable.querySelector<HTMLSpanElement>('span');
        expect(formatted?.style.color).toBe('rgb(76, 175, 80)');
        expect(formatted?.style.fontSize).toBe('16px');
        expect(formatted?.textContent).toBe('Texte');
    });

    it('réinitialise couleur et taille sans effacer le texte ni les retours à la ligne', () => {
        const { container } = render(<FormattedControlledEditor />);
        const editable = getEditable(container);

        fireEvent.mouseDown(screen.getByRole('button', {
            name: 'Réinitialiser la couleur et la taille des remarques'
        }));

        expect(editable.innerHTML).toBe('Texte<br>Suite');
        expect(editable.textContent).toBe('TexteSuite');
        expect(editable.querySelector('[style]')).toBeNull();
    });
});
