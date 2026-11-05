import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePopupWindow, { bringAllPopupsToFront } from './usePopupWindow';

/** Fenêtre détachée simulée : un iframe, dont le document est distinct du principal. */
describe('usePopupWindow — remontée des fenêtres et listes déroulantes', () => {
    let popup: Window;
    let focusPopup: ReturnType<typeof vi.spyOn>;
    let renderToPopup: (contenu: React.ReactNode) => void;
    let selectPrincipal: HTMLSelectElement;
    let boutonPrincipal: HTMLButtonElement;
    let horloge = Date.now();

    beforeEach(async () => {
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        popup = iframe.contentWindow as Window;
        vi.spyOn(window, 'open').mockReturnValue(popup);
        const { result } = renderHook(() => usePopupWindow({
            isOpen: true,
            onClose: vi.fn(),
            title: 'Fenêtre test',
            width: 640,
            height: 480
        }));
        await waitFor(() => {
            if (!result.current.popupOpen) throw new Error('fenêtre pas encore ouverte');
        });
        renderToPopup = result.current.renderToPopup;

        vi.useFakeTimers();
        // Chaque test passe la temporisation entre deux remontées.
        horloge += 10_000;
        vi.setSystemTime(horloge);
        focusPopup = vi.spyOn(popup, 'focus').mockImplementation(() => {});
        vi.spyOn(window, 'focus').mockImplementation(() => {});
        selectPrincipal = document.body.appendChild(document.createElement('select'));
        boutonPrincipal = document.body.appendChild(document.createElement('button'));
    });

    afterEach(() => {
        vi.advanceTimersByTime(1500);
        vi.useRealTimers();
        selectPrincipal.remove();
        boutonPrincipal.remove();
        vi.restoreAllMocks();
    });

    const fenetreActive = (doc: Document, active: boolean) => {
        vi.spyOn(doc, 'hasFocus').mockReturnValue(active);
    };

    it('remonte les fenêtres quand rien n\'est en cours d\'usage', () => {
        fenetreActive(document, true);
        boutonPrincipal.focus();
        bringAllPopupsToFront(null);
        expect(focusPopup).toHaveBeenCalled();
    });

    it('ne replie pas une liste de la fenêtre principale', () => {
        fenetreActive(document, true);
        selectPrincipal.focus();
        bringAllPopupsToFront(null);
        expect(focusPopup).not.toHaveBeenCalled();
    });

    it('ne replie pas une liste de la fenêtre détachée', () => {
        fenetreActive(popup.document, true);
        const select = popup.document.body.appendChild(popup.document.createElement('select'));
        select.focus();
        bringAllPopupsToFront(popup);
        expect(focusPopup).not.toHaveBeenCalled();
        select.remove();
    });

    it('laisse le clavier à un champ de la fenêtre détachée', () => {
        fenetreActive(popup.document, true);
        const champ = popup.document.body.appendChild(popup.document.createElement('input'));
        champ.type = 'search';
        champ.focus();
        bringAllPopupsToFront(popup);
        expect(focusPopup).not.toHaveBeenCalled();
        champ.remove();
    });

    it('ignore une liste restée sélectionnée dans une fenêtre qui n\'est plus active', () => {
        fenetreActive(document, false);
        selectPrincipal.focus();
        bringAllPopupsToFront(popup);
        expect(focusPopup).toHaveBeenCalled();
    });

    it('remonte les fenêtres après un clic hors de la liste', () => {
        fenetreActive(document, true);
        selectPrincipal.focus();
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        selectPrincipal.blur();
        vi.advanceTimersByTime(1000);
        expect(focusPopup).toHaveBeenCalled();
    });

    it('laisse une liste de la fenêtre principale ouverte une seconde après le clic', () => {
        fenetreActive(document, true);
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        selectPrincipal.focus();
        vi.advanceTimersByTime(1000);
        expect(focusPopup).not.toHaveBeenCalled();
    });

    it('met la fenêtre à jour sans attendre qu\'on quitte sa liste', () => {
        fenetreActive(popup.document, true);
        const select = popup.document.body.appendChild(popup.document.createElement('select'));
        select.focus();
        act(() => {
            renderToPopup(<span id="contenu-frais">frais</span>);
            vi.advanceTimersByTime(0);
        });
        expect(popup.document.getElementById('contenu-frais')).not.toBeNull();
        select.remove();
    });
});
