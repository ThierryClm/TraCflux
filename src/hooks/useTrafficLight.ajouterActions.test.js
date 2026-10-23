import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

beforeEach(() => { localStorage.clear(); });
const pause = (ms) => new Promise(r => setTimeout(r, ms));

describe('ajouterActions (adaptatifs proposés par l\'assistant)', () => {
    it('remplit les premières lignes vides, sans toucher aux conditions existantes, annulable en une fois', async () => {
        const { result } = renderHook(() => useTrafficLight());
        await act(async () => { await pause(60); });
        const premiere = result.current.actionData[0].id;
        await act(async () => { result.current.updateActionRow(premiere, 'action', 'Point de repos'); });
        await act(async () => { await pause(20); });

        let nb;
        await act(async () => {
            nb = result.current.ajouterActions([
                { gf: '1', action: 'Adaptatif vertical', deb: '25', fin: '29' },
                { gf: '4', action: 'Adaptatif vertical', deb: '61', fin: '64' },
            ]);
        });
        await act(async () => { await pause(20); });
        expect(nb).toBe(2);
        const lignes = result.current.actionData.filter(r => r.action);
        expect(lignes.map(r => [r.action, r.gf, r.deb, r.fin])).toEqual([
            ['Point de repos', '', '', ''],
            ['Adaptatif vertical', '1', '25', '29'],
            ['Adaptatif vertical', '4', '61', '64'],
        ]);

        await act(async () => { result.current.undo(); });
        await act(async () => { await pause(20); });
        expect(result.current.actionData.filter(r => r.action).map(r => r.action)).toEqual(['Point de repos']);
    });

    it('plan enregistré sans aucune ligne de conditions : les lignes sont créées', async () => {
        const { result } = renderHook(() => useTrafficLight());
        await act(async () => { await pause(60); });
        const etat = {
            projectName: 'sans-lignes', groups: result.current.groups, cycleLength: 70,
            conflictMatrix: result.current.conflictMatrix,
            pfTabs: [{ id: 1, name: 'PF1', data: [], diagram: [], cycleLength: 70 }], activePFId: 1,
        };
        await act(async () => { result.current.loadFullState(etat); });
        await act(async () => { await pause(150); });
        let nb;
        await act(async () => { nb = result.current.ajouterActions([{ gf: '1', action: 'Adaptatif vertical', deb: '25', fin: '29' }]); });
        await act(async () => { await pause(20); });
        expect(nb).toBe(1);
        expect(result.current.actionData.filter(r => r.action === 'Adaptatif vertical')).toHaveLength(1);
    });
});
