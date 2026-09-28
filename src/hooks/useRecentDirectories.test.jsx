import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useRecentDirectories from './useRecentDirectories';

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('useRecentDirectories', () => {
    it('restaure toutes les catégories depuis le stockage', () => {
        localStorage.setItem('recentOpenDirs', JSON.stringify([{ name: 'Ouverture', timestamp: 1 }]));
        localStorage.setItem('recentSaveDirs', JSON.stringify([{ name: 'Sauvegarde', timestamp: 2 }]));
        const { result } = renderHook(() => useRecentDirectories());
        expect(result.current.recentOpenDirs[0].name).toBe('Ouverture');
        expect(result.current.recentSaveDirs[0].name).toBe('Sauvegarde');
        expect(result.current.recentImportDirs).toEqual([]);
    });

    it('retombe sur une liste vide si le stockage est corrompu', () => {
        localStorage.setItem('recentImageDirs', '{invalide');
        const { result } = renderHook(() => useRecentDirectories());
        expect(result.current.recentImageDirs).toEqual([]);
    });

    it.each([
        ['open', 'recentOpenDirs'],
        ['import', 'recentImportDirs'],
        ['image', 'recentImageDirs'],
        ['save', 'recentSaveDirs'],
        ['greenwave', 'recentGreenWaveDirs']
    ])('ajoute et persiste la catégorie %s', (type, field) => {
        vi.spyOn(Date, 'now').mockReturnValue(123);
        const { result } = renderHook(() => useRecentDirectories());
        act(() => result.current.addRecentDirectory(type, 'Dossier'));
        expect(result.current[field]).toEqual([{ name: 'Dossier', timestamp: 123 }]);
        expect(JSON.parse(localStorage.getItem(field))).toEqual(result.current[field]);
    });

    it('remonte un doublon en tête et garde au plus cinq entrées', () => {
        localStorage.setItem('recentOpenDirs', JSON.stringify(
            ['A', 'B', 'C', 'D', 'E'].map((name, timestamp) => ({ name, timestamp }))
        ));
        vi.spyOn(Date, 'now').mockReturnValue(99);
        const { result } = renderHook(() => useRecentDirectories());
        act(() => result.current.addRecentDirectory('open', 'C'));
        expect(result.current.recentOpenDirs.map(item => item.name)).toEqual(['C', 'A', 'B', 'D', 'E']);
        act(() => result.current.addRecentDirectory('open', 'F'));
        expect(result.current.recentOpenDirs.map(item => item.name)).toEqual(['F', 'C', 'A', 'B', 'D']);
    });

    it('ignore une catégorie inconnue', () => {
        const { result } = renderHook(() => useRecentDirectories());
        act(() => result.current.addRecentDirectory('autre', 'Dossier'));
        expect(result.current.recentOpenDirs).toEqual([]);
        expect(localStorage.length).toBe(0);
    });
});
