import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTrafficLight } from './useTrafficLight';

beforeEach(() => localStorage.clear());

describe('nom du fichier et titre du carrefour', () => {
    it('conserve la sauvegarde après renommage du carrefour, y compris à la réouverture', async () => {
        const { result } = renderHook(() => useTrafficLight());
        expect(result.current.projectProperties.carrefourCoordonne).toBe(false);
        act(() => result.current.setIntersectionName('Place des Écoles'));
        await act(async () => { await result.current.saveProject('Etude_2026'); });
        act(() => {
            result.current.setIntersectionName('Place des Écoles — variante coordonnée');
            result.current.updateProjectProperty('carrefourCoordonne', true);
        });
        expect(result.current.projectName).toBe('Etude_2026');
        await act(async () => { await result.current.saveProject(result.current.projectName); });
        const enregistre = JSON.parse(localStorage.getItem('traffic_project_Etude_2026'));
        expect(enregistre.intersectionName).toBe('Place des Écoles — variante coordonnée');
        expect(enregistre.projectName).toBe('Etude_2026');
        expect(enregistre.projectProperties.carrefourCoordonne).toBe(true);
        const seconde = renderHook(() => useTrafficLight());
        act(() => seconde.result.current.loadProject('Etude_2026'));
        expect(seconde.result.current.intersectionName).toBe(enregistre.intersectionName);
        expect(seconde.result.current.projectName).toBe('Etude_2026');
        expect(seconde.result.current.projectProperties.carrefourCoordonne).toBe(true);
    });

    it('initialise une seule fois le titre vide au premier enregistrement', async () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.setIntersectionName(''));
        await act(async () => { await result.current.saveProject('Etude_initiale'); });
        expect(result.current.intersectionName).toBe('Etude_initiale');
        act(() => result.current.setIntersectionName('Autre carrefour'));
        await act(async () => { await result.current.saveProject('Copie_etude'); });
        expect(result.current.intersectionName).toBe('Autre carrefour');
    });

    it('un ancien fichier sans propriété coordonnée repart à false', () => {
        const { result } = renderHook(() => useTrafficLight());
        act(() => result.current.updateProjectProperty('carrefourCoordonne', true));
        act(() => result.current.loadFullState({ projectName: 'Ancien', projectProperties: { commune: 'Test' } }));
        expect(result.current.projectProperties.carrefourCoordonne).toBe(false);
        expect(result.current.intersectionName).toBe('Ancien');
    });
});
