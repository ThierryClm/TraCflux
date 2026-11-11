import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

beforeEach(() => localStorage.clear());

const boucle = {
    id: 1,
    nom: 'Boucle nord',
    categorie: 'bouclePiedFeu',
    gf: 1,
    dimension: 8,
    position: null,
    orientation: 0,
    note: ''
};

describe('détecteurs enregistrés avec le projet', () => {
    it('voyagent dans l’état complet et dans le cache', async () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setDetecteurs([boucle]));

        expect(result.current.getFullState().detecteurs).toEqual([boucle]);

        await act(async () => { await result.current.saveProject('Detecteurs'); });
        const enregistre = JSON.parse(localStorage.getItem('traffic_project_Detecteurs'));
        expect(enregistre.detecteurs).toEqual([boucle]);
    });

    it('sont relus du cache à l’ouverture', async () => {
        const premier = renderHook(() => useTrafficLight());
        act(() => premier.result.current.setDetecteurs([boucle]));
        await act(async () => { await premier.result.current.saveProject('Detecteurs'); });

        const second = renderHook(() => useTrafficLight());
        act(() => second.result.current.loadProject('Detecteurs'));
        expect(second.result.current.detecteurs).toEqual([boucle]);
    });

    it('sont relus d’un fichier, entrées abîmées réparées', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.loadFullState({
            projectName: 'Avec detecteurs',
            detecteurs: [
                { id: 1, nom: 'Radar entrée', categorie: 'radar', gf: 2, dimension: 25 },
                { id: 1, categorie: 'boutonPoussoir', dimension: 3 }
            ]
        }));
        expect(result.current.detecteurs).toHaveLength(2);
        expect(result.current.detecteurs[0]).toMatchObject({ nom: 'Radar entrée', gf: 2, dimension: 25 });
        expect(result.current.detecteurs[1].id).toBe(2);
        expect(result.current.detecteurs[1].dimension).toBeNull();
    });

    it('un projet antérieur au module repart sans détecteur', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setDetecteurs([boucle]));
        act(() => result.current.loadFullState({ projectName: 'Ancien projet' }));
        expect(result.current.detecteurs).toEqual([]);
    });
});
