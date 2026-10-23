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

    it('non modale : un clic à côté ne la ferme pas, et le bandeau la déplace', () => {
        const onClose = vi.fn();
        const { container } = render(<Modal isOpen nonModale onClose={onClose} title="Titre">Contenu</Modal>);
        const overlay = container.querySelector('.modal-overlay') as HTMLElement;
        expect(overlay).toHaveClass('modal-non-modale');
        fireEvent.click(overlay);
        expect(onClose).not.toHaveBeenCalled();
        const bandeau = container.querySelector('.modal-header') as HTMLElement;
        fireEvent.mouseDown(bandeau, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(document, { clientX: 140, clientY: 70 });
        fireEvent.mouseUp(document);
        expect((container.querySelector('.modal-content') as HTMLElement).style.transform).toBe('translate(40px, -30px)');
    });
});
