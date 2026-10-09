import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeTextToFileHandle, FILE_CHANGED_MESSAGE } from './writeFileHandle';

const staleError = () => Object.assign(new Error('state had changed since it was read from disk'), { name: 'InvalidStateError' });

/** Poignée factice : `failures` premières fermetures en échec, puis succès. */
const makeHandle = (failures, error = staleError) => {
    const written = [];
    let closes = 0;
    return {
        written,
        handle: {
            name: 'projet.json',
            createWritable: vi.fn(async () => {
                let buffer = '';
                return {
                    write: async (content) => { buffer += content; },
                    close: async () => {
                        closes++;
                        if (closes <= failures) throw error();
                        written.push(buffer);
                    }
                };
            })
        }
    };
};

describe('writeTextToFileHandle', () => {
    afterEach(() => vi.useRealTimers());

    it('écrit le contenu du premier coup', async () => {
        const { handle, written } = makeHandle(0);
        await writeTextToFileHandle(handle, '{"a":1}');
        expect(written).toEqual(['{"a":1}']);
        expect(handle.createWritable).toHaveBeenCalledTimes(1);
    });

    it('réessaie une fois quand le fichier a changé sur le disque', async () => {
        vi.useFakeTimers();
        const { handle, written } = makeHandle(1);
        const pending = writeTextToFileHandle(handle, 'contenu');
        await vi.runAllTimersAsync();
        await pending;
        expect(written).toEqual(['contenu']);
        expect(handle.createWritable).toHaveBeenCalledTimes(2);
    });

    it('explique l\'échec en français si la seconde tentative échoue aussi', async () => {
        vi.useFakeTimers();
        const { handle } = makeHandle(2);
        const pending = writeTextToFileHandle(handle, 'contenu');
        const assertion = expect(pending).rejects.toThrow(FILE_CHANGED_MESSAGE);
        await vi.runAllTimersAsync();
        await assertion;
        expect(handle.createWritable).toHaveBeenCalledTimes(2);
    });

    it('laisse passer les autres erreurs sans réessayer', async () => {
        const denied = () => Object.assign(new Error('refusé'), { name: 'NotAllowedError' });
        const { handle } = makeHandle(1, denied);
        await expect(writeTextToFileHandle(handle, 'x')).rejects.toThrow('refusé');
        expect(handle.createWritable).toHaveBeenCalledTimes(1);
    });
});
