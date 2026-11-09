import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import usePopupWindow from './usePopupWindow';
import { basculerVerrou, definirPrefsVerrou } from '../utils/verrouSaisie';

afterEach(() => {
    act(() => definirPrefsVerrou());
    vi.restoreAllMocks();
});

it('actualise le titre et le bandeau sans rouvrir ni redimensionner la fenêtre', async () => {
    const iframe = document.body.appendChild(document.createElement('iframe'));
    const popup = iframe.contentWindow!;
    const ouvrir = vi.spyOn(window, 'open').mockReturnValue(popup);
    const { result, unmount } = renderHook(() => usePopupWindow({
        isOpen: true, onClose: vi.fn(), title: 'Données trafic — PF1',
        geometryKey: 'traffic', sectionVerrou: 'trafic', width: 550, height: 400
    }));
    await waitFor(() => expect(result.current.popupOpen).toBe(true));
    // Le placement initial peut encore travailler ; la vérification porte sur le changement de verrou.
    const redimensionner = vi.spyOn(popup, 'resizeTo').mockImplementation(() => {});
    act(() => basculerVerrou('trafic'));
    expect(popup.document.title).toContain('(verrouillé)');
    expect(popup.document.getElementById('popup-bandeau')?.textContent).toContain('(verrouillé)');
    expect(ouvrir).toHaveBeenCalledOnce();
    expect(redimensionner).not.toHaveBeenCalled();
    act(() => basculerVerrou('trafic'));
    expect(popup.document.title).toBe('Données trafic — PF1');
    expect(popup.document.getElementById('popup-bandeau')?.textContent).not.toContain('(verrouillé)');
    expect(ouvrir).toHaveBeenCalledOnce();
    unmount();
    iframe.remove();
});
