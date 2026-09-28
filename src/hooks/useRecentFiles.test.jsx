import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useRecentFiles from './useRecentFiles';

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('useRecentFiles', () => {
    it('restaure les fichiers persistés au montage', () => {
        const saved = [{ path: '/a/projet.json', name: 'projet.json', directory: '/a', timestamp: '2026-01-01' }];
        localStorage.setItem('recentFiles', JSON.stringify(saved));
        const { result } = renderHook(() => useRecentFiles());
        expect(result.current.recentFiles).toEqual(saved);
    });

    it('accepte les chemins Windows et Unix', () => {
        vi.setSystemTime(new Date('2026-09-22T12:00:00Z'));
        const { result } = renderHook(() => useRecentFiles());
        act(() => result.current.addToRecentFiles('C:\\Etudes\\A.json', 'A.json'));
        expect(result.current.recentFiles[0].directory).toBe('C:\\Etudes');
        act(() => result.current.addToRecentFiles('/srv/etudes/B.json', 'B.json'));
        expect(result.current.recentFiles[0].directory).toBe('/srv/etudes');
        expect(JSON.parse(localStorage.getItem('recentFiles'))).toEqual(result.current.recentFiles);
    });

    it('déduplique un fichier et le remonte en tête', () => {
        const initial = [
            { path: '/a/A.json', name: 'A', directory: '/a', timestamp: '2026-01-01' },
            { path: '/b/B.json', name: 'B', directory: '/b', timestamp: '2026-01-02' }
        ];
        localStorage.setItem('recentFiles', JSON.stringify(initial));
        const { result } = renderHook(() => useRecentFiles());
        act(() => result.current.addToRecentFiles('/a/A.json', 'A nouveau'));
        expect(result.current.recentFiles).toHaveLength(2);
        expect(result.current.recentFiles[0].name).toBe('A nouveau');
    });

    it('conserve au plus dix fichiers', () => {
        const initial = Array.from({ length: 10 }, (_, index) => ({
            path: `/d/${index}.json`, name: String(index), directory: '/d', timestamp: `2026-01-${String(index + 1).padStart(2, '0')}`
        }));
        localStorage.setItem('recentFiles', JSON.stringify(initial));
        const { result } = renderHook(() => useRecentFiles());
        act(() => result.current.addToRecentFiles('/nouveau.json', 'nouveau'));
        expect(result.current.recentFiles).toHaveLength(10);
        expect(result.current.recentFiles[0].name).toBe('nouveau');
        expect(result.current.recentFiles.some(item => item.path === '/d/9.json')).toBe(false);
    });

    it('retourne cinq dossiers uniques, récents en premier', () => {
        const { result } = renderHook(() => useRecentFiles());
        act(() => result.current.setRecentFiles([
            { directory: '/ancien', timestamp: '2026-01-01' },
            { directory: '/recent', timestamp: '2026-03-01' },
            { directory: '/ancien', timestamp: '2026-04-01' },
            { directory: 'C:\\Travail', timestamp: '2026-02-01' },
            { directory: '/d4', timestamp: '2025-12-01' },
            { directory: '/d5', timestamp: '2025-11-01' },
            { directory: '/d6', timestamp: '2025-10-01' },
            { directory: '', timestamp: '2027-01-01' }
        ]));
        expect(result.current.getRecentDirectories()).toEqual(['/recent', 'C:\\Travail', '/ancien', '/d4', '/d5']);
        expect(result.current.getRecentDirectoriesForMenu()).toEqual([
            { path: '/recent', name: 'recent' },
            { path: 'C:\\Travail', name: 'Travail' },
            { path: '/ancien', name: 'ancien' },
            { path: '/d4', name: 'd4' },
            { path: '/d5', name: 'd5' }
        ]);
    });

    it('signale un stockage corrompu sans faire tomber le hook', () => {
        localStorage.setItem('recentFiles', '{invalide');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = renderHook(() => useRecentFiles());
        expect(result.current.recentFiles).toEqual([]);
        act(() => result.current.addToRecentFiles('/a.json', 'a'));
        expect(result.current.recentFiles).toEqual([]);
        expect(console.error).toHaveBeenCalled();
    });
});
