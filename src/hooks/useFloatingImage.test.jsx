import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import usePopupWindow from './usePopupWindow';
import useFloatingImage from './useFloatingImage';

vi.mock('./usePopupWindow', () => ({
    default: vi.fn(() => ({ renderToPopup: vi.fn(), popupWindow: { current: null } }))
}));

describe('useFloatingImage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it("supprime le bandeau interne de la fenêtre d'image détachée", () => {
        renderHook(() => useFloatingImage(null, 'Carrefour témoin', 'PF 1'));

        expect(usePopupWindow).toHaveBeenCalledWith(expect.objectContaining({
            geometryKey: 'image',
            title: 'Carrefour témoin — PF 1',
            showTitleBanner: false
        }));
    });
});
