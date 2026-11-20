import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import usePopupWindow from './usePopupWindow';

afterEach(() => vi.restoreAllMocks());

it('compte le cadre de 8 px dans la taille visée, sans quoi le zoom fait naître des ascenseurs', async () => {
    const iframe = document.body.appendChild(document.createElement('iframe'));
    const popup = iframe.contentWindow!;
    const redimensionner = vi.spyOn(popup, 'resizeTo').mockImplementation(() => {});
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const { unmount } = renderHook(() => usePopupWindow({
        isOpen: true, onClose: vi.fn(), title: 'Image du carrefour', geometryKey: 'image-test',
        width: 700, height: 500, showTitleBanner: false, contentSize: { width: 600, height: 400 }
    }));
    // Zone utile = contenu + 2 × 8 px de cadre, en largeur comme en hauteur.
    const chromeW = Math.max(0, (popup.outerWidth || popup.innerWidth) - popup.innerWidth);
    const chromeH = Math.max(0, (popup.outerHeight || popup.innerHeight) - popup.innerHeight);
    await waitFor(() => expect(redimensionner).toHaveBeenCalledWith(616 + chromeW, 416 + chromeH));
    unmount();
    iframe.remove();
});
