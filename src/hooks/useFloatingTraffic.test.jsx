import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import usePopupWindow from './usePopupWindow';
import useFloatingTraffic from './useFloatingTraffic';

vi.mock('./usePopupWindow', () => ({
    default: vi.fn(() => ({
        renderToPopup: vi.fn(),
        popupWindow: { current: null },
        popupOpen: false,
        retryOpen: vi.fn()
    }))
}));

describe('useFloatingTraffic', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('dimensionne la fenêtre sur les lignes du tableau, pas sur tous les groupes', () => {
        renderHook(() => useFloatingTraffic(4));

        expect(usePopupWindow).toHaveBeenCalledWith(expect.objectContaining({
            geometryKey: 'traffic',
            height: 180 + 4 * 32
        }));
    });

    it('plafonne la hauteur et garde le titre du plan actif', () => {
        renderHook(() => useFloatingTraffic(30, 'PF 2'));

        expect(usePopupWindow).toHaveBeenCalledWith(expect.objectContaining({
            height: 580,
            title: 'Données trafic — PF 2'
        }));
    });
});
