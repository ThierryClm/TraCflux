import { useState, useEffect } from 'react';

export interface RecentFile {
    path: string;
    name: string;
    directory: string;
    timestamp: string;
}

export interface RecentDirectoryMenuEntry {
    path: string;
    name: string;
}

/**
 * Gère la liste des fichiers récents (ouverture) avec persistance localStorage.
 */
const useRecentFiles = () => {
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

    // Load recent files from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('recentFiles');
            if (saved) {
                const files = JSON.parse(saved) as RecentFile[];
                setRecentFiles(files);
            }
        } catch (error) {
            console.error('Failed to load recent files', error);
        }
    }, []);

    // Add file to recent files list
    const addToRecentFiles = (filePath: string, fileName: string): void => {
        try {
            // Extract directory from path (handle both / and \ separators)
            const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
            const directory = lastSlash > 0 ? filePath.substring(0, lastSlash) : '';

            const newFile: RecentFile = {
                path: filePath,
                name: fileName,
                directory,
                timestamp: new Date().toISOString()
            };

            // Get existing recent files
            const saved = localStorage.getItem('recentFiles');
            let files = saved ? JSON.parse(saved) as RecentFile[] : [];

            // Remove if already exists (to avoid duplicates)
            files = files.filter(file => file.path !== filePath);

            // Add to beginning
            files.unshift(newFile);

            // Keep only last 10 files
            files = files.slice(0, 10);

            // Save to state and localStorage
            setRecentFiles(files);
            localStorage.setItem('recentFiles', JSON.stringify(files));
        } catch (error) {
            console.error('Failed to add to recent files', error);
        }
    };

    // Get unique recent directories
    const getRecentDirectories = (): string[] => {
        try {
            const directories = new Map<string, string>();
            recentFiles.forEach(file => {
                if (file.directory && !directories.has(file.directory)) {
                    directories.set(file.directory, file.timestamp);
                }
            });
            return Array.from(directories.entries())
                .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
                .map(([directory]) => directory)
                .slice(0, 5); // Keep only last 5 directories
        } catch (error) {
            console.error('Failed to get recent directories', error);
            return [];
        }
    };

    // Get recent directories for menu (with shortened names)
    const getRecentDirectoriesForMenu = (): RecentDirectoryMenuEntry[] => {
        const directories = getRecentDirectories();
        return directories.map(directory => {
            // Extract just the last folder name for display
            const parts = directory.replace(/\\/g, '/').split('/');
            const name = parts[parts.length - 1] || parts[parts.length - 2] || directory;
            return { path: directory, name };
        });
    };

    return {
        recentFiles,
        setRecentFiles,
        addToRecentFiles,
        getRecentDirectories,
        getRecentDirectoriesForMenu
    };
};

export default useRecentFiles;
