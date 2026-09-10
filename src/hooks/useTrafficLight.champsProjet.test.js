import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useTrafficLight } from './useTrafficLight';

beforeEach(() => { localStorage.clear(); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));

describe('champs de projet portés par un autre module', () => {
    it('voyagent avec le dossier', async () => {
        let recu = null;
        const { result } = renderHook(() => {
            const ref = useRef({
                lire: () => ({ dossierSections: { image: true, matrice: false } }),
                ecrire: (etat) => { recu = etat.dossierSections; }
            });
            return useTrafficLight({ champsProjetRef: ref });
        });
        await act(async () => { await pause(60); });

        const etat = JSON.parse(JSON.stringify(result.current.getFullState()));
        expect(etat.dossierSections).toEqual({ image: true, matrice: false });

        await act(async () => { result.current.loadFullState(etat); });
        await act(async () => { await pause(60); });
        expect(recu).toEqual({ image: true, matrice: false });
    });
});
