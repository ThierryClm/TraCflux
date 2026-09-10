import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

beforeEach(() => { localStorage.clear(); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));

describe('plan importé verrouillé', () => {
    it('conserve sa durée de cycle après enregistrement et réouverture', async () => {
        const { result } = renderHook(() => useTrafficLight());
        await act(async () => { await pause(60); });

        // état tel qu'il sort d'un import : le plan verrouillé n'a PAS de champ cycleLength,
        // le cycle ne vit qu'au niveau du projet (90 s).
        const etat = {
            projectName: 'essai',
            groups: result.current.groups,
            cycleLength: 90,
            conflictMatrix: result.current.conflictMatrix,
            pfTabs: [
                { id: 1, name: 'PF1' },
                { id: 2, name: 'PF1_origine', readOnly: true }
            ],
            activePFId: 2
        };
        await act(async () => { result.current.loadFullState(etat); });
        await act(async () => { await pause(150); });
        console.log('apres import : cycle courant', result.current.cycleLength,
                    '| pfTabs', JSON.stringify(result.current.pfTabs.map(p => ({ n: p.name, c: p.cycleLength, ro: !!p.readOnly }))));

        const sauve = JSON.parse(JSON.stringify(result.current.getFullState()));
        console.log('enregistre : cycleLength', sauve.cycleLength,
                    '| pfTabs', JSON.stringify(sauve.pfTabs.map(p => ({ n: p.name, c: p.cycleLength }))));

        const { result: r2 } = renderHook(() => useTrafficLight());
        await act(async () => { await pause(60); });
        await act(async () => { r2.current.loadFullState(sauve); });
        await act(async () => { await pause(200); });
        console.log('reouverture : cycle courant', r2.current.cycleLength,
                    '| pfTabs', JSON.stringify(r2.current.pfTabs.map(p => ({ n: p.name, c: p.cycleLength }))));
        expect(r2.current.cycleLength).toBe(90);
    });
});
