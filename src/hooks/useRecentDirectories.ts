import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

export type RecentDirectoryType = 'open' | 'import' | 'image' | 'save' | 'greenwave';

export interface RecentDirectory {
    name: string;
    timestamp: number;
}

const loadFromStorage = (key: string): RecentDirectory[] => {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]') as RecentDirectory[];
    } catch {
        return [];
    }
};

/**
 * Gère les listes de répertoires récents (ouverture, sauvegarde, import, image, onde verte).
 */
const useRecentDirectories = () => {
    const [recentOpenDirs, setRecentOpenDirs] = useState<RecentDirectory[]>(
        () => loadFromStorage('recentOpenDirs')
    );
    const [recentImportDirs, setRecentImportDirs] = useState<RecentDirectory[]>(
        () => loadFromStorage('recentImportDirs')
    );
    const [recentImageDirs, setRecentImageDirs] = useState<RecentDirectory[]>(
        () => loadFromStorage('recentImageDirs')
    );
    const [recentSaveDirs, setRecentSaveDirs] = useState<RecentDirectory[]>(
        () => loadFromStorage('recentSaveDirs')
    );
    const [recentGreenWaveDirs, setRecentGreenWaveDirs] = useState<RecentDirectory[]>(
        () => loadFromStorage('recentGreenWaveDirs')
    );

    const addRecentDirectory = useCallback((type: RecentDirectoryType, dirName: string) => {
        const updateList = (
            currentList: RecentDirectory[],
            setList: Dispatch<SetStateAction<RecentDirectory[]>>,
            storageKey: string
        ): RecentDirectory[] => {
            const newEntry: RecentDirectory = { name: dirName, timestamp: Date.now() };
            const filtered = currentList.filter(directory => directory.name !== dirName);
            const updated = [newEntry, ...filtered].slice(0, 5);
            setList(updated);
            localStorage.setItem(storageKey, JSON.stringify(updated));
            return updated;
        };

        switch (type) {
            case 'open':
                updateList(recentOpenDirs, setRecentOpenDirs, 'recentOpenDirs');
                break;
            case 'import':
                updateList(recentImportDirs, setRecentImportDirs, 'recentImportDirs');
                break;
            case 'image':
                updateList(recentImageDirs, setRecentImageDirs, 'recentImageDirs');
                break;
            case 'save':
                updateList(recentSaveDirs, setRecentSaveDirs, 'recentSaveDirs');
                break;
            case 'greenwave':
                updateList(recentGreenWaveDirs, setRecentGreenWaveDirs, 'recentGreenWaveDirs');
                break;
        }
    }, [recentOpenDirs, recentImportDirs, recentImageDirs, recentSaveDirs, recentGreenWaveDirs]);

    return {
        recentOpenDirs,
        recentImportDirs,
        recentImageDirs,
        recentSaveDirs,
        recentGreenWaveDirs,
        addRecentDirectory
    };
};

export default useRecentDirectories;
