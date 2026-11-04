import { afterEach, describe, expect, it, vi } from 'vitest';
import { demarrerHorloge } from './horlogeLecture';

describe('demarrerHorloge', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('passe par un worker, à la période demandée, et l’arrête', () => {
        const worker = { onmessage: null as (() => void) | null, postMessage: vi.fn(), terminate: vi.fn() };
        vi.stubGlobal('Worker', function Worker() { return worker; });
        URL.createObjectURL = vi.fn(() => 'blob:horloge');
        URL.revokeObjectURL = vi.fn();
        const tic = vi.fn();

        const arreter = demarrerHorloge(500, tic);
        expect(worker.postMessage).toHaveBeenCalledWith(500);
        worker.onmessage?.();
        expect(tic).toHaveBeenCalledTimes(1);

        arreter();
        expect(worker.terminate).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:horloge');
    });

    it('retombe sur un minuteur sans worker', () => {
        vi.useFakeTimers();
        vi.stubGlobal('Worker', undefined);
        const tic = vi.fn();
        const arreter = demarrerHorloge(1000, tic);
        vi.advanceTimersByTime(3000);
        expect(tic).toHaveBeenCalledTimes(3);
        arreter();
        vi.advanceTimersByTime(3000);
        expect(tic).toHaveBeenCalledTimes(3);
    });
});
