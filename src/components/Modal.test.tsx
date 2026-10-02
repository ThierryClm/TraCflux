import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
    it('ne rend rien quand elle est fermée', () => {
        const { container } = render(
            <Modal isOpen={false} onClose={() => undefined} title="Titre">
                Contenu
            </Modal>,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('affiche le titre, le contenu et les classes optionnelles', () => {
        const { container } = render(
            <Modal
                isOpen
                onClose={() => undefined}
                title={<span>Titre enrichi</span>}
                className="modal-large"
                overlayClassName="overlay-menu"
            >
                <p>Contenu de test</p>
            </Modal>,
        );

        expect(screen.getByText('Titre enrichi')).toBeInTheDocument();
        expect(screen.getByText('Contenu de test')).toBeInTheDocument();
        expect(container.querySelector('.modal-content')).toHaveClass('modal-large');
        expect(container.querySelector('.modal-overlay')).toHaveClass('overlay-menu');
    });

    it('ferme sur le fond ou le bouton, mais pas sur le contenu', () => {
        const onClose = vi.fn();
        const { container } = render(
            <Modal isOpen onClose={onClose} title="Titre">
                Contenu
            </Modal>,
        );

        fireEvent.click(container.querySelector('.modal-content')!);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(container.querySelector('.modal-overlay')!);
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
