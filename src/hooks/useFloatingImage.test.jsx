import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
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

    it("recalcule la fenêtre quand les dimensions réelles arrivent même si les curseurs sont ouverts", () => {
        let imageChargee;
        const OriginalImage = globalThis.Image;
        globalThis.Image = class {
            set src(_value) { imageChargee = this; }
        };

        try {
            const { result } = renderHook(() => useFloatingImage('data:image/png;base64,abc'));

            act(() => result.current.setShowCropControls(true));
            act(() => {
                imageChargee.naturalWidth = 988;
                imageChargee.naturalHeight = 547;
                imageChargee.onload();
            });

            expect(usePopupWindow).toHaveBeenLastCalledWith(expect.objectContaining({
                contentSize: { width: 756, height: 457 }
            }));
        } finally {
            globalThis.Image = OriginalImage;
        }
    });
});
