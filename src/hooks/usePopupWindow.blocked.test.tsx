import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import usePopupWindow from './usePopupWindow';

describe('usePopupWindow — popup bloquée', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('permet à un clic utilisateur de retenter une intention déjà active', async () => {
        const open = vi.spyOn(window, 'open').mockReturnValue(null);
        const { result } = renderHook(() => usePopupWindow({
            isOpen: true,
            onClose: vi.fn(),
            title: 'Fenêtre test',
            width: 640,
            height: 480
        }));

        await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
        expect(result.current.popupOpen).toBe(false);

        act(() => result.current.retryOpen());

        await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
        expect(result.current.popupOpen).toBe(false);
    });
});
