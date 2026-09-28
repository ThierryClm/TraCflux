import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import useDarkMode from './useDarkMode';

const themeClasses = [
    'light-mode', 'high-contrast-mode', 'amber-mode',
    'daltonian-mode', 'sepia-mode', 'blue-night-mode'
];

beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove(...themeClasses);
});

describe('useDarkMode', () => {
    it('démarre en thème sombre par défaut', () => {
        const { result } = renderHook(() => useDarkMode());
        expect(result.current.colorTheme).toBe('dark');
        expect(result.current.darkMode).toBe(true);
        expect(localStorage.getItem('colorTheme')).toBe('dark');
        expect(themeClasses.every(name => !document.body.classList.contains(name))).toBe(true);
    });

    it.each([
        ['light', 'light-mode', false],
        ['high-contrast', 'high-contrast-mode', true],
        ['amber', 'amber-mode', true],
        ['daltonian', 'daltonian-mode', true],
        ['sepia', 'sepia-mode', false],
        ['blue-night', 'blue-night-mode', true]
    ])('applique et persiste le thème %s', (theme, className, darkMode) => {
        localStorage.setItem('colorTheme', theme);
        const { result } = renderHook(() => useDarkMode());
        expect(result.current.colorTheme).toBe(theme);
        expect(result.current.darkMode).toBe(darkMode);
        expect(document.body).toHaveClass(className);
    });

    it('retire l’ancienne classe lors d’un changement de thème', () => {
        const { result } = renderHook(() => useDarkMode());
        act(() => result.current.setColorTheme('amber'));
        expect(document.body).toHaveClass('amber-mode');
        act(() => result.current.setColorTheme('light'));
        expect(document.body).toHaveClass('light-mode');
        expect(document.body).not.toHaveClass('amber-mode');
    });

    it('conserve la compatibilité setDarkMode', () => {
        const { result } = renderHook(() => useDarkMode());
        act(() => result.current.setDarkMode(false));
        expect(result.current.colorTheme).toBe('light');
        act(() => result.current.setDarkMode(true));
        expect(result.current.colorTheme).toBe('dark');
    });

    it('charge et persiste les préférences de noms de groupes', () => {
        localStorage.setItem('showGroupNamesForm', 'false');
        localStorage.setItem('showGroupNamesMatrix', 'true');
        const { result } = renderHook(() => useDarkMode());
        expect(result.current.showGroupNamesForm).toBe(false);
        expect(result.current.showGroupNamesMatrix).toBe(true);
        expect(result.current.showGroupNamesDiagram).toBe(true);

        act(() => result.current.setShowGroupNamesDiagram(false));
        expect(localStorage.getItem('showGroupNamesDiagram')).toBe('false');
    });
});
