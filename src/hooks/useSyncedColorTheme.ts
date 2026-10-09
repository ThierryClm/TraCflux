import { useEffect } from 'react';

// Classe du body pour chaque thème de couleur ; le thème sombre n'en a pas.
const THEME_CLASS_MAP: Record<string, string> = {
    light: 'light-mode',
    'high-contrast': 'high-contrast-mode',
    amber: 'amber-mode',
    daltonian: 'daltonian-mode',
    sepia: 'sepia-mode',
    'blue-night': 'blue-night-mode'
};
const ALL_THEME_CLASSES = Object.values(THEME_CLASS_MAP);

const applyThemeFromStorage = (): void => {
    const colorTheme = localStorage.getItem('colorTheme') || 'dark';
    document.body.classList.remove(...ALL_THEME_CLASSES);
    const cls = THEME_CLASS_MAP[colorTheme];
    if (cls) document.body.classList.add(cls);
};

/**
 * Suit le thème de couleur de l'application principale dans une autre fenêtre.
 *
 * Le thème est partagé via localStorage (clé 'colorTheme') : on applique la
 * classe correspondante au body au montage, puis on écoute l'événement
 * 'storage' pour suivre en direct les changements faits dans la fenêtre
 * principale.
 */
const useSyncedColorTheme = (): void => {
    useEffect(() => {
        applyThemeFromStorage();
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'colorTheme') applyThemeFromStorage();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
};

export default useSyncedColorTheme;
